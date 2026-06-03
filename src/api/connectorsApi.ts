import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, powerAppsScopes } from '../auth/msalConfig'
import { normalizeConnectorId } from '../utils/connectors'

// Enriches the connector IDs returned by the inventory (which expose IDs only —
// no tier, publisher, or display name) with metadata from the PowerApps `apis`
// endpoint. This is the data the connector inventory preview explicitly omits.

let _inFlight: Promise<string> | null = null

async function getPowerAppsToken(): Promise<string> {
  if (_inFlight) return _inFlight
  const account = msalInstance.getAllAccounts()[0]
  _inFlight = (async () => {
    try {
      const result = await msalInstance.acquireTokenSilent({ scopes: powerAppsScopes, account })
      return result.accessToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const result = await msalInstance.acquireTokenPopup({ scopes: powerAppsScopes, account })
        return result.accessToken
      }
      throw e
    }
  })().finally(() => { _inFlight = null })
  return _inFlight
}

export interface ConnectorMetadata {
  connectorId: string          // normalized id (no `shared_` prefix)
  displayName?: string
  tier?: string                // 'Standard' | 'Premium'
  publisher?: string
  iconBrandColor?: string
  iconUri?: string             // official connector icon (Microsoft CDN)
  isCustom?: boolean
}

// Returns a lookup keyed by normalized connector id for one environment. The
// catalog of first-party connectors is effectively global, so the resource's own
// environment is a fine source; custom connectors are environment-scoped and
// come back in the same list.
export async function fetchConnectorMetadata(
  environmentId: string,
  signal?: AbortSignal,
): Promise<Record<string, ConnectorMetadata>> {
  const token = await getPowerAppsToken()
  const env = environmentId.includes('/') ? environmentId.split('/').filter(Boolean).pop()! : environmentId
  const filter = encodeURIComponent(`environment eq '${env}'`)
  const res = await fetch(
    `https://api.powerapps.com/providers/Microsoft.PowerApps/apis?api-version=2016-11-01&$filter=${filter}`,
    { headers: { Authorization: `Bearer ${token}` }, signal },
  )
  if (!res.ok) throw new Error(`Connector metadata fetch failed: ${res.status}`)
  const json = await res.json()
  const raw: Record<string, unknown>[] = json.value ?? []

  const map: Record<string, ConnectorMetadata> = {}
  for (const c of raw) {
    const name = (c['name'] as string) ?? (c['id'] as string) ?? ''
    const id = normalizeConnectorId(name)
    if (!id) continue
    const props = (c['properties'] as Record<string, unknown>) ?? {}
    const metadata = (props['metadata'] as Record<string, unknown>) ?? {}
    const source = metadata['source'] as string | undefined
    const isCustom =
      props['isCustomApi'] === true ||
      (typeof source === 'string' && source.toLowerCase() === 'custom') ||
      undefined
    map[id] = {
      connectorId: id,
      displayName: (props['displayName'] as string) || undefined,
      tier: (props['tier'] as string) || undefined,
      publisher: (props['publisher'] as string) || undefined,
      iconBrandColor: (props['iconBrandColor'] as string) || undefined,
      iconUri: (props['iconUri'] as string) || undefined,
      isCustom,
    }
  }
  return map
}
