import type { ResourceItem } from '../types'
import { getResourceCategory } from '../types'
import { isGuid, isSystemGuid } from './format'

// ─── Small primitive pickers ─────────────────────────────────────────────────

export function pickString(obj: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

export function pickDate(obj: Record<string, unknown> | undefined, keys: string[]): Date | undefined {
  const s = pickString(obj, keys)
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}

// ─── Resource-level metadata ─────────────────────────────────────────────────

export function getDescription(r: ResourceItem): string | undefined {
  return pickString(r.properties, [
    'description', 'Description', 'displayDescription', 'longDescription', 'summary',
  ])
}

export function getResourceGuid(r: ResourceItem): string | undefined {
  // Many resources have a clean GUID in `name`; otherwise try the last id segment.
  if (isGuid(r.name)) return r.name
  const tail = r.id.split('/').pop()
  if (tail && isGuid(tail)) return tail
  return r.name
}

export function getResourceUrl(r: ResourceItem): string | undefined {
  return pickString(r.properties, [
    'appOpenUri', 'appPlayUri', 'launchUri', 'webPlayerUrl',
    'makerPortalUrl', 'studioUrl', 'designerUrl', 'editUrl',
    'flowSuspensionUri', 'webUrl', 'url',
  ])
}

// Entra (AAD) object ID assigned to a Copilot Studio agent. Tries several
// plausible property names since the inventory shape isn't fully documented.
export function getAgentId(r: ResourceItem): string | undefined {
  if (getResourceCategory(r.type) !== 'agents') return undefined
  return pickString(r.properties, [
    'entraAgentId', 'EntraAgentId',
    'aadAgentId', 'AADAgentId',
    'agentId', 'AgentId',
    'aadObjectId', 'AADObjectId',
    'entraObjectId',
    'objectId',
    'botId', 'BotId',
  ])
}

// AI model assigned to a Copilot Studio agent (e.g. "Claude Sonnet 4.6", "GPT-4o").
export function getAgentModel(r: ResourceItem): string | undefined {
  if (getResourceCategory(r.type) !== 'agents') return undefined
  return pickString(r.properties, [
    'model', 'Model',
    'aiModel', 'AIModel', 'aiModelName',
    'generativeAIModel', 'generativeAiModel',
    'modelName', 'ModelName',
    'llm', 'LLM',
  ])
}

// Inventory `type`/`kind` mapped to the "Made in" product label shown in the
// header. We mirror the labels used by the Power Platform admin portal.
export function getMadeInProduct(r: ResourceItem): { label: string; productKey: 'apps' | 'flows' | 'agents' | 'other' } {
  const t = r.type.toLowerCase()
  const k = (r.kind ?? '').toLowerCase()
  const cat = getResourceCategory(r.type)

  if (cat === 'apps') {
    if (t.includes('codeapp')) return { label: 'Power Apps (Code App)', productKey: 'apps' }
    if (t.includes('modeldriven') || k.includes('modeldriven')) return { label: 'Power Apps (Model Driven)', productKey: 'apps' }
    if (t.includes('canvas') || k.includes('canvas')) return { label: 'Power Apps (Canvas)', productKey: 'apps' }
    return { label: 'Power Apps', productKey: 'apps' }
  }
  if (cat === 'flows') {
    if (t.includes('logic')) return { label: 'Logic Apps', productKey: 'flows' }
    if (t.includes('agentflow')) return { label: 'Power Automate (Agent Flow)', productKey: 'flows' }
    return { label: 'Power Automate', productKey: 'flows' }
  }
  if (cat === 'agents') {
    // Copilot Studio variants — match the label PPAC uses for full vs. lite agents.
    const variant = pickString(r.properties, ['runtimeType', 'agentType', 'variant', 'sku'])
    if (variant) return { label: `Copilot Studio ${variant}`, productKey: 'agents' }
    return { label: 'Copilot Studio', productKey: 'agents' }
  }
  return { label: r.type, productKey: 'other' }
}

export function getItemTypeLabel(r: ResourceItem): string {
  const cat = getResourceCategory(r.type)
  if (cat === 'apps') return 'App'
  if (cat === 'flows') return 'Flow'
  if (cat === 'agents') return 'Agent'
  return r.type
}

export function getStatus(r: ResourceItem): string | undefined {
  const p = r.properties
  if (!p) return undefined
  // Common shapes across products
  const direct = pickString(p, ['state', 'status', 'lifecycleState', 'appType', 'publishingState', 'provisioningState'])
  if (direct) return direct
  // Object-shaped state (Logic Apps / flows)
  const stateObj = p['state']
  if (stateObj && typeof stateObj === 'object') {
    const v = (stateObj as Record<string, unknown>)['value']
    if (typeof v === 'string') return v
  }
  return undefined
}

export function getPublishedChannels(r: ResourceItem): string[] {
  const p = r.properties
  if (!p) return []
  const sources: unknown[] = [
    p['publishedChannels'], p['channels'], p['enabledChannels'],
  ]
  const result = new Set<string>()
  for (const raw of sources) {
    if (!raw) continue
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' && item.trim()) result.add(item.trim())
        else if (item && typeof item === 'object') {
          const name = pickString(item as Record<string, unknown>, ['displayName', 'name', 'channelName', 'id', 'type'])
          if (name) result.add(name)
        }
      }
    }
  }
  return [...result]
}

