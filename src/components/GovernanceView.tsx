import { useMemo, useState } from 'react'
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
  ShieldCheckmarkRegular,
  WarningRegular,
  CheckmarkCircleRegular,
  LockClosedRegular,
  GlobeRegular,
  PersonRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  ArrowLeftRegular,
  DatabaseRegular,
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
  useRecommendationResources,
} from '../hooks/useGovernance'
import type {
  CrossTenantConnectionReport, AdvisorRecommendation, ConnectionsResult, PowerConnection,
} from '../hooks/useGovernance'
import { getConnectorInfo } from '../utils/connectors'
import { formatLocalDateTime } from '../utils/format'
import { EnvironmentBadge } from './EnvironmentBadge'

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
  // Non-interactive table row used by governance detail tables.
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
      detail: 'Managed Environments unlock advanced governance controls, weekly digests, and usage insights. Consider enabling Managed Environments for production environments.',
      drillDownKey: 'unmanaged-envs',
    })
  }

  const defaultEnvs = environments.filter(e => e.environmentType?.toLowerCase() === 'default')
  if (defaultEnvs.length > 0) {
    insights.push({
      severity: 'info',
      title: `Default environment${defaultEnvs.length !== 1 ? 's' : ''} detected: ${defaultEnvs.map(e => getDisplayName(e)).join(', ')}`,
      detail: 'Default environments are shared by all users in the tenant. Review their resources, makers, connections, and Advanced Connector Policy coverage regularly.',
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
      detail: 'No unmanaged environments, orphaned environment references, or obvious inventory anomalies were detected.',
    })
  }

  return insights
}

// ── Helper components ────────────────────────────────────────────────────────

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
        tenants.map(tenant => (
          <div key={tenant.tenantId} className={classes.row}>
            <div className={classes.rowLeft}>
              <GlobeRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
              <Text size={200} style={{ fontFamily: 'Consolas, monospace' }}>{tenant.tenantId}</Text>
            </div>
            <Badge appearance="tint" color="subtle" size="small">
              {tenant.count} connection{tenant.count !== 1 ? 's' : ''}
            </Badge>
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
            {formatLocalDateTime(report.startDate)} - {formatLocalDateTime(report.endDate)}
          </Caption1>
        )}
        {cachedAt && (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Cached {formatLocalDateTime(cachedAt)}</Caption1>
        )}
        <Button
          appearance="subtle"
          icon={<ArrowSyncRegular />}
          size="small"
          disabled={isUpdating}
          onClick={onRefresh}
          style={{ marginLeft: 'auto' }}
        >
          {isUpdating ? 'Updating...' : 'Refresh'}
        </Button>
      </div>

      {(isUpdating || generating) && (
        <div className={classes.permissionNotice} style={{ backgroundColor: tokens.colorBrandBackground2, color: tokens.colorBrandForeground2 }}>
          <Spinner size="extra-tiny" />
          <Caption1 style={{ color: tokens.colorBrandForeground2 }}>
            {isUpdating
              ? 'The cross-tenant connection report is being updated...'
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
            'Outbound (your tenant to external)',
            <ArrowUploadRegular fontSize={16} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />,
            outbound,
            'No outbound connections to external tenants.',
          )}
          {directionBlock(
            'Inbound (external to your tenant)',
            <ArrowDownloadRegular fontSize={16} style={{ color: tokens.colorPaletteMarigoldForeground2 }} />,
            inbound,
            'No inbound connections from external tenants.',
          )}
        </>
      )}
    </div>
  )
}

