import { useState, useMemo } from 'react'
import { useResizableColumns, RESIZE_HANDLE_STYLE } from '../hooks/useResizableColumns'
import { makeStyles, tokens, Text, Caption1, Button, Badge } from '@fluentui/react-components'
import {
  ArrowLeftRegular,
  PersonRegular,
  ChevronRightRegular,
  ChevronUpRegular,
  ChevronDownRegular,
  ArrowSortRegular,
  GlobeRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getDisplayName, getOwnerFromProperties, getResourceCategory, getEnvironmentIdFromPath, getIsManagedEnvironment } from '../types'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { ResourceDetailPanel } from './ResourceDetailPanel'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'
import { useEnvironmentCapacity } from '../hooks/useGovernance'
import type { EnvironmentCapacity } from '../hooks/useGovernance'

interface UsersViewProps {
  resources: ResourceItem[]
  ownerNames: Map<string, string>
  allEnvironments: ResourceItem[]
}

interface UserEntry {
  id: string
  displayName: string
  resources: ResourceItem[]
  appCount: number
  flowCount: number
  agentCount: number
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
    textAlign: 'left',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
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
  nameCellText: { minWidth: 0 },
  resourceNameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  drillSpace: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  emptyState: {
    paddingTop: `calc(${tokens.spacingVerticalXXL} * 2)`,
    paddingBottom: `calc(${tokens.spacingVerticalXXL} * 2)`,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  countBadges: { display: 'flex', gap: tokens.spacingHorizontalXS },
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
})

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

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  if (mb < 1) return '<1 MB'
  return `${Math.round(mb)} MB`
}

// ── User environment footprint ───────────────────────────────────────────────

