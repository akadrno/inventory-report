import { useState, useMemo } from 'react'
import { useResizableColumns, RESIZE_HANDLE_STYLE } from '../hooks/useResizableColumns'
import { makeStyles, tokens, Text, Caption1, Button } from '@fluentui/react-components'
import {
  ChevronUpRegular,
  ChevronDownRegular,
  ArrowSortRegular,
  OpenRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getResourceCategory, getOwnerFromProperties, getDisplayName } from '../types'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { EnvironmentBadge } from './EnvironmentBadge'
import { ResourceDetailPanel } from './ResourceDetailPanel'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'
import { buildEnvMap, resolveEnvironmentName } from '../utils/environment'

export { getResourceCategory }

interface ResourceTableProps {
  resources: ResourceItem[]
  isLoading: boolean
  ownerNames?: Map<string, string>
  allEnvironments?: ResourceItem[]
}

type SortField = 'name' | 'type' | 'environment' | 'owner' | 'region'
type SortDir = 'asc' | 'desc'

const useClasses = makeStyles({
  wrapper: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    overflow: 'hidden',
    boxShadow: tokens.shadow4,
    flexShrink: 0,
  },
  scrollX: {
    overflowX: 'auto',
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
    whiteSpace: 'nowrap',
    position: 'relative' as const,
    ':hover': { color: tokens.colorNeutralForeground1 },
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    overflow: 'hidden',
  },
  thAction: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
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
  tr: {
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorBrandBackground2 },
    ':last-child td': { borderBottom: 'none' },
  },
  td: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  nameCellText: {
    minWidth: 0,
  },
  ownerCell: {
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground2,
  },
  regionCell: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'capitalize',
  },
  skeleton: {
    height: '16px',
    width: '75%',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    animationName: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.4 },
    },
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  paginationBtns: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
  },
  emptyCell: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: `calc(${tokens.spacingVerticalXXL} * 2)`,
    paddingBottom: `calc(${tokens.spacingVerticalXXL} * 2)`,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
})

const HEADERS: { key: SortField; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'environment', label: 'Environment' },
  { key: 'owner', label: 'Owner' },
  { key: 'region', label: 'Region' },
]

const DEFAULT_PAGE_SIZE = 50
const PAGE_SIZE_OPTIONS = [25, 50, 100, 150, 200, 300, 500, 1000]

function SortIcon({ field, sort }: { field: SortField; sort: { field: SortField; dir: SortDir } }) {
  if (sort.field !== field) return <ArrowSortRegular fontSize={14} style={{ opacity: 0.4 }} />
  return sort.dir === 'asc'
    ? <ChevronUpRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
    : <ChevronDownRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
}

function SkeletonRow() {
  const classes = useClasses()
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className={classes.td}>
          <div className={classes.skeleton} />
        </td>
      ))}
    </tr>
  )
}

function resolveOwner(raw: string, ownerNames?: Map<string, string>): string {
  if (raw === '—') return raw
  if (raw.startsWith(SYSTEM_PREFIX)) return 'System'
  return GUID_RE.test(raw) ? (ownerNames?.get(raw) ?? raw) : raw
}

function ResourceIcon({ type }: { type: string }) {
  const category = getResourceCategory(type)
  if (category === 'apps') return <PowerAppsIcon fontSize={16} />
  if (category === 'flows') return <PowerAutomateIcon fontSize={16} />
  if (category === 'agents') return <CopilotStudioIcon fontSize={16} />
  return null
}

