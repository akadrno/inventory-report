import { useMemo, useState } from 'react'
import {
  makeStyles, tokens,
  OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody,
  TabList, Tab, type SelectTabData, type SelectTabEvent,
  Button, Text, Badge, Caption1, Body1Strong, Avatar, Switch, Input, Link,
  Menu, MenuTrigger, MenuPopover, MenuList, MenuItem,
} from '@fluentui/react-components'
import {
  DismissRegular, CopyRegular, CheckmarkRegular, MoreHorizontalRegular,
  SearchRegular, PlugConnectedRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getDisplayName, getIsManagedEnvironment } from '../types'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { useGuidNames } from '../hooks/useGuidNames'
import {
  isGuid, isSystemGuid, formatLocalDateTime, humanizeKey,
  formatPropertyValueAsText, formatPrimitive,
} from '../utils/format'
import { buildEnvMap, resolveEnvironmentName } from '../utils/environment'
import { formatRegion } from '../utils/regions'
import { getConnectorInfo, findConnectorIdByDisplayName, normalizeConnectorId } from '../utils/connectors'
import { useConnectorMetadata, type ConnectorMetadata } from '../hooks/useConnectorMetadata'
import {
  getDescription, getResourceGuid, getResourceUrl, getMadeInProduct,
  getItemTypeLabel, getStatus, getPublishedChannels,
  getCreatedBy, getModifiedBy, getPublishedBy,
  getCreatedDate, getModifiedDate, getPublishedDate,
  getOwnerPerson, getAgentId, getAgentModel,
  getAgentOrchestration, getAgentAuthentication, getAgentCreatedIn, getAgentSchemaName,
  getIsQuarantined, getFlowWorkflowEntityId, getAppModuleId, getAppLogicalName,
  getEnvironmentGroupId, getEnvironmentGroupName,
  getConnectorsWithOperations, getFlowTrigger,
  getSharing, getResourceSharingCounts, hasAnySharingCount,
  getAgentKnowledge, getAgentTools, getAgentConnectedAgents,
  getAgentTopics, getAgentFlows, getAgentChannels,
  HANDLED_PROPERTY_KEYS,
  type PersonRef, type SharingCounts, type ResourceSharingCounts, type NamedItem,
  type ConnectorWithOperations,
} from '../utils/resourceMetadata'
import { getResourceCategory } from '../types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ResourceDetailPanelProps {
  resource: ResourceItem
  onClose: () => void
  allEnvironments?: ResourceItem[]
}

type PanelTab = 'overview' | 'configuration' | 'usage' | 'more'

// ─── Styles ───────────────────────────────────────────────────────────────────

const useClasses = makeStyles({
  drawer: {
    width: '880px',
    maxWidth: '95vw',
  },
  headerStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  headerActions: {
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  copyConfirm: {
    color: tokens.colorPaletteGreenForeground1,
    fontSize: tokens.fontSizeBase200,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    marginRight: '4px',
  },
  tabList: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: 0,
  },
  body: {
    paddingTop: tokens.spacingVerticalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalM,
    '@media (max-width: 720px)': { gridTemplateColumns: '1fr' },
  },
  card: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: '20px',
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: '4px',
  },
  rowGrid: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    rowGap: '10px',
    columnGap: '12px',
    alignItems: 'baseline',
  },
  rowLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  rowValue: {
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-word',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rowValueStack: {
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-word',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  rowValueMuted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100 },
  personCell: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  personName: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tagList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },

  activityRow: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    rowGap: '8px',
    columnGap: '12px',
    paddingTop: '12px',
    borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: tokens.colorNeutralStroke2,
    ':first-child': { paddingTop: 0, borderTop: 'none' },
  },

  // Configuration tab
  configLayout: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr',
    gap: '20px',
    '@media (max-width: 720px)': { gridTemplateColumns: '1fr' },
  },
  configNav: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    paddingRight: '8px',
    borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: tokens.colorNeutralStroke2,
    '@media (max-width: 720px)': { borderRight: 'none', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2, paddingRight: 0, paddingBottom: '8px', flexDirection: 'row', overflowX: 'auto' },
  },
  configNavItem: {
    border: 'none', background: 'transparent', textAlign: 'left',
    padding: '8px 12px', borderRadius: '4px',
    fontSize: tokens.fontSizeBase200, cursor: 'pointer',
    color: tokens.colorNeutralForeground2,
    borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: 'transparent',
    ':hover': { backgroundColor: tokens.colorNeutralBackground2 },
  },
  configNavItemActive: {
    border: 'none', background: 'transparent', textAlign: 'left',
    padding: '8px 12px', borderRadius: '4px',
    fontSize: tokens.fontSizeBase200, cursor: 'pointer',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  configContent: { minWidth: 0 },
  configHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '12px', gap: '12px',
  },

  // List rendering for connector actions / sharing / agent sub-sections
  itemList: { display: 'flex', flexDirection: 'column' },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) minmax(0, 1fr)',
    gap: '12px',
    alignItems: 'center',
    padding: '10px 4px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  itemRowDouble: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) 120px',
    gap: '12px',
    alignItems: 'center',
    padding: '10px 4px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  itemRowSimple: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 4px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  listHeader: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) minmax(0, 1fr)',
    gap: '12px',
    padding: '8px 4px',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke1,
  },
  connectorChip: {
    width: '28px', height: '28px',
    borderRadius: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff',
    fontSize: '12px', fontWeight: 700, lineHeight: 1,
    flexShrink: 0,
  },
  ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  // Empty / fallback
  empty: {
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: '24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '6px', color: tokens.colorNeutralForeground3, textAlign: 'center',
  },

  // Raw view
  rawBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase100,
    fontFamily: 'Consolas, monospace',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },

  // Other details (collapsible at bottom of overview)
  otherDetails: { marginTop: '8px' },
  otherSummary: {
    cursor: 'pointer',
    padding: '8px 0',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },

  // Usage tab
  banner: {
    backgroundColor: '#f3f9fd',
    border: '1px solid #cfe4fa',
    borderRadius: '4px',
    padding: '10px 14px',
    fontSize: '12px',
    color: '#003966',
    display: 'flex', alignItems: 'flex-start', gap: '8px',
  },

  // Status badge inline
  statusBadge: {
    display: 'inline-flex', alignItems: 'center',
  },
})

