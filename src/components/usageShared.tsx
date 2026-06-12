import { makeStyles, tokens, Text, Caption1 } from '@fluentui/react-components'
import type { ResourceItem } from '../types'
import { getResourceCategory } from '../types'
import { isM365BuilderAgent } from '../utils/resourceMetadata'
import type { SignInRecord } from '../api/signInsApi'

// ── Shared usage analytics + presentation kit ───────────────────────────────
// Helpers and pretty primitives shared by the Usage Overview and the per-product
// (Apps / Flows / Agents) drill-in views. Everything is token-based so it adapts
// to light/dark. Product accent colors match the home hero for visual continuity.

export type Category = 'apps' | 'flows' | 'agents'

export const PRODUCT: Record<Category, { label: string; accent: string }> = {
  apps:   { label: 'Apps',   accent: '#b07cff' },
  flows:  { label: 'Flows',  accent: '#4aa8ff' },
  agents: { label: 'Agents', accent: '#3ad1c4' },
}

// Inline accent tint + left bar for cinematic stat cards — matches the KpiCard
// look (corner glow + accent edge) without adding extra DOM. Pass a hex accent.
export function accentGlowStyle(accent: string): React.CSSProperties {
  return {
    borderLeft: `3px solid ${accent}`,
    backgroundImage: `radial-gradient(130% 130% at 100% 0%, ${accent}22, transparent 55%)`,
  }
}

// ── Time helpers ─────────────────────────────────────────────────────────────

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

export function getCreatedDate(r: ResourceItem): Date | undefined { return getDate(r, CREATED_KEYS) }
export function getModifiedDate(r: ResourceItem): Date | undefined { return getDate(r, MODIFIED_KEYS) }
export function getActivityDate(r: ResourceItem): Date | undefined { return getModifiedDate(r) ?? getCreatedDate(r) }

export function daysSince(d: Date | undefined): number | undefined {
  if (!d) return undefined
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

// ── Inventory health metrics ─────────────────────────────────────────────────

export interface InventoryHealth {
  total: number
  active30: number       // changed in the last 30 days
  stale90: number        // no change in 90+ days (and we know a date)
  new7: number           // created in the last 7 days
  ownerless: number      // no resolvable owner
}

function hasOwner(r: ResourceItem): boolean {
  const p = r.properties
  if (!p) return false
  const v = p['owner'] ?? p['createdBy'] ?? p['ownerId'] ?? p['createdByUser'] ?? p['author']
  return v != null && v !== '' && v !== '—'
}

export function inventoryHealth(resources: ResourceItem[]): InventoryHealth {
  let active30 = 0, stale90 = 0, new7 = 0, ownerless = 0
  for (const r of resources) {
    const act = daysSince(getActivityDate(r))
    if (act !== undefined) {
      if (act <= 30) active30++
      if (act >= 90) stale90++
    }
    const created = daysSince(getCreatedDate(r))
    if (created !== undefined && created <= 7) new7++
    if (!hasOwner(r)) ownerless++
  }
  return { total: resources.length, active30, stale90, new7, ownerless }
}

/** Resources sorted by most recent activity (modified → created). */
export function byRecentActivity(resources: ResourceItem[]): ResourceItem[] {
  return [...resources].sort((a, b) => {
    const at = getActivityDate(a)?.getTime() ?? 0
    const bt = getActivityDate(b)?.getTime() ?? 0
    return bt - at
  })
}

// ── Product subtype breakdown (for the drill-in segment bars) ────────────────

export function subtypeBreakdown(resources: ResourceItem[], category: Category): { label: string; value: number }[] {
  const counts = new Map<string, number>()
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1)
  for (const r of resources) {
    const t = r.type.toLowerCase()
    if (category === 'apps') {
      if (t.includes('canvas')) bump('Canvas')
      else if (t.includes('modeldriven') || t.includes('model')) bump('Model-driven')
      else if (t.includes('codeapp')) bump('Code apps')
      else bump('Other')
    } else if (category === 'flows') {
      if (t.includes('m365agentflow')) bump('Workflow agent flows')
      else if (t.includes('agentflow')) bump('Agent flows')
      else if (t.includes('desktop') || t.includes('uiflow')) bump('Desktop flows')
      else if (t.includes('logic')) bump('Logic apps')
      else bump('Cloud flows')
    } else {
      const createdIn = String(r.properties?.['createdIn'] ?? r.properties?.['CreatedIn'] ?? '').toLowerCase()
      if (isM365BuilderAgent(r)) bump('M365 Agent Builder')
      else if (createdIn) bump('Copilot Studio')
      else bump('Copilot agents')
    }
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

/** Top owners (resolved display names) by resource count. */
export function topOwners(
  resources: ResourceItem[],
  resolve: (r: ResourceItem) => string,
  limit = 6,
): { label: string; value: number }[] {
  const m = new Map<string, number>()
  for (const r of resources) {
    const name = resolve(r)
    if (!name || name === '—' || name === 'System') continue
    m.set(name, (m.get(name) ?? 0) + 1)
  }
  return [...m.entries()].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, limit)
}

/** Top environments by resource count. */
export function topEnvironments(
  resources: ResourceItem[],
  resolveEnv: (r: ResourceItem) => string,
  limit = 6,
): { label: string; value: number }[] {
  const m = new Map<string, number>()
  for (const r of resources) {
    const name = resolveEnv(r)
    if (!name || name === '—') continue
    m.set(name, (m.get(name) ?? 0) + 1)
  }
  return [...m.entries()].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, limit)
}

