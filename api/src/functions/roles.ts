import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { requireAppAdmin } from '../lib/permissions'
import { createRole, deleteRole, listAllRoles, updateRole, CustomRoleInput } from '../lib/storage'
import { isValidPermissionKey, RecordScope } from '../lib/catalog'
import { errorResponse, HttpError, json, noContent } from '../lib/http'

function parseRoleInput(body: unknown): CustomRoleInput {
  const b = (body ?? {}) as Record<string, unknown>
  const name = typeof b['name'] === 'string' ? b['name'].trim() : ''
  if (!name) throw new HttpError(400, 'Role name is required')

  const rawKeys = Array.isArray(b['allowedKeys']) ? (b['allowedKeys'] as unknown[]) : []
  const allowedKeys = rawKeys.filter((k): k is string => typeof k === 'string' && isValidPermissionKey(k))

  const recordScope: RecordScope = b['recordScope'] === 'own' ? 'own' : 'all'
  return {
    name,
    allowedKeys,
    isAppAdmin: b['isAppAdmin'] === true,
    canManageUsers: b['canManageUsers'] === true,
    recordScope,
  }
}

// Single function for both the collection and item routes (optional {id?}) so the
// two don't register as an overlapping parent/child pair — which SWA's Functions
// host silently drops.
//   GET    /api/admin/roles        → list
//   POST   /api/admin/roles        → create
//   PUT    /api/admin/roles/{id}   → update
//   DELETE /api/admin/roles/{id}   → delete
async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    await requireAppAdmin(caller)
    const id = req.params.id

    if (id) {
      if (req.method === 'DELETE') {
        await deleteRole(id)
        return noContent()
      }
      if (req.method === 'PUT') {
        return json(await updateRole(id, parseRoleInput(await req.json())))
      }
      throw new HttpError(405, `Method ${req.method} not allowed on a role`)
    }

    if (req.method === 'GET') return json(await listAllRoles())
    if (req.method === 'POST') return json(await createRole(parseRoleInput(await req.json())), 201)
    throw new HttpError(405, `Method ${req.method} not allowed`)
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('admin-roles', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'admin/roles/{id?}',
  handler,
})
