import { useMemo, useState } from 'react'
import { makeStyles, tokens, Text, Caption1 } from '@fluentui/react-components'
import {
  PulseRegular, GlobeRegular, PeopleRegular, PersonRegular,
  DatabaseRegular, AppsListRegular, InfoRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getDisplayName, getResourceCategory, getOwnerFromProperties } from '../types'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { ResourceDetailPanel } from './ResourceDetailPanel'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'
import { buildEnvMap, resolveEnvironmentName } from '../utils/environment'
import { formatLocalDateTime } from '../utils/format'
import { useSignInCache } from '../context/SignInCacheContext'
import {
  type Category, PRODUCT,
  inventoryHealth, creationTrend, byRecentActivity, getActivityDate, daysSince,
  subtypeBreakdown, topOwners, topEnvironments,
  signInsForCategory, signInStats, dailyTrend, countBy,
  KpiRow, KpiCard, SectionCard, BarList, SegmentBar, TrendBars, Grid2,
} from './usageShared'

interface UsageDetailProps {
  category: Category
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  ownerNames: Map<string, string>
}

const PRODUCT_ICON: Record<Category, React.ReactNode> = {
  apps: <PowerAppsIcon fontSize={22} />,
  flows: <PowerAutomateIcon fontSize={22} />,
  agents: <CopilotStudioIcon fontSize={22} />,
}

// Subtype segment palette derived from the product accent + neutral support tones.
const SEG_COLORS = ['#4aa8ff', '#b07cff', '#3ad1c4', '#e6a23c', '#8a8886']

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '14px' },
  banner: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 18px', borderRadius: '12px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  bannerIcon: { width: '44px', height: '44px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bannerTitle: { fontSize: '18px', fontWeight: 700, color: tokens.colorNeutralForeground1 },
  bannerSub: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  note: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px', padding: '10px 14px',
    fontSize: '12px', color: tokens.colorNeutralForeground3,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px',
    color: tokens.colorNeutralForeground1, backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 16px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tdMuted: {
    padding: '10px 16px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    verticalAlign: 'middle', color: tokens.colorNeutralForeground3,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  row: { cursor: 'pointer', ':hover td': { backgroundColor: tokens.colorSubtleBackgroundHover } },
  tableWrap: { overflowX: 'auto' },
})

function resolveOwnerName(r: ResourceItem, ownerNames: Map<string, string>): string {
  const raw = getOwnerFromProperties(r)
  if (raw === '—') return raw
  if (raw.startsWith(SYSTEM_PREFIX)) return 'System'
  if (GUID_RE.test(raw)) return ownerNames.get(raw) ?? raw
  return raw
}

