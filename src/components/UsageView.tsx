import { useMemo, useState } from 'react'
import { makeStyles, tokens, Text, Caption1 } from '@fluentui/react-components'
import { ChartMultipleRegular } from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getDisplayName, getResourceCategory, getOwnerFromProperties } from '../types'
import { useThemeMode } from '../context/ThemeContext'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'
import { buildEnvMap, resolveEnvironmentName } from '../utils/environment'
import { formatLocalDateTime } from '../utils/format'
import { ResourceDetailPanel } from './ResourceDetailPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'apps' | 'flows' | 'agents'

interface UsageViewProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  ownerNames: Map<string, string>
}

const PRODUCT_META: Record<Category, {
  label: string
  category: Category
  icon: React.ReactNode
  color: string
  countNoun: string
  topNoun: string
}> = {
  apps: {
    label: 'Power Apps', category: 'apps',
    icon: <PowerAppsIcon fontSize={22} />, color: '#742774',
    countNoun: 'Apps', topNoun: 'Top apps by recent activity',
  },
  flows: {
    label: 'Power Automate', category: 'flows',
    icon: <PowerAutomateIcon fontSize={22} />, color: '#0066ff',
    countNoun: 'Flows', topNoun: 'Top flows by recent activity',
  },
  agents: {
    label: 'Copilot Studio', category: 'agents',
    icon: <CopilotStudioIcon fontSize={22} />, color: '#19c4d4',
    countNoun: 'Agents', topNoun: 'Top agents by recent activity',
  },
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STROKE1 = tokens.colorNeutralStroke2
const MUTED = tokens.colorNeutralForeground3
const TEXT = tokens.colorNeutralForeground1
const CARD_BG = tokens.colorNeutralBackground1
const TH_BG = tokens.colorNeutralBackground3
const ACTIVE_BLUE = tokens.colorBrandForeground1
const HOVER_BG = tokens.colorSubtleBackgroundHover
const BADGE_BG = tokens.colorNeutralBackground3

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '16px' },
  introNote: {
    backgroundColor: HOVER_BG,
    border: `1px solid ${tokens.colorBrandStroke2}`,
    borderRadius: '4px',
    padding: '10px 14px',
    fontSize: '12px',
    color: tokens.colorBrandForeground2,
    display: 'flex', alignItems: 'flex-start', gap: '8px',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    '@media (max-width: 960px)': { gridTemplateColumns: '1fr' },
  },
  productCard: {
    backgroundColor: CARD_BG,
    border: `1px solid ${STROKE1}`,
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  productHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  productTitle: { fontSize: '14px', fontWeight: 600, color: TEXT },
  metricBlock: {
    borderLeftWidth: '3px', borderLeftStyle: 'solid',
    paddingLeft: '10px',
  },
  metricLabel: { fontSize: '12px', color: MUTED, display: 'block' },
  metricValue: { fontSize: '28px', fontWeight: 700, color: TEXT, lineHeight: '1.1', display: 'block' },
  trendsBox: {
    border: `1px solid ${STROKE1}`,
    borderRadius: '4px',
    padding: '12px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  trendsTitle: { fontSize: '12px', color: MUTED },
  topList: {
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  topListTitle: { fontSize: '12px', color: MUTED, marginBottom: '4px' },
  topItem: {
    border: `1px solid ${STROKE1}`,
    borderRadius: '4px',
    padding: '8px 10px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '8px',
    cursor: 'pointer',
    ':hover': { backgroundColor: HOVER_BG },
  },
  topItemBody: { minWidth: 0, flex: 1 },
  topItemName: { fontSize: '13px', fontWeight: 600, color: TEXT, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  topItemSub: { fontSize: '11px', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' },
  topItemBadge: {
    backgroundColor: BADGE_BG,
    color: TEXT,
    border: `1px solid ${STROKE1}`,
    borderRadius: '999px',
    fontSize: '11px',
    padding: '2px 8px',
    fontWeight: 600,
    flexShrink: 0,
  },
  tableCard: {
    backgroundColor: CARD_BG,
    border: `1px solid ${STROKE1}`,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex', gap: '4px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    padding: '4px 12px 0',
  },
  tabButton: {
    border: 'none', background: 'transparent',
    padding: '10px 14px',
    fontSize: '13px', fontWeight: 600, color: MUTED,
    cursor: 'pointer',
    borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: 'transparent',
    marginBottom: '-1px',
  },
  tabButtonActive: {
    border: 'none', background: 'transparent',
    padding: '10px 14px',
    fontSize: '13px', fontWeight: 600, color: ACTIVE_BLUE,
    cursor: 'pointer',
    borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: ACTIVE_BLUE,
    marginBottom: '-1px',
  },
  tableCaption: {
    padding: '12px 16px 8px',
    fontSize: '12px', color: MUTED,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 16px', textAlign: 'left',
    fontWeight: 600, fontSize: '12px', color: TEXT,
    backgroundColor: TH_BG,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 16px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    verticalAlign: 'middle',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  tdMuted: {
    padding: '10px 16px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    verticalAlign: 'middle', color: MUTED,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  rowHover: {
    ':hover td': { backgroundColor: HOVER_BG },
  },
  emptyRow: {
    padding: '32px 16px',
    textAlign: 'center', color: MUTED, fontSize: '13px',
  },
})

// ── Helpers: time extraction ──────────────────────────────────────────────────

function getDate(r: ResourceItem, keys: string[]): Date | undefined {
  const p = r.properties
  if (!p) return undefined
  for (const k of keys) {
    const v = p[k]
    if (typeof v === 'string' && v) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) return d
    }
  }
  return undefined
}

const CREATED_KEYS = ['createdTime', 'createdOn', 'createdAt', 'createdDateTime']
const MODIFIED_KEYS = ['lastModifiedTime', 'modifiedOn', 'lastModifiedDateTime', 'modifiedTime', 'lastLaunchedTime']

function getCreatedDate(r: ResourceItem): Date | undefined { return getDate(r, CREATED_KEYS) }
function getModifiedDate(r: ResourceItem): Date | undefined { return getDate(r, MODIFIED_KEYS) }

function resolveOwnerName(r: ResourceItem, ownerNames: Map<string, string>): string {
  const raw = getOwnerFromProperties(r)
  if (raw === '—') return raw
  if (raw.startsWith(SYSTEM_PREFIX)) return 'System'
  if (GUID_RE.test(raw)) return ownerNames.get(raw) ?? raw
  return raw
}

// 28-day creation histogram, oldest on the left.
function buildCreationTrend(resources: ResourceItem[]): { buckets: number[]; labels: string[] } {
  const buckets = new Array(28).fill(0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const r of resources) {
    const d = getCreatedDate(r)
    if (!d) continue
    const days = Math.floor((today.getTime() - d.getTime()) / 86400000)
    if (days >= 0 && days < 28) buckets[27 - days]++
  }
  const labels: string[] = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
  }
  return { buckets, labels }
}

// ── TrendsChart: tiny inline SVG bar chart ────────────────────────────────────

function TrendsChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values)
  const width = 280
  const height = 80
  const barGap = 1
  const barWidth = (width - barGap * (values.length - 1)) / values.length
  const yTicks = 3

  // Y-axis ticks: 0, max/2, max
  const ticks: number[] = []
  for (let i = 0; i <= yTicks; i++) ticks.push(Math.round((max / yTicks) * i))

  return (
    <svg viewBox={`0 0 ${width + 30} ${height + 24}`} width="100%" height="120" preserveAspectRatio="none">
      {/* Y-axis labels */}
      {ticks.map((t, i) => {
        const y = height - (t / max) * height
        return (
          <g key={i}>
            <line x1={28} y1={y} x2={width + 28} y2={y} stroke={tokens.colorNeutralStroke2} strokeWidth={1} />
            <text x={24} y={y + 3} fontSize="9" fill={MUTED} textAnchor="end">{t}</text>
          </g>
        )
      })}
      {/* Bars */}
      {values.map((v, i) => {
        const h = (v / max) * height
        const x = 28 + i * (barWidth + barGap)
        const y = height - h
        return (
          <rect key={i}
            x={x} y={y}
            width={Math.max(1, barWidth)} height={Math.max(0, h)}
            fill={color}
          >
            <title>{labels[i]}: {v}</title>
          </rect>
        )
      })}
      {/* X-axis end labels */}
      <text x={28} y={height + 14} fontSize="9" fill={MUTED}>{labels[0]}</text>
      <text x={width + 28} y={height + 14} fontSize="9" fill={MUTED} textAnchor="end">{labels[labels.length - 1]}</text>
    </svg>
  )
}

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
  category: Category
  resources: ResourceItem[]
  envMap: Map<string, string>
  onSelect: (r: ResourceItem) => void
}

