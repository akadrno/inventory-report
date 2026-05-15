import { useState, useMemo } from 'react'
import { useResizableColumns, RESIZE_HANDLE_STYLE } from '../hooks/useResizableColumns'
import { useQuery } from '@tanstack/react-query'
import {
  makeStyles, tokens, Text, Caption1, Button, Badge, Card, Select, Spinner, Divider,
  OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody,
} from '@fluentui/react-components'
import {
  ArrowLeftRegular,
  FolderOpenRegular,
  GlobeRegular,
  ChevronRightRegular,
  ChevronUpRegular,
  ChevronDownRegular,
  ArrowSortRegular,
  MoreHorizontalRegular,
  ShieldRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import {
  getDisplayName,
  getGroupEnvironmentIds,
  getOwnerFromProperties,
  getEnvironmentName,
  getIsManagedEnvironment,
} from '../types'
import { EnvironmentBadge } from './EnvironmentBadge'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { ResourceDetailPanel } from './ResourceDetailPanel'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'
import { fetchGroupRuleAssignments, fetchAllRuleBasedPolicies } from '../api/governanceApi'
import type { PolicyRuleSet } from '../api/governanceApi'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GroupsViewProps {
  groups: ResourceItem[]
  environments: ResourceItem[]
  allResources: ResourceItem[]
  ownerNames: Map<string, string>
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useClasses = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  groupCard: {
    cursor: 'pointer',
    userSelect: 'none',
  },
  cardIconRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacingVerticalS,
  },
  iconBox: {
    width: '44px',
    height: '44px',
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorPaletteMarigoldBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorPaletteMarigoldForeground2,
    fontSize: '22px',
    flexShrink: 0,
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalS,
  },
  skeletonCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingVerticalL,
    animationName: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.4 },
    },
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
  skeletonLine: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    height: '16px',
    marginBottom: tokens.spacingVerticalXS,
  },
  emptyState: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXL}`,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  tableWrapper: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    overflow: 'hidden',
    boxShadow: tokens.shadow4,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: tokens.fontSizeBase200,
    tableLayout: 'fixed' as const,
  },
  thead: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  th: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    textAlign: 'left',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap' as const,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    ':hover': { color: tokens.colorNeutralForeground1 },
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  thNoSort: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    textAlign: 'left',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    width: '40px',
  },
  thInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  td: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
  },
  tr: {
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorBrandBackground2 },
    ':last-child td': { borderBottom: 'none' },
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  drillSpace: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveOwner(raw: string, ownerNames: Map<string, string>): string {
  if (raw === '—') return raw
  if (raw.startsWith(SYSTEM_PREFIX)) return 'System'
  if (GUID_RE.test(raw)) return ownerNames.get(raw) ?? raw
  return raw
}

function getEnvsForGroup(group: ResourceItem, environments: ResourceItem[]): ResourceItem[] {
  const groupId = group.id
  const groupName = group.name
  const byProp = environments.filter(env => {
    const p = env.properties ?? {}
    const gid =
      p['environmentGroupId'] ??
      p['groupId'] ??
      (p['environmentGroup'] as Record<string, unknown> | undefined)?.['id'] ??
      (p['group'] as Record<string, unknown> | undefined)?.['id']
    return gid === groupId || gid === groupName
  })
  if (byProp.length > 0) return byProp
  const envIds = getGroupEnvironmentIds(group)
  if (envIds.length > 0) {
    return environments.filter(env => envIds.includes(env.id) || envIds.includes(env.name))
  }
  return []
}

function getResourcesForEnvironment(resources: ResourceItem[], env: ResourceItem): ResourceItem[] {
  const envId = env.id
  const envName = env.name
  const envDisplayName = getDisplayName(env)
  return resources.filter(r => {
    if (r.environmentId && (r.environmentId === envId || r.environmentId === envName)) return true
    if (r.environmentName && (r.environmentName === envDisplayName || r.environmentName === envName)) return true
    const resolved = getEnvironmentName(r)
    if (resolved && (resolved === envDisplayName || resolved === envId || resolved === envName)) return true
    return false
  })
}

// ---------------------------------------------------------------------------
// Sort icon (generic)
// ---------------------------------------------------------------------------

type SortDir = 'asc' | 'desc'

function TableSortIcon({ isActive, dir }: { isActive: boolean; dir: SortDir }) {
  if (!isActive) return <ArrowSortRegular fontSize={14} style={{ opacity: 0.4 }} />
  return dir === 'asc'
    ? <ChevronUpRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
    : <ChevronDownRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
}

// ---------------------------------------------------------------------------
// Environment table (group → environments)
// ---------------------------------------------------------------------------

type EnvSortField = 'name' | 'type' | 'region' | 'managed'

const ENV_HEADERS: { key: EnvSortField; label: string }[] = [
  { key: 'name', label: 'Environment Name' },
  { key: 'type', label: 'Type' },
  { key: 'region', label: 'Region' },
  { key: 'managed', label: 'Managed' },
]

function EnvironmentTable({
  environments,
  onEnvClick,
}: {
  environments: ResourceItem[]
  onEnvClick: (env: ResourceItem) => void
}) {
  const [sort, setSort] = useState<{ field: EnvSortField; dir: SortDir }>({ field: 'name', dir: 'asc' })
  const { widths: envWidths, getResizeProps: getEnvResize } = useResizableColumns({ name: 280, type: 150, region: 130, managed: 100 })
  const [detailEnv, setDetailEnv] = useState<ResourceItem | null>(null)
  const classes = useClasses()

  const sorted = [...environments].sort((a, b) => {
    let av = '', bv = ''
    if (sort.field === 'name') { av = getDisplayName(a); bv = getDisplayName(b) }
    else if (sort.field === 'type') { av = a.environmentType ?? ''; bv = b.environmentType ?? '' }
    else if (sort.field === 'region') { av = a.environmentRegion ?? a.location ?? ''; bv = b.environmentRegion ?? b.location ?? '' }
    else if (sort.field === 'managed') { av = String(getIsManagedEnvironment(a)); bv = String(getIsManagedEnvironment(b)) }
    const cmp = av.localeCompare(bv)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const handleSort = (field: EnvSortField) =>
    setSort(prev => ({ field, dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc' }))

  return (
    <>
      <div className={classes.tableWrapper}>
        <div style={{ overflowX: 'auto' }}>
          <table className={classes.table}>
            <colgroup>
              {ENV_HEADERS.map(h => <col key={h.key} style={{ width: envWidths[h.key] }} />)}
              <col style={{ width: 40 }} />
            </colgroup>
            <thead className={classes.thead}>
              <tr>
                {ENV_HEADERS.map(h => (
                  <th key={h.key} className={classes.th} onClick={() => handleSort(h.key)}>
                    <div className={classes.thInner}>
                      {h.label}
                      <TableSortIcon isActive={sort.field === h.key} dir={sort.dir} />
                    </div>
                    <div {...getEnvResize(h.key)} style={RESIZE_HANDLE_STYLE} />
                  </th>
                ))}
                <th className={classes.thNoSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(env => {
                const name = getDisplayName(env)
                const region = env.environmentRegion ?? env.location ?? '—'
                return (
                  <tr key={env.id} className={classes.tr} onClick={() => onEnvClick(env)}>
                    <td className={classes.td}>
                      <div className={classes.nameCell}>
                        <GlobeRegular fontSize={16} style={{ color: tokens.colorBrandForeground2, flexShrink: 0 }} />
                        <div>
                          <Text weight="semibold" style={{ display: 'block' }}>{name}</Text>
                          {name !== env.name && (
                            <Caption1 style={{ color: tokens.colorNeutralForeground3, fontFamily: 'Consolas, monospace' }}>
                              {env.name}
                            </Caption1>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={classes.td}>
                      <EnvironmentBadge name={env.environmentType ?? env.type.split('/').pop()} type={env.environmentType} />
                    </td>
                    <td className={classes.td}>
                      <Text style={{ color: tokens.colorNeutralForeground2, textTransform: 'capitalize' }}>{region}</Text>
                    </td>
                    <td className={classes.td}>
                      {(() => {
                        const managed = getIsManagedEnvironment(env)
                        return (
                          <Badge appearance="tint" color={managed ? 'success' : 'subtle'} size="small">
                            {managed ? 'Yes' : 'No'}
                          </Badge>
                        )
                      })()}
                    </td>
                    <td className={classes.td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button
                        appearance="subtle"
                        icon={<MoreHorizontalRegular />}
                        size="small"
                        title="View environment details"
                        onClick={e => { e.stopPropagation(); setDetailEnv(env) }}
                      />
                      <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, verticalAlign: 'middle', marginLeft: '4px' }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailEnv && <ResourceDetailPanel resource={detailEnv} onClose={() => setDetailEnv(null)} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Environment resources view (environment → apps/flows/agents)
// ---------------------------------------------------------------------------

type ResSortField = 'name' | 'type' | 'owner'

const RES_HEADERS: { key: ResSortField; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'owner', label: 'Owner' },
]

function EnvironmentResourcesView({
  group,
  environment,
  resources,
  ownerNames,
  onBack,
}: {
  group: ResourceItem
  environment: ResourceItem
  resources: ResourceItem[]
  ownerNames: Map<string, string>
  onBack: () => void
}) {
  const [sort, setSort] = useState<{ field: ResSortField; dir: SortDir }>({ field: 'name', dir: 'asc' })
  const [selected, setSelected] = useState<ResourceItem | null>(null)
  const classes = useClasses()
  const { widths: resWidths, getResizeProps: getResResize } = useResizableColumns({ name: 260, type: 150, owner: 180 })

  const sorted = [...resources].sort((a, b) => {
    const aSystem = getOwnerFromProperties(a).startsWith(SYSTEM_PREFIX)
    const bSystem = getOwnerFromProperties(b).startsWith(SYSTEM_PREFIX)
    if (aSystem !== bSystem) return aSystem ? 1 : -1

    let av = '', bv = ''
    if (sort.field === 'name') { av = getDisplayName(a); bv = getDisplayName(b) }
    else if (sort.field === 'type') { av = a.type; bv = b.type }
    else if (sort.field === 'owner') {
      av = resolveOwner(getOwnerFromProperties(a), ownerNames)
      bv = resolveOwner(getOwnerFromProperties(b), ownerNames)
    }
    const cmp = av.localeCompare(bv)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const handleSort = (field: ResSortField) =>
    setSort(prev => ({ field, dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc' }))

  const groupName = getDisplayName(group)
  const envName = getDisplayName(environment)

  return (
    <div className={classes.drillSpace}>
      <div className={classes.breadcrumb}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} size="small" onClick={onBack}>
          {groupName}
        </Button>
        <Text style={{ color: tokens.colorNeutralForeground3 }}>/</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
          <GlobeRegular style={{ color: tokens.colorBrandForeground2, fontSize: '16px' }} />
          <Text weight="semibold">{envName}</Text>
        </div>
        <Badge appearance="tint" color="subtle" size="small">
          {resources.length} resource{resources.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {resources.length === 0 ? (
        <div className={classes.emptyState}>
          <Text weight="semibold" style={{ display: 'block' }}>No resources found in this environment</Text>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: tokens.spacingVerticalXS }}>
            Apps, flows, and agents will appear here once they are created in this environment.
          </Caption1>
        </div>
      ) : (
        <div className={classes.tableWrapper}>
          <div style={{ overflowX: 'auto' }}>
            <table className={classes.table}>
              <colgroup>
                {RES_HEADERS.map(h => <col key={h.key} style={{ width: resWidths[h.key] }} />)}
              </colgroup>
              <thead className={classes.thead}>
                <tr>
                  {RES_HEADERS.map(h => (
                    <th key={h.key} className={classes.th} onClick={() => handleSort(h.key)}>
                      <div className={classes.thInner}>
                        {h.label}
                        <TableSortIcon isActive={sort.field === h.key} dir={sort.dir} />
                      </div>
                      <div {...getResResize(h.key)} style={RESIZE_HANDLE_STYLE} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(item => {
                  const displayName = getDisplayName(item)
                  const rawOwner = getOwnerFromProperties(item)
                  const owner = resolveOwner(rawOwner, ownerNames)
                  return (
                    <tr key={item.id} className={classes.tr} onClick={() => setSelected(item)}>
                      <td className={classes.td}>
                        <Text weight="semibold" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }} title={displayName}>
                          {displayName}
                        </Text>
                        {displayName !== item.name && (
                          <Caption1 style={{ color: tokens.colorNeutralForeground3, fontFamily: 'Consolas, monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }} title={item.name}>
                            {item.name}
                          </Caption1>
                        )}
                      </td>
                      <td className={classes.td}>
                        <ResourceTypeBadge type={item.type} kind={item.kind} />
                      </td>
                      <td className={classes.td}>
                        <Text style={{ color: tokens.colorNeutralForeground2 }}>{owner}</Text>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <ResourceDetailPanel resource={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drill-down (group → environments, then env → resources)
// ---------------------------------------------------------------------------

function DrillDown({
  group,
  environments,
  allResources,
  ownerNames,
  onBack,
}: {
  group: ResourceItem
  environments: ResourceItem[]
  allResources: ResourceItem[]
  ownerNames: Map<string, string>
  onBack: () => void
}) {
  const [selectedEnv, setSelectedEnv] = useState<ResourceItem | null>(null)
  const classes = useClasses()

  const envResources = useMemo(
    () => selectedEnv ? getResourcesForEnvironment(allResources, selectedEnv) : [],
    [selectedEnv, allResources],
  )

  if (selectedEnv) {
    return (
      <EnvironmentResourcesView
        group={group}
        environment={selectedEnv}
        resources={envResources}
        ownerNames={ownerNames}
        onBack={() => setSelectedEnv(null)}
      />
    )
  }

  const name = getDisplayName(group)

  return (
    <div className={classes.drillSpace}>
      <div className={classes.breadcrumb}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={onBack} size="small">
          Back to Groups
        </Button>
        <Text style={{ color: tokens.colorNeutralForeground3 }}>/</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
          <FolderOpenRegular style={{ color: tokens.colorPaletteMarigoldForeground2 }} />
          <Text weight="semibold">{name}</Text>
        </div>
        <Badge appearance="tint" color="subtle" size="small">
          {environments.length} environment{environments.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {environments.length === 0 ? (
        <div className={classes.emptyState}>
          <GlobeRegular fontSize={40} style={{ opacity: 0.3, marginBottom: tokens.spacingVerticalM }} />
          <Text weight="semibold" style={{ display: 'block' }}>No environments found in this group</Text>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: tokens.spacingVerticalXS }}>
            Environments are matched by their <code>environmentGroupId</code> property.
          </Caption1>
        </div>
      ) : (
        <EnvironmentTable environments={environments} onEnvClick={setSelectedEnv} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group rules side panel
// ---------------------------------------------------------------------------

function humanizeName(name: string | undefined): string {
  if (!name) return '—'
  // Strip common system namespace prefixes (e.g. "Microsoft.PowerApps.Governance.")
  const stripped = name.replace(/^(?:[A-Za-z]+\.){2,}/, '')
  // Split PascalCase/camelCase into words, then clean up separators
  return stripped
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}


interface GroupRulesData {
  ruleSets: PolicyRuleSet[]
}

function GroupRulesPanel({ group, isOpen, onClose }: { group: ResourceItem | null; isOpen: boolean; onClose: () => void }) {
  const groupName = group ? getDisplayName(group) : ''
  const groupId = group?.id ?? ''
  // Extract bare GUID from resource path if needed
  const groupGuid = groupId.includes('/') ? groupId.split('/').filter(Boolean).pop()! : groupId

  const { data, isLoading, error } = useQuery<GroupRulesData>({
    queryKey: ['groupRulePolicies', group?.id],
    queryFn: async () => {
      const [assignmentsResult, allPoliciesResult] = await Promise.all([
        fetchGroupRuleAssignments(group!.id),
        fetchAllRuleBasedPolicies().catch(() => ({ policies: [], rawJson: '{}' })),
      ])

      const { assignments } = assignmentsResult
      const { policies: allPolicies } = allPoliciesResult

      // Build all known identifiers: group GUID, assigned policyIds, resourceId from assignments
      const groupIdentifiers: string[] = groupGuid ? [groupGuid] : []
      for (const a of assignments) {
        if (a.policyId && !groupIdentifiers.includes(a.policyId)) groupIdentifiers.push(a.policyId)
        const rid = typeof a.resourceId === 'string'
          ? (a.resourceId.includes('/') ? a.resourceId.split('/').filter(Boolean).pop()! : a.resourceId)
          : null
        if (rid && !groupIdentifiers.includes(rid)) groupIdentifiers.push(rid)
      }

      // Single pass over all-policies: include any policy that references this group.
      // The all-policies list already has ruleSets inline — no extra fetches needed.
      const seenPolicyIds = new Set<string>()
      const collectedRuleSets: PolicyRuleSet[][] = []

      for (const p of allPolicies) {
        const key = p.id ?? ''
        if (seenPolicyIds.has(key)) continue
        // Skip per-environment synced copies
        if (p.name === 'Synced Environment Policy (from Environment Group)') continue
        const pJson = JSON.stringify(p)
        if (groupIdentifiers.some(id => pJson.includes(id))) {
          seenPolicyIds.add(key)
          collectedRuleSets.push(p.ruleSets ?? [])
        }
      }

      // Flatten and deduplicate ruleSets by id
      const seenRuleSetIds = new Set<string>()
      const ruleSets: PolicyRuleSet[] = []
      for (const batch of collectedRuleSets) {
        for (const rs of batch) {
          const key = rs.id ?? rs.name ?? JSON.stringify(rs)
          if (!seenRuleSetIds.has(key)) {
            seenRuleSetIds.add(key)
            ruleSets.push(rs)
          }
        }
      }

      return { ruleSets }
    },
    enabled: isOpen && !!group?.id,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <OverlayDrawer position="end" open={isOpen} onOpenChange={(_, s) => { if (!s.open) onClose() }} style={{ width: '460px' }}>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={<Button appearance="subtle" icon={<DismissRegular />} onClick={onClose} />}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
            <ShieldRegular style={{ color: tokens.colorBrandForeground1, fontSize: '18px' }} />
            <span>Enabled Rules</span>
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, paddingBottom: tokens.spacingVerticalL }}>
          <Text weight="semibold" style={{ display: 'block', color: tokens.colorNeutralForeground2 }}>{groupName}</Text>
          <Divider />

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, padding: tokens.spacingVerticalM }}>
              <Spinner size="small" />
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading policies…</Caption1>
            </div>
          )}

          {error && (
            <Text style={{ color: tokens.colorStatusDangerForeground1 }}>
              Failed to load rules: {(error as Error).message ?? String(error)}
            </Text>
          )}

          {data && data.ruleSets.length === 0 && (
            <div style={{ padding: tokens.spacingVerticalL, textAlign: 'center' }}>
              <ShieldRegular fontSize={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto', marginBottom: tokens.spacingVerticalS }} />
              <Text style={{ display: 'block', color: tokens.colorNeutralForeground3 }}>No rules assigned to this group</Text>
            </div>
          )}

          {data && data.ruleSets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {data.ruleSets.map((rs, rsIdx) => {
                const rsName = rs.displayName ?? humanizeName(rs.id ?? rs.name)
                return (
                  <div
                    key={rs.id ?? rsIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: tokens.spacingHorizontalS,
                      padding: `8px ${tokens.spacingHorizontalM}`,
                      backgroundColor: tokens.colorNeutralBackground1,
                      border: `1px solid ${tokens.colorNeutralStroke2}`,
                      borderRadius: tokens.borderRadiusSmall,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontWeight: tokens.fontWeightSemibold, display: 'block' }}>
                        {rsName}
                      </Text>
                    </div>
                    <Badge appearance="tint" color="success" size="small" style={{ flexShrink: 0, marginTop: '2px' }}>
                      Active
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DrawerBody>
    </OverlayDrawer>
  )
}

// ---------------------------------------------------------------------------
// Group card
// ---------------------------------------------------------------------------

function GroupCard({ group, envCount, onClick, onViewRules }: { group: ResourceItem; envCount: number; onClick: () => void; onViewRules: () => void }) {
  const classes = useClasses()
  const name = getDisplayName(group)
  const desc = (group.properties?.['description'] as string | undefined) ?? ''

  return (
    <Card className={classes.groupCard} onClick={onClick}>
      <div className={classes.cardIconRow}>
        <div className={classes.iconBox}>
          <FolderOpenRegular />
        </div>
        <ChevronRightRegular style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }} />
      </div>
      <Text weight="semibold" block style={{ marginBottom: desc ? tokens.spacingVerticalXS : 0 }}>
        {name}
      </Text>
      {desc && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {desc}
        </Caption1>
      )}
      <div className={classes.cardFooter}>
        <GlobeRegular fontSize={14} />
        <Caption1>{envCount} environment{envCount !== 1 ? 's' : ''}</Caption1>
        <div style={{ flex: 1 }} />
        <Button
          appearance="subtle"
          icon={<ShieldRegular fontSize={14} />}
          size="small"
          title="View rules & policies"
          onClick={e => { e.stopPropagation(); onViewRules() }}
        />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function GroupsView({ groups, environments, allResources, ownerNames, isLoading }: GroupsViewProps) {
  const [selectedGroup, setSelectedGroup] = useState<ResourceItem | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [hideEmpty, setHideEmpty] = useState(true)
  const [minEnvs, setMinEnvs] = useState(0)
  const [rulesGroup, setRulesGroup] = useState<ResourceItem | null>(null)
  const [rulesPanelOpen, setRulesPanelOpen] = useState(false)
  const classes = useClasses()

  const envsForSelected = useMemo(
    () => selectedGroup ? getEnvsForGroup(selectedGroup, environments) : [],
    [selectedGroup, environments],
  )

  const envCountByGroup = useMemo(
    () => new Map(groups.map(g => [g.id, getEnvsForGroup(g, environments).length])),
    [groups, environments],
  )

  const filteredGroups = useMemo(() => {
    let result = [...groups]
    if (hideEmpty) result = result.filter(g => (envCountByGroup.get(g.id) ?? 0) > 0)
    if (minEnvs > 0) result = result.filter(g => (envCountByGroup.get(g.id) ?? 0) >= minEnvs)
    result.sort((a, b) => {
      const cmp = getDisplayName(a).localeCompare(getDisplayName(b))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [groups, envCountByGroup, hideEmpty, minEnvs, sortDir])

  if (selectedGroup) {
    return (
      <DrillDown
        group={selectedGroup}
        environments={envsForSelected}
        allResources={allResources}
        ownerNames={ownerNames}
        onBack={() => setSelectedGroup(null)}
      />
    )
  }

  if (isLoading) {
    return (
      <div className={classes.grid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={classes.skeletonCard}>
            <div className={classes.skeletonLine} style={{ width: '44px', height: '44px', borderRadius: tokens.borderRadiusLarge, marginBottom: tokens.spacingVerticalM }} />
            <div className={classes.skeletonLine} style={{ width: '75%' }} />
            <div className={classes.skeletonLine} style={{ width: '50%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className={classes.emptyState}>
        <FolderOpenRegular fontSize={40} style={{ opacity: 0.3, marginBottom: tokens.spacingVerticalM }} />
        <Text weight="semibold" style={{ display: 'block' }}>No environment groups found</Text>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: tokens.spacingVerticalXS }}>
          Environment groups will appear here once they exist in your tenant.
        </Caption1>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Button
          size="small"
          appearance="subtle"
          icon={sortDir === 'asc' ? <ChevronUpRegular fontSize={14} /> : <ChevronDownRegular fontSize={14} />}
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
        >
          {sortDir === 'asc' ? 'A → Z' : 'Z → A'}
        </Button>
        <Button
          size="small"
          appearance={hideEmpty ? 'primary' : 'subtle'}
          onClick={() => setHideEmpty(h => !h)}
        >
          {hideEmpty ? 'Empty groups hidden' : 'Hide empty groups'}
        </Button>
        <Select
          size="small"
          value={String(minEnvs)}
          onChange={(_, d) => setMinEnvs(Number(d.value))}
        >
          <option value="0">Any size</option>
          <option value="2">2+ environments</option>
          <option value="5">5+ environments</option>
          <option value="10">10+ environments</option>
          <option value="20">20+ environments</option>
        </Select>
        <div style={{ flex: 1 }} />
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          {filteredGroups.length} of {groups.length} group{groups.length !== 1 ? 's' : ''}
        </Caption1>
      </div>

      {filteredGroups.length === 0 ? (
        <div className={classes.emptyState}>
          <FolderOpenRegular fontSize={40} style={{ opacity: 0.3, marginBottom: tokens.spacingVerticalM }} />
          <Text weight="semibold" style={{ display: 'block' }}>No groups match the current filters</Text>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: tokens.spacingVerticalXS }}>
            Try adjusting the size filter or showing empty groups.
          </Caption1>
        </div>
      ) : (
        <div className={classes.grid}>
          {filteredGroups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              envCount={envCountByGroup.get(group.id) ?? 0}
              onClick={() => setSelectedGroup(group)}
              onViewRules={() => { setRulesGroup(group); setRulesPanelOpen(true) }}
            />
          ))}
        </div>
      )}

      <GroupRulesPanel
        group={rulesGroup}
        isOpen={rulesPanelOpen}
        onClose={() => setRulesPanelOpen(false)}
      />
    </div>
  )
}