export function UsageDetailView({ category, allResources, allEnvironments, ownerNames }: UsageDetailProps) {
  const classes = useClasses()
  const meta = PRODUCT[category]
  const cache = useSignInCache()
  const [selected, setSelected] = useState<ResourceItem | null>(null)

  const envMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])
  const ofCat = useMemo(() => allResources.filter(r => getResourceCategory(r.type) === category), [allResources, category])

  const health = useMemo(() => inventoryHealth(ofCat), [ofCat])
  const breakdown = useMemo(() => subtypeBreakdown(ofCat, category), [ofCat, category])
  const owners = useMemo(() => topOwners(ofCat, r => resolveOwnerName(r, ownerNames)), [ofCat, ownerNames])
  const envs = useMemo(() => topEnvironments(ofCat, r => resolveEnvironmentName(r, envMap)), [ofCat, envMap])
  const createdTrend = useMemo(() => creationTrend(ofCat, 28), [ofCat])
  const recent = useMemo(() => byRecentActivity(ofCat).slice(0, 20), [ofCat])

  const catRecords = useMemo(() => signInsForCategory(cache.records, category), [cache.records, category])
  const stats = useMemo(() => signInStats(catRecords), [catRecords])
  const signInTrend = useMemo(() => dailyTrend(catRecords, 30), [catRecords])
  const topCountries = useMemo(() => countBy(catRecords, r => r.location?.countryOrRegion, 6, 'Unknown'), [catRecords])
  const topUsers = useMemo(() => countBy(catRecords, r => r.userDisplayName || r.userPrincipalName, 6, 'Unknown'), [catRecords])
  const hasTelemetry = cache.configured && catRecords.length > 0

  const segments = breakdown.map((b, i) => ({ label: b.label, value: b.value, color: SEG_COLORS[i % SEG_COLORS.length] }))

  return (
    <div className={classes.root}>
      <div className={classes.banner}>
        <span className={classes.bannerIcon} style={{ color: meta.accent, background: `${meta.accent}22`, border: `1px solid ${meta.accent}55` }}>
          {PRODUCT_ICON[category]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text className={classes.bannerTitle}>{meta.label}</Text>
          <Caption1 className={classes.bannerSub} style={{ display: 'block' }}>
            {ofCat.length.toLocaleString()} in inventory
            {hasTelemetry && ` · ${stats.total.toLocaleString()} sign-ins and ${stats.uniqueUsers.toLocaleString()} active users in the last 30 days`}
          </Caption1>
        </div>
      </div>

      <KpiRow>
        <KpiCard accent={meta.accent} label={`Total ${meta.label}`} value={health.total.toLocaleString()} />
        <KpiCard accent="#5bb26b" label="Active (30d)" value={health.active30.toLocaleString()} sub="Changed recently" />
        <KpiCard accent="#e6a23c" label="Stale (90d+)" value={health.stale90.toLocaleString()} sub="No recent change" />
        <KpiCard accent="#e0626d" label="Ownerless" value={health.ownerless.toLocaleString()} sub="No owner on record" />
        {hasTelemetry && <KpiCard accent="#4aa8ff" label="Sign-ins (30d)" value={stats.total.toLocaleString()} sub="Sessions" />}
        {hasTelemetry && <KpiCard accent="#3ad1c4" label="Active users (30d)" value={stats.uniqueUsers.toLocaleString()} sub="Distinct users" />}
      </KpiRow>

      <Grid2>
        <SectionCard title="Activity" icon={<PulseRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '6px' }}>Created (last 28 days)</Caption1>
          <TrendBars values={createdTrend.buckets} labels={createdTrend.labels} accent={meta.accent} height={110} yLabel="Resources created" />
          {hasTelemetry && (
            <>
              <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', margin: '14px 0 6px' }}>Sign-ins (last 30 days)</Caption1>
              <TrendBars values={signInTrend.buckets} labels={signInTrend.labels} accent={tokens.colorBrandBackground} height={110} yLabel="Sign-ins" />
            </>
          )}
        </SectionCard>

        <SectionCard title="Breakdown by type" icon={<AppsListRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}>
          <SegmentBar segments={segments} />
        </SectionCard>
      </Grid2>

      {hasTelemetry ? (
        <Grid2>
          <SectionCard title="Where it's used" icon={<GlobeRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}>
            <BarList items={topCountries} accent="#b07cff" emptyText="No location data in sign-in logs" />
          </SectionCard>
          <SectionCard title="Most active users" icon={<PeopleRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}>
            <BarList items={topUsers} accent="#4aa8ff" valueSuffix=" sign-ins" emptyText="No user data in sign-in logs" />
          </SectionCard>
        </Grid2>
      ) : (
        <div className={classes.note}>
          <InfoRegular fontSize={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Per-user and location usage for {meta.label.toLowerCase()} comes from cached Entra sign-in logs.
            {cache.configured
              ? ' No sign-ins are attributed to this product yet — open Usage → Heatmap and run an update.'
              : ' Configure Azure Storage caching to enable it.'}
          </span>
        </div>
      )}

      <Grid2>
        <SectionCard title="Top owners" icon={<PersonRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}>
          <BarList items={owners} accent={meta.accent} valueSuffix={` ${meta.label.toLowerCase()}`} emptyText="No owner data" />
        </SectionCard>
        <SectionCard title="Top environments" icon={<DatabaseRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}>
          <BarList items={envs} accent={meta.accent} emptyText="No environment data" />
        </SectionCard>
      </Grid2>

      <SectionCard title="Resources" icon={PRODUCT_ICON[category]} action={
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{Math.min(20, ofCat.length)} of {ofCat.length.toLocaleString()} · most recent</Caption1>
      }>
        {recent.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: tokens.colorNeutralForeground3 }}>No {meta.label.toLowerCase()} found</div>
        ) : (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Name</th>
                  <th className={classes.th}>Type</th>
                  <th className={classes.th}>Owner</th>
                  <th className={classes.th}>Last activity</th>
                  <th className={classes.th}>Environment</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => {
                  const act = getActivityDate(r)
                  const n = daysSince(act)
                  return (
                    <tr key={r.id} className={classes.row} onClick={() => setSelected(r)}>
                      <td className={classes.td}><Text style={{ fontSize: '13px', fontWeight: 600 }}>{getDisplayName(r)}</Text></td>
                      <td className={classes.td}><ResourceTypeBadge type={r.type} kind={r.kind} /></td>
                      <td className={classes.tdMuted}>{resolveOwnerName(r, ownerNames)}</td>
                      <td className={classes.tdMuted} title={act ? formatLocalDateTime(act.toISOString()) : ''}>
                        {act ? (n === 0 ? 'Today' : `${n}d ago`) : '—'}
                      </td>
                      <td className={classes.tdMuted}>{resolveEnvironmentName(r, envMap)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: '8px' }}>
          Select a resource to see configuration and who it's shared with.
        </Caption1>
      </SectionCard>

      {selected && (
        <ResourceDetailPanel resource={selected} onClose={() => setSelected(null)} allEnvironments={allEnvironments} />
      )}
    </div>
  )
}
