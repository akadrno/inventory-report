import { randomUUID } from 'crypto'
import { TableClient, odata } from '@azure/data-tables'
import { PREDEFINED_BY_ID, PREDEFINED_ROLES, RecordScope, RoleDefinition } from './catalog'
import { HttpError } from './http'

const CONN = process.env.STORAGE_CONNECTION_STRING ?? ''
const ROLES_TABLE = 'ppacRoles'
const ASSIGN_TABLE = 'ppacRoleAssignments'

let _roles: TableClient | null = null
let _assign: TableClient | null = null

async function rolesTable(): Promise<TableClient> {
  if (!_roles) {
    _roles = TableClient.fromConnectionString(CONN, ROLES_TABLE)
    await ensureTable(_roles)
  }
  return _roles
}

async function assignTable(): Promise<TableClient> {
  if (!_assign) {
    _assign = TableClient.fromConnectionString(CONN, ASSIGN_TABLE)
    await ensureTable(_assign)
  }
  return _assign
}

async function ensureTable(client: TableClient): Promise<void> {
  try {
    await client.createTable()
  } catch (e: unknown) {
    // Ignore "already exists"; rethrow anything else.
    const code = (e as { statusCode?: number })?.statusCode
    if (code !== 409) throw e
  }
}

// ── Roles ────────────────────────────────────────────────────────────────────
// Predefined roles live in code (read-only); only custom roles are persisted.

export interface CustomRoleInput {
  name: string
  allowedKeys: string[]
  isAppAdmin: boolean
  canManageUsers: boolean
  recordScope: RecordScope
}

function entityToRole(e: Record<string, unknown>): RoleDefinition {
  return {
    id: e['rowKey'] as string,
    name: (e['name'] as string) ?? '',
    isPredefined: false,
    allowedKeys: JSON.parse((e['allowedKeys'] as string) ?? '[]'),
    isAppAdmin: (e['isAppAdmin'] as boolean) ?? false,
    canManageUsers: (e['canManageUsers'] as boolean) ?? false,
    recordScope: ((e['recordScope'] as string) ?? 'all') as RecordScope,
  }
}

export async function listCustomRoles(): Promise<RoleDefinition[]> {
  const table = await rolesTable()
  const out: RoleDefinition[] = []
  for await (const e of table.listEntities<Record<string, unknown>>()) out.push(entityToRole(e))
  return out
}

export async function listAllRoles(): Promise<RoleDefinition[]> {
  return [...PREDEFINED_ROLES, ...(await listCustomRoles())]
}

export async function getRole(id: string): Promise<RoleDefinition | null> {
  if (PREDEFINED_BY_ID.has(id)) return PREDEFINED_BY_ID.get(id)!
  const table = await rolesTable()
  try {
    const e = await table.getEntity<Record<string, unknown>>('role', id)
    return entityToRole(e)
  } catch {
    return null
  }
}

export async function createRole(input: CustomRoleInput): Promise<RoleDefinition> {
  const table = await rolesTable()
  const id = randomUUID()
  await table.createEntity({
    partitionKey: 'role',
    rowKey: id,
    name: input.name,
    allowedKeys: JSON.stringify(input.allowedKeys),
    isAppAdmin: input.isAppAdmin,
    canManageUsers: input.canManageUsers,
    recordScope: input.recordScope,
  })
  return { id, isPredefined: false, ...input }
}

export async function updateRole(id: string, input: CustomRoleInput): Promise<RoleDefinition> {
  if (PREDEFINED_BY_ID.has(id)) throw new HttpError(403, 'Predefined roles cannot be edited')
  const table = await rolesTable()
  await table.updateEntity(
    {
      partitionKey: 'role',
      rowKey: id,
      name: input.name,
      allowedKeys: JSON.stringify(input.allowedKeys),
      isAppAdmin: input.isAppAdmin,
      canManageUsers: input.canManageUsers,
      recordScope: input.recordScope,
    },
    'Replace',
  )
  return { id, isPredefined: false, ...input }
}

export async function deleteRole(id: string): Promise<void> {
  if (PREDEFINED_BY_ID.has(id)) throw new HttpError(403, 'Predefined roles cannot be deleted')
  const table = await rolesTable()
  await table.deleteEntity('role', id)
}

// ── Assignments ──────────────────────────────────────────────────────────────

export interface Assignment {
  id: string
  principalId: string
  principalName: string
  principalUpn: string
  roleId: string
  roleName: string
}

function entityToAssignment(e: Record<string, unknown>): Assignment {
  return {
    id: e['rowKey'] as string,
    principalId: (e['principalId'] as string) ?? '',
    principalName: (e['principalName'] as string) ?? '',
    principalUpn: (e['principalUpn'] as string) ?? '',
    roleId: (e['roleId'] as string) ?? '',
    roleName: (e['roleName'] as string) ?? '',
  }
}

export async function listAssignments(): Promise<Assignment[]> {
  const table = await assignTable()
  const out: Assignment[] = []
  for await (const e of table.listEntities<Record<string, unknown>>()) out.push(entityToAssignment(e))
  return out
}

export async function listAssignmentsForUser(oid: string): Promise<Assignment[]> {
  const table = await assignTable()
  const out: Assignment[] = []
  const iter = table.listEntities<Record<string, unknown>>({
    queryOptions: { filter: odata`principalId eq ${oid}` },
  })
  for await (const e of iter) out.push(entityToAssignment(e))
  return out
}

export async function createAssignment(a: Omit<Assignment, 'id'>): Promise<Assignment> {
  const table = await assignTable()
  // One row per (user, role); re-assigning the same role is idempotent.
  const id = `${a.principalId}__${a.roleId}`
  await table.upsertEntity(
    {
      partitionKey: 'assign',
      rowKey: id,
      principalId: a.principalId,
      principalName: a.principalName,
      principalUpn: a.principalUpn,
      roleId: a.roleId,
      roleName: a.roleName,
    },
    'Replace',
  )
  return { id, ...a }
}

export async function deleteAssignment(id: string): Promise<void> {
  const table = await assignTable()
  await table.deleteEntity('assign', id)
}
