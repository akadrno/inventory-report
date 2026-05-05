import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, bapScopes, powerPlatformScopes } from '../auth/msalConfig'

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
): Promise<{ assignments: GroupRuleAssignment[]; rawJson: string }> {
  // groupId may be a full resource path — extract just the last segment (the GUID)
  const id = groupId.includes('/') ? groupId.split('/').filter(Boolean).pop()! : groupId
  const token = await getPowerPlatformToken()
  const res = await fetch(
    `https://api.powerplatform.com/governance/ruleBasedPolicies/environmentGroups/${id}/assignments?api-version=2022-03-01-preview`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (res.status === 404) return { assignments: [], rawJson: '{"value":[],"_note":"404 not found"}' }
  if (res.status === 403) throw new Error('403: Insufficient permissions to read rule assignments')
  if (!res.ok) throw new Error(`Group rule assignments fetch failed: ${res.status}`)
  const text = await res.text()
  const json = JSON.parse(text) as { value?: GroupRuleAssignment[] }
  return { assignments: json.value ?? [], rawJson: text }
}

export async function fetchGroupAssignmentsAllVersions(
  groupId: string,
): Promise<Record<string, string>> {
  const id = groupId.includes('/') ? groupId.split('/').filter(Boolean).pop()! : groupId
  const token = await getPowerPlatformToken()
  const versions = ['2024-10-01', '2022-03-01-preview', '2021-10-01-preview']
  const results = await Promise.all(
    versions.map(async v => {
      try {
        const res = await fetch(
          `https://api.powerplatform.com/governance/ruleBasedPolicies/environmentGroups/${id}/assignments?api-version=${v}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        return [v, await res.text()] as const
      } catch (e) {
        return [v, JSON.stringify({ _error: String(e) })] as const
      }
    }),
  )
  return Object.fromEntries(results)
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
export async function fetchAllRuleBasedPolicies(): Promise<{ policies: RuleBasedPolicy[]; rawJson: string }> {
  const token = await getPowerPlatformToken()
  const res = await fetch(
    `https://api.powerplatform.com/governance/ruleBasedPolicies?$top=100&api-version=2022-03-01-preview`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (res.status === 404) return { policies: [], rawJson: '{"value":[],"_note":"404"}' }
  if (!res.ok) throw new Error(`List rule-based policies failed: ${res.status} ${await res.text()}`)
  const text = await res.text()
  const json = JSON.parse(text) as { value?: RuleBasedPolicy[] }
  return { policies: json.value ?? [], rawJson: text }
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
