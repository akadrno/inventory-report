import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import {
  makeStyles, tokens, Text, Caption1, Spinner, Dropdown, Option, Badge,
} from '@fluentui/react-components'
import { GlobeRegular, WarningRegular, LockClosedRegular } from '@fluentui/react-icons'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'
import type { ResourceItem } from '../types'
import { getDisplayName, getResourceCategory } from '../types'
import {
  fetchSignIns, aggregateByLocation, aggregateByCountry,
  type LocationBucket,
} from '../api/signInsApi'
import { getAgentId } from '../utils/resourceMetadata'

// ─── Props ────────────────────────────────────────────────────────────────────

interface UsageHeatmapProps {
  allResources: ResourceItem[]
}

type TimeWindow = '7' | '30' | '90'

// ─── Heat layer (wraps leaflet.heat into a react-leaflet child) ──────────────

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    // leaflet.heat extends L at runtime; no types ship with it.
    const layer = (L as unknown as {
      heatLayer: (p: [number, number, number][], opts: object) => L.Layer
    }).heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 12,
      max: 1.0,
      gradient: { 0.2: '#3b82f6', 0.4: '#10b981', 0.6: '#eab308', 0.8: '#f97316', 1.0: '#ef4444' },
    }).addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, points])
  return null
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 },
  controlsRow: {
    display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
  },
  controlGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
  bodyRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: '12px',
    flex: 1,
    minHeight: '480px',
    '@media (max-width: 960px)': { gridTemplateColumns: '1fr' },
  },
  mapCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    overflow: 'hidden',
    minHeight: '480px',
  },
  sideCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: '8px',
    overflowY: 'auto',
    minHeight: 0,
  },
  rankRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 0',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: '13px',
  },
  banner: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    padding: '10px 14px',
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorPaletteYellowForeground2,
    border: `1px solid ${tokens.colorPaletteYellowBorder2}`,
    borderRadius: '4px',
    fontSize: '12px',
  },
  errorBanner: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    padding: '10px 14px',
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground2,
    border: `1px solid ${tokens.colorPaletteRedBorder2}`,
    borderRadius: '4px',
    fontSize: '12px',
  },
  loadingWrap: {
    flex: 1, minHeight: '480px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: '8px',
  },
  statBlock: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  statValue: {
    fontSize: '24px', fontWeight: 700, lineHeight: 1.1,
    color: tokens.colorNeutralForeground1,
  },
  statLabel: { fontSize: '11px', color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.4px' },
})

// ─── Main component ───────────────────────────────────────────────────────────

