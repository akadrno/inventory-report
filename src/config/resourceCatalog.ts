export const INVENTORY_RESOURCE_TYPES = {
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

export const KNOWN_INVENTORY_RESOURCE_TYPES = [
  ...INVENTORY_RESOURCE_TYPES.apps,
  ...INVENTORY_RESOURCE_TYPES.flows,
  ...INVENTORY_RESOURCE_TYPES.agents,
]

export const KNOWN_INVENTORY_RESOURCE_TYPE_SET: ReadonlySet<string> = new Set(KNOWN_INVENTORY_RESOURCE_TYPES)

// Only warn on namespaces that look relevant to app/flow/agent inventory.
export const INVENTORY_NAMESPACE_PREFIXES = [
  'microsoft.powerapps/',
  'microsoft.powerautomate/',
  'microsoft.copilotstudio/',
  'microsoft.powerva/',
  'microsoft.powervirtualagents/',
  'microsoft.flow/',
  'microsoft.logic/',
] as const

export const INVENTORY_QUERY_MATCH_VALUES = INVENTORY_NAMESPACE_PREFIXES.map(prefix => `'${prefix}'`)

export function isInventoryNamespace(type: string): boolean {
  const lower = type.toLowerCase()
  return INVENTORY_NAMESPACE_PREFIXES.some(prefix => lower.startsWith(prefix))
}

export function isKnownInventoryResourceType(type: string): boolean {
  return KNOWN_INVENTORY_RESOURCE_TYPE_SET.has(type.toLowerCase())
}
