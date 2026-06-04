// Client-credentials (app-only) token acquisition for the service principal that
// holds the elevated Power Platform / Graph permissions. Tokens are cached per scope
// until shortly before expiry so we don't mint one per request.

const TENANT_ID = process.env.TENANT_ID ?? ''
const SP_CLIENT_ID = process.env.SP_CLIENT_ID ?? ''
const SP_CLIENT_SECRET = process.env.SP_CLIENT_SECRET ?? ''

const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`

interface CachedToken {
  token: string
  expiresAt: number // epoch ms
}

const cache = new Map<string, CachedToken>()

export async function getAppToken(scope: string): Promise<string> {
  const cached = cache.get(scope)
  // 60s safety margin before actual expiry.
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token

  const body = new URLSearchParams({
    client_id: SP_CLIENT_ID,
    client_secret: SP_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Token acquisition failed (${res.status}): ${text}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cache.set(scope, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 })
  return data.access_token
}

// Common scopes (app-only / .default).
export const SCOPES = {
  graph: 'https://graph.microsoft.com/.default',
  powerPlatform: 'https://api.powerplatform.com/.default',
  bap: 'https://api.bap.microsoft.com/.default',
  powerApps: 'https://service.powerapps.com/.default',
}
