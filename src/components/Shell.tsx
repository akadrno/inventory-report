import { useState, useMemo } from 'react'
import { makeStyles, Text, Caption1, Button, Badge, Spinner, Input } from '@fluentui/react-components'
import {
  HomeRegular,
  TableSimpleRegular,
  ShieldRegular,
  GlobeRegular,
  FolderOpenRegular,
  PersonRegular,
  SearchRegular,
  SignOutRegular,
  SettingsRegular,
  ErrorCircleRegular,
  WarningRegular,
  ShieldCheckmarkRegular,
  LockClosedRegular,
  InfoRegular,
  ArrowClockwiseRegular,
  GridRegular,
  LightbulbRegular,
  ChevronRightRegular,
  ChevronLeftRegular,
} from '@fluentui/react-icons'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { useMsal } from '@azure/msal-react'
import { useResources } from '../hooks/useResources'
import { useEnvironmentGroups } from '../hooks/useEnvironmentGroups'
import { useEnvironments } from '../hooks/useEnvironments'
import { useOwnerNames, isSystemResource } from '../hooks/useOwnerNames'
import { useDLPPolicies, useTenantSettings } from '../hooks/useGovernance'
import { ResourceTable } from './ResourceTable'
import { GroupsView } from './GroupsView'
import { UsersView } from './UsersView'
import { EnvironmentsView } from './EnvironmentsView'
import { ReportView, RecsTab, buildRecs } from './ReportView'
import { MakerAnalyticsView } from './MakerAnalyticsView'
import { RiskAssessmentView } from './RiskAssessmentView'
import { ErrorBanner } from './ErrorBanner'
import { DebugPanel } from './DebugPanel'
import { useDebug } from '../context/DebugContext'
import type { ResourceItem } from '../types'
import { getResourceCategory, getDisplayName, getIsManagedEnvironment } from '../types'
import {
  computeInsights,
  countTenantWarnings,
  TenantSettingsSection,
  DLPSection,
  DLPPolicyDetail,
  EnvironmentDrillDown,
} from './GovernanceView'
import type { InsightKey } from './GovernanceView'
import type { DLPPolicy } from '../hooks/useGovernance'

// ── Design constants ──────────────────────────────────────────────────────────

const RAIL_BG = '#F0F0F0'
const PANEL_BG = '#F5F5F5'
const CONTENT_BG = '#faf9f8'
const ACTIVE = '#004578'
const ACTIVE_BG = '#ffffff'
const HOVER = '#EBEBEB'
const TEXT = '#242424'
const MUTED = '#737373'
const STROKE1 = '#edebe9'

// ── Types ─────────────────────────────────────────────────────────────────────

type RailSection = 'home' | 'inventory' | 'governance'
type InvView = 'all' | 'apps' | 'flows' | 'agents' | 'environments' | 'groups' | 'users'
type GovView = 'overview' | 'tenant-settings' | 'dlp' | 'recommendations' | 'maker-analytics' | 'risk-assessments'

// ── Styles ─────────────────────────────────────────────────────────────────────

