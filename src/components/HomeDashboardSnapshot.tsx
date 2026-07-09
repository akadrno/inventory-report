import { useEffect, useMemo, useState } from 'react'
import { makeStyles, tokens, Text, Caption1 } from '@fluentui/react-components'
import type { ResourceItem } from '../types'
import { getDisplayName, getEnvironmentIdFromPath, getOwnerFromProperties, getResourceCategory } from '../types'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'
import { getConnectors, getIsQuarantined, getStatus } from '../utils/resourceMetadata'
import { getConnectorInfo } from '../utils/connectors'
import { getCreatedDate } from './usageShared'

interface HomeDashboardSnapshotProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  ownerNames?: Map<string, string>
}

type DonutSlice = { label: string; value: number; color: string }
type PanelCardId =
  | 'resource-composition'
  | 'adoption-over-time'
  | 'top-makers'
  | 'flow-status'
  | 'top-environments'
  | 'top-connectors'
  | 'environments-by-type'
  | 'premium-vs-standard'

const PANEL_ORDER_KEY = 'ppac:home:panelCardOrder:v1'

const PREMIUM_CONNECTOR_IDS = new Set([
  'sql',
  'mysql',
  'postgresql',
  'oracle',
  'http',
  'httpwebhook',
  'azureopenai',
  'openai',
  'azureaisearch',
  'documentdb',
  'servicebus',
  'eventhubs',
  'databricks',
  'commondataserviceforapps',
  'commondataservice',
])

