import { useMemo, useState } from 'react'
import { useResizableColumns, RESIZE_HANDLE_STYLE } from '../hooks/useResizableColumns'
import { makeStyles, tokens, Text, Caption1, Badge, Button } from '@fluentui/react-components'
import {
  WarningRegular,
  GlobeRegular,
  PersonRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import {
  getOwnerFromProperties,
  getResourceCategory,
  getEnvironmentIdFromPath,
  getIsManagedEnvironment,
} from '../types'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { GUID_RE, SYSTEM_PREFIX, isSystemResource } from '../hooks/useOwnerNames'

interface MakerAnalyticsViewProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  ownerNames: Map<string, string>
}

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
  },
  summaryCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '4px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '4px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px 10px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    fontSize: '14px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' as const },
  th: {
    padding: '8px 16px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  thR: {
    padding: '8px 16px',
    textAlign: 'right',
    fontWeight: 600,
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  td: {
    padding: '10px 16px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    ':last-child': { borderBottom: 'none' },
  },
  tdR: {
    padding: '10px 16px',
    textAlign: 'right',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    ':last-child': { borderBottom: 'none' },
  },
  barBg: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusCircular,
    height: '6px',
    width: '80px',
    display: 'inline-block',
    verticalAlign: 'middle',
  },
  flagRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 16px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  connBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
})

function resolveOwner(raw: string, ownerNames: Map<string, string>): string {
  if (raw === '—') return '—'
  if (raw.startsWith(SYSTEM_PREFIX)) return 'System'
  return GUID_RE.test(raw) ? (ownerNames.get(raw) ?? raw) : raw
}

function BarCell({ value, max }: { value: number; max: number }) {
  const classes = useClasses()
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className={classes.barBg}>
      <div style={{ width: `${pct}%`, backgroundColor: tokens.colorBrandBackground, borderRadius: 'inherit', height: '100%' }} />
    </div>
  )
}

function extractConnectors(item: ResourceItem): string[] {
  const p = item.properties
  if (!p) return []
  const refs = p['connectionReferences'] as Record<string, unknown> | undefined
  if (refs && typeof refs === 'object') {
    return Object.values(refs)
      .map((r: unknown) => {
        if (r && typeof r === 'object') {
          const obj = r as Record<string, unknown>
          return (obj['displayName'] as string) || (obj['connectorName'] as string) || null
        }
        return null
      })
      .filter((n): n is string => !!n)
  }
  return []
}

interface MakerEntry {
  id: string
  displayName: string
  appCount: number
  flowCount: number
  agentCount: number
  total: number
  environmentIds: Set<string>
  hasUnmanagedEnv: boolean
  connectors: string[]
}

