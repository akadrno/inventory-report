import { useQuery } from '@tanstack/react-query'
import {
  fetchDLPPolicies, fetchTenantSettings, fetchEnvironmentCapacity, fetchBillingPolicies,
  fetchCrossTenantConnectionReport, fetchAdvisorRecommendations, fetchRecommendationResources,
  fetchConnections,
} from '../api/governanceApi'
import type {
  DLPPolicy, TenantSettings, EnvironmentCapacity, BillingPolicy,
  CrossTenantConnectionReport, AdvisorRecommendation, RecommendationResource, ConnectionsResult,
} from '../api/governanceApi'
import { fetchSubscribedSkus } from '../api/graphApi'
import type { SubscribedSku } from '../api/graphApi'

export type {
  DLPPolicy, TenantSettings, EnvironmentCapacity, BillingPolicy, SubscribedSku,
  CrossTenantConnectionReport, AdvisorRecommendation, RecommendationResource, ConnectionsResult,
}

export function useDLPPolicies() {
  return useQuery<DLPPolicy[], Error>({
    queryKey: ['dlp-policies'],
    queryFn: fetchDLPPolicies,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTenantSettings() {
  return useQuery<TenantSettings, Error>({
    queryKey: ['tenant-settings'],
    queryFn: fetchTenantSettings,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useEnvironmentCapacity() {
  return useQuery<EnvironmentCapacity[], Error>({
    queryKey: ['environment-capacity'],
    queryFn: fetchEnvironmentCapacity,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBillingPolicies() {
  return useQuery<BillingPolicy[], Error>({
    queryKey: ['billing-policies'],
    queryFn: fetchBillingPolicies,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLicenses() {
  return useQuery<SubscribedSku[], Error>({
    queryKey: ['subscribed-skus'],
    queryFn: fetchSubscribedSkus,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

// Lazy: generating a cross-tenant report is an async side-effecting call, so we
// only fire it once the user opens the section (enabled flag).
export function useCrossTenantConnectionReport(enabled: boolean) {
  return useQuery<CrossTenantConnectionReport, Error>({
    queryKey: ['cross-tenant-report'],
    queryFn: ({ signal }) => fetchCrossTenantConnectionReport(signal),
    enabled,
    retry: false,
    staleTime: 10 * 60 * 1000,
  })
}

export function useAdvisorRecommendations(enabled: boolean) {
  return useQuery<AdvisorRecommendation[], Error>({
    queryKey: ['advisor-recommendations'],
    queryFn: ({ signal }) => fetchAdvisorRecommendations(signal),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useRecommendationResources(scenario: string | null) {
  return useQuery<RecommendationResource[], Error>({
    queryKey: ['recommendation-resources', scenario],
    queryFn: ({ signal }) => fetchRecommendationResources(scenario!, signal),
    enabled: !!scenario,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

// Lazy + keyed by env-set size: aggregating connections fans out one call per
// environment, so it only runs after the section is opened.
export function useConnections(envIds: string[], enabled: boolean) {
  return useQuery<ConnectionsResult, Error>({
    queryKey: ['connections', envIds.length],
    queryFn: ({ signal }) => fetchConnections(envIds, signal),
    enabled: enabled && envIds.length > 0,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
