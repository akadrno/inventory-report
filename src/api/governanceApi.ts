import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, bapScopes, powerPlatformScopes, powerAppsScopes } from '../auth/msalConfig'

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Singleton promise so concurrent callers share one popup instead of racing.
let _inFlight: Promise<string> | null = null

async function getBapToken(): Promise<string> {
  if (_inFlight) return _inFlight
  const account = msalInstance.getAllAccounts()[0]
  _inFlight = (async () => {
    try {
      const result = await msalInstance.acquireTokenSilent({ scopes: bapScopes, account })
      return result.accessToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const result = await msalInstance.acquireTokenPopup({ scopes: bapScopes, account })
        return result.accessToken
      }
      throw e
    }
  })().finally(() => { _inFlight = null })
  return _inFlight
}

let _ppInFlight: Promise<string> | null = null

async function getPowerPlatformToken(): Promise<string> {
  if (_ppInFlight) return _ppInFlight
  const account = msalInstance.getAllAccounts()[0]
  _ppInFlight = (async () => {
    try {
      const result = await msalInstance.acquireTokenSilent({ scopes: powerPlatformScopes, account })
      return result.accessToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const result = await msalInstance.acquireTokenPopup({ scopes: powerPlatformScopes, account })
        return result.accessToken
      }
      throw e
    }
  })().finally(() => { _ppInFlight = null })
  return _ppInFlight
}

export interface CapacityEntry {
  capacityType: 'Database' | 'File' | 'Log'
  actualConsumption: number
  ratedConsumption: number
  capacityUnit: string
  updatedOn: string
}

export interface EnvironmentCapacity {
  id: string
  name: string
  location: string
  displayName: string
  environmentType: string
  capacity: CapacityEntry[]
  addons: Array<{ addonType: string; quantity: number }>
}

export interface BillingPolicy {
  id: string
  name: string
  type: string
  properties: {
    billingInstrument?: { id: string; resourceId: string }
    environments?: Array<{ id: string; name: string }>
    provisioningState?: string
  }
}

export interface GroupRuleAssignment {
  policyId: string       // GUID of the rule-based policy
  tenantId?: string
  resourceId?: string    // group's internal resource ID
  resourceType?: string
  ruleSetCount?: number
  [key: string]: unknown
}

export interface PolicyRule {
  id?: string
  name?: string
  displayName?: string
  description?: string
  isEnabled?: boolean
  ruleType?: string
  [key: string]: unknown
}

export interface PolicyRuleSet {
  id?: string
  ruleSetId?: string
  version?: string
  name?: string
  displayName?: string
  inputs?: Record<string, unknown>
  rules?: PolicyRule[]
  [key: string]: unknown
}

export interface RuleBasedPolicy {
  id?: string
  policyId?: string
  name?: string
  displayName?: string
  description?: string
  type?: string
  status?: string
  ruleSetCount?: number
  ruleSets?: PolicyRuleSet[]
  rules?: PolicyRule[]
  [key: string]: unknown
}

