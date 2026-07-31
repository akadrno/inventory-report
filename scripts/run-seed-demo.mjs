#!/usr/bin/env node
/**
 * Seeds demo Risk Assessment data into Azure Table Storage.
 * Reads real resource IDs from the Power Platform API and uses
 * Display Names of Power Platform Admins (Entra role) as reviewers.
 *
 * Prerequisites: az CLI logged in as a Power Platform Administrator.
 * Usage: node scripts/run-seed-demo.mjs
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Config ────────────────────────────────────────────────────────────────────

function parseEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8').split('\n')
        .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
    )
  } catch { return {} }
}

const env = { ...parseEnvFile(join(ROOT, '.env')), ...parseEnvFile(join(ROOT, '.env.local')) }
const STORAGE_ACCOUNT = env.VITE_STORAGE_ACCOUNT
const TABLE_SAS       = env.VITE_TABLE_SAS
const TENANT_ID       = env.VITE_TENANT_ID
const TABLE           = 'assessments'
const PARTITION_KEY   = 'ppac'

if (!STORAGE_ACCOUNT || !TABLE_SAS) {
  console.error('Missing VITE_STORAGE_ACCOUNT or VITE_TABLE_SAS in .env.local')
  process.exit(1)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function getAzToken(resource) {
  try {
    return execSync(
      `az account get-access-token --resource "${resource}" --tenant "${TENANT_ID}" --query accessToken -o tsv`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()
  } catch (e) {
    throw new Error(`Token acquisition failed for ${resource}.\nRun "az login" first.\n${e.message}`)
  }
}

// ── Power Platform API ────────────────────────────────────────────────────────

const PP_URL = 'https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01'

const RESOURCE_CLAUSES = [{
  $type: 'where',
  FieldName: 'type',
  Operator: 'in~',
  Values: [
    "'microsoft.powerapps/canvasapps'",
    "'microsoft.powerapps/modeldrivenapps'",
    "'microsoft.powerapps/codeapps'",
    "'microsoft.powerautomate/cloudflows'",
    "'microsoft.powerautomate/agentflows'",
    "'microsoft.copilotstudio/agents'",
    "'microsoft.powerapps/apps'",
    "'microsoft.flow/flows'",
    "'microsoft.powerva/bots'",
    "'microsoft.powervirtualagents/bots'",
  ],
}]

async function fetchAllResources(token) {
  const all = []
  let skipToken

  do {
    const body = {
      TableName: 'PowerPlatformResources',
      Clauses: RESOURCE_CLAUSES,
      Options: { Top: 500, ...(skipToken ? { SkipToken: skipToken } : { Skip: 0 }) },
    }

    const res = await fetch(PP_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Power Platform API ${res.status}: ${(await res.text()).slice(0, 400)}`)

    const data = await res.json()
    all.push(...(data.data ?? []))
    skipToken = data.resultTruncated === 0 ? data.skipToken : undefined
    if (skipToken) process.stdout.write(`  ${all.length} loaded, fetching more...\r`)
  } while (skipToken)

  return all
}

// ── Microsoft Graph ───────────────────────────────────────────────────────────

const PP_ADMIN_TEMPLATE = '11648597-926c-4cf3-9c36-bcebb0ba8dcc'

async function fetchPowerPlatformAdmins(token) {
  const headers = { Authorization: `Bearer ${token}` }

  // Find the activated role object by template ID
  let roleId
  const roleRes = await fetch(
    `https://graph.microsoft.com/v1.0/directoryRoles?$filter=roleTemplateId eq '${PP_ADMIN_TEMPLATE}'`,
    { headers }
  )
  if (roleRes.ok) {
    const data = await roleRes.json()
    roleId = data.value?.[0]?.id
  }

  // Fallback: search by display name
  if (!roleId) {
    const byName = await fetch(
      `https://graph.microsoft.com/v1.0/directoryRoles?$filter=displayName eq 'Power Platform Administrator'`,
      { headers }
    )
    if (byName.ok) roleId = (await byName.json()).value?.[0]?.id
  }

  if (!roleId) {
    console.warn('  ⚠ Power Platform Administrator role not found — falling back to "Power Platform Admin"')
    return ['Power Platform Admin']
  }

  const membersRes = await fetch(
    `https://graph.microsoft.com/v1.0/directoryRoles/${roleId}/members?$select=displayName`,
    { headers }
  )
  if (!membersRes.ok) {
    console.warn(`  ⚠ Could not fetch role members (${membersRes.status})`)
    return ['Power Platform Admin']
  }

  const names = ((await membersRes.json()).value ?? [])
    .filter(m => m.displayName)
    .map(m => m.displayName)

  return names.length > 0 ? names : ['Power Platform Admin']
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const CRITICAL = [
  { riskNotes: 'Canvas app connects to external REST endpoints without a documented connector-governance review. Immediate remediation required.', notes: 'App owner and environment admin notified. Flagged for security review.' },
  { riskNotes: 'Automated flow running unattended using shared service account credentials. Owner departed 8+ months ago with no succession plan recorded.', notes: 'Flow disabled pending ownership reassignment. Escalated to IT security.' },
  { riskNotes: 'Copilot Studio agent published organisation-wide with no usage policy, no content moderation, and no data retention controls configured.', notes: 'Public access suspended. Compliance team review required before re-enabling.' },
]
const HIGH = [
  { riskNotes: 'App shared with all users in the tenant — oversharing risk. No data classification applied to underlying SharePoint data sources.', notes: 'Access scope under review. Restriction to named security groups pending classification.' },
  { riskNotes: 'Flow uses third-party connectors without a documented Advanced Connector Policy review. Potential data exfiltration risk requires validation.', notes: 'Connector-governance review in progress. Business justification requested from owner.' },
  { riskNotes: 'No active owner on record. Last modified over 14 months ago — no governance review completed.', notes: 'Ownership confirmation sent. Decommission scheduled if no response within 30 days.' },
  { riskNotes: 'Multiple users hold CanEdit access with no change control enforced. Version history shows modifications from unintended contributors.', notes: 'Excess editors removed. CoE change request process to be enforced.' },
  { riskNotes: 'App accesses confidential SharePoint document libraries. Role-based access not aligned with data sensitivity classification.', notes: 'Joint review with document library owner in progress.' },
]
const MEDIUM = [
  { riskNotes: 'App not accessed in 90+ days. No documented business owner or active use case on record.', notes: 'Owner contacted. Confirm active status before next quarterly review.' },
  { riskNotes: 'Flow has no documented purpose or business owner. Scheduled trigger with no error handling or failure notification.', notes: 'Documentation backlog. Review in upcoming governance cycle.' },
  { riskNotes: 'Resource not in a managed environment — missing advanced lifecycle and usage governance controls.', notes: 'Migration to managed environment planned for next quarter.' },
  { riskNotes: 'App description and metadata incomplete — no user group, data sensitivity label, or business function indicated.', notes: 'Owner asked to complete metadata. Deadline: end of current month.' },
  { riskNotes: 'Shared with a broad Microsoft 365 group. Membership not reviewed for appropriateness relative to data accessed.', notes: 'Membership audit added to quarterly governance checklist.' },
  { riskNotes: 'Agent has no escalation path for unresolved conversations. No human handoff topic configured.', notes: 'Escalation design review scheduled with business owner.' },
  { riskNotes: 'Flow writes to a SharePoint list with no approval step, audit trail, or downstream notification.', notes: 'Added to governance review queue.' },
  { riskNotes: 'App integrates with external REST API — no SLA, uptime monitoring, or failure alerting in place.', notes: 'No incidents to date. Alerting to be added.' },
]
const LOW = [
  { riskNotes: 'App description missing — reduces discoverability and self-service documentation.', notes: 'Reminder sent to owner.' },
  { riskNotes: 'Flow not triggered in the last 30 days. Verify continued active use.', notes: 'Monitoring. May reflect seasonal usage.' },
  { riskNotes: 'Not in a managed environment — migration would improve lifecycle management, telemetry, and governance visibility.', notes: '' },
  { riskNotes: 'App metadata incomplete — missing icon and category for app catalogue.', notes: '' },
  { riskNotes: 'No run history in last 14 days. May be periodic — verify with owner.', notes: '' },
  { riskNotes: 'Display name does not clearly indicate business function.', notes: 'Rename recommended at next update.' },
  { riskNotes: 'Flow has no error notification or retry policy. Silent failures possible.', notes: 'Low priority — no incidents reported.' },
  { riskNotes: 'Agent topic coverage limited. Known support scenarios not fully reflected.', notes: 'Expansion on roadmap.' },
]

const COMPLIANCE_BY_RISK = {
  Critical: ['Non-Compliant'],
  High:     ['Non-Compliant', 'Non-Compliant', 'In Review'],
  Medium:   ['In Review', 'In Review', 'Not Reviewed'],
  Low:      ['Compliant', 'Compliant', 'Not Reviewed'],
  None:     ['Compliant'],
}

const SYSTEM_PREFIX = '00000000-0000-0000'

function isSystem(r) {
  return [
    r.properties?.owner,
    r.properties?.createdBy?.userId,
    r.properties?.createdByUser?.userId,
    r.properties?.author,
  ].filter(Boolean).some(v => String(v).startsWith(SYSTEM_PREFIX))
}

function isAgent(r) {
  const t = (r.type ?? '').toLowerCase()
  return t.includes('bot') || t.includes('agent') || t.includes('copilotstudio')
}

const AGENT_LOW_NOTES = [
  { riskNotes: 'Agent topic coverage limited. Known support scenarios not fully reflected in current topic structure.', notes: 'Expansion planned per product roadmap.' },
  { riskNotes: 'Agent has no escalation path configured. End users may reach dead ends for unsupported queries.', notes: 'Review escalation design with business owner.' },
  { riskNotes: 'Agent description and metadata incomplete. Purpose and target audience not documented.', notes: 'Owner asked to update agent metadata.' },
  { riskNotes: 'Agent not in a managed environment — missing advanced lifecycle and usage governance controls.', notes: 'Migration to managed environment recommended.' },
  { riskNotes: 'Agent not modified in over 60 days with no documented review. May not reflect current business requirements.', notes: 'Schedule periodic review with bot owner.' },
]

function sr(seed) { const x = Math.sin(seed + 1) * 10000; return x - Math.floor(x) }

function shuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(sr(i * 7919) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildAssessments(resources, admins) {
  const pool = shuffle(resources.filter(r => !isSystem(r)))
  if (!pool.length) return []

  const UNASSESSED = 30
  const toAssess = pool.slice(0, pool.length - UNASSESSED)

  const n = toAssess.length
  // All assessed resources get a real risk level — no 'None'
  const nC = Math.min(10, n)
  const nH = Math.min(30, Math.max(0, n - nC))
  const nM = Math.min(50, Math.max(0, n - nC - nH))
  // Everything remaining is Low
  const ALL_LOW = [...LOW, ...AGENT_LOW_NOTES]

  const pick = (arr, i) => arr[i % arr.length]
  const slots = []
  for (let i = 0; i < nC; i++) slots.push({ risk: 'Critical', note: pick(CRITICAL, i) })
  for (let i = 0; i < nH; i++) slots.push({ risk: 'High',     note: pick(HIGH, i) })
  for (let i = 0; i < nM; i++) slots.push({ risk: 'Medium',   note: pick(MEDIUM, i) })
  while (slots.length < n)     slots.push({ risk: 'Low',      note: pick(ALL_LOW, slots.length) })

  const shuffled = shuffle(slots)

  const now = Date.now()

  return toAssess.map((r, idx) => {
    const { risk, note } = shuffled[idx]
    const opts = COMPLIANCE_BY_RISK[risk]
    return {
      PartitionKey: PARTITION_KEY,
      RowKey: encodeRowKey(r.id),
      resourceId: r.id,
      riskLevel: risk,
      complianceStatus: opts[Math.floor(sr(idx * 1013) * opts.length)],
      riskNotes: note.riskNotes,
      notes: note.notes,
      lastUpdated: new Date(now - Math.floor(sr(idx * 2053) * 90) * 86_400_000).toISOString(),
      updatedBy: admins[Math.floor(sr(idx * 3571) * admins.length)],
    }
  })
}

// ── Table Storage ─────────────────────────────────────────────────────────────

function encodeRowKey(id) {
  return Buffer.from(id, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function entityUrl(rowKey) {
  return `https://${STORAGE_ACCOUNT}.table.core.windows.net/${TABLE}` +
    `(PartitionKey='${encodeURIComponent(PARTITION_KEY)}',RowKey='${encodeURIComponent(rowKey)}')?${TABLE_SAS}`
}

async function upsert(entity) {
  const res = await fetch(entityUrl(entity.RowKey), {
    method: 'PUT',
    headers: {
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json',
      'x-ms-version': '2019-02-02',
    },
    body: JSON.stringify(entity),
  })
  if (!res.ok) throw new Error(`Table PUT ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

async function uploadAll(entities) {
  const BATCH = 20
  for (let i = 0; i < entities.length; i += BATCH) {
    await Promise.all(entities.slice(i, i + BATCH).map(upsert))
    process.stdout.write(`  ${Math.min(i + BATCH, entities.length)} / ${entities.length} uploaded\r`)
  }
  process.stdout.write('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  PPAC Demo Data Seeder\n')

  console.log('1/4  Getting Azure tokens...')
  const ppToken    = getAzToken('https://api.powerplatform.com/')
  const graphToken = getAzToken('https://graph.microsoft.com/')
  console.log('     ✓ Tokens acquired')

  console.log('\n2/4  Fetching Power Platform resources...')
  const resources = await fetchAllResources(ppToken)
  console.log(`     ✓ ${resources.length} resources loaded`)

  console.log('\n3/4  Fetching Power Platform Administrator role members...')
  const admins = await fetchPowerPlatformAdmins(graphToken)
  console.log(`     ✓ Admins: ${admins.join(', ')}`)

  console.log('\n4/4  Building and uploading assessments...')
  const assessments = buildAssessments(resources, admins)
  const unassessed = resources.filter(r => {
    const SYSTEM_PREFIX = '00000000-0000-0000'
    return ![r.properties?.owner, r.properties?.createdBy?.userId].filter(Boolean)
      .some(v => String(v).startsWith(SYSTEM_PREFIX))
  }).length - assessments.length

  console.log(`     Assessing ${assessments.length} resources, leaving ~${unassessed} unassessed`)
  await uploadAll(assessments)

  const dist = assessments.reduce((acc, a) => { acc[a.riskLevel] = (acc[a.riskLevel] ?? 0) + 1; return acc }, {})
  console.log(`\n✅  Done!`)
  console.log(`    Critical: ${dist.Critical ?? 0}  High: ${dist.High ?? 0}  Medium: ${dist.Medium ?? 0}  Low: ${dist.Low ?? 0}  None: ${dist.None ?? 0}`)
  console.log(`    Reviewed by: ${admins.join(', ')}\n`)
}

main().catch(e => { console.error('\n❌ ', e.message); process.exit(1) })
