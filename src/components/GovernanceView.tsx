import { Fragment, useMemo, useState } from 'react'
import {
  makeStyles,
  tokens,
  Text,
  Caption1,
  Badge,
  Spinner,
  Button,
  Input,
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
  DatabaseRegular,
  TagRegular,
  LightbulbRegular,
  PlugConnectedRegular,
  ArrowSyncRegular,
  ArrowDownloadRegular,
  ArrowUploadRegular,
  ArrowSortRegular,
  ChevronUpRegular,
  SearchRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getResourceCategory, getEnvironmentIdFromPath, getDisplayName, getIsManagedEnvironment } from '../types'
import {
  useDLPPolicies, useTenantSettings, useEnvironmentCapacity, useBillingPolicies,
  useCrossTenantConnectionReport, useAdvisorRecommendations, useRecommendationResources, useConnections,
} from '../hooks/useGovernance'
import type {
  DLPPolicy, TenantSettings, EnvironmentCapacity, BillingPolicy,
  CrossTenantConnectionReport, AdvisorRecommendation, ConnectionsResult, PowerConnection,
} from '../hooks/useGovernance'
import { getConnectorInfo } from '../utils/connectors'
import { formatLocalDateTime } from '../utils/format'
import { EnvironmentBadge } from './EnvironmentBadge'

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
  // Environments-style table card, reused by the Connections page.
  envTableWrapper: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    overflow: 'hidden',
    boxShadow: tokens.shadow4,
  },
  envTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: tokens.fontSizeBase200,
    tableLayout: 'fixed' as const,
  },
  envThead: { backgroundColor: tokens.colorNeutralBackground3 },
  envTh: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    textAlign: 'left',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    ':hover': { color: tokens.colorNeutralForeground1 },
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  envThStatic: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  envThInner: { display: 'flex', alignItems: 'center', gap: '4px' },
  envTd: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
  },
  envTr: {
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorBrandBackground2 },
    ':last-child td': { borderBottom: 'none' },
  },
  envNameCell: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, minWidth: 0 },
  // Non-interactive table row (no pointer/hover); used for tenant settings.
  settingsTr: { ':last-child td': { borderBottom: 'none' } },
  // Full-width category divider row inside the settings table.
  settingsCatTd: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
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

  const categories = [
    {
      title: 'Environment Creation',
      rows: [
        { label: 'Restrict environment creation to admins', value: settings.disableEnvironmentCreationByNonAdminUsers, positive: true },
        { label: 'Restrict trial environment creation to admins', value: settings.disableTrialEnvironmentCreationByNonAdminUsers, positive: true },
        { label: 'Restrict developer environment creation to admins', value: pp?.governance?.disableDeveloperEnvironmentCreationByNonAdminUsers, positive: true },
        { label: 'Restrict portal creation to admins', value: settings.disablePortalsCreationByNonAdminUsers, positive: true },
      ],
    },
    {
      title: 'Power Apps',
      rows: [
        { label: 'Restrict Share with Everyone', value: pp?.powerApps?.disableShareWithEveryone, positive: true },
        { label: 'Allow guests to create apps', value: pp?.powerApps?.enableGuestsToMake, positive: false },
      ],
    },
    {
      title: 'AI & Copilot',
      rows: [
        { label: 'Copilot in Power Automate', value: pp?.powerAutomate?.disableCopilot !== undefined ? !pp.powerAutomate.disableCopilot : undefined, positive: true },
        { label: 'Copilot (tenant-wide)', value: pp?.intelligence?.disableCopilot !== undefined ? !pp.intelligence.disableCopilot : undefined, positive: true },
        { label: 'OpenAI bot publishing', value: pp?.intelligence?.enableOpenAiBotPublishing, positive: false },
      ],
    },
    {
      title: 'Admin & Governance',
      rows: [
        { label: 'Admin digest emails', value: pp?.governance?.disableAdminDigest !== undefined ? !pp.governance.disableAdminDigest : undefined, positive: true },
        { label: 'Usage metrics for admins', value: pp?.governance?.disableUsageMetricsForAdmins !== undefined ? !pp.governance.disableUsageMetricsForAdmins : undefined, positive: true },
        { label: 'Capacity allocation by env admins', value: settings.disableCapacityAllocationByEnvironmentAdmins !== undefined ? !settings.disableCapacityAllocationByEnvironmentAdmins : undefined, positive: true },
      ],
    },
  ]
    .map(c => ({ ...c, rows: c.rows.filter(r => r.value !== undefined) }))
    .filter(c => c.rows.length > 0)

  return (
    <div className={classes.envTableWrapper}>
      <div style={{ overflowX: 'auto' }}>
        <table className={classes.envTable}>
          <colgroup>
            <col />
            <col style={{ width: '130px' }} />
          </colgroup>
          <thead className={classes.envThead}>
            <tr>
              <th className={classes.envTh} style={{ cursor: 'default' }}>Setting</th>
              <th className={classes.envTh} style={{ cursor: 'default' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <Fragment key={cat.title}>
                <tr>
                  <td className={classes.settingsCatTd} colSpan={2}>{cat.title}</td>
                </tr>
                {cat.rows.map(r => {
                  const isGood = r.positive ? r.value : !r.value
                  return (
                    <tr key={r.label} className={classes.settingsTr}>
                      <td className={classes.envTd}>
                        <div className={classes.envNameCell}>
                          {isGood
                            ? <CheckmarkCircleRegular fontSize={14} style={{ color: tokens.colorPaletteGreenForeground1, flexShrink: 0 }} />
                            : <WarningRegular fontSize={14} style={{ color: tokens.colorPaletteMarigoldForeground2, flexShrink: 0 }} />}
                          <Text size={200} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</Text>
                        </div>
                      </td>
                      <td className={classes.envTd}>
                        <Badge appearance="tint" color={isGood ? 'success' : 'warning'} size="small">{r.value ? 'Enabled' : 'Disabled'}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  if (mb < 1) return '<1 MB'
  return `${Math.round(mb)} MB`
}

// ── Capacity Section ─────────────────────────────────────────────────────────

function CapacitySection({ capacityData }: { capacityData: EnvironmentCapacity[] }) {
  const classes = useClasses()

  const sorted = useMemo(() => {
    return capacityData
      .map(env => {
        const db = env.capacity.find(c => c.capacityType === 'Database')?.actualConsumption ?? 0
        const file = env.capacity.find(c => c.capacityType === 'File')?.actualConsumption ?? 0
        const log = env.capacity.find(c => c.capacityType === 'Log')?.actualConsumption ?? 0
        const total = db + file + log
        return { ...env, db, file, log, total }
      })
      .filter(e => e.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [capacityData])

  const maxTotal = sorted[0]?.total ?? 1

  if (sorted.length === 0) {
    return (
      <div className={classes.sectionBody}>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No Dataverse storage consumption found across visible environments.</Caption1>
      </div>
    )
  }

  return (
    <div className={classes.sectionBody}>
      <Caption1 style={{ color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalXS }}>
        Dataverse storage consumption across {sorted.length} environment{sorted.length !== 1 ? 's' : ''}
      </Caption1>
      {sorted.map(env => (
        <div key={env.id} style={{ marginBottom: tokens.spacingVerticalM }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, minWidth: 0 }}>
              <Text size={200} weight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {env.displayName}
              </Text>
              {env.environmentType && (
                <Badge appearance="tint" color="subtle" size="small">{env.environmentType}</Badge>
              )}
            </div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground2, flexShrink: 0, marginLeft: tokens.spacingHorizontalS }}>
              {formatMB(env.total)}
            </Text>
          </div>
          <div style={{ height: '6px', backgroundColor: tokens.colorNeutralBackground3, borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (env.total / maxTotal) * 100)}%`,
              backgroundColor: tokens.colorBrandBackground,
              borderRadius: '3px',
            }} />
          </div>
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalM }}>
            {env.db > 0 && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>DB: {formatMB(env.db)}</Caption1>}
            {env.file > 0 && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>File: {formatMB(env.file)}</Caption1>}
            {env.log > 0 && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Log: {formatMB(env.log)}</Caption1>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Billing Policies Section ─────────────────────────────────────────────────

function BillingPoliciesSection({
  policies,
  allEnvironments,
}: {
  policies: BillingPolicy[]
  allEnvironments: ResourceItem[]
}) {
  const classes = useClasses()

  const coveredIds = useMemo(() => {
    const ids = new Set<string>()
    for (const p of policies) {
      for (const env of p.properties.environments ?? []) {
        if (env.id) ids.add(env.id)
        if (env.name) ids.add(env.name)
      }
    }
    return ids
  }, [policies])

  const uncovered = useMemo(
    () => allEnvironments.filter(e => !coveredIds.has(e.id) && !coveredIds.has(e.name)),
    [allEnvironments, coveredIds],
  )

  if (policies.length === 0) {
    return (
      <div className={classes.sectionBody}>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          No pay-as-you-go billing policies configured. Environments are using standard included licenses only.
        </Caption1>
      </div>
    )
  }

  return (
    <div className={classes.sectionBody}>
      <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center', marginBottom: tokens.spacingVerticalXS }}>
        <Badge appearance="tint" color="informative" size="small">
          {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}
        </Badge>
        {uncovered.length > 0 && (
          <Badge appearance="tint" color="warning" size="small">
            {uncovered.length} env{uncovered.length !== 1 ? 's' : ''} not linked
          </Badge>
        )}
      </div>
      {policies.map(policy => (
        <div key={policy.id} className={classes.insightRow}>
          <TagRegular fontSize={16} style={{ color: tokens.colorBrandForeground1, flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size={200} weight="semibold" style={{ display: 'block' }}>{policy.name}</Text>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS, marginTop: '2px', flexWrap: 'wrap' }}>
              <Badge appearance="tint" color="subtle" size="small">
                {policy.properties.environments?.length ?? 0} environment{(policy.properties.environments?.length ?? 0) !== 1 ? 's' : ''} linked
              </Badge>
              {policy.properties.provisioningState && (
                <Badge
                  appearance="tint"
                  color={policy.properties.provisioningState === 'Succeeded' ? 'success' : 'warning'}
                  size="small"
                >
                  {policy.properties.provisioningState}
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
      {uncovered.length > 0 && (
        <div style={{ marginTop: tokens.spacingVerticalS }}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: tokens.spacingVerticalXS }}>
            Not linked to any billing policy
          </Caption1>
          {uncovered.map(env => (
            <div key={env.id} className={classes.insightRow}>
              <GlobeRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0, marginTop: '2px' }} />
              <Text size={200}>{getDisplayName(env)}</Text>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cross-Tenant Connections Section ─────────────────────────────────────────

interface ForeignTenant {
  tenantId: string
  count: number
}

function groupForeignTenants(report: CrossTenantConnectionReport, direction: 'Inbound' | 'Outbound'): ForeignTenant[] {
  const m = new Map<string, number>()
  for (const c of report.connections) {
    if (c.connectionType !== direction) continue
    m.set(c.tenantId, (m.get(c.tenantId) ?? 0) + 1)
  }
  return [...m.entries()].map(([tenantId, count]) => ({ tenantId, count })).sort((a, b) => b.count - a.count)
}

export function CrossTenantSection({
  report,
  onRefresh,
  isUpdating,
  cachedAt,
}: {
  report: CrossTenantConnectionReport
  onRefresh: () => void
  isUpdating: boolean
  cachedAt?: string
}) {
  const classes = useClasses()
  const inbound = useMemo(() => groupForeignTenants(report, 'Inbound'), [report])
  const outbound = useMemo(() => groupForeignTenants(report, 'Outbound'), [report])
  const generating = report.status === 'InProgress' || report.status === 'Received'

  const directionBlock = (
    label: string,
    icon: React.ReactNode,
    tenants: ForeignTenant[],
    hint: string,
  ) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalXS }}>
        {icon}
        <Text size={300} weight="semibold">{label}</Text>
        <Badge appearance="tint" color={tenants.length > 0 ? 'warning' : 'success'} size="small">
          {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      {tenants.length === 0 ? (
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{hint}</Caption1>
      ) : (
        tenants.map(t => (
          <div key={t.tenantId} className={classes.row}>
            <div className={classes.rowLeft}>
              <GlobeRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
              <Text size={200} style={{ fontFamily: 'Consolas, monospace' }}>{t.tenantId}</Text>
            </div>
            <Badge appearance="tint" color="subtle" size="small">{t.count} connection{t.count !== 1 ? 's' : ''}</Badge>
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className={classes.sectionBody}>
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' }}>
        <Badge
          appearance="tint"
          color={report.status === 'Completed' ? 'success' : report.status === 'Failed' ? 'danger' : 'informative'}
          size="small"
        >
          {report.status ?? 'Unknown'}
        </Badge>
        {report.startDate && report.endDate && (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {formatLocalDateTime(report.startDate)} – {formatLocalDateTime(report.endDate)}
          </Caption1>
        )}
        {cachedAt && (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>· Cached {formatLocalDateTime(cachedAt)}</Caption1>
        )}
        <Button
          appearance="subtle"
          icon={<ArrowSyncRegular />}
          size="small"
          disabled={isUpdating}
          onClick={onRefresh}
          style={{ marginLeft: 'auto' }}
        >
          {isUpdating ? 'Updating…' : 'Refresh'}
        </Button>
      </div>

      {(isUpdating || generating) && (
        <div className={classes.permissionNotice} style={{ backgroundColor: '#f3f9fd', color: '#003966' }}>
          <Spinner size="extra-tiny" />
          <Caption1 style={{ color: '#003966' }}>
            {isUpdating
              ? 'The cross-tenant connection report is being updated…'
              : 'The report is still generating on the service. Use Refresh in a moment to pull the latest results.'}
          </Caption1>
        </div>
      )}

      {report.connections.length === 0 && !generating ? (
        <div className={classes.permissionNotice} style={{ backgroundColor: tokens.colorPaletteGreenBackground1 }}>
          <CheckmarkCircleRegular fontSize={16} style={{ color: tokens.colorPaletteGreenForeground1 }} />
          <Caption1 style={{ color: tokens.colorPaletteGreenForeground2 }}>
            No cross-tenant connections detected in the report window.
          </Caption1>
        </div>
      ) : (
        <>
          {directionBlock(
            'Outbound (your tenant → external)',
            <ArrowUploadRegular fontSize={16} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />,
            outbound,
            'No outbound connections to external tenants.',
          )}
          {directionBlock(
            'Inbound (external → your tenant)',
            <ArrowDownloadRegular fontSize={16} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />,
            inbound,
            'No inbound connections from external tenants.',
          )}
        </>
      )}
    </div>
  )
}

// ── Advisor Recommendations Section ──────────────────────────────────────────

// Scenario names arrive as machine identifiers (camelCase / dotted). Turn them
// into a readable title for display.
export function humanizeScenario(s: string): string {
  const words = s
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  if (!words) return s
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function RecommendationsSection({
  recommendations,
  onScenarioClick,
}: {
  recommendations: AdvisorRecommendation[]
  onScenarioClick: (scenario: string) => void
}) {
  const classes = useClasses()

  if (recommendations.length === 0) {
    return (
      <div className={classes.sectionBody}>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          No Advisor recommendations available. Advisor evaluates Managed Environments; results appear once it has run.
        </Caption1>
      </div>
    )
  }

  const sorted = [...recommendations].sort((a, b) => (b.resourceCount ?? 0) - (a.resourceCount ?? 0))

  return (
    <div className={classes.sectionBody}>
      <Badge appearance="tint" color="informative" size="small" style={{ alignSelf: 'flex-start' }}>
        {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
      </Badge>
      {sorted.map(rec => {
        const count = rec.resourceCount ?? 0
        return (
          <div key={rec.scenario} className={classes.insightRowClickable} onClick={() => onScenarioClick(rec.scenario)}>
            <LightbulbRegular fontSize={16} style={{ color: count > 0 ? tokens.colorPaletteMarigoldForeground2 : tokens.colorBrandForeground1, flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size={200} weight="semibold" style={{ display: 'block' }}>{humanizeScenario(rec.scenario)}</Text>
              <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS, marginTop: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge appearance="tint" color={count > 0 ? 'warning' : 'success'} size="small">
                  {count} resource{count !== 1 ? 's' : ''}
                </Badge>
                {rec.lastRefreshedTimestamp && (
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    Refreshed {formatLocalDateTime(rec.lastRefreshedTimestamp)}
                  </Caption1>
                )}
              </div>
            </div>
            <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0, marginTop: '2px' }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Recommendation drill-down (resources for one scenario) ───────────────────

export function RecommendationDetail({
  scenario,
  onBack,
}: {
  scenario: string
  onBack: () => void
}) {
  const classes = useClasses()
  const { data, isLoading, isError } = useRecommendationResources(scenario)

  return (
    <div className={classes.drillRoot}>
      <div className={classes.breadcrumb}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} size="small" onClick={onBack}>
          Recommendations
        </Button>
        <Text style={{ color: tokens.colorNeutralForeground3 }}>/</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
          <LightbulbRegular style={{ color: tokens.colorBrandForeground2, fontSize: '16px' }} />
          <Text weight="semibold">{humanizeScenario(scenario)}</Text>
        </div>
        {data && <Badge appearance="tint" color="subtle" size="small">{data.length} resource{data.length !== 1 ? 's' : ''}</Badge>}
      </div>

      <div className={classes.sectionCard}>
        {isError ? (
          <div className={classes.sectionBody}><PermissionNotice classes={classes} /></div>
        ) : isLoading ? (
          <div className={classes.sectionBody}><Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading affected resources…</Caption1></div>
        ) : !data || data.length === 0 ? (
          <div className={classes.sectionBody}><Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No resources are currently flagged for this recommendation.</Caption1></div>
        ) : (
          <div style={{ padding: `0 ${tokens.spacingHorizontalL}` }}>
            {data.map(r => (
              <div key={r.resourceId} className={classes.envRow}>
                <div className={classes.rowLeft} style={{ minWidth: 0 }}>
                  <DatabaseRegular fontSize={16} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <Text size={200} weight="semibold" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.resourceName || r.resourceId}
                    </Text>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {[r.resourceType, r.environmentName, r.resourceOwner].filter(Boolean).join(' · ') || '—'}
                    </Caption1>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '2px' }}>
                  {typeof r.resourceUsage === 'number' && (
                    <Badge appearance="tint" color="subtle" size="small">{r.resourceUsage} user{r.resourceUsage === 1 ? '' : 's'}/30d</Badge>
                  )}
                  {r.lastAccessedDate && (
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Last used {formatLocalDateTime(r.lastAccessedDate)}</Caption1>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Connections (live connection instances + owners) Section ─────────────────

function InlineConnectorChip({ connectorId }: { connectorId: string }) {
  const info = getConnectorInfo(connectorId)
  return (
    <span
      title={info.displayName}
      style={{
        width: '22px', height: '22px', borderRadius: '5px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: '11px', fontWeight: 700, lineHeight: 1,
        backgroundColor: info.color, flexShrink: 0,
      }}
    >
      {info.letter}
    </span>
  )
}

type ConnEnvSortField = 'name' | 'type' | 'connections' | 'connectors' | 'errors'
type ConnSortDir = 'asc' | 'desc'

interface EnvConnectionGroup {
  envId: string
  envName: string
  envType?: string
  env?: ResourceItem
  connections: PowerConnection[]
  connectors: number
  errors: number
}

// A connection is "in error" when it carries an error message or any status
// other than Connected — matching the red status badge below.
function connectionHasError(c: PowerConnection): boolean {
  if (c.statusError) return true
  return !!c.status && !/connected/i.test(c.status)
}

// Resolve an environment's friendly type for the Type column / badge.
function envTypeOf(env?: ResourceItem): string | undefined {
  if (!env) return undefined
  if (env.environmentType) return env.environmentType
  const p = env.properties
  if (!p) return undefined
  for (const c of [p['environmentSku'], p['sku'], p['type'], p['environmentType'], p['kind']]) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return undefined
}

function ConnSortIcon({ active, dir }: { active: boolean; dir: ConnSortDir }) {
  if (!active) return <ArrowSortRegular fontSize={14} style={{ opacity: 0.4 }} />
  return dir === 'asc'
    ? <ChevronUpRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
    : <ChevronDownRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
}

// Generic grouping for the connections drill-down. A GroupDef partitions a set
// of connections into labelled buckets; buckets render as expandable rows and
// are recursively grouped by the next GroupDef, with connections as the leaves.
// This lets the same renderer power both the in-environment hierarchy and the
// search results (which simply reorder the GroupDefs by what was searched).
interface GroupBucket { key: string; header: React.ReactNode; right?: React.ReactNode; conns: PowerConnection[] }
type GroupDef = (conns: PowerConnection[]) => GroupBucket[]

function groupConns(conns: PowerConnection[], keyFn: (c: PowerConnection) => string): Map<string, PowerConnection[]> {
  const m = new Map<string, PowerConnection[]>()
  for (const c of conns) {
    const k = keyFn(c)
    const arr = m.get(k) ?? []
    arr.push(c)
    m.set(k, arr)
  }
  return m
}

const ownerKeyOf = (c: PowerConnection) => c.owner?.id ?? c.owner?.email ?? c.owner?.displayName ?? 'unknown'
const ownerLabelOf = (c: PowerConnection) => c.owner?.displayName ?? c.owner?.email ?? 'Unknown user'

// Wrap every case-insensitive occurrence of `q` in `text` with a highlight mark.
// `q` is expected already trimmed + lowercased; empty `q` returns plain text.
function highlightMatch(text: string, q: string): React.ReactNode {
  if (!q) return text
  const lower = text.toLowerCase()
  let idx = lower.indexOf(q)
  if (idx === -1) return text
  const parts: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(
      <mark key={key++} style={{ backgroundColor: tokens.colorPaletteYellowBackground2, color: 'inherit', borderRadius: '2px', padding: 0 }}>
        {text.slice(idx, idx + q.length)}
      </mark>,
    )
    i = idx + q.length
    idx = lower.indexOf(q, i)
  }
  if (i < text.length) parts.push(text.slice(i))
  return parts
}

function ConnectionDetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '2px 0', alignItems: 'baseline' }}>
      <div style={{ minWidth: '128px', flexShrink: 0, color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 }}>{label}</div>
      <div style={{ fontSize: tokens.fontSizeBase200, wordBreak: 'break-word', fontFamily: 'Consolas, monospace' }}>{value}</div>
    </div>
  )
}

function ConnectionDetail({ c, envName, indent = 30 }: { c: PowerConnection; envName?: string; indent?: number }) {
  const info = getConnectorInfo(c.connectorId)
  const ownerText = c.owner?.displayName
    ? `${c.owner.displayName}${c.owner.email ? ` <${c.owner.email}>` : ''}`
    : c.owner?.email
  const envLabel = envName && envName !== c.environmentId ? `${envName} (${c.environmentId})` : c.environmentId
  return (
    <div style={{
      padding: `6px 8px 10px ${indent}px`,
      display: 'flex', flexDirection: 'column', gap: '1px',
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    }}>
      <ConnectionDetailRow label="Connector" value={info.displayName} />
      <ConnectionDetailRow label="Connector ID" value={c.connectorId} />
      <ConnectionDetailRow label="Connection ID" value={c.id} />
      <ConnectionDetailRow label="Status" value={c.statusError ? `${c.status ?? 'Error'} — ${c.statusError}` : c.status} />
      <ConnectionDetailRow label="Owner" value={ownerText} />
      <ConnectionDetailRow label="Account" value={c.accountName} />
      <ConnectionDetailRow label="Environment" value={envLabel} />
      <ConnectionDetailRow label="Created" value={c.createdTime ? formatLocalDateTime(c.createdTime) : undefined} />
      <ConnectionDetailRow label="Modified" value={c.lastModifiedTime ? formatLocalDateTime(c.lastModifiedTime) : undefined} />
    </div>
  )
}

export function ConnectionsSection({
  result, environments, envNames, onRefresh, isUpdating, cachedAt,
}: {
  result: ConnectionsResult
  environments?: ResourceItem[]
  envNames?: Map<string, string>
  onRefresh?: () => void
  isUpdating?: boolean
  cachedAt?: string
}) {
  const classes = useClasses()
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Single expansion set keyed by each node's full path (group levels + leaf id).
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<{ field: ConnEnvSortField; dir: ConnSortDir }>({ field: 'connections', dir: 'desc' })

  const toggleKey = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Drilling into / out of an environment resets the nested expansion state so
  // groups don't appear pre-opened from a previously viewed environment.
  const drillInto = (envId: string) => { setSelectedEnvId(envId); setOpenPaths(new Set()) }
  const drillBack = () => setSelectedEnvId(null)

  const chevron = (open: boolean) => open
    ? <ChevronDownRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
    : <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />

  const envMap = useMemo(() => {
    const m = new Map<string, ResourceItem>()
    for (const e of environments ?? []) { if (e.name) m.set(e.name, e) }
    return m
  }, [environments])

  const envDisplay = (envId: string) => {
    const env = envMap.get(envId)
    return env ? getDisplayName(env) : (envNames?.get(envId) ?? envId)
  }

  // One group per environment with connection/connector/error counts.
  const envGroups = useMemo<EnvConnectionGroup[]>(() => {
    const m = new Map<string, PowerConnection[]>()
    for (const c of result.connections) {
      const arr = m.get(c.environmentId) ?? []
      arr.push(c)
      m.set(c.environmentId, arr)
    }
    return [...m.entries()].map(([envId, conns]) => {
      const env = envMap.get(envId)
      return {
        envId,
        env,
        envName: env ? getDisplayName(env) : (envNames?.get(envId) ?? envId),
        envType: envTypeOf(env),
        connectors: new Set(conns.map(c => c.connectorId)).size,
        errors: conns.filter(connectionHasError).length,
        // Connections sorted connector-then-name for the drill-down list.
        connections: [...conns].sort((a, b) =>
          getConnectorInfo(a.connectorId).displayName.localeCompare(getConnectorInfo(b.connectorId).displayName)
          || (a.displayName || '').localeCompare(b.displayName || '')),
      }
    })
  }, [result, envMap, envNames])

  const sortedGroups = useMemo(() => {
    const arr = [...envGroups]
    arr.sort((a, b) => {
      let c = 0
      switch (sort.field) {
        case 'name': c = a.envName.localeCompare(b.envName); break
        case 'type': c = (a.envType ?? '').localeCompare(b.envType ?? ''); break
        case 'connections': c = a.connections.length - b.connections.length; break
        case 'connectors': c = a.connectors - b.connectors; break
        case 'errors': c = a.errors - b.errors; break
      }
      return sort.dir === 'asc' ? c : -c
    })
    return arr
  }, [envGroups, sort])

  const totals = useMemo(() => ({
    connectors: new Set(result.connections.map(c => c.connectorId)).size,
    errors: result.connections.filter(connectionHasError).length,
  }), [result])

  const handleSort = (f: ConnEnvSortField) =>
    setSort(p => ({ field: f, dir: p.field === f && p.dir === 'asc' ? 'desc' : 'asc' }))

  const selected = selectedEnvId ? envGroups.find(g => g.envId === selectedEnvId) : undefined
  const q = query.trim().toLowerCase()

  // ── Grouping definitions for the recursive drill-down renderer ─────────────
  const byConnector: GroupDef = (conns) =>
    [...groupConns(conns, c => c.connectorId).entries()]
      .map(([connectorId, cs]) => {
        const errs = cs.filter(connectionHasError).length
        return {
          key: `c:${connectorId}`,
          header: (
            <>
              <InlineConnectorChip connectorId={connectorId} />
              <Text size={200} weight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlightMatch(getConnectorInfo(connectorId).displayName, q)}</Text>
            </>
          ),
          right: (
            <>
              <Badge appearance="tint" color="subtle" size="small">{cs.length}</Badge>
              {errs > 0 && <Badge appearance="tint" color="danger" size="small">{errs} error{errs !== 1 ? 's' : ''}</Badge>}
            </>
          ),
          conns: cs,
        }
      })
      .sort((a, b) => b.conns.length - a.conns.length)

  const byEnv: GroupDef = (conns) =>
    [...groupConns(conns, c => c.environmentId).entries()]
      .map(([envId, cs]) => ({
        key: `e:${envId}`,
        header: (
          <>
            <DatabaseRegular fontSize={16} style={{ color: tokens.colorBrandForeground2, flexShrink: 0 }} />
            <Text size={200} weight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlightMatch(envDisplay(envId), q)}</Text>
          </>
        ),
        right: <Badge appearance="tint" color="subtle" size="small">{cs.length}</Badge>,
        conns: cs,
      }))
      .sort((a, b) => b.conns.length - a.conns.length)

  const byStatus: GroupDef = (conns) => {
    const m = groupConns(conns, c => connectionHasError(c) ? 'Error' : 'Connected')
    // Surface errors first.
    return (['Error', 'Connected'] as const).filter(s => m.has(s)).map(s => ({
      key: `s:${s}`,
      header: <Badge appearance="tint" color={s === 'Connected' ? 'success' : 'danger'} size="small">{s}</Badge>,
      right: <Badge appearance="tint" color="subtle" size="small">{m.get(s)!.length}</Badge>,
      conns: m.get(s)!,
    }))
  }

  const byUser: GroupDef = (conns) =>
    [...groupConns(conns, ownerKeyOf).entries()]
      .sort((a, b) => ownerLabelOf(a[1][0]).localeCompare(ownerLabelOf(b[1][0])))
      .map(([key, cs]) => {
        const label = ownerLabelOf(cs[0])
        const email = cs[0].owner?.email
        return {
          key: `u:${key}`,
          header: (
            <>
              <PersonRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
              <Text size={200} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlightMatch(label, q)}</Text>
              {email && email !== label && (
                <Caption1 style={{ color: tokens.colorNeutralForeground3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlightMatch(email, q)}</Caption1>
              )}
            </>
          ),
          right: <Badge appearance="tint" color="subtle" size="small">{cs.length}</Badge>,
          conns: cs,
        }
      })

  // Recursive renderer: group by each GroupDef in turn; connections are leaves
  // that expand to the full ConnectionDetail ("last mile").
  const renderGroups = (conns: PowerConnection[], defs: GroupDef[], depth: number, prefix: string): React.ReactNode => {
    const pad = `${depth * 24}px`
    if (defs.length === 0) {
      return [...conns]
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
        .map(c => {
          const path = `${prefix}|conn:${c.id}`
          const open = openPaths.has(path)
          return (
            <div key={path}>
              <div className={classes.row} style={{ cursor: 'pointer', paddingLeft: pad }} onClick={() => toggleKey(setOpenPaths, path)} role="button" aria-expanded={open}>
                <div className={classes.rowLeft} style={{ minWidth: 0 }}>
                  {chevron(open)}
                  <Text size={200} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlightMatch(c.displayName || '(unnamed connection)', q)}</Text>
                  {connectionHasError(c) && <Badge appearance="tint" color="danger" size="small">Error</Badge>}
                </div>
                {c.accountName && (
                  <Caption1 style={{ color: tokens.colorNeutralForeground3, flexShrink: 0, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.accountName}</Caption1>
                )}
              </div>
              {open && <ConnectionDetail c={c} envName={envDisplay(c.environmentId)} indent={depth * 24 + 30} />}
            </div>
          )
        })
    }
    const [def, ...rest] = defs
    return def(conns).map(b => {
      const path = `${prefix}|${b.key}`
      const open = openPaths.has(path)
      return (
        <div key={path}>
          <div className={classes.row} style={{ cursor: 'pointer', paddingLeft: pad }} onClick={() => toggleKey(setOpenPaths, path)} role="button" aria-expanded={open}>
            <div className={classes.rowLeft} style={{ minWidth: 0 }}>{chevron(open)}{b.header}</div>
            {b.right && <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS, flexShrink: 0 }}>{b.right}</div>}
          </div>
          {open && renderGroups(b.conns, rest, depth + 1, path)}
        </div>
      )
    })
  }

  const header = (
    <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center', flexWrap: 'wrap' }}>
      <PlugConnectedRegular fontSize={16} style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }} />
      <Text weight="semibold">Connections</Text>
      <Badge appearance="tint" color="informative" size="small">{result.connections.length} connections</Badge>
      <Badge appearance="tint" color="subtle" size="small">{envGroups.length} environments</Badge>
      <Badge appearance="tint" color="subtle" size="small">{totals.connectors} connectors</Badge>
      {totals.errors > 0 && (
        <Badge appearance="tint" color="danger" size="small">{totals.errors} error{totals.errors !== 1 ? 's' : ''}</Badge>
      )}
      {result.inaccessibleCount > 0 && (
        <Badge appearance="tint" color="warning" size="small">{result.inaccessibleCount} environment{result.inaccessibleCount !== 1 ? 's' : ''} not readable</Badge>
      )}
      {cachedAt && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>· Cached {formatLocalDateTime(cachedAt)}</Caption1>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
        <Input
          size="small"
          placeholder="Search connectors, users, or environments…"
          value={query}
          onChange={(_, d) => setQuery(d.value)}
          contentBefore={<SearchRegular />}
          contentAfter={query
            ? <DismissRegular aria-label="Clear search" style={{ cursor: 'pointer' }} onClick={() => setQuery('')} />
            : undefined}
          style={{ width: '300px', maxWidth: '40vw' }}
        />
        {onRefresh && (
          <Button
            appearance="subtle"
            icon={<ArrowSyncRegular />}
            size="small"
            disabled={isUpdating}
            onClick={onRefresh}
          >
            {isUpdating ? 'Updating…' : 'Refresh'}
          </Button>
        )}
      </div>
    </div>
  )

  const updatingNotice = isUpdating && (
    <div className={classes.permissionNotice} style={{ backgroundColor: '#f3f9fd', color: '#003966', borderRadius: tokens.borderRadiusLarge }}>
      <Spinner size="extra-tiny" />
      <Caption1 style={{ color: '#003966' }}>Refreshing connections across all environments…</Caption1>
    </div>
  )

  const controls = <>{header}{updatingNotice}</>

  // ── Search view: results grouped by what was searched, then drillable ──────
  if (q) {
    const connectorConns = result.connections.filter(c => getConnectorInfo(c.connectorId).displayName.toLowerCase().includes(q))
    const userConns = result.connections.filter(c => (c.owner?.displayName ?? '').toLowerCase().includes(q) || (c.owner?.email ?? '').toLowerCase().includes(q))
    const envConns = result.connections.filter(c => envDisplay(c.environmentId).toLowerCase().includes(q))
    const sections = [
      { title: 'Connectors', icon: <PlugConnectedRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />, conns: connectorConns, defs: [byConnector, byEnv, byStatus, byUser], prefix: 'sC' },
      { title: 'Users', icon: <PersonRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />, conns: userConns, defs: [byUser, byConnector, byEnv, byStatus], prefix: 'sU' },
      { title: 'Environments', icon: <DatabaseRegular fontSize={16} style={{ color: tokens.colorBrandForeground2 }} />, conns: envConns, defs: [byEnv, byConnector, byStatus, byUser], prefix: 'sE' },
    ].filter(s => s.conns.length > 0)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
        {controls}
        {sections.length === 0 && (
          <div className={classes.envTableWrapper} style={{ padding: `calc(${tokens.spacingVerticalXXL} * 1.5)`, textAlign: 'center' }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No connectors, users, or environments match “{query.trim()}”.</Caption1>
          </div>
        )}
        {sections.map(s => (
          <div key={s.prefix} className={classes.envTableWrapper}>
            <div className={classes.sectionBody}>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalXS }}>
                {s.icon}
                <Text weight="semibold">{s.title}</Text>
                <Badge appearance="tint" color="subtle" size="small">{s.conns.length} connection{s.conns.length !== 1 ? 's' : ''}</Badge>
              </div>
              {renderGroups(s.conns, s.defs, 0, s.prefix)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Drilled view: connector → status → user → connection (last mile) ───────
  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
        {controls}
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' }}>
          <Button appearance="subtle" icon={<ArrowLeftRegular />} size="small" onClick={drillBack}>
            All Environments
          </Button>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>/</Text>
          <DatabaseRegular fontSize={16} style={{ color: tokens.colorBrandForeground2, flexShrink: 0 }} />
          <Text weight="semibold">{selected.envName}</Text>
          {selected.envType && <EnvironmentBadge name={selected.envType} type={selected.envType} />}
          <Badge appearance="tint" color="subtle" size="small">{selected.connections.length} connection{selected.connections.length !== 1 ? 's' : ''}</Badge>
          {selected.errors > 0 && <Badge appearance="tint" color="danger" size="small">{selected.errors} error{selected.errors !== 1 ? 's' : ''}</Badge>}
        </div>
        <div className={classes.envTableWrapper}>
          <div className={classes.sectionBody}>
            {renderGroups(selected.connections, [byConnector, byStatus, byUser], 0, `env:${selected.envId}`)}
          </div>
        </div>
      </div>
    )
  }

  // ── List view: environments table (Environments-page card styling) ─────────
  if (result.connections.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
        {controls}
        <div className={classes.envTableWrapper} style={{ padding: `calc(${tokens.spacingVerticalXXL} * 1.5)`, textAlign: 'center' }}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            No connections found across the environments scanned.
            {result.inaccessibleCount > 0 &&
              ` (${result.inaccessibleCount} environment${result.inaccessibleCount !== 1 ? 's' : ''} could not be read — admin connection enumeration isn't available for some environment types.)`}
          </Caption1>
        </div>
      </div>
    )
  }

  const sortableTh = (field: ConnEnvSortField, label: string) => (
    <th className={classes.envTh} onClick={() => handleSort(field)}>
      <div className={classes.envThInner}>{label} <ConnSortIcon active={sort.field === field} dir={sort.dir} /></div>
    </th>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
      {controls}
      <div className={classes.envTableWrapper}>
        <div style={{ overflowX: 'auto' }}>
          <table className={classes.envTable}>
            <colgroup>
              <col />
              <col style={{ width: '170px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '44px' }} />
            </colgroup>
            <thead className={classes.envThead}>
              <tr>
                {sortableTh('name', 'Environment')}
                {sortableTh('type', 'Type')}
                {sortableTh('connections', 'Connections')}
                {sortableTh('connectors', 'Connectors')}
                {sortableTh('errors', 'Errors')}
                <th className={classes.envThStatic} />
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map(env => (
                <tr key={env.envId} className={classes.envTr} onClick={() => drillInto(env.envId)}>
                  <td className={classes.envTd}>
                    <div className={classes.envNameCell}>
                      <DatabaseRegular fontSize={16} style={{ color: tokens.colorBrandForeground2, flexShrink: 0 }} />
                      <Text weight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={env.envName}>{env.envName}</Text>
                    </div>
                  </td>
                  <td className={classes.envTd}>
                    {env.envType ? <EnvironmentBadge name={env.envType} type={env.envType} /> : <Text style={{ color: tokens.colorNeutralForeground3 }}>—</Text>}
                  </td>
                  <td className={classes.envTd}>
                    <Badge appearance="tint" color="subtle" size="small">{env.connections.length}</Badge>
                  </td>
                  <td className={classes.envTd}>
                    <Badge appearance="tint" color="subtle" size="small">{env.connectors}</Badge>
                  </td>
                  <td className={classes.envTd}>
                    <Badge appearance="tint" color={env.errors > 0 ? 'danger' : 'subtle'} size="small">{env.errors}</Badge>
                  </td>
                  <td className={classes.envTd} style={{ textAlign: 'right' }}>
                    <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  onOpenChange,
  children,
}: {
  icon: React.ReactNode
  title: string
  warnCount?: number
  loading?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const classes = useClasses()
  const hasWarn = !!warnCount && warnCount > 0

  const toggle = () => {
    setOpen(o => {
      const next = !o
      onOpenChange?.(next)
      return next
    })
  }

  return (
    <div className={hasWarn ? classes.sectionCardWarn : classes.sectionCard}>
      <div
        className={open ? classes.sectionHeaderClickableOpen : classes.sectionHeaderClickable}
        onClick={toggle}
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
  const capacityQuery = useEnvironmentCapacity()
  const billingQuery = useBillingPolicies()
  const [drillDown, setDrillDown] = useState<InsightKey | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<DLPPolicy | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)

  // Lazy-load the heavier / side-effecting sections only after they're opened.
  const [crossTenantOpened, setCrossTenantOpened] = useState(false)
  const [advisorOpened, setAdvisorOpened] = useState(false)
  const [connectionsOpened, setConnectionsOpened] = useState(false)

  const envIds = useMemo(() => allEnvironments.map(e => e.name).filter(Boolean), [allEnvironments])

  const crossTenantQuery = useCrossTenantConnectionReport(crossTenantOpened)
  const advisorQuery = useAdvisorRecommendations(advisorOpened)
  const connectionsQuery = useConnections(envIds, connectionsOpened)

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

  if (selectedScenario) {
    return (
      <RecommendationDetail
        scenario={selectedScenario}
        onBack={() => setSelectedScenario(null)}
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

      {/* Capacity & Storage */}
      <CollapsibleSection
        icon={<DatabaseRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        title="Capacity & Storage"
        loading={capacityQuery.isLoading}
      >
        {capacityQuery.isError ? (
          <div className={classes.sectionBody}><PermissionNotice classes={classes} /></div>
        ) : capacityQuery.isLoading ? (
          <div className={classes.sectionBody}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading capacity data…</Caption1>
          </div>
        ) : capacityQuery.data ? (
          <CapacitySection capacityData={capacityQuery.data} />
        ) : null}
      </CollapsibleSection>

      {/* Billing Policies */}
      <CollapsibleSection
        icon={<TagRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        title="Billing Policies"
        loading={billingQuery.isLoading}
      >
        {billingQuery.isError ? (
          <div className={classes.sectionBody}><PermissionNotice classes={classes} /></div>
        ) : billingQuery.isLoading ? (
          <div className={classes.sectionBody}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading billing policies…</Caption1>
          </div>
        ) : billingQuery.data ? (
          <BillingPoliciesSection policies={billingQuery.data} allEnvironments={allEnvironments} />
        ) : null}
      </CollapsibleSection>

      {/* Cross Tenant Connections */}
      <CollapsibleSection
        icon={<GlobeRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        title="Cross Tenant Connections"
        loading={crossTenantQuery.isFetching}
        onOpenChange={(open) => { if (open) setCrossTenantOpened(true) }}
      >
        {crossTenantQuery.isError ? (
          <div className={classes.sectionBody}><PermissionNotice classes={classes} /></div>
        ) : crossTenantQuery.isLoading || (!crossTenantQuery.data && crossTenantQuery.isFetching) ? (
          <div className={classes.sectionBody}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Generating cross-tenant connection report…</Caption1>
          </div>
        ) : crossTenantQuery.data ? (
          <CrossTenantSection
            report={crossTenantQuery.data}
            onRefresh={() => crossTenantQuery.refetch()}
            isUpdating={crossTenantQuery.isFetching}
          />
        ) : null}
      </CollapsibleSection>

      {/* Recommendations (Advisor) */}
      <CollapsibleSection
        icon={<LightbulbRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        title="Recommendations"
        loading={advisorQuery.isLoading}
        onOpenChange={(open) => { if (open) setAdvisorOpened(true) }}
      >
        {advisorQuery.isError ? (
          <div className={classes.sectionBody}><PermissionNotice classes={classes} /></div>
        ) : advisorQuery.isLoading ? (
          <div className={classes.sectionBody}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading Advisor recommendations…</Caption1>
          </div>
        ) : advisorQuery.data ? (
          <RecommendationsSection recommendations={advisorQuery.data} onScenarioClick={setSelectedScenario} />
        ) : null}
      </CollapsibleSection>

      {/* Connections */}
      <CollapsibleSection
        icon={<PlugConnectedRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        title="Connections"
        loading={connectionsQuery.isLoading}
        onOpenChange={(open) => { if (open) setConnectionsOpened(true) }}
      >
        {connectionsQuery.isError ? (
          <div className={classes.sectionBody}><PermissionNotice classes={classes} /></div>
        ) : connectionsQuery.isLoading ? (
          <div className={classes.sectionBody}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Scanning environments for connections…</Caption1>
          </div>
        ) : connectionsQuery.data ? (
          <ConnectionsSection result={connectionsQuery.data} />
        ) : null}
      </CollapsibleSection>

    </div>
  )
}
