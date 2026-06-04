import { HttpRequest } from '@azure/functions'
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'
import { ADMIN_WIDS } from './catalog'
import { HttpError } from './http'

const TENANT_ID = process.env.TENANT_ID ?? ''
const API_APP_ID = process.env.API_APP_ID ?? ''

// Accept both the v2 (login.microsoftonline.com/.../v2.0) and v1 (sts.windows.net/.../)
// issuers, since a custom-API access token's version depends on the app's
// requestedAccessTokenVersion and we want validation to hold either way.
const ISSUERS = [
  `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
  `https://sts.windows.net/${TENANT_ID}/`,
]
const JWKS = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`),
)

export interface Caller {
  oid: string // Entra object id
  upn: string // preferred_username / UPN
  name: string
  wids: string[] // directory-role template ids
  isDirectoryAdmin: boolean // holds Global / Power Platform / Dynamics admin
}

// The token audience may be the bare app id GUID or the api://<id> URI depending on
// how the scope was minted; accept both.
function audienceMatches(aud: JWTPayload['aud']): boolean {
  const allowed = new Set([API_APP_ID, `api://${API_APP_ID}`])
  if (typeof aud === 'string') return allowed.has(aud)
  if (Array.isArray(aud)) return aud.some(a => allowed.has(a))
  return false
}

export async function validateUser(req: HttpRequest): Promise<Caller> {
  // Read the user token from a custom header — Azure Static Web Apps overwrites the
  // standard `Authorization` header before forwarding to the managed Functions, so it
  // can't be used. Fall back to Authorization for local dev (no SWA in front).
  const custom = req.headers.get('x-ppac-auth')
  const authMatch = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')
  const token = custom || authMatch?.[1]
  if (!token) throw new HttpError(401, 'Missing auth token')

  let payload: JWTPayload
  try {
    const result = await jwtVerify(token, JWKS, { issuer: ISSUERS })
    payload = result.payload
  } catch (e) {
    throw new HttpError(401, `Invalid or expired token: ${(e as Error).message}`)
  }

  if (!audienceMatches(payload.aud)) throw new HttpError(401, 'Token audience mismatch')

  const wids = Array.isArray(payload['wids']) ? (payload['wids'] as string[]) : []
  const oid = (payload['oid'] as string) ?? (payload.sub as string)
  if (!oid) throw new HttpError(401, 'Token missing oid')

  return {
    oid,
    upn: (payload['preferred_username'] as string) ?? (payload['upn'] as string) ?? '',
    name: (payload['name'] as string) ?? '',
    wids,
    isDirectoryAdmin: wids.some(w => w in ADMIN_WIDS),
  }
}