export function ResourceTable({ resources, isLoading, ownerNames, allEnvironments }: ResourceTableProps) {
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'name', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [selected, setSelected] = useState<ResourceItem | null>(null)
  const classes = useClasses()
  const { widths, getResizeProps } = useResizableColumns({ name: 260, type: 150, environment: 210, owner: 180, region: 110 })

  const envMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])

  const isSystem = (r: ResourceItem) => {
    const raw = getOwnerFromProperties(r)
    return raw.startsWith(SYSTEM_PREFIX)
  }

  const sorted = [...resources].sort((a, b) => {
    // System-owned resources always sink to the bottom regardless of sort direction.
    const aSystem = isSystem(a)
    const bSystem = isSystem(b)
    if (aSystem !== bSystem) return aSystem ? 1 : -1

    let av = '', bv = ''
    if (sort.field === 'name') { av = getDisplayName(a); bv = getDisplayName(b) }
    else if (sort.field === 'type') { av = a.type; bv = b.type }
    else if (sort.field === 'environment') { av = resolveEnvironmentName(a, envMap); bv = resolveEnvironmentName(b, envMap) }
    else if (sort.field === 'owner') {
      av = resolveOwner(getOwnerFromProperties(a), ownerNames)
      bv = resolveOwner(getOwnerFromProperties(b), ownerNames)
    }
    else if (sort.field === 'region') { av = a.environmentRegion ?? a.location ?? ''; bv = b.environmentRegion ?? b.location ?? '' }
    const cmp = av.localeCompare(bv)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pageItems = sorted.slice(pageStart, pageStart + pageSize)
  const displayStart = sorted.length === 0 ? 0 : pageStart + 1
  const displayEnd = Math.min(pageStart + pageSize, sorted.length)

  const handleSort = (field: SortField) => {
    setSort(prev => ({ field, dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  return (
    <>
      <div className={classes.wrapper}>
        <div className={classes.scrollX}>
          <table className={classes.table}>
            <colgroup>
              <col style={{ width: widths.name }} />
              <col style={{ width: widths.type }} />
              <col style={{ width: widths.environment }} />
              <col style={{ width: widths.owner }} />
              <col style={{ width: widths.region }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead className={classes.thead}>
              <tr>
                {HEADERS.map(h => (
                  <th key={h.key} className={classes.th} onClick={() => handleSort(h.key)}>
                    <div className={classes.thInner}>
                      {h.label}
                      <SortIcon field={h.key} sort={sort} />
                    </div>
                    <div {...getResizeProps(h.key)} style={RESIZE_HANDLE_STYLE} />
                  </th>
                ))}
                <th className={classes.thAction} />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : pageItems.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className={classes.emptyCell}>
                        <Caption1>No resources found</Caption1>
                      </td>
                    </tr>
                  )
                  : pageItems.map(item => {
                    const displayName = getDisplayName(item)
                    const envName = resolveEnvironmentName(item, envMap)
                    const rawOwner = getOwnerFromProperties(item)
                    const owner = resolveOwner(rawOwner, ownerNames)
                    const region = item.environmentRegion ?? item.location ?? '—'
                    return (
                      <tr key={item.id} className={classes.tr} onClick={() => setSelected(item)}>
                        <td className={classes.td}>
                          <div className={classes.nameCell}>
                            <ResourceIcon type={item.type} />
                            <div className={classes.nameCellText}>
                              <Text weight="semibold" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayName}>
                                {displayName}
                              </Text>
                            </div>
                          </div>
                        </td>
                        <td className={classes.td}>
                          <ResourceTypeBadge type={item.type} kind={item.kind} />
                        </td>
                        <td className={classes.td}>
                          <EnvironmentBadge name={envName} type={item.environmentType} />
                        </td>
                        <td className={classes.td}>
                          <Text className={classes.ownerCell} title={owner}>{owner}</Text>
                        </td>
                        <td className={classes.td}>
                          <Text className={classes.regionCell}>{region}</Text>
                        </td>
                        <td className={classes.td} style={{ textAlign: 'right' }}>
                          <OpenRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3 }} />
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        {!isLoading && (
          <div className={classes.pagination}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, flex: 1, whiteSpace: 'nowrap' }}>
              {sorted.length === 0
                ? 'No resources'
                : `Showing ${displayStart}–${displayEnd} of ${sorted.length} resource${sorted.length !== 1 ? 's' : ''}`}
            </Caption1>
            <div className={classes.paginationBtns}>
              <Button
                appearance="secondary"
                size="small"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >← Prev</Button>
              <Caption1 style={{ color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'center', alignSelf: 'center' }}>
                Page {currentPage} of {totalPages}
              </Caption1>
              <Button
                appearance="secondary"
                size="small"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >Next →</Button>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                style={{
                  fontSize: '12px', padding: '4px 8px', borderRadius: '4px',
                  border: '1px solid #d1d1d1', color: '#323130', backgroundColor: '#ffffff',
                  cursor: 'pointer', marginLeft: '4px',
                }}
              >
                {PAGE_SIZE_OPTIONS.map(n => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ResourceDetailPanel
          resource={selected}
          onClose={() => setSelected(null)}
          allEnvironments={allEnvironments}
        />
      )}
    </>
  )
}