// ─── People / activity ───────────────────────────────────────────────────────

export interface PersonRef {
  id?: string
  displayName?: string
  email?: string
  userPrincipalName?: string
}

function asPersonRef(value: unknown): PersonRef | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    if (isGuid(value)) return { id: value }
    return { displayName: value }
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const id = pickString(obj, ['id', 'objectId', 'userId', 'aadObjectId'])
    const displayName = pickString(obj, ['displayName', 'name', 'fullName'])
    const email = pickString(obj, ['email', 'emailAddress'])
    const userPrincipalName = pickString(obj, ['userPrincipalName', 'upn'])
    if (id || displayName || email || userPrincipalName) {
      return { id, displayName, email, userPrincipalName }
    }
  }
  return undefined
}

export function getCreatedBy(r: ResourceItem): PersonRef | undefined {
  const p = r.properties
  if (!p) return undefined
  return asPersonRef(p['createdBy'] ?? p['createdByUser'] ?? p['creator'] ?? p['author'])
}

export function getModifiedBy(r: ResourceItem): PersonRef | undefined {
  const p = r.properties
  if (!p) return undefined
  return asPersonRef(p['lastModifiedBy'] ?? p['lastModifiedByUser'] ?? p['modifiedBy'] ?? p['modifiedByUser'] ?? p['updatedBy'])
}

export function getPublishedBy(r: ResourceItem): PersonRef | undefined {
  const p = r.properties
  if (!p) return undefined
  return asPersonRef(p['lastPublishedBy'] ?? p['publishedBy'])
}

export function getCreatedDate(r: ResourceItem): Date | undefined {
  return pickDate(r.properties, ['createdTime', 'createdOn', 'createdAt', 'createdDateTime'])
}

export function getModifiedDate(r: ResourceItem): Date | undefined {
  return pickDate(r.properties, ['lastModifiedTime', 'modifiedOn', 'lastModifiedDateTime', 'modifiedTime', 'updatedTime'])
}

export function getPublishedDate(r: ResourceItem): Date | undefined {
  return pickDate(r.properties, ['lastPublishedTime', 'publishedTime', 'lastPublishDateTime'])
}

// Owner as a person reference (preferred) — falls back to the legacy string form.
export function getOwnerPerson(r: ResourceItem): PersonRef | undefined {
  const p = r.properties
  if (!p) return undefined
  const candidates = [
    p['owner'], p['ownerUser'],
    p['createdBy'], p['createdByUser'],
  ]
  for (const c of candidates) {
    const person = asPersonRef(c)
    if (person && (person.displayName || person.id)) return person
  }
  // Last resort: build a stub from the email / ownerEmail / ownerObjectId fields
  const email = pickString(p, ['ownerEmail'])
  const id = pickString(p, ['ownerObjectId', 'ownerId'])
  const displayName = pickString(p, ['ownerDisplayName'])
  if (email || id || displayName) return { id, email, displayName }
  return undefined
}

// ─── Environment group ───────────────────────────────────────────────────────

export function getEnvironmentGroupId(r: ResourceItem): string | undefined {
  return pickString(r.properties, ['environmentGroupId', 'environmentGroup', 'parentEnvironmentGroupId'])
}

export function getEnvironmentGroupName(r: ResourceItem): string | undefined {
  return pickString(r.properties, ['environmentGroupName', 'environmentGroupDisplayName'])
}