function UserEnvironmentFootprint({
  user,
  allEnvironments,
  capacityData,
}: {
  user: UserEntry
  allEnvironments: ResourceItem[]
  capacityData: EnvironmentCapacity[] | undefined
}) {
  const classes = useClasses()

  const rows = useMemo(() => {
    const envIdCounts = new Map<string, number>()
    for (const r of user.resources) {
      const envId = getEnvironmentIdFromPath(r.id) ?? r.environmentId ?? ''
      if (envId) envIdCounts.set(envId, (envIdCounts.get(envId) ?? 0) + 1)
    }
    return [...envIdCounts.entries()]
      .map(([envId, count]) => {
        const envItem = allEnvironments.find(e => e.name === envId)
        const cap = capacityData?.find(c => c.name === envId)
        const db = cap?.capacity.find(c => c.capacityType === 'Database')?.actualConsumption ?? 0
        const file = cap?.capacity.find(c => c.capacityType === 'File')?.actualConsumption ?? 0
        const log = cap?.capacity.find(c => c.capacityType === 'Log')?.actualConsumption ?? 0
        const totalStorage = db + file + log
        return { envId, count, envItem, totalStorage, db, file, log }
      })
      .sort((a, b) => b.count - a.count)
  }, [user.resources, allEnvironments, capacityData])

  if (rows.length === 0) return null

  return (
    <div className={classes.tableWrapper}>
      <div style={{ padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`, borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, backgroundColor: tokens.colorNeutralBackground3, display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
        <GlobeRegular fontSize={14} style={{ color: tokens.colorBrandForeground2 }} />
        <Text size={200} weight="semibold">Environment Footprint</Text>
        <Badge appearance="tint" color="subtle" size="small">{rows.length} environment{rows.length !== 1 ? 's' : ''}</Badge>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className={classes.table}>
          <thead className={classes.thead}>
            <tr>
              <th className={classes.th} style={{ cursor: 'default' }}><div className={classes.thInner}>Environment</div></th>
              <th className={classes.th} style={{ cursor: 'default' }}><div className={classes.thInner}>Status</div></th>
              <th className={classes.th} style={{ cursor: 'default' }}><div className={classes.thInner}>Resources</div></th>
              <th className={classes.th} style={{ cursor: 'default' }}><div className={classes.thInner}>Dataverse Storage</div></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ envId, count, envItem, totalStorage, db, file, log }) => {
              const isManaged = envItem ? getIsManagedEnvironment(envItem) : undefined
              const displayName = envItem ? getDisplayName(envItem) : envId
              const envType = envItem?.environmentType
              return (
                <tr key={envId} style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                  <td className={classes.td}>
                    <div>
                      <Text size={200} weight="semibold">{displayName}</Text>
                      {envType && (
                        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>{envType}</Caption1>
                      )}
                    </div>
                  </td>
                  <td className={classes.td}>
                    {isManaged === undefined ? (
                      <Badge appearance="tint" color="subtle" size="small">Unknown</Badge>
                    ) : isManaged ? (
                      <Badge appearance="tint" color="success" size="small">Managed</Badge>
                    ) : (
                      <Badge appearance="tint" color="warning" size="small">Unmanaged</Badge>
                    )}
                  </td>
                  <td className={classes.td}>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{count}</Text>
                  </td>
                  <td className={classes.td}>
                    {totalStorage > 0 ? (
                      <div>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{formatMB(totalStorage)}</Text>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                          {[
                            db > 0 && `DB: ${formatMB(db)}`,
                            file > 0 && `File: ${formatMB(file)}`,
                            log > 0 && `Log: ${formatMB(log)}`,
                          ].filter(Boolean).join(' · ')}
                        </Caption1>
                      </div>
                    ) : (
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>—</Caption1>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── User resource table ──────────────────────────────────────────────────────

type ResSortField = 'name' | 'type' | 'environment'

function UserResourcesView({
  user,
  allEnvironments,
  onBack,
}: {
  user: UserEntry
  allEnvironments: ResourceItem[]
  onBack: () => void
}) {
  const [sort, setSort] = useState<{ field: ResSortField; dir: SortDir }>({ field: 'name', dir: 'asc' })
  const [selected, setSelected] = useState<ResourceItem | null>(null)
  const classes = useClasses()
  const capacityQuery = useEnvironmentCapacity()

  const envMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const env of allEnvironments) {
      const name = getDisplayName(env)
      m.set(env.name, name)
      m.set(env.id, name)
      m.set(env.name.toLowerCase(), name)
    }
    return m
  }, [allEnvironments])

  const resolveEnv = (r: ResourceItem) => {
    const envId = getEnvironmentIdFromPath(r.id)
    if (envId) return envMap.get(envId) ?? envMap.get(envId.toLowerCase()) ?? envId
    return r.environmentId ? (envMap.get(r.environmentId) ?? r.environmentId) : '—'
  }

  const sorted = [...user.resources].sort((a, b) => {
    let av = '', bv = ''
    if (sort.field === 'name') { av = getDisplayName(a); bv = getDisplayName(b) }
    else if (sort.field === 'type') { av = a.type; bv = b.type }
    else if (sort.field === 'environment') { av = resolveEnv(a); bv = resolveEnv(b) }
    const c = av.localeCompare(bv)
    return sort.dir === 'asc' ? c : -c
  })

  const handleSort = (f: ResSortField) =>
    setSort(p => ({ field: f, dir: p.field === f && p.dir === 'asc' ? 'desc' : 'asc' }))

  return (
    <div className={classes.drillSpace}>
      <div className={classes.breadcrumb}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} size="small" onClick={onBack}>
          All Users
        </Button>
        <Text style={{ color: tokens.colorNeutralForeground3 }}>/</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
          <PersonRegular style={{ color: tokens.colorBrandForeground2, fontSize: '16px' }} />
          <Text weight="semibold">{user.displayName}</Text>
        </div>
        <Badge appearance="tint" color="subtle" size="small">
          {user.resources.length} resource{user.resources.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <UserEnvironmentFootprint
        user={user}
        allEnvironments={allEnvironments}
        capacityData={capacityQuery.data}
      />

      <div className={classes.tableWrapper}>
        <div style={{ overflowX: 'auto' }}>
          <table className={classes.table}>
            <thead className={classes.thead}>
              <tr>
                {(['name', 'type', 'environment'] as ResSortField[]).map(f => (
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
              {sorted.length === 0 ? (
                <tr><td colSpan={3} className={classes.emptyState}><Caption1>No resources</Caption1></td></tr>
              ) : sorted.map(item => (
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
                    <Text style={{ color: tokens.colorNeutralForeground2 }}>{resolveEnv(item)}</Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <ResourceDetailPanel resource={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ── User list ────────────────────────────────────────────────────────────────

type UserSortField = 'name' | 'total' | 'apps' | 'flows' | 'agents'

const USER_HEADERS: { key: UserSortField; label: string }[] = [
  { key: 'name', label: 'User' },
  { key: 'apps', label: 'Apps' },
  { key: 'flows', label: 'Flows' },
  { key: 'agents', label: 'Agents' },
  { key: 'total', label: 'Total' },
]

const USER_PAGE_SIZE_OPTIONS = [25, 50, 100, 150, 200, 300, 500, 1000]

function UserListTable({ users, onUserClick }: { users: UserEntry[]; onUserClick: (u: UserEntry) => void }) {
  const [sort, setSort] = useState<{ field: UserSortField; dir: SortDir }>({ field: 'total', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const classes = useClasses()
  const { widths, getResizeProps } = useResizableColumns({ name: 260, apps: 80, flows: 80, agents: 80, total: 80 })

  const sorted = [...users].sort((a, b) => {
    let av: string | number = '', bv: string | number = ''
    if (sort.field === 'name') { av = a.displayName; bv = b.displayName }
    else if (sort.field === 'apps') { av = a.appCount; bv = b.appCount }
    else if (sort.field === 'flows') { av = a.flowCount; bv = b.flowCount }
    else if (sort.field === 'agents') { av = a.agentCount; bv = b.agentCount }
    else { av = a.resources.length; bv = b.resources.length }
    const c = typeof av === 'number' ? av - (bv as number) : (av as string).localeCompare(bv as string)
    return sort.dir === 'asc' ? c : -c
  })

  const handleSort = (f: UserSortField) => {
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
    <div className={classes.tableWrapper}>
      <div style={{ overflowX: 'auto' }}>
        <table className={classes.table}>
          <colgroup>
            {USER_HEADERS.map(h => <col key={h.key} style={{ width: widths[h.key] }} />)}
            <col style={{ width: 40 }} />
          </colgroup>
          <thead className={classes.thead}>
            <tr>
              {USER_HEADERS.map(h => (
                <th key={h.key} className={classes.th} onClick={() => handleSort(h.key)}>
                  <div className={classes.thInner}>
                    {h.label}
                    <SortIcon active={sort.field === h.key} dir={sort.dir} />
                  </div>
                  <div {...getResizeProps(h.key)} style={RESIZE_HANDLE_STYLE} />
                </th>
              ))}
              <th className={classes.thStatic} />
            </tr>
          </thead>
          <tbody>
            {pageItems.map(user => (
              <tr key={user.id} className={classes.tr} onClick={() => onUserClick(user)}>
                <td className={classes.td}>
                  <div className={classes.nameCell}>
                    <PersonRegular fontSize={16} style={{ color: tokens.colorBrandForeground2, flexShrink: 0 }} />
                    <div className={classes.nameCellText}>
                      <Text weight="semibold" style={{ display: 'block' }}>{user.displayName}</Text>
                    </div>
                  </div>
                </td>
                <td className={classes.td}>
                  <Text style={{ color: tokens.colorNeutralForeground2 }}>{user.appCount || '—'}</Text>
                </td>
                <td className={classes.td}>
                  <Text style={{ color: tokens.colorNeutralForeground2 }}>{user.flowCount || '—'}</Text>
                </td>
                <td className={classes.td}>
                  <Text style={{ color: tokens.colorNeutralForeground2 }}>{user.agentCount || '—'}</Text>
                </td>
                <td className={classes.td}>
                  <Badge appearance="tint" color="subtle" size="small">{user.resources.length}</Badge>
                </td>
                <td className={classes.td} style={{ textAlign: 'right' }}>
                  <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={classes.pagination}>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, flex: 1, whiteSpace: 'nowrap' }}>
          {sorted.length === 0
            ? 'No users'
            : `Showing ${displayStart}–${displayEnd} of ${sorted.length} user${sorted.length !== 1 ? 's' : ''}`}
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
            {USER_PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function UsersView({ resources, ownerNames, allEnvironments }: UsersViewProps) {
  const [selectedUser, setSelectedUser] = useState<UserEntry | null>(null)

  const users = useMemo<UserEntry[]>(() => {
    const map = new Map<string, ResourceItem[]>()
    for (const r of resources) {
      const owner = getOwnerFromProperties(r)
      if (owner === '—') continue
      const existing = map.get(owner)
      if (existing) existing.push(r)
      else map.set(owner, [r])
    }
    return [...map.entries()].map(([id, res]) => ({
      id,
      displayName: resolveOwner(id, ownerNames),
      resources: res,
      appCount: res.filter(r => getResourceCategory(r.type) === 'apps').length,
      flowCount: res.filter(r => getResourceCategory(r.type) === 'flows').length,
      agentCount: res.filter(r => getResourceCategory(r.type) === 'agents').length,
    }))
  }, [resources, ownerNames])

  if (selectedUser) {
    return (
      <UserResourcesView
        user={selectedUser}
        allEnvironments={allEnvironments}
        onBack={() => setSelectedUser(null)}
      />
    )
  }

  return <UserListTable users={users} onUserClick={setSelectedUser} />
}
