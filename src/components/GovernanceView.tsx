import { useMemo, useState } from 'react'
import {
  makeStyles,
  tokens,
  Text,
  Caption1,
  Badge,
  Spinner,
  Button,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
} from '@fluentui/react-components'
import {
  ShieldRegular,
  ShieldCheckmarkRegular,
  WarningRegular,
  ErrorCircleRegular,
  CheckmarkCircleRegular,
  LockClosedRegular,
  GlobeRegular,
  PersonRegular,
  InfoRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  ArrowLeftRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getResourceCategory, getEnvironmentIdFromPath, getDisplayName, getIsManagedEnvironment } from '../types'
import { useDLPPolicies, useTenantSettings } from '../hooks/useGovernance'
import type { DLPPolicy, TenantSettings } from '../hooks/useGovernance'

interface GovernanceViewProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
}

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  sectionCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    overflow: 'hidden',
  },
  sectionCardWarn: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    overflow: 'hidden',
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorPaletteMarigoldBorderActive,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  sectionHeaderClickable: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground3,
    cursor: 'pointer',
    userSelect: 'none',
    ':hover': { backgroundColor: tokens.colorNeutralBackground3Hover },
  },
  sectionHeaderClickableOpen: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground3,
    cursor: 'pointer',
    userSelect: 'none',
    ':hover': { backgroundColor: tokens.colorNeutralBackground3Hover },
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  sectionBody: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: tokens.spacingHorizontalM,
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
  },
  summaryCard: {
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  rowLeft: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  permissionNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground3,
  },
  insightRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  insightRowClickable: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorBrandBackground2 },
    marginLeft: `-${tokens.spacingHorizontalL}`,
    marginRight: `-${tokens.spacingHorizontalL}`,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  insightIcon: { marginTop: '2px', flexShrink: 0 },
  dlpRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  drillRoot: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  envRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
})

// ── Computed insights ────────────────────────────────────────────────────────

export type InsightKey = 'unmanaged-envs'

export interface Insight {
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  drillDownKey?: InsightKey
}

export function computeInsights(resources: ResourceItem[], environments: ResourceItem[]): Insight[] {
  const insights: Insight[] = []
  const envIds = new Set(environments.map(e => e.name))

  const orphaned = resources.filter(r => {
    const envId = getEnvironmentIdFromPath(r.id) ?? r.environmentId
    return envId && !envIds.has(envId)
  })
  if (orphaned.length > 0) {
    insights.push({
      severity: 'warning',
      title: `${orphaned.length} resource${orphaned.length !== 1 ? 's' : ''} in unrecognized environments`,
      detail: 'These resources reference environment IDs not returned by the environments API. They may be in environments you do not have access to, or the environment may have been deleted.',
    })
  }

  const unmanaged = environments.filter(e => !getIsManagedEnvironment(e))
  if (unmanaged.length > 0) {
    insights.push({
      severity: 'warning',
      title: `${unmanaged.length} unmanaged environment${unmanaged.length !== 1 ? 's' : ''}`,
      detail: 'Managed Environments unlock advanced governance controls like DLP policy enforcement, weekly digests, and usage insights. Consider enabling Managed Environments for production environments.',
      drillDownKey: 'unmanaged-envs',
    })
  }

  const defaultEnvs = environments.filter(e => e.environmentType?.toLowerCase() === 'default')
  if (defaultEnvs.length > 0) {
    insights.push({
      severity: 'info',
      title: `Default environment${defaultEnvs.length !== 1 ? 's' : ''} detected: ${defaultEnvs.map(e => getDisplayName(e)).join(', ')}`,
      detail: 'Default environments are shared by all users in the tenant. Consider restricting app and flow creation in default environments via DLP policies and tenant settings.',
    })
  }

  const agentCount = resources.filter(r => getResourceCategory(r.type) === 'agents').length
  const flowCount = resources.filter(r => getResourceCategory(r.type) === 'flows').length
  if (agentCount > 0 && flowCount === 0) {
    insights.push({
      severity: 'info',
      title: `${agentCount} agent${agentCount !== 1 ? 's' : ''} with no cloud flows`,
      detail: 'Agents without backing cloud flows may have limited automation capabilities. Consider reviewing agent configurations.',
    })
  }

  if (insights.length === 0) {
    insights.push({
      severity: 'info',
      title: 'No significant issues detected from resource data',
      detail: 'Connect to the BAP API (requires Power Platform admin permissions) to unlock DLP policy analysis and tenant settings audit.',
    })
  }

  return insights
}