const useClasses = makeStyles({
  shell: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: RAIL_BG, overflow: 'hidden' },
  header: { height: '48px', minHeight: '48px', display: 'flex', alignItems: 'center', paddingRight: '12px', flexShrink: 0, zIndex: 100 },
  headerLeft: { width: '68px', minWidth: '68px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, display: 'flex', justifyContent: 'center', paddingLeft: '8px', paddingRight: '8px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '4px' },
  body: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },
  rail: { width: '68px', minWidth: '68px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '4px', paddingBottom: '8px', gap: '2px', flexShrink: 0 },
  railBtnWrap: { width: '68px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  railBtn: {
    width: '52px', height: '48px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
    border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px',
    transition: 'background 0.15s',
    ':hover': { backgroundColor: HOVER },
  },
  railBtnActive: {
    width: '52px', height: '48px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
    border: `1px solid #d1d1d1`, backgroundColor: ACTIVE_BG, cursor: 'pointer', borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)',
  },
  panel: {
    width: '228px', minWidth: '228px',
    backgroundColor: PANEL_BG,
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto', overflowX: 'hidden',
    flexShrink: 0,
    borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: STROKE1,
  },
  panelHeader: { padding: '20px 16px 8px 20px', fontSize: '20px', fontWeight: 600, color: TEXT, flexShrink: 0, userSelect: 'none' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '7px 16px 7px 8px',
    margin: '1px 4px',
    borderRadius: '4px',
    fontSize: '14px', lineHeight: '20px',
    cursor: 'pointer', userSelect: 'none',
    border: 'none', background: 'transparent',
    width: 'calc(100% - 8px)', textAlign: 'left',
    color: TEXT,
    ':hover': { backgroundColor: HOVER, boxShadow: '0px 2px 4px rgba(0,0,0,0.14)' },
  },
  navItemActive: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '7px 16px 7px 8px',
    margin: '1px 4px',
    borderRadius: '4px',
    fontSize: '14px', lineHeight: '20px', fontWeight: 600,
    cursor: 'pointer', userSelect: 'none',
    border: 'none', backgroundColor: ACTIVE_BG,
    width: 'calc(100% - 8px)', textAlign: 'left',
    color: ACTIVE,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.14), 0px 0px 2px rgba(0,0,0,0.12)',
  },
  navIconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '40px', height: '36px',
    borderRadius: '4px',
    cursor: 'pointer', userSelect: 'none',
    border: 'none', background: 'transparent',
    ':hover': { backgroundColor: HOVER },
  },
  navIconBtnActive: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '40px', height: '36px',
    borderRadius: '4px',
    cursor: 'pointer', userSelect: 'none',
    border: 'none', backgroundColor: ACTIVE_BG,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.14), 0px 0px 2px rgba(0,0,0,0.12)',
  },
  panelCollapsed: {
    width: '52px', minWidth: '52px',
    backgroundColor: PANEL_BG,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '8px', paddingBottom: '8px',
    gap: '2px',
    overflowY: 'auto', overflowX: 'hidden',
    flexShrink: 0,
    borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: STROKE1,
  },
  content: {
    flex: 1,
    backgroundColor: CONTENT_BG,
    borderTopLeftRadius: '12px',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 25.6px 57.6px rgba(0,0,0,.22), 0 4.8px 14.4px rgba(0,0,0,.18)',
    minWidth: 0,
  },
  contentScroll: {
    flex: 1, overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: '16px',
    minHeight: 0,
  },
  contentHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px', paddingBottom: '12px', marginBottom: '4px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    flexShrink: 0,
  },
  pageTitle: { fontSize: '21px', fontWeight: 600, color: TEXT, lineHeight: '28px', display: 'block' },
  pageSub: { fontSize: '13px', color: MUTED, display: 'block', marginTop: '2px' },
  // Governance section styles
  sectionCard: {
    backgroundColor: ACTIVE_BG,
    border: `1px solid ${STROKE1}`,
    borderRadius: '4px', overflow: 'hidden',
  },
  cardHead: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px 10px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    fontSize: '14px', fontWeight: 600, color: '#323130',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
  },
  summaryCard: {
    backgroundColor: ACTIVE_BG,
    border: `1px solid ${STROKE1}`,
    borderRadius: '4px', padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  insightRow: {
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    padding: '10px 16px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    ':last-child': { borderBottom: 'none' },
  },
  finding: {
    borderRadius: '4px', padding: '12px 16px',
    borderLeftWidth: '3px', borderLeftStyle: 'solid',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 16px', textAlign: 'left',
    fontWeight: 600, fontSize: '12px', color: '#323130',
    backgroundColor: '#faf9f8',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    whiteSpace: 'nowrap',
  },
  thR: {
    padding: '8px 16px', textAlign: 'right',
    fontWeight: 600, fontSize: '12px', color: '#323130',
    backgroundColor: '#faf9f8',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 16px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    verticalAlign: 'middle',
  },
  tdR: {
    padding: '10px 16px', textAlign: 'right',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    fontVariantNumeric: 'tabular-nums', fontWeight: 600,
  },
  permNotice: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px',
    color: MUTED, fontSize: '13px',
  },
})

// ── AppHeader ─────────────────────────────────────────────────────────────────

