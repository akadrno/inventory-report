import type { PermissionKey, RoleDefinition } from '../types/permissions'

// ── Permission catalog ───────────────────────────────────────────────────────
// THE single source of truth for permission keys. The keys here are exactly the
// strings passed to can()/canRail() in the Shell and exactly the values stored
// in RoleDefinition.allowedKeys (and on the backend). The rail/subview labels
// mirror the live nav in Shell.tsx so the admin role matrix reads identically.
//
// 'home' is intentionally NOT in the catalog: it's the always-available landing
// page and is never gated. 'admin' is gated separately on isAppAdmin.

export interface CatalogRail {
  rail: string // matches a RailSection value in Shell.tsx
  label: string
  subs: { key: PermissionKey; label: string }[]
}

export const PERMISSION_CATALOG: CatalogRail[] = [
  {
    rail: 'inventory',
    label: 'Inventory',
    subs: [
      { key: 'inventory:all', label: 'All Resources' },
      { key: 'inventory:apps', label: 'Apps' },
      { key: 'inventory:flows', label: 'Flows' },
      { key: 'inventory:agents', label: 'Agents' },
      { key: 'inventory:environments', label: 'Environments' },
      { key: 'inventory:groups', label: 'Environment Groups' },
      { key: 'inventory:users', label: 'Users' },
    ],
  },
  {
    rail: 'governance',
    label: 'Governance',
    subs: [
      { key: 'governance:overview', label: 'Overview' },
      { key: 'governance:tenant-settings', label: 'Tenant Settings' },
      { key: 'governance:dlp', label: 'DLP Policies' },
      { key: 'governance:cross-tenant', label: 'Cross Tenant Connections' },
      { key: 'governance:connections', label: 'Connections' },
      { key: 'governance:recommendations', label: 'Recommendations' },
      { key: 'governance:maker-analytics', label: 'Maker Analytics' },
      { key: 'governance:risk-assessments', label: 'Risk Assessments' },
    ],
  },
  {
    rail: 'usage',
    label: 'Usage',
    subs: [
      { key: 'usage:overview', label: 'Overview' },
      { key: 'usage:heatmap', label: 'Heatmap' },
    ],
  },
  {
    rail: 'tags',
    label: 'Resource Tagging',
    subs: [
      { key: 'tags:browser', label: 'Resources' },
      { key: 'tags:termstore', label: 'Term Store' },
    ],
  },
  {
    rail: 'licensing',
    label: 'Licensing',
    subs: [
      { key: 'licensing:summary', label: 'Summary' },
      { key: 'licensing:power-apps', label: 'Power Apps' },
      { key: 'licensing:power-automate', label: 'Power Automate' },
      { key: 'licensing:copilot-studio', label: 'Copilot Studio' },
    ],
  },
]

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.flatMap(r => r.subs.map(s => s.key))

// Ordered leaf keys for a rail — used by Shell to snap a forbidden default
// sub-view to the first one the user is allowed to see (nav order preserved).
export function railSubKeys(rail: string): PermissionKey[] {
  return PERMISSION_CATALOG.find(r => r.rail === rail)?.subs.map(s => s.key) ?? []
}

// ── Predefined roles ─────────────────────────────────────────────────────────
// Shipped, read-only roles. The backend seeds an identical set (keep in sync);
// the frontend copy lets the admin console render them before the API responds
// and gives the legacy/no-backend mode a sensible "full access" shape.

export const PREDEFINED_ROLES: RoleDefinition[] = [
  {
    id: 'app-administrator',
    name: 'App Administrator',
    isPredefined: true,
    allowedKeys: ALL_PERMISSION_KEYS,
    isAppAdmin: true,
    canManageUsers: true,
    recordScope: 'all',
  },
  {
    id: 'usage-administrator',
    name: 'Usage Administrator',
    isPredefined: true,
    allowedKeys: railSubKeys('usage'),
    isAppAdmin: false,
    canManageUsers: true,
    recordScope: 'all',
  },
  {
    id: 'full-viewer',
    name: 'Full Viewer',
    isPredefined: true,
    allowedKeys: ALL_PERMISSION_KEYS,
    isAppAdmin: false,
    canManageUsers: false,
    recordScope: 'all',
  },
  {
    id: 'own-records-viewer',
    name: 'Own-Records Viewer',
    isPredefined: true,
    allowedKeys: [...railSubKeys('inventory'), ...railSubKeys('usage')],
    isAppAdmin: false,
    canManageUsers: false,
    recordScope: 'own',
  },
]
