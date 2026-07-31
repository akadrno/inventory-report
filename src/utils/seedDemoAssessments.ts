import type { ResourceItem } from '../types'
import type { ResourceAssessment, RiskLevel, ComplianceStatus } from '../hooks/useAdminData'
import { isSystemResource } from '../hooks/useOwnerNames'

type NotePair = { riskNotes: string; notes: string }

const CRITICAL_NOTES: NotePair[] = [
  {
    riskNotes: 'Canvas app connects to external REST endpoints without a documented connector-governance review. Immediate remediation required.',
    notes: 'Flagged for security review. App owner and environment admin notified. Awaiting response.',
  },
  {
    riskNotes: 'Automated flow running unattended using shared service account credentials. Owner departed the organisation 8+ months ago with no succession plan recorded.',
    notes: 'Flow disabled pending ownership reassignment. Escalated to IT security.',
  },
  {
    riskNotes: 'Copilot Studio agent published organisation-wide with no usage policy, no content moderation enabled, and no data retention controls configured.',
    notes: 'Public access suspended. Compliance team review required before re-enabling.',
  },
]

const HIGH_NOTES: NotePair[] = [
  {
    riskNotes: 'App shared with all users in the tenant — oversharing risk. No data classification applied to the underlying SharePoint data sources.',
    notes: 'Scope under review. Access to be restricted to named security groups pending classification outcome.',
  },
  {
    riskNotes: 'Flow uses third-party connectors without a documented Advanced Connector Policy review. Potential data exfiltration risk requires validation.',
    notes: 'Connector-governance review in progress. Business justification requested from owner.',
  },
  {
    riskNotes: 'No active owner on record. Resource was last modified over 14 months ago and has received no governance review.',
    notes: 'Ownership confirmation notice sent. Decommission scheduled if no response within 30 days.',
  },
  {
    riskNotes: 'Multiple users hold CanEdit access with no change control in place. Version history shows modifications from unintended contributors.',
    notes: 'Excess editors removed. Change request process to be enforced via CoE approval flow.',
  },
  {
    riskNotes: 'App reads from confidential SharePoint document libraries. Role-based access not aligned with data sensitivity classification.',
    notes: 'Joint review with document library owner in progress.',
  },
]

const MEDIUM_NOTES: NotePair[] = [
  {
    riskNotes: 'App has not been accessed in 90+ days. No documented business owner or active usage case on record.',
    notes: 'Owner contacted. Status to be confirmed before next quarterly review.',
  },
  {
    riskNotes: 'Flow has no documented purpose or business owner. Scheduled trigger with no error handling or notification on failure.',
    notes: 'Documentation backlog. Review scheduled for upcoming governance cycle.',
  },
  {
    riskNotes: 'Resource not deployed in a managed environment — missing advanced lifecycle and usage governance controls.',
    notes: 'Migration to managed environment planned for next quarter.',
  },
  {
    riskNotes: 'App description and metadata are incomplete — no indicated user group, data sensitivity label, or business function.',
    notes: 'Owner asked to complete app metadata. Deadline: end of current month.',
  },
  {
    riskNotes: 'Shared with a broad Microsoft 365 group. Group membership has not been reviewed for appropriateness relative to data accessed.',
    notes: 'Membership audit added to quarterly governance checklist.',
  },
  {
    riskNotes: 'Agent has no escalation path configured for unresolved conversations. No human handoff topic present in topic structure.',
    notes: 'Escalation design review scheduled with business owner.',
  },
  {
    riskNotes: 'Flow writes to a SharePoint list with no approval step, audit trail, or notification to downstream data owners.',
    notes: 'Low priority — added to governance review queue for next cycle.',
  },
  {
    riskNotes: 'App integrates with an external REST API. No SLA defined, no uptime monitoring, and no alerting on failure.',
    notes: 'Alerting to be added. No incidents logged to date — resilience gap only.',
  },
]

