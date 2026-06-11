import { useMemo } from 'react'
import { makeStyles, tokens, Text, Caption1, Spinner, Badge } from '@fluentui/react-components'
import {
  DatabaseRegular, DocumentRegular, HistoryRegular, AddCircleRegular,
  MoneyRegular, LockClosedRegular, InfoRegular,
} from '@fluentui/react-icons'
import { useEnvironmentCapacity, useBillingPolicies } from '../hooks/useGovernance'
import type { EnvironmentCapacity, BillingPolicy } from '../hooks/useGovernance'
import { KpiRow, KpiCard, SectionCard, BarList, Grid2 } from './usageShared'

type CapType = 'Database' | 'File' | 'Log'

const CAP_META: Record<CapType, { label: string; accent: string; icon: React.ReactNode }> = {
  Database: { label: 'Database', accent: '#4aa8ff', icon: <DatabaseRegular fontSize={16} /> },
  File: { label: 'File', accent: '#b07cff', icon: <DocumentRegular fontSize={16} /> },
  Log: { label: 'Log', accent: '#3ad1c4', icon: <HistoryRegular fontSize={16} /> },
}

// Power Platform capacity consumption is reported in MB.
function fmtStorage(mb: number): string {
  if (!isFinite(mb) || mb <= 0) return '0 MB'
  if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(2)} TB`
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

function shortBillingTarget(p: BillingPolicy): string {
  const rid = p.properties?.billingInstrument?.resourceId ?? ''
  const sub = /\/subscriptions\/([0-9a-f-]+)/i.exec(rid)?.[1]
  if (sub) return `Azure subscription ${sub}`
  return rid || '—'
}

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '14px' },
  note: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px', padding: '10px 14px',
    fontSize: '12px', color: tokens.colorNeutralForeground3,
  },
  permNotice: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '14px 16px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '10px',
    color: tokens.colorNeutralForeground3, fontSize: '13px',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px',
    color: tokens.colorNeutralForeground1, backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
  },
  thR: {
    padding: '8px 16px', textAlign: 'right', fontWeight: 600, fontSize: '12px',
    color: tokens.colorNeutralForeground1, backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 16px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tdR: {
    padding: '10px 16px', textAlign: 'right', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  },
  tdMuted: {
    padding: '10px 16px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    color: tokens.colorNeutralForeground3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontFamily: 'Consolas, monospace', fontSize: '12px',
  },
  tableWrap: { overflowX: 'auto' },
  empty: { padding: '20px', textAlign: 'center', color: tokens.colorNeutralForeground3, fontSize: '13px' },
})

function capOf(env: EnvironmentCapacity, type: CapType): number {
  return env.capacity.find(c => c.capacityType === type)?.ratedConsumption ?? 0
}

export function CapacityBillingView() {
  const classes = useClasses()
  const capacity = useEnvironmentCapacity()
  const billing = useBillingPolicies()

  const envs = useMemo(() => capacity.data ?? [], [capacity.data])

  const totals = useMemo(() => {
    const t: Record<CapType, number> = { Database: 0, File: 0, Log: 0 }
    for (const e of envs) {
      for (const c of e.capacity) {
        if (c.capacityType in t) t[c.capacityType as CapType] += c.ratedConsumption || 0
      }
    }
    return t
  }, [envs])

  const grandTotal = totals.Database + totals.File + totals.Log

  const envRows = useMemo(() => {
    return envs
      .map(e => ({
        env: e,
        db: capOf(e, 'Database'),
        file: capOf(e, 'File'),
        log: capOf(e, 'Log'),
      }))
      .map(r => ({ ...r, total: r.db + r.file + r.log }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 30)
  }, [envs])

  const addons = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of envs) {
      for (const a of e.addons ?? []) {
        if (!a.addonType || !a.quantity) continue
        m.set(a.addonType, (m.get(a.addonType) ?? 0) + a.quantity)
      }
    }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [envs])

  const policies = useMemo(() => billing.data ?? [], [billing.data])

  // Both endpoints share the Power Platform admin scope; a 403 on capacity is the
  // clearest "not a Power Platform admin" signal.
  if (capacity.isLoading) {
    return <div style={{ padding: '24px' }}><Spinner size="small" label="Loading capacity & billing…" /></div>
  }
  if (capacity.isError) {
    return (
      <div className={classes.permNotice}>
        <LockClosedRegular fontSize={16} />
        <span>Requires Power Platform admin permissions to read environment capacity and billing policies.</span>
      </div>
    )
  }

  return (
    <div className={classes.root}>
      <div className={classes.note}>
        <InfoRegular fontSize={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Storage consumption and add-on entitlements per environment, plus pay-as-you-go billing policies — read live from the
          Power Platform admin API. Actual <strong>cost in dollars</strong> (metered PAYG charges) lives in Azure Cost Management and isn't shown here.
        </span>
      </div>

      {/* Tenant capacity summary */}
      <KpiRow>
        <KpiCard accent={CAP_META.Database.accent} label="Database" value={fmtStorage(totals.Database)} sub="Rated consumption" />
        <KpiCard accent={CAP_META.File.accent} label="File" value={fmtStorage(totals.File)} sub="Rated consumption" />
        <KpiCard accent={CAP_META.Log.accent} label="Log" value={fmtStorage(totals.Log)} sub="Rated consumption" />
        <KpiCard label="Total storage" value={fmtStorage(grandTotal)} sub={`Across ${envs.length.toLocaleString()} environments`} />
      </KpiRow>

      <Grid2>
        {/* Storage by environment */}
        <SectionCard title="Storage by environment" icon={<DatabaseRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
          action={<Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{Math.min(30, envs.length)} of {envs.length.toLocaleString()} · top consumers</Caption1>}
        >
          {envRows.length === 0 ? (
            <div className={classes.empty}>No environment capacity reported.</div>
          ) : (
            <div className={classes.tableWrap}>
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th className={classes.th}>Environment</th>
                    <th className={classes.thR}>Database</th>
                    <th className={classes.thR}>File</th>
                    <th className={classes.thR}>Log</th>
                    <th className={classes.thR}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {envRows.map(r => (
                    <tr key={r.env.id || r.env.name}>
                      <td className={classes.td}>
                        <Text style={{ fontSize: '13px', fontWeight: 600 }}>{r.env.displayName || r.env.name}</Text>
                        {r.env.environmentType && (
                          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>{r.env.environmentType}</Caption1>
                        )}
                      </td>
                      <td className={classes.tdR}>{fmtStorage(r.db)}</td>
                      <td className={classes.tdR}>{fmtStorage(r.file)}</td>
                      <td className={classes.tdR}>{fmtStorage(r.log)}</td>
                      <td className={classes.tdR} style={{ fontWeight: 600 }}>{fmtStorage(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Add-ons */}
        <SectionCard title="Add-on capacity" icon={<AddCircleRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}>
          <BarList
            items={addons}
            accent="#b07cff"
            emptyText="No add-on capacity (e.g. AI Builder credits, message packs) reported."
          />
          {addons.length > 0 && (
            <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: '8px' }}>
              Add-on quantities provisioned across environments (e.g. AI Builder credits, Copilot Studio message packs).
            </Caption1>
          )}
        </SectionCard>
      </Grid2>

      {/* Pay-as-you-go billing policies */}
      <SectionCard
        title="Pay-as-you-go billing policies"
        icon={<MoneyRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        action={billing.isError
          ? <Caption1 style={{ color: tokens.colorStatusWarningForeground1 }}>Couldn't load</Caption1>
          : <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{policies.length} polic{policies.length === 1 ? 'y' : 'ies'}</Caption1>}
      >
        {billing.isLoading ? (
          <div style={{ padding: '12px' }}><Spinner size="extra-small" label="Loading billing policies…" /></div>
        ) : billing.isError ? (
          <div className={classes.empty}>Couldn't read billing policies (requires Power Platform admin permissions).</div>
        ) : policies.length === 0 ? (
          <div className={classes.empty}>No pay-as-you-go billing policies configured. Resources are billed via purchased licenses/capacity only.</div>
        ) : (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Policy</th>
                  <th className={classes.th}>Status</th>
                  <th className={classes.th}>Billed to</th>
                  <th className={classes.thR}>Environments</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p, i) => {
                  const state = p.properties?.provisioningState
                  const envCount = p.properties?.environments?.length ?? 0
                  return (
                    <tr key={p.id || p.name || i}>
                      <td className={classes.td}>
                        <Text style={{ fontSize: '13px', fontWeight: 600 }}>{p.name || p.id || 'Billing policy'}</Text>
                      </td>
                      <td className={classes.td}>
                        <Badge appearance="tint" color={state === 'Succeeded' ? 'success' : state ? 'warning' : 'subtle'} size="small">
                          {state || 'Unknown'}
                        </Badge>
                      </td>
                      <td className={classes.tdMuted} title={p.properties?.billingInstrument?.resourceId}>{shortBillingTarget(p)}</td>
                      <td className={classes.tdR}>{envCount.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