function ProductCard({ category, resources, envMap, onSelect }: ProductCardProps) {
  const classes = useClasses()
  const meta = PRODUCT_META[category]

  const ofCategory = useMemo(
    () => resources.filter(r => getResourceCategory(r.type) === category),
    [resources, category],
  )

  const { buckets, labels } = useMemo(() => buildCreationTrend(ofCategory), [ofCategory])

  // Top 3 by most recent modification (or creation if no modification).
  const topItems = useMemo(() => {
    return [...ofCategory]
      .map(r => ({
        r,
        when: getModifiedDate(r) ?? getCreatedDate(r) ?? new Date(0),
      }))
      .sort((a, b) => b.when.getTime() - a.when.getTime())
      .slice(0, 3)
  }, [ofCategory])

  return (
    <div className={classes.productCard}>
      <div className={classes.productHeader}>
        {meta.icon}
        <Text className={classes.productTitle}>{meta.label}</Text>
      </div>

      <div className={classes.metricBlock} style={{ borderLeftColor: meta.color }}>
        <Caption1 className={classes.metricLabel}>{meta.countNoun}</Caption1>
        <Text className={classes.metricValue}>{ofCategory.length.toLocaleString()}</Text>
      </div>

      <div className={classes.trendsBox}>
        <Caption1 className={classes.trendsTitle}>Created (last 28 days)</Caption1>
        <TrendsChart values={buckets} labels={labels} color={meta.color} />
      </div>

      <div className={classes.topList}>
        <Caption1 className={classes.topListTitle}>{meta.topNoun}</Caption1>
        {topItems.length === 0 ? (
          <Caption1 style={{ color: MUTED, padding: '8px 0' }}>No resources</Caption1>
        ) : topItems.map(({ r, when }) => {
          const envName = resolveEnvironmentName(r, envMap)
          return (
            <div key={r.id} className={classes.topItem} onClick={() => onSelect(r)} role="button">
              <div className={classes.topItemBody}>
                <Text className={classes.topItemName}>{getDisplayName(r)}</Text>
                <Caption1 className={classes.topItemSub}>
                  Environment: {envName}
                </Caption1>
              </div>
              <span className={classes.topItemBadge} title={when.getTime() > 0 ? formatLocalDateTime(when.toISOString()) : 'No date'}>
                {when.getTime() > 0
                  ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : '—'}
              </span>
            </div>
          )
        })}
        {topItems.length === 3 && ofCategory.length > 3 && (
          <Caption1 style={{ color: MUTED, paddingTop: '4px' }}>+ {(ofCategory.length - 3).toLocaleString()} more</Caption1>
        )}
      </div>
    </div>
  )
}

