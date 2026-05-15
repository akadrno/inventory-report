import { useMemo, useState } from 'react'
import {
  makeStyles, tokens,
  OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody,
  TabList, Tab, type SelectTabData, type SelectTabEvent,
  Button, Text, Badge, Caption1, Body1Strong, Switch,
} from '@fluentui/react-components'
import {
  DismissRegular, PlugConnectedRegular, CopyRegular, CheckmarkRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getOwnerFromProperties, getDisplayName } from '../types'
import { ResourceTypeBadge, friendlyType } from './ResourceTypeBadge'
import { EnvironmentBadge } from './EnvironmentBadge'
import { useGuidNames } from '../hooks/useGuidNames'
import {
  isPersonKey, isGuid, isSystemGuid, extractPersonGuid,
  formatPerson, formatPrimitive, humanizeKey, formatPropertyValueAsText,
} from '../utils/format'
import { buildEnvMap, resolveEnvironmentName } from '../utils/environment'

interface ResourceDetailPanelProps {
  resource: ResourceItem
  onClose: () => void
  allEnvironments?: ResourceItem[]
}

const useClasses = makeStyles({
  drawer: {
    width: '520px',
    maxWidth: '90vw',
  },
  headerStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  tabList: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
  rawToggleRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  copyConfirm: {
    color: tokens.colorPaletteGreenForeground1,
    fontSize: tokens.fontSizeBase200,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
  },
  sectionHeader: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalXS,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    fontSize: tokens.fontSizeBase100,
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  fieldLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  fieldValue: {
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-word',
  },
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
  nestedDetails: {
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXS,
  },
  nestedSummary: {
    cursor: 'pointer',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    padding: `${tokens.spacingVerticalXS} 0`,
  },
  nestedBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase100,
    fontFamily: 'Consolas, monospace',
    overflowX: 'auto',
    maxHeight: '240px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    marginTop: tokens.spacingVerticalXS,
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  connectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  connectionCard: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  connectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
})

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const classes = useClasses()
  if (value == null || value === '') return null
  return (
    <div className={classes.fieldRow}>
      <Text className={classes.fieldLabel}>{label}</Text>
      <Text className={classes.fieldValue}>{value}</Text>
    </div>
  )
}

// ─── Connections ─────────────────────────────────────────────────────────────

interface ConnectionInfo {
  key: string
  displayName: string
  connectorId?: string
  connectorName?: string
  connectionId?: string
  source?: string
  iconUri?: string
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return undefined
}

function normalizeConnection(key: string, raw: Record<string, unknown>): ConnectionInfo {
  return {
    key,
    displayName:
      pickString(raw, ['displayName', 'DisplayName', 'connectorName', 'apiName']) ?? key,
    connectorId: pickString(raw, ['id', 'apiId', 'connectorId', 'api']),
    connectorName: pickString(raw, ['connectorName', 'apiName', 'dataSource']),
    connectionId: pickString(raw, ['connectionName', 'connectionId', 'name']),
    source: pickString(raw, ['source', 'tier']),
    iconUri: pickString(raw, ['iconUri', 'iconUrl']),
  }
}

function extractConnections(resource: ResourceItem): ConnectionInfo[] {
  const props = resource.properties
  if (!props) return []

  const sources: Array<unknown> = [
    props['connectionReferences'],
    props['connectionReferenceLogicalNames'],
    // Flow definitions embed connection refs inside properties.definition.
    (props['definition'] as Record<string, unknown> | undefined)?.['connectionReferences'],
  ]

  const items: ConnectionInfo[] = []
  for (const raw of sources) {
    if (!raw) continue
    if (Array.isArray(raw)) {
      raw.forEach((r, i) => {
        if (r && typeof r === 'object') {
          items.push(normalizeConnection(String(i), r as Record<string, unknown>))
        }
      })
    } else if (typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v && typeof v === 'object') {
          items.push(normalizeConnection(k, v as Record<string, unknown>))
        } else if (typeof v === 'string') {
          items.push({ key: k, displayName: v })
        }
      }
    }
  }
  return items
}

function ConnectionsTab({ resource }: { resource: ResourceItem }) {
  const classes = useClasses()
  const connections = extractConnections(resource)

  if (!connections.length) {
    return (
      <div className={classes.emptyState}>
        <PlugConnectedRegular fontSize={32} />
        <Body1Strong>No connection information</Body1Strong>
        <Caption1>
          This resource does not expose connection references, or none are configured.
        </Caption1>
      </div>
    )
  }

  return (
    <div className={classes.connectionList}>
      {connections.map(c => (
        <div key={c.key} className={classes.connectionCard}>
          <div className={classes.connectionHeader}>
            {c.iconUri && (
              <img src={c.iconUri} alt="" width={20} height={20} />
            )}
            <Body1Strong>{c.displayName}</Body1Strong>
          </div>
          <Field label="Reference" value={c.key !== c.displayName ? c.key : undefined} />
          <Field label="Connector" value={c.connectorName} />
          <Field label="Connector ID" value={c.connectorId} />
          <Field label="Connection ID" value={c.connectionId} />
          <Field label="Source" value={c.source} />
        </div>
      ))}
    </div>
  )
}

