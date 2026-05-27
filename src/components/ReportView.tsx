import { useState, useMemo } from 'react'
import { makeStyles, tokens, Text, Caption1, Badge, Spinner } from '@fluentui/react-components'
import {
  ErrorCircleRegular,
  WarningRegular,
  CheckmarkCircleRegular,
  LockClosedRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getResourceCategory, getDisplayName, getIsManagedEnvironment, getEnvironmentIdFromPath } from '../types'
import { useDLPPolicies, useTenantSettings } from '../hooks/useGovernance'
import type { DLPPolicy, TenantSettings } from '../hooks/useGovernance'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { useAdminData } from '../hooks/useAdminData'

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
    background: `linear-gradient(135deg, #00162d 0%, ${tokens.colorBrandBackground} 55%, #5b21b6 100%)`,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXL}`,
    borderRadius: tokens.borderRadiusLarge,
    marginBottom: tokens.spacingVerticalL,
    position: 'relative',
    overflow: 'hidden',
  },
  heroTitle: {
    color: '#ffffff',
    display: 'block',
    marginBottom: tokens.spacingVerticalXS,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.7)',
    display: 'block',
    marginBottom: tokens.spacingVerticalL,
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
    textAlign: 'center',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  statValue: {
    display: 'block',
    color: '#ffffff',
    fontWeight: tokens.fontWeightBold,
    fontVariantNumeric: 'tabular-nums',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.65)',
    display: 'block',
    marginTop: '2px',
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

function BarCell({ value, max }: { value: number; max: number }) {
  const classes = useClasses()
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className={classes.barBg}>
      <div style={{ width: `${pct}%`, backgroundColor: tokens.colorBrandBackground, borderRadius: 'inherit', height: '100%' }} />
    </div>
  )
}

function DashIfZero({ n }: { n: number }) {
  return <>{n}</>
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

type TypeGroup = { label: string; count: number; category: string }

function OverviewTab({ allResources, allEnvironments }: ReportViewProps) {
  const classes = useClasses()

  const typeGroups = useMemo((): TypeGroup[] => {
    const counts = new Map<string, { label: string; count: number; category: string }>()
    for (const r of allResources) {
      const cat = getResourceCategory(r.type)
      const key = cat + '|' + r.type
      const existing = counts.get(key)
      if (existing) { existing.count++ } else {
        const lower = r.type.toLowerCase()
        let label = cat === 'agents' ? 'Copilot Agents'
          : cat === 'flows' ? 'Cloud Flows'
          : lower.includes('canvas') ? 'Canvas Apps'
          : lower.includes('model') ? 'Model-driven Apps'
          : lower.includes('codeapp') ? 'Code Apps'
          : r.type.split('/').pop() ?? r.type
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

// ── Tab: DLP ──────────────────────────────────────────────────────────────────

function DLPTab({ allEnvironments }: { allEnvironments: ResourceItem[] }) {
  const { data, isLoading, isError } = useDLPPolicies()
  const classes = useClasses()

  const envMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])

  if (isLoading) return <div style={{ padding: tokens.spacingVerticalXL }}><Spinner size="small" label="Loading DLP policies…" /></div>
  if (isError || !data) return (
    <div className={classes.finding} style={{ border: `1px solid ${tokens.colorNeutralStroke2}`, backgroundColor: tokens.colorNeutralBackground3, borderLeftColor: tokens.colorNeutralStroke1 }}>
      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Requires Power Platform admin permissions (BAP API). Sign in with an admin account.</Caption1>
    </div>
  )

  const hasNoBlocklist = data.every(p => !(p.connectorGroups ?? []).some(g => g.classification.toLowerCase() === 'blocked' && g.connectors.length > 0))
  const allInGeneral = data.length > 0 && data.every(p => {
    const groups = p.connectorGroups ?? []
    const conf = groups.find(g => g.classification.toLowerCase() === 'confidential')
    return !conf || conf.connectors.length === 0
  })

  return (
    <div className={classes.section}>
      {data.length === 0 && (
        <div className={`${classes.finding} ${classes.findingCritical}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
            <ErrorCircleRegular fontSize={16} style={{ color: tokens.colorPaletteRedForeground1 }} />
            <Text size={300} weight="semibold">No DLP policies found — all connectors unrestricted</Text>
          </div>
          <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
            Without DLP policies, any connector can communicate with any other connector. Sensitive data could be exfiltrated with no audit trail.
          </Caption1>
        </div>
      )}

      {allInGeneral && data.length > 0 && (
        <div className={`${classes.finding} ${classes.findingCritical}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
            <ErrorCircleRegular fontSize={16} style={{ color: tokens.colorPaletteRedForeground1 }} />
            <Text size={300} weight="semibold">All connectors classified as General — no data separation</Text>
          </div>
          <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
            Move sensitive connectors (Dataverse, SharePoint, SQL, Office 365) to the Confidential group to prevent cross-category data flows.
          </Caption1>
        </div>
      )}

      {hasNoBlocklist && data.length > 0 && (
        <div className={`${classes.finding} ${classes.findingWarn}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
            <WarningRegular fontSize={16} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />
            <Text size={300} weight="semibold">No connectors in the Blocked group</Text>
          </div>
          <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
            HTTP and custom connectors can call any external API. Block high-risk connectors in production and default environments.
          </Caption1>
        </div>
      )}

      <div>
        <div className={classes.sectionHead}>
          <LockClosedRegular style={{ color: tokens.colorBrandForeground1 }} />
          <Text weight="semibold" size={400}>DLP Policies ({data.length})</Text>
        </div>
        {data.length === 0 ? (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No policies configured.</Caption1>
        ) : (
          <div className={classes.card} style={{ overflowX: 'auto' }}>
            <table className={classes.table}>
              <thead className={classes.thead}>
                <tr>
                  <th className={classes.th}>Policy Name</th>
                  <th className={classes.th}>Scope</th>
                  <th className={classes.thR}>Confidential</th>
                  <th className={classes.thR}>General</th>
                  <th className={classes.thR}>Blocked</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p, i) => {
                  const isAll = p.environmentType === 'AllEnvironments' || p.type === 'AllEnvironments'
                  const groups = p.connectorGroups ?? []
                  const conf = groups.find(g => g.classification.toLowerCase() === 'confidential')?.connectors.length ?? 0
                  const gen = groups.find(g => g.classification.toLowerCase() === 'general')?.connectors.length ?? 0
                  const blocked = groups.find(g => g.classification.toLowerCase() === 'blocked')?.connectors.length ?? 0
                  return (
                    <tr key={p.name ?? i}>
                      <td className={classes.td}><Text size={200} weight="semibold">{p.displayName ?? p.name}</Text></td>
                      <td className={classes.td}>
                        {isAll
                          ? <Badge appearance="tint" color="informative" size="small">All Environments</Badge>
                          : <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>{p.environments?.map(e => envMap.get(e.name) ?? e.name).join(', ') || '—'}</Caption1>
                        }
                      </td>
                      <td className={classes.tdR}><DashIfZero n={conf} /></td>
                      <td className={classes.tdR}><DashIfZero n={gen} /></td>
                      <td className={classes.tdR}><DashIfZero n={blocked} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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

type ReportTab = 'overview' | 'governance' | 'dlp' | 'recommendations'

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'governance', label: 'Tenant Governance' },
  { id: 'dlp', label: 'DLP Policies' },
  { id: 'recommendations', label: 'Recommendations' },
]

export function ReportView({ allResources, allEnvironments, onNavigateToRiskAssessments }: ReportViewProps) {
  const [tab, setTab] = useState<ReportTab>('overview')
  const classes = useClasses()

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
      {/* Hero */}
      <div className={classes.hero}>
        <Text size={600} weight="bold" className={classes.heroTitle}>Inventory and Governance Report</Text>
        <Caption1 className={classes.heroSub}>
          Live data from your tenant · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Caption1>

        <div className={classes.statGrid}>
          {[
            { value: allEnvironments.length, label: 'Environments' },
            { value: agentCount, label: 'Copilot Agents' },
            { value: appCount, label: 'Apps' },
            { value: flowCount, label: 'Flows' },
            { value: managedCount, label: 'Managed Envs' },
            { value: allResources.length, label: 'Total Resources' },
          ].map(s => (
            <div key={s.label} className={classes.statCard}>
              <Text size={700} weight="bold" className={classes.statValue}>{s.value}</Text>
              <Caption1 className={classes.statLabel}>{s.label}</Caption1>
            </div>
          ))}
        </div>

        <div className={classes.healthBar}>
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
      {tab === 'dlp' && <DLPTab allEnvironments={allEnvironments} />}
      {tab === 'recommendations' && <RecsTab allEnvironments={allEnvironments} />}

      <div style={{ textAlign: 'center', padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3, borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: tokens.colorNeutralStroke2, marginTop: tokens.spacingVerticalL }}>
        <Caption1>Inventory and Governance Report · Generated {new Date().toLocaleString()}</Caption1>
      </div>
    </div>
  )
}