export async function fetchGroupRuleAssignments(
  groupId: string,
): Promise<{ assignments: GroupRuleAssignment[] }> {
  const id = groupId.includes('/') ? groupId.split('/').filter(Boolean).pop()! : groupId
  const token = await getPowerPlatformToken()
  const res = await fetch(
    `https://api.powerplatform.com/governance/ruleBasedPolicies/environmentGroups/${id}/assignments?api-version=2022-03-01-preview`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (res.status === 404) return { assignments: [] }
  if (res.status === 403) throw new Error('403: Insufficient permissions to read rule assignments')
  if (!res.ok) throw new Error(`Group rule assignments fetch failed: ${res.status}`)
  const json = await res.json() as { value?: GroupRuleAssignment[] }
  return { assignments: json.value ?? [] }
}

export async function fetchRuleBasedPolicy(policyId: string): Promise<RuleBasedPolicy> {
  const id = policyId.includes('/') ? policyId.split('/').filter(Boolean).pop()! : policyId
  const token = await getPowerPlatformToken()
  const res = await fetch(
    `https://api.powerplatform.com/governance/ruleBasedPolicies/${id}?$expand=ruleSets&api-version=2022-03-01-preview`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Rule-based policy fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchPolicyRules(policyId: string): Promise<PolicyRule[]> {
  const id = policyId.includes('/') ? policyId.split('/').filter(Boolean).pop()! : policyId
  const token = await getPowerPlatformToken()
  const res = await fetch(
    `https://api.powerplatform.com/governance/ruleBasedPolicies/${id}/rules?api-version=2022-03-01-preview`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Policy rules fetch failed: ${res.status}`)
  const json = await res.json()
  return json.value ?? json.rules ?? []
}

// Lists all tenant rule-based policies (without $expand — the list endpoint
// does not support it). Used to discover policies for a group that may not
// surface via the per-group assignments endpoint.
export async function fetchAllRuleBasedPolicies(): Promise<{ policies: RuleBasedPolicy[] }> {
  const token = await getPowerPlatformToken()
  const res = await fetch(
    `https://api.powerplatform.com/governance/ruleBasedPolicies?$top=100&api-version=2022-03-01-preview`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (res.status === 404) return { policies: [] }
  if (!res.ok) throw new Error(`List rule-based policies failed: ${res.status}`)
  const json = await res.json() as { value?: RuleBasedPolicy[] }
  return { policies: json.value ?? [] }
}

export async function fetchEnvironmentCapacity(): Promise<EnvironmentCapacity[]> {
  const token = await getPowerPlatformToken()
  const res = await fetch(
    'https://api.powerplatform.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2020-10-01&$expand=properties.capacity,properties.addons',
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Environment capacity fetch failed: ${res.status}`)
  const json = await res.json()
  const raw: Record<string, unknown>[] = json.value ?? []
  return raw.map(e => {
    const props = (e['properties'] as Record<string, unknown>) ?? {}
    return {
      id: e['id'] as string ?? '',
      name: e['name'] as string ?? '',
      location: e['location'] as string ?? '',
      displayName: (props['displayName'] as string) ?? (e['name'] as string) ?? '',
      environmentType: (props['environmentType'] as string) ?? '',
      capacity: (props['capacity'] as CapacityEntry[]) ?? [],
      addons: (props['addons'] as EnvironmentCapacity['addons']) ?? [],
    }
  })
}

export async function fetchBillingPolicies(): Promise<BillingPolicy[]> {
  const token = await getPowerPlatformToken()
  const res = await fetch(
    'https://api.powerplatform.com/licensing/billingPolicies?api-version=2022-03-01-preview',
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Billing policies fetch failed: ${res.status}`)
  const json = await res.json()
  return json.value ?? []
}

export interface DLPPolicy {
  name: string
  displayName: string
  type: string
  environmentType?: string
  // V1 shape
  environments?: { name: string; id: string; type: string }[]
  connectorGroups?: {
    classification: string
    connectors: { id: string; name: string; type: string }[]
  }[]
  // V1 inner shape (apiPolicies endpoint)
  properties?: {
    displayName?: string
    defaultConnectorsClassification?: string
    connectorGroups?: { classification: string; connectors: { id: string; name: string; type: string }[] }[]
    environments?: { name: string; id: string; type: string }[]
    environmentType?: string
    createdBy?: unknown
    createdTime?: string
    lastModifiedBy?: unknown
    lastModifiedTime?: string
    etag?: string
  }
  createdTime?: string
  lastModifiedTime?: string
  etag?: string
}

export interface TenantSettings {
  walkMeOptOut?: boolean
  disableNPSCommentsReachout?: boolean
  disableNewsletterSendout?: boolean
  disableEnvironmentCreationByNonAdminUsers?: boolean
  disablePortalsCreationByNonAdminUsers?: boolean
  disableSurveyFeedback?: boolean
  disableTrialEnvironmentCreationByNonAdminUsers?: boolean
  disableCapacityAllocationByEnvironmentAdmins?: boolean
  disableSupportTicketsForB2BUsers?: boolean
  powerPlatform?: {
    search?: { disableDocsSearch?: boolean; disableCommunitySearch?: boolean; disableBingVideoSearch?: boolean }
    teamsIntegration?: { shareWithColleaguesUserLimit?: number }
    powerApps?: {
      disableShareWithEveryone?: boolean
      enableGuestsToMake?: boolean
      disableMembersIndicator?: boolean
      disableMakerMatch?: boolean
    }
    powerAutomate?: { disableCopilot?: boolean }
    environments?: { preferredEnvironmentLocation?: string }
    governance?: {
      disableAdminDigest?: boolean
      disableUsageMetricsForAdmins?: boolean
      disableDeveloperEnvironmentCreationByNonAdminUsers?: boolean
    }
    licensing?: {
      disableBillingPolicyCreationByNonAdminUsers?: boolean
      enableTenantCapacityReportForEnvironmentAdmins?: boolean
      storageCapacityConsumptionWarningThreshold?: number
    }
    champions?: { disableChampionsInvitationReachout?: boolean; disableSkillsMatchInvitationReachout?: boolean }
    intelligence?: { disableCopilot?: boolean; enableOpenAiBotPublishing?: boolean }
    modelExperimentation?: { enableModelDataSharing?: boolean; optOutOfExperimentsWithBots?: boolean }
    catalogSettings?: { powerCatalogAudienceSetting?: string }
    userManagementSettings?: { enableDeleteDisabledUserinAllEnvironments?: boolean }
  }
}

export async function fetchDLPPolicies(): Promise<DLPPolicy[]> {
  const token = await getBapToken()
  const res = await fetch(
    'https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/apiPolicies?api-version=2016-11-01',
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`DLP fetch failed: ${res.status}`)
  const json = await res.json()
  const raw: DLPPolicy[] = json.value ?? json
  // Normalise V1 shape: hoist properties fields to top level
  return raw.map(p => ({
    ...p,
    displayName: p.displayName ?? p.properties?.displayName ?? p.name,
    environmentType: p.environmentType ?? p.properties?.environmentType,
    environments: p.environments ?? p.properties?.environments,
    connectorGroups: p.connectorGroups ?? p.properties?.connectorGroups,
  }))
}

export async function fetchTenantSettings(): Promise<TenantSettings> {
  const token = await getBapToken()
  const res = await fetch(
    'https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/listTenantSettings?api-version=2021-04-01',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    },
  )
  if (!res.ok) throw new Error(`Tenant settings fetch failed: ${res.status}`)
  return res.json() as Promise<TenantSettings>
}

// ─── Cross-tenant connection reports (governance namespace, preview) ──────────
// Surfaces inbound/outbound connections to *other* Azure AD tenants — a key
// data-exfiltration / -infiltration signal. The report is generated async:
// POST "generate or fetch" returns an existing recent report (200) or starts a
// new one (202); we then poll GET {reportId} until it reaches a terminal state.

const CROSS_TENANT_BASE = 'https://api.powerplatform.com/governance/crossTenantConnectionReports'
const PP_API_VERSION = 'api-version=2024-10-01'

export interface CrossTenantConnection {
  connectionType: 'Inbound' | 'Outbound'
  tenantId: string
}

export interface CrossTenantConnectionReport {
  reportId?: string
  status?: 'Completed' | 'Failed' | 'InProgress' | 'Received'
  startDate?: string
  endDate?: string
  requestDate?: string
  tenantId?: string
  connections: CrossTenantConnection[]
}

export async function fetchCrossTenantConnectionReport(
  signal?: AbortSignal,
): Promise<CrossTenantConnectionReport> {
  const token = await getPowerPlatformToken()
  const auth = { Authorization: `Bearer ${token}` }

  const post = await fetch(`${CROSS_TENANT_BASE}?${PP_API_VERSION}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: '{}',
    signal,
  })
  if (post.status === 403) throw new Error('403: Insufficient permissions to generate cross-tenant connection reports')
  if (!post.ok && post.status !== 202) throw new Error(`Cross-tenant report request failed: ${post.status}`)
  let report = (await post.json()) as CrossTenantConnectionReport & { '@odata.nextLink'?: string }

  // Poll the report until it finishes generating (bounded so we never hang).
  let attempts = 0
  while (report.reportId && (report.status === 'InProgress' || report.status === 'Received') && attempts < 5) {
    await delay(3000)
    attempts++
    const get = await fetch(`${CROSS_TENANT_BASE}/${report.reportId}?${PP_API_VERSION}`, { headers: auth, signal })
    if (!get.ok) break
    report = (await get.json()) as typeof report
  }

  // The connections list itself can be paged via @odata.nextLink.
  const connections: CrossTenantConnection[] = [...(report.connections ?? [])]
  let next = report['@odata.nextLink']
  let guard = 0
  while (next && guard < 50) {
    const res = await fetch(next, { headers: auth, signal })
    if (!res.ok) break
    const page = (await res.json()) as { connections?: CrossTenantConnection[]; '@odata.nextLink'?: string }
    connections.push(...(page.connections ?? []))
    next = page['@odata.nextLink']
    guard++
  }

  return { ...report, connections }
}

// ─── Advisor recommendations (analytics namespace) ───────────────────────────
// Power Platform Advisor — proactive governance/security recommendations
// (inactive resources, over-shared apps, etc.). Each scenario rolls up a count
// of affected resources; drill into /{scenario}/resources for the detail rows.

const ADVISOR_BASE = 'https://api.powerplatform.com/analytics/advisorRecommendations'

export interface AdvisorRecommendation {
  scenario: string
  resourceCount?: number
  lastRefreshedTimestamp?: string
  expectedNextRefreshTimestamp?: string
}

export interface RecommendationResource {
  resourceId: string
  resourceName: string
  resourceType?: string
  resourceSubType?: string
  resourceDescription?: string
  environmentId?: string
  environmentName?: string
  resourceOwner?: string
  resourceOwnerId?: string
  lastAccessedDate?: string
  lastModifiedDate?: string
  resourceUsage?: number
  resourceActionStatus?: string
}

interface RawAdvisorRecommendation {
  scenario: string
  details?: {
    resourceCount?: number
    lastRefreshedTimestamp?: string
    expectedNextRefreshTimestamp?: string
  }
}

export async function fetchAdvisorRecommendations(signal?: AbortSignal): Promise<AdvisorRecommendation[]> {
  const token = await getPowerPlatformToken()
  const out: AdvisorRecommendation[] = []
  let url: string | undefined = `${ADVISOR_BASE}?${PP_API_VERSION}`
  let guard = 0
  while (url && guard < 20) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal })
    if (res.status === 403) throw new Error('403: Insufficient permissions to read Advisor recommendations')
    if (!res.ok) throw new Error(`Advisor recommendations fetch failed: ${res.status}`)
    const json = (await res.json()) as { value?: RawAdvisorRecommendation[]; nextLink?: string }
    for (const r of json.value ?? []) {
      out.push({
        scenario: r.scenario,
        resourceCount: r.details?.resourceCount,
        lastRefreshedTimestamp: r.details?.lastRefreshedTimestamp,
        expectedNextRefreshTimestamp: r.details?.expectedNextRefreshTimestamp,
      })
    }
    url = json.nextLink
    guard++
  }
  return out
}

export async function fetchRecommendationResources(
  scenario: string,
  signal?: AbortSignal,
): Promise<RecommendationResource[]> {
  const token = await getPowerPlatformToken()
  const out: RecommendationResource[] = []
  let url: string | undefined = `${ADVISOR_BASE}/${encodeURIComponent(scenario)}/resources?${PP_API_VERSION}`
  let guard = 0
  while (url && guard < 40) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal })
    if (!res.ok) {
      if (guard === 0) throw new Error(`Recommendation resources fetch failed: ${res.status}`)
      break
    }
    const json = (await res.json()) as { value?: RecommendationResource[]; nextLink?: string }
    out.push(...(json.value ?? []))
    url = json.nextLink
    guard++
  }
  return out
}

// ─── Connections + owner identity (PowerApps admin API) ──────────────────────
// Lists the live connection instances per environment and *who owns them* — the
// runtime counterpart to the connector inventory. Aggregated across environments
// with bounded concurrency so a large tenant doesn't fan out unbounded.

let _paInFlight: Promise<string> | null = null

async function getPowerAppsToken(): Promise<string> {
  if (_paInFlight) return _paInFlight
  const account = msalInstance.getAllAccounts()[0]
  _paInFlight = (async () => {
    try {
      const result = await msalInstance.acquireTokenSilent({ scopes: powerAppsScopes, account })
      return result.accessToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const result = await msalInstance.acquireTokenPopup({ scopes: powerAppsScopes, account })
        return result.accessToken
      }
      throw e
    }
  })().finally(() => { _paInFlight = null })
  return _paInFlight
}

export interface PowerConnection {
  id: string
  displayName: string
  connectorId: string
  owner?: { id?: string; displayName?: string; email?: string }
  createdTime?: string
  environmentId: string
  status?: string
}

interface EnvConnectionsResult {
  connections: PowerConnection[]
  // A 401/403 on this specific environment. Common even for Global Admins on
  // Developer/Teams/trial environments the admin API won't enumerate, so we
  // record it instead of failing the whole report.
  forbidden: boolean
}

async function fetchEnvironmentConnections(
  envId: string,
  token: string,
  signal?: AbortSignal,
): Promise<EnvConnectionsResult> {
  const res = await fetch(
    `https://api.powerapps.com/providers/Microsoft.PowerApps/scopes/admin/environments/${encodeURIComponent(envId)}/connections?api-version=2016-11-01`,
    { headers: { Authorization: `Bearer ${token}` }, signal },
  )
  // Record auth failures per environment; the caller only treats the report as
  // a permission problem when EVERY environment refuses. Any other per-env
  // error is treated as "no connections" rather than failing the lot.
  if (res.status === 401 || res.status === 403) return { connections: [], forbidden: true }
  if (!res.ok) return { connections: [], forbidden: false }
  const json = await res.json()
  const raw: Record<string, unknown>[] = json.value ?? []
  const connections = raw.map(c => {
    const props = (c['properties'] as Record<string, unknown>) ?? {}
    const createdBy = (props['createdBy'] as Record<string, unknown>) ?? {}
    const statuses = props['statuses'] as Array<Record<string, unknown>> | undefined
    return {
      id: (c['name'] as string) ?? (c['id'] as string) ?? '',
      displayName: (props['displayName'] as string) ?? '',
      connectorId: (props['apiId'] as string) ?? '',
      owner: {
        id: createdBy['id'] as string | undefined,
        displayName: createdBy['displayName'] as string | undefined,
        email: (createdBy['email'] ?? createdBy['userPrincipalName']) as string | undefined,
      },
      createdTime: props['createdTime'] as string | undefined,
      environmentId: envId,
      status: statuses?.[0]?.['status'] as string | undefined,
    }
  })
  return { connections, forbidden: false }
}

export interface ConnectionsResult {
  connections: PowerConnection[]
  truncated: boolean
  // Number of scanned environments that returned 401/403. A non-zero value with
  // a non-empty report just means some environments (e.g. Developer/Teams envs)
  // could not be enumerated — not a global permission failure.
  inaccessibleCount: number
}

export async function fetchConnections(
  envIds: string[],
  signal?: AbortSignal,
): Promise<ConnectionsResult> {
  const token = await getPowerAppsToken()
  // Cap the environment fan-out so very large tenants stay responsive.
  const CAP = 60
  const targets = envIds.slice(0, CAP)
  const truncated = envIds.length > CAP
  const all: PowerConnection[] = []
  let inaccessibleCount = 0
  const CONCURRENCY = 6
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(id => fetchEnvironmentConnections(id, token, signal)))
    for (const r of results) {
      all.push(...r.connections)
      if (r.forbidden) inaccessibleCount++
    }
  }
  // Only surface the permission notice when EVERY environment refused — that's
  // the genuine "not a Power Platform admin" signal. A partial set of forbidden
  // environments still yields a useful report.
  if (targets.length > 0 && inaccessibleCount === targets.length) {
    throw new Error('403: insufficient permissions to read connections')
  }
  return { connections: all, truncated, inaccessibleCount }
}