function AppHeader({ onSignOut, userName }: { onSignOut: () => void; userName: string }) {
  const classes = useClasses()
  const { isOpen, setIsOpen, entries } = useDebug()
  const errorCount = entries.filter(e => e.error || (e.status !== undefined && e.status >= 400)).length

  return (
    <header className={classes.header}>
      <div className={classes.headerLeft} />
      <div className={classes.headerCenter}>
        <div style={{ width: '100%', maxWidth: '468px', height: '32px', backgroundColor: ACTIVE_BG, border: `1px solid #d1d1d1`, borderRadius: '4px', display: 'flex', alignItems: 'center', padding: '0 8px', gap: '6px', opacity: 0.7 }}>
          <SearchRegular style={{ color: MUTED, fontSize: 16, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: MUTED }}>Search Power Platform Inventory…</span>
        </div>
      </div>
      <div className={classes.headerRight}>
        <span style={{ fontSize: '13px', color: '#605e5c', marginRight: '4px' }}>{userName}</span>
        <div style={{ position: 'relative' }}>
          <Button appearance="subtle" icon={<SettingsRegular />} size="small" onClick={() => setIsOpen(!isOpen)} title="Debug panel" />
          {errorCount > 0 && !isOpen && (
            <Badge size="tiny" color="danger" style={{ position: 'absolute', top: 2, right: 2 }} />
          )}
        </div>
        <Button appearance="subtle" icon={<SignOutRegular />} size="small" onClick={onSignOut}>Sign out</Button>
      </div>
    </header>
  )
}

// ── Rail button ───────────────────────────────────────────────────────────────

