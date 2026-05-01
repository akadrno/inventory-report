import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, powerAppsScopes } from '../auth/msalConfig'

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

export interface AppPermission {
  roleName: 'CanView' | 'CanEdit' | 'Owner'
  principalType: 'User' | 'Group' | 'ServicePrincipal' | 'Tenant'
  principalDisplayName: string
  principalEmail?: string
  principalObjectId?: string
  notifyShareTargetOption?: string
}

export async function fetchAppPermissions(appId: string): Promise<AppPermission[]> {
  const token = await getPowerAppsToken()
  const res = await fetch(
    `https://api.powerapps.com/providers/Microsoft.PowerApps/apps/${encodeURIComponent(appId)}/permissions?api-version=2016-11-01`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`App permissions fetch failed: ${res.status}`)
  const json = await res.json()
  const raw: Record<string, unknown>[] = json.value ?? []
  return raw.map(p => {
    const props = (p['properties'] as Record<string, unknown>) ?? {}
    const principal = (props['principal'] as Record<string, unknown>) ?? {}
    return {
      roleName: (props['roleName'] as AppPermission['roleName']) ?? 'CanView',
      principalType: (principal['type'] as AppPermission['principalType']) ?? 'User',
      principalDisplayName: (principal['displayName'] as string) ?? (principal['email'] as string) ?? '',
      principalEmail: principal['email'] as string | undefined,
      principalObjectId: principal['id'] as string | undefined,
    }
  })
}