export function UsageHeatmap({ allResources }: UsageHeatmapProps) {
  const classes = useClasses()
  const { instance } = useMsal()

  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7')
  const [scopeKey, setScopeKey] = useState<string>('all')

  // Agents that have an Entra App / Agent ID we can filter sign-ins by.
  const agentScopes = useMemo(() => {
    return allResources
      .filter(r => getResourceCategory(r.type) === 'agents')
      .map(r => ({
        id: getAgentId(r),
        name: getDisplayName(r),
        resourceId: r.id,
      }))
      .filter((s): s is { id: string; name: string; resourceId: string } => !!s.id)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allResources])

  // Compute sinceIso + appIds the active scope corresponds to.
  const { sinceIso, appIds, scopeLabel } = useMemo(() => {
    const days = Number(timeWindow)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    if (scopeKey === 'all') return { sinceIso: since, appIds: undefined, scopeLabel: 'All sign-ins' }
    const agent = agentScopes.find(a => a.id === scopeKey)
    if (agent) return { sinceIso: since, appIds: [agent.id], scopeLabel: agent.name }
    return { sinceIso: since, appIds: undefined, scopeLabel: 'All sign-ins' }
  }, [timeWindow, scopeKey, agentScopes])

  const query = useQuery({
    queryKey: ['signIns', sinceIso, appIds ?? 'all'],
    queryFn: ({ signal }) =>
      fetchSignIns(instance, { since: sinceIso, appIds, maxRecords: 5000, signal }),
    staleTime: 5 * 60 * 1000,
    retry: 0,
  })

  const buckets: LocationBucket[] = useMemo(
    () => query.data ? aggregateByLocation(query.data.records) : [],
    [query.data],
  )
  const countries = useMemo(() => aggregateByCountry(buckets), [buckets])

  // [lat, lng, weight] for leaflet.heat. Normalize weight against max so the
  // hottest bucket reaches the gradient ceiling.
  const heatPoints = useMemo<[number, number, number][]>(() => {
    const max = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1
    return buckets.map(b => [b.lat, b.lng, Math.min(1, b.count / max)])
  }, [buckets])

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>()
    for (const r of query.data?.records ?? []) {
      if (r.userPrincipalName) users.add(r.userPrincipalName.toLowerCase())
    }
    return users.size
  }, [query.data])

  return (
    <div className={classes.root}>
      <div className={classes.controlsRow}>
        <div className={classes.controlGroup}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Time window</Caption1>
          <Dropdown
            selectedOptions={[timeWindow]}
            value={`Last ${timeWindow} days`}
            onOptionSelect={(_, d) => d.optionValue && setTimeWindow(d.optionValue as TimeWindow)}
            style={{ minWidth: '140px' }}
          >
            <Option value="7">Last 7 days</Option>
            <Option value="30">Last 30 days</Option>
            <Option value="90">Last 90 days</Option>
          </Dropdown>
        </div>
        <div className={classes.controlGroup}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Scope</Caption1>
          <Dropdown
            selectedOptions={[scopeKey]}
            value={scopeLabel}
            onOptionSelect={(_, d) => d.optionValue && setScopeKey(d.optionValue)}
            style={{ minWidth: '240px' }}
          >
            <Option value="all">All sign-ins</Option>
            {agentScopes.length > 0 && (
              <Option value="__sep" disabled>── Agents ──</Option>
            )}
            {agentScopes.map(a => (
              <Option key={a.id} value={a.id}>{a.name}</Option>
            ))}
          </Dropdown>
        </div>
        <Badge appearance="tint" color="informative" size="small">
          {query.data ? `${query.data.totalFetched} sign-ins · ${uniqueUsers} users` : '—'}
        </Badge>
      </div>

      {query.data?.truncated && (
        <div className={classes.banner}>
          <WarningRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Result truncated at 5000 sign-ins. Narrow the time window or pick a specific
            scope to see complete data.
          </span>
        </div>
      )}

      {query.isError && (
        <div className={classes.errorBanner}>
          <LockClosedRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{(query.error as Error)?.message ?? 'Failed to load sign-in data.'}</span>
        </div>
      )}

      <div className={classes.bodyRow}>
        <div className={classes.mapCard}>
          {query.isLoading ? (
            <div className={classes.loadingWrap}>
              <Spinner size="small" label="Loading Entra sign-in logs…" />
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>This can take a few seconds for large tenants.</Caption1>
            </div>
          ) : (
            <MapContainer
              center={[20, 0]}
              zoom={2}
              minZoom={2}
              maxZoom={10}
              style={{ height: '100%', width: '100%', minHeight: '480px' }}
              worldCopyJump
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <HeatLayer points={heatPoints} />
            </MapContainer>
          )}
        </div>

        <div className={classes.sideCard}>
          <div className={classes.statBlock}>
            <Text className={classes.statValue}>{query.data?.totalFetched.toLocaleString() ?? '—'}</Text>
            <span className={classes.statLabel}>Sign-ins</span>
          </div>
          <div className={classes.statBlock}>
            <Text className={classes.statValue}>{uniqueUsers.toLocaleString()}</Text>
            <span className={classes.statLabel}>Unique users</span>
          </div>
          <div className={classes.statBlock}>
            <Text className={classes.statValue}>{buckets.length.toLocaleString()}</Text>
            <span className={classes.statLabel}>Distinct cities</span>
          </div>

          <div style={{ marginTop: '8px' }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Top countries
            </Caption1>
          </div>
          {countries.length === 0 ? (
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              {query.isLoading ? 'Loading…' : 'No location data in this window.'}
            </Caption1>
          ) : (
            countries.slice(0, 12).map(c => (
              <div key={c.country} className={classes.rankRow}>
                <GlobeRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.country || 'Unknown'}
                </span>
                <Badge appearance="tint" color="subtle" size="small">{c.count.toLocaleString()}</Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