// ─── Simple connector list (apps/flows: just "which connectors", no actions) ─

// Reads inventory shapes like:
//   "connectors": [{ "connectorId": "shared_sharepointonline" }]
// or arrays of strings. Returns a deduped list of connector ids.
export function getConnectors(r: ResourceItem): string[] {
  const p = r.properties
  if (!p) return []
  const seen = new Set<string>()
  const out: string[] = []
  const push = (id: string | undefined) => {
    if (!id) return
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
  }
  const sources: unknown[] = [
    p['connectors'],
    p['connectorReferences'],
    p['usedConnectors'],
    p['Power platform connectors'],
    p['powerPlatformConnectors'],
    p['power platform connectors'],
    p['PowerPlatformConnectors'],
  ]
  for (const raw of sources) {
    if (!raw) continue
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string') push(item)
        else if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          push(pickString(o, ['connectorId', 'apiId', 'connectionId', 'id', 'api']))
        }
      }
    }
  }
  // Fall back to scanning connection references too — same data, different shape.
  if (out.length === 0) {
    for (const action of getConnectorActions(r)) push(action.connectorId)
  }
  return out
}

// ─── Connector actions ───────────────────────────────────────────────────────

export interface ConnectorAction {
  connectorId: string
  actionName?: string
  // Used for de-dup
  key: string
}

