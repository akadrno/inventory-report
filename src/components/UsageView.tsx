import { useMemo } from 'react'
import { makeStyles, tokens, Text, Caption1 } from '@fluentui/react-components'
import {
  ChartMultipleRegular, GlobeRegular, PeopleRegular, ChevronRightRegular,
  PulseRegular, InfoRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getResourceCategory } from '../types'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { useSignInCache } from '../context/SignInCacheContext'
import {
  type Category, PRODUCT,
  inventoryHealth, creationTrend,
  powerPlatformSignIns, signInsForCategory, signInStats, dailyTrend, countBy,
  KpiRow, KpiCard, SectionCard, BarList, SegmentBar, TrendBars, Grid2,
} from './usageShared'

interface UsageViewProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  ownerNames: Map<string, string>
  onOpenCategory?: (c: Category) => void
  onOpenHeatmap?: () => void
}

const PRODUCT_ICON: Record<Category, React.ReactNode> = {
  apps: <PowerAppsIcon fontSize={20} />,
  flows: <PowerAutomateIcon fontSize={20} />,
  agents: <CopilotStudioIcon fontSize={20} />,
}

// Staggered cinematic entrance for the overview blocks.
const fadeUp = (delay: number): React.CSSProperties => ({ animation: 'ppFadeUp 0.5s both', animationDelay: `${delay}s` })

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '14px' },
  note: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px', padding: '10px 14px',
    fontSize: '12px', color: tokens.colorNeutralForeground3,
  },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' },
  productCard: {
    position: 'relative', overflow: 'hidden',
    minHeight: '520px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '14px', padding: '18px',
    display: 'flex',
    cursor: 'pointer', textAlign: 'left',
    boxShadow: tokens.shadow8,
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
    ':hover': {
      transform: 'translateY(-3px)',
      border: '1px solid var(--acc)',
      boxShadow: tokens.shadow28,
    },
  },
  pcGlow: {
    position: 'absolute', top: '-60px', right: '-50px',
    width: '200px', height: '200px', borderRadius: '50%',
    filter: 'blur(55px)', opacity: 0.4, pointerEvents: 'none', zIndex: 0,
  },
  pcGrid: {
    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
    backgroundImage: 'linear-gradient(rgba(127,127,127,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(127,127,127,0.06) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    maskImage: 'radial-gradient(ellipse 75% 60% at 75% 0%, #000, transparent 72%)',
    WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at 75% 0%, #000, transparent 72%)',
  },
  pcContent: {
    position: 'relative', zIndex: 1, flex: 1,
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  pcChart: { marginTop: 'auto' },
  pcHead: { display: 'flex', alignItems: 'center', gap: '8px' },
  pcIcon: { width: '34px', height: '34px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pcTitle: { fontSize: '14px', fontWeight: 600, color: tokens.colorNeutralForeground1, flex: 1 },
  pcCount: { fontSize: '30px', fontWeight: 700, lineHeight: 1, color: tokens.colorNeutralForeground1, fontVariantNumeric: 'tabular-nums' },
  pcStats: { display: 'flex', gap: '18px' },
  pcStatVal: { fontSize: '15px', fontWeight: 600, color: tokens.colorNeutralForeground1, display: 'block', fontVariantNumeric: 'tabular-nums' },
  pcStatLabel: { fontSize: '11px', color: tokens.colorNeutralForeground3 },
  linkBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    color: tokens.colorBrandForeground1, fontSize: '12px', fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: '2px', padding: 0,
  },
})

function ProductUsageCard({ category, resources, records, onOpen }: {
  category: Category
  resources: ResourceItem[]
  records: import('./usageShared').SignInRecord[]
  onOpen?: (c: Category) => void
}) {
  const classes = useClasses()
  const meta = PRODUCT[category]
  const ofCat = useMemo(() => resources.filter(r => getResourceCategory(r.type) === category), [resources, category])
  const catRecords = useMemo(() => signInsForCategory(records, category), [records, category])
  const stats = useMemo(() => signInStats(catRecords), [catRecords])
  const { buckets, labels } = useMemo(() => creationTrend(ofCat), [ofCat])
  const hasSignIns = records.length > 0

  const cardStyle = {
    '--acc': meta.accent,
    backgroundImage: `linear-gradient(160deg, ${meta.accent}1f, transparent 55%)`,
  } as React.CSSProperties

  return (
    <button className={classes.productCard} style={cardStyle} onClick={() => onOpen?.(category)}>
      <span className={classes.pcGlow} style={{ background: meta.accent }} />
      <span className={classes.pcGrid} />
      <span className={classes.pcContent}>
        <div className={classes.pcHead}>
          <span className={classes.pcIcon} style={{ color: meta.accent, background: `${meta.accent}22`, border: `1px solid ${meta.accent}55` }}>
            {PRODUCT_ICON[category]}
          </span>
          <span className={classes.pcTitle}>{meta.label}</span>
          <ChevronRightRegular fontSize={16} style={{ color: tokens.colorNeutralForeground3 }} />
        </div>
        <div>
          <span className={classes.pcCount} style={{ textShadow: `0 0 22px ${meta.accent}55` }}>{ofCat.length.toLocaleString()}</span>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>in inventory</Caption1>
        </div>
        {hasSignIns && (
          <div className={classes.pcStats}>
            <div>
              <span className={classes.pcStatVal}>{stats.total.toLocaleString()}</span>
              <span className={classes.pcStatLabel}>sign-ins (30d)</span>
            </div>
            <div>
              <span className={classes.pcStatVal}>{stats.uniqueUsers.toLocaleString()}</span>
              <span className={classes.pcStatLabel}>active users</span>
            </div>
          </div>
        )}
        <div className={classes.pcChart}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '6px' }}>{meta.label} created per day</Caption1>
          <TrendBars
            values={buckets} labels={labels} accent={meta.accent} height={300}
            yLabel="Resources created" xLabel="Date (last 28 days)"
          />
        </div>
      </span>
    </button>
  )
}