const LOW_NOTES: NotePair[] = [
  {
    riskNotes: 'App description missing — reduces discoverability and self-service documentation for end users.',
    notes: 'Reminder sent to owner.',
  },
  {
    riskNotes: 'Flow has not been triggered in the last 30 days. Verify continued active use.',
    notes: 'Monitoring. May reflect seasonal usage pattern.',
  },
  {
    riskNotes: 'Resource not in a managed environment. Migration would improve lifecycle management, telemetry, and governance visibility.',
    notes: '',
  },
  {
    riskNotes: 'App metadata incomplete — missing icon and category tag for app catalogue discoverability.',
    notes: '',
  },
  {
    riskNotes: 'No run history in the last 14 days. May be periodic or event-driven usage — verify with owner.',
    notes: '',
  },
  {
    riskNotes: 'App display name does not clearly indicate business function, creating potential confusion in the catalogue.',
    notes: 'Rename recommended at next update cycle.',
  },
  {
    riskNotes: 'Flow has no error notification or retry policy. Silent failures are possible.',
    notes: 'Low priority — no incidents reported. Added to improvement backlog.',
  },
  {
    riskNotes: 'Agent topic coverage is limited. Known support scenarios not reflected in current topic structure.',
    notes: 'Expansion planned for next quarter per product roadmap.',
  },
]

const COMPLIANCE_BY_RISK: Record<RiskLevel, ComplianceStatus[]> = {
  Critical: ['Non-Compliant'],
  High:     ['Non-Compliant', 'Non-Compliant', 'In Review'],
  Medium:   ['In Review', 'In Review', 'Not Reviewed'],
  Low:      ['Compliant', 'Compliant', 'Not Reviewed'],
  None:     ['Compliant'],
}

function stableRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function stableShuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(stableRandom(i * 7919) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function generateDemoAssessments(
  allResources: ResourceItem[],
  updatedBy: string,
): ResourceAssessment[] {
  const pool = stableShuffle(allResources.filter(r => !isSystemResource(r)))
  if (pool.length === 0) return []

  const LEAVE_UNASSESSED = Math.min(40, Math.floor(pool.length * 0.3))
  const toAssess = pool.slice(0, pool.length - LEAVE_UNASSESSED)
  if (toAssess.length === 0) return []

  const n = toAssess.length
  const nCritical = Math.min(CRITICAL_NOTES.length, Math.max(2, Math.round(n * 0.03)))
  const nHigh     = Math.min(HIGH_NOTES.length,     Math.max(4, Math.round(n * 0.06)))
  const nMedium   = Math.min(MEDIUM_NOTES.length,   Math.max(6, Math.round(n * 0.12)))
  const nLow      = Math.max(8, Math.round(n * 0.20))

  type Slot = { riskLevel: RiskLevel; notePair: NotePair }
  const slots: Slot[] = []
  const pick = <T>(arr: T[], i: number) => arr[i % arr.length]

  for (let i = 0; i < nCritical; i++) slots.push({ riskLevel: 'Critical', notePair: pick(CRITICAL_NOTES, i) })
  for (let i = 0; i < nHigh; i++)     slots.push({ riskLevel: 'High',     notePair: pick(HIGH_NOTES, i) })
  for (let i = 0; i < nMedium; i++)   slots.push({ riskLevel: 'Medium',   notePair: pick(MEDIUM_NOTES, i) })
  for (let i = 0; i < nLow; i++)      slots.push({ riskLevel: 'Low',      notePair: pick(LOW_NOTES, i) })
  while (slots.length < n) {
    slots.push({ riskLevel: 'None', notePair: { riskNotes: '', notes: 'Reviewed — no risks identified at this time.' } })
  }

  const shuffledSlots = stableShuffle(slots)

  const now = Date.now()
  return toAssess.map((r, idx) => {
    const { riskLevel, notePair } = shuffledSlots[idx]
    const complianceOptions = COMPLIANCE_BY_RISK[riskLevel]
    const complianceStatus = complianceOptions[Math.floor(stableRandom(idx * 1013) * complianceOptions.length)]
    const daysAgo = Math.floor(stableRandom(idx * 2053) * 90)
    return {
      resourceId: r.id,
      riskLevel,
      complianceStatus,
      riskNotes: notePair.riskNotes,
      notes: notePair.notes,
      lastUpdated: new Date(now - daysAgo * 86_400_000).toISOString(),
      updatedBy,
    }
  })
}