// ─── Details ─────────────────────────────────────────────────────────────────

// Collect every Entra GUID referenced by a "person" property so they can all
// be resolved in a single Graph batch when the panel opens.
function collectPersonGuids(resource: ResourceItem): string[] {
  const ids: string[] = []
  const props = resource.properties
  if (!props) return ids
  for (const [key, value] of Object.entries(props)) {
    if (!isPersonKey(key)) continue
    const guid = extractPersonGuid(value)
    if (guid) ids.push(guid)
  }
  return ids
}

interface PropertyRowProps {
  k: string
  value: unknown
  nameMap: Map<string, string>
}

function PropertyRow({ k, value, nameMap }: PropertyRowProps) {
  const classes = useClasses()
  const label = humanizeKey(k)

  // Person reference: resolve GUID → display name.
  if (isPersonKey(k)) {
    const resolved = formatPerson(value, nameMap)
    if (resolved) return <Field label={label} value={resolved} />
    return null
  }

  // Bare GUIDs (non-person keys): show as-is — these are usually entity IDs,
  // not user references, so we don't try to resolve them.
  if (typeof value === 'string' && isGuid(value)) {
    return <Field label={label} value={isSystemGuid(value) ? 'System' : value} />
  }

  // Primitives (incl. ISO dates → locale formatted)
  const primitive = formatPrimitive(value)
  if (primitive !== undefined) {
    return <Field label={label} value={String(primitive)} />
  }

  // Arrays / objects: render an expandable summary so all data stays available.
  if (Array.isArray(value)) {
    return (
      <details className={classes.nestedDetails}>
        <summary className={classes.nestedSummary}>
          {label} <span style={{ color: tokens.colorNeutralForeground3 }}>· {value.length} item{value.length === 1 ? '' : 's'}</span>
        </summary>
        <pre className={classes.nestedBox}>{JSON.stringify(value, null, 2)}</pre>
      </details>
    )
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // Object with a display name → just show that.
    if (typeof obj.displayName === 'string' && obj.displayName) {
      return <Field label={label} value={obj.displayName} />
    }
    const keyCount = Object.keys(obj).length
    return (
      <details className={classes.nestedDetails}>
        <summary className={classes.nestedSummary}>
          {label} <span style={{ color: tokens.colorNeutralForeground3 }}>· {keyCount} field{keyCount === 1 ? '' : 's'}</span>
        </summary>
        <pre className={classes.nestedBox}>{JSON.stringify(value, null, 2)}</pre>
      </details>
    )
  }

  return null
}

function buildFriendlyText(
  resource: ResourceItem,
  ownerDisplay: string,
  envName: string,
  propertyEntries: Array<[string, unknown]>,
  nameMap: Map<string, string>,
): string {
  const lines: string[] = [getDisplayName(resource)]
  const add = (label: string, value: string | undefined) => {
    if (value != null && value !== '' && value !== '—') lines.push(`${label}: ${value}`)
  }
  add('Owner', ownerDisplay)
  add('Environment type', resource.environmentType)
  add('Region', resource.environmentRegion ?? resource.location)
  add('Resource type', friendlyType(resource.type, resource.kind))
  add('Environment name', envName)
  add('Environment ID', resource.environmentId)
  add('Resource ID', resource.id)
  add(
    'Managed environment',
    resource.isManagedEnvironment != null
      ? (resource.isManagedEnvironment ? 'Yes' : 'No')
      : undefined,
  )
  if (resource.tags && Object.keys(resource.tags).length > 0) {
    const tagText = Object.entries(resource.tags).map(([k, v]) => `${k}=${v}`).join(', ')
    lines.push(`Tags: ${tagText}`)
  }
  if (propertyEntries.length > 0) {
    lines.push('', 'Properties:')
    for (const [k, v] of propertyEntries) {
      const text = formatPropertyValueAsText(k, v, nameMap)
      if (text == null) continue
      const label = humanizeKey(k)
      if (text.includes('\n')) {
        lines.push(`  ${label}:`)
        for (const ln of text.split('\n')) lines.push(`    ${ln}`)
      } else {
        lines.push(`  ${label}: ${text}`)
      }
    }
  }
  return lines.join('\n')
}

