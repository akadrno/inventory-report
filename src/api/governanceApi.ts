import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, bapScopes } from '../auth/msalConfig'

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
