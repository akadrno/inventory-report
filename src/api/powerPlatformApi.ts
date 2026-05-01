import { IPublicClientApplication } from '@azure/msal-browser'
import { powerPlatformScopes } from '../auth/msalConfig'
import type { ResourceItem, ResourceQueryResponse } from '../types'
import type { DebugEntry } from '../context/DebugContext'

const API_BASE = 'https://api.powerplatform.com'
const API_VERSION = '2022-03-01-preview'
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

const DEFAULT_CLAUSES: WhereClause[] = [
  { $type: 'where', FieldName: 'type', Operator: 'contains', Values: ["'.'"] },
  { $type: 'where', FieldName: 'type', Operator: '!contains', Values: ["'settings'"] },
  { $type: 'where', FieldName: 'type', Operator: '!contains', Values: ["'environments'"] },
  { $type: 'where', FieldName: 'type', Operator: '!contains', Values: ["'environmentgroups'"] },
]

const GROUPS_CLAUSES: WhereClause[] = [
  { $type: 'where', FieldName: 'type', Operator: 'contains', Values: ["'environmentgroups'"] },
]

const ENVIRONMENTS_CLAUSES: WhereClause[] = [
  { $type: 'where', FieldName: 'type', Operator: 'contains', Values: ["'environments'"] },
  { $type: 'where', FieldName: 'type', Operator: '!contains', Values: ["'environmentgroups'"] },
  { $type: 'where', FieldName: 'type', Operator: '!contains', Values: ["'settings'"] },
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

  do {
    const result = await queryResources(token, { top: 100, skipToken })
    all.push(...result.data)
    skipToken = result.resultTruncated === 0 ? result.skipToken : undefined
  } while (skipToken)

  return all
}
