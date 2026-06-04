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

// GET /api/admin/roles  |  POST /api/admin/roles
async function collectionHandler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    await requireAppAdmin(caller)

    if (req.method === 'GET') return json(await listAllRoles())

    const input = parseRoleInput(await req.json())
    const role = await createRole(input)
    return json(role, 201)
  } catch (e) {
    return errorResponse(e)
  }
}

// PUT /api/admin/roles/{id}  |  DELETE /api/admin/roles/{id}
async function itemHandler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    await requireAppAdmin(caller)

    const id = req.params.id
    if (!id) throw new HttpError(400, 'Role id required')

    if (req.method === 'DELETE') {
      await deleteRole(id)
      return noContent()
    }
    const input = parseRoleInput(await req.json())
    return json(await updateRole(id, input))
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('admin-roles', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'admin/roles',
  handler: collectionHandler,
})

app.http('admin-roles-item', {
  methods: ['PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'admin/roles/{id}',
  handler: itemHandler,
})