// ── Helper components ────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: Insight['severity'] }) {
  if (severity === 'critical') return <ErrorCircleRegular fontSize={16} style={{ color: tokens.colorPaletteRedForeground1 }} />
  if (severity === 'warning') return <WarningRegular fontSize={16} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />
  return <InfoRegular fontSize={16} style={{ color: tokens.colorNeutralForeground3 }} />
}

function SettingRow({ label, value, positive }: { label: string; value: boolean | undefined; positive: boolean }) {
  const classes = useClasses()
  if (value === undefined) return null
  const isGood = positive ? value : !value
  return (
    <div className={classes.row}>
      <div className={classes.rowLeft}>
        {isGood
          ? <CheckmarkCircleRegular fontSize={14} style={{ color: tokens.colorPaletteGreenForeground1 }} />
          : <WarningRegular fontSize={14} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />
        }
        <Text size={200}>{label}</Text>
      </div>
      <Badge appearance="tint" color={isGood ? 'success' : 'warning'} size="small">
        {value ? 'Enabled' : 'Disabled'}
      </Badge>
    </div>
  )
}

function PermissionNotice({ classes }: { classes: ReturnType<typeof useClasses> }) {
  return (
    <div className={classes.permissionNotice}>
      <LockClosedRegular fontSize={16} />
      <Caption1>Requires Power Platform admin permissions (BAP API scope). Sign in with an admin account to view this data.</Caption1>
    </div>
  )
}

// ── Environment drill-down ───────────────────────────────────────────────────

export function EnvironmentDrillDown({
  allEnvironments,
  allResources,
  onBack,
}: {
  allEnvironments: ResourceItem[]
  allResources: ResourceItem[]
  onBack: () => void
}) {
  const classes = useClasses()

  const resourceCount = (env: ResourceItem) =>
    allResources.filter(r => (getEnvironmentIdFromPath(r.id) ?? r.environmentId) === env.name).length

  const unmanaged = allEnvironments.filter(e => !getIsManagedEnvironment(e))
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
  const managed = allEnvironments.filter(e => getIsManagedEnvironment(e))
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))

  return (
    <div className={classes.drillRoot}>
      <div className={classes.breadcrumb}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} size="small" onClick={onBack}>
          Resource Insights
        </Button>
        <Text style={{ color: tokens.colorNeutralForeground3 }}>/</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
          <GlobeRegular style={{ color: tokens.colorBrandForeground2, fontSize: '16px' }} />
          <Text weight="semibold">Unmanaged Environments</Text>
        </div>
        <Badge appearance="tint" color="warning" size="small">{unmanaged.length} unmanaged</Badge>
        <Badge appearance="tint" color="subtle" size="small">{managed.length} managed</Badge>
      </div>

      <div className={classes.sectionCard}>
        <div className={classes.sectionHeader}>
          <WarningRegular fontSize={16} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />
          <Text weight="semibold">Unmanaged Environments</Text>
          <Badge appearance="tint" color="warning" size="small">{unmanaged.length}</Badge>
        </div>
        <div style={{ padding: `0 ${tokens.spacingHorizontalL}` }}>
          {unmanaged.map(env => {
            const count = resourceCount(env)
            return (
              <div key={env.id} className={classes.envRow}>
                <div className={classes.rowLeft}>
                  <GlobeRegular fontSize={16} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
                  <div>
                    <Text size={200} weight="semibold" style={{ display: 'block' }}>{getDisplayName(env)}</Text>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {env.environmentType ?? '—'}{env.environmentRegion ? ` · ${env.environmentRegion}` : ''}
                    </Caption1>
                  </div>
                </div>
                <Badge appearance="tint" color="subtle" size="small">{count} resource{count !== 1 ? 's' : ''}</Badge>
              </div>
            )
          })}
        </div>
      </div>

      {managed.length > 0 && (
        <div className={classes.sectionCard}>
          <Accordion collapsible>
            <AccordionItem value="managed">
              <AccordionHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                  <ShieldCheckmarkRegular fontSize={16} style={{ color: tokens.colorPaletteGreenForeground1 }} />
                  <Text weight="semibold">Managed Environments</Text>
                  <Badge appearance="tint" color="success" size="small">{managed.length}</Badge>
                </div>
              </AccordionHeader>
              <AccordionPanel>
                <div style={{ padding: `0 ${tokens.spacingHorizontalL}` }}>
                  {managed.map(env => {
                    const count = resourceCount(env)
                    return (
                      <div key={env.id} className={classes.envRow}>
                        <div className={classes.rowLeft}>
                          <ShieldCheckmarkRegular fontSize={16} style={{ color: tokens.colorPaletteGreenForeground1, flexShrink: 0 }} />
                          <div>
                            <Text size={200} weight="semibold" style={{ display: 'block' }}>{getDisplayName(env)}</Text>
                            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                              {env.environmentType ?? '—'}{env.environmentRegion ? ` · ${env.environmentRegion}` : ''}
                            </Caption1>
                          </div>
                        </div>
                        <Badge appearance="tint" color="subtle" size="small">{count} resource{count !== 1 ? 's' : ''}</Badge>
                      </div>
                    )
                  })}
                </div>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  )
}

