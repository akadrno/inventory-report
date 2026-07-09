import { useState, useMemo, useEffect } from 'react'
import { makeStyles, tokens, Text, Caption1, Button, Badge, Spinner, Input } from '@fluentui/react-components'
import {
  HomeRegular,
  ClipboardBulletListRegular,
  ShieldRegular,
  GlobeRegular,
  DatabaseRegular,
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
  PlugConnectedRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  ChevronLeftRegular,
  TagMultipleRegular,
  TagRegular,
  BookmarkRegular,
  CertificateRegular,
  ChartMultipleRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from '@fluentui/react-icons'
import { useThemeMode } from '../context/ThemeContext'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { useMsal } from '@azure/msal-react'
import { useResources } from '../hooks/useResources'
import { useEnvironmentGroups } from '../hooks/useEnvironmentGroups'
import { useEnvironments } from '../hooks/useEnvironments'
import { useOwnerNames, isSystemResource } from '../hooks/useOwnerNames'
import { useResourceTypeCanary } from '../hooks/useResourceTypeCanary'
import {
  useDLPPolicies, useTenantSettings, useLicenses,
  useCrossTenantConnections, useAdvisorRecommendations, useConnectionsReport,
  useRuleBasedPolicies,
} from '../hooks/useGovernance'
import type { SubscribedSku } from '../hooks/useGovernance'
import { ruleBasedPolicyHasAcp } from '../api/governanceApi'
import { isPowerPlatformSku } from '../api/graphApi'
import { ResourceTable } from './ResourceTable'
import { GroupsView } from './GroupsView'
import { UsersView } from './UsersView'
import { EnvironmentsView } from './EnvironmentsView'
import { ReportView, RecsTab, buildRecs } from './ReportView'
import { MakerAnalyticsView } from './MakerAnalyticsView'
import { RiskAssessmentView } from './RiskAssessmentView'
import { UsageView } from './UsageView'
import { UsageDetailView } from './UsageDetail'
import { UsageHeatmap } from './UsageHeatmap'
import { CapacityBillingView } from './CapacityBillingView'
import { ResourceTaggingView } from './ResourceTaggingView'
import type { TagView } from './ResourceTaggingView'
import { ErrorBanner } from './ErrorBanner'
import { DebugPanel } from './DebugPanel'
import { useDebug } from '../context/DebugContext'
import type { ResourceItem } from '../types'
import { getResourceCategory, getDisplayName, getIsManagedEnvironment, getOwnerFromProperties } from '../types'
import { GUID_RE } from '../hooks/useOwnerNames'
import { buildEnvMap, resolveEnvironmentName } from '../utils/environment'
import { formatRegion } from '../utils/regions'
import { isM365BuilderAgent } from '../utils/resourceMetadata'
import { friendlyType } from './ResourceTypeBadge'
import {
  computeInsights,
  countTenantWarnings,
  TenantSettingsSection,
  DLPSection,
  DLPPolicyDetail,
  EnvironmentDrillDown,
  CrossTenantSection,
  ConnectionsSection,
  RecommendationsSection,
  RecommendationDetail,
} from './GovernanceView'
import type { InsightKey } from './GovernanceView'
import type { DLPPolicy } from '../hooks/useGovernance'

// ── Design constants (Fluent v9 tokens — auto-adapt to light/dark theme) ─────

const RAIL_BG = tokens.colorNeutralBackground4
const PANEL_BG = tokens.colorNeutralBackground3
const CONTENT_BG = tokens.colorNeutralBackground2
const ACTIVE = tokens.colorBrandForeground1
const ACTIVE_BG = tokens.colorNeutralBackground1
const HOVER = tokens.colorSubtleBackgroundHover
const TEXT = tokens.colorNeutralForeground1
const MUTED = tokens.colorNeutralForeground3
const STROKE1 = tokens.colorNeutralStroke2

// ── Types ─────────────────────────────────────────────────────────────────────

type RailSection = 'home' | 'inventory' | 'governance' | 'usage' | 'tags' | 'licensing'
type InvView = 'all' | 'apps' | 'flows' | 'agents' | 'environments' | 'groups' | 'users'
type FlowSubView = 'all' | 'cloud' | 'agent' | 'm365agent'
type AppSubView = 'all' | 'canvas' | 'modeldriven' | 'code' | 'appbuilder'
type AgentSubView = 'all' | 'copilotstudio' | 'm365builder'
type EnvSubView = 'all' | 'production' | 'default' | 'sandbox' | 'trial' | 'developer' | 'teams'
type GovView = 'overview' | 'tenant-settings' | 'dlp' | 'cross-tenant' | 'connections' | 'recommendations' | 'maker-analytics' | 'risk-assessments'
type LicensingView = 'summary' | 'capacity' | 'power-apps' | 'power-automate' | 'copilot-studio'
type UsageSubView = 'overview' | 'apps' | 'flows' | 'agents' | 'heatmap'

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
    border: `1px solid ${tokens.colorNeutralStroke1}`, backgroundColor: ACTIVE_BG, cursor: 'pointer', borderRadius: '12px',
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
    borderRadius: '12px', overflow: 'hidden',
    boxShadow: tokens.shadow8,
  },
  cardHead: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px 10px',
    backgroundImage: `linear-gradient(180deg, ${tokens.colorNeutralBackground2}, transparent)`,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    fontSize: '14px', fontWeight: 600, color: tokens.colorNeutralForeground1,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
  },
  summaryCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: ACTIVE_BG,
    border: `1px solid ${STROKE1}`,
    borderRadius: '12px', padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: '12px',
    boxShadow: tokens.shadow8,
    transition: 'transform 0.16s ease, box-shadow 0.16s ease',
    ':hover': { transform: 'translateY(-2px)', boxShadow: tokens.shadow16 },
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
    fontWeight: 600, fontSize: '12px', color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1,
    whiteSpace: 'nowrap',
  },
  thR: {
    padding: '8px 16px', textAlign: 'right',
    fontWeight: 600, fontSize: '12px', color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground3,
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
  const { isOpen, setIsOpen, entries, unknownTypes } = useDebug()
  const { mode, toggleMode } = useThemeMode()
  const errorCount = entries.filter(e => e.error || (e.status !== undefined && e.status >= 400)).length
  const unknownTypeCount = unknownTypes.length
  const isDark = mode === 'dark'

  return (
    <header className={classes.header}>
      <div className={classes.headerLeft} />
      <div className={classes.headerCenter} />
      <div className={classes.headerRight}>
        <Button
          appearance="subtle"
          icon={isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
          size="small"
          onClick={toggleMode}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        />
        <span style={{ fontSize: '13px', color: tokens.colorNeutralForeground3, marginRight: '4px' }}>{userName}</span>
        <div style={{ position: 'relative' }}>
          <Button appearance="subtle" icon={<SettingsRegular />} size="small" onClick={() => setIsOpen(!isOpen)} title="Debug panel" aria-label="Debug panel" />
          {unknownTypeCount > 0 && !isOpen && (
            <Badge size="tiny" color="warning" style={{ position: 'absolute', top: 2, right: 14 }} title={`${unknownTypeCount} unknown resource type${unknownTypeCount === 1 ? '' : 's'} detected`} />
          )}
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

// ── Sub-filter row (Inventory: distinguish flow / app / agent / env subtypes) ─

function SubFilterRow<T extends string>({
  value, onChange, options,
}: {
  value: T
  onChange: (next: T) => void
  options: { key: T; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
      {options.map(opt => (
        <Button
          key={opt.key}
          size="small"
          appearance={value === opt.key ? 'primary' : 'subtle'}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}

// ── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; collapsed?: boolean }) {
  const classes = useClasses()
  if (collapsed) {
    return (
      <button className={active ? classes.navIconBtnActive : classes.navIconBtn} onClick={onClick} title={label}>
        <span style={{ fontSize: 20, color: active ? ACTIVE : MUTED, lineHeight: 1 }}>{icon}</span>
      </button>
    )
  }
  return (
    <button className={active ? classes.navItemActive : classes.navItem} onClick={onClick}>
      <span style={{ fontSize: 20, color: active ? ACTIVE : MUTED, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// ── Secondary nav panel (shared chrome: title + collapse/expand toggle) ───────

function NavPanel({
  title, panelOpen, setPanelOpen, children,
}: {
  title: string
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  children: React.ReactNode
}) {
  const classes = useClasses()
  const toggleBtn = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: MUTED, display: 'flex', borderRadius: '4px',
  } as const
  return (
    <div className={panelOpen ? classes.panel : classes.panelCollapsed}>
      {panelOpen ? (
        <div className={classes.panelHeader} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{title}</span>
          <button onClick={() => setPanelOpen(false)} style={{ ...toggleBtn, padding: '4px' }} title="Collapse" aria-label="Collapse navigation">
            <ChevronLeftRegular fontSize={16} />
          </button>
        </div>
      ) : (
        <button onClick={() => setPanelOpen(true)} style={{ ...toggleBtn, padding: '6px', marginBottom: '4px' }} title="Expand" aria-label="Expand navigation">
          <ChevronRightRegular fontSize={16} />
        </button>
      )}
      {children}
    </div>
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

  if (drillDown === 'unmanaged-envs') {
    return <EnvironmentDrillDown allEnvironments={allEnvironments} allResources={allResources} onBack={() => setDrillDown(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary cards */}
      <div className={classes.summaryGrid}>
        <div className={classes.summaryCard}
          style={{ backgroundColor: tokens.colorStatusDangerBackground1, borderColor: tokens.colorStatusDangerBorder1, cursor: 'pointer' }}
          onClick={onRecsClick} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRecsClick() } }}
        >
          <ErrorCircleRegular fontSize={28} style={{ color: tokens.colorStatusDangerForeground1, flexShrink: 0 }} />
          <div>
            <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: tokens.colorStatusDangerForeground1 }}>{criticalCount}</Text>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Critical</Caption1>
          </div>
        </div>
        <div className={classes.summaryCard}
          style={{ backgroundColor: tokens.colorStatusWarningBackground1, borderColor: tokens.colorStatusWarningBorder1, cursor: 'pointer' }}
          onClick={onRecsClick} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRecsClick() } }}
        >
          <WarningRegular fontSize={28} style={{ color: tokens.colorStatusWarningForeground1, flexShrink: 0 }} />
          <div>
            <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: tokens.colorStatusWarningForeground2 }}>{warningCount}</Text>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Warnings</Caption1>
          </div>
        </div>
        <div className={classes.summaryCard}
          style={{ backgroundColor: tokens.colorBrandBackground2, borderWidth: '2px', borderColor: tokens.colorBrandStroke1, cursor: 'pointer' }}
          onClick={onEnvsClick} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEnvsClick() } }}
        >
          <ShieldCheckmarkRegular fontSize={28} style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }} />
          <div>
            <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: tokens.colorBrandForeground1 }}>{managedCount}/{envCount}</Text>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Managed Environments</Caption1>
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
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrillDown(insight.drillDownKey!) } }) : undefined}
              >
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  {insight.severity === 'critical' && <ErrorCircleRegular fontSize={16} style={{ color: tokens.colorStatusDangerForeground1 }} />}
                  {insight.severity === 'warning' && <WarningRegular fontSize={16} style={{ color: tokens.colorStatusWarningForeground1 }} />}
                  {insight.severity === 'info' && <InfoRegular fontSize={16} style={{ color: tokens.colorNeutralForeground3 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: TEXT }}>{insight.title}</Text>
                  <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>{insight.detail}</Caption1>
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

  const warnings = countTenantWarnings(data)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <PersonRegular fontSize={16} style={{ color: ACTIVE }} />
        <Text weight="semibold">Tenant Settings</Text>
        {warnings > 0 && (
          <Badge appearance="tint" color="warning" size="small">{warnings} warning{warnings !== 1 ? 's' : ''}</Badge>
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
        <div className={classes.finding} style={{ backgroundColor: tokens.colorStatusDangerBackground1, borderLeftColor: tokens.colorStatusDangerBorder1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ErrorCircleRegular fontSize={16} style={{ color: tokens.colorStatusDangerForeground1 }} />
            <Text style={{ fontWeight: 600, fontSize: '13px', color: tokens.colorNeutralForeground1 }}>No DLP policies found — all connectors unrestricted</Text>
          </div>
          <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Without DLP policies, any connector can communicate with any other. Sensitive data can be exfiltrated with no audit trail.</Caption1>
        </div>
      )}
      {allInGeneral && !hasNoPolicies && (
        <div className={classes.finding} style={{ backgroundColor: tokens.colorStatusDangerBackground1, borderLeftColor: tokens.colorStatusDangerBorder1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ErrorCircleRegular fontSize={16} style={{ color: tokens.colorStatusDangerForeground1 }} />
            <Text style={{ fontWeight: 600, fontSize: '13px', color: tokens.colorNeutralForeground1 }}>All connectors in General — no data separation</Text>
          </div>
          <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Move sensitive connectors (Dataverse, SharePoint, SQL, Office 365) to the Confidential group.</Caption1>
        </div>
      )}
      {noBlocked && !hasNoPolicies && (
        <div className={classes.finding} style={{ backgroundColor: tokens.colorStatusWarningBackground1, borderLeftColor: tokens.colorStatusWarningBorder1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WarningRegular fontSize={16} style={{ color: tokens.colorStatusWarningForeground1 }} />
            <Text style={{ fontWeight: 600, fontSize: '13px', color: tokens.colorNeutralForeground1 }}>No connectors in the Blocked group</Text>
          </div>
          <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Block the HTTP connector and custom connectors to prevent arbitrary external data flows.</Caption1>
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

// ── Governance: Cross Tenant Connections page ────────────────────────────────

function GovPermNotice({ message }: { message: string }) {
  const classes = useClasses()
  return (
    <div className={classes.sectionCard}>
      <div className={classes.permNotice}>
        <LockClosedRegular fontSize={16} />
        <Caption1>{message}</Caption1>
      </div>
    </div>
  )
}

function GovCrossTenantPage() {
  const classes = useClasses()
  // Reads the cached report from Azure Storage (fast); auto-populates an empty
  // cache and lets Refresh regenerate it. Falls back to a live fetch when
  // storage isn't configured.
  const state = useCrossTenantConnections(true)

  if (state.isLoading) {
    return <div style={{ padding: '24px' }}><Spinner size="small" label="Loading cross-tenant connection report…" /></div>
  }
  if (!state.report && state.isUpdating) {
    return <div style={{ padding: '24px' }}><Spinner size="small" label="Generating cross-tenant connection report…" /></div>
  }
  if (!state.report && state.isError) {
    return <GovPermNotice message="Requires Power Platform admin permissions. Cross-tenant connection reports are read from the governance API." />
  }
  if (!state.report) {
    return <div style={{ padding: '24px' }}><Spinner size="small" label="Preparing cross-tenant connection report…" /></div>
  }

  return (
    <div className={classes.sectionCard}>
      <div className={classes.cardHead}>
        <GlobeRegular fontSize={16} style={{ color: ACTIVE }} />
        Cross Tenant Connections
      </div>
      <CrossTenantSection
        report={state.report}
        onRefresh={state.refresh}
        isUpdating={state.isUpdating}
        cachedAt={state.cachedAt}
      />
    </div>
  )
}

// ── Governance: Connections page ─────────────────────────────────────────────

function GovConnectionsPage({ allEnvironments }: { allEnvironments: ResourceItem[] }) {
  const envIds = useMemo(() => allEnvironments.map(e => e.name).filter(Boolean), [allEnvironments])
  const envNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of allEnvironments) {
      if (e.name) m.set(e.name, getDisplayName(e))
    }
    return m
  }, [allEnvironments])
  const state = useConnectionsReport(envIds, true)

  if (state.isLoading) {
    return <div style={{ padding: '24px' }}><Spinner size="small" label="Loading connections…" /></div>
  }
  if (!state.report && state.isUpdating) {
    return <div style={{ padding: '24px' }}><Spinner size="small" label="Scanning all environments for connections…" /></div>
  }
  if (!state.report && state.isError) {
    return <GovPermNotice message="Requires Power Platform admin permissions to enumerate connections across environments." />
  }
  if (!state.report) {
    return <div style={{ padding: '24px' }}><Spinner size="small" label="Preparing connections…" /></div>
  }

  return (
    <ConnectionsSection
      result={state.report}
      environments={allEnvironments}
      envNames={envNames}
      onRefresh={state.refresh}
      isUpdating={state.isUpdating}
      cachedAt={state.cachedAt}
    />
  )
}

// ── Collapsible card (clickable header toggles the body) ─────────────────────

function CollapsibleCard({
  icon, title, badge, defaultOpen = true, children,
}: {
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const classes = useClasses()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={classes.sectionCard}>
      <div
        className={classes.cardHead}
        style={{ cursor: 'pointer', userSelect: 'none', borderBottom: open ? undefined : 'none' }}
        onClick={() => setOpen(o => !o)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
      >
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        {badge}
        {open
          ? <ChevronDownRegular fontSize={16} style={{ color: MUTED }} />
          : <ChevronRightRegular fontSize={16} style={{ color: MUTED }} />}
      </div>
      {open && children}
    </div>
  )
}

// ── Governance: Recommendations page (Advisor + computed) ────────────────────

function GovRecommendationsPage({ allEnvironments }: { allEnvironments: ResourceItem[] }) {
  const classes = useClasses()
  const [scenario, setScenario] = useState<string | null>(null)
  const advisor = useAdvisorRecommendations(true)
  const acp = useRuleBasedPolicies(true)
  const acpMatches = useMemo(() => (acp.data ?? []).filter(ruleBasedPolicyHasAcp), [acp.data])

  // The drill-down takes over the whole page (its own breadcrumb back-nav).
  if (scenario) {
    return <RecommendationDetail scenario={scenario} onBack={() => setScenario(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Advisor (security & governance) recommendations from the analytics API */}
      <CollapsibleCard
        icon={<LightbulbRegular fontSize={16} style={{ color: ACTIVE }} />}
        title="Advisor Recommendations"
        defaultOpen={false}
        badge={advisor.data && advisor.data.length > 0
          ? <Badge appearance="tint" color="informative" size="small">{advisor.data.length}</Badge>
          : undefined}
      >
        {advisor.isError ? (
          <div className={classes.permNotice}>
            <LockClosedRegular fontSize={16} />
            <Caption1>Advisor recommendations require Managed Environments and Power Platform admin permissions.</Caption1>
          </div>
        ) : advisor.isLoading ? (
          <div style={{ padding: '16px' }}><Spinner size="extra-small" label="Loading Advisor recommendations…" /></div>
        ) : (
          <RecommendationsSection recommendations={advisor.data ?? []} onScenarioClick={setScenario} />
        )}
      </CollapsibleCard>

      {/* Advanced Connector Policies (ACP) — the GA replacement for classic DLP */}
      <CollapsibleCard
        icon={<PlugConnectedRegular fontSize={16} style={{ color: ACTIVE }} />}
        title="Advanced Connector Policies (ACP)"
        badge={acpMatches.length > 0 ? <Badge appearance="tint" color="brand" size="small">{acpMatches.length}</Badge> : undefined}
      >
        {acp.isError ? (
          <div className={classes.permNotice}>
            <LockClosedRegular fontSize={16} />
            <Caption1>Requires Power Platform admin permissions to read rule-based policies.</Caption1>
          </div>
        ) : acp.isLoading ? (
          <div style={{ padding: '16px' }}><Spinner size="extra-small" label="Detecting Advanced Connector Policies…" /></div>
        ) : (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Caption1 style={{ color: MUTED }}>
              ACP is the GA replacement for classic DLP — a default-deny connector allowlist with action-level control. Detection here is best-effort, since the rule type is newly GA.
            </Caption1>
            {acpMatches.length > 0 ? (
              <>
                <Text style={{ fontSize: '13px', fontWeight: 600, color: TEXT }}>
                  Detected on {acpMatches.length} rule-based polic{acpMatches.length === 1 ? 'y' : 'ies'} (applied to their assigned environment groups):
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {acpMatches.map((p, i) => (
                    <div key={p.id ?? p.name ?? i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: `1px solid ${STROKE1}`, borderRadius: '4px' }}>
                      <PlugConnectedRegular fontSize={16} style={{ color: ACTIVE, flexShrink: 0 }} />
                      <Text style={{ fontSize: '13px', flex: 1 }}>{p.displayName ?? p.name ?? p.id}</Text>
                      <Badge appearance="tint" color="brand" size="small">ACP</Badge>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Text style={{ fontSize: '13px', color: MUTED }}>
                No Advanced Connector Policies detected via the governance API. If you adopted ACP very recently — or set it directly on individual environments — it may not surface here yet. See “Recommended Actions” below to migrate from classic DLP.
              </Text>
            )}
          </div>
        )}
      </CollapsibleCard>

      {/* The app's own computed recommendations from inventory + tenant settings */}
      <CollapsibleCard
        icon={<ShieldRegular fontSize={16} style={{ color: ACTIVE }} />}
        title="Recommended Actions"
      >
        <div style={{ padding: '12px 16px' }}>
          <RecsTab allEnvironments={allEnvironments} />
        </div>
      </CollapsibleCard>
    </div>
  )
}

// ── Licensing helpers ──────────────────────────────────────────────────────────

type SkuCategory = 'power-apps' | 'power-automate' | 'copilot-studio'

function categorizeSku(partNumber: string, servicePlans: { servicePlanName: string }[]): SkuCategory | null {
  const p = partNumber.toLowerCase()
  if (p.includes('powerapps') || p.includes('power_apps')) return 'power-apps'
  if (p.includes('flow') || p.includes('power_automate') || p.includes('powerautomate')) return 'power-automate'
  if (p.includes('copilot') || p.includes('virtual_agent') || p.includes('powervirtualagent') || p.includes('copilotstudio')) return 'copilot-studio'
  // Check service plan names as fallback
  for (const sp of servicePlans) {
    const s = sp.servicePlanName.toLowerCase()
    if (s.includes('powerapps') || s.includes('power_apps')) return 'power-apps'
    if (s.includes('flow') || s.includes('power_automate')) return 'power-automate'
    if (s.includes('copilot') || s.includes('virtual_agent') || s.includes('copilotstudio')) return 'copilot-studio'
  }
  return null
}

function formatSkuName(partNumber: string): string {
  return partNumber.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const LICENSING_LABELS: Record<LicensingView, string> = {
  summary: 'Summary',
  capacity: 'Capacity & Billing',
  'power-apps': 'Power Apps',
  'power-automate': 'Power Automate',
  'copilot-studio': 'Copilot Studio',
}

// ── Licensing: Product page ───────────────────────────────────────────────────

function LicensingProductPage({ product, skus }: { product: LicensingView; skus: SubscribedSku[] }) {
  const classes = useClasses()

  const productSkus = useMemo(() => {
    if (product === 'summary') return skus
    return skus.filter(s => categorizeSku(s.skuPartNumber, s.servicePlans) === product)
  }, [skus, product])

  const totalPurchased = productSkus.reduce((s, sk) => s + sk.prepaidUnits.enabled, 0)
  const totalAssigned = productSkus.reduce((s, sk) => s + sk.consumedUnits, 0)

  const productIcon = product === 'power-apps' ? <PowerAppsIcon fontSize={24} />
    : product === 'power-automate' ? <PowerAutomateIcon fontSize={24} />
    : product === 'copilot-studio' ? <CopilotStudioIcon fontSize={24} />
    : <CertificateRegular fontSize={24} style={{ color: ACTIVE }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Product header */}
      {product !== 'summary' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {productIcon}
          <Text style={{ fontSize: '18px', fontWeight: 600, color: TEXT }}>{LICENSING_LABELS[product]}</Text>
        </div>
      )}

      {/* Capacity summary */}
      <div className={classes.sectionCard}>
        <div className={classes.cardHead}>
          <CertificateRegular fontSize={16} style={{ color: ACTIVE }} />
          Capacity summary
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: STROKE1 }}>
          {/* Left: totals */}
          <div style={{ padding: '16px 20px', borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: STROKE1 }}>
            <Caption1 style={{ color: MUTED, display: 'block', marginBottom: '12px' }}>License totals</Caption1>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: TEXT }}>{productSkus.length}</Text>
                <Caption1 style={{ color: MUTED }}>SKUs</Caption1>
              </div>
              <div>
                <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: TEXT }}>{totalPurchased.toLocaleString()}</Text>
                <Caption1 style={{ color: MUTED }}>Purchased</Caption1>
              </div>
              <div>
                <Text style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1, color: TEXT }}>{totalAssigned.toLocaleString()}</Text>
                <Caption1 style={{ color: MUTED }}>Assigned</Caption1>
              </div>
            </div>
          </div>
          {/* Right: prepaid capacity table */}
          <div style={{ padding: '0' }}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>License</th>
                  <th className={classes.thR}>Purchased</th>
                  <th className={classes.thR}>Assigned</th>
                  <th className={classes.thR}>Consumed</th>
                </tr>
              </thead>
              <tbody>
                {productSkus.length === 0 ? (
                  <tr>
                    <td className={classes.td} colSpan={4}>
                      <Caption1 style={{ color: MUTED }}>No licenses in this category</Caption1>
                    </td>
                  </tr>
                ) : productSkus.map(sku => {
                  const purchased = sku.prepaidUnits.enabled
                  const consumed = sku.consumedUnits
                  const over = consumed > purchased
                  return (
                    <tr key={sku.id}>
                      <td className={classes.td}>
                        <Text style={{ fontSize: '13px' }}>{formatSkuName(sku.skuPartNumber)}</Text>
                      </td>
                      <td className={classes.tdR}>{purchased.toLocaleString()}</td>
                      <td className={classes.tdR}>{consumed.toLocaleString()}</td>
                      <td className={classes.tdR}>
                        {over ? (
                          <span style={{ color: tokens.colorStatusDangerForeground1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            <WarningRegular fontSize={14} />
                            {consumed.toLocaleString()}
                          </span>
                        ) : consumed.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed SKU list */}
      <div className={classes.sectionCard}>
        <div className={classes.cardHead}>
          <GridRegular fontSize={16} style={{ color: ACTIVE }} />
          License details
          <Badge appearance="tint" color="informative" size="small">{productSkus.length} SKU{productSkus.length !== 1 ? 's' : ''}</Badge>
        </div>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.th}>License</th>
              <th className={classes.th}>Status</th>
              <th className={classes.thR}>Available</th>
              <th className={classes.thR}>Assigned</th>
              <th className={classes.thR}>Utilization</th>
            </tr>
          </thead>
          <tbody>
            {productSkus.length === 0 ? (
              <tr>
                <td className={classes.td} colSpan={5}>
                  <Caption1 style={{ color: MUTED }}>No licenses found for this product</Caption1>
                </td>
              </tr>
            ) : productSkus.sort((a, b) => b.consumedUnits - a.consumedUnits).map(sku => {
              const avail = sku.prepaidUnits.enabled
              const used = sku.consumedUnits
              const pct = avail > 0 ? Math.round((used / avail) * 100) : 0
              const over = used > avail
              return (
                <tr key={sku.id}>
                  <td className={classes.td}>
                    <Text style={{ fontWeight: 600, fontSize: '13px', display: 'block' }}>{formatSkuName(sku.skuPartNumber)}</Text>
                    <Caption1 style={{ color: MUTED }}>{sku.skuPartNumber}</Caption1>
                  </td>
                  <td className={classes.td}>
                    <Badge
                      appearance="tint"
                      color={sku.capabilityStatus === 'Enabled' ? 'success' : sku.capabilityStatus === 'Warning' ? 'warning' : 'danger'}
                      size="small"
                    >
                      {sku.capabilityStatus}
                    </Badge>
                  </td>
                  <td className={classes.tdR}>{avail.toLocaleString()}</td>
                  <td className={classes.tdR}>{used.toLocaleString()}</td>
                  <td className={classes.tdR}>
                    <span style={{ color: over ? tokens.colorStatusDangerForeground1 : pct >= 90 ? tokens.colorStatusWarningForeground1 : undefined }}>
                      {avail > 0 ? `${pct}%` : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Licensing: Content wrapper ────────────────────────────────────────────────

function LicensingContent({ licView }: { licView: LicensingView }) {
  const classes = useClasses()
  const { data, isLoading, isError } = useLicenses()

  if (isLoading) return <div style={{ padding: '24px' }}><Spinner size="small" label="Loading licenses…" /></div>
  if (isError || !data) return (
    <div className={classes.sectionCard}>
      <div className={classes.permNotice}>
        <LockClosedRegular fontSize={16} />
        <Caption1>Requires Organization.Read.All permission on Microsoft Graph. Ensure the app registration has this scope and admin consent has been granted.</Caption1>
      </div>
    </div>
  )

  const ppSkus = data.filter(isPowerPlatformSku)

  return (
    <>
      <div className={classes.contentHeader}>
        <Text className={classes.pageTitle}>Licenses</Text>
      </div>
      <LicensingProductPage product={licView} skus={ppSkus} />
    </>
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
  const [flowSubView, setFlowSubView] = useState<FlowSubView>('all')
  const [appSubView, setAppSubView] = useState<AppSubView>('all')
  const [agentSubView, setAgentSubView] = useState<AgentSubView>('all')
  const [envSubView, setEnvSubView] = useState<EnvSubView>('all')
  const [govView, setGovView] = useState<GovView>('overview')
  const [licView, setLicView] = useState<LicensingView>('summary')
  const [tagView, setTagView] = useState<TagView>('browser')
  const [usageView, setUsageView] = useState<UsageSubView>('overview')
  const [search, setSearch] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [hideSystemInv, setHideSystemInv] = useState(true)

  const resources = useResources()
  const groups = useEnvironmentGroups()
  const environmentsQuery = useEnvironments()
  const { isOpen, setUnknownTypes } = useDebug()

  const canaryEnabled = isOpen || import.meta.env.DEV
  const { result: canary } = useResourceTypeCanary(canaryEnabled)

  useEffect(() => {
    setUnknownTypes(canary.unknownTypes)
  }, [canary.unknownTypes, setUnknownTypes])

  const { instance, accounts } = useMsal()
  const account = accounts[0]

  const allResources = useMemo(() => resources.data?.pages.flatMap(p => p.data) ?? [], [resources.data])
  const allGroups = useMemo(() => groups.data?.pages.flatMap(p => p.data) ?? [], [groups.data])
  const allEnvironments = useMemo(() => environmentsQuery.data?.pages.flatMap(p => p.data) ?? [], [environmentsQuery.data])
  const ownerNames = useOwnerNames(allResources)
  const nonSystemResources = useMemo(() => allResources.filter(r => !isSystemResource(r)), [allResources])

  const isLoadingResources = resources.isLoading && allResources.length === 0
  const isLoadingGroups = groups.isLoading && allGroups.length === 0
  const isRefreshing = resources.isLoading || groups.isLoading

  // Cached env name map so the search filter doesn't rebuild it per item.
  const searchEnvMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])

  const filtered = useMemo(() => {
    let items = allResources
    if (hideSystemInv) items = items.filter(r => !isSystemResource(r))
    if (invView !== 'all' && invView !== 'environments' && invView !== 'groups' && invView !== 'users') {
      items = items.filter(r => getResourceCategory(r.type) === invView)
    }
    if (invView === 'flows' && flowSubView !== 'all') {
      items = items.filter(r => {
        const t = r.type.toLowerCase()
        if (flowSubView === 'm365agent') return t.includes('m365agentflow')
        if (flowSubView === 'agent') return t.includes('agentflow') && !t.includes('m365agentflow')
        // 'cloud' = flow category, but not agent or m365agent variants
        return !t.includes('agentflow')
      })
    }
    if (invView === 'apps' && appSubView !== 'all') {
      items = items.filter(r => {
        const t = r.type.toLowerCase()
        if (appSubView === 'canvas') return t.includes('canvas')
        if (appSubView === 'modeldriven') return t.includes('modeldriven')
        if (appSubView === 'code') return t.includes('codeapp')
        // 'appbuilder' = microsoft.powerapps/apps (the generic /apps type slot)
        return t === 'microsoft.powerapps/apps'
      })
    }
    if (invView === 'agents' && agentSubView !== 'all') {
      items = items.filter(r => {
        const isM365Builder = isM365BuilderAgent(r)
        if (agentSubView === 'm365builder') return isM365Builder
        // 'copilotstudio' = everything that isn't explicitly M365 Agent Builder
        return !isM365Builder
      })
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(r => {
        // Name
        if (getDisplayName(r).toLowerCase().includes(q)) return true
        if (r.name.toLowerCase().includes(q)) return true
        // Type (raw + friendly label, so "Cloud Flow", "Canvas App" etc. match)
        if (r.type.toLowerCase().includes(q)) return true
        if (friendlyType(r.type, r.kind).toLowerCase().includes(q)) return true
        // Environment name
        const envName = resolveEnvironmentName(r, searchEnvMap)
        if (envName && envName.toLowerCase().includes(q)) return true
        // Region (raw slug + friendly DisplayName)
        const rawRegion = (r.environmentRegion ?? r.location ?? '').toLowerCase()
        if (rawRegion.includes(q)) return true
        const friendlyRegion = formatRegion(r.environmentRegion ?? r.location).toLowerCase()
        if (friendlyRegion.includes(q)) return true
        // Owner (raw value + resolved display name when the raw is a GUID)
        const rawOwner = getOwnerFromProperties(r)
        if (rawOwner && rawOwner !== '—' && rawOwner.toLowerCase().includes(q)) return true
        if (rawOwner && GUID_RE.test(rawOwner)) {
          const resolved = ownerNames.get(rawOwner)
          if (resolved && resolved.toLowerCase().includes(q)) return true
        }
        return false
      })
    }
    return items
  }, [allResources, invView, flowSubView, appSubView, agentSubView, search, hideSystemInv, ownerNames, searchEnvMap])

  const filteredEnvironments = useMemo(() => {
    if (envSubView === 'all') return allEnvironments
    const targetMap: Record<Exclude<EnvSubView, 'all'>, string> = {
      production: 'production',
      default: 'default',
      sandbox: 'sandbox',
      trial: 'trial',
      developer: 'developer',
      teams: 'teams',
    }
    const target = targetMap[envSubView]
    return allEnvironments.filter(env => {
      const t = String(env.environmentType ?? env.properties?.['environmentType'] ?? '').toLowerCase()
      return t.includes(target)
    })
  }, [allEnvironments, envSubView])

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
    if (rail === 'home') return <ReportView allResources={allResources} allEnvironments={allEnvironments} allGroups={allGroups} ownerNames={ownerNames} onNavigateToRiskAssessments={() => { setRail('governance'); setGovView('risk-assessments') }} />

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
                  placeholder="Search name, type, environment, owner, region…"
                  aria-label="Search name, type, environment, owner, region"
                  value={search}
                  onChange={(_, d) => setSearch(d.value)}
                  style={{ width: '320px' }}
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
                aria-label="Refresh"
              />
            </div>
          </div>

          {canary.unknownTypes.length > 0 && (
            <div className={classes.permNotice} style={{ color: tokens.colorStatusWarningForeground1 }}>
              <WarningRegular fontSize={16} />
              <Caption1>
                {canary.unknownTypes.length} unrecognized inventory resource type{canary.unknownTypes.length === 1 ? '' : 's'} detected by canary scan.
                Update resource mappings to avoid under-reporting.
              </Caption1>
            </div>
          )}

          {invView === 'flows' && (
            <SubFilterRow
              value={flowSubView}
              onChange={setFlowSubView}
              options={[
                { key: 'all',       label: 'All Flows' },
                { key: 'cloud',     label: 'Cloud Flows' },
                { key: 'agent',     label: 'Agent Flows' },
                { key: 'm365agent', label: 'Workflow Agent Flows' },
              ]}
            />
          )}
          {invView === 'apps' && (
            <SubFilterRow
              value={appSubView}
              onChange={setAppSubView}
              options={[
                { key: 'all',         label: 'All Apps' },
                { key: 'canvas',      label: 'Canvas Apps' },
                { key: 'modeldriven', label: 'Model-driven Apps' },
                { key: 'code',        label: 'Code Apps' },
                { key: 'appbuilder',  label: 'App Builder' },
              ]}
            />
          )}
          {invView === 'agents' && (
            <SubFilterRow
              value={agentSubView}
              onChange={setAgentSubView}
              options={[
                { key: 'all',           label: 'All Agents' },
                { key: 'copilotstudio', label: 'Copilot Studio' },
                { key: 'm365builder',   label: 'M365 Agent Builder' },
              ]}
            />
          )}
          {invView === 'environments' && (
            <SubFilterRow
              value={envSubView}
              onChange={setEnvSubView}
              options={[
                { key: 'all',        label: 'All Environments' },
                { key: 'production', label: 'Production' },
                { key: 'default',    label: 'Default' },
                { key: 'sandbox',    label: 'Sandbox' },
                { key: 'trial',      label: 'Trial' },
                { key: 'developer',  label: 'Developer' },
                { key: 'teams',      label: 'Dataverse for Teams' },
              ]}
            />
          )}

          {resources.error && <ErrorBanner error={resources.error} onRetry={() => resources.refetch()} />}

          {invView === 'groups'
            ? <GroupsView groups={allGroups} environments={allEnvironments} allResources={nonSystemResources} ownerNames={ownerNames} isLoading={isLoadingGroups} />
            : invView === 'users'
            ? <UsersView resources={nonSystemResources} ownerNames={ownerNames} allEnvironments={allEnvironments} />
            : invView === 'environments'
            ? <EnvironmentsView environments={filteredEnvironments} allResources={nonSystemResources} ownerNames={ownerNames} />
            : <ResourceTable key={invView} resources={filtered} isLoading={isLoadingResources} ownerNames={ownerNames} allEnvironments={allEnvironments} />
          }
        </>
      )
    }

    if (rail === 'tags') {
      const tagLabels: Record<TagView, string> = { browser: 'Resources', termstore: 'Term Store' }
      const tagSubs: Record<TagView, string> = {
        browser: 'Browse and tag your Power Platform resources',
        termstore: 'Manage groups, term sets, and terms',
      }
      return (
        <>
          <div className={classes.contentHeader}>
            <div>
              <Text className={classes.pageTitle}>{tagLabels[tagView]}</Text>
              <Caption1 className={classes.pageSub}>{tagSubs[tagView]}</Caption1>
            </div>
          </div>
          <ResourceTaggingView
            allResources={nonSystemResources}
            allEnvironments={allEnvironments}
            currentUser={account?.username ?? ''}
            view={tagView}
          />
        </>
      )
    }

    if (rail === 'governance') {
      const govLabels: Record<GovView, string> = { overview: 'Overview', 'tenant-settings': 'Tenant Settings', dlp: 'DLP Policies', 'cross-tenant': 'Cross Tenant Connections', connections: 'Connections', recommendations: 'Recommendations', 'maker-analytics': 'Maker Analytics', 'risk-assessments': 'Risk Assessments' }
      return (
        <>
          <div className={classes.contentHeader}>
            <Text className={classes.pageTitle}>{govLabels[govView]}</Text>
          </div>
          {govView === 'overview' && (
            <GovOverviewPage
              allResources={nonSystemResources}
              allEnvironments={allEnvironments}
              onRecsClick={() => setGovView('recommendations')}
              onEnvsClick={() => { setRail('inventory'); setInvView('environments') }}
            />
          )}
          {govView === 'tenant-settings' && <GovTenantSettingsPage />}
          {govView === 'dlp' && <GovDLPPage allEnvironments={allEnvironments} />}
          {govView === 'cross-tenant' && <GovCrossTenantPage />}
          {govView === 'connections' && <GovConnectionsPage allEnvironments={allEnvironments} />}
          {govView === 'recommendations' && <GovRecommendationsPage allEnvironments={allEnvironments} />}
          {govView === 'maker-analytics' && (
            <MakerAnalyticsView allResources={allResources} allEnvironments={allEnvironments} ownerNames={ownerNames} />
          )}
          {govView === 'risk-assessments' && (
            <RiskAssessmentView allResources={allResources} allEnvironments={allEnvironments} ownerNames={ownerNames} currentUser={account?.username ?? ''} />
          )}
        </>
      )
    }

    if (rail === 'licensing') {
      if (licView === 'capacity') {
        return (
          <>
            <div className={classes.contentHeader}>
              <div>
                <Text className={classes.pageTitle}>Capacity &amp; Billing</Text>
                <Caption1 className={classes.pageSub}>Environment storage consumption, add-on capacity, and pay-as-you-go billing policies.</Caption1>
              </div>
            </div>
            <CapacityBillingView />
          </>
        )
      }
      return <LicensingContent licView={licView} />
    }

    if (rail === 'usage') {
      const usageMeta: Record<UsageSubView, { title: string; sub: string }> = {
        overview: { title: 'Usage Overview', sub: 'Adoption, activity, and reach across your Power Platform resources.' },
        apps:     { title: 'Apps Usage', sub: 'Adoption, activity, owners, and where Power Apps are used.' },
        flows:    { title: 'Flows Usage', sub: 'Adoption, activity, owners, and where Power Automate flows are used.' },
        agents:   { title: 'Agents Usage', sub: 'Adoption, activity, owners, and where agents are used.' },
        heatmap:  { title: 'Usage Heatmap', sub: 'Where users are signing in to Power Platform resources (Entra sign-in logs).' },
      }
      const { title, sub } = usageMeta[usageView]
      return (
        <>
          <div className={classes.contentHeader}>
            <div>
              <Text className={classes.pageTitle}>{title}</Text>
              <Caption1 className={classes.pageSub}>{sub}</Caption1>
            </div>
          </div>
          {usageView === 'heatmap' ? (
            <UsageHeatmap allResources={nonSystemResources} />
          ) : usageView === 'overview' ? (
            <UsageView
              allResources={nonSystemResources}
              allEnvironments={allEnvironments}
              ownerNames={ownerNames}
              onOpenCategory={c => setUsageView(c)}
              onOpenHeatmap={() => setUsageView('heatmap')}
            />
          ) : (
            <UsageDetailView
              category={usageView}
              allResources={nonSystemResources}
              allEnvironments={allEnvironments}
              ownerNames={ownerNames}
            />
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
          <RailButton icon={<ClipboardBulletListRegular />} label="Inventory" active={rail === 'inventory'} onClick={() => handleRailClick('inventory')} />
          <RailButton icon={<ShieldRegular />} label="Governance" active={rail === 'governance'} onClick={() => handleRailClick('governance')} />
          <RailButton icon={<ChartMultipleRegular />} label="Usage" active={rail === 'usage'} onClick={() => handleRailClick('usage')} />
          <RailButton icon={<TagMultipleRegular />} label="Tagging" active={rail === 'tags'} onClick={() => handleRailClick('tags')} />
          <RailButton icon={<CertificateRegular />} label="Licensing" active={rail === 'licensing'} onClick={() => handleRailClick('licensing')} />
        </nav>

        {/* Secondary panel */}
        {rail === 'inventory' && (
          <NavPanel title="Inventory" panelOpen={panelOpen} setPanelOpen={setPanelOpen}>
            <NavItem icon={<GridRegular />} label="All Resources" active={invView === 'all'} onClick={() => setInvView('all')} collapsed={!panelOpen} />
            <NavItem icon={<PowerAppsIcon fontSize={20} />} label="Apps" active={invView === 'apps'} onClick={() => setInvView('apps')} collapsed={!panelOpen} />
            <NavItem icon={<PowerAutomateIcon fontSize={20} />} label="Flows" active={invView === 'flows'} onClick={() => setInvView('flows')} collapsed={!panelOpen} />
            <NavItem icon={<CopilotStudioIcon fontSize={20} />} label="Agents" active={invView === 'agents'} onClick={() => setInvView('agents')} collapsed={!panelOpen} />
            <NavItem icon={<DatabaseRegular />} label="Environments" active={invView === 'environments'} onClick={() => setInvView('environments')} collapsed={!panelOpen} />
            <NavItem icon={<FolderOpenRegular />} label="Environment Groups" active={invView === 'groups'} onClick={() => setInvView('groups')} collapsed={!panelOpen} />
            <NavItem icon={<PersonRegular />} label="Users" active={invView === 'users'} onClick={() => setInvView('users')} collapsed={!panelOpen} />
          </NavPanel>
        )}

        {rail === 'governance' && (
          <NavPanel title="Governance" panelOpen={panelOpen} setPanelOpen={setPanelOpen}>
            <NavItem icon={<ShieldCheckmarkRegular />} label="Overview" active={govView === 'overview'} onClick={() => setGovView('overview')} collapsed={!panelOpen} />
            <NavItem icon={<PersonRegular />} label="Tenant Settings" active={govView === 'tenant-settings'} onClick={() => setGovView('tenant-settings')} collapsed={!panelOpen} />
            <NavItem icon={<LockClosedRegular />} label="DLP Policies" active={govView === 'dlp'} onClick={() => setGovView('dlp')} collapsed={!panelOpen} />
            <NavItem icon={<GlobeRegular />} label="Cross Tenant Connections" active={govView === 'cross-tenant'} onClick={() => setGovView('cross-tenant')} collapsed={!panelOpen} />
            <NavItem icon={<PlugConnectedRegular />} label="Connections" active={govView === 'connections'} onClick={() => setGovView('connections')} collapsed={!panelOpen} />
            <NavItem icon={<LightbulbRegular />} label="Recommendations" active={govView === 'recommendations'} onClick={() => setGovView('recommendations')} collapsed={!panelOpen} />
            <NavItem icon={<GridRegular />} label="Maker Analytics" active={govView === 'maker-analytics'} onClick={() => setGovView('maker-analytics')} collapsed={!panelOpen} />
            <NavItem icon={<ShieldRegular />} label="Risk Assessments" active={govView === 'risk-assessments'} onClick={() => setGovView('risk-assessments')} collapsed={!panelOpen} />
          </NavPanel>
        )}

        {rail === 'usage' && (
          <NavPanel title="Usage" panelOpen={panelOpen} setPanelOpen={setPanelOpen}>
            <NavItem icon={<ChartMultipleRegular />} label="Overview" active={usageView === 'overview'} onClick={() => setUsageView('overview')} collapsed={!panelOpen} />
            {panelOpen && <Caption1 style={{ padding: '12px 12px 4px 12px', color: MUTED, display: 'block', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Products</Caption1>}
            <NavItem icon={<PowerAppsIcon fontSize={20} />} label="Apps" active={usageView === 'apps'} onClick={() => setUsageView('apps')} collapsed={!panelOpen} />
            <NavItem icon={<PowerAutomateIcon fontSize={20} />} label="Flows" active={usageView === 'flows'} onClick={() => setUsageView('flows')} collapsed={!panelOpen} />
            <NavItem icon={<CopilotStudioIcon fontSize={20} />} label="Agents" active={usageView === 'agents'} onClick={() => setUsageView('agents')} collapsed={!panelOpen} />
            <NavItem icon={<GlobeRegular />} label="Heatmap" active={usageView === 'heatmap'} onClick={() => setUsageView('heatmap')} collapsed={!panelOpen} />
          </NavPanel>
        )}

        {rail === 'tags' && (
          <NavPanel title="Resource Tagging" panelOpen={panelOpen} setPanelOpen={setPanelOpen}>
            <NavItem icon={<TagRegular />} label="Resources" active={tagView === 'browser'} onClick={() => setTagView('browser')} collapsed={!panelOpen} />
            <NavItem icon={<BookmarkRegular />} label="Term Store" active={tagView === 'termstore'} onClick={() => setTagView('termstore')} collapsed={!panelOpen} />
          </NavPanel>
        )}

        {rail === 'licensing' && (
          <NavPanel title="Licensing" panelOpen={panelOpen} setPanelOpen={setPanelOpen}>
            <NavItem icon={<CertificateRegular />} label="Summary" active={licView === 'summary'} onClick={() => setLicView('summary')} collapsed={!panelOpen} />
            <NavItem icon={<DatabaseRegular />} label="Capacity & Billing" active={licView === 'capacity'} onClick={() => setLicView('capacity')} collapsed={!panelOpen} />
            {panelOpen && <Caption1 style={{ padding: '12px 12px 4px 12px', color: MUTED, display: 'block', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Products</Caption1>}
            <NavItem icon={<PowerAppsIcon fontSize={20} />} label="Power Apps" active={licView === 'power-apps'} onClick={() => setLicView('power-apps')} collapsed={!panelOpen} />
            <NavItem icon={<PowerAutomateIcon fontSize={20} />} label="Power Automate" active={licView === 'power-automate'} onClick={() => setLicView('power-automate')} collapsed={!panelOpen} />
            <NavItem icon={<CopilotStudioIcon fontSize={20} />} label="Copilot Studio" active={licView === 'copilot-studio'} onClick={() => setLicView('copilot-studio')} collapsed={!panelOpen} />
          </NavPanel>
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
