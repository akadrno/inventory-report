import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { requirePage } from '../lib/permissions'
import { getAppToken, SCOPES } from '../lib/tokens'
import { errorResponse, HttpError, json } from '../lib/http'

// Operation allow-list proxy for the governance read paths. Each op maps to a
// fixed upstream request + page key (no open-proxy / SSRF surface). Faithful port
// of src/api/governanceApi.ts — returns the same final shapes so the frontend
// repoint is a one-liner. None of these are record-scoped (tenant/admin config).

const PP = 'https://api.powerplatform.com'
const BAP = 'https://api.bap.microsoft.com'
const PP_V = 'api-version=2024-10-01'

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

async function ppGet(path: string): Promise<Response> {
  const token = await getAppToken(SCOPES.powerPlatform)
  return fetch(`${PP}${path}`, { headers: { Authorization: `Bearer ${token}` } })
}
async function bapGet(path: string): Promise<Response> {
  const token = await getAppToken(SCOPES.bap)
  return fetch(`${BAP}${path}`, { headers: { Authorization: `Bearer ${token}` } })
}

// ── individual operations ────────────────────────────────────────────────────

async function dlp(): Promise<unknown> {
  const res = await bapGet('/providers/Microsoft.BusinessAppPlatform/scopes/admin/apiPolicies?api-version=2016-11-01')
  if (!res.ok) throw new HttpError(res.status, `DLP fetch failed: ${res.status}`)
  const j = await res.json() as { value?: any[] }
  const raw: any[] = j.value ?? (j as any)
  return raw.map(p => ({
    ...p,
    displayName: p.displayName ?? p.properties?.displayName ?? p.name,
    environmentType: p.environmentType ?? p.properties?.environmentType,
    environments: p.environments ?? p.properties?.environments,
    connectorGroups: p.connectorGroups ?? p.properties?.connectorGroups,
  }))
}

async function tenantSettings(): Promise<unknown> {
  const token = await getAppToken(SCOPES.bap)
  const res = await fetch(`${BAP}/providers/Microsoft.BusinessAppPlatform/listTenantSettings?api-version=2021-04-01`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) throw new HttpError(res.status, `Tenant settings fetch failed: ${res.status}`)
  return res.json()
}

async function capacity(): Promise<unknown> {
  const res = await ppGet('/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2020-10-01&$expand=properties.capacity,properties.addons')
  if (!res.ok) throw new HttpError(res.status, `Environment capacity fetch failed: ${res.status}`)
  const j = await res.json() as { value?: any[] }
  return (j.value ?? []).map(e => {
    const props = e['properties'] ?? {}
    return {
      id: e['id'] ?? '', name: e['name'] ?? '', location: e['location'] ?? '',
      displayName: props['displayName'] ?? e['name'] ?? '',
      environmentType: props['environmentType'] ?? '',
      capacity: props['capacity'] ?? [], addons: props['addons'] ?? [],
    }
  })
}

async function billing(): Promise<unknown> {
  const res = await ppGet('/licensing/billingPolicies?api-version=2022-03-01-preview')
  if (!res.ok) throw new HttpError(res.status, `Billing policies fetch failed: ${res.status}`)
  const j = await res.json() as { value?: unknown[] }
  return j.value ?? []
}

async function crossTenant(signal?: AbortSignal): Promise<unknown> {
  const token = await getAppToken(SCOPES.powerPlatform)
  const auth = { Authorization: `Bearer ${token}` }
  const base = `${PP}/governance/crossTenantConnectionReports`
  const post = await fetch(`${base}?${PP_V}`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}', signal,
  })
  if (!post.ok && post.status !== 202) throw new HttpError(post.status, `Cross-tenant report request failed: ${post.status}`)
  let report = await post.json() as any
  let attempts = 0
  while (report.reportId && (report.status === 'InProgress' || report.status === 'Received') && attempts < 5) {
    await delay(3000); attempts++
    const get = await fetch(`${base}/${report.reportId}?${PP_V}`, { headers: auth, signal })
    if (!get.ok) break
    report = await get.json()
  }
  const connections: unknown[] = [...(report.connections ?? [])]
  let next = report['@odata.nextLink']; let guard = 0
  while (next && guard < 50) {
    const res = await fetch(next, { headers: auth, signal })
    if (!res.ok) break
    const page = await res.json() as any
    connections.push(...(page.connections ?? []))
    next = page['@odata.nextLink']; guard++
  }
  return { ...report, connections }
}

