import { apiJson } from './apiClient'
import type {
  Assignment,
  DirectoryUser,
  EffectivePermissions,
  RoleDefinition,
} from '../types/permissions'

// ── RBAC backend calls ───────────────────────────────────────────────────────
// Thin typed wrappers over the /api endpoints the Functions backend exposes.
// All go through apiJson, which attaches the user's access_as_user bearer token.

export function fetchMyPermissions(signal?: AbortSignal): Promise<EffectivePermissions> {
  return apiJson<EffectivePermissions>('/api/me/permissions', { signal })
}

export function searchDirectory(q: string, signal?: AbortSignal): Promise<DirectoryUser[]> {
  return apiJson<DirectoryUser[]>(`/api/directory/search?q=${encodeURIComponent(q)}`, { signal })
}

// Roles
export function listRoles(signal?: AbortSignal): Promise<RoleDefinition[]> {
  return apiJson<RoleDefinition[]>('/api/admin/roles', { signal })
}

export function createRole(role: Omit<RoleDefinition, 'id' | 'isPredefined'>): Promise<RoleDefinition> {
  return apiJson<RoleDefinition>('/api/admin/roles', { method: 'POST', body: JSON.stringify(role) })
}

export function updateRole(role: RoleDefinition): Promise<RoleDefinition> {
  return apiJson<RoleDefinition>(`/api/admin/roles/${encodeURIComponent(role.id)}`, {
    method: 'PUT',
    body: JSON.stringify(role),
  })
}

export function deleteRole(id: string): Promise<void> {
  return apiJson<void>(`/api/admin/roles/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// Assignments
export function listAssignments(signal?: AbortSignal): Promise<Assignment[]> {
  return apiJson<Assignment[]>('/api/admin/assignments', { signal })
}

export function createAssignment(input: { principalId: string; roleId: string }): Promise<Assignment> {
  return apiJson<Assignment>('/api/admin/assignments', { method: 'POST', body: JSON.stringify(input) })
}

export function deleteAssignment(id: string): Promise<void> {
  return apiJson<void>(`/api/admin/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