// ── Sign-in (Entra) usage analytics ──────────────────────────────────────────
// Cached sign-ins attribute to first-party product app names (Power Apps,
// Power Automate, Copilot Studio), so usage is reported at the PRODUCT level.

export function classifySignIn(appDisplayName?: string): Category | 'other' {
  const s = (appDisplayName ?? '').toLowerCase()
  if (!s) return 'other'
  if (s.includes('copilot studio') || s.includes('virtual agent') || s.includes('power virtual')) return 'agents'
  if (s.includes('power automate') || s.includes('microsoft flow') || s.includes('flow')) return 'flows'
  if (s.includes('power apps') || s.includes('powerapps')) return 'apps'
  return 'other'
}

export interface SignInStats {
  total: number
  uniqueUsers: number
  successRate: number | null   // 0..100, null when no records
  countries: number
}

export function signInStats(records: SignInRecord[]): SignInStats {
  const users = new Set<string>()
  const countries = new Set<string>()
  let ok = 0
  for (const r of records) {
    if (r.userPrincipalName) users.add(r.userPrincipalName.toLowerCase())
    else if (r.userDisplayName) users.add(r.userDisplayName.toLowerCase())
    const c = r.location?.countryOrRegion
    if (c) countries.add(c)
    if ((r.status?.errorCode ?? 0) === 0) ok++
  }
  return {
    total: records.length,
    uniqueUsers: users.size,
    successRate: records.length ? Math.round((ok / records.length) * 100) : null,
    countries: countries.size,
  }
}

/** Records attributable to one product category (by app display name). */
export function signInsForCategory(records: SignInRecord[], category: Category): SignInRecord[] {
  return records.filter(r => classifySignIn(r.appDisplayName) === category)
}

/** Records attributable to any Power Platform product. */
export function powerPlatformSignIns(records: SignInRecord[]): SignInRecord[] {
  return records.filter(r => classifySignIn(r.appDisplayName) !== 'other')
}