function RailButton({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  const classes = useClasses()
  return (
    <div className={classes.railBtnWrap}>
      {active && (
        <div style={{ position: 'absolute', left: 2, width: 3, height: 16, borderRadius: 9999, backgroundColor: ACTIVE }} />
      )}
      <button className={active ? classes.railBtnActive : classes.railBtn} onClick={onClick}>
        <span style={{ fontSize: 24, color: active ? ACTIVE : MUTED, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 10, color: active ? ACTIVE : MUTED, textAlign: 'center', maxWidth: 48, lineHeight: '14px' }}>{label}</span>
      </button>
    </div>
  )
}

// ── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; collapsed?: boolean }) {
  const classes = useClasses()
  if (collapsed) {
    return (
      <button className={active ? classes.navIconBtnActive : classes.navIconBtn} onClick={onClick} title={label}>
        <span style={{ fontSize: 20, color: active ? ACTIVE : '#616161', lineHeight: 1 }}>{icon}</span>
      </button>
    )
  }
  return (
    <button className={active ? classes.navItemActive : classes.navItem} onClick={onClick}>
      <span style={{ fontSize: 20, color: active ? ACTIVE : '#616161', flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// ── Governance: Overview page ─────────────────────────────────────────────────

function GovOverviewPage({
  allResources, allEnvironments, onRecsClick, onEnvsClick,
}: {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  onRecsClick: () => void
  onEnvsClick: () => void
}) {
  const classes = useClasses()
  const { data: settings } = useTenantSettings()
  const { data: dlp } = useDLPPolicies()
  const [drillDown, setDrillDown] = useState<InsightKey | null>(null)

  const recs = useMemo(() => buildRecs(allEnvironments, dlp, settings), [allEnvironments, dlp, settings])
  const criticalCount = recs.filter(r => r.priority === 'Critical').length
  const warningCount = recs.filter(r => r.priority === 'High' || r.priority === 'Medium').length

  const insights = useMemo(() => computeInsights(allResources, allEnvironments), [allResources, allEnvironments])
  const insightIssueCount = insights.filter(i => i.severity !== 'info').length

  const envCount = allEnvironments.length
  const managedCount = allEnvironments.filter(e => getIsManagedEnvironment(e)).length
  const allManaged = envCount > 0 && managedCount === envCount

  if (drillDown === 'unmanaged-envs') {
    return <EnvironmentDrillDown allEnvironments={allEnvironments} allResources={allResources} onBack={() => setDrillDown(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary cards */}
      <div className={classes.summaryGrid}>
        <div className={classes.summaryCard}
          style={{ backgroundColor: '#fde7e9', borderColor: '#c50f1f', cursor: 'pointer' }}
          onClick={onRecsClick} role="button"
        >
          <ErrorCircleRegular fontSize={28} style={{ color: '#c50f1f', flexShrink: 0 }} />
          <div>
            <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: TEXT }}>{criticalCount}</Text>
            <Caption1 style={{ color: MUTED }}>Critical</Caption1>
          </div>
        </div>
        <div className={classes.summaryCard}
          style={{ backgroundColor: '#fff4ce', borderColor: '#e17800', cursor: 'pointer' }}
          onClick={onRecsClick} role="button"
        >
          <WarningRegular fontSize={28} style={{ color: '#e17800', flexShrink: 0 }} />
          <div>
            <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: TEXT }}>{warningCount}</Text>
            <Caption1 style={{ color: MUTED }}>Warnings</Caption1>
          </div>
        </div>
        <div className={classes.summaryCard}
          style={{ backgroundColor: allManaged ? '#cfe4fa' : '#ddeeff', borderWidth: '2px', borderColor: '#004578', cursor: 'pointer' }}
          onClick={onEnvsClick} role="button"
        >
          <ShieldCheckmarkRegular fontSize={28} style={{ color: '#004578', flexShrink: 0 }} />
          <div>
            <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: '#004578' }}>{managedCount}/{envCount}</Text>
            <Caption1 style={{ color: '#003966' }}>Managed Environments</Caption1>
          </div>
        </div>
      </div>

      {/* Resource Insights */}
      <div className={classes.sectionCard}>
        <div className={classes.cardHead}>
          <ShieldRegular fontSize={16} style={{ color: ACTIVE }} />
          Resource Insights
          {insightIssueCount > 0 && (
            <Badge appearance="tint" color="warning" size="small">{insightIssueCount} issue{insightIssueCount !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <div>
          {insights.map((insight, i) => {
            const clickable = !!insight.drillDownKey
            return (
              <div key={i} className={classes.insightRow}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                onClick={clickable ? () => setDrillDown(insight.drillDownKey!) : undefined}
              >
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  {insight.severity === 'critical' && <ErrorCircleRegular fontSize={16} style={{ color: '#c50f1f' }} />}
                  {insight.severity === 'warning' && <WarningRegular fontSize={16} style={{ color: '#e17800' }} />}
                  {insight.severity === 'info' && <InfoRegular fontSize={16} style={{ color: '#616161' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: TEXT }}>{insight.title}</Text>
                  <Caption1 style={{ color: '#605e5c' }}>{insight.detail}</Caption1>
                </div>
                {clickable && <ChevronRightRegular fontSize={14} style={{ color: MUTED, flexShrink: 0, marginTop: 2 }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Governance: Tenant Settings page ─────────────────────────────────────────

function GovTenantSettingsPage() {
  const classes = useClasses()
  const { data, isLoading, isError } = useTenantSettings()

  if (isLoading) return <div style={{ padding: '24px' }}><Spinner size="small" label="Loading tenant settings…" /></div>
  if (isError || !data) return (
    <div className={classes.sectionCard}>
      <div className={classes.permNotice}>
        <LockClosedRegular fontSize={16} />
        <Caption1>Requires Power Platform admin permissions (BAP API). Sign in with an admin account to view this data.</Caption1>
      </div>
    </div>
  )

  return (
    <div className={classes.sectionCard}>
      <div className={classes.cardHead}>
        <PersonRegular fontSize={16} style={{ color: ACTIVE }} />
        Tenant Settings
        {countTenantWarnings(data) > 0 && (
          <Badge appearance="tint" color="warning" size="small">{countTenantWarnings(data)} warning{countTenantWarnings(data) !== 1 ? 's' : ''}</Badge>
        )}
      </div>
      <TenantSettingsSection settings={data} />
    </div>
  )
}

// ── Governance: DLP page ──────────────────────────────────────────────────────

function GovDLPPage({ allEnvironments }: { allEnvironments: ResourceItem[] }) {
  const classes = useClasses()
  const [selectedPolicy, setSelectedPolicy] = useState<DLPPolicy | null>(null)
  const { data, isLoading, isError } = useDLPPolicies()

  if (selectedPolicy) {
    return <DLPPolicyDetail policy={selectedPolicy} environments={allEnvironments} onBack={() => setSelectedPolicy(null)} />
  }

  if (isLoading) return <div style={{ padding: '24px' }}><Spinner size="small" label="Loading DLP policies…" /></div>
  if (isError || !data) return (
    <div className={classes.sectionCard}>
      <div className={classes.permNotice}>
        <LockClosedRegular fontSize={16} />
        <Caption1>Requires Power Platform admin permissions (BAP API). Sign in with an admin account to view DLP policies.</Caption1>
      </div>
    </div>
  )

  const hasNoPolicies = data.length === 0
  const allInGeneral = data.length > 0 && data.every(p =>
    !(p.connectorGroups ?? []).some(g => g.classification.toLowerCase() === 'confidential' && g.connectors.length > 0)
  )
  const noBlocked = data.every(p =>
    !(p.connectorGroups ?? []).some(g => g.classification.toLowerCase() === 'blocked' && g.connectors.length > 0)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {hasNoPolicies && (
        <div className={classes.finding} style={{ backgroundColor: '#fde7e9', borderLeftColor: '#c50f1f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ErrorCircleRegular fontSize={16} style={{ color: '#c50f1f' }} />
            <Text style={{ fontWeight: 600, fontSize: '13px' }}>No DLP policies found — all connectors unrestricted</Text>
          </div>
          <Caption1 style={{ color: '#605e5c' }}>Without DLP policies, any connector can communicate with any other. Sensitive data can be exfiltrated with no audit trail.</Caption1>
        </div>
      )}
      {allInGeneral && !hasNoPolicies && (
        <div className={classes.finding} style={{ backgroundColor: '#fde7e9', borderLeftColor: '#c50f1f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ErrorCircleRegular fontSize={16} style={{ color: '#c50f1f' }} />
            <Text style={{ fontWeight: 600, fontSize: '13px' }}>All connectors in General — no data separation</Text>
          </div>
          <Caption1 style={{ color: '#605e5c' }}>Move sensitive connectors (Dataverse, SharePoint, SQL, Office 365) to the Confidential group.</Caption1>
        </div>
      )}
      {noBlocked && !hasNoPolicies && (
        <div className={classes.finding} style={{ backgroundColor: '#fff4ce', borderLeftColor: '#e17800' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WarningRegular fontSize={16} style={{ color: '#e17800' }} />
            <Text style={{ fontWeight: 600, fontSize: '13px' }}>No connectors in the Blocked group</Text>
          </div>
          <Caption1 style={{ color: '#605e5c' }}>Block the HTTP connector and custom connectors to prevent arbitrary external data flows.</Caption1>
        </div>
      )}

      <div className={classes.sectionCard}>
        <div className={classes.cardHead}>
          <LockClosedRegular fontSize={16} style={{ color: ACTIVE }} />
          DLP Policies
          <Badge appearance="tint" color="informative" size="small">{data.length} polic{data.length !== 1 ? 'ies' : 'y'}</Badge>
        </div>
        <DLPSection policies={data} onPolicyClick={setSelectedPolicy} />
      </div>
    </div>
  )
}

// ── Inventory content header ───────────────────────────────────────────────────

const INV_LABELS: Record<InvView, string> = {
  all: 'All Resources', apps: 'Apps', flows: 'Flows', agents: 'Agents',
  environments: 'Environments', groups: 'Environment Groups', users: 'Users',
}

// ── Main Shell ────────────────────────────────────────────────────────────────

export function Shell() {
  const [rail, setRail] = useState<RailSection>('home')
  const [invView, setInvView] = useState<InvView>('all')
  const [govView, setGovView] = useState<GovView>('overview')
  const [search, setSearch] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [hideSystemInv, setHideSystemInv] = useState(true)

  const resources = useResources()
  const groups = useEnvironmentGroups()
  const environmentsQuery = useEnvironments()
  const { isOpen } = useDebug()

  const { instance, accounts } = useMsal()
  const account = accounts[0]

  const allResources = useMemo(() => resources.data?.pages.flatMap(p => p.data) ?? [], [resources.data])
  const allGroups = useMemo(() => groups.data?.pages.flatMap(p => p.data) ?? [], [groups.data])
  const allEnvironments = useMemo(() => environmentsQuery.data?.pages.flatMap(p => p.data) ?? [], [environmentsQuery.data])
  const ownerNames = useOwnerNames(allResources)

  const isLoadingResources = resources.isLoading && allResources.length === 0
  const isLoadingGroups = groups.isLoading && allGroups.length === 0
  const isRefreshing = resources.isLoading || groups.isLoading

  const filtered = useMemo(() => {
    let items = allResources
    if (hideSystemInv) items = items.filter(r => !isSystemResource(r))
    if (invView !== 'all' && invView !== 'environments' && invView !== 'groups' && invView !== 'users') {
      items = items.filter(r => getResourceCategory(r.type) === invView)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(r =>
        getDisplayName(r).toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      )
    }
    return items
  }, [allResources, invView, search, hideSystemInv])

  const classes = useClasses()

  const handleRailClick = (section: RailSection) => {
    if (section === rail && section !== 'home') {
      setPanelOpen(p => !p)
    } else {
      setRail(section)
      setPanelOpen(true)
    }
    setSearch('')
  }

  // ── Render content ──────────────────────────────────────────────────────────

  const renderContent = () => {
    if (rail === 'home') return <ReportView allResources={allResources} allEnvironments={allEnvironments} />

    if (rail === 'inventory') {
      const label = INV_LABELS[invView]
      const showTable = invView === 'all' || invView === 'apps' || invView === 'flows' || invView === 'agents'

      return (
        <>
          <div className={classes.contentHeader}>
            <div>
              <Text className={classes.pageTitle}>{label}</Text>
              {showTable && (
                <Caption1 className={classes.pageSub}>
                  {isLoadingResources
                    ? 'Loading…'
                    : resources.hasNextPage || resources.isFetchingNextPage
                      ? `${filtered.length} loaded, fetching more…`
                      : `${filtered.length} resource${filtered.length !== 1 ? 's' : ''}`}
                </Caption1>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {showTable && (
                <Input
                  contentBefore={<SearchRegular />}
                  placeholder="Search…"
                  value={search}
                  onChange={(_, d) => setSearch(d.value)}
                  style={{ width: '220px' }}
                />
              )}
              {showTable && (
                <Button
                  size="small"
                  appearance={hideSystemInv ? 'primary' : 'subtle'}
                  onClick={() => setHideSystemInv(h => !h)}
                >
                  {hideSystemInv ? 'System hidden' : 'Show system'}
                </Button>
              )}
              <Button
                appearance="subtle"
                icon={<ArrowClockwiseRegular style={{ transform: isRefreshing ? 'rotate(360deg)' : undefined, transition: 'transform 1s linear' }} />}
                size="small"
                onClick={() => { resources.refetch(); groups.refetch() }}
              />
            </div>
          </div>

          {resources.error && <ErrorBanner error={resources.error} onRetry={() => resources.refetch()} />}

          {invView === 'groups'
            ? <GroupsView groups={allGroups} environments={allEnvironments} allResources={allResources} ownerNames={ownerNames} isLoading={isLoadingGroups} />
            : invView === 'users'
            ? <UsersView resources={allResources} ownerNames={ownerNames} allEnvironments={allEnvironments} />
            : invView === 'environments'
            ? <EnvironmentsView environments={allEnvironments} allResources={allResources} ownerNames={ownerNames} />
            : <ResourceTable resources={filtered} isLoading={isLoadingResources} ownerNames={ownerNames} allEnvironments={allEnvironments} />
          }
        </>
      )
    }

    if (rail === 'governance') {
      const govLabels: Record<GovView, string> = { overview: 'Overview', 'tenant-settings': 'Tenant Settings', dlp: 'DLP Policies', recommendations: 'Recommendations', 'maker-analytics': 'Maker Analytics', 'risk-assessments': 'Risk Assessments' }
      return (
        <>
          <div className={classes.contentHeader}>
            <Text className={classes.pageTitle}>{govLabels[govView]}</Text>
          </div>
          {govView === 'overview' && (
            <GovOverviewPage
              allResources={allResources}
              allEnvironments={allEnvironments}
              onRecsClick={() => setGovView('recommendations')}
              onEnvsClick={() => { setRail('inventory'); setInvView('environments') }}
            />
          )}
          {govView === 'tenant-settings' && <GovTenantSettingsPage />}
          {govView === 'dlp' && <GovDLPPage allEnvironments={allEnvironments} />}
          {govView === 'recommendations' && <RecsTab allEnvironments={allEnvironments} />}
          {govView === 'maker-analytics' && (
            <MakerAnalyticsView allResources={allResources} allEnvironments={allEnvironments} ownerNames={ownerNames} />
          )}
          {govView === 'risk-assessments' && (
            <RiskAssessmentView allResources={allResources} allEnvironments={allEnvironments} ownerNames={ownerNames} currentUser={account?.username ?? ''} />
          )}
        </>
      )
    }
  }

  return (
    <div className={classes.shell}>
      <AppHeader
        userName={account?.name ?? account?.username ?? ''}
        onSignOut={() => instance.logoutPopup().catch(console.error)}
      />

      <div className={classes.body}>
        {/* Rail */}
        <nav className={classes.rail}>
          <RailButton icon={<HomeRegular />} label="Home" active={rail === 'home'} onClick={() => handleRailClick('home')} />
          <RailButton icon={<TableSimpleRegular />} label="Inventory" active={rail === 'inventory'} onClick={() => handleRailClick('inventory')} />
          <RailButton icon={<ShieldRegular />} label="Governance" active={rail === 'governance'} onClick={() => handleRailClick('governance')} />
        </nav>

        {/* Secondary panel */}
        {rail === 'inventory' && (
          <div className={panelOpen ? classes.panel : classes.panelCollapsed}>
            {panelOpen ? (
              <div className={classes.panelHeader} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1 }}>Inventory</span>
                <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: MUTED, display: 'flex', borderRadius: '4px' }} title="Collapse">
                  <ChevronLeftRegular fontSize={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => setPanelOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: MUTED, display: 'flex', borderRadius: '4px', marginBottom: '4px' }} title="Expand">
                <ChevronRightRegular fontSize={16} />
              </button>
            )}
            <NavItem icon={<GridRegular />} label="All Resources" active={invView === 'all'} onClick={() => setInvView('all')} collapsed={!panelOpen} />
            <NavItem icon={<PowerAppsIcon fontSize={20} />} label="Apps" active={invView === 'apps'} onClick={() => setInvView('apps')} collapsed={!panelOpen} />
            <NavItem icon={<PowerAutomateIcon fontSize={20} />} label="Flows" active={invView === 'flows'} onClick={() => setInvView('flows')} collapsed={!panelOpen} />
            <NavItem icon={<CopilotStudioIcon fontSize={20} />} label="Agents" active={invView === 'agents'} onClick={() => setInvView('agents')} collapsed={!panelOpen} />
            <NavItem icon={<GlobeRegular />} label="Environments" active={invView === 'environments'} onClick={() => setInvView('environments')} collapsed={!panelOpen} />
            <NavItem icon={<FolderOpenRegular />} label="Environment Groups" active={invView === 'groups'} onClick={() => setInvView('groups')} collapsed={!panelOpen} />
            <NavItem icon={<PersonRegular />} label="Users" active={invView === 'users'} onClick={() => setInvView('users')} collapsed={!panelOpen} />
          </div>
        )}

        {rail === 'governance' && (
          <div className={panelOpen ? classes.panel : classes.panelCollapsed}>
            {panelOpen ? (
              <div className={classes.panelHeader} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1 }}>Governance</span>
                <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: MUTED, display: 'flex', borderRadius: '4px' }} title="Collapse">
                  <ChevronLeftRegular fontSize={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => setPanelOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: MUTED, display: 'flex', borderRadius: '4px', marginBottom: '4px' }} title="Expand">
                <ChevronRightRegular fontSize={16} />
              </button>
            )}
            <NavItem icon={<ShieldCheckmarkRegular />} label="Overview" active={govView === 'overview'} onClick={() => setGovView('overview')} collapsed={!panelOpen} />
            <NavItem icon={<PersonRegular />} label="Tenant Settings" active={govView === 'tenant-settings'} onClick={() => setGovView('tenant-settings')} collapsed={!panelOpen} />
            <NavItem icon={<LockClosedRegular />} label="DLP Policies" active={govView === 'dlp'} onClick={() => setGovView('dlp')} collapsed={!panelOpen} />
            <NavItem icon={<LightbulbRegular />} label="Recommendations" active={govView === 'recommendations'} onClick={() => setGovView('recommendations')} collapsed={!panelOpen} />
            <NavItem icon={<GridRegular />} label="Maker Analytics" active={govView === 'maker-analytics'} onClick={() => setGovView('maker-analytics')} collapsed={!panelOpen} />
            <NavItem icon={<ShieldRegular />} label="Risk Assessments" active={govView === 'risk-assessments'} onClick={() => setGovView('risk-assessments')} collapsed={!panelOpen} />
          </div>
        )}

        {/* Main content */}
        <main className={classes.content}>
          <div className={classes.contentScroll}>
            {renderContent()}
          </div>
        </main>
      </div>

      {isOpen && <DebugPanel />}
    </div>
  )
}