export function MakerAnalyticsView({ allResources, allEnvironments, ownerNames }: MakerAnalyticsViewProps) {
  const classes = useClasses()
  const [hideSystem, setHideSystem] = useState(true)
  const { widths: makerWidths, getResizeProps: getMakerResize } = useResizableColumns({ maker: 220, apps: 80, flows: 80, agents: 80, total: 80, dist: 160, envs: 110, status: 120 })
  const { widths: connWidths, getResizeProps: getConnResize } = useResizableColumns({ connector: 220, using: 130, freq: 160 })

  const visibleResources = useMemo(
    () => hideSystem ? allResources.filter(r => !isSystemResource(r)) : allResources,
    [allResources, hideSystem],
  )

  const envMap = useMemo(() => {
    const m = new Map<string, ResourceItem>()
    for (const e of allEnvironments) m.set(e.name, e)
    return m
  }, [allEnvironments])

  const makers = useMemo<MakerEntry[]>(() => {
    const map = new Map<string, { resources: ResourceItem[] }>()
    for (const r of visibleResources) {
      const owner = getOwnerFromProperties(r)
      if (owner === '—') continue
      const existing = map.get(owner)
      if (existing) existing.resources.push(r)
      else map.set(owner, { resources: [r] })
    }

    return [...map.entries()]
      .map(([id, { resources }]) => {
        const envIds = new Set<string>()
        for (const r of resources) {
          const envId = getEnvironmentIdFromPath(r.id) ?? r.environmentId
          if (envId) envIds.add(envId)
        }
        const hasUnmanagedEnv = [...envIds].some(envId => {
          const env = envMap.get(envId)
          return env ? !getIsManagedEnvironment(env) : false
        })
        const connectors = [...new Set(resources.flatMap(extractConnectors))]
        return {
          id,
          displayName: resolveOwner(id, ownerNames),
          appCount: resources.filter(r => getResourceCategory(r.type) === 'apps').length,
          flowCount: resources.filter(r => getResourceCategory(r.type) === 'flows').length,
          agentCount: resources.filter(r => getResourceCategory(r.type) === 'agents').length,
          total: resources.length,
          environmentIds: envIds,
          hasUnmanagedEnv,
          connectors,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [visibleResources, ownerNames, envMap])

  const maxTotal = makers[0]?.total ?? 1
  const unmanagedMakers = makers.filter(m => m.hasUnmanagedEnv)
  const multiEnvMakers = makers.filter(m => m.environmentIds.size >= 3)
  const avgResources = makers.length > 0 ? Math.round(makers.reduce((s, m) => s + m.total, 0) / makers.length) : 0

  // Connector frequency across all resources
  const connectorFreq = useMemo(() => {
    const freq = new Map<string, number>()
    for (const r of visibleResources) {
      for (const c of extractConnectors(r)) {
        freq.set(c, (freq.get(c) ?? 0) + 1)
      }
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [visibleResources])

  const systemCount = allResources.filter(isSystemResource).length

  return (
    <div className={classes.root}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          appearance={hideSystem ? 'primary' : 'subtle'}
          onClick={() => setHideSystem(h => !h)}
        >
          {hideSystem ? `System resources hidden (${systemCount})` : 'Show system resources'}
        </Button>
      </div>

      {/* Summary */}
      <div className={classes.summaryGrid}>
        {[
          { icon: <PersonRegular fontSize={24} style={{ color: tokens.colorBrandForeground1 }} />, value: makers.length, label: 'Unique Makers' },
          { icon: <GlobeRegular fontSize={24} style={{ color: tokens.colorBrandForeground1 }} />, value: allEnvironments.length, label: 'Environments' },
          { icon: <PersonRegular fontSize={24} style={{ color: '#e17800' }} />, value: unmanagedMakers.length, label: 'In Unmanaged Envs' },
          { icon: <PersonRegular fontSize={24} style={{ color: '#8764b8' }} />, value: avgResources, label: 'Avg Resources/Maker' },
        ].map(s => (
          <div key={s.label} className={classes.summaryCard}>
            {s.icon}
            <div>
              <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: tokens.colorNeutralForeground1 }}>{s.value}</Text>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{s.label}</Caption1>
            </div>
          </div>
        ))}
      </div>

      {/* Governance flags */}
      {(unmanagedMakers.length > 0 || multiEnvMakers.length > 0) && (
        <div className={classes.card}>
          <div className={classes.cardHead}>
            <WarningRegular fontSize={16} style={{ color: '#e17800' }} />
            Governance Risk Flags
            <Badge appearance="tint" color="warning" size="small">
              {unmanagedMakers.length + multiEnvMakers.length} issue{unmanagedMakers.length + multiEnvMakers.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          {unmanagedMakers.map(m => (
            <div key={m.id + '-unmanaged'} className={classes.flagRow}>
              <WarningRegular fontSize={14} style={{ color: '#e17800', flexShrink: 0, marginTop: 2 }} />
              <div>
                <Text style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{m.displayName}</Text>
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                  Has {m.total} resource{m.total !== 1 ? 's' : ''} in unmanaged environment{m.environmentIds.size !== 1 ? 's' : ''} — these environments lack admin oversight and usage insights.
                </Caption1>
              </div>
            </div>
          ))}
          {multiEnvMakers.filter(m => !m.hasUnmanagedEnv).map(m => (
            <div key={m.id + '-spread'} className={classes.flagRow}>
              <GlobeRegular fontSize={14} style={{ color: '#8764b8', flexShrink: 0, marginTop: 2 }} />
              <div>
                <Text style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{m.displayName}</Text>
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                  Resources span {m.environmentIds.size} environments — wide spread can indicate ungoverned development or shadow IT.
                </Caption1>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Maker leaderboard */}
      <div className={classes.card}>
        <div className={classes.cardHead}>
          <PersonRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />
          Maker Leaderboard
          <Badge appearance="tint" color="subtle" size="small">{makers.length} maker{makers.length !== 1 ? 's' : ''}</Badge>
        </div>
        {makers.length === 0 ? (
          <div style={{ padding: '16px' }}><Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No maker data available from loaded resources.</Caption1></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={classes.table}>
              <colgroup>
                <col style={{ width: makerWidths.maker }} />
                <col style={{ width: makerWidths.apps }} />
                <col style={{ width: makerWidths.flows }} />
                <col style={{ width: makerWidths.agents }} />
                <col style={{ width: makerWidths.total }} />
                <col style={{ width: makerWidths.dist }} />
                <col style={{ width: makerWidths.envs }} />
                <col style={{ width: makerWidths.status }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={classes.th}>Maker<div {...getMakerResize('maker')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.thR}><PowerAppsIcon fontSize={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Apps<div {...getMakerResize('apps')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.thR}><PowerAutomateIcon fontSize={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Flows<div {...getMakerResize('flows')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.thR}><CopilotStudioIcon fontSize={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Agents<div {...getMakerResize('agents')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.thR}>Total<div {...getMakerResize('total')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th}>Distribution<div {...getMakerResize('dist')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.thR}>Environments<div {...getMakerResize('envs')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th}>Status<div {...getMakerResize('status')} style={RESIZE_HANDLE_STYLE} /></th>
                </tr>
              </thead>
              <tbody>
                {makers.map(m => (
                  <tr key={m.id}>
                    <td className={classes.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PersonRegular fontSize={14} style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }} />
                        <Text style={{ fontSize: '13px', fontWeight: 600 }}>{m.displayName}</Text>
                      </div>
                    </td>
                    <td className={classes.tdR}>{m.appCount || '—'}</td>
                    <td className={classes.tdR}>{m.flowCount || '—'}</td>
                    <td className={classes.tdR}>{m.agentCount || '—'}</td>
                    <td className={classes.tdR}>{m.total}</td>
                    <td className={classes.td}><BarCell value={m.total} max={maxTotal} /></td>
                    <td className={classes.tdR}>{m.environmentIds.size}</td>
                    <td className={classes.td}>
                      {m.hasUnmanagedEnv
                        ? <Badge appearance="tint" color="warning" size="small">Unmanaged envs</Badge>
                        : m.environmentIds.size >= 3
                          ? <Badge appearance="tint" color="informative" size="small">Wide spread</Badge>
                          : <Badge appearance="tint" color="success" size="small"><CheckmarkCircleRegular fontSize={10} /> OK</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connector analysis */}
      {connectorFreq.length > 0 && (
        <div className={classes.card}>
          <div className={classes.cardHead}>
            Connector Usage
            <Badge appearance="tint" color="subtle" size="small">{connectorFreq.length} connectors detected</Badge>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className={classes.table}>
              <colgroup>
                <col style={{ width: connWidths.connector }} />
                <col style={{ width: connWidths.using }} />
                <col style={{ width: connWidths.freq }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={classes.th}>Connector<div {...getConnResize('connector')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.thR}>Resources Using<div {...getConnResize('using')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th}>Frequency<div {...getConnResize('freq')} style={RESIZE_HANDLE_STYLE} /></th>
                </tr>
              </thead>
              <tbody>
                {connectorFreq.map(([name, count]) => (
                  <tr key={name}>
                    <td className={classes.td}><Text style={{ fontSize: '13px' }}>{name}</Text></td>
                    <td className={classes.tdR}>{count}</td>
                    <td className={classes.td}><BarCell value={count} max={connectorFreq[0][1]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {connectorFreq.length === 0 && (
        <div className={classes.card}>
          <div className={classes.cardHead}>Connector Usage</div>
          <div style={{ padding: '16px' }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              Connector details are not included in the resource inventory query. Connection references are available in individual app/flow manifests via the Power Apps API.
            </Caption1>
          </div>
        </div>
      )}

    </div>
  )
}
