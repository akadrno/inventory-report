import { useMemo } from 'react'
import { makeStyles, tokens, Text, Caption1 } from '@fluentui/react-components'
import {
  CubeRegular,
  AppGenericRegular,
  FlowRegular,
  BotRegular,
  GlobeRegular,
  FolderOpenRegular,
  PersonRegular,
  WarningRegular,
  ShieldErrorRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getDisplayName, getEnvironmentIdFromPath, getOwnerFromProperties, getResourceCategory } from '../types'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'
import { getConnectors, getIsQuarantined, getStatus } from '../utils/resourceMetadata'
import { getConnectorInfo } from '../utils/connectors'

interface HomeDashboardSnapshotProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  allGroups?: ResourceItem[]
  ownerNames?: Map<string, string>
}

type DonutSlice = { label: string; value: number; color: string }

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
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
    gap: '10px',
    '@media (max-width: 1600px)': { gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' },
    '@media (max-width: 1200px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
    '@media (max-width: 700px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  },
  statCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    padding: '12px 14px',
    minHeight: '84px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '8px',
  },
  statHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontSize: tokens.fontSizeBase100,
    lineHeight: tokens.lineHeightBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  statValue: {
    fontSize: '40px',
    lineHeight: 1,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    fontVariantNumeric: 'tabular-nums',
  },
  statSub: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
  panelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '14px',
    '@media (max-width: 1400px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
    '@media (max-width: 860px)': { gridTemplateColumns: '1fr' },
  },
  panel: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    padding: '16px 18px',
    minHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
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
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
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
    display: 'grid',
    gridTemplateColumns: '1fr 140px auto',
    alignItems: 'center',
    gap: '10px',
  },
  rowLabel: {
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  barBg: {
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
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: 'tabular-nums',
  },
  chartWrap: {
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
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

export function HomeDashboardSnapshot({ allResources, allEnvironments, allGroups = [], ownerNames }: HomeDashboardSnapshotProps) {
  const classes = useClasses()

  const appCount = useMemo(() => allResources.filter(r => getResourceCategory(r.type) === 'apps').length, [allResources])
  const flowCount = useMemo(() => allResources.filter(r => getResourceCategory(r.type) === 'flows').length, [allResources])
  const agentCount = useMemo(() => allResources.filter(r => getResourceCategory(r.type) === 'agents').length, [allResources])

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

  const quarantinedCount = useMemo(() => allResources.filter(r => getIsQuarantined(r) === true).length, [allResources])

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
    const startYear = Math.max(currentYear - 7, 2019)
    const byYear = new Map<number, number>()

    for (const r of allResources) {
      const created = r.properties?.['createdTime'] ?? r.properties?.['createdDateTime'] ?? r.properties?.['createdOn']
      if (typeof created !== 'string') continue
      const year = new Date(created).getFullYear()
      if (!Number.isFinite(year)) continue
      byYear.set(year, (byYear.get(year) ?? 0) + 1)
    }

    let running = 0
    const points: { year: number; newCount: number; cumulative: number }[] = []
    for (let year = startYear; year <= currentYear; year++) {
      const newCount = byYear.get(year) ?? 0
      running += newCount
      points.push({ year, newCount, cumulative: running })
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

  const maxNew = Math.max(...adoptionSeries.map(p => p.newCount), 1)
  const maxCum = Math.max(...adoptionSeries.map(p => p.cumulative), 1)

  const linePoints = adoptionSeries
    .map((p, idx) => {
      const x = adoptionSeries.length === 1 ? 0 : (idx / (adoptionSeries.length - 1)) * 100
      const y = 100 - (p.cumulative / maxCum) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className={classes.root}>
      <div className={classes.statGrid}>
        <div className={classes.statCard}><div className={classes.statHead}><CubeRegular fontSize={14} /> Total resources</div><div className={classes.statValue}>{allResources.length.toLocaleString()}</div><Caption1 className={classes.statSub}>apps, flows, agents</Caption1></div>
        <div className={classes.statCard}><div className={classes.statHead}><AppGenericRegular fontSize={14} /> Apps</div><div className={classes.statValue}>{appCount.toLocaleString()}</div><Caption1 className={classes.statSub}>{safePct(appCount, allResources.length)}% of total</Caption1></div>
        <div className={classes.statCard}><div className={classes.statHead}><FlowRegular fontSize={14} /> Flows</div><div className={classes.statValue}>{flowCount.toLocaleString()}</div><Caption1 className={classes.statSub}>{safePct(flowCount, allResources.length)}% of total</Caption1></div>
        <div className={classes.statCard}><div className={classes.statHead}><BotRegular fontSize={14} /> Agents</div><div className={classes.statValue}>{agentCount.toLocaleString()}</div><Caption1 className={classes.statSub}>{safePct(agentCount, allResources.length)}% of total</Caption1></div>
        <div className={classes.statCard}><div className={classes.statHead}><GlobeRegular fontSize={14} /> Environments</div><div className={classes.statValue}>{allEnvironments.length.toLocaleString()}</div><Caption1 className={classes.statSub}>in tenant</Caption1></div>
        <div className={classes.statCard}><div className={classes.statHead}><FolderOpenRegular fontSize={14} /> Env groups</div><div className={classes.statValue}>{allGroups.length.toLocaleString()}</div><Caption1 className={classes.statSub}>in tenant</Caption1></div>
        <div className={classes.statCard}><div className={classes.statHead}><PersonRegular fontSize={14} /> Makers</div><div className={classes.statValue}>{makerInfo.makerCount.toLocaleString()}</div><Caption1 className={classes.statSub}>unique creators</Caption1></div>
        <div className={classes.statCard}><div className={classes.statHead}><WarningRegular fontSize={14} /> Orphaned</div><div className={classes.statValue}>{makerInfo.orphaned.toLocaleString()}</div><Caption1 className={classes.statSub}>no owner on record</Caption1></div>
        <div className={classes.statCard}><div className={classes.statHead}><ShieldErrorRegular fontSize={14} /> Quarantined</div><div className={classes.statValue}>{quarantinedCount.toLocaleString()}</div><Caption1 className={classes.statSub}>flagged resources</Caption1></div>
      </div>

      <div className={classes.panelGrid}>
        <section className={classes.panel}>
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
        </section>

        <section className={classes.panel}>
          <Text className={classes.panelTitle}>Adoption over time</Text>
          <Caption1 className={classes.panelSub}>New resources per year and cumulative total</Caption1>
          <div className={classes.chartWrap}>
            {adoptionSeries.length === 0 ? (
              <div className={classes.emptyState}><Caption1>No created-time data available.</Caption1></div>
            ) : (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '170px' }}>
                {adoptionSeries.map((p, idx) => {
                  const x = adoptionSeries.length === 1 ? 0 : (idx / (adoptionSeries.length - 1)) * 100
                  const width = adoptionSeries.length === 1 ? 10 : 100 / adoptionSeries.length - 1.6
                  const h = (p.newCount / maxNew) * 34
                  return (
                    <rect
                      key={p.year}
                      x={Math.max(0, x - width / 2)}
                      y={98 - h}
                      width={Math.max(2, width)}
                      height={h}
                      rx={1.2}
                      fill="#8b5cf6"
                      opacity={idx === adoptionSeries.length - 1 ? 1 : 0.7}
                    />
                  )
                })}
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="1.4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
            {adoptionSeries.map(p => (
              <Caption1 key={p.year} style={{ color: tokens.colorNeutralForeground3 }}>{p.year}</Caption1>
            ))}
          </div>
        </section>

        <section className={classes.panel}>
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
        </section>

        <section className={classes.panel}>
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
        </section>

        <section className={classes.panel}>
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
        </section>

        <section className={classes.panel}>
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
        </section>

        <section className={classes.panel}>
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
        </section>

        <section className={classes.panel}>
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
        </section>
      </div>
    </div>
  )
}