// ─── Small reusable cells ─────────────────────────────────────────────────────

function resolvePersonName(person: PersonRef | undefined, nameMap: Map<string, string>): string | undefined {
  if (!person) return undefined
  if (person.displayName) return person.displayName
  if (person.id && isGuid(person.id)) {
    if (isSystemGuid(person.id)) return 'System'
    const resolved = nameMap.get(person.id)
    if (resolved) return resolved
  }
  return person.email ?? person.userPrincipalName ?? undefined
}

function PersonCell({ person, nameMap }: { person?: PersonRef; nameMap: Map<string, string> }) {
  const classes = useClasses()
  const name = resolvePersonName(person, nameMap)
  if (!name) return null
  return (
    <span className={classes.personCell}>
      <Avatar name={name} size={20} color="colorful" />
      <span className={classes.personName} title={name}>{name}</span>
    </span>
  )
}

function formatSharingCount(c: SharingCounts | undefined): string {
  if (!hasAnySharingCount(c)) return 'Not shared'
  const parts: string[] = []
  if ((c!.userCount ?? 0) > 0) parts.push(`${c!.userCount} user${c!.userCount === 1 ? '' : 's'}`)
  if ((c!.groupCount ?? 0) > 0) parts.push(`${c!.groupCount} group${c!.groupCount === 1 ? '' : 's'}`)
  if (c!.entireTenant) parts.push('entire tenant')
  return parts.length ? parts.join(' · ') : 'Not shared'
}

