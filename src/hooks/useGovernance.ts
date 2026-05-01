import { useQuery } from '@tanstack/react-query'
import { fetchDLPPolicies, fetchTenantSettings } from '../api/governanceApi'
import type { DLPPolicy, TenantSettings } from '../api/governanceApi'

export type { DLPPolicy, TenantSettings }

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
