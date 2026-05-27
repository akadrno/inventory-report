import { useState, useMemo } from 'react'
import { useResizableColumns, RESIZE_HANDLE_STYLE } from '../hooks/useResizableColumns'
import {
  makeStyles, tokens, Text, Button, Badge,
  Menu, MenuTrigger, MenuPopover, MenuList, MenuItem,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, Caption1,
} from '@fluentui/react-components'
import {
  ArrowLeftRegular,
  GlobeRegular,
  ChevronRightRegular,
  ChevronUpRegular,
  ChevronDownRegular,
  ArrowSortRegular,
  MoreVerticalRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getDisplayName, getOwnerFromProperties, getEnvironmentIdFromPath } from '../types'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { EnvironmentBadge } from './EnvironmentBadge'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { ResourceDetailPanel } from './ResourceDetailPanel'
import { formatRegion } from '../utils/regions'
import { getResourceCategory } from '../types'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'

interface EnvironmentsViewProps {
  environments: ResourceItem[]
  allResources: ResourceItem[]
  ownerNames: Map<string, string>
}

type SortDir = 'asc' | 'desc'

const useClasses = makeStyles({
  tableWrapper: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    overflow: 'hidden',
    boxShadow: tokens.shadow4,
    flexShrink: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: tokens.fontSizeBase200,
    tableLayout: 'fixed' as const,
  },
  thead: { backgroundColor: tokens.colorNeutralBackground3 },
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
    whiteSpace: 'nowrap',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    ':hover': { color: tokens.colorNeutralForeground1 },
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  thStatic: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    width: '40px',
  },
  thInner: { display: 'flex', alignItems: 'center', gap: '4px' },
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
  nameCell: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  resourceNameCell: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
  drillSpace: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  emptyState: {
    paddingTop: `calc(${tokens.spacingVerticalXXL} * 2)`,
    paddingBottom: `calc(${tokens.spacingVerticalXXL} * 2)`,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground3,
    gap: '12px',
    flexWrap: 'wrap',
  },
  paginationBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  // modal styles
  modalSurface: { maxWidth: '640px', width: '100%', maxHeight: '85vh' },
  modalContent: { overflowY: 'auto', maxHeight: '60vh' },
  modalSubtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalXS,
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
  fieldLabel: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  fieldValue: { fontSize: tokens.fontSizeBase200, wordBreak: 'break-all' },
  propsBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase100,
    fontFamily: 'Consolas, monospace',
    overflowX: 'auto',
    maxHeight: '192px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    marginTop: tokens.spacingVerticalS,
  },
})

function getEnvTypeName(env: ResourceItem): string | undefined {
  if (env.environmentType) return env.environmentType
  const p = env.properties
  if (!p) return undefined
  const candidates = [p['environmentSku'], p['sku'], p['type'], p['environmentType'], p['kind']]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return undefined
}

function resolveOwner(raw: string, ownerNames: Map<string, string>): string {
  if (raw === '—') return raw
  if (raw.startsWith(SYSTEM_PREFIX)) return 'System'
  return GUID_RE.test(raw) ? (ownerNames.get(raw) ?? raw) : raw
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowSortRegular fontSize={14} style={{ opacity: 0.4 }} />
  return dir === 'asc'
    ? <ChevronUpRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
    : <ChevronDownRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
}

function ResourceIcon({ type }: { type: string }) {
  const cat = getResourceCategory(type)
  if (cat === 'apps') return <PowerAppsIcon fontSize={16} />
  if (cat === 'flows') return <PowerAutomateIcon fontSize={16} />
  if (cat === 'agents') return <CopilotStudioIcon fontSize={16} />
  return null
}

function getEnvResources(allResources: ResourceItem[], env: ResourceItem): ResourceItem[] {
  const envName = env.name
  return allResources.filter(r => {
    const envId = getEnvironmentIdFromPath(r.id)
    if (envId && envId === envName) return true
    if (r.environmentId && r.environmentId === envName) return true
    return false
  })
}

// ── Environment metadata modal ───────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const classes = useClasses()
  if (value == null || value === '') return null
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  return (
    <div className={classes.fieldRow}>
      <Text className={classes.fieldLabel}>{label}</Text>
      <Text className={classes.fieldValue}>{display}</Text>
    </div>
  )
}