function ConnectorChip({ connectorId }: { connectorId: string }) {
  const classes = useClasses()
  const info = getConnectorInfo(connectorId)
  return (
    <span
      className={classes.connectorChip}
      style={{ backgroundColor: info.color }}
      title={info.displayName}
      aria-label={info.displayName}
    >
      {info.letter}
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const classes = useClasses()
  return (
    <>
      <Text className={classes.rowLabel}>{label}</Text>
      <span className={classes.rowValue}>{children}</span>
    </>
  )
}

function EmptyState({ message }: { message: string }) {
  const classes = useClasses()
  return (
    <div className={classes.empty}>
      <Caption1>{message}</Caption1>
    </div>
  )
}

// One activity entry (Created / Last updated / Last published). Renders only
// the side(s) that have real data — no dash placeholders.
function ActivityEntry({
  byLabel, dateLabel, person, date, nameMap,
}: {
  byLabel: string
  dateLabel: string
  person?: PersonRef
  date?: Date
  nameMap: Map<string, string>
}) {
  const classes = useClasses()
  const personName = resolvePersonName(person, nameMap)
  if (!personName && !date) return null
  return (
    <div className={classes.activityRow}>
      {personName ? (
        <>
          <Text className={classes.rowLabel}>{byLabel}</Text>
          <span className={classes.rowValue}><PersonCell person={person} nameMap={nameMap} /></span>
        </>
      ) : <><span /><span /></>}
      {date ? (
        <>
          <Text className={classes.rowLabel}>{dateLabel}</Text>
          <span className={classes.rowValue}>{formatLocalDateTime(date.toISOString())}</span>
        </>
      ) : <><span /><span /></>}
    </div>
  )
}

// Inline summary line: "12 users · 3 groups · entire tenant" or "Not shared".
function SharingCountLine({ counts }: { counts?: SharingCounts }) {
  return <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>{formatSharingCount(counts)}</Caption1>
}

// ─── Collect every Entra GUID the panel needs to resolve in one batch ────────

function collectAllPersonGuids(resource: ResourceItem): string[] {
  const ids = new Set<string>()
  const add = (p?: PersonRef) => {
    if (p?.id && isGuid(p.id) && !isSystemGuid(p.id)) ids.add(p.id)
  }
  add(getOwnerPerson(resource))
  add(getCreatedBy(resource))
  add(getModifiedBy(resource))
  add(getPublishedBy(resource))
  for (const share of getSharing(resource)) add(share.principal)
  // Agent tools / knowledge entries carry per-operation createdBy GUIDs too.
  for (const t of getAgentTools(resource)) add(t.createdBy)
  for (const k of getAgentKnowledge(resource)) add(k.createdBy)
  return [...ids]
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function ProductIconFor({ productKey }: { productKey: 'apps' | 'flows' | 'agents' | 'other' }) {
  if (productKey === 'apps')   return <PowerAppsIcon fontSize={18} />
  if (productKey === 'flows')  return <PowerAutomateIcon fontSize={18} />
  if (productKey === 'agents') return <CopilotStudioIcon fontSize={18} />
  return null
}

interface OverviewProps {
  resource: ResourceItem
  allEnvironments?: ResourceItem[]
  nameMap: Map<string, string>
}

function OverviewTab({ resource, allEnvironments, nameMap }: OverviewProps) {
  const classes = useClasses()
  const envMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])

  const description = getDescription(resource)
  const owner = getOwnerPerson(resource)
  const made = getMadeInProduct(resource)
  const status = getStatus(resource)
  const channels = getPublishedChannels(resource)
  const resourceGuid = getResourceGuid(resource)
  const resourceUrl = getResourceUrl(resource)
  const agentId = getAgentId(resource)
  const agentModel = getAgentModel(resource)
  const agentOrchestration = getAgentOrchestration(resource)
  const agentAuthentication = getAgentAuthentication(resource)
  const agentCreatedIn = getAgentCreatedIn(resource)
  const agentSchemaName = getAgentSchemaName(resource)
  const isQuarantined = getIsQuarantined(resource)
  const flowWorkflowEntityId = getFlowWorkflowEntityId(resource)
  const flowTrigger = getFlowTrigger(resource)
  const appModuleId = getAppModuleId(resource)
  const appLogicalName = getAppLogicalName(resource)

  const envName = resolveEnvironmentName(resource, envMap)
  const region = formatRegion(resource.environmentRegion ?? resource.location)
  const managed = resource.isManagedEnvironment != null
    ? (resource.isManagedEnvironment ? 'Yes' : 'No')
    : undefined
  const envObj = allEnvironments?.find(e => e.id === resource.environmentId || e.name === resource.environmentId)
  const envGroupId = (envObj && getEnvironmentGroupId(envObj)) ?? getEnvironmentGroupId(resource)
  const envGroupName = (envObj && getEnvironmentGroupName(envObj)) ?? getEnvironmentGroupName(resource)

  const createdBy = getCreatedBy(resource)
  const createdOn = getCreatedDate(resource)
  const modifiedBy = getModifiedBy(resource)
  const modifiedOn = getModifiedDate(resource)
  const publishedBy = getPublishedBy(resource)
  const publishedOn = getPublishedDate(resource)

  return (
    <>
      <div className={classes.cardGrid}>
        {/* Resource card */}
        <div className={classes.card}>
          <Text className={classes.cardTitle}>Resource</Text>
          <div className={classes.rowGrid}>
            <Row label="Name">{getDisplayName(resource)}</Row>
            {description && <Row label="Description">{description}</Row>}
            <Row label="Owner"><PersonCell person={owner} nameMap={nameMap} /></Row>
            <Row label="Item type">{getItemTypeLabel(resource)}</Row>
            <Row label="Made in">
              <ProductIconFor productKey={made.productKey} />
              <span>{made.label}</span>
            </Row>
            {(status || isQuarantined) && (
              <Row label="Status">
                <span style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
                  {status && <Badge appearance="tint" color="informative" size="small">{status}</Badge>}
                  {isQuarantined && <Badge appearance="tint" color="danger" size="small">Quarantined</Badge>}
                </span>
              </Row>
            )}
            {channels.length > 0 && (
              <Row label="Published to">
                <span className={classes.tagList}>
                  {channels.map(c => (
                    <Badge key={c} appearance="tint" color="subtle" size="small">{c}</Badge>
                  ))}
                </span>
              </Row>
            )}
            {flowTrigger && (
              <Row label="Trigger">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {flowTrigger.trigger && (
                    <>
                      <ConnectorChip connectorId={flowTrigger.trigger} />
                      <span>{getConnectorInfo(flowTrigger.trigger).displayName}</span>
                    </>
                  )}
                  {flowTrigger.triggerOperation && (
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{flowTrigger.triggerOperation}</Caption1>
                  )}
                </span>
              </Row>
            )}
            {agentModel && <Row label="Model">{agentModel}</Row>}
            {agentOrchestration && <Row label="Orchestration">{agentOrchestration}</Row>}
            {agentAuthentication && <Row label="Authentication">{agentAuthentication}</Row>}
            {agentCreatedIn && <Row label="Created in">{agentCreatedIn}</Row>}
            {resourceGuid && <Row label="Resource GUID">{resourceGuid}</Row>}
            {agentId && <Row label="Agent ID">{agentId}</Row>}
            {agentSchemaName && <Row label="Schema name">{agentSchemaName}</Row>}
            {appModuleId && <Row label="App module ID">{appModuleId}</Row>}
            {appLogicalName && <Row label="Logical name">{appLogicalName}</Row>}
            {flowWorkflowEntityId && <Row label="Workflow entity ID">{flowWorkflowEntityId}</Row>}
            {resourceUrl && (
              <Row label="Resource URL">
                <Link href={resourceUrl} target="_blank" rel="noreferrer">{resourceUrl}</Link>
              </Row>
            )}
          </div>
        </div>

        {/* Environment card */}
        <div className={classes.card}>
          <Text className={classes.cardTitle}>Environment</Text>
          <div className={classes.rowGrid}>
            {envName && envName !== '—' && (
              <Row label="Environment">
                <Text style={{ color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold }}>{envName}</Text>
              </Row>
            )}
            {resource.environmentId && <Row label="Environment ID">{resource.environmentId.split('/').pop()}</Row>}
            {resource.environmentType && <Row label="Type">{resource.environmentType}</Row>}
            {region && <Row label="Region">{region}</Row>}
            {managed && <Row label="Managed">{managed}</Row>}
            {envObj && getIsManagedEnvironment(envObj) && !managed && <Row label="Managed">Yes</Row>}
            {envGroupName && <Row label="Environment group">{envGroupName}</Row>}
            {envGroupId && <Row label="Environment group ID">{envGroupId}</Row>}
          </div>
        </div>
      </div>

      {/* Activity — render only the entries we actually have data for */}
      {(createdBy || createdOn || modifiedBy || modifiedOn || publishedBy || publishedOn) && (
        <div className={classes.card}>
          <Text className={classes.cardTitle}>Activity</Text>
          <ActivityEntry
            byLabel="Created by"     dateLabel="Created on"
            person={createdBy}       date={createdOn}       nameMap={nameMap}
          />
          <ActivityEntry
            byLabel="Last updated by" dateLabel="Last update on"
            person={modifiedBy}      date={modifiedOn}      nameMap={nameMap}
          />
          <ActivityEntry
            byLabel="Last published by" dateLabel="Last published on"
            person={publishedBy}     date={publishedOn}     nameMap={nameMap}
          />
        </div>
      )}

      {/* Tags */}
      {resource.tags && Object.keys(resource.tags).length > 0 && (
        <div className={classes.card}>
          <Text className={classes.cardTitle}>Tags</Text>
          <span className={classes.tagList}>
            {Object.entries(resource.tags).map(([k, v]) => (
              <Badge key={k} appearance="tint" color="subtle" size="small">{k}: {v}</Badge>
            ))}
          </span>
        </div>
      )}
    </>
  )
}