/** Daily sign-in counts for the last `days` days, oldest first. */
export function dailyTrend(records: SignInRecord[], days = 30): { buckets: number[]; labels: string[] } {
  const buckets = new Array(days).fill(0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (const r of records) {
    const d = new Date(r.createdDateTime)
    if (isNaN(d.getTime())) continue
    const ago = Math.floor((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
    if (ago >= 0 && ago < days) buckets[days - 1 - ago]++
  }
  const labels: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
  }
  return { buckets, labels }
}

/** Creation histogram for inventory resources, last `days` days, oldest first. */
export function creationTrend(resources: ResourceItem[], days = 28): { buckets: number[]; labels: string[] } {
  const buckets = new Array(days).fill(0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (const r of resources) {
    const d = getCreatedDate(r)
    if (!d) continue
    const ago = Math.floor((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
    if (ago >= 0 && ago < days) buckets[days - 1 - ago]++
  }
  const labels: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
  }
  return { buckets, labels }
}

export function countBy(
  records: SignInRecord[],
  pick: (r: SignInRecord) => string | undefined,
  limit = 6,
  fallback = 'Unknown',
): { label: string; value: number }[] {
  const m = new Map<string, number>()
  for (const r of records) {
    const v = pick(r)?.trim() || fallback
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return [...m.entries()].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, limit)
}

// ── Presentation primitives ──────────────────────────────────────────────────

const useStyles = makeStyles({
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
  },
  kpiCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: tokens.shadow8,
    transition: 'transform 0.16s ease, box-shadow 0.16s ease',
    ':hover': { transform: 'translateY(-2px)', boxShadow: tokens.shadow16 },
  },
  kpiGlow: {
    position: 'absolute', top: '-40px', right: '-30px',
    width: '120px', height: '120px', borderRadius: '50%',
    filter: 'blur(40px)', opacity: 0.32, pointerEvents: 'none',
  },
  kpiAccent: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '3px' },
  kpiTop: { display: 'flex', alignItems: 'center', gap: '8px' },
  kpiLabel: { fontSize: '12px', color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.4px' },
  kpiValue: { fontSize: '30px', fontWeight: 700, lineHeight: 1, color: tokens.colorNeutralForeground1, fontVariantNumeric: 'tabular-nums' },
  kpiSub: { fontSize: '12px', color: tokens.colorNeutralForeground3 },

  section: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: tokens.shadow8,
  },
  sectionHead: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px',
    backgroundImage: `linear-gradient(180deg, ${tokens.colorNeutralBackground2}, transparent)`,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    fontSize: '14px', fontWeight: 600, color: tokens.colorNeutralForeground1,
  },
  sectionBody: { padding: '14px 16px' },

  barRow: { display: 'flex', flexDirection: 'column', gap: '10px' },
  barItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  barTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  barLabel: { fontSize: '13px', color: tokens.colorNeutralForeground1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barValue: { fontSize: '13px', fontWeight: 600, color: tokens.colorNeutralForeground1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  barTrack: { height: '6px', borderRadius: '999px', backgroundColor: tokens.colorNeutralBackground3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '999px' },

  segWrap: { display: 'flex', flexDirection: 'column', gap: '10px' },
  segBar: { display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden', backgroundColor: tokens.colorNeutralBackground3 },
  segLegend: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  segLegendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: tokens.colorNeutralForeground2 },
  segDot: { width: '9px', height: '9px', borderRadius: '2px', flexShrink: 0 },

  empty: { padding: '20px', textAlign: 'center', color: tokens.colorNeutralForeground3, fontSize: '13px' },

  // Trend chart — pure HTML/flex so axis text never distorts on resize.
  trendWrap: { display: 'flex', flexDirection: 'column', gap: '4px' },
  trendChart: { position: 'relative', paddingLeft: '30px' },
  trendGridLine: { position: 'absolute', left: '30px', right: 0, height: '1px', backgroundColor: tokens.colorNeutralStroke2 },
  trendYLabel: {
    position: 'absolute', left: 0, width: '26px', textAlign: 'right',
    fontSize: '9px', lineHeight: 1, color: tokens.colorNeutralForeground3,
    transform: 'translateY(-50%)', fontVariantNumeric: 'tabular-nums',
  },
  trendBars: { position: 'absolute', left: '30px', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', gap: '1px' },
  trendCol: { flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end' },
  trendBar: { width: '100%', borderTopLeftRadius: '1px', borderTopRightRadius: '1px' },
  trendXLabels: { display: 'flex', justifyContent: 'space-between', paddingLeft: '30px', fontSize: '9px', color: tokens.colorNeutralForeground3 },
  trendRow: { display: 'flex', alignItems: 'stretch', gap: '4px' },
  trendYAxis: {
    writingMode: 'vertical-rl', transform: 'rotate(180deg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, lineHeight: 1,
    fontSize: '10px', fontWeight: 600, color: tokens.colorNeutralForeground2,
  },
  trendBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  trendXAxis: {
    textAlign: 'center', paddingLeft: '30px', marginTop: '3px',
    fontSize: '10px', fontWeight: 600, color: tokens.colorNeutralForeground2,
  },
})

export function KpiCard({ accent, label, value, sub }: {
  accent?: string; label: string; value: React.ReactNode; sub?: string
}) {
  const s = useStyles()
  return (
    <div
      className={s.kpiCard}
      style={accent ? { backgroundImage: `radial-gradient(135% 130% at 100% 0%, ${accent}22, transparent 55%)` } : undefined}
    >
      {accent && <div className={s.kpiGlow} style={{ background: accent }} />}
      {accent && <div className={s.kpiAccent} style={{ backgroundColor: accent }} />}
      <span className={s.kpiLabel}>{label}</span>
      <span className={s.kpiValue}>{value}</span>
      {sub && <span className={s.kpiSub}>{sub}</span>}
    </div>
  )
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  const s = useStyles()
  return <div className={s.kpiRow}>{children}</div>
}

export function SectionCard({ title, icon, action, children }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode
}) {
  const s = useStyles()
  return (
    <div className={s.section}>
      <div className={s.sectionHead}>
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        {action}
      </div>
      <div className={s.sectionBody}>{children}</div>
    </div>
  )
}

export function BarList({ items, accent, emptyText = 'No data', valueSuffix }: {
  items: { label: string; value: number; hint?: string }[]
  accent: string
  emptyText?: string
  valueSuffix?: string
}) {
  const s = useStyles()
  if (items.length === 0) return <div className={s.empty}>{emptyText}</div>
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div className={s.barRow}>
      {items.map((it, i) => (
        <div key={it.label + i} className={s.barItem}>
          <div className={s.barTop}>
            <span className={s.barLabel} title={it.label}>{it.label}</span>
            <span className={s.barValue}>{it.value.toLocaleString()}{valueSuffix}</span>
          </div>
          <div className={s.barTrack}>
            <div className={s.barFill} style={{ width: `${(it.value / max) * 100}%`, backgroundColor: accent }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SegmentBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const s = useStyles()
  const total = segments.reduce((sum, x) => sum + x.value, 0)
  if (total === 0) return <div className={s.empty}>No data</div>
  return (
    <div className={s.segWrap}>
      <div className={s.segBar}>
        {segments.filter(x => x.value > 0).map((x, i) => (
          <div key={i} style={{ width: `${(x.value / total) * 100}%`, backgroundColor: x.color }} title={`${x.label}: ${x.value}`} />
        ))}
      </div>
      <div className={s.segLegend}>
        {segments.map((x, i) => (
          <span key={i} className={s.segLegendItem}>
            <span className={s.segDot} style={{ backgroundColor: x.color }} />
            {x.label} · <strong style={{ color: tokens.colorNeutralForeground1 }}>{x.value.toLocaleString()}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Tiny responsive bar chart for sign-in / creation trends. Rendered with
 * HTML/flex (not a stretched SVG) so the axis labels stay crisp and undistorted
 * at any card width — bars flex to fill, text keeps its natural size.
 */
export function TrendBars({ values, labels, accent, height = 110, yLabel, xLabel }: {
  values: number[]; labels: string[]; accent: string; height?: number
  yLabel?: string; xLabel?: string
}) {
  const s = useStyles()
  const max = Math.max(1, ...values)
  const peakIdx = values.indexOf(max)
  const ticks = [max, Math.round(max / 2), 0] // top → bottom
  return (
    <div className={s.trendRow}>
      {yLabel && <div className={s.trendYAxis} style={{ height: `${height}px` }}>{yLabel}</div>}
      <div className={s.trendBody}>
        <div className={s.trendChart} style={{ height: `${height}px` }}>
          {ticks.map((t, i) => {
            const top = `${(i / (ticks.length - 1)) * 100}%`
            return (
              <div key={i}>
                <span className={s.trendYLabel} style={{ top }}>{t.toLocaleString()}</span>
                <div className={s.trendGridLine} style={{ top }} />
              </div>
            )
          })}
          <div className={s.trendBars}>
            {values.map((v, i) => (
              <div key={i} className={s.trendCol} title={`${labels[i]}: ${v}`}>
                <div
                  className={s.trendBar}
                  style={{ height: `${(v / max) * 100}%`, backgroundColor: accent, opacity: i === peakIdx ? 1 : 0.78 }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className={s.trendXLabels}>
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
        {xLabel && <div className={s.trendXAxis}>{xLabel}</div>}
      </div>
    </div>
  )
}

/** Two-column responsive grid for sections. */
export function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
      {children}
    </div>
  )
}

export { getResourceCategory }
export type { ResourceItem, SignInRecord }
export function categoryOf(r: ResourceItem): Category | 'all' { return getResourceCategory(r.type) as Category | 'all' }
export { Text as UsageText, Caption1 as UsageCaption }
