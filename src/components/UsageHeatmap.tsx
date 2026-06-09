import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import {
  makeStyles, tokens, Text, Caption1, Spinner, Dropdown, Option, Badge, Input, Button,
  TabList, Tab, type SelectTabEvent, type SelectTabData,
} from '@fluentui/react-components'
import {
  GlobeRegular, WarningRegular, LockClosedRegular, InfoRegular, SearchRegular,
  PersonRegular, AppsRegular, DismissCircleRegular, CheckmarkCircleRegular,
} from '@fluentui/react-icons'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'
import type { ResourceItem } from '../types'
import { getDisplayName, getResourceCategory } from '../types'
import {
  fetchSignIns, aggregateByLocation, aggregateByField, diagnoseSignIns,
  type LocationBucket, type SignInRecord,
} from '../api/signInsApi'
import { useSignInCache } from '../context/SignInCacheContext'
import { getAgentId } from '../utils/resourceMetadata'

// Compact "x ago" formatter for the cache's last-updated timestamp.
function formatRelative(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const d = Math.floor(hr / 24)
  return `${d} day${d !== 1 ? 's' : ''} ago`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UsageHeatmapProps {
  allResources: ResourceItem[]
}

type TimeWindow = '7' | '30' | '90'
type StatusFilter = 'all' | 'success' | 'failed'
type SidePanelTab = 'countries' | 'users' | 'apps' | 'cities'

// ─── Heat + marker layer ──────────────────────────────────────────────────────

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const layer = (L as unknown as {
      heatLayer: (p: [number, number, number][], opts: object) => L.Layer
    }).heatLayer(points, {
      radius: 32,
      blur: 24,
      maxZoom: 12,
      max: 1.0,
      minOpacity: 0.5,
      gradient: { 0.1: '#3b82f6', 0.3: '#10b981', 0.5: '#eab308', 0.7: '#f97316', 1.0: '#ef4444' },
    }).addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, points])
  return null
}

// Renders a clickable CircleMarker per location so users can see which city /
// users / apps a hot spot represents. Sized by sign-in count.
function MarkerLayer({ buckets }: { buckets: LocationBucket[] }) {
  const map = useMap()
  useEffect(() => {
    if (!buckets.length) return
    const max = buckets[0]?.count ?? 1
    const group = L.layerGroup()
    for (const b of buckets) {
      const r = 5 + Math.min(20, Math.round((b.count / max) * 20))
      const marker = L.circleMarker([b.lat, b.lng], {
        radius: r,
        color: '#ffffff',
        weight: 1,
        fillColor: '#ef4444',
        fillOpacity: 0.65,
      })
      const popupHtml = `
        <div style="font-family: 'Segoe UI', system-ui, sans-serif; min-width: 200px; max-width: 280px;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">
            ${escapeHtml(b.city || 'Unknown city')}${b.country ? ', ' + escapeHtml(b.country) : ''}
          </div>
          <div style="font-size: 12px; color: #616161; margin-bottom: 8px;">
            ${b.count.toLocaleString()} sign-in${b.count !== 1 ? 's' : ''} · ${b.uniqueUsers} user${b.uniqueUsers !== 1 ? 's' : ''}
          </div>
          ${b.users.length ? `<div style="font-size: 11px; color: #424242; margin-bottom: 4px;"><b>Users:</b><br>${b.users.map(escapeHtml).join('<br>')}</div>` : ''}
          ${b.apps.length ? `<div style="font-size: 11px; color: #424242; margin-top: 6px;"><b>Apps:</b><br>${b.apps.map(escapeHtml).join('<br>')}</div>` : ''}
        </div>`
      marker.bindPopup(popupHtml, { maxWidth: 320 })
      marker.bindTooltip(
        `${b.city || 'Unknown'}: ${b.count.toLocaleString()}`,
        { direction: 'top', offset: [0, -r] },
      )
      group.addLayer(marker)
    }
    group.addTo(map)
    return () => { map.removeLayer(group) }
  }, [map, buckets])
  return null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Auto-fit the map bounds to the data once the buckets change so the user
// doesn't have to manually pan to find activity.
function AutoFitBounds({ buckets }: { buckets: LocationBucket[] }) {
  const map = useMap()
  useEffect(() => {
    if (buckets.length === 0) return
    const bounds = L.latLngBounds(buckets.map(b => [b.lat, b.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6, animate: true })
  }, [map, buckets])
  return null
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0 },
  controlsRow: {
    display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
  },
  controlGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
  diagBanner: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '4px',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    flexWrap: 'wrap',
  },
  diagStat: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
  refreshBanner: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    border: `1px solid ${tokens.colorBrandStroke2}`,
    borderRadius: '4px',
    fontSize: '12px',
  },
  cacheStatus: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    marginLeft: 'auto',
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
  bodyRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: '10px',
    flex: 1,
    minHeight: '520px',
    '@media (max-width: 960px)': { gridTemplateColumns: '1fr' },
  },
  mapCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    overflow: 'hidden',
    minHeight: '520px',
  },
  sideCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: '8px',
    overflowY: 'auto',
    minHeight: 0,
  },
  rankRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 0',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: '12.5px',
  },
  rankRowClickable: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 0',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: '12.5px',
    cursor: 'pointer',
    ':hover': { color: tokens.colorBrandForeground1 },
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
  emptyBanner: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    padding: '10px 14px',
    backgroundColor: tokens.colorStatusWarningBackground1,
    color: tokens.colorStatusWarningForeground1,
    border: `1px solid ${tokens.colorStatusWarningBorder1}`,
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
    flex: 1, minHeight: '520px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: '8px',
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '4px',
  },
  statBlock: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '6px',
    padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  statValue: {
    fontSize: '20px', fontWeight: 700, lineHeight: 1.1,
    color: tokens.colorNeutralForeground1,
  },
  statLabel: { fontSize: '10px', color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.4px' },
  sectionTitle: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginTop: '8px',
  },
})

