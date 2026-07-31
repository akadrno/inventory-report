import { useMemo } from 'react'
import { makeStyles, tokens, Text, Caption1, Spinner, Badge } from '@fluentui/react-components'
import { MoneyRegular, LockClosedRegular, InfoRegular } from '@fluentui/react-icons'
import { useBillingPolicies } from '../hooks/useGovernance'
import type { BillingPolicy } from '../hooks/useGovernance'
import { SectionCard } from './usageShared'

function shortBillingTarget(policy: BillingPolicy): string {
  const instrument = policy.billingInstrument
  if (!instrument) return '—'
  return instrument.resourceGroup
    ? `${instrument.subscriptionId} / ${instrument.resourceGroup}`
    : instrument.subscriptionId || instrument.id || '—'
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
    borderRadius: '8px',
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

export function BillingPoliciesView() {
  const classes = useClasses()
  const billing = useBillingPolicies()
  const policies = useMemo(() => billing.data ?? [], [billing.data])

  if (billing.isLoading) {
    return <div style={{ padding: '24px' }}><Spinner size="small" label="Loading billing policies…" /></div>
  }

  if (billing.isError) {
    return (
      <div className={classes.permNotice}>
        <LockClosedRegular fontSize={16} />
        <span>Couldn't read pay-as-you-go billing policies. Power Platform administrator permissions are required.</span>
      </div>
    )
  }

  return (
    <div className={classes.root}>
      <div className={classes.note}>
        <InfoRegular fontSize={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Pay-as-you-go billing policies are read live from the Power Platform API. Actual <strong>cost in dollars</strong> lives in Azure Cost Management and isn't shown here.
        </span>
      </div>

      <SectionCard
        title="Pay-as-you-go billing policies"
        icon={<MoneyRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />}
        action={<Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{policies.length} polic{policies.length === 1 ? 'y' : 'ies'}</Caption1>}
      >
        {policies.length === 0 ? (
          <div className={classes.empty}>No pay-as-you-go billing policies configured.</div>
        ) : (
          <div className={classes.tableWrap}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Policy</th>
                  <th className={classes.th}>Status</th>
                  <th className={classes.th}>Azure subscription / resource group</th>
                  <th className={classes.th}>Location</th>
                  <th className={classes.thR}>Environments</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy, index) => {
                  const environmentCount = policy.environmentIds.length
                  return (
                    <tr key={policy.id || policy.name || index}>
                      <td className={classes.td}>
                        <Text style={{ fontSize: '13px', fontWeight: 600 }}>{policy.name || policy.id || 'Billing policy'}</Text>
                      </td>
                      <td className={classes.td}>
                        <Badge appearance="tint" color={policy.status === 'Enabled' ? 'success' : 'subtle'} size="small">
                          {policy.status}
                        </Badge>
                      </td>
                      <td className={classes.tdMuted} title={shortBillingTarget(policy)}>{shortBillingTarget(policy)}</td>
                      <td className={classes.td}>{policy.location || '—'}</td>
                      <td className={classes.tdR}>{environmentCount.toLocaleString()}</td>
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