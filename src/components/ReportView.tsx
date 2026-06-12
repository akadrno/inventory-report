import { useState, useMemo } from 'react'
import { makeStyles, tokens, Text, Caption1, Badge, Spinner, Button } from '@fluentui/react-components'
import {
  ErrorCircleRegular,
  WarningRegular,
  CheckmarkCircleRegular,
  ArrowClockwiseRegular,
  DatabaseRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getResourceCategory, getDisplayName, getIsManagedEnvironment, getEnvironmentIdFromPath } from '../types'
import { useDLPPolicies, useTenantSettings } from '../hooks/useGovernance'
import type { DLPPolicy, TenantSettings } from '../hooks/useGovernance'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { useAdminData } from '../hooks/useAdminData'
import { useSignInCache } from '../context/SignInCacheContext'
import { CommandBackdrop, CountUp } from './CommandCenter'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { useThemeMode } from '../context/ThemeContext'

// Hero gradient: a lighter, brighter blue in light mode; the deep near-black
// command-center navy in dark mode. White hero text stays legible on both.
const HERO_BG_LIGHT = 'radial-gradient(ellipse 90% 130% at 15% -20%, #3a7cc4 0%, #255596 45%, #173a64 100%)'

interface ReportViewProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  ownerNames?: Map<string, string>
  onNavigateToRiskAssessments?: () => void
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '0' },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusXLarge,
    marginBottom: tokens.spacingVerticalL,
    padding: '30px 32px 26px',
    background: 'radial-gradient(ellipse 90% 130% at 15% -20%, #16335f 0%, #0b1830 45%, #070d1c 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  heroTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  heroEyebrow: {
    fontFamily: 'Consolas, "SFMono-Regular", monospace',
    fontSize: '11px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'rgba(150,200,255,0.65)',
  },
  livePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '4px 11px',
    borderRadius: tokens.borderRadiusCircular,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.6px',
    color: 'rgba(220,235,255,0.85)',
  },
  liveDot: {
    width: '7px', height: '7px', borderRadius: '50%',
    backgroundColor: '#3ad1c4', flexShrink: 0,
  },
  heroTitle: {
    margin: 0,
    fontSize: '30px',
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: '-0.5px',
    background: 'linear-gradient(90deg, #ffffff, #bcd8ff)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  heroSub: {
    color: 'rgba(198,216,244,0.7)',
    display: 'block',
    fontSize: '14px',
    marginTop: '6px',
  },
  pillarRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  pillarCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: '18px 18px 16px',
    borderRadius: '14px',
    background: 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  pillarGlow: {
    position: 'absolute', top: '-30px', right: '-30px',
    width: '120px', height: '120px', borderRadius: '50%',
    filter: 'blur(34px)', opacity: 0.4, pointerEvents: 'none',
  },
  pillarTop: { display: 'flex', alignItems: 'center', gap: '10px' },
  pillarIcon: {
    width: '38px', height: '38px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  pillarLabel: {
    color: 'rgba(210,228,255,0.85)',
    fontSize: '13px', fontWeight: 600, letterSpacing: '0.3px',
  },
  pillarValue: {
    color: '#ffffff',
    fontSize: '38px', fontWeight: 800, lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  pillarSub: { color: 'rgba(180,202,234,0.55)', fontSize: '12px' },
  secondaryRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  miniStat: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    padding: '10px 16px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    minWidth: '108px',
  },
  miniValue: {
    color: '#ffffff', fontSize: '20px', fontWeight: 700, lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
  },
  miniLabel: {
    color: 'rgba(180,202,234,0.6)', fontSize: '11px',
    textTransform: 'uppercase', letterSpacing: '0.6px',
  },
  healthBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  navRow: {
    display: 'flex',
    gap: '2px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    marginBottom: tokens.spacingVerticalL,
    overflowX: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: `${tokens.borderRadiusLarge} ${tokens.borderRadiusLarge} 0 0`,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
  },
  navBtn: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground2,
    background: 'transparent',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    marginBottom: '-1px',
    ':hover': { color: tokens.colorNeutralForeground1 },
  },
  navBtnActive: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
    background: 'transparent',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorBrandForeground1,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    marginBottom: '-1px',
  },
  cacheCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalL,
  },
  cacheCardInfo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  section: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    marginBottom: tokens.spacingVerticalXS,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: tokens.fontSizeBase200,
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
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase100,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  thR: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    textAlign: 'right',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase100,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  td: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    verticalAlign: 'middle',
    ':last-child': { borderBottom: 'none' },
  },
  tdR: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: tokens.fontWeightSemibold,
  },
  barBg: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusCircular,
    height: '6px',
    width: '100%',
    minWidth: '80px',
  },
  finding: {
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  findingCritical: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderLeftColor: tokens.colorPaletteRedBorderActive,
  },
  findingWarn: {
    backgroundColor: tokens.colorPaletteMarigoldBackground1,
    borderLeftColor: tokens.colorPaletteMarigoldBorderActive,
  },
  findingInfo: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderLeftColor: tokens.colorNeutralStroke1,
  },
  codeBlock: {
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    fontFamily: 'Consolas, monospace',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground1,
    wordBreak: 'break-all',
    marginTop: tokens.spacingVerticalXS,
  },
  recNum: {
    textAlign: 'center',
    width: '32px',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground3,
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCreatedTime(item: ResourceItem): string | null {
  const p = item.properties
  if (!p) return null
  const v = p['createdTime'] ?? p['createdDateTime'] ?? p['created'] ?? p['createdOn'] ?? p['createdon']
  return typeof v === 'string' ? v : null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

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

function buildEnvMap(envs: ResourceItem[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const e of envs) {
    const name = getDisplayName(e)
    m.set(e.id, name); m.set(e.name, name)
    const seg = e.id.split('/').pop()
    if (seg) m.set(seg, name)
    m.set(e.id.toLowerCase(), name); m.set(e.name.toLowerCase(), name)
    if (seg) m.set(seg.toLowerCase(), name)
  }
  return m
}

function resolveEnvName(item: ResourceItem, envMap: Map<string, string>): string {
  if (item.environmentId) {
    const r = envMap.get(item.environmentId) ?? envMap.get(item.environmentId.toLowerCase())
    if (r) return r
  }
  const seg = getEnvironmentIdFromPath(item.id)
  if (seg) {
    const r = envMap.get(seg) ?? envMap.get(seg.toLowerCase())
    if (r) return r
    return seg
  }
  return item.environmentName ?? item.environmentId ?? '—'
}

// ── Small shared pieces ───────────────────────────────────────────────────────

function HealthChip({ label, color, onClick }: { label: string; color: 'danger' | 'warning' | 'success' | 'subtle'; onClick?: () => void }) {
  const chip = (
    <Badge appearance="tint" color={color} size="medium" style={{ padding: '6px 12px', fontSize: '13px' }}>
      {label}
    </Badge>
  )
  if (!onClick) return chip
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
      {chip}
    </button>
  )
}

// Staggered entrance for the cinematic hero blocks.
const fadeUp = (delay: number): React.CSSProperties => ({ animation: 'ppFadeUp 0.6s both', animationDelay: `${delay}s` })

// Featured stat for one product pillar (Agents / Apps / Flows) in the hero.
function HeroPillar({ icon, accent, value, label, sub }: {
  icon: React.ReactNode; accent: string; value: number; label: string; sub: string
}) {
  const classes = useClasses()
  return (
    <div className={classes.pillarCard}>
      <div className={classes.pillarGlow} style={{ background: accent }} />
      <div className={classes.pillarTop}>
        <span className={classes.pillarIcon} style={{ color: accent, background: `${accent}22`, border: `1px solid ${accent}55` }}>{icon}</span>
        <span className={classes.pillarLabel}>{label}</span>
      </div>
      <span className={classes.pillarValue}><CountUp value={value} /></span>
      <span className={classes.pillarSub}>{sub}</span>
    </div>
  )
}

// Usage sign-in cache status strip. Shows when the heatmap's cached sign-in
// data was last refreshed by the background job, surfaces in-progress updates,
// and lets the user trigger a manual refresh of the login data.
function UsageCacheStatus() {
  const classes = useClasses()
  const cache = useSignInCache()

  // Nothing to manage if Azure Storage caching isn't configured.
  if (!cache.configured) return null

  const refreshing = cache.status === 'refreshing'
  const errored = cache.status === 'error'

  let icon: React.ReactNode
  let text: React.ReactNode
  if (refreshing) {
    icon = <Spinner size="tiny" />
    text = <>Updating usage sign-in data in the background…</>
  } else if (errored) {
    icon = <WarningRegular style={{ color: tokens.colorStatusWarningForeground1 }} />
    text = (
      <>
        Couldn't update usage data{cache.error ? ` — ${cache.error}` : ''}.
        {cache.cachedAt ? ` Showing data cached ${formatRelative(cache.cachedAt)}.` : ''}
      </>
    )
  } else if (cache.cachedAt) {
    icon = <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
    text = (
      <>
        Usage sign-in data updated {formatRelative(cache.cachedAt)} ·{' '}
        {cache.recordCount.toLocaleString()} sign-ins cached (last {cache.cacheDays} days)
      </>
    )
  } else {
    icon = <DatabaseRegular style={{ color: tokens.colorNeutralForeground3 }} />
    text = <>No usage sign-in data cached yet. Run an update to populate the heatmap.</>
  }

  return (
    <div className={classes.cacheCard}>
      <span className={classes.cacheCardInfo}>
        {icon}
        <span>{text}</span>
      </span>
      <Button
        size="small"
        appearance="secondary"
        icon={<ArrowClockwiseRegular />}
        onClick={cache.refreshNow}
        disabled={refreshing}
      >
        {refreshing ? 'Updating…' : 'Update now'}
      </Button>
    </div>
  )
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


// ── Tab: Overview ─────────────────────────────────────────────────────────────

type TypeGroup = { label: string; count: number; category: string }

function OverviewTab({ allResources, allEnvironments }: ReportViewProps) {
  const classes = useClasses()

  const typeGroups = useMemo((): TypeGroup[] => {
    const counts = new Map<string, { label: string; count: number; category: string }>()
    for (const r of allResources) {
      const cat = getResourceCategory(r.type)
      const lower = r.type.toLowerCase()
      const label = cat === 'agents' ? 'Copilot Agents'
        : lower.includes('m365agentflow') ? 'Workflow Agent Flows'
        : lower.includes('agentflow') ? 'Agent Flows'
        : lower.includes('logic') ? 'Logic Apps'
        : cat === 'flows' ? 'Cloud Flows'
        : lower.includes('canvas') ? 'Canvas Apps'
        : lower.includes('model') ? 'Model-driven Apps'
        : lower.includes('codeapp') ? 'Code Apps'
        : r.type.split('/').pop() ?? r.type
      // Key on the user-facing label so e.g. legacy + current cloud-flow
      // types collapse into a single "Cloud Flows" row.
      const key = cat + '|' + label
      const existing = counts.get(key)
      if (existing) { existing.count++ } else {
        counts.set(key, { label, count: 1, category: cat })
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count)
  }, [allResources])

  const total = allResources.length
  const maxCount = typeGroups[0]?.count ?? 1

  const recent = useMemo(() => {
    return [...allResources]
      .filter(r => getCreatedTime(r))
      .sort((a, b) => {
        const ta = getCreatedTime(a) ?? ''
        const tb = getCreatedTime(b) ?? ''
        return tb.localeCompare(ta)
      })
      .slice(0, 12)
  }, [allResources])

  const envMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])

  return (
    <div className={classes.section}>
      <div>
        <div className={classes.sectionHead}>
          <Text weight="semibold" size={400}>Resource Breakdown</Text>
        </div>
        <div className={classes.card}>
          <table className={classes.table}>
            <thead className={classes.thead}>
              <tr>
                <th className={classes.th}>Resource Type</th>
                <th className={classes.thR}>Count</th>
                <th className={classes.th} style={{ minWidth: '120px' }}>Distribution</th>
                <th className={classes.thR}>Share</th>
              </tr>
            </thead>
            <tbody>
              {typeGroups.map(g => (
                <tr key={g.label + g.category}>
                  <td className={classes.td}><Text size={200}>{g.label}</Text></td>
                  <td className={classes.tdR}>{g.count}</td>
                  <td className={classes.td}><BarCell value={g.count} max={maxCount} /></td>
                  <td className={classes.tdR}>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {total > 0 ? Math.round((g.count / total) * 100) : 0}%
                    </Caption1>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <div className={classes.sectionHead}>
            <Text weight="semibold" size={400}>Recently Created Resources</Text>
          </div>
          <div className={classes.card}>
            <table className={classes.table}>
              <thead className={classes.thead}>
                <tr>
                  <th className={classes.th}>Name</th>
                  <th className={classes.th}>Type</th>
                  <th className={classes.th}>Environment</th>
                  <th className={classes.th}>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r.id}>
                    <td className={classes.td}>
                      <Text size={200} weight="semibold">{getDisplayName(r)}</Text>
                    </td>
                    <td className={classes.td}>
                      <ResourceTypeBadge type={r.type} kind={r.kind} />
                    </td>
                    <td className={classes.td}>
                      <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                        {resolveEnvName(r, envMap)}
                      </Caption1>
                    </td>
                    <td className={classes.td}>
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        {fmtDate(getCreatedTime(r))}
                      </Caption1>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Governance ───────────────────────────────────────────────────────────

type SettingCheck = { label: string; value: boolean | undefined; positive: boolean; severity: 'critical' | 'warning' | 'info' }

function governanceChecks(s: TenantSettings): SettingCheck[] {
  const pp = s.powerPlatform
  return [
    { label: 'Restrict environment creation to admins', value: s.disableEnvironmentCreationByNonAdminUsers, positive: true, severity: 'critical' },
    { label: 'Restrict trial environment creation to admins', value: s.disableTrialEnvironmentCreationByNonAdminUsers, positive: true, severity: 'critical' },
    { label: 'Restrict developer env creation to admins', value: pp?.governance?.disableDeveloperEnvironmentCreationByNonAdminUsers, positive: true, severity: 'warning' },
    { label: 'Restrict portal creation to admins', value: s.disablePortalsCreationByNonAdminUsers, positive: true, severity: 'warning' },
    { label: 'Restrict Share with Everyone', value: pp?.powerApps?.disableShareWithEveryone, positive: true, severity: 'warning' },
    { label: 'Guest makers disabled', value: pp?.powerApps?.enableGuestsToMake !== undefined ? !pp!.powerApps!.enableGuestsToMake : undefined, positive: true, severity: 'warning' },
    { label: 'Admin digest emails enabled', value: pp?.governance?.disableAdminDigest !== undefined ? !pp!.governance!.disableAdminDigest : undefined, positive: true, severity: 'info' },
    { label: 'Usage metrics for admins', value: pp?.governance?.disableUsageMetricsForAdmins !== undefined ? !pp!.governance!.disableUsageMetricsForAdmins : undefined, positive: true, severity: 'info' },
  ]
}

function GovernanceTab() {
  const { data, isLoading, isError } = useTenantSettings()
  const classes = useClasses()

  if (isLoading) return <div style={{ padding: tokens.spacingVerticalXL }}><Spinner size="small" label="Loading tenant settings…" /></div>
  if (isError || !data) return (
    <div className={classes.finding + ' ' + classes.findingInfo} style={{ border: `1px solid ${tokens.colorNeutralStroke2}` }}>
      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Requires Power Platform admin permissions (BAP API). Sign in with an admin account.</Caption1>
    </div>
  )

  const checks = governanceChecks(data)
  const findings = checks.filter(c => {
    if (c.value === undefined) return false
    return c.positive ? !c.value : c.value
  })

  return (
    <div className={classes.section}>
      {findings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS }}>
          {findings.map(f => (
            <div key={f.label} className={`${classes.finding} ${f.severity === 'critical' ? classes.findingCritical : classes.findingWarn}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                {f.severity === 'critical'
                  ? <ErrorCircleRegular fontSize={16} style={{ color: tokens.colorPaletteRedForeground1 }} />
                  : <WarningRegular fontSize={16} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />
                }
                <Text size={300} weight="semibold">{f.label}</Text>
              </div>
              <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                Currently: <strong>{f.positive ? 'disabled (not enforced)' : 'enabled'}</strong>. Remediate via Power Platform admin center or PAC CLI.
              </Caption1>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className={classes.sectionHead}>
          <Text weight="semibold" size={400}>Tenant Settings</Text>
        </div>
        <div className={classes.card}>
          <table className={classes.table}>
            <thead className={classes.thead}>
              <tr>
                <th className={classes.th}>Setting</th>
                <th className={classes.th}>Status</th>
                <th className={classes.th}>Severity</th>
              </tr>
            </thead>
            <tbody>
              {checks.filter(c => c.value !== undefined).map(c => {
                const isGood = c.positive ? c.value : !c.value
                return (
                  <tr key={c.label}>
                    <td className={classes.td}><Text size={200}>{c.label}</Text></td>
                    <td className={classes.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isGood
                          ? <CheckmarkCircleRegular fontSize={14} style={{ color: tokens.colorPaletteGreenForeground1 }} />
                          : <WarningRegular fontSize={14} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />
                        }
                        <Caption1 style={{ color: isGood ? tokens.colorPaletteGreenForeground1 : tokens.colorNeutralForeground2 }}>
                          {c.value ? 'Enabled' : 'Disabled'}
                        </Caption1>
                      </div>
                    </td>
                    <td className={classes.td}>
                      {isGood
                        ? <Badge appearance="tint" color="success" size="small">Good</Badge>
                        : c.severity === 'critical'
                          ? <Badge appearance="tint" color="danger" size="small">Critical</Badge>
                          : <Badge appearance="tint" color="warning" size="small">Warning</Badge>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Recommendations ──────────────────────────────────────────────────────

type Rec = { priority: 'Critical' | 'High' | 'Medium' | 'Low'; action: string; why: string; how: string }

export function buildRecs(
  allEnvironments: ResourceItem[],
  dlp: DLPPolicy[] | undefined,
  settings: TenantSettings | undefined,
): Rec[] {
  const recs: Rec[] = []
  const managedCount = allEnvironments.filter(e => getIsManagedEnvironment(e)).length

  if (dlp) {
    const hasNoConf = dlp.length === 0 || dlp.every(p => !(p.connectorGroups ?? []).some(g => g.classification.toLowerCase() === 'confidential' && g.connectors.length > 0))
    if (hasNoConf) recs.push({ priority: 'Critical', action: 'Reclassify DLP connectors — move sensitive connectors to Confidential', why: 'All connectors in General allows any data to flow anywhere with no DLP protection.', how: 'Edit DLP policy in Power Platform admin center. Move Dataverse, SharePoint, SQL, Office 365 to Confidential.' })

    const hasNoBlock = dlp.every(p => !(p.connectorGroups ?? []).some(g => g.classification.toLowerCase() === 'blocked' && g.connectors.length > 0))
    if (hasNoBlock) recs.push({ priority: 'Critical', action: 'Block high-risk connectors (HTTP, custom connectors)', why: 'HTTP connector allows calling any external API, bypassing DLP intent.', how: 'Add HTTP connector and custom connectors to the Blocked group in all production policies.' })

    // ACP is the GA replacement for classic DLP. Recommend migration whenever
    // classic data policies are still in use.
    if (dlp.length > 0) recs.push({ priority: 'Medium', action: 'Adopt Advanced Connector Policies (ACP) — the modern replacement for classic DLP', why: 'ACP (now GA) uses a default-deny allowlist with action-level control and design-time enforcement, replacing the Business/Non-Business/Blocked model with simpler, stronger connector governance.', how: 'Power Platform admin center → Environment groups → Rules → Advanced connector policies (or per environment: Security → Data and privacy). Run mixed mode during migration, then enable ACP-only mode. Docs: aka.ms/AdvancedConnectorPolicies' })
  }

  if (settings) {
    if (!settings.disableEnvironmentCreationByNonAdminUsers)
      recs.push({ priority: 'Critical', action: 'Restrict environment creation to admins only', why: 'Any licensed user can create production/sandbox environments causing sprawl and shadow IT.', how: 'pac admin update-tenant-settings --setting-name "disableEnvironmentCreationByNonAdminUsers" --setting-value "true"' })
    if (!settings.disableTrialEnvironmentCreationByNonAdminUsers)
      recs.push({ priority: 'Critical', action: 'Restrict trial environment creation to admins', why: 'Trials auto-expire after 30 days; users may build real workloads then lose data.', how: 'pac admin update-tenant-settings --setting-name "disableTrialEnvironmentCreationByNonAdminUsers" --setting-value "true"' })
    if (!settings.powerPlatform?.governance?.disableDeveloperEnvironmentCreationByNonAdminUsers)
      recs.push({ priority: 'High', action: 'Restrict developer environment creation', why: 'Developer environments consume capacity and expand the ungoverned inventory.', how: 'pac admin update-tenant-settings --setting-name "powerPlatform.governance.disableDeveloperEnvironmentCreationByNonAdminUsers" --setting-value "true"' })
    if (!settings.disablePortalsCreationByNonAdminUsers)
      recs.push({ priority: 'Medium', action: 'Restrict portal (Power Pages) creation to admins', why: 'Power Pages sites expose Dataverse data externally with no admin visibility.', how: 'pac admin update-tenant-settings --setting-name "disablePortalsCreationByNonAdminUsers" --setting-value "true"' })
    if (!settings.powerPlatform?.powerApps?.disableShareWithEveryone)
      recs.push({ priority: 'Medium', action: 'Disable Share with Everyone for Canvas Apps', why: 'Allows any user to share apps with the entire organization uncontrolled.', how: 'pac admin update-tenant-settings --setting-name "powerPlatform.powerApps.disableShareWithEveryone" --setting-value "true"' })
  }

  if (managedCount < allEnvironments.length) {
    recs.push({ priority: 'High', action: `Enable Managed Environments (${allEnvironments.length - managedCount} of ${allEnvironments.length} not managed)`, why: 'Non-managed environments lack admin insights, usage tracking, and weekly digests.', how: 'pac admin set-governance-config --environment "<id>" --protection-level Standard' })
  }

  return recs
}

export function RecsTab({ allEnvironments }: { allEnvironments: ResourceItem[] }) {
  const { data: dlp } = useDLPPolicies()
  const { data: settings } = useTenantSettings()
  const classes = useClasses()

  const recs = useMemo(() => buildRecs(allEnvironments, dlp, settings), [allEnvironments, dlp, settings])

  const priorityColor = (p: Rec['priority']): 'danger' | 'warning' | 'informative' | 'subtle' =>
    p === 'Critical' ? 'danger' : p === 'High' ? 'warning' : p === 'Medium' ? 'informative' : 'subtle'

  if (recs.length === 0) {
    return (
      <div className={classes.finding} style={{ backgroundColor: tokens.colorPaletteGreenBackground1, borderLeftColor: tokens.colorPaletteGreenBorderActive }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
          <CheckmarkCircleRegular fontSize={16} style={{ color: tokens.colorPaletteGreenForeground1 }} />
          <Text size={300} weight="semibold">No critical recommendations — governance looks healthy</Text>
        </div>
      </div>
    )
  }

  return (
    <div className={classes.section}>
      <div className={classes.sectionHead}>
        <Text weight="semibold" size={400}>Prioritized Recommendations ({recs.length})</Text>
      </div>
      <div className={classes.card} style={{ overflowX: 'auto' }}>
        <table className={classes.table}>
          <thead className={classes.thead}>
            <tr>
              <th className={classes.th} style={{ width: '32px' }}>#</th>
              <th className={classes.th}>Priority</th>
              <th className={classes.th}>Action</th>
              <th className={classes.th}>Why</th>
              <th className={classes.th}>How</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r, i) => (
              <tr key={i}>
                <td className={classes.td} style={{ textAlign: 'center', color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightBold }}>{i + 1}</td>
                <td className={classes.td}><Badge appearance="tint" color={priorityColor(r.priority)} size="small">{r.priority}</Badge></td>
                <td className={classes.td}><Text size={200} weight="semibold">{r.action}</Text></td>
                <td className={classes.td}><Caption1 style={{ color: tokens.colorNeutralForeground2 }}>{r.why}</Caption1></td>
                <td className={classes.td} style={{ maxWidth: '280px' }}>
                  <div className={classes.codeBlock}>{r.how}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

type ReportTab = 'overview' | 'governance' | 'recommendations'

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'governance', label: 'Tenant Governance' },
  { id: 'recommendations', label: 'Recommendations' },
]

export function ReportView({ allResources, allEnvironments, onNavigateToRiskAssessments }: ReportViewProps) {
  const [tab, setTab] = useState<ReportTab>('overview')
  const classes = useClasses()
  const { mode } = useThemeMode()

  const agentCount = allResources.filter(r => getResourceCategory(r.type) === 'agents').length
  const appCount = allResources.filter(r => getResourceCategory(r.type) === 'apps').length
  const flowCount = allResources.filter(r => getResourceCategory(r.type) === 'flows').length
  const managedCount = allEnvironments.filter(e => getIsManagedEnvironment(e)).length
  const { data: settings } = useTenantSettings()
  const { data: dlp } = useDLPPolicies()
  const { data: assessments } = useAdminData()
  const recs = useMemo(() => buildRecs(allEnvironments, dlp, settings), [allEnvironments, dlp, settings])
  const criticalCount = recs.filter(r => r.priority === 'Critical').length
  const highCount = recs.filter(r => r.priority === 'High').length

  const compliantCount = useMemo(
    () => allResources.filter(r => assessments[r.id]?.complianceStatus === 'Compliant').length,
    [allResources, assessments],
  )
  const notReviewedCount = useMemo(
    () => allResources.filter(r => {
      const s = assessments[r.id]?.complianceStatus
      return !s || s === 'Not Reviewed'
    }).length,
    [allResources, assessments],
  )

  return (
    <div className={classes.root}>
      {/* Hero — cinematic command center */}
      <div className={classes.hero} style={mode === 'light' ? { background: HERO_BG_LIGHT } : undefined}>
        <CommandBackdrop />
        <div className={classes.heroInner}>
          <div className={classes.heroTopRow} style={fadeUp(0)}>
            <span className={classes.heroEyebrow}>Power Platform · Command Center</span>
            <span className={classes.livePill}>
              <span className={classes.liveDot} style={{ animation: 'ppPulseRing 2s ease-out infinite' }} />
              LIVE · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div style={fadeUp(0.06)}>
            <h1 className={classes.heroTitle}>Inventory &amp; Governance</h1>
            <Caption1 className={classes.heroSub}>
              Real-time view of every Agent, App, and Flow across your tenant.
            </Caption1>
          </div>

          <div className={classes.pillarRow} style={fadeUp(0.12)}>
            <HeroPillar icon={<CopilotStudioIcon fontSize={22} />} accent="#3ad1c4" value={agentCount} label="Agents" sub="Agents" />
            <HeroPillar icon={<PowerAppsIcon fontSize={22} />} accent="#b07cff" value={appCount} label="Apps" sub="Canvas & model-driven" />
            <HeroPillar icon={<PowerAutomateIcon fontSize={22} />} accent="#4aa8ff" value={flowCount} label="Flows" sub="Cloud & desktop" />
          </div>

          <div className={classes.secondaryRow} style={fadeUp(0.18)}>
            <div className={classes.miniStat}><span className={classes.miniValue}><CountUp value={allEnvironments.length} /></span><span className={classes.miniLabel}>Environments</span></div>
            <div className={classes.miniStat}><span className={classes.miniValue}><CountUp value={managedCount} /></span><span className={classes.miniLabel}>Managed Envs</span></div>
            <div className={classes.miniStat}><span className={classes.miniValue}><CountUp value={allResources.length} /></span><span className={classes.miniLabel}>Total Resources</span></div>
          </div>

          <div className={classes.healthBar} style={fadeUp(0.24)}>
            {criticalCount > 0 && <HealthChip label={`${criticalCount} Critical`} color="danger" />}
            {highCount > 0 && <HealthChip label={`${highCount} High Priority`} color="warning" />}
            {compliantCount > 0 && (
              <HealthChip
                label={`${compliantCount} Compliant Resources`}
                color="success"
                onClick={onNavigateToRiskAssessments}
              />
            )}
            {notReviewedCount > 0 && (
              <HealthChip
                label={`${notReviewedCount} Not Reviewed — Review Now`}
                color="warning"
                onClick={onNavigateToRiskAssessments}
              />
            )}
            {!settings && <HealthChip label="Connect BAP API for full governance analysis" color="subtle" />}
          </div>
        </div>
      </div>

      {/* Usage sign-in cache status + manual refresh */}
      <UsageCacheStatus />

      {/* Nav tabs */}
      <div className={classes.navRow}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? classes.navBtnActive : classes.navBtn}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab allResources={allResources} allEnvironments={allEnvironments} />}
      {tab === 'governance' && <GovernanceTab />}
      {tab === 'recommendations' && <RecsTab allEnvironments={allEnvironments} />}

      <div style={{ textAlign: 'center', padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3, borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: tokens.colorNeutralStroke2, marginTop: tokens.spacingVerticalL }}>
        <Caption1>Inventory and Governance Report · Generated {new Date().toLocaleString()}</Caption1>
      </div>
    </div>
  )
}