// ─── More tab ─────────────────────────────────────────────────────────────────

function getOtherEntries(resource: ResourceItem): Array<[string, unknown]> {
  if (!resource.properties) return []
  return Object.entries(resource.properties)
    .filter(([k]) => !HANDLED_PROPERTY_KEYS.has(k))
    .sort(([a], [b]) => a.localeCompare(b))
}

function MoreTab({ resource, nameMap }: { resource: ResourceItem; nameMap: Map<string, string> }) {
  const classes = useClasses()
  const entries = useMemo(() => getOtherEntries(resource), [resource])

  if (entries.length === 0) {
    return <EmptyState message="No additional inventory fields beyond what's already shown on the other tabs." />
  }

  return (
    <div className={classes.card}>
      <Text className={classes.cardTitle}>Additional details</Text>
      <div className={classes.rowGrid}>
        {entries.map(([k, v]) => {
          const text = formatPropertyValueAsText(k, v, nameMap)
          if (!text) {
            const prim = formatPrimitive(v)
            if (prim === undefined) return null
            return (
              <Row key={k} label={humanizeKey(k)}>
                <span style={{ overflowWrap: 'anywhere' }}>{String(prim)}</span>
              </Row>
            )
          }
          if (text.includes('\n')) {
            return (
              <Row key={k} label={humanizeKey(k)}>
                <pre style={{ margin: 0, fontFamily: 'Consolas, monospace', fontSize: tokens.fontSizeBase100, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</pre>
              </Row>
            )
          }
          return <Row key={k} label={humanizeKey(k)}><span style={{ overflowWrap: 'anywhere' }}>{text}</span></Row>
        })}
      </div>
    </div>
  )
}

// ─── Configuration tab ────────────────────────────────────────────────────────

type ConfigSection =
  | 'connectors' | 'knowledge' | 'tools' | 'agents'
  | 'flows' | 'channels' | 'topics' | 'sharing'

function ConfigurationTab({ resource, nameMap }: { resource: ResourceItem; nameMap: Map<string, string> }) {
  const classes = useClasses()
  const category = getResourceCategory(resource.type)
  const isAgent = category === 'agents'

  // Extract everything once so we know which sections have data.
  const connectors = useMemo(() => isAgent ? [] : getConnectorsWithOperations(resource), [resource, isAgent])

  // Enrich apps/flows connectors with tier / publisher / display name from the
  // PowerApps catalog. Best-effort: disabled for agents or when there's nothing
  // to enrich, and failures fall back to the static connector lookup.
  const connectorMeta = useConnectorMetadata(
    !isAgent && connectors.length > 0 ? resource.environmentId : undefined,
  )
  const sharing = useMemo(() => getSharing(resource), [resource])
  const sharingCounts = useMemo(() => getResourceSharingCounts(resource), [resource])
  const knowledge = useMemo(() => isAgent ? getAgentKnowledge(resource)       : [], [resource, isAgent])
  const tools = useMemo(() => isAgent ? getAgentTools(resource)               : [], [resource, isAgent])
  const connectedAgents = useMemo(() => isAgent ? getAgentConnectedAgents(resource) : [], [resource, isAgent])
  const containedFlows = useMemo(() => isAgent ? getAgentFlows(resource)      : [], [resource, isAgent])
  const channels = useMemo(() => isAgent ? getAgentChannels(resource)         : [], [resource, isAgent])
  const topics = useMemo(() => isAgent ? getAgentTopics(resource)             : [], [resource, isAgent])

  // Apps/Flows get a simple "Connectors" entry; Agents get the per-feature sub-nav
  // (no "Connector actions" — connectors are surfaced via Tools and Knowledge instead).
  const sections: { key: ConfigSection; label: string; count: number }[] = []
  if (!isAgent) {
    sections.push({ key: 'connectors', label: 'Connectors', count: connectors.length })
  } else {
    sections.push(
      { key: 'knowledge', label: 'Knowledge', count: knowledge.length },
      { key: 'tools',     label: 'Tools',     count: tools.length },
      { key: 'agents',    label: 'Agents',    count: connectedAgents.length },
      { key: 'flows',     label: 'Flows',     count: containedFlows.length },
      { key: 'channels',  label: 'Channels',  count: channels.length },
      { key: 'topics',    label: 'Topics',    count: topics.length },
    )
  }
  sections.push({ key: 'sharing', label: 'Sharing', count: sharing.length })

  const [active, setActive] = useState<ConfigSection>(sections[0].key)
  const [search, setSearch] = useState('')

  return (
    <div className={classes.configLayout}>
      <nav className={classes.configNav}>
        {sections.map(s => (
          <button
            key={s.key}
            className={active === s.key ? classes.configNavItemActive : classes.configNavItem}
            onClick={() => { setActive(s.key); setSearch('') }}
          >
            {s.label}
            {s.count > 0 && <span style={{ marginLeft: 6, color: tokens.colorNeutralForeground3 }}>· {s.count}</span>}
          </button>
        ))}
      </nav>

      <div className={classes.configContent}>
        <div className={classes.configHeader}>
          <Text style={{ fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold }}>
            {sections.find(s => s.key === active)?.label}
          </Text>
          {(active === 'connectors' || active === 'sharing' || active === 'knowledge' || active === 'tools' || active === 'agents' || active === 'flows' || active === 'channels' || active === 'topics') && (
            <Input
              contentBefore={<SearchRegular />}
              placeholder="Search"
              value={search}
              onChange={(_, d) => setSearch(d.value)}
              size="small"
              style={{ width: '220px' }}
            />
          )}
        </div>

        {active === 'connectors' && (
          <ConnectorsSection connectors={connectors} search={search} meta={connectorMeta.data} />
        )}
        {active === 'knowledge'  && <NamedItemsSection items={knowledge}       search={search} empty="No knowledge sources reported by inventory." nameMap={nameMap} />}
        {active === 'tools'      && <NamedItemsSection items={tools}           search={search} empty="No tool / capability data in inventory." nameMap={nameMap} />}
        {active === 'agents'     && <NamedItemsSection items={connectedAgents} search={search} empty="This agent isn't reported as referencing other agents." nameMap={nameMap} />}
        {active === 'flows'      && <NamedItemsSection items={containedFlows}  search={search} empty="No flows referenced by this agent in inventory." nameMap={nameMap} />}
        {active === 'channels'   && <NamedItemsSection items={channels}        search={search} empty="No channel data in inventory for this agent." nameMap={nameMap} />}
        {active === 'topics'     && <NamedItemsSection items={topics}          search={search} empty="No topic data in inventory." nameMap={nameMap} />}
        {active === 'sharing'    && <SharingSection items={sharing} counts={sharingCounts} search={search} nameMap={nameMap} />}
      </div>
    </div>
  )
}

function ConnectorsSection({ connectors, search, meta }: {
  connectors: ConnectorWithOperations[]
  search: string
  meta?: Record<string, ConnectorMetadata>
}) {
  const classes = useClasses()

  // Resolve the enriched view for one connector: prefer the live catalog's
  // display name/tier/publisher, falling back to the static lookup.
  const enrich = (connectorId: string) => {
    const info = getConnectorInfo(connectorId)
    const m = meta?.[normalizeConnectorId(connectorId)]
    return {
      displayName: m?.displayName || info.displayName,
      tier: m?.tier,
      publisher: m?.publisher,
      isCustom: m?.isCustom,
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return connectors
    return connectors.filter(c => {
      const e = enrich(c.connectorId)
      return e.displayName.toLowerCase().includes(q)
        || c.connectorId.toLowerCase().includes(q)
        || (e.publisher ?? '').toLowerCase().includes(q)
        || c.operations.some(op => op.toLowerCase().includes(q))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors, search, meta])

  const counts = useMemo(() => {
    let premium = 0, custom = 0
    for (const c of connectors) {
      const m = meta?.[normalizeConnectorId(c.connectorId)]
      if (m?.tier?.toLowerCase() === 'premium') premium++
      if (m?.isCustom) custom++
    }
    return { premium, custom }
  }, [connectors, meta])

  if (connectors.length === 0) {
    return <EmptyState message="No connectors reported in inventory for this resource." />
  }

  return (
    <div className={classes.itemList}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', padding: '4px 0 8px' }}>
        <Badge appearance="tint" color="informative" size="small">{connectors.length} connector{connectors.length === 1 ? '' : 's'}</Badge>
        {counts.premium > 0 && <Badge appearance="tint" color="brand" size="small">{counts.premium} premium</Badge>}
        {counts.custom > 0 && <Badge appearance="tint" color="warning" size="small">{counts.custom} custom</Badge>}
        {!meta && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Tier &amp; publisher unavailable</Caption1>}
      </div>
      {filtered.map(c => {
        const e = enrich(c.connectorId)
        return (
          <div key={c.connectorId} className={classes.itemRowSimple} style={{ alignItems: 'flex-start' }}>
            <ConnectorChip connectorId={c.connectorId} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Body1Strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.displayName}>
                  {e.displayName}
                </Body1Strong>
                {e.tier && (
                  <Badge appearance={e.tier.toLowerCase() === 'premium' ? 'filled' : 'tint'} color={e.tier.toLowerCase() === 'premium' ? 'brand' : 'subtle'} size="small">
                    {e.tier}
                  </Badge>
                )}
                {e.isCustom && <Badge appearance="outline" color="warning" size="small">Custom</Badge>}
              </div>
              {e.publisher && (
                <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>by {e.publisher}</Caption1>
              )}
              {c.operations.length > 0 ? (
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {c.operations.map(op => (
                    <Badge key={op} appearance="outline" color="subtle" size="small">{op}</Badge>
                  ))}
                </div>
              ) : (
                <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                  No actions reported — used as a data source
                </Caption1>
              )}
            </div>
            {c.operations.length > 0 && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}>
                {c.operations.length} action{c.operations.length === 1 ? '' : 's'}
              </Caption1>
            )}
          </div>
        )
      })}
    </div>
  )
}

function NamedItemsSection({ items, search, empty, nameMap }: {
  items: NamedItem[]
  search: string
  empty: string
  nameMap: Map<string, string>
}) {
  const classes = useClasses()
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(it => {
      if (!q) return true
      const connectorId = it.connectorId ?? findConnectorIdByDisplayName(it.name)
      const displayName = connectorId ? getConnectorInfo(connectorId).displayName : it.name
      return displayName.toLowerCase().includes(q)
        || (it.operationId ?? '').toLowerCase().includes(q)
        || (it.description ?? '').toLowerCase().includes(q)
    })
  }, [items, search])

  if (items.length === 0) return <EmptyState message={empty} />
  return (
    <div className={classes.itemList}>
      {filtered.map(item => {
        const connectorId = item.connectorId ?? findConnectorIdByDisplayName(item.name)
        const displayName = connectorId
          ? getConnectorInfo(connectorId).displayName
          : (item.name || item.operationId || 'Item')
        const hasSharing = item.sharing?.editors || item.sharing?.viewers
        const createdByName = resolvePersonName(item.createdBy, nameMap)

        // Build the metadata strip beneath the title. Each chip is a small
        // labeled value, only rendered when it has data.
        const metaChips: Array<{ label: string; value: React.ReactNode }> = []
        if (item.isEnabled !== undefined) {
          metaChips.push({ label: 'Status', value: item.isEnabled ? 'Enabled' : 'Disabled' })
        }
        if (item.whenCanBeUsed) metaChips.push({ label: 'When', value: item.whenCanBeUsed })
        if (item.connectionProvider) metaChips.push({ label: 'Connection', value: item.connectionProvider })
        if (item.requiresEndUserConsent !== undefined) {
          metaChips.push({ label: 'End-user consent', value: item.requiresEndUserConsent ? 'Required' : 'Not required' })
        }
        if (createdByName) metaChips.push({ label: 'Created by', value: createdByName })

        return (
          <div key={item.key} className={classes.itemRowSimple} style={{ alignItems: 'flex-start' }}>
            {connectorId && <ConnectorChip connectorId={connectorId} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <Body1Strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</Body1Strong>
              {(item.operationId || item.description) && (
                <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                  {item.operationId ?? item.description}
                </Caption1>
              )}
              {metaChips.length > 0 && (
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {metaChips.map((c, i) => (
                    <Caption1 key={i} style={{ color: tokens.colorNeutralForeground2 }}>
                      <span style={{ color: tokens.colorNeutralForeground3 }}>{c.label}: </span>{c.value}
                    </Caption1>
                  ))}
                </div>
              )}
              {hasSharing && (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                    <b>Shared with editors:</b> {formatSharingCount(item.sharing?.editors)}
                  </Caption1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                    <b>Shared with viewers:</b> {formatSharingCount(item.sharing?.viewers)}
                  </Caption1>
                </div>
              )}
            </div>
            {item.detail && !hasSharing && metaChips.length === 0 && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}>{item.detail}</Caption1>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SharingSection({ items, counts, search, nameMap }: {
  items: ReturnType<typeof getSharing>
  counts: ResourceSharingCounts
  search: string
  nameMap: Map<string, string>
}) {
  const classes = useClasses()
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(it => {
      if (!q) return true
      const p = it.principal
      const name = p.displayName ?? (p.id && nameMap.get(p.id)) ?? p.email ?? p.userPrincipalName ?? p.id ?? ''
      return name.toLowerCase().includes(q) || it.role.toLowerCase().includes(q)
    })
  }, [items, search, nameMap])

  const hasAggregate = counts.editors || counts.viewers
  if (!hasAggregate && items.length === 0) {
    return <EmptyState message="The inventory API doesn't expose sharing details for this resource." />
  }

  return (
    <>
      {hasAggregate && (
        <div className={classes.card} style={{ marginBottom: '12px' }}>
          <div className={classes.rowGrid}>
            <Row label="Shared with editors"><SharingCountLine counts={counts.editors} /></Row>
            <Row label="Shared with viewers"><SharingCountLine counts={counts.viewers} /></Row>
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className={classes.itemList}>
          {filtered.map((s, i) => {
            const resolvedName = resolvePersonName(s.principal, nameMap)
            const subtitle = s.principal.email ?? s.principal.userPrincipalName
            return (
              <div key={`${s.principal.id ?? s.principal.email ?? i}-${s.role}`} className={classes.itemRowDouble}>
                <Avatar
                  name={resolvedName ?? s.principal.email ?? s.principal.id ?? ''}
                  size={28}
                  color="colorful"
                />
                <div style={{ minWidth: 0 }}>
                  {resolvedName && <PersonCell person={s.principal} nameMap={nameMap} />}
                  {(subtitle || s.principal.type) && (
                    <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                      {subtitle}{s.principal.type ? ` · ${s.principal.type}` : ''}
                    </Caption1>
                  )}
                </div>
                <Badge appearance="tint" color="informative" size="small" className={classes.statusBadge}>{s.role}</Badge>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Usage tab ────────────────────────────────────────────────────────────────

function UsageTab({ resource }: { resource: ResourceItem }) {
  const classes = useClasses()
  const createdOn = getCreatedDate(resource)
  const modifiedOn = getModifiedDate(resource)
  const publishedOn = getPublishedDate(resource)

  const daysAgo = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86400000)
  const entry = (label: string, d?: Date) => {
    if (!d) return null
    const n = daysAgo(d)
    return (
      <Row label={label}>
        <span className={classes.rowValueStack}>
          <span>{formatLocalDateTime(d.toISOString())}</span>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{n} day{n === 1 ? '' : 's'} ago</Caption1>
        </span>
      </Row>
    )
  }

  return (
    <>
      <div className={classes.banner}>
        <PlugConnectedRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Per-resource usage telemetry (users, runs, sessions) isn't returned by the Power Platform
          inventory API. The values below are inventory-derived activity timestamps.
        </span>
      </div>
      {(createdOn || modifiedOn || publishedOn) && (
        <div className={classes.card}>
          <Text className={classes.cardTitle}>Activity</Text>
          <div className={classes.rowGrid}>
            {entry('Created', createdOn)}
            {entry('Last modified', modifiedOn)}
            {entry('Last published', publishedOn)}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Copy-text builder (friendly view of current tab) ────────────────────────

function buildOverviewText(resource: ResourceItem, allEnvironments: ResourceItem[] | undefined, nameMap: Map<string, string>): string {
  const envMap = buildEnvMap(allEnvironments)
  const lines: string[] = [getDisplayName(resource)]
  const add = (label: string, value?: string) => { if (value) lines.push(`${label}: ${value}`) }
  const personText = (p?: PersonRef) => {
    if (!p) return undefined
    if (p.displayName) return p.displayName
    if (p.id && isGuid(p.id)) return isSystemGuid(p.id) ? 'System' : (nameMap.get(p.id) ?? p.id)
    return p.email ?? p.userPrincipalName
  }
  const desc = getDescription(resource)
  add('Description', desc)
  add('Owner', personText(getOwnerPerson(resource)))
  add('Item type', getItemTypeLabel(resource))
  add('Made in', getMadeInProduct(resource).label)
  add('Status', getStatus(resource))
  const channels = getPublishedChannels(resource)
  if (channels.length) add('Published to', channels.join(', '))
  if (getIsQuarantined(resource)) add('Quarantined', 'Yes')
  add('Model', getAgentModel(resource))
  add('Orchestration', getAgentOrchestration(resource))
  add('Authentication', getAgentAuthentication(resource))
  add('Created in', getAgentCreatedIn(resource))
  add('Resource GUID', getResourceGuid(resource))
  add('Schema name', getAgentSchemaName(resource))
  add('App module ID', getAppModuleId(resource))
  add('Logical name', getAppLogicalName(resource))
  add('Workflow entity ID', getFlowWorkflowEntityId(resource))
  const trigger = getFlowTrigger(resource)
  if (trigger) {
    const triggerName = trigger.trigger ? getConnectorInfo(trigger.trigger).displayName : undefined
    add('Trigger', [triggerName, trigger.triggerOperation].filter(Boolean).join(' · ') || undefined)
  }
  add('Resource URL', getResourceUrl(resource))
  add('Environment', resolveEnvironmentName(resource, envMap))
  add('Environment type', resource.environmentType)
  add('Region', formatRegion(resource.environmentRegion ?? resource.location))
  add('Environment ID', resource.environmentId)
  add('Environment group ID', getEnvironmentGroupId(resource))
  const created = getCreatedDate(resource)
  const modified = getModifiedDate(resource)
  const published = getPublishedDate(resource)
  add('Created by', personText(getCreatedBy(resource)))
  if (created)  add('Created on', formatLocalDateTime(created.toISOString()))
  add('Last updated by', personText(getModifiedBy(resource)))
  if (modified) add('Last update on', formatLocalDateTime(modified.toISOString()))
  add('Last published by', personText(getPublishedBy(resource)))
  if (published) add('Last published on', formatLocalDateTime(published.toISOString()))
  return lines.join('\n')
}

// ─── Panel shell ──────────────────────────────────────────────────────────────

export function ResourceDetailPanel({ resource, onClose, allEnvironments }: ResourceDetailPanelProps) {
  const classes = useClasses()
  const [selectedTab, setSelectedTab] = useState<PanelTab>('overview')
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  // Resolve every person GUID we'll need once and share across all tabs.
  const personGuids = useMemo(() => collectAllPersonGuids(resource), [resource])
  const nameMap = useGuidNames(personGuids)

  // The "More" tab only appears when there are unsurfaced inventory fields.
  const hasMore = useMemo(() => getOtherEntries(resource).length > 0, [resource])

  const onTabSelect = (_e: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value as PanelTab)
  }

  const handleCopy = async () => {
    const text = showRaw
      ? JSON.stringify(resource, null, 2)
      : buildOverviewText(resource, allEnvironments, nameMap)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* noop */ }
  }

  return (
    <OverlayDrawer
      open
      position="end"
      onOpenChange={(_, d) => !d.open && onClose()}
      className={classes.drawer}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <div className={classes.headerActions}>
              {copied && (
                <span className={classes.copyConfirm}>
                  <CheckmarkRegular fontSize={14} /> Copied
                </span>
              )}
              <Button
                appearance="subtle"
                icon={<CopyRegular />}
                size="small"
                onClick={handleCopy}
                aria-label="Copy"
              />
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button appearance="subtle" icon={<MoreHorizontalRegular />} size="small" aria-label="More" />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem onClick={() => setShowRaw(v => !v)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Switch checked={showRaw} />
                        Show raw data
                      </span>
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                size="small"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
          }
        >
          <span>{getDisplayName(resource)}</span>
        </DrawerHeaderTitle>
        {!showRaw && (
          <TabList className={classes.tabList} selectedValue={selectedTab} onTabSelect={onTabSelect}>
            <Tab value="overview">Overview</Tab>
            <Tab value="configuration">Configuration</Tab>
            <Tab value="usage">Usage</Tab>
            {hasMore && <Tab value="more">More</Tab>}
          </TabList>
        )}
      </DrawerHeader>

      <DrawerBody>
        <div className={classes.body}>
          {showRaw ? (
            <pre className={classes.rawBox}>{JSON.stringify(resource, null, 2)}</pre>
          ) : (
            <>
              {selectedTab === 'overview' && (
                <OverviewTab resource={resource} allEnvironments={allEnvironments} nameMap={nameMap} />
              )}
              {selectedTab === 'configuration' && (
                <ConfigurationTab resource={resource} nameMap={nameMap} />
              )}
              {selectedTab === 'usage' && (
                <UsageTab resource={resource} />
              )}
              {selectedTab === 'more' && hasMore && (
                <MoreTab resource={resource} nameMap={nameMap} />
              )}
            </>
          )}
        </div>
      </DrawerBody>
    </OverlayDrawer>
  )
}