// ── ResourceListTable ─────────────────────────────────────────────────────────

interface ListTableProps {
  resources: ResourceItem[]
  ownerNames: Map<string, string>
  envMap: Map<string, string>
  onSelect: (r: ResourceItem) => void
}

function ResourceListTable({ resources, ownerNames, envMap, onSelect }: ListTableProps) {
  const classes = useClasses()

  const sorted = useMemo(() => {
    return [...resources].sort((a, b) => {
      const at = getModifiedDate(a) ?? getCreatedDate(a) ?? new Date(0)
      const bt = getModifiedDate(b) ?? getCreatedDate(b) ?? new Date(0)
      return bt.getTime() - at.getTime()
    })
  }, [resources])

  const top = sorted.slice(0, 20)

  if (top.length === 0) {
    return <div className={classes.emptyRow}>No resources of this type</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={classes.table}>
        <thead>
          <tr>
            <th className={classes.th}>Name</th>
            <th className={classes.th}>Type</th>
            <th className={classes.th}>Owner</th>
            <th className={classes.th}>Last modified</th>
            <th className={classes.th}>Environment</th>
          </tr>
        </thead>
        <tbody>
          {top.map(r => {
            const modified = getModifiedDate(r) ?? getCreatedDate(r)
            return (
              <tr key={r.id} className={classes.rowHover} onClick={() => onSelect(r)}>
                <td className={classes.td}>
                  <Text style={{ fontSize: '13px', fontWeight: 600 }}>{getDisplayName(r)}</Text>
                </td>
                <td className={classes.td}>
                  <ResourceTypeBadge type={r.type} kind={r.kind} />
                </td>
                <td className={classes.tdMuted}>{resolveOwnerName(r, ownerNames)}</td>
                <td className={classes.tdMuted}>
                  {modified ? formatLocalDateTime(modified.toISOString()) : '—'}
                </td>
                <td className={classes.tdMuted}>{resolveEnvironmentName(r, envMap)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sorted.length > top.length && (
        <Caption1 style={{ display: 'block', padding: '8px 16px', color: MUTED }}>
          Showing top {top.length} of {sorted.length}. Open the Inventory section to see all.
        </Caption1>
      )}
    </div>
  )
}

// ── Summary tab section (Apps / Flows / Agents tab bar) ──────────────────────

function SummaryTabSection({ resources, ownerNames, envMap, onSelect }: {
  resources: ResourceItem[]
  ownerNames: Map<string, string>
  envMap: Map<string, string>
  onSelect: (r: ResourceItem) => void
}) {
  const classes = useClasses()
  const [tab, setTab] = useState<Category>('apps')

  const filtered = useMemo(
    () => resources.filter(r => getResourceCategory(r.type) === tab),
    [resources, tab],
  )

  return (
    <div className={classes.tableCard}>
      <div className={classes.tabBar}>
        <button
          className={tab === 'apps' ? classes.tabButtonActive : classes.tabButton}
          onClick={() => setTab('apps')}
        >Apps</button>
        <button
          className={tab === 'flows' ? classes.tabButtonActive : classes.tabButton}
          onClick={() => setTab('flows')}
        >Flows</button>
        <button
          className={tab === 'agents' ? classes.tabButtonActive : classes.tabButton}
          onClick={() => setTab('agents')}
        >Agents</button>
      </div>
      <Caption1 className={classes.tableCaption}>
        Showing {Math.min(20, filtered.length)} of {filtered.length} {PRODUCT_META[tab].countNoun.toLowerCase()}, sorted by most recently modified.
      </Caption1>
      <ResourceListTable resources={filtered} ownerNames={ownerNames} envMap={envMap} onSelect={onSelect} />
    </div>
  )
}

// ── Main UsageView ────────────────────────────────────────────────────────────

export function UsageView({ allResources, allEnvironments, ownerNames }: UsageViewProps) {
  const classes = useClasses()
  const envMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])
  const [selected, setSelected] = useState<ResourceItem | null>(null)
  const { mode } = useThemeMode()
  // In dark mode the banner's light-blue pastel is replaced with a very light
  // blue text on a deeper blue background so it reads clearly against the
  // dark chrome (per request).
  const introNoteStyle = mode === 'dark'
    ? { backgroundColor: '#0a2540', borderColor: '#1e3a5f', color: '#cfe4fa' }
    : undefined

  return (
    <div className={classes.root}>
      <div className={classes.introNote} style={introNoteStyle}>
        <ChartMultipleRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Telemetry-grade usage data (users, runs, sessions) isn't exposed by the Power Platform inventory API.
          Metrics here are derived from inventory data — counts, creation trends, and recent activity.
        </span>
      </div>
      <div className={classes.productGrid}>
        <ProductCard category="apps"   resources={allResources} envMap={envMap} onSelect={setSelected} />
        <ProductCard category="flows"  resources={allResources} envMap={envMap} onSelect={setSelected} />
        <ProductCard category="agents" resources={allResources} envMap={envMap} onSelect={setSelected} />
      </div>
      <SummaryTabSection resources={allResources} ownerNames={ownerNames} envMap={envMap} onSelect={setSelected} />
      {selected && (
        <ResourceDetailPanel resource={selected} onClose={() => setSelected(null)} allEnvironments={allEnvironments} />
      )}
    </div>
  )
}
