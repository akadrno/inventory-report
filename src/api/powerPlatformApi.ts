import { IPublicClientApplication } from '@azure/msal-browser'
import { powerPlatformScopes } from '../auth/msalConfig'
import type { ResourceItem, ResourceQueryResponse } from '../types'
import type { DebugEntry } from '../context/DebugContext'
import { KNOWN_INVENTORY_RESOURCE_TYPES } from '../config/resourceCatalog'

const API_BASE = 'https://api.powerplatform.com'
const API_VERSION = '2024-10-01'
const API_URL = `${API_BASE}/resourcequery/resources/query?api-version=${API_VERSION}`

// KQLOM clause types — discriminated by $type
interface WhereClause {
  $type: 'where'
  FieldName: string
  Operator: string
  Values: string[]
}

interface ProjectClause {
  $type: 'project'
  FieldList: string[]
}

interface OrderByClause {
  $type: 'orderby'
  FieldNamesAscDesc: Record<string, 'asc' | 'desc'>
}

type KustoClause = WhereClause | ProjectClause | OrderByClause

// Explicit type matching for inventory resources. `contains` with multiple
// values is rejected by the API parser, so we keep a valid `in~` allowlist
// for the primary fetch path.
const DEFAULT_CLAUSES: WhereClause[] = [
  {
    $type: 'where',
    FieldName: 'type',
    Operator: 'in~',
    Values: KNOWN_INVENTORY_RESOURCE_TYPES.map(t => `'${t}'`),
  },
]

const TYPE_CENSUS_CLAUSES: ProjectClause[] = [
  { $type: 'project', FieldList: ['type'] },
]

const GROUPS_CLAUSES: WhereClause[] = [
  { $type: 'where', FieldName: 'type', Operator: 'contains', Values: ["'environmentgroups'"] },
]

const ENVIRONMENTS_CLAUSES: WhereClause[] = [
  {
    $type: 'where',
    FieldName: 'type',
    Operator: 'in~',
    Values: [
      "'microsoft.powerplatform/environments'",
      // Fallback for older API versions
      "'microsoft.businessapplicationplatform/environments'",
    ],
  },
]

async function getAccessToken(msalInstance: IPublicClientApplication): Promise<string> {
  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) throw new Error('No authenticated account found')

  const response = await msalInstance.acquireTokenSilent({
    scopes: powerPlatformScopes,
    account: accounts[0],
  })
  return response.accessToken
}

export interface QueryOptions {
  skipToken?: string
  top?: number
  clauses?: KustoClause[]
  onDebug?: (entry: Omit<DebugEntry, 'id'>) => void
}

export interface TypeCensusOptions {
  maxPages?: number
  top?: number
  onDebug?: (entry: Omit<DebugEntry, 'id'>) => void
}

export interface TypeCensusResult {
  distinctTypes: string[]
  pagesScanned: number
  recordsScanned: number
  hasMore: boolean
}

async function queryResources(
  token: string,
  options?: QueryOptions,
): Promise<ResourceQueryResponse> {
  const body: Record<string, unknown> = {
    TableName: 'PowerPlatformResources',
    Clauses: options?.clauses ?? DEFAULT_CLAUSES,
    Options: {
      Top: options?.top ?? 100,
      ...(options?.skipToken ? { SkipToken: options.skipToken } : { Skip: 0 }),
    },
  }

  const start = Date.now()
  let status: number | undefined
  let responseBody: string | undefined

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    status = response.status
    responseBody = await response.text()
    const durationMs = Date.now() - start

    options?.onDebug?.({
      timestamp: new Date(),
      requestUrl: API_URL,
      requestBody: body,
      status,
      responseBody,
      durationMs,
    })

    if (!response.ok) {
      throw new Error(`API error ${status}: ${responseBody}`)
    }

    return JSON.parse(responseBody) as ResourceQueryResponse
  } catch (err) {
    const durationMs = Date.now() - start
    const error = err instanceof Error ? err.message : String(err)

    if (status === undefined) {
      options?.onDebug?.({
        timestamp: new Date(),
        requestUrl: API_URL,
        requestBody: body,
        durationMs,
        error,
      })
    }

    throw err
  }
}

export async function fetchResourcesPage(
  msalInstance: IPublicClientApplication,
  options?: QueryOptions,
): Promise<ResourceQueryResponse> {
  const token = await getAccessToken(msalInstance)
  return queryResources(token, options)
}

export async function fetchEnvironmentsPage(
  msalInstance: IPublicClientApplication,
  options?: QueryOptions,
): Promise<ResourceQueryResponse> {
  const token = await getAccessToken(msalInstance)
  return queryResources(token, { ...options, clauses: ENVIRONMENTS_CLAUSES })
}

export async function fetchEnvironmentGroupsPage(
  msalInstance: IPublicClientApplication,
  options?: QueryOptions,
): Promise<ResourceQueryResponse> {
  const token = await getAccessToken(msalInstance)
  return queryResources(token, { ...options, clauses: GROUPS_CLAUSES })
}

export async function fetchAllResources(
  msalInstance: IPublicClientApplication,
): Promise<ResourceItem[]> {
  const token = await getAccessToken(msalInstance)
  const all: ResourceItem[] = []
  let skipToken: string | undefined

  // Drive pagination off the continuation token alone. Some response shapes
  // set `resultTruncated` to 0 even when a skipToken is present, so we only
  // stop when the API explicitly omits the token.
  do {
    const result = await queryResources(token, { top: 500, skipToken })
    all.push(...result.data)
    if (result.resultTruncated && !result.skipToken) {
      console.warn('fetchAllResources: API reports truncated results but provided no continuation token; pagination cannot continue')
    }
    skipToken = result.skipToken
  } while (skipToken)

  return all
}

export async function fetchResourceTypeCensus(
  msalInstance: IPublicClientApplication,
  options?: TypeCensusOptions,
): Promise<TypeCensusResult> {
  const token = await getAccessToken(msalInstance)
  const maxPages = Math.max(1, options?.maxPages ?? 10)
  const top = options?.top ?? 500
  const found = new Set<string>()
  let skipToken: string | undefined
  let pagesScanned = 0
  let recordsScanned = 0

  do {
    const result = await queryResources(token, {
      top,
      skipToken,
      clauses: TYPE_CENSUS_CLAUSES,
      onDebug: options?.onDebug,
    })
    pagesScanned += 1
    recordsScanned += result.data.length
    for (const r of result.data) {
      if (typeof r.type === 'string' && r.type.trim()) {
        found.add(r.type.toLowerCase())
      }
    }
    skipToken = result.skipToken
  } while (skipToken && pagesScanned < maxPages)

  return {
    distinctTypes: [...found].sort(),
    pagesScanned,
    recordsScanned,
    hasMore: Boolean(skipToken),
  }
}