// ─── Known Power Platform first-party app IDs (for category filter) ──────────

const PP_APP_IDS: Record<string, string[]> = {
  apps: [
    '475226c6-020e-4fb2-8a90-7a972cbfc1d4', // Microsoft Power Apps Service
  ],
  flows: [
    '7df0a125-d3be-4c96-aa54-591f83ff541c', // Microsoft Flow Service
    '6204c1d1-4712-4c46-a7d9-3ed63d992682', // Microsoft Power Automate
  ],
  agents: [
    '38e0c342-4d35-4216-94db-87ebca2cf2ea', // Microsoft Copilot Studio (best-effort)
  ],
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UsageHeatmap({ allResources }: UsageHeatmapProps) {
  const classes = useClasses()
  const { instance } = useMsal()

  // Server-side query knobs
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7')
  const [scopeKey, setScopeKey] = useState<string>('all')

  // Client-side filter knobs
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'apps' | 'flows' | 'agents'>('all')
  const [userSearch, setUserSearch] = useState('')

  // Side panel tab
  const [sideTab, setSideTab] = useState<SidePanelTab>('countries')

  // Agents that have an Entra Agent ID we can filter sign-ins by.
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

  const cache = useSignInCache()

  // The 7- and 30-day windows render instantly from the cached last-30-days
  // table. The 90-day window (and the no-storage fallback) fetches live from
  // Graph since it falls outside the cache.
  const useLive = timeWindow === '90' || !cache.configured

  const liveQuery = useQuery({
    queryKey: ['signIns', sinceIso, appIds ?? 'all'],
    queryFn: ({ signal }) =>
      fetchSignIns(instance, { since: sinceIso, appIds, maxRecords: 5000, signal }),
    enabled: useLive,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  })

  // Records before client-side filters: either the live Graph pull, or the
  // cached records narrowed to the selected window + scope (agent appIds).
  const baseRecords = useMemo<SignInRecord[]>(() => {
    if (useLive) return liveQuery.data?.records ?? []
    let rs = cache.records.filter(r => r.createdDateTime >= sinceIso)
    if (appIds && appIds.length) {
      const allow = new Set(appIds)
      rs = rs.filter(r => r.appId != null && allow.has(r.appId))
    }
    return rs
  }, [useLive, liveQuery.data, cache.records, sinceIso, appIds])

  // Unified status across the live and cached paths.
  const isLoadingData = useLive
    ? liveQuery.isLoading
    : cache.loadingFromCache && cache.records.length === 0
  const isRefreshing = useLive ? liveQuery.isFetching : cache.status === 'refreshing'
  const isError = useLive ? liveQuery.isError : false
  const errorMsg = useLive ? (liveQuery.error as Error)?.message : null
  const dataTruncated = useLive ? !!liveQuery.data?.truncated : cache.truncated
  const pagesFetched = useLive ? liveQuery.data?.pagesFetched ?? 0 : 0
  const onRefreshClick = () => { if (useLive) void liveQuery.refetch(); else cache.refreshNow() }

  // Build a filtered subset of records for the chosen category/status/user filters.
  const filteredRecords = useMemo<SignInRecord[]>(() => {
    let rs = baseRecords
    if (statusFilter !== 'all') {
      rs = rs.filter(r => {
        const success = (r.status?.errorCode ?? 0) === 0
        return statusFilter === 'success' ? success : !success
      })
    }
    if (categoryFilter !== 'all') {
      const allowed = new Set<string>(PP_APP_IDS[categoryFilter])
      if (categoryFilter === 'agents') {
        for (const a of agentScopes) allowed.add(a.id)
      }
      rs = rs.filter(r => r.appId && allowed.has(r.appId))
    }
    if (userSearch.trim()) {
      const q = userSearch.trim().toLowerCase()
      rs = rs.filter(r =>
        (r.userPrincipalName ?? '').toLowerCase().includes(q) ||
        (r.userDisplayName ?? '').toLowerCase().includes(q),
      )
    }
    return rs
  }, [baseRecords, statusFilter, categoryFilter, userSearch, agentScopes])

  // Diagnostics are computed against the post-filter set so the banner
  // explains where the data went.
  const diag = useMemo(() => diagnoseSignIns(filteredRecords), [filteredRecords])
  const rawDiag = useMemo(() => diagnoseSignIns(baseRecords), [baseRecords])

  const buckets = useMemo(() => aggregateByLocation(filteredRecords), [filteredRecords])

  // [lat, lng, weight] for leaflet.heat. Normalize so the hottest bucket = 1.
  const heatPoints = useMemo<[number, number, number][]>(() => {
    const max = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1
    return buckets.map(b => [b.lat, b.lng, Math.min(1, Math.max(0.3, b.count / max))])
  }, [buckets])

  const topCountries = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of buckets) {
      const c = b.country || 'Unknown'
      m.set(c, (m.get(c) ?? 0) + b.count)
    }
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }, [buckets])

  const topUsers = useMemo(
    () => aggregateByField(filteredRecords, r => r.userDisplayName || r.userPrincipalName, 'Unknown'),
    [filteredRecords],
  )
  const topApps = useMemo(
    () => aggregateByField(filteredRecords, r => r.appDisplayName, 'Unknown app'),
    [filteredRecords],
  )
  const topCities = useMemo(
    () => buckets.slice(0, 50).map(b => ({
      label: `${b.city || 'Unknown'}${b.country ? ', ' + b.country : ''}`,
      count: b.count,
    })),
    [buckets],
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={classes.root}>
      {/* Controls row 1: server-side query knobs */}
      <div className={classes.controlsRow}>
        <div className={classes.controlGroup}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Time</Caption1>
          <Dropdown
            selectedOptions={[timeWindow]}
            value={`Last ${timeWindow} days`}
            onOptionSelect={(_, d) => d.optionValue && setTimeWindow(d.optionValue as TimeWindow)}
            style={{ minWidth: '130px' }}
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
            style={{ minWidth: '220px' }}
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
        <Button
          size="small"
          appearance="subtle"
          onClick={onRefreshClick}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing…' : (useLive ? 'Refresh' : 'Update now')}
        </Button>
        {!useLive && (
          <span className={classes.cacheStatus}>
            {isRefreshing ? (
              <><Spinner size="tiny" /> Updating…</>
            ) : (
              <>
                <CheckmarkCircleRegular fontSize={14} style={{ color: tokens.colorPaletteGreenForeground1 }} />
                Cached · updated {formatRelative(cache.cachedAt)}
              </>
            )}
          </span>
        )}
      </div>

      {/* Controls row 2: client-side filters */}
      <div className={classes.controlsRow}>
        <div className={classes.controlGroup}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Category</Caption1>
          {(['all', 'apps', 'flows', 'agents'] as const).map(c => (
            <Button
              key={c}
              size="small"
              appearance={categoryFilter === c ? 'primary' : 'subtle'}
              onClick={() => setCategoryFilter(c)}
            >
              {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
            </Button>
          ))}
        </div>
        <div className={classes.controlGroup}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Status</Caption1>
          {(['all', 'success', 'failed'] as const).map(s => (
            <Button
              key={s}
              size="small"
              appearance={statusFilter === s ? 'primary' : 'subtle'}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        <Input
          contentBefore={<SearchRegular />}
          placeholder="Filter by user (UPN or name)…"
          size="small"
          value={userSearch}
          onChange={(_, d) => setUserSearch(d.value)}
          style={{ minWidth: '260px' }}
        />
      </div>

      {/* Background-refresh notice — the cache is being updated from Graph */}
      {!useLive && isRefreshing && (
        <div className={classes.refreshBanner}>
          <Spinner size="tiny" />
          <span>
            A background job is updating the current usage numbers. The map below shows the
            last cached data and will refresh automatically when the update finishes.
          </span>
        </div>
      )}
      {!useLive && cache.status === 'error' && cache.error && (
        <div className={classes.banner}>
          <WarningRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Couldn't update usage data ({cache.error}). Showing the last cached data.</span>
        </div>
      )}

      {/* Diagnostics banner — shows the dataset size vs what survived filters */}
      {!isLoadingData && (
        <div className={classes.diagBanner}>
          <InfoRegular fontSize={14} />
          <span className={classes.diagStat}>
            <b>{rawDiag.totalRecords.toLocaleString()}</b> sign-ins {useLive ? 'returned from Graph' : `cached (last ${cache.cacheDays} days)`}
            {useLive && ` (${pagesFetched} page${pagesFetched !== 1 ? 's' : ''})`}
          </span>
          <span style={{ color: tokens.colorNeutralForeground3 }}>·</span>
          <span className={classes.diagStat}>
            <b>{rawDiag.withGeo.toLocaleString()}</b> with location
          </span>
          <span style={{ color: tokens.colorNeutralForeground3 }}>·</span>
          <span className={classes.diagStat}>
            <b>{rawDiag.withoutGeo.toLocaleString()}</b> without location
          </span>
          <span style={{ color: tokens.colorNeutralForeground3 }}>·</span>
          <span className={classes.diagStat}>
            <CheckmarkCircleRegular fontSize={12} style={{ color: tokens.colorPaletteGreenForeground1 }} />
            <b>{rawDiag.successful.toLocaleString()}</b> success
          </span>
          <span className={classes.diagStat}>
            <DismissCircleRegular fontSize={12} style={{ color: tokens.colorPaletteRedForeground1 }} />
            <b>{rawDiag.failed.toLocaleString()}</b> failed
          </span>
          {rawDiag.totalRecords !== diag.totalRecords && (
            <>
              <span style={{ color: tokens.colorNeutralForeground3 }}>·</span>
              <span className={classes.diagStat}>
                After filters: <b>{diag.totalRecords.toLocaleString()}</b>
              </span>
            </>
          )}
        </div>
      )}

      {dataTruncated && (
        <div className={classes.banner}>
          <WarningRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Result truncated at the record cap. Narrow the time window or pick a specific
            scope to see complete data.
          </span>
        </div>
      )}

      {!isLoadingData && rawDiag.totalRecords === 0 && (
        <div className={classes.emptyBanner}>
          <InfoRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            No sign-ins for the selected scope and time window. Try a
            longer time window, switch the scope to "All sign-ins", or confirm the
            signed-in user has an audit-reader Entra role (Reports Reader / Security
            Reader / Global Reader / Global Admin).
          </span>
        </div>
      )}
      {!isLoadingData && rawDiag.totalRecords > 0 && diag.withGeo === 0 && (
        <div className={classes.emptyBanner}>
          <InfoRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {rawDiag.totalRecords.toLocaleString()} sign-ins matched but none have
            geoCoordinates after filters. Entra populates location from IP-based
            geolocation, and service-principal / managed-identity sign-ins typically
            don't carry it. Try widening the filters above.
          </span>
        </div>
      )}

      {isError && (
        <div className={classes.errorBanner}>
          <LockClosedRegular fontSize={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{errorMsg ?? 'Failed to load sign-in data.'}</span>
        </div>
      )}

      <div className={classes.bodyRow}>
        <div className={classes.mapCard}>
          {isLoadingData ? (
            <div className={classes.loadingWrap}>
              <Spinner size="small" label={useLive ? 'Loading Entra sign-in logs…' : 'Loading cached sign-in data…'} />
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>This can take a few seconds for large tenants.</Caption1>
            </div>
          ) : (
            <MapContainer
              center={[20, 0]}
              zoom={2}
              minZoom={2}
              maxZoom={12}
              style={{ height: '100%', width: '100%', minHeight: '520px' }}
              worldCopyJump
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <HeatLayer points={heatPoints} />
              <MarkerLayer buckets={buckets} />
              <AutoFitBounds buckets={buckets} />
            </MapContainer>
          )}
        </div>

        {/* Side panel: stats + tabbed lists */}
        <div className={classes.sideCard}>
          <div className={classes.statRow}>
            <div className={classes.statBlock}>
              <Text className={classes.statValue}>{diag.totalRecords.toLocaleString()}</Text>
              <span className={classes.statLabel}>Sign-ins</span>
            </div>
            <div className={classes.statBlock}>
              <Text className={classes.statValue}>{diag.distinctUsers.toLocaleString()}</Text>
              <span className={classes.statLabel}>Users</span>
            </div>
            <div className={classes.statBlock}>
              <Text className={classes.statValue}>{buckets.length.toLocaleString()}</Text>
              <span className={classes.statLabel}>Cities</span>
            </div>
            <div className={classes.statBlock}>
              <Text className={classes.statValue}>{topCountries.length.toLocaleString()}</Text>
              <span className={classes.statLabel}>Countries</span>
            </div>
          </div>

          <TabList
            selectedValue={sideTab}
            onTabSelect={(_e: SelectTabEvent, d: SelectTabData) => setSideTab(d.value as SidePanelTab)}
            size="small"
          >
            <Tab value="countries">Countries</Tab>
            <Tab value="cities">Cities</Tab>
            <Tab value="users">Users</Tab>
            <Tab value="apps">Apps</Tab>
          </TabList>

          {sideTab === 'countries' && (
            <RankList
              icon={<GlobeRegular fontSize={14} />}
              items={topCountries}
              emptyText={isLoadingData ? 'Loading…' : 'No countries in current filter set.'}
              limit={20}
            />
          )}
          {sideTab === 'cities' && (
            <RankList
              icon={<GlobeRegular fontSize={14} />}
              items={topCities}
              emptyText={isLoadingData ? 'Loading…' : 'No cities with location data.'}
              limit={20}
            />
          )}
          {sideTab === 'users' && (
            <RankList
              icon={<PersonRegular fontSize={14} />}
              items={topUsers}
              emptyText={isLoadingData ? 'Loading…' : 'No users in current filter set.'}
              limit={20}
              onClick={(label) => setUserSearch(label)}
            />
          )}
          {sideTab === 'apps' && (
            <RankList
              icon={<AppsRegular fontSize={14} />}
              items={topApps}
              emptyText={isLoadingData ? 'Loading…' : 'No apps in current filter set.'}
              limit={20}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function RankList({
  icon, items, emptyText, limit, onClick,
}: {
  icon: React.ReactNode
  items: { label: string; count: number }[]
  emptyText: string
  limit: number
  onClick?: (label: string) => void
}) {
  const classes = useClasses()
  if (items.length === 0) {
    return <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{emptyText}</Caption1>
  }
  return (
    <>
      {items.slice(0, limit).map(item => (
        <div
          key={item.label}
          className={onClick ? classes.rankRowClickable : classes.rankRow}
          onClick={onClick ? () => onClick(item.label) : undefined}
          title={onClick ? `Filter to ${item.label}` : undefined}
        >
          <span style={{ color: tokens.colorBrandForeground1, display: 'inline-flex' }}>{icon}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
          <Badge appearance="tint" color="subtle" size="small">{item.count.toLocaleString()}</Badge>
        </div>
      ))}
    </>
  )
}