// Walks an object recursively to find any `apiId` / `connectorId` references
// along with the action key they sit next to. This is the broadest extractor
// we have — it tolerates both canvas-app connectionReferences and flow
// `definition.actions` shapes.
export function getConnectorActions(r: ResourceItem): ConnectorAction[] {
  const p = r.properties
  if (!p) return []
  const found: ConnectorAction[] = []
  const seen = new Set<string>()
  const push = (connectorId: string | undefined, actionName?: string) => {
    if (!connectorId) return
    const key = `${connectorId}::${actionName ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    found.push({ connectorId, actionName, key })
  }

  // Canvas-app style: connectionReferences keyed by ref name, value has `api`, `id` etc.
  const cRefs = p['connectionReferences']
  if (cRefs && typeof cRefs === 'object' && !Array.isArray(cRefs)) {
    for (const [refName, v] of Object.entries(cRefs as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>
        push(pickString(o, ['apiId', 'connectorId', 'api', 'id']), pickString(o, ['operationId']) ?? refName)
      } else if (typeof v === 'string') {
        push(v, refName)
      }
    }
  }
  if (Array.isArray(cRefs)) {
    for (const item of cRefs) {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        push(pickString(o, ['apiId', 'connectorId', 'api', 'id']), pickString(o, ['operationId', 'displayName']))
      } else if (typeof item === 'string') {
        push(item)
      }
    }
  }

  // Flow definition: properties.definition.connectionReferences + actions
  const defn = p['definition']
  if (defn && typeof defn === 'object') {
    const def = defn as Record<string, unknown>
    const flowRefs = def['connectionReferences']
    if (flowRefs && typeof flowRefs === 'object' && !Array.isArray(flowRefs)) {
      for (const [refName, v] of Object.entries(flowRefs as Record<string, unknown>)) {
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>
          push(pickString(o, ['apiId', 'connectorId', 'api', 'id']), refName)
        }
      }
    }
    const actions = def['actions']
    if (actions && typeof actions === 'object') {
      for (const [actionName, v] of Object.entries(actions as Record<string, unknown>)) {
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>
          const inputs = o['inputs']
          if (inputs && typeof inputs === 'object') {
            const host = (inputs as Record<string, unknown>)['host']
            if (host && typeof host === 'object') {
              const h = host as Record<string, unknown>
              const apiId = pickString(h, ['apiId', 'connectionName'])
              const operationId = pickString(h, ['operationId'])
              push(apiId, operationId ?? actionName)
            }
          }
        }
      }
    }
  }

  // Generic "connectorActions" / "actions" shapes used by agents.
  for (const k of ['connectorActions', 'actions', 'plugins', 'toolActions']) {
    const raw = p[k]
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string') push(item)
        else if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          push(pickString(o, ['connectorId', 'apiId', 'api', 'id']), pickString(o, ['actionName', 'operationId', 'displayName', 'name']))
        }
      }
    }
  }

  return found
}

// ─── Sharing ─────────────────────────────────────────────────────────────────

export interface SharePrincipal {
  principal: PersonRef & { type?: string }
  role: string
}

export function getSharing(r: ResourceItem): SharePrincipal[] {
  const p = r.properties
  if (!p) return []
  const sources: unknown[] = [
    p['permissions'], p['sharedWith'], p['roleAssignments'],
    p['userPermissions'], p['groupPermissions'], p['accessControl'],
  ]
  const out: SharePrincipal[] = []
  for (const raw of sources) {
    if (!Array.isArray(raw)) continue
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const principalRaw = o['principal'] ?? o['identity'] ?? o
      const personRef = asPersonRef(principalRaw)
      if (!personRef) continue
      const principalType = pickString(
        (principalRaw && typeof principalRaw === 'object' ? principalRaw as Record<string, unknown> : {}),
        ['type', 'principalType', 'kind'],
      )
      const role = pickString(o, ['role', 'roleName', 'permission', 'accessLevel', 'permissionType']) ?? 'Member'
      if (personRef.id && isSystemGuid(personRef.id)) continue
      out.push({ principal: { ...personRef, type: principalType }, role })
    }
  }
  return out
}

// ─── Sharing counts (editors / viewers) ──────────────────────────────────────

export interface SharingCounts {
  userCount?: number
  groupCount?: number
  entireTenant?: boolean
}

export interface ResourceSharingCounts {
  editors?: SharingCounts
  viewers?: SharingCounts
}

function readSharingCount(value: unknown): SharingCounts | undefined {
  if (!value || typeof value !== 'object') return undefined
  const o = value as Record<string, unknown>
  const userCount = typeof o['userCount'] === 'number' ? o['userCount'] : undefined
  const groupCount = typeof o['groupCount'] === 'number' ? o['groupCount'] : undefined
  const entireTenant = typeof o['entireTenant'] === 'boolean' ? o['entireTenant'] : undefined
  if (userCount === undefined && groupCount === undefined && entireTenant === undefined) return undefined
  return { userCount, groupCount, entireTenant }
}

// Reads "sharedWithEditors" / "Shared with editors" (and the viewers variants)
// from any object — both the resource root and individual tool entries use
// the same shape.
export function readSharingCounts(obj: Record<string, unknown> | undefined): ResourceSharingCounts {
  if (!obj) return {}
  const editorsRaw =
    obj['sharedWithEditors'] ??
    obj['Shared with editors'] ??
    obj['shared with editors'] ??
    obj['SharedWithEditors']
  const viewersRaw =
    obj['sharedWithViewers'] ??
    obj['Shared with viewers'] ??
    obj['shared with viewers'] ??
    obj['SharedWithViewers']
  return {
    editors: readSharingCount(editorsRaw),
    viewers: readSharingCount(viewersRaw),
  }
}

export function getResourceSharingCounts(r: ResourceItem): ResourceSharingCounts {
  return readSharingCounts(r.properties)
}

export function hasAnySharingCount(counts: SharingCounts | undefined): boolean {
  if (!counts) return false
  return (counts.userCount ?? 0) > 0 || (counts.groupCount ?? 0) > 0 || counts.entireTenant === true
}

// ─── Agent-specific extractors ───────────────────────────────────────────────

export interface NamedItem {
  key: string
  name: string
  description?: string
  detail?: string
  connectorId?: string
  sharing?: ResourceSharingCounts
  // Optional fields populated by the "Power platform connectors" shape.
  operationId?: string
  isEnabled?: boolean
  connectionProvider?: string
  whenCanBeUsed?: string
  createdBy?: PersonRef
  usedAs?: string
  requiresEndUserConsent?: boolean
}

// ─── "Power platform connectors" parser (canonical agent connector shape) ────

// Sample shape:
//   "Power platform connectors": [{
//     "connectorId": "shared_sharepointonline",
//     "operations": [{ "operationId": "CreateAttachment", "usedAs": "Tool",
//                      "whenCanBeUsed": "Anytime", "isEnabled": true, ... }]
//   }]
function readPowerPlatformConnectors(p: Record<string, unknown> | undefined): Array<{ connectorId: string; operations: Record<string, unknown>[]; raw: Record<string, unknown> }> {
  if (!p) return []
  const raw =
    p['Power platform connectors'] ??
    p['powerPlatformConnectors'] ??
    p['power platform connectors'] ??
    p['PowerPlatformConnectors']
  if (!Array.isArray(raw)) return []
  const out: Array<{ connectorId: string; operations: Record<string, unknown>[]; raw: Record<string, unknown> }> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const connectorId = pickString(o, ['connectorId', 'apiId', 'connector', 'id'])
    if (!connectorId) continue
    const operations = Array.isArray(o['operations'])
      ? (o['operations'] as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      : []
    out.push({ connectorId, operations, raw: o })
  }
  return out
}

function operationsByUsedAs(
  ppcs: ReturnType<typeof readPowerPlatformConnectors>,
  usedAs: string,
): NamedItem[] {
  const target = usedAs.toLowerCase()
  const out: NamedItem[] = []
  for (const conn of ppcs) {
    const connectorInfo = conn.connectorId
    for (const op of conn.operations) {
      const opUsedAs = pickString(op, ['usedAs'])
      if (!opUsedAs || opUsedAs.toLowerCase() !== target) continue
      const operationId = pickString(op, ['operationId', 'operationName', 'name'])
      const createdByRaw = op['createdBy']
      const createdBy: PersonRef | undefined = createdByRaw
        ? (typeof createdByRaw === 'string' && isGuid(createdByRaw)
            ? { id: createdByRaw }
            : (typeof createdByRaw === 'object'
                ? (() => {
                    const x = createdByRaw as Record<string, unknown>
                    return {
                      id: pickString(x, ['id', 'objectId', 'userId']),
                      displayName: pickString(x, ['displayName', 'name']),
                      email: pickString(x, ['email']),
                      userPrincipalName: pickString(x, ['userPrincipalName', 'upn']),
                    }
                  })()
                : undefined))
        : undefined
      out.push({
        key: `${connectorInfo}-${operationId ?? out.length}`,
        name: '',  // resolved at render time from connectorId
        connectorId: connectorInfo,
        operationId,
        isEnabled: typeof op['isEnabled'] === 'boolean' ? op['isEnabled'] as boolean : undefined,
        connectionProvider: pickString(op, ['connectionProvider']),
        whenCanBeUsed: pickString(op, ['whenCanBeUsed']),
        createdBy,
        usedAs: opUsedAs,
        requiresEndUserConsent: typeof op['requiresEndUserConsent'] === 'boolean' ? op['requiresEndUserConsent'] as boolean : undefined,
        sharing: (() => {
          const s = readSharingCounts(op)
          return s.editors || s.viewers ? s : undefined
        })(),
      })
    }
  }
  return out
}

function collectNamedItems(p: Record<string, unknown> | undefined, keys: string[]): NamedItem[] {
  if (!p) return []
  const out: NamedItem[] = []
  const seen = new Set<string>()
  const push = (item: NamedItem) => {
    if (seen.has(item.key)) return
    seen.add(item.key)
    out.push(item)
  }
  const fromObject = (o: Record<string, unknown>, fallbackName?: string): NamedItem | undefined => {
    const name = pickString(o, ['displayName', 'name', 'title', 'label']) ?? fallbackName
    if (!name) return undefined
    const sharing = readSharingCounts(o)
    const hasSharing = sharing.editors || sharing.viewers
    return {
      key: pickString(o, ['id', 'key']) ?? name,
      name,
      description: pickString(o, ['description', 'summary']),
      detail: pickString(o, ['type', 'kind', 'source', 'url']),
      connectorId: pickString(o, ['connectorId', 'apiId', 'connectionId', 'connector']),
      sharing: hasSharing ? sharing : undefined,
    }
  }
  for (const k of keys) {
    const raw = p[k]
    if (!raw) continue
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string') push({ key: item, name: item })
        else if (item && typeof item === 'object') {
          const named = fromObject(item as Record<string, unknown>)
          if (named) push(named)
        }
      }
    } else if (typeof raw === 'object') {
      for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v && typeof v === 'object') {
          const named = fromObject(v as Record<string, unknown>, name)
          if (named) push(named)
        } else push({ key: name, name })
      }
    }
  }
  return out
}

export function getAgentKnowledge(r: ResourceItem): NamedItem[] {
  // Prefer typed knowledge sources; also include any PPC operation tagged usedAs="Knowledge".
  const direct = collectNamedItems(r.properties, ['knowledgeSources', 'knowledge', 'knowledgeBases', 'dataSources'])
  const ppc = operationsByUsedAs(readPowerPlatformConnectors(r.properties), 'Knowledge')
  return [...direct, ...ppc]
}

export function getAgentTools(r: ResourceItem): NamedItem[] {
  const direct = collectNamedItems(r.properties, ['tools', 'capabilities', 'plugins', 'skills'])
  const ppc = operationsByUsedAs(readPowerPlatformConnectors(r.properties), 'Tool')
  return [...direct, ...ppc]
}

export function getAgentConnectedAgents(r: ResourceItem): NamedItem[] {
  return collectNamedItems(r.properties, ['connectedAgents', 'referencedAgents', 'subAgents', 'agents'])
}

export function getAgentTopics(r: ResourceItem): NamedItem[] {
  return collectNamedItems(r.properties, ['topics', 'dialogs', 'intents'])
}

export function getAgentFlows(r: ResourceItem): NamedItem[] {
  return collectNamedItems(r.properties, ['flows', 'containedFlows', 'workflowReferences', 'powerAutomateFlows'])
}

export function getAgentChannels(r: ResourceItem): NamedItem[] {
  const list = collectNamedItems(r.properties, ['channels', 'publishedChannels', 'enabledChannels', 'deployedChannels'])
  return list
}

// ─── "Other" properties: keys we want to surface but don't fit a card ────────

// Property keys that we've already rendered explicitly via the structured
// Overview/Configuration cards. These are excluded from the "Other details"
// fallback so we don't double-render them.
export const HANDLED_PROPERTY_KEYS = new Set<string>([
  'displayName', 'DisplayName', 'displayname', 'friendlyName', 'title', 'Name',
  'description', 'Description', 'displayDescription', 'longDescription', 'summary',
  'owner', 'ownerUser', 'createdBy', 'createdByUser', 'creator', 'author',
  'lastModifiedBy', 'lastModifiedByUser', 'modifiedBy', 'modifiedByUser', 'updatedBy',
  'lastPublishedBy', 'publishedBy',
  'createdTime', 'createdOn', 'createdAt', 'createdDateTime',
  'lastModifiedTime', 'modifiedOn', 'lastModifiedDateTime', 'modifiedTime', 'updatedTime',
  'lastPublishedTime', 'publishedTime', 'lastPublishDateTime',
  'state', 'status', 'lifecycleState', 'appType', 'publishingState', 'provisioningState',
  'publishedChannels', 'channels', 'enabledChannels',
  'environmentGroupId', 'environmentGroup', 'parentEnvironmentGroupId',
  'environmentGroupName', 'environmentGroupDisplayName',
  'environmentDisplayName', 'environmentName',
  'connectionReferences', 'connectionReferenceLogicalNames', 'definition',
  'connectors', 'usedConnectors',
  'Power platform connectors', 'powerPlatformConnectors', 'power platform connectors', 'PowerPlatformConnectors',
  'permissions', 'sharedWith', 'roleAssignments', 'userPermissions', 'groupPermissions',
  'knowledgeSources', 'knowledge', 'knowledgeBases', 'dataSources',
  'tools', 'capabilities', 'plugins', 'skills', 'connectorActions', 'actions', 'toolActions',
  'connectedAgents', 'referencedAgents', 'subAgents', 'agents',
  'topics', 'dialogs', 'intents',
  'flows', 'containedFlows', 'workflowReferences', 'powerAutomateFlows',
  'appOpenUri', 'appPlayUri', 'launchUri', 'webPlayerUrl',
  'makerPortalUrl', 'studioUrl', 'designerUrl', 'editUrl', 'webUrl', 'url',
  'ownerEmail', 'ownerObjectId', 'ownerId', 'ownerDisplayName',
  'runtimeType', 'agentType', 'variant',
  'sharedWithEditors', 'Shared with editors', 'shared with editors', 'SharedWithEditors',
  'sharedWithViewers', 'Shared with viewers', 'shared with viewers', 'SharedWithViewers',
  'entraAgentId', 'EntraAgentId', 'aadAgentId', 'AADAgentId',
  'agentId', 'AgentId', 'aadObjectId', 'AADObjectId',
  'entraObjectId', 'objectId', 'botId', 'BotId',
  'model', 'Model', 'aiModel', 'AIModel', 'aiModelName',
  'generativeAIModel', 'generativeAiModel',
  'modelName', 'ModelName', 'llm', 'LLM',
])