function FieldLink({ label, value }: { label: string; value?: string | null }) {
  const classes = useClasses()
  if (!value) return null
  return (
    <div className={classes.fieldRow}>
      <Text className={classes.fieldLabel}>{label}</Text>
      <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorBrandForeground1, wordBreak: 'break-all' }}>
        {value}
      </a>
    </div>
  )
}

function EnvironmentMetadataModal({ env, onClose }: { env: ResourceItem; onClose: () => void }) {
  const classes = useClasses()
  const displayName = getDisplayName(env)
  const envType = getEnvTypeName(env)
  const p = env.properties ?? {}
  const linked = p['linkedEnvironmentMetadata'] as Record<string, unknown> | undefined
  const states = p['states'] as Record<string, unknown> | undefined
  const mgmt = states?.['management'] as Record<string, unknown> | undefined

  const instanceUrl = linked?.['instanceUrl'] as string | undefined
  const createdTime = (linked?.['createdTime'] ?? p['createdTime']) as string | undefined
  const baseLanguage = linked?.['baseLanguage'] as string | number | undefined
  const currency = (linked?.['currency'] as Record<string, unknown> | undefined)?.['code'] as string | undefined
  const securityGroupId = linked?.['securityGroupId'] as string | undefined
  const status = mgmt?.['id'] as string | undefined
  const isDefault = p['isDefault'] as boolean | undefined
  const tenantId = p['tenantId'] as string | undefined

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={classes.modalSurface}>
        <DialogBody>
          <DialogTitle
            action={
              <Button appearance="subtle" icon={<DismissRegular />} aria-label="Close" onClick={onClose} />
            }
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                <GlobeRegular style={{ color: tokens.colorBrandForeground2, fontSize: '20px', flexShrink: 0 }} />
                {displayName}
              </div>
              <div className={classes.modalSubtitle}>
                <EnvironmentBadge name={envType} type={envType} />
                {isDefault && <Badge appearance="tint" color="brand" size="small">Default</Badge>}
              </div>
            </div>
          </DialogTitle>

          <DialogContent className={classes.modalContent}>
            <div>
              <Field label="Environment ID" value={env.name} />
              <Field label="Type" value={envType} />
              <Field label="Region" value={formatRegion(env.environmentRegion ?? env.location)} />
              <Field label="Status" value={status} />
              <Field label="Is Default" value={isDefault} />
              <Field label="Managed Environment" value={env.isManagedEnvironment} />
              <FieldLink label="Dataverse URL" value={instanceUrl} />
              <Field label="Language" value={baseLanguage != null ? String(baseLanguage) : undefined} />
              <Field label="Currency" value={currency} />
              <Field label="Security Group" value={securityGroupId} />
              <Field label="Tenant ID" value={tenantId} />
              <Field label="Created" value={createdTime ? new Date(createdTime).toLocaleString() : undefined} />
              {p && Object.keys(p).length > 0 && (
                <div style={{ marginTop: tokens.spacingVerticalM }}>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Raw Properties</Caption1>
                  <pre className={classes.propsBox}>{JSON.stringify(p, null, 2)}</pre>
                </div>
              )}
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

// ── Environment resources view ───────────────────────────────────────────────

type ResSortField = 'name' | 'type' | 'owner'

function EnvironmentResourcesView({
  environment,
  resources,
  ownerNames,
  onBack,
}: {
  environment: ResourceItem
  resources: ResourceItem[]
  ownerNames: Map<string, string>
  onBack: () => void
}) {
  const [sort, setSort] = useState<{ field: ResSortField; dir: SortDir }>({ field: 'name', dir: 'asc' })
  const [selected, setSelected] = useState<ResourceItem | null>(null)
  const classes = useClasses()

  const sorted = [...resources].sort((a, b) => {
    let av = '', bv = ''
    if (sort.field === 'name') { av = getDisplayName(a); bv = getDisplayName(b) }
    else if (sort.field === 'type') { av = a.type; bv = b.type }
    else if (sort.field === 'owner') {
      av = resolveOwner(getOwnerFromProperties(a), ownerNames)
      bv = resolveOwner(getOwnerFromProperties(b), ownerNames)
    }
    const c = av.localeCompare(bv)
    return sort.dir === 'asc' ? c : -c
  })

  const handleSort = (f: ResSortField) =>
    setSort(p => ({ field: f, dir: p.field === f && p.dir === 'asc' ? 'desc' : 'asc' }))

  const envName = getDisplayName(environment)

  return (
    <div className={classes.drillSpace}>
      <div className={classes.breadcrumb}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} size="small" onClick={onBack}>
          All Environments
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
        <div className={classes.tableWrapper} style={{ padding: `calc(${tokens.spacingVerticalXXL} * 2)`, textAlign: 'center' }}>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>No resources found in this environment</Text>
        </div>
      ) : (
        <div className={classes.tableWrapper}>
          <div style={{ overflowX: 'auto' }}>
            <table className={classes.table}>
              <thead className={classes.thead}>
                <tr>
                  {(['name', 'type', 'owner'] as ResSortField[]).map(f => (
                    <th key={f} className={classes.th} onClick={() => handleSort(f)}>
                      <div className={classes.thInner}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <SortIcon active={sort.field === f} dir={sort.dir} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(item => (
                  <tr key={item.id} className={classes.tr} onClick={() => setSelected(item)}>
                    <td className={classes.td}>
                      <div className={classes.resourceNameCell}>
                        <ResourceIcon type={item.type} />
                        <Text weight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }} title={getDisplayName(item)}>
                          {getDisplayName(item)}
                        </Text>
                      </div>
                    </td>
                    <td className={classes.td}><ResourceTypeBadge type={item.type} kind={item.kind} /></td>
                    <td className={classes.td}>
                      <Text style={{ color: tokens.colorNeutralForeground2 }}>
                        {resolveOwner(getOwnerFromProperties(item), ownerNames)}
                      </Text>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <ResourceDetailPanel resource={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ── Environment list ─────────────────────────────────────────────────────────

type EnvSortField = 'name' | 'type' | 'region' | 'resources'

const ENV_PAGE_SIZE_OPTIONS = [25, 50, 100, 150, 200, 300, 500, 1000]

function EnvironmentListTable({
  environments,
  resourceCounts,
  onEnvClick,
}: {
  environments: ResourceItem[]
  resourceCounts: Map<string, number>
  onEnvClick: (env: ResourceItem) => void
}) {
  const [sort, setSort] = useState<{ field: EnvSortField; dir: SortDir }>({ field: 'resources', dir: 'desc' })
  const [menuEnv, setMenuEnv] = useState<ResourceItem | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const classes = useClasses()
  const { widths, getResizeProps } = useResizableColumns({ name: 280, action: 40, type: 150, region: 120, resources: 100 })

  const sorted = [...environments].sort((a, b) => {
    let av: string | number = '', bv: string | number = ''
    if (sort.field === 'name') { av = getDisplayName(a); bv = getDisplayName(b) }
    else if (sort.field === 'type') { av = getEnvTypeName(a) ?? ''; bv = getEnvTypeName(b) ?? '' }
    else if (sort.field === 'region') { av = formatRegion(a.environmentRegion ?? a.location); bv = formatRegion(b.environmentRegion ?? b.location) }
    else { av = resourceCounts.get(a.name) ?? 0; bv = resourceCounts.get(b.name) ?? 0 }
    const c = typeof av === 'number' ? av - (bv as number) : (av as string).localeCompare(bv as string)
    return sort.dir === 'asc' ? c : -c
  })

  const handleSort = (f: EnvSortField) => {
    setSort(p => ({ field: f, dir: p.field === f && p.dir === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pageItems = sorted.slice(pageStart, pageStart + pageSize)
  const displayStart = sorted.length === 0 ? 0 : pageStart + 1
  const displayEnd = Math.min(pageStart + pageSize, sorted.length)

  return (
    <>
      <div className={classes.tableWrapper}>
        <div style={{ overflowX: 'auto' }}>
          <table className={classes.table}>
            <colgroup>
              <col style={{ width: widths.name }} />
              <col style={{ width: widths.action }} />
              <col style={{ width: widths.type }} />
              <col style={{ width: widths.region }} />
              <col style={{ width: widths.resources }} />
              <col style={{ width: widths.action }} />
            </colgroup>
            <thead className={classes.thead}>
              <tr>
                <th className={classes.th} onClick={() => handleSort('name')}>
                  <div className={classes.thInner}>Environment <SortIcon active={sort.field === 'name'} dir={sort.dir} /></div>
                  <div {...getResizeProps('name')} style={RESIZE_HANDLE_STYLE} />
                </th>
                <th className={classes.thStatic} />
                <th className={classes.th} onClick={() => handleSort('type')}>
                  <div className={classes.thInner}>Type <SortIcon active={sort.field === 'type'} dir={sort.dir} /></div>
                  <div {...getResizeProps('type')} style={RESIZE_HANDLE_STYLE} />
                </th>
                <th className={classes.th} onClick={() => handleSort('region')}>
                  <div className={classes.thInner}>Region <SortIcon active={sort.field === 'region'} dir={sort.dir} /></div>
                  <div {...getResizeProps('region')} style={RESIZE_HANDLE_STYLE} />
                </th>
                <th className={classes.th} onClick={() => handleSort('resources')}>
                  <div className={classes.thInner}>Resources <SortIcon active={sort.field === 'resources'} dir={sort.dir} /></div>
                  <div {...getResizeProps('resources')} style={RESIZE_HANDLE_STYLE} />
                </th>
                <th className={classes.thStatic} />
              </tr>
            </thead>
            <tbody>
              {pageItems.map(env => {
                const name = getDisplayName(env)
                const envType = getEnvTypeName(env)
                const region = formatRegion(env.environmentRegion ?? env.location)
                const count = resourceCounts.get(env.name) ?? 0
                return (
                  <tr key={env.id} className={classes.tr} onClick={() => onEnvClick(env)}>
                    <td className={classes.td}>
                      <div className={classes.nameCell}>
                        <GlobeRegular fontSize={16} style={{ color: tokens.colorBrandForeground2, flexShrink: 0 }} />
                        <Text weight="semibold">{name}</Text>
                      </div>
                    </td>
                    <td className={classes.td} onClick={e => e.stopPropagation()} style={{ width: '40px', padding: '4px 0' }}>
                      <Menu>
                        <MenuTrigger>
                          <Button appearance="subtle" icon={<MoreVerticalRegular />} size="small" title="Options" />
                        </MenuTrigger>
                        <MenuPopover>
                          <MenuList>
                            <MenuItem onClick={() => setMenuEnv(env)}>View Metadata</MenuItem>
                            <MenuItem onClick={() => onEnvClick(env)}>View Resources</MenuItem>
                          </MenuList>
                        </MenuPopover>
                      </Menu>
                    </td>
                    <td className={classes.td}>
                      <EnvironmentBadge name={envType} type={envType} />
                    </td>
                    <td className={classes.td}>
                      {region && <Text style={{ color: tokens.colorNeutralForeground2 }}>{region}</Text>}
                    </td>
                    <td className={classes.td}>
                      <Badge appearance="tint" color="subtle" size="small">{count}</Badge>
                    </td>
                    <td className={classes.td} style={{ textAlign: 'right' }}>
                      <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3 }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className={classes.pagination}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, flex: 1, whiteSpace: 'nowrap' }}>
            {sorted.length === 0
              ? 'No environments'
              : `Showing ${displayStart}–${displayEnd} of ${sorted.length} environment${sorted.length !== 1 ? 's' : ''}`}
          </Caption1>
          <div className={classes.paginationBtns}>
            <Button size="small" appearance="secondary" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</Button>
            <Caption1 style={{ color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'center', alignSelf: 'center' }}>
              Page {currentPage} of {totalPages}
            </Caption1>
            <Button size="small" appearance="secondary" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next →</Button>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d1d1', color: '#323130', backgroundColor: '#ffffff', cursor: 'pointer', marginLeft: '4px' }}
            >
              {ENV_PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </div>
        </div>
      </div>

      {menuEnv && <EnvironmentMetadataModal env={menuEnv} onClose={() => setMenuEnv(null)} />}
    </>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function EnvironmentsView({ environments, allResources, ownerNames }: EnvironmentsViewProps) {
  const [selectedEnv, setSelectedEnv] = useState<ResourceItem | null>(null)

  const resourceCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of allResources) {
      const envId = getEnvironmentIdFromPath(r.id) ?? r.environmentId
      if (envId) m.set(envId, (m.get(envId) ?? 0) + 1)
    }
    return m
  }, [allResources])

  const envResources = useMemo(
    () => selectedEnv ? getEnvResources(allResources, selectedEnv) : [],
    [selectedEnv, allResources],
  )

  if (selectedEnv) {
    return (
      <EnvironmentResourcesView
        environment={selectedEnv}
        resources={envResources}
        ownerNames={ownerNames}
        onBack={() => setSelectedEnv(null)}
      />
    )
  }

  return (
    <EnvironmentListTable
      environments={environments}
      resourceCounts={resourceCounts}
      onEnvClick={setSelectedEnv}
    />
  )
}
