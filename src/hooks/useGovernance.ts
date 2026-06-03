import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchDLPPolicies, fetchTenantSettings, fetchEnvironmentCapacity, fetchBillingPolicies,
  fetchCrossTenantConnectionReport, fetchAdvisorRecommendations, fetchRecommendationResources,
  fetchConnections,
} from '../api/governanceApi'
import {
  tableStorageConfigured, loadGovernanceCache, saveGovernanceCache,
} from '../api/tableStorageApi'
import type { CachedBlob } from '../api/tableStorageApi'
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

const CROSS_TENANT_CACHE_ROW = 'crossTenantReport'

export interface CrossTenantState {
  report?: CrossTenantConnectionReport
  cachedAt?: string
  isLoading: boolean      // initial cache read
  isUpdating: boolean     // live regeneration in flight
  isError: boolean
  error: Error | null
  cached: boolean         // whether storage-backed caching is in effect
  refresh: () => void
}

// Cache-backed cross-tenant report. When Azure Table Storage is configured the
// page loads instantly from the cached report; an empty cache auto-populates,
// and Refresh regenerates the live report and rewrites the cache. When storage
// isn't configured it transparently falls back to a direct live fetch.
export function useCrossTenantConnections(active: boolean): CrossTenantState {
  const qc = useQueryClient()

  const cacheQuery = useQuery<CachedBlob<CrossTenantConnectionReport> | null, Error>({
    queryKey: ['cross-tenant-cache'],
    queryFn: () => loadGovernanceCache<CrossTenantConnectionReport>(CROSS_TENANT_CACHE_ROW),
    enabled: active && tableStorageConfigured,
    retry: false,
    staleTime: Infinity,
  })

  const liveQuery = useQuery<CrossTenantConnectionReport, Error>({
    queryKey: ['cross-tenant-report'],
    queryFn: ({ signal }) => fetchCrossTenantConnectionReport(signal),
    enabled: active && !tableStorageConfigured,
    retry: false,
    staleTime: 10 * 60 * 1000,
  })

  const refreshMutation = useMutation<CrossTenantConnectionReport, Error, void>({
    mutationFn: async () => {
      const report = await fetchCrossTenantConnectionReport()
      // Caching is best-effort: a storage write failure must not hide a report
      // that the governance API returned successfully.
      try { await saveGovernanceCache(CROSS_TENANT_CACHE_ROW, report) } catch { /* ignore */ }
      return report
    },
    onSuccess: (report) => {
      qc.setQueryData<CachedBlob<CrossTenantConnectionReport>>(
        ['cross-tenant-cache'],
        { data: report, cachedAt: new Date().toISOString() },
      )
    },
  })

  // Auto-populate when storage is configured but the cache is empty (or its read
  // failed — treat that as empty and fall back to a live fetch + re-cache).
  const { mutate: doRefresh, isPending } = refreshMutation
  const autoTriggered = useRef(false)
  useEffect(() => {
    if (!active || !tableStorageConfigured) return
    if (cacheQuery.isLoading) return
    if (!cacheQuery.data && !autoTriggered.current && !isPending) {
      autoTriggered.current = true
      doRefresh()
    }
  }, [active, cacheQuery.isLoading, cacheQuery.data, isPending, doRefresh])

  if (!tableStorageConfigured) {
    return {
      report: liveQuery.data,
      cachedAt: undefined,
      isLoading: liveQuery.isLoading,
      isUpdating: liveQuery.isFetching && !!liveQuery.data,
      isError: liveQuery.isError,
      error: liveQuery.error,
      cached: false,
      refresh: () => { liveQuery.refetch() },
    }
  }

  // Prefer cached data; fall back to the freshly-fetched report when the cache
  // read failed but the live regeneration succeeded.
  const report = cacheQuery.data?.data ?? refreshMutation.data
  return {
    report,
    cachedAt: cacheQuery.data?.cachedAt,
    isLoading: cacheQuery.isLoading,
    isUpdating: isPending,
    isError: !report && !isPending && refreshMutation.isError,
    error: refreshMutation.error ?? cacheQuery.error,
    cached: true,
    refresh: () => { doRefresh() },
  }
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
