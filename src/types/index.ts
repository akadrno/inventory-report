export interface ResourceItem {
  id: string
  name: string
  type: string
  kind?: string
  location?: string
  subscriptionId?: string
  resourceGroup?: string
  tenantId?: string
  environmentId?: string
  environmentName?: string
  environmentRegion?: string
  environmentType?: string
  isManagedEnvironment?: boolean
  managedBy?: string
  tags?: Record<string, string>
  properties?: Record<string, unknown>
}

export interface ResourceQueryResponse {
  count: number
  totalRecords: number
  resultTruncated: number
  skipToken?: string
  data: ResourceItem[]
}

export type ResourceTab = 'all' | 'apps' | 'flows' | 'agents' | 'groups' | 'users' | 'environments' | 'governance' | 'report'

const ENV_IN_RESOURCE_PATH = /\/environments\/([^/]+)/i
export function getEnvironmentIdFromPath(id: string): string | undefined {
  return ENV_IN_RESOURCE_PATH.exec(id)?.[1]
}

export interface ResourceFilters {
  search: string
  environment: string
  resourceTab: ResourceTab
}

export const RESOURCE_TYPES = {
  apps: [
    'microsoft.powerapps/apps',
    'microsoft.powerapps/canvasapps',
    'microsoft.powerapps/modeldrivenapps',
    'microsoft.powerapps/codeapps',
  ],
  flows: [
    'microsoft.flow/flows',
    'microsoft.powerapps/flows',
    'microsoft.powerautomate/cloudflows',
    'microsoft.powerautomate/agentflows',
    'microsoft.powerautomate/m365agentflows',
    'microsoft.logic/workflows',
  ],
  agents: [
    'microsoft.powerva/bots',
    'microsoft.powerva/agents',
    'microsoft.copilotstudio/agents',
    'microsoft.copilotstudio/bots',
    'microsoft.powerapps/agents',
    'microsoft.powervirtualagents/bots',
  ],
} as const

export function getResourceCategory(type: string): ResourceTab {
  const lower = type.toLowerCase()
  if (RESOURCE_TYPES.agents.some(t => lower === t || lower.includes(t) || t.includes(lower))) return 'agents'
  if (RESOURCE_TYPES.flows.some(t => lower === t || lower.includes(t) || t.includes(lower))) return 'flows'
  if (RESOURCE_TYPES.apps.some(t => lower === t || lower.includes(t) || t.includes(lower))) return 'apps'
  if (lower.includes('bot') || lower.includes('agent') || lower.includes('copilot')) return 'agents'
  if (lower.includes('flow') || lower.includes('agentflow') || lower.includes('logic')) return 'flows'
  if (lower.includes('app')) return 'apps'
  return 'all'
}

export function getDisplayName(item: ResourceItem): string {
  const p = item.properties
  if (p) {
    // Common display name keys across Power Platform resource types
    const candidates = [
      p['displayName'],
      p['DisplayName'],
      p['displayname'],
      p['friendlyName'],
      p['title'],
      p['Name'],
    ]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim()
    }
  }
  // Fall back to the raw name field
  return item.name
}

export function getEnvironmentName(item: ResourceItem): string | undefined {
  if (item.environmentName) return item.environmentName
  const p = item.properties
  if (!p) return undefined
  const candidates = [
    p['environmentDisplayName'],
    p['environmentName'],
    (p['environment'] as Record<string, unknown> | undefined)?.['displayName'],
    (p['environment'] as Record<string, unknown> | undefined)?.['name'],
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  // Last resort: return the ID so it's not blank
  return item.environmentId
}

export function getGroupEnvironmentIds(group: ResourceItem): string[] {
  const p = group.properties
  if (!p) return []
  // Try various shapes the API might use for the list of environments in a group
  const raw =
    p['environments'] ??
    p['environmentIds'] ??
    p['childEnvironments'] ??
    p['members']
  if (Array.isArray(raw)) {
    return raw.flatMap((e: unknown) => {
      if (typeof e === 'string') return [e]
      if (e && typeof e === 'object') {
        const obj = e as Record<string, unknown>
        const id = obj['id'] ?? obj['environmentId'] ?? obj['name']
        return typeof id === 'string' ? [id] : []
      }
      return []
    })
  }
  return []
}

export function getIsManagedEnvironment(env: ResourceItem): boolean {
  if (env.isManagedEnvironment != null) return env.isManagedEnvironment
  const p = env.properties
  if (!p) return false
  const v = p['isManaged'] ?? p['isManagedEnvironment'] ?? p['IsManaged']
  return v === true || v === 'true'
}

// Collect every owner/creator identity string (object id, UPN, email, display name)
// from a resource's properties — used for record-scope ('own') matching.
export function getOwnerIdentities(item: ResourceItem): string[] {
  const p = item.properties
  if (!p) return []
  const fields = [
    'owner', 'createdBy', 'lastModifiedBy', 'author', 'createdByUser',
    'modifiedBy', 'modifiedByUser', 'publishedBy', 'ownerEmail',
    'ownerDisplayName', 'ownerObjectId',
  ]
  const out: string[] = []
  for (const f of fields) {
    const v = p[f]
    if (typeof v === 'string' && v) {
      out.push(v)
    } else if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      for (const k of ['id', 'objectId', 'userPrincipalName', 'email', 'displayName']) {
        if (typeof obj[k] === 'string' && obj[k]) out.push(obj[k] as string)
      }
    }
  }
  return out
}

// True when any owner/creator identity of the resource matches one of the caller's
// identities (Entra object id or UPN/email), case-insensitively.
export function isOwnedBy(item: ResourceItem, identities: string[]): boolean {
  if (!identities.length) return false
  const wanted = new Set(identities.filter(Boolean).map(s => s.toLowerCase()))
  return getOwnerIdentities(item).some(id => wanted.has(id.toLowerCase()))
}

export function getOwnerFromProperties(item: ResourceItem): string {
  const p = item.properties
  if (!p) return '—'
  const candidates = [
    p['owner'],
    p['createdBy'],
    p['lastModifiedBy'],
    p['author'],
    p['createdByUser'],
    p['modifiedBy'],
    p['modifiedByUser'],
    p['publishedBy'],
    p['ownerEmail'],
    p['ownerDisplayName'],
    p['ownerObjectId'],
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c
    if (c && typeof c === 'object') {
      const obj = c as Record<string, unknown>
      if (obj['displayName']) return obj['displayName'] as string
      if (obj['email']) return obj['email'] as string
      if (obj['userPrincipalName']) return obj['userPrincipalName'] as string
      // Fall back to the object ID so it can be resolved via Graph
      if (typeof obj['id'] === 'string' && obj['id']) return obj['id'] as string
      if (typeof obj['objectId'] === 'string' && obj['objectId']) return obj['objectId'] as string
    }
  }
  return '—'
}