async function advisor(signal?: AbortSignal): Promise<unknown> {
  const token = await getAppToken(SCOPES.powerPlatform)
  const out: unknown[] = []
  let url: string | undefined = `${PP}/analytics/advisorRecommendations?${PP_V}`
  let guard = 0
  while (url && guard < 20) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal })
    if (!res.ok) throw new HttpError(res.status, `Advisor recommendations fetch failed: ${res.status}`)
    const j = await res.json() as any
    for (const r of j.value ?? []) out.push({
      scenario: r.scenario,
      resourceCount: r.details?.resourceCount,
      lastRefreshedTimestamp: r.details?.lastRefreshedTimestamp,
      expectedNextRefreshTimestamp: r.details?.expectedNextRefreshTimestamp,
    })
    url = j.nextLink; guard++
  }
  return out
}

async function advisorResources(scenario: string, signal?: AbortSignal): Promise<unknown> {
  if (!scenario) throw new HttpError(400, 'scenario is required')
  const token = await getAppToken(SCOPES.powerPlatform)
  const out: unknown[] = []
  let url: string | undefined = `${PP}/analytics/advisorRecommendations/${encodeURIComponent(scenario)}/resources?${PP_V}`
  let guard = 0
  while (url && guard < 40) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal })
    if (!res.ok) { if (guard === 0) throw new HttpError(res.status, `Recommendation resources fetch failed: ${res.status}`); break }
    const j = await res.json() as any
    out.push(...(j.value ?? []))
    url = j.nextLink; guard++
  }
  return out
}

// Per-environment connection fan-out (PowerApps admin API).
async function connections(envIds: string[], signal?: AbortSignal): Promise<unknown> {
  const token = await getAppToken(SCOPES.powerApps)
  const CAP = 60
  const targets = envIds.slice(0, CAP)
  const truncated = envIds.length > CAP
  const all: unknown[] = []
  const CONCURRENCY = 6
  const fetchEnv = async (envId: string): Promise<unknown[]> => {
    const res = await fetch(
      `https://api.powerapps.com/providers/Microsoft.PowerApps/scopes/admin/environments/${encodeURIComponent(envId)}/connections?api-version=2016-11-01`,
      { headers: { Authorization: `Bearer ${token}` }, signal },
    )
    if (res.status === 401 || res.status === 403) throw new HttpError(res.status, `${res.status}: insufficient permissions to read connections`)
    if (!res.ok) return []
    const j = await res.json() as { value?: any[] }
    return (j.value ?? []).map(c => {
      const props = c['properties'] ?? {}
      const createdBy = props['createdBy'] ?? {}
      const statuses = props['statuses'] as any[] | undefined
      return {
        id: c['name'] ?? c['id'] ?? '', displayName: props['displayName'] ?? '',
        connectorId: props['apiId'] ?? '',
        owner: { id: createdBy['id'], displayName: createdBy['displayName'], email: createdBy['email'] ?? createdBy['userPrincipalName'] },
        createdTime: props['createdTime'], environmentId: envId, status: statuses?.[0]?.['status'],
      }
    })
  }
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(fetchEnv))
    for (const r of results) all.push(...r)
  }
  return { connections: all, truncated }
}

