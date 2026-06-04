// Server-side mirror of src/permissions/catalog.ts. Keep the leaf keys and the
// predefined role definitions in sync with the frontend — they form the contract
// between the two halves of the app.

export type RecordScope = 'all' | 'own'

export interface RoleDefinition {
  id: string
  name: string
  isPredefined: boolean
  allowedKeys: string[]
  isAppAdmin: boolean
  canManageUsers: boolean
  recordScope: RecordScope
}

const CATALOG: Record<string, string[]> = {
  inventory: ['all', 'apps', 'flows', 'agents', 'environments', 'groups', 'users'],
  governance: ['overview', 'tenant-settings', 'dlp', 'cross-tenant', 'connections', 'recommendations', 'maker-analytics', 'risk-assessments'],
  usage: ['overview', 'heatmap'],
  tags: ['browser', 'termstore'],
  licensing: ['summary', 'power-apps', 'power-automate', 'copilot-studio'],
}

function railKeys(rail: keyof typeof CATALOG): string[] {
  return CATALOG[rail].map(v => `${rail}:${v}`)
}

export const ALL_PERMISSION_KEYS: string[] = Object.keys(CATALOG).flatMap(r => railKeys(r))

export function isValidPermissionKey(key: string): boolean {
  return ALL_PERMISSION_KEYS.includes(key)
}

export const PREDEFINED_ROLES: RoleDefinition[] = [
  { id: 'app-administrator', name: 'App Administrator', isPredefined: true, allowedKeys: ALL_PERMISSION_KEYS, isAppAdmin: true, canManageUsers: true, recordScope: 'all' },
  { id: 'usage-administrator', name: 'Usage Administrator', isPredefined: true, allowedKeys: railKeys('usage'), isAppAdmin: false, canManageUsers: true, recordScope: 'all' },
  { id: 'full-viewer', name: 'Full Viewer', isPredefined: true, allowedKeys: ALL_PERMISSION_KEYS, isAppAdmin: false, canManageUsers: false, recordScope: 'all' },
  { id: 'own-records-viewer', name: 'Own-Records Viewer', isPredefined: true, allowedKeys: [...railKeys('inventory'), ...railKeys('usage')], isAppAdmin: false, canManageUsers: false, recordScope: 'own' },
]

export const PREDEFINED_BY_ID = new Map(PREDEFINED_ROLES.map(r => [r.id, r]))

// Entra directory-role template IDs that grant implicit app-admin. Present in the
// `wids` claim of the user's access token, so no Graph call is needed to detect them.
export const ADMIN_WIDS: Record<string, string> = {
  '62e90394-69f5-4237-9190-012177145e10': 'Global Administrator',
  '11648597-926c-4cf3-9c36-bcebb0ba8dcc': 'Power Platform Administrator',
  '44367163-eba1-44c3-98af-f5787879f96a': 'Dynamics 365 Administrator',
}