const useClasses = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  panelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '14px',
    '@media (max-width: 1400px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
    '@media (max-width: 860px)': { gridTemplateColumns: '1fr' },
  },
  panel: {
    position: 'relative',
    overflow: 'hidden',
    backgroundImage: `radial-gradient(120% 95% at 0% -8%, rgba(58,124,196,0.22), transparent 52%), linear-gradient(165deg, ${tokens.colorNeutralBackground1}, ${tokens.colorNeutralBackground2})`,
    border: `1px solid rgba(123, 158, 201, 0.45)`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: `${tokens.shadow8}, inset 0 1px 0 rgba(255,255,255,0.18)`,
    padding: '16px 18px',
    minHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transitionProperty: 'transform, box-shadow, border-color',
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveEasyEase,
    ':hover': {
      transform: 'translateY(-2px)',
      border: '1px solid rgba(140, 183, 235, 0.55)',
      boxShadow: `${tokens.shadow16}, inset 0 1px 0 rgba(255,255,255,0.22)`,
    },
    '::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.2), transparent 40%)',
      opacity: 0.35,
    },
  },
  panelDragging: {
    opacity: 0.7,
    transform: 'scale(0.995)',
  },
  panelDropHint: {
    border: '1px dashed rgba(140, 183, 235, 0.85)',
  },
  panelTitle: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  panelSub: {
    color: tokens.colorNeutralForeground3,
  },
  split: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: '14px',
    alignItems: 'center',
    marginTop: '4px',
  },
  ringWrap: {
    width: '120px',
    height: '120px',
    display: 'grid',
    placeItems: 'center',
  },
  ringCenter: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.74)',
    border: '1px solid rgba(132,164,204,0.45)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '4px',
  },
  ringValue: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase500,
    fontWeight: tokens.fontWeightBold,
    fontVariantNumeric: 'tabular-nums',
    color: tokens.colorNeutralForeground1,
  },
  ringLabel: {
    fontSize: tokens.fontSizeBase100,
    lineHeight: tokens.lineHeightBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: tokens.colorNeutralForeground3,
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  legendRow: {
    display: 'grid',
    gridTemplateColumns: '12px 1fr auto auto',
    gap: '8px',
    alignItems: 'center',
  },
  swatch: {
    width: '10px',
    height: '10px',
    borderRadius: tokens.borderRadiusSmall,
  },
  seriesName: {
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  number: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: 'tabular-nums',
  },
  pct: {
    color: tokens.colorNeutralForeground3,
    width: '34px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '2px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  rowLabel: {
    width: '180px',
    flexShrink: 0,
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  barBg: {
    flex: 1,
    minWidth: '120px',
    height: '10px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 'inherit',
  },
  rowValue: {
    width: '36px',
    textAlign: 'right',
    flexShrink: 0,
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: 'tabular-nums',
  },
  chartWrap: {
    borderRadius: tokens.borderRadiusMedium,
    border: '1px solid rgba(123, 158, 201, 0.35)',
    backgroundImage: `linear-gradient(165deg, ${tokens.colorNeutralBackground2}, ${tokens.colorNeutralBackground3})`,
    padding: '10px',
    marginTop: '4px',
  },
  emptyState: {
    minHeight: '100px',
    display: 'grid',
    placeItems: 'center',
    color: tokens.colorNeutralForeground3,
  },
  mutedCallout: {
    marginTop: '10px',
    color: tokens.colorNeutralForeground3,
  },
})

function safePct(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function donutGradient(slices: DonutSlice[]): string {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  if (!total) return `conic-gradient(${tokens.colorNeutralBackground4} 0deg 360deg)`
  let from = 0
  const parts: string[] = []
  for (const s of slices) {
    const size = (s.value / total) * 360
    const to = from + size
    parts.push(`${s.color} ${from}deg ${to}deg`)
    from = to
  }
  return `conic-gradient(${parts.join(', ')})`
}

function RingStat({ slices, centerValue, centerLabel }: { slices: DonutSlice[]; centerValue: string; centerLabel: string }) {
  const classes = useClasses()
  return (
    <div className={classes.ringWrap} style={{ background: donutGradient(slices), borderRadius: '50%' }}>
      <div className={classes.ringCenter}>
        <span className={classes.ringValue}>{centerValue}</span>
        <span className={classes.ringLabel}>{centerLabel}</span>
      </div>
    </div>
  )
}

export function HomeDashboardSnapshot({ allResources, allEnvironments, ownerNames }: HomeDashboardSnapshotProps) {
  const classes = useClasses()

  const defaultPanelOrder: PanelCardId[] = [
    'resource-composition',
    'adoption-over-time',
    'top-makers',
    'flow-status',
    'top-environments',
    'top-connectors',
    'environments-by-type',
    'premium-vs-standard',
  ]
  const [panelOrder, setPanelOrder] = useState<PanelCardId[]>(defaultPanelOrder)
  const [draggingPanel, setDraggingPanel] = useState<PanelCardId | null>(null)
  const [panelDropTarget, setPanelDropTarget] = useState<PanelCardId | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PANEL_ORDER_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as PanelCardId[]
      if (!Array.isArray(parsed)) return
      const valid = parsed.filter((id): id is PanelCardId => defaultPanelOrder.includes(id))
      const merged = [...valid, ...defaultPanelOrder.filter(id => !valid.includes(id))]
      if (merged.length === defaultPanelOrder.length) setPanelOrder(merged)
    } catch {
      // Ignore malformed preference and keep default order.
    }
  }, [])

  const movePanelCard = (from: PanelCardId, to: PanelCardId) => {
    if (from === to) return
    setPanelOrder(prev => {
      const next = [...prev]
      const fromIdx = next.indexOf(from)
      const toIdx = next.indexOf(to)
      if (fromIdx < 0 || toIdx < 0) return prev
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, from)
      localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(next))
      return next
    })
  }

  const appCount = useMemo(() => allResources.filter(r => getResourceCategory(r.type) === 'apps').length, [allResources])

  const makerInfo = useMemo(() => {
    const map = new Map<string, number>()
    let orphaned = 0

    for (const r of allResources) {
      const raw = getOwnerFromProperties(r)
      if (!raw || raw === '—') {
        orphaned++
        continue
      }
      if (raw.startsWith(SYSTEM_PREFIX)) continue
      const resolved = GUID_RE.test(raw) ? ownerNames?.get(raw) ?? raw : raw
      const key = resolved.trim()
      if (!key) continue
      map.set(key, (map.get(key) ?? 0) + 1)
    }

    const top = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    return { makerCount: map.size, topMakers: top, orphaned }
  }, [allResources, ownerNames])

  useMemo(() => allResources.filter(r => getIsQuarantined(r) === true).length, [allResources])

  const envNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const env of allEnvironments) {
      const name = getDisplayName(env)
      m.set(env.id.toLowerCase(), name)
      m.set(env.name.toLowerCase(), name)
      const seg = env.id.split('/').pop()
      if (seg) m.set(seg.toLowerCase(), name)
    }
    return m
  }, [allEnvironments])

  const topEnvironments = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of allResources) {
      const pathEnv = getEnvironmentIdFromPath(r.id)
      const key = (
        (r.environmentId ? envNameMap.get(r.environmentId.toLowerCase()) : undefined)
        ?? (pathEnv ? envNameMap.get(pathEnv.toLowerCase()) : undefined)
        ?? r.environmentName
        ?? r.environmentId
        ?? pathEnv
        ?? 'Unknown environment'
      )
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [allResources, envNameMap])

  const topConnectors = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of allResources) {
      for (const connectorId of getConnectors(r)) {
        const info = getConnectorInfo(connectorId)
        map.set(info.displayName, (map.get(info.displayName) ?? 0) + 1)
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [allResources])

  const adoptionSeries = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const byYear = new Map<number, { apps: number; flows: number; agents: number }>()

    for (const r of allResources) {
      const created = getCreatedDate(r)
      if (!created) continue
      const year = created.getFullYear()
      if (!Number.isFinite(year)) continue
      const category = getResourceCategory(r.type)
      if (category !== 'apps' && category !== 'flows' && category !== 'agents') continue
      const bucket = byYear.get(year) ?? { apps: 0, flows: 0, agents: 0 }
      bucket[category]++
      byYear.set(year, bucket)
    }

    const yearsWithData = [...byYear.keys()].sort((a, b) => a - b)
    const startYear = yearsWithData.length > 0 ? yearsWithData[0] : Math.max(currentYear - 7, 2019)
    const points: { year: number; apps: number; flows: number; agents: number; total: number }[] = []

    for (let year = startYear; year <= currentYear; year++) {
      const row = byYear.get(year) ?? { apps: 0, flows: 0, agents: 0 }
      const total = row.apps + row.flows + row.agents
      points.push({ year, apps: row.apps, flows: row.flows, agents: row.agents, total })
    }

    return points
  }, [allResources])

  const environmentTypeSlices = useMemo(() => {
    const map = new Map<string, number>()
    for (const env of allEnvironments) {
      const raw = String(env.environmentType ?? env.properties?.['environmentType'] ?? env.properties?.['type'] ?? 'Other')
      const key = raw.trim() || 'Other'
      map.set(key, (map.get(key) ?? 0) + 1)
    }

    const colorByLabel: Record<string, string> = {
      Developer: '#64748b',
      Production: '#2563eb',
      Sandbox: '#0d9488',
      Teams: '#6d28d9',
      Default: '#b38f00',
    }

    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
    return sorted.map(([label, value]) => ({
      label,
      value,
      color: colorByLabel[label] ?? '#94a3b8',
    }))
  }, [allEnvironments])

  const flowStatus = useMemo(() => {
    const counts = { active: 0, deactivated: 0, suspended: 0, unknown: 0 }
    for (const flow of allResources.filter(r => getResourceCategory(r.type) === 'flows')) {
      const s = (getStatus(flow) ?? '').toLowerCase()
      if (!s) { counts.unknown++; continue }
      if (s.includes('suspend') || s.includes('paused') || s.includes('stopped')) { counts.suspended++; continue }
      if (s.includes('deactiv') || s.includes('inactive') || s.includes('draft') || s.includes('disabled')) { counts.deactivated++; continue }
      if (s.includes('activ') || s.includes('enabled') || s.includes('running') || s.includes('started')) { counts.active++; continue }
      counts.unknown++
    }
    return counts
  }, [allResources])

  const premiumStandard = useMemo(() => {
    let premium = 0
    let standard = 0

    for (const r of allResources) {
      const cat = getResourceCategory(r.type)
      if (cat !== 'apps' && cat !== 'flows') continue
      const connectors = getConnectors(r)
      const hasPremium = connectors.some(id => PREMIUM_CONNECTOR_IDS.has(getConnectorInfo(id).id))
      if (hasPremium) premium++
      else standard++
    }

    return { premium, standard }
  }, [allResources])

  const appVsOtherSlices: DonutSlice[] = [
    { label: 'Apps', value: appCount, color: '#6d28d9' },
    { label: 'Other resources', value: Math.max(0, allResources.length - appCount), color: '#cbd5e1' },
  ]

  const flowTotal = flowStatus.active + flowStatus.deactivated + flowStatus.suspended + flowStatus.unknown
  const flowSlices: DonutSlice[] = [
    { label: 'Active', value: flowStatus.active, color: '#0d9488' },
    { label: 'Deactivated', value: flowStatus.deactivated, color: '#64748b' },
    { label: 'Suspended', value: flowStatus.suspended, color: '#b45309' },
    { label: 'Unknown', value: flowStatus.unknown, color: '#cbd5e1' },
  ]

  const premiumSlices: DonutSlice[] = [
    { label: 'Premium', value: premiumStandard.premium, color: '#b38f00' },
    { label: 'Standard', value: premiumStandard.standard, color: '#94a3b8' },
  ]

  const maxMaker = makerInfo.topMakers[0]?.count ?? 1
  const maxEnv = topEnvironments[0]?.count ?? 1
  const maxConnector = topConnectors[0]?.count ?? 1

  const maxAdoptionSeries = Math.max(...adoptionSeries.map(p => Math.max(p.apps, p.flows, p.agents)), 1)
  const adoptionTotals = useMemo(
    () => adoptionSeries.reduce((acc, p) => ({ apps: acc.apps + p.apps, flows: acc.flows + p.flows, agents: acc.agents + p.agents }), { apps: 0, flows: 0, agents: 0 }),
    [adoptionSeries],
  )

  const panelCards: Record<PanelCardId, JSX.Element> = {
    'resource-composition': (
      <>
          <Text className={classes.panelTitle}>Resource composition</Text>
          <Caption1 className={classes.panelSub}>Apps, flows and agents</Caption1>
          <div className={classes.split}>
            <RingStat slices={appVsOtherSlices} centerValue={appCount.toLocaleString()} centerLabel="apps" />
            <div className={classes.legend}>
              {appVsOtherSlices.map(s => (
                <div key={s.label} className={classes.legendRow}>
                  <span className={classes.swatch} style={{ backgroundColor: s.color }} />
                  <span className={classes.seriesName}>{s.label}</span>
                  <span className={classes.number}>{s.value.toLocaleString()}</span>
                  <span className={classes.pct}>{safePct(s.value, allResources.length)}%</span>
                </div>
              ))}
            </div>
          </div>
      </>
    ),
    'adoption-over-time': (
      <>
          <Text className={classes.panelTitle}>Adoption over time</Text>
          <Caption1 className={classes.panelSub}>App, flow and agent creations by year (inventory created dates)</Caption1>
          <div className={classes.chartWrap}>
            {adoptionSeries.length === 0 ? (
              <div className={classes.emptyState}><Caption1>No created-date data found in inventory records.</Caption1></div>
            ) : (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '170px' }}>
                {adoptionSeries.map((p, idx) => {
                  const slot = adoptionSeries.length === 0 ? 100 : 100 / adoptionSeries.length
                  const x0 = idx * slot
                  const barW = Math.max(1.4, slot * 0.22)
                  const gap = Math.max(0.4, slot * 0.08)
                  const appH = (p.apps / maxAdoptionSeries) * 36
                  const flowH = (p.flows / maxAdoptionSeries) * 36
                  const agentH = (p.agents / maxAdoptionSeries) * 36
                  return (
                    <g key={p.year}>
                      <rect
                        x={x0 + gap}
                        y={98 - appH}
                        width={barW}
                        height={appH}
                        rx={1.1}
                        fill="#b07cff"
                        opacity={0.95}
                      />
                      <rect
                        x={x0 + gap + barW + gap}
                        y={98 - flowH}
                        width={barW}
                        height={flowH}
                        rx={1.1}
                        fill="#4aa8ff"
                        opacity={0.95}
                      />
                      <rect
                        x={x0 + gap + (barW + gap) * 2}
                        y={98 - agentH}
                        width={barW}
                        height={agentH}
                        rx={1.1}
                        fill="#3ad1c4"
                        opacity={0.95}
                      />
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}><span style={{ color: '#b07cff' }}>Apps</span>: {adoptionTotals.apps.toLocaleString()}</Caption1>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}><span style={{ color: '#4aa8ff' }}>Flows</span>: {adoptionTotals.flows.toLocaleString()}</Caption1>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}><span style={{ color: '#3ad1c4' }}>Agents</span>: {adoptionTotals.agents.toLocaleString()}</Caption1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
            {adoptionSeries.map(p => (
              <Caption1 key={p.year} style={{ color: tokens.colorNeutralForeground3 }}>{p.year}</Caption1>
            ))}
          </div>
      </>
    ),
    'top-makers': (
      <>
          <Text className={classes.panelTitle}>Top makers</Text>
          <Caption1 className={classes.panelSub}>Most resources created or owned</Caption1>
          {makerInfo.topMakers.length === 0 ? (
            <div className={classes.emptyState}><Caption1>No maker data available.</Caption1></div>
          ) : (
            <div className={classes.list}>
              {makerInfo.topMakers.map(m => (
                <div key={m.name} className={classes.row}>
                  <span className={classes.rowLabel}>{m.name}</span>
                  <div className={classes.barBg}><div className={classes.barFill} style={{ width: `${(m.count / maxMaker) * 100}%`, backgroundColor: '#7c3aed' }} /></div>
                  <span className={classes.rowValue}>{m.count}</span>
                </div>
              ))}
            </div>
          )}
      </>
    ),
    'flow-status': (
      <>
          <Text className={classes.panelTitle}>Flow status</Text>
          <Caption1 className={classes.panelSub}>Activated, deactivated, suspended</Caption1>
          <div className={classes.split}>
            <RingStat slices={flowSlices} centerValue={flowTotal.toLocaleString()} centerLabel="flows" />
            <div className={classes.legend}>
              {flowSlices.map(s => (
                <div key={s.label} className={classes.legendRow}>
                  <span className={classes.swatch} style={{ backgroundColor: s.color }} />
                  <span className={classes.seriesName}>{s.label}</span>
                  <span className={classes.number}>{s.value.toLocaleString()}</span>
                  <span className={classes.pct}>{safePct(s.value, flowTotal)}%</span>
                </div>
              ))}
            </div>
          </div>
          <Caption1 className={classes.mutedCallout}>Flow status applies to flows only.</Caption1>
      </>
    ),
    'top-environments': (
      <>
          <Text className={classes.panelTitle}>Top environments</Text>
          <Caption1 className={classes.panelSub}>Apps, flows and agents by environment</Caption1>
          {topEnvironments.length === 0 ? (
            <div className={classes.emptyState}><Caption1>No environment mapping found.</Caption1></div>
          ) : (
            <div className={classes.list}>
              {topEnvironments.map(e => (
                <div key={e.name} className={classes.row}>
                  <span className={classes.rowLabel}>{e.name}</span>
                  <div className={classes.barBg}><div className={classes.barFill} style={{ width: `${(e.count / maxEnv) * 100}%`, backgroundColor: '#8496ad' }} /></div>
                  <span className={classes.rowValue}>{e.count}</span>
                </div>
              ))}
            </div>
          )}
      </>
    ),
    'top-connectors': (
      <>
          <Text className={classes.panelTitle}>Top connectors</Text>
          <Caption1 className={classes.panelSub}>Used across apps and flows</Caption1>
          {topConnectors.length === 0 ? (
            <div className={classes.emptyState}><Caption1>No connector metadata in this dataset.</Caption1></div>
          ) : (
            <div className={classes.list}>
              {topConnectors.map((c, idx) => (
                <div key={c.name} className={classes.row}>
                  <span className={classes.rowLabel}>{c.name}</span>
                  <div className={classes.barBg}>
                    <div
                      className={classes.barFill}
                      style={{
                        width: `${(c.count / maxConnector) * 100}%`,
                        backgroundColor: idx % 3 === 0 ? '#64748b' : idx % 3 === 1 ? '#2563eb' : '#0d9488',
                      }}
                    />
                  </div>
                  <span className={classes.rowValue}>{c.count}</span>
                </div>
              ))}
            </div>
          )}
      </>
    ),
    'environments-by-type': (
      <>
          <Text className={classes.panelTitle}>Environments by type</Text>
          <Caption1 className={classes.panelSub}>Production, Sandbox, Trial, Developer</Caption1>
          <div className={classes.split}>
            <RingStat slices={environmentTypeSlices} centerValue={allEnvironments.length.toLocaleString()} centerLabel="envs" />
            <div className={classes.legend}>
              {environmentTypeSlices.slice(0, 6).map(s => (
                <div key={s.label} className={classes.legendRow}>
                  <span className={classes.swatch} style={{ backgroundColor: s.color }} />
                  <span className={classes.seriesName}>{s.label}</span>
                  <span className={classes.number}>{s.value.toLocaleString()}</span>
                  <span className={classes.pct}>{safePct(s.value, allEnvironments.length)}%</span>
                </div>
              ))}
            </div>
          </div>
      </>
    ),
    'premium-vs-standard': (
      <>
          <Text className={classes.panelTitle}>Premium vs Standard</Text>
          <Caption1 className={classes.panelSub}>Connector profile across apps and flows</Caption1>
          <div className={classes.split}>
            <RingStat
              slices={premiumSlices}
              centerValue={`${safePct(premiumStandard.premium, premiumStandard.premium + premiumStandard.standard)}%`}
              centerLabel="premium"
            />
            <div className={classes.legend}>
              {premiumSlices.map(s => (
                <div key={s.label} className={classes.legendRow}>
                  <span className={classes.swatch} style={{ backgroundColor: s.color }} />
                  <span className={classes.seriesName}>{s.label}</span>
                  <span className={classes.number}>{s.value.toLocaleString()}</span>
                  <span className={classes.pct}>{safePct(s.value, premiumStandard.premium + premiumStandard.standard)}%</span>
                </div>
              ))}
            </div>
          </div>
          <Caption1 className={classes.mutedCallout}>Premium classification uses connector heuristics in inventory metadata.</Caption1>
      </>
    ),
  }

  return (
    <div className={classes.root}>
      <div className={classes.panelGrid}>
        {panelOrder.map(id => {
          const className = [
            classes.panel,
            draggingPanel === id ? classes.panelDragging : '',
            panelDropTarget === id ? classes.panelDropHint : '',
          ].filter(Boolean).join(' ')
          return (
            <section
              key={id}
              className={className}
              draggable
              onDragStart={() => setDraggingPanel(id)}
              onDragOver={(e) => { e.preventDefault(); setPanelDropTarget(id) }}
              onDragLeave={() => setPanelDropTarget(prev => (prev === id ? null : prev))}
              onDrop={(e) => {
                e.preventDefault()
                if (draggingPanel) movePanelCard(draggingPanel, id)
                setDraggingPanel(null)
                setPanelDropTarget(null)
              }}
              onDragEnd={() => {
                setDraggingPanel(null)
                setPanelDropTarget(null)
              }}
              title="Drag to reorder"
            >
              {panelCards[id]}
            </section>
          )
        })}
      </div>
    </div>
  )
}