// ── DLP Policy detail view ───────────────────────────────────────────────────

export function DLPPolicyDetail({
  policy,
  environments,
  onBack,
}: {
  policy: DLPPolicy
  environments: ResourceItem[]
  onBack: () => void
}) {
  const classes = useClasses()

  const envMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const env of environments) m.set(env.name, getDisplayName(env))
    return m
  }, [environments])

  const isAllEnv = policy.environmentType === 'AllEnvironments' || policy.type === 'AllEnvironments'

  const classificationColor = (c: string) => {
    const l = c.toLowerCase()
    if (l === 'blocked') return tokens.colorPaletteRedForeground1
    if (l === 'confidential' || l === 'hbi') return tokens.colorPaletteMarigoldForeground2
    return tokens.colorNeutralForeground2
  }

  return (
    <div className={classes.drillRoot}>
      <div className={classes.breadcrumb}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} size="small" onClick={onBack}>
          DLP Policies
        </Button>
        <Text style={{ color: tokens.colorNeutralForeground3 }}>/</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
          <LockClosedRegular style={{ color: tokens.colorBrandForeground2, fontSize: '16px' }} />
          <Text weight="semibold">{policy.displayName ?? policy.name}</Text>
        </div>
        {isAllEnv
          ? <Badge appearance="tint" color="informative" size="small">All Environments</Badge>
          : <Badge appearance="tint" color="subtle" size="small">{policy.environments?.length ?? 0} environment{(policy.environments?.length ?? 0) !== 1 ? 's' : ''}</Badge>
        }
      </div>

      {/* Environment scope */}
      {!isAllEnv && policy.environments && policy.environments.length > 0 && (
        <div className={classes.sectionCard}>
          <div className={classes.sectionHeader}>
            <GlobeRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />
            <Text weight="semibold">Environment Scope</Text>
            <Badge appearance="tint" color="subtle" size="small">{policy.environments.length}</Badge>
          </div>
          <div style={{ padding: `0 ${tokens.spacingHorizontalL}` }}>
            {policy.environments.map(env => (
              <div key={env.name} className={classes.envRow}>
                <div className={classes.rowLeft}>
                  <GlobeRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3 }} />
                  <Text size={200}>{envMap.get(env.name) ?? env.name}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connector groups */}
      {policy.connectorGroups && policy.connectorGroups.length > 0 && policy.connectorGroups.map(group => (
        <div key={group.classification} className={classes.sectionCard}>
          <div className={classes.sectionHeader}>
            <LockClosedRegular fontSize={16} style={{ color: classificationColor(group.classification) }} />
            <Text weight="semibold">{group.classification}</Text>
            <Badge appearance="tint" color="subtle" size="small">{group.connectors.length} connector{group.connectors.length !== 1 ? 's' : ''}</Badge>
          </div>
          {group.connectors.length === 0 ? (
            <div className={classes.sectionBody}>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No connectors in this group</Caption1>
            </div>
          ) : (
            <div style={{ padding: `0 ${tokens.spacingHorizontalL}` }}>
              {group.connectors.map(c => (
                <div key={c.id} className={classes.envRow}>
                  <Text size={200}>{c.name}</Text>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── DLP Section (policy list) ────────────────────────────────────────────────

export function DLPSection({
  policies,
  onPolicyClick,
}: {
  policies: DLPPolicy[]
  onPolicyClick: (p: DLPPolicy) => void
}) {
  const classes = useClasses()

  const allEnvPolicy = policies.find(p => p.environmentType === 'AllEnvironments' || p.type === 'AllEnvironments')

  if (policies.length === 0) {
    return (
      <div className={classes.sectionBody}>
        <div className={classes.permissionNotice} style={{ backgroundColor: tokens.colorPaletteRedBackground1 }}>
          <WarningRegular fontSize={16} style={{ color: tokens.colorPaletteRedForeground1 }} />
          <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>No DLP policies found. All connectors are unrestricted.</Caption1>
        </div>
      </div>
    )
  }

  return (
    <div className={classes.sectionBody}>
      <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center', marginBottom: tokens.spacingVerticalXS }}>
        <Badge appearance="tint" color="informative" size="small">{policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}</Badge>
        {allEnvPolicy && <Badge appearance="tint" color="success" size="small">Tenant-wide policy active</Badge>}
      </div>
      {policies.map((p, i) => {
        const isAllEnv = p.environmentType === 'AllEnvironments' || p.type === 'AllEnvironments'
        const connectorTotal = p.connectorGroups?.reduce((sum, g) => sum + g.connectors.length, 0) ?? 0
        return (
          <div key={p.name ?? i} className={classes.insightRowClickable} onClick={() => onPolicyClick(p)}>
            <ShieldCheckmarkRegular fontSize={16} style={{ color: tokens.colorBrandForeground1, flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size={200} weight="semibold" style={{ display: 'block' }}>{p.displayName ?? p.name}</Text>
              <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS, marginTop: '2px', flexWrap: 'wrap' }}>
                {isAllEnv
                  ? <Badge appearance="tint" color="informative" size="small">All Environments</Badge>
                  : <Badge appearance="tint" color="subtle" size="small">{p.environments?.length ?? 0} env{(p.environments?.length ?? 0) !== 1 ? 's' : ''}</Badge>
                }
                {connectorTotal > 0 && <Badge appearance="tint" color="subtle" size="small">{connectorTotal} connectors</Badge>}
              </div>
            </div>
            <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Tenant Settings warning counter ─────────────────────────────────────────

export function countTenantWarnings(s: TenantSettings): number {
  const pp = s.powerPlatform
  // Each entry: [value, positive] — a warning fires when (positive && !value) || (!positive && value)
  const checks: [boolean | undefined, boolean][] = [
    [s.disableEnvironmentCreationByNonAdminUsers, true],
    [s.disableTrialEnvironmentCreationByNonAdminUsers, true],
    [pp?.governance?.disableDeveloperEnvironmentCreationByNonAdminUsers, true],
    [s.disablePortalsCreationByNonAdminUsers, true],
    [pp?.powerApps?.disableShareWithEveryone, true],
    [pp?.powerApps?.enableGuestsToMake, false],
    [pp?.powerAutomate?.disableCopilot !== undefined ? !pp!.powerAutomate!.disableCopilot : undefined, true],
    [pp?.intelligence?.disableCopilot !== undefined ? !pp!.intelligence!.disableCopilot : undefined, true],
    [pp?.intelligence?.enableOpenAiBotPublishing, false],
    [pp?.governance?.disableAdminDigest !== undefined ? !pp!.governance!.disableAdminDigest : undefined, true],
    [pp?.governance?.disableUsageMetricsForAdmins !== undefined ? !pp!.governance!.disableUsageMetricsForAdmins : undefined, true],
    [s.disableCapacityAllocationByEnvironmentAdmins !== undefined ? !s.disableCapacityAllocationByEnvironmentAdmins : undefined, true],
  ]
  return checks.filter(([value, positive]) => {
    if (value === undefined) return false
    return positive ? !value : value
  }).length
}

// ── Tenant Settings Section ──────────────────────────────────────────────────

export function TenantSettingsSection({ settings }: { settings: TenantSettings }) {
  const classes = useClasses()
  const pp = settings.powerPlatform

  return (
    <div className={classes.sectionBody}>
      <div>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: tokens.spacingVerticalXS }}>
          Environment Creation
        </Caption1>
        <SettingRow label="Restrict environment creation to admins" value={settings.disableEnvironmentCreationByNonAdminUsers} positive={true} />
        <SettingRow label="Restrict trial environment creation to admins" value={settings.disableTrialEnvironmentCreationByNonAdminUsers} positive={true} />
        <SettingRow label="Restrict developer environment creation to admins" value={pp?.governance?.disableDeveloperEnvironmentCreationByNonAdminUsers} positive={true} />
        <SettingRow label="Restrict portal creation to admins" value={settings.disablePortalsCreationByNonAdminUsers} positive={true} />
      </div>
      <div>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: tokens.spacingVerticalXS }}>
          Power Apps
        </Caption1>
        <SettingRow label="Restrict Share with Everyone" value={pp?.powerApps?.disableShareWithEveryone} positive={true} />
        <SettingRow label="Allow guests to create apps" value={pp?.powerApps?.enableGuestsToMake} positive={false} />
      </div>
      <div>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: tokens.spacingVerticalXS }}>
          AI & Copilot
        </Caption1>
        <SettingRow label="Copilot in Power Automate" value={pp?.powerAutomate?.disableCopilot !== undefined ? !pp.powerAutomate.disableCopilot : undefined} positive={true} />
        <SettingRow label="Copilot (tenant-wide)" value={pp?.intelligence?.disableCopilot !== undefined ? !pp.intelligence.disableCopilot : undefined} positive={true} />
        <SettingRow label="OpenAI bot publishing" value={pp?.intelligence?.enableOpenAiBotPublishing} positive={false} />
      </div>
      <div>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: tokens.spacingVerticalXS }}>
          Admin & Governance
        </Caption1>
        <SettingRow label="Admin digest emails" value={pp?.governance?.disableAdminDigest !== undefined ? !pp.governance.disableAdminDigest : undefined} positive={true} />
        <SettingRow label="Usage metrics for admins" value={pp?.governance?.disableUsageMetricsForAdmins !== undefined ? !pp.governance.disableUsageMetricsForAdmins : undefined} positive={true} />
        <SettingRow label="Capacity allocation by env admins" value={settings.disableCapacityAllocationByEnvironmentAdmins !== undefined ? !settings.disableCapacityAllocationByEnvironmentAdmins : undefined} positive={true} />
      </div>
    </div>
  )
}

// ── Collapsible section wrapper ──────────────────────────────────────────────

function CollapsibleSection({
  icon,
  title,
  warnCount,
  loading,
  children,
}: {
  icon: React.ReactNode
  title: string
  warnCount?: number
  loading?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const classes = useClasses()
  const hasWarn = !!warnCount && warnCount > 0

  return (
    <div className={hasWarn ? classes.sectionCardWarn : classes.sectionCard}>
      <div
        className={open ? classes.sectionHeaderClickableOpen : classes.sectionHeaderClickable}
        onClick={() => setOpen(o => !o)}
      >
        {icon}
        <Text weight="semibold" style={{ flex: 1 }}>{title}</Text>
        {loading && <Spinner size="extra-tiny" />}
        {hasWarn && (
          <Badge appearance="tint" color="warning" size="small">
            {warnCount} warning{warnCount !== 1 ? 's' : ''}
          </Badge>
        )}
        {open
          ? <ChevronDownRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
          : <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
        }
      </div>
      {open && children}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function GovernanceView({ allResources, allEnvironments }: GovernanceViewProps) {
  const classes = useClasses()
  const dlpQuery = useDLPPolicies()
  const settingsQuery = useTenantSettings()
  const [drillDown, setDrillDown] = useState<InsightKey | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<DLPPolicy | null>(null)

  const insights = useMemo(
    () => computeInsights(allResources, allEnvironments),
    [allResources, allEnvironments],
  )

  const criticalCount = insights.filter(i => i.severity === 'critical').length
  const settingsWarnings = settingsQuery.data ? countTenantWarnings(settingsQuery.data) : 0
  const warningCount = insights.filter(i => i.severity === 'warning').length + settingsWarnings
  const envCount = allEnvironments.length
  const managedCount = allEnvironments.filter(e => getIsManagedEnvironment(e)).length

  if (selectedPolicy) {
    return (
      <DLPPolicyDetail
        policy={selectedPolicy}
        environments={allEnvironments}
        onBack={() => setSelectedPolicy(null)}
      />
    )
  }

  if (drillDown === 'unmanaged-envs') {
    return (
      <EnvironmentDrillDown
        allEnvironments={allEnvironments}
        allResources={allResources}
        onBack={() => setDrillDown(null)}
      />
    )
  }

  return (
    <div className={classes.root}>

      {/* Summary cards */}
      <div className={classes.summaryGrid}>
        <div className={classes.summaryCard} style={{ backgroundColor: criticalCount > 0 ? tokens.colorPaletteCranberryBackground2 : tokens.colorPaletteGreenBackground1 }}>
          <ErrorCircleRegular fontSize={24} style={{ color: criticalCount > 0 ? tokens.colorPaletteCranberryForeground2 : tokens.colorPaletteGreenForeground1 }} />
          <div>
            <Text size={500} weight="semibold" style={{ display: 'block' }}>{criticalCount}</Text>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Critical</Caption1>
          </div>
        </div>
        <div className={classes.summaryCard} style={{ backgroundColor: warningCount > 0 ? tokens.colorPaletteMarigoldBackground1 : tokens.colorPaletteGreenBackground1 }}>
          <WarningRegular fontSize={24} style={{ color: warningCount > 0 ? tokens.colorPaletteMarigoldForeground2 : tokens.colorPaletteGreenForeground1 }} />
          <div>
            <Text size={500} weight="semibold" style={{ display: 'block' }}>{warningCount}</Text>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Warnings</Caption1>
          </div>
        </div>
        {(() => {
          const allManaged = envCount > 0 && managedCount === envCount
          return (
            <div
              className={classes.summaryCard}
              style={{
                backgroundColor: allManaged ? '#cfe4fa' : '#ddeeff',
                border: `2px solid #004578`,
              }}
            >
              <ShieldCheckmarkRegular fontSize={24} style={{ color: '#004578' }} />
              <div>
                <Text size={500} weight="semibold" style={{ display: 'block', color: '#004578' }}>{managedCount}/{envCount}</Text>
                <Caption1 style={{ color: '#003966' }}>Managed Environments</Caption1>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Resource Insights */}
      <CollapsibleSection
        icon={<ShieldRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        title="Resource Insights"
        warnCount={criticalCount + insights.filter(i => i.severity === 'warning').length}
      >
        <div className={classes.sectionBody}>
          {insights.map((insight, i) => {
            const clickable = !!insight.drillDownKey
            return (
              <div
                key={i}
                className={clickable ? classes.insightRowClickable : classes.insightRow}
                onClick={clickable ? () => setDrillDown(insight.drillDownKey!) : undefined}
              >
                <div className={classes.insightIcon}><SeverityIcon severity={insight.severity} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size={200} weight="semibold" style={{ display: 'block' }}>{insight.title}</Text>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{insight.detail}</Caption1>
                </div>
                {clickable && <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0, marginTop: '2px' }} />}
              </div>
            )
          })}
        </div>
      </CollapsibleSection>

      {/* DLP Policies */}
      <CollapsibleSection
        icon={<LockClosedRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        title="DLP Policies"
        warnCount={dlpQuery.data?.length === 0 ? 1 : 0}
        loading={dlpQuery.isLoading}
      >
        {dlpQuery.isError ? (
          <div className={classes.sectionBody}><PermissionNotice classes={classes} /></div>
        ) : dlpQuery.isLoading ? (
          <div className={classes.sectionBody}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading policies…</Caption1>
          </div>
        ) : dlpQuery.data ? (
          <DLPSection policies={dlpQuery.data} onPolicyClick={setSelectedPolicy} />
        ) : null}
      </CollapsibleSection>

      {/* Tenant Settings */}
      <CollapsibleSection
        icon={<PersonRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        title="Tenant Settings"
        warnCount={settingsWarnings}
        loading={settingsQuery.isLoading}
      >
        {settingsQuery.isError ? (
          <div className={classes.sectionBody}><PermissionNotice classes={classes} /></div>
        ) : settingsQuery.isLoading ? (
          <div className={classes.sectionBody}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading settings…</Caption1>
          </div>
        ) : settingsQuery.data ? (
          <TenantSettingsSection settings={settingsQuery.data} />
        ) : null}
      </CollapsibleSection>

    </div>
  )
}