export function UsageView({ allResources, allEnvironments, ownerNames, onOpenCategory, onOpenHeatmap }: UsageViewProps) {
  const classes = useClasses()
  void allEnvironments; void ownerNames
  const cache = useSignInCache()

  const ppRecords = useMemo(() => powerPlatformSignIns(cache.records), [cache.records])
  const stats = useMemo(() => signInStats(ppRecords), [ppRecords])
  const trend = useMemo(() => dailyTrend(ppRecords, 30), [ppRecords])
  const topCountries = useMemo(() => countBy(ppRecords, r => r.location?.countryOrRegion, 6, 'Unknown'), [ppRecords])
  const topUsers = useMemo(() => countBy(ppRecords, r => r.userDisplayName || r.userPrincipalName, 6, 'Unknown'), [ppRecords])
  const health = useMemo(() => inventoryHealth(allResources), [allResources])

  const failed = ppRecords.length - ppRecords.filter(r => (r.status?.errorCode ?? 0) === 0).length
  const succeeded = ppRecords.length - failed
  const peak = Math.max(0, ...trend.buckets)

  const hasTelemetry = cache.configured && ppRecords.length > 0

  return (
    <div className={classes.root}>
      <div style={fadeUp(0)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 2px 10px' }}>
          <ChartMultipleRegular fontSize={16} style={{ color: tokens.colorNeutralForeground2 }} />
          <Text style={{ fontSize: '14px', fontWeight: 600, color: tokens.colorNeutralForeground1 }}>By product</Text>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>— select a product to drill into details</Caption1>
        </div>
        <div className={classes.productGrid}>
          {(['apps', 'flows', 'agents'] as Category[]).map(c => (
            <ProductUsageCard key={c} category={c} resources={allResources} records={ppRecords} onOpen={onOpenCategory} />
          ))}
        </div>
      </div>

      <div style={fadeUp(0.06)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 2px 10px' }}>
          <Text style={{ fontSize: '14px', fontWeight: 600, color: tokens.colorNeutralForeground1 }}>Inventory health</Text>
        </div>
        <KpiRow>
          <KpiCard label="Total resources" value={health.total.toLocaleString()} />
          <KpiCard accent="#5bb26b" label="Active (30d)" value={health.active30.toLocaleString()} sub="Changed in the last 30 days" />
          <KpiCard accent="#e6a23c" label="Stale (90d+)" value={health.stale90.toLocaleString()} sub="No change in 90+ days" />
          <KpiCard accent="#e0626d" label="Ownerless" value={health.ownerless.toLocaleString()} sub="No owner on record" />
        </KpiRow>
      </div>

      <div style={fadeUp(0.12)}>
        {hasTelemetry ? (
          <KpiRow>
            <KpiCard accent="#3ad1c4" label="Active users (30d)" value={stats.uniqueUsers.toLocaleString()} sub="Distinct Power Platform sign-ins" />
            <KpiCard accent="#4aa8ff" label="Sign-ins (30d)" value={stats.total.toLocaleString()} sub="Sessions across Apps, Flows & Agents" />
            <KpiCard accent="#b07cff" label="Countries" value={stats.countries.toLocaleString()} sub="Distinct sign-in locations" />
            <KpiCard accent={succeeded >= failed ? '#5bb26b' : '#e6a23c'} label="Success rate" value={stats.successRate != null ? `${stats.successRate}%` : '—'} sub={`${failed.toLocaleString()} failed sign-ins`} />
          </KpiRow>
        ) : (
          <div className={classes.note}>
            <InfoRegular fontSize={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {cache.configured
                ? 'No Power Platform sign-in data cached yet. Open the Usage → Heatmap and run an update to populate sign-in telemetry (who, how many, and where).'
                : 'Sign-in telemetry (active users, sessions, locations) requires Azure Storage caching to be configured. Showing inventory-derived metrics below.'}
            </span>
          </div>
        )}
      </div>

      {hasTelemetry && (
        <div style={fadeUp(0.18)}>
          <Grid2>
            <SectionCard
              title="Power Platform sign-in activity"
              icon={<PulseRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
            >
              <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '6px' }}>
                Daily sign-ins, last 30 days · peak {peak.toLocaleString()}
              </Caption1>
              <TrendBars values={trend.buckets} labels={trend.labels} accent={tokens.colorBrandBackground} height={120} yLabel="Sign-ins" />
              <div style={{ marginTop: '12px' }}>
                <SegmentBar segments={[
                  { label: 'Successful', value: succeeded, color: '#5bb26b' },
                  { label: 'Failed', value: failed, color: '#e0626d' },
                ]} />
              </div>
            </SectionCard>

            <SectionCard
              title="Where users sign in"
              icon={<GlobeRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
              action={onOpenHeatmap && <button className={classes.linkBtn} onClick={onOpenHeatmap}>View map <ChevronRightRegular fontSize={12} /></button>}
            >
              <BarList items={topCountries} accent="#b07cff" emptyText="No location data in sign-in logs" />
            </SectionCard>
          </Grid2>
        </div>
      )}

      {hasTelemetry && (
        <div style={fadeUp(0.24)}>
          <SectionCard
            title="Most active users"
            icon={<PeopleRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
          >
            <BarList items={topUsers} accent="#4aa8ff" valueSuffix=" sign-ins" emptyText="No user data in sign-in logs" />
          </SectionCard>
        </div>
      )}
    </div>
  )
}
