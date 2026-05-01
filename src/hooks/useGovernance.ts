import { useQuery } from '@tanstack/react-query'
import { fetchDLPPolicies, fetchTenantSettings, fetchEnvironmentCapacity, fetchBillingPolicies } from '../api/governanceApi'
import type { DLPPolicy, TenantSettings, EnvironmentCapacity, BillingPolicy } from '../api/governanceApi'

export type { DLPPolicy, TenantSettings, EnvironmentCapacity, BillingPolicy }

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
