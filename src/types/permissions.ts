// Shared RBAC shapes used by the permissions context, the admin console, and the
// backend contract. Kept separate from types/index.ts to avoid churn there.

export type RecordScope = 'all' | 'own'

// A leaf permission key, e.g. 'inventory:apps' or 'governance:dlp'. Rail-level
// visibility is derived (a rail is visible when the user holds >=1 of its leaves).
export type PermissionKey = string

export interface EffectivePermissions {
  allowedKeys: PermissionKey[]
  isAppAdmin: boolean
  canManageUsers: boolean
  recordScope: RecordScope
}

export interface RoleDefinition {
  id: string
  name: string
  isPredefined: boolean
  allowedKeys: PermissionKey[]
  isAppAdmin: boolean
  canManageUsers: boolean
  recordScope: RecordScope
}

export interface Assignment {
  id: string
  principalId: string // Entra object id (oid)
  principalName: string
  principalUpn: string
  roleId: string
  roleName: string
}

export interface DirectoryUser {
  id: string
  displayName: string
  userPrincipalName: string
  mail?: string
}