export function humanizeScenario(scenario: string): string {
  const words = scenario
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  if (!words) return scenario
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
      {sorted.map(recommendation => {
        const count = recommendation.resourceCount ?? 0
        return (
          <div
            key={recommendation.scenario}
            className={classes.insightRowClickable}
            onClick={() => onScenarioClick(recommendation.scenario)}
            role="button"
            tabIndex={0}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onScenarioClick(recommendation.scenario)
              }
            }}
          >
            <LightbulbRegular fontSize={16} style={{ color: count > 0 ? tokens.colorPaletteMarigoldForeground2 : tokens.colorBrandForeground1, flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size={200} weight="semibold" style={{ display: 'block' }}>{humanizeScenario(recommendation.scenario)}</Text>
              <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS, marginTop: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge appearance="tint" color={count > 0 ? 'warning' : 'success'} size="small">
                  {count} resource{count !== 1 ? 's' : ''}
                </Badge>
                {recommendation.lastRefreshedTimestamp && (
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    Refreshed {formatLocalDateTime(recommendation.lastRefreshedTimestamp)}
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
          <div className={classes.sectionBody}>
            <div className={classes.permissionNotice}>
              <LockClosedRegular fontSize={16} />
              <Caption1>Power Platform administrator permissions are required to view recommendation resources.</Caption1>
            </div>
          </div>
        ) : isLoading ? (
          <div className={classes.sectionBody}><Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading affected resources...</Caption1></div>
        ) : !data || data.length === 0 ? (
          <div className={classes.sectionBody}><Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No resources are currently flagged for this recommendation.</Caption1></div>
        ) : (
          <div style={{ padding: `0 ${tokens.spacingHorizontalL}` }}>
            {data.map(resource => (
              <div key={resource.resourceId} className={classes.envRow}>
                <div className={classes.rowLeft} style={{ minWidth: 0 }}>
                  <DatabaseRegular fontSize={16} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <Text size={200} weight="semibold" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {resource.resourceName || resource.resourceId}
                    </Text>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {[resource.resourceType, resource.environmentName, resource.resourceOwner].filter(Boolean).join(' / ') || '-'}
                    </Caption1>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '2px' }}>
                  {typeof resource.resourceUsage === 'number' && (
                    <Badge appearance="tint" color="subtle" size="small">{resource.resourceUsage} user{resource.resourceUsage === 1 ? '' : 's'}/30d</Badge>
                  )}
                  {resource.lastAccessedDate && (
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Last used {formatLocalDateTime(resource.lastAccessedDate)}</Caption1>
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

function InlineConnectorChip({ connectorId }: { connectorId: string }) {
  const info = getConnectorInfo(connectorId)
  return (
    <span
      title={info.displayName}
      style={{
        width: '22px', height: '22px', borderRadius: '5px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: tokens.colorNeutralForegroundOnBrand, fontSize: '11px', fontWeight: 700, lineHeight: 1,
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

function connectionHasError(connection: PowerConnection): boolean {
  if (connection.statusError) return true
  return !!connection.status && !/connected/i.test(connection.status)
}

function envTypeOf(environment?: ResourceItem): string | undefined {
  if (!environment) return undefined
  if (environment.environmentType) return environment.environmentType
  const properties = environment.properties
  if (!properties) return undefined
  for (const candidate of [properties['environmentSku'], properties['sku'], properties['type'], properties['environmentType'], properties['kind']]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return undefined
}

function ConnSortIcon({ active, dir }: { active: boolean; dir: ConnSortDir }) {
  if (!active) return <ArrowSortRegular fontSize={14} style={{ opacity: 0.4 }} />
  return dir === 'asc'
    ? <ChevronUpRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
    : <ChevronDownRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />
}

interface GroupBucket {
  key: string
  header: React.ReactNode
  right?: React.ReactNode
  conns: PowerConnection[]
}

type GroupDef = (connections: PowerConnection[]) => GroupBucket[]

function groupConns(connections: PowerConnection[], keyFn: (connection: PowerConnection) => string): Map<string, PowerConnection[]> {
  const groups = new Map<string, PowerConnection[]>()
  for (const connection of connections) {
    const key = keyFn(connection)
    const group = groups.get(key) ?? []
    group.push(connection)
    groups.set(key, group)
  }
  return groups
}

const ownerKeyOf = (connection: PowerConnection) => connection.owner?.id ?? connection.owner?.email ?? connection.owner?.displayName ?? 'unknown'
const ownerLabelOf = (connection: PowerConnection) => connection.owner?.displayName ?? connection.owner?.email ?? 'Unknown user'

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
              <div className={classes.row} style={{ cursor: 'pointer', paddingLeft: pad }} onClick={() => toggleKey(setOpenPaths, path)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleKey(setOpenPaths, path) } }} aria-expanded={open}>
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
          <div className={classes.row} style={{ cursor: 'pointer', paddingLeft: pad }} onClick={() => toggleKey(setOpenPaths, path)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleKey(setOpenPaths, path) } }} aria-expanded={open}>
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
          aria-label="Search connectors, users, or environments"
          placeholder="Search connectors, users, or environments…"
          value={query}
          onChange={(_, d) => setQuery(d.value)}
          contentBefore={<SearchRegular />}
          contentAfter={query
            ? <DismissRegular aria-label="Clear search" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setQuery('')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQuery('') } }} />
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
    <div className={classes.permissionNotice} style={{ backgroundColor: tokens.colorBrandBackground2, color: tokens.colorBrandForeground2, borderRadius: tokens.borderRadiusLarge }}>
      <Spinner size="extra-tiny" />
      <Caption1 style={{ color: tokens.colorBrandForeground2 }}>Refreshing connections across all environments…</Caption1>
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
                <tr key={env.envId} className={classes.envTr} onClick={() => drillInto(env.envId)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') { drillInto(env.envId) } }}>
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

