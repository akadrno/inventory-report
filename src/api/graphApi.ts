import { IPublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import { graphScopes, graphOrgScopes, msalInstance as defaultMsalInstance } from '../auth/msalConfig'
import { apiConfigured, apiJson } from './apiClient'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

async function getGraphToken(msalInstance: IPublicClientApplication): Promise<string> {
  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) throw new Error('No authenticated account')
  const response = await msalInstance.acquireTokenSilent({
    scopes: graphScopes,
    account: accounts[0],
  })
  return response.accessToken
}

interface BatchRequest {
  id: string
  method: string
  url: string
}

interface BatchResponseItem {
  id: string
  status: number
  body?: {
    displayName?: string
    userPrincipalName?: string
    appDisplayName?: string
    id?: string
  }
}

async function batchLookup(
  token: string,
  requests: BatchRequest[],
): Promise<BatchResponseItem[]> {
  const res = await fetch(`${GRAPH_BASE}/$batch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  })
  if (!res.ok) throw new Error(`Graph batch error ${res.status}`)
  const data = await res.json() as { responses: BatchResponseItem[] }
  return data.responses
}

// Resolves a chunk of ≤20 IDs, first as users, then retries 404s as service principals.
async function resolveChunk(token: string, ids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  // First pass: try as users
  const userRequests: BatchRequest[] = ids.map((id, i) => ({
    id: String(i),
    method: 'GET',
    url: `/users/${id}?$select=displayName,userPrincipalName`,
  }))

  const userResponses = await batchLookup(token, userRequests)
  const unresolved: string[] = []

  for (const resp of userResponses) {
    const id = ids[parseInt(resp.id)]
    if (resp.status === 200 && resp.body?.displayName) {
      result.set(id, resp.body.displayName)
    } else if (resp.status === 404 || resp.status === 400) {
      unresolved.push(id)
    }
  }

  // Second pass: retry unresolved as service principals (apps / managed identities)
  if (unresolved.length > 0) {
    const spRequests: BatchRequest[] = unresolved.map((id, i) => ({
      id: String(i),
      method: 'GET',
      url: `/servicePrincipals/${id}?$select=displayName,appDisplayName`,
    }))
    const spResponses = await batchLookup(token, spRequests)
    for (const resp of spResponses) {
      const id = unresolved[parseInt(resp.id)]
      if (resp.status === 200) {
        const name = resp.body?.displayName || resp.body?.appDisplayName
        if (name) result.set(id, name)
      }
    }
  }

  return result
}

/**
 * Resolves Entra object IDs (GUIDs) to display names.
 * Tries users first, then service principals for any that 404.
 */
export async function resolveOwnerIds(
  msalInstance: IPublicClientApplication,
  ids: string[],
): Promise<Map<string, string>> {
  if (!ids.length) return new Map()

  const token = await getGraphToken(msalInstance)
  const result = new Map<string, string>()

  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20)
    const chunkResult = await resolveChunk(token, chunk)
    chunkResult.forEach((name, id) => result.set(id, name))
  }

  return result
}

// ── License / SubscribedSku fetching ─────────────────────────────────────────

export interface SubscribedSkuPrepaidUnits {
  enabled: number
  suspended: number
  warning: number
  lockedOut: number
}

export interface ServicePlanInfo {
  servicePlanId: string
  servicePlanName: string
  provisioningStatus: string
  appliesTo: string
}

export interface SubscribedSku {
  id: string
  skuId: string
  skuPartNumber: string
  appliesTo: string
  capabilityStatus: string
  consumedUnits: number
  prepaidUnits: SubscribedSkuPrepaidUnits
  servicePlans: ServicePlanInfo[]
}

const POWER_PLATFORM_SKU_KEYWORDS = [
  'powerapps', 'power_apps',
  'flow', 'power_automate', 'powerautomate',
  'copilot', 'virtual_agent', 'powervirtualagent', 'power_virtual',
  'copilotstudio',
]

export function isPowerPlatformSku(sku: SubscribedSku): boolean {
  const partLower = sku.skuPartNumber.toLowerCase()
  if (POWER_PLATFORM_SKU_KEYWORDS.some(kw => partLower.includes(kw))) return true
  // Also check service plan names
  return sku.servicePlans.some(sp => {
    const spLower = sp.servicePlanName.toLowerCase()
    return POWER_PLATFORM_SKU_KEYWORDS.some(kw => spLower.includes(kw))
  })
}

let _orgTokenInFlight: Promise<string> | null = null

async function getGraphOrgToken(): Promise<string> {
  if (_orgTokenInFlight) return _orgTokenInFlight
  const account = defaultMsalInstance.getAllAccounts()[0]
  if (!account) throw new Error('No authenticated account')
  _orgTokenInFlight = (async () => {
    try {
      const result = await defaultMsalInstance.acquireTokenSilent({ scopes: graphOrgScopes, account })
      return result.accessToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const result = await defaultMsalInstance.acquireTokenPopup({ scopes: graphOrgScopes, account })
        return result.accessToken
      }
      throw e
    }
  })().finally(() => { _orgTokenInFlight = null })
  return _orgTokenInFlight
}

export async function fetchSubscribedSkus(): Promise<SubscribedSku[]> {
  // RBAC backend enabled → fetch via the elevated proxy (page-gated server-side).
  if (apiConfigured) return apiJson<SubscribedSku[]>('/api/licensing/skus')
  const token = await getGraphOrgToken()
  const res = await fetch(`${GRAPH_BASE}/subscribedSkus`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`SubscribedSkus fetch failed: ${res.status}`)
  const json = await res.json() as { value: SubscribedSku[] }
  return json.value ?? []
}
