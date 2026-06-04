import { ALL_PERMISSION_KEYS, RecordScope } from './catalog'
import { Caller } from './auth'
import { getRole, listAssignmentsForUser } from './storage'
import { HttpError } from './http'

export interface EffectivePermissions {
  allowedKeys: string[]
  isAppAdmin: boolean
  canManageUsers: boolean
  recordScope: RecordScope
}

const FULL_ADMIN: EffectivePermissions = {
  allowedKeys: ALL_PERMISSION_KEYS,
  isAppAdmin: true,
  canManageUsers: true,
  recordScope: 'all',
}

// Combine a caller's Entra directory roles + assigned in-app roles into a single
// effective permission set. More-permissive wins (union of pages/flags; 'all'
// record scope beats 'own' if any role grants it).
export async function getEffectivePermissions(caller: Caller): Promise<EffectivePermissions> {
  if (caller.isDirectoryAdmin) return FULL_ADMIN

  const assignments = await listAssignmentsForUser(caller.oid)
  if (assignments.length === 0) {
    return { allowedKeys: [], isAppAdmin: false, canManageUsers: false, recordScope: 'own' }
  }

  const keys = new Set<string>()
  let isAppAdmin = false
  let canManageUsers = false
  let anyAll = false

  for (const a of assignments) {
    const role = await getRole(a.roleId)
    if (!role) continue
    if (role.isAppAdmin) return FULL_ADMIN // app-admin role implies everything
    role.allowedKeys.forEach(k => keys.add(k))
    canManageUsers = canManageUsers || role.canManageUsers
    if (role.recordScope === 'all') anyAll = true
  }

  return {
    allowedKeys: [...keys],
    isAppAdmin,
    canManageUsers,
    recordScope: anyAll ? 'all' : 'own',
  }
}

// ── Guards ───────────────────────────────────────────────────────────────────

export async function requireAppAdmin(caller: Caller): Promise<EffectivePermissions> {
  const perms = await getEffectivePermissions(caller)
  if (!perms.isAppAdmin) throw new HttpError(403, 'App administrator access required')
  return perms
}

export async function requireManageUsers(caller: Caller): Promise<EffectivePermissions> {
  const perms = await getEffectivePermissions(caller)
  if (!perms.canManageUsers && !perms.isAppAdmin) throw new HttpError(403, 'User management access required')
  return perms
}

export async function requirePage(caller: Caller, key: string): Promise<EffectivePermissions> {
  const perms = await getEffectivePermissions(caller)
  if (!perms.isAppAdmin && !perms.allowedKeys.includes(key)) {
    throw new HttpError(403, `Access to ${key} is not permitted`)
  }
  return perms
}