function DetailsTab({
  resource, allEnvironments,
}: { resource: ResourceItem; allEnvironments?: ResourceItem[] }) {
  const classes = useClasses()
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  const personGuids = useMemo(() => collectPersonGuids(resource), [resource])
  const nameMap = useGuidNames(personGuids)

  const ownerRaw = getOwnerFromProperties(resource)
  const ownerDisplay = isGuid(ownerRaw)
    ? (isSystemGuid(ownerRaw) ? 'System' : (nameMap.get(ownerRaw) ?? ownerRaw))
    : ownerRaw

  const envMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])
  const envName = useMemo(() => resolveEnvironmentName(resource, envMap), [resource, envMap])

  const propertyEntries = useMemo(() => {
    if (!resource.properties) return []
    return Object.entries(resource.properties).sort(([a], [b]) => a.localeCompare(b))
  }, [resource.properties])

  const handleCopy = async () => {
    const text = showRaw
      ? JSON.stringify(resource, null, 2)
      : buildFriendlyText(resource, ownerDisplay, envName, propertyEntries, nameMap)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail in non-secure contexts; ignore silently.
    }
  }

  return (
    <div>
      <div className={classes.rawToggleRow}>
        {copied && (
          <span className={classes.copyConfirm}>
            <CheckmarkRegular fontSize={14} /> Copied
          </span>
        )}
        <Button
          appearance="subtle"
          size="small"
          icon={<CopyRegular />}
          onClick={handleCopy}
          aria-label={showRaw ? 'Copy raw JSON' : 'Copy details'}
        >
          Copy
        </Button>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Show raw data</Caption1>
        <Switch checked={showRaw} onChange={(_, d) => setShowRaw(d.checked)} />
      </div>

      {showRaw ? (
        <pre className={classes.rawBox}>{JSON.stringify(resource, null, 2)}</pre>
      ) : (
        <>
          <Field label="Owner" value={ownerDisplay} />
          <Field label="Environment type" value={resource.environmentType} />
          <Field label="Region" value={resource.environmentRegion ?? resource.location} />
          <Field
            label="Resource type"
            value={<ResourceTypeBadge type={resource.type} kind={resource.kind} />}
          />
          <Field label="Environment name" value={envName !== '—' ? envName : undefined} />
          <Field label="Environment ID" value={resource.environmentId} />
          <Field label="Resource ID" value={resource.id} />
          <Field
            label="Managed environment"
            value={resource.isManagedEnvironment != null
              ? (resource.isManagedEnvironment ? 'Yes' : 'No')
              : undefined}
          />
          {resource.tags && Object.keys(resource.tags).length > 0 && (
            <div className={classes.fieldRow}>
              <Text className={classes.fieldLabel}>Tags</Text>
              <div className={classes.tagList}>
                {Object.entries(resource.tags).map(([k, v]) => (
                  <Badge key={k} appearance="tint" color="subtle" size="small">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {propertyEntries.length > 0 && (
            <>
              <Caption1 block className={classes.sectionHeader}>Properties</Caption1>
              {propertyEntries.map(([k, v]) => (
                <PropertyRow key={k} k={k} value={v} nameMap={nameMap} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Panel shell ─────────────────────────────────────────────────────────────

type PanelTab = 'details' | 'connections'

export function ResourceDetailPanel({ resource, onClose, allEnvironments }: ResourceDetailPanelProps) {
  const classes = useClasses()
  const [selectedTab, setSelectedTab] = useState<PanelTab>('details')
  const displayName = getDisplayName(resource)

  // Only surface the Connections tab when the resource actually carries
  // connection data — the resourcequery inventory API rarely does.
  const hasConnections = useMemo(() => extractConnections(resource).length > 0, [resource])

  const onTabSelect = (_e: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value as PanelTab)
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
            <Button
              appearance="subtle"
              icon={<DismissRegular />}
              aria-label="Close"
              onClick={onClose}
            />
          }
        >
          <div className={classes.headerStack}>
            <span>{displayName}</span>
            <div className={classes.subtitle}>
              <ResourceTypeBadge type={resource.type} kind={resource.kind} />
              <EnvironmentBadge name={resource.environmentName} type={resource.environmentType} />
            </div>
          </div>
        </DrawerHeaderTitle>
        {hasConnections && (
          <TabList
            className={classes.tabList}
            selectedValue={selectedTab}
            onTabSelect={onTabSelect}
          >
            <Tab value="details">Details</Tab>
            <Tab value="connections">Connections</Tab>
          </TabList>
        )}
      </DrawerHeader>

      <DrawerBody>
        {selectedTab === 'details' || !hasConnections
          ? <DetailsTab resource={resource} allEnvironments={allEnvironments} />
          : <ConnectionsTab resource={resource} />}
      </DrawerBody>
    </OverlayDrawer>
  )
}