async function ruleAssignments(groupId: string): Promise<unknown> {
  if (!groupId) throw new HttpError(400, 'groupId is required')
  const id = groupId.includes('/') ? groupId.split('/').filter(Boolean).pop()! : groupId
  const res = await ppGet(`/governance/ruleBasedPolicies/environmentGroups/${id}/assignments?api-version=2022-03-01-preview`)
  if (res.status === 404) return { assignments: [] }
  if (!res.ok) throw new HttpError(res.status, `Group rule assignments fetch failed: ${res.status}`)
  const j = await res.json() as { value?: unknown[] }
  return { assignments: j.value ?? [] }
}

async function rulePolicy(policyId: string): Promise<unknown> {
  if (!policyId) throw new HttpError(400, 'policyId is required')
  const id = policyId.includes('/') ? policyId.split('/').filter(Boolean).pop()! : policyId
  const res = await ppGet(`/governance/ruleBasedPolicies/${id}?$expand=ruleSets&api-version=2022-03-01-preview`)
  if (!res.ok) throw new HttpError(res.status, `Rule-based policy fetch failed: ${res.status}`)
  return res.json()
}

async function policyRules(policyId: string): Promise<unknown> {
  if (!policyId) throw new HttpError(400, 'policyId is required')
  const id = policyId.includes('/') ? policyId.split('/').filter(Boolean).pop()! : policyId
  const res = await ppGet(`/governance/ruleBasedPolicies/${id}/rules?api-version=2022-03-01-preview`)
  if (res.status === 404) return []
  if (!res.ok) throw new HttpError(res.status, `Policy rules fetch failed: ${res.status}`)
  const j = await res.json() as any
  return j.value ?? j.rules ?? []
}

async function allRulePolicies(): Promise<unknown> {
  const res = await ppGet('/governance/ruleBasedPolicies?$top=100&api-version=2022-03-01-preview')
  if (res.status === 404) return { policies: [] }
  if (!res.ok) throw new HttpError(res.status, `List rule-based policies failed: ${res.status}`)
  const j = await res.json() as { value?: unknown[] }
  return { policies: j.value ?? [] }
}

// Page key required for each op.
const OP_PAGE: Record<string, string> = {
  dlp: 'governance:dlp',
  'tenant-settings': 'governance:tenant-settings',
  capacity: 'governance:overview',
  billing: 'governance:overview',
  'cross-tenant': 'governance:cross-tenant',
  advisor: 'governance:recommendations',
  'advisor-resources': 'governance:recommendations',
  connections: 'governance:connections',
  'rule-assignments': 'governance:dlp',
  'rule-policy': 'governance:dlp',
  'policy-rules': 'governance:dlp',
  'all-rule-policies': 'governance:dlp',
}

async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    const op = req.params.op
    const pageKey = OP_PAGE[op]
    if (!pageKey) throw new HttpError(404, `Unknown governance operation: ${op}`)
    await requirePage(caller, pageKey)

    const q = (k: string) => req.query.get(k) ?? ''
    switch (op) {
      case 'dlp': return json(await dlp())
      case 'tenant-settings': return json(await tenantSettings())
      case 'capacity': return json(await capacity())
      case 'billing': return json(await billing())
      case 'cross-tenant': return json(await crossTenant())
      case 'advisor': return json(await advisor())
      case 'advisor-resources': return json(await advisorResources(q('scenario')))
      case 'connections': {
        const body = (await req.json().catch(() => ({}))) as { envIds?: string[] }
        return json(await connections(body.envIds ?? []))
      }
      case 'rule-assignments': return json(await ruleAssignments(q('groupId')))
      case 'rule-policy': return json(await rulePolicy(q('policyId')))
      case 'policy-rules': return json(await policyRules(q('policyId')))
      case 'all-rule-policies': return json(await allRulePolicies())
      default: throw new HttpError(404, `Unknown governance operation: ${op}`)
    }
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('governance', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'governance/{op}',
  handler,
})
