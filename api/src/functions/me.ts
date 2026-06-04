import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { getEffectivePermissions } from '../lib/permissions'
import { errorResponse, json } from '../lib/http'

// GET /api/me/permissions — the caller's effective access (pages + flags + scope).
async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    const perms = await getEffectivePermissions(caller)
    return json(perms)
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('me-permissions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me/permissions',
  handler,
})
