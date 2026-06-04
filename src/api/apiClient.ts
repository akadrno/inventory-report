import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, apiScopes } from '../auth/msalConfig'

// ── Backend (Azure Functions) client ─────────────────────────────────────────
// Single seam for all calls to this app's own /api backend. The backend holds an
// elevated service identity and enforces RBAC; the SPA authenticates to it with a
// delegated `access_as_user` token.
//
// Toggle: VITE_API_BASE_URL.
//   - unset/empty  → backend DISABLED; the app runs in legacy direct-token mode
//                    (every data call uses the user's own admin token, as before).
//   - '/'          → backend ENABLED, same-origin (the SWA serves /api/*).
//   - 'https://…'  → backend ENABLED at an explicit origin (local dev / split host).

const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
export const apiConfigured = !!raw
// '/' or a trailing-slashed origin collapses to '' so a leading-slash path resolves
// same-origin; an explicit origin is preserved.
export const apiBaseUrl = raw ? raw.replace(/\/+$/, '') : ''

let _inFlight: Promise<string> | null = null

async function getApiToken(): Promise<string> {
  if (_inFlight) return _inFlight
  const account = msalInstance.getAllAccounts()[0]
  if (!account) throw new Error('No authenticated account found')
  _inFlight = (async () => {
    try {
      const r = await msalInstance.acquireTokenSilent({ scopes: apiScopes, account })
      return r.accessToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const r = await msalInstance.acquireTokenPopup({ scopes: apiScopes, account })
        return r.accessToken
      }
      throw e
    }
  })().finally(() => { _inFlight = null })
  return _inFlight
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!apiConfigured) throw new Error('Backend API not configured (VITE_API_BASE_URL unset)')
  const token = await getApiToken()
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const url = path.startsWith('http')
    ? path
    : `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  return fetch(url, { ...init, headers })
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  // 204 / empty body → null
  if (res.status === 204) return null as T
  return (await res.json()) as T
}
