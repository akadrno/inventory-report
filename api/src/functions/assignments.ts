import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { requireManageUsers } from '../lib/permissions'
import { createAssignment, deleteAssignment, getRole, listAssignments } from '../lib/storage'
import { getAppToken, SCOPES } from '../lib/tokens'
import { errorResponse, HttpError, json, noContent } from '../lib/http'

async function resolveUser(oid: string): Promise<{ displayName: string; upn: string }> {
  const token = await getAppToken(SCOPES.graph)
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(oid)}?$select=id,displayName,userPrincipalName,mail`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new HttpError(400, 'Could not resolve the selected user in the directory')
  const u = (await res.json()) as { displayName?: string; userPrincipalName?: string; mail?: string }
  return { displayName: u.displayName ?? '', upn: u.userPrincipalName ?? u.mail ?? '' }
}

// Routes use the `rbac/` prefix, not `admin/` (reserved by the Functions host —
// see roles.ts). Single function via an optional {id?} segment:
//   GET    /api/rbac/assignments        → list
//   POST   /api/rbac/assignments        → add (body: {principalId, roleId})
//   DELETE /api/rbac/assignments/{id}   → remove
async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    await requireManageUsers(caller)
    const id = req.params.id

    if (id) {
      if (req.method !== 'DELETE') throw new HttpError(405, `Method ${req.method} not allowed on an assignment`)
      await deleteAssignment(id)
      return noContent()
    }

    if (req.method === 'GET') return json(await listAssignments())

    if (req.method === 'POST') {
      const body = ((await req.json()) ?? {}) as { principalId?: string; roleId?: string }
      if (!body.principalId || !body.roleId) throw new HttpError(400, 'principalId and roleId are required')
      const role = await getRole(body.roleId)
      if (!role) throw new HttpError(400, 'Unknown role')
      const user = await resolveUser(body.principalId)
      const assignment = await createAssignment({
        principalId: body.principalId,
        principalName: user.displayName,
        principalUpn: user.upn,
        roleId: role.id,
        roleName: role.name,
      })
      return json(assignment, 201)
    }
    throw new HttpError(405, `Method ${req.method} not allowed`)
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('rbac-assignments', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'rbac/assignments/{id?}',
  handler,
})
