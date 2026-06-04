import { createContext, useCallback, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiConfigured } from '../api/apiClient'
import { fetchMyPermissions } from '../api/rbacApi'
import { ALL_PERMISSION_KEYS, railSubKeys } from '../permissions/catalog'
import type { EffectivePermissions, RecordScope } from '../types/permissions'

interface PermissionsContextValue {
  /** True for any non-gated landing page ('home'), or when the user holds the leaf key. */
  can: (key: string) => boolean
  /** Rail-level visibility: home always, admin iff app-admin, others iff >=1 permitted leaf. */
  canRail: (rail: string) => boolean
  isAppAdmin: boolean
  canManageUsers: boolean
  recordScope: RecordScope
  isLoading: boolean
  isError: boolean
  /** Whether the RBAC backend is wired up (VITE_API_BASE_URL set). */
  configured: boolean
}

// Legacy / no-backend mode: behave exactly as the app did before RBAC — full access
// to every page, no admin console (it needs the backend), no record scoping.
const LEGACY_PERMS: EffectivePermissions = {
  allowedKeys: ALL_PERMISSION_KEYS,
  isAppAdmin: false,
  canManageUsers: false,
  recordScope: 'all',
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery<EffectivePermissions, Error>({
    queryKey: ['me-permissions'],
    queryFn: ({ signal }) => fetchMyPermissions(signal),
    enabled: apiConfigured,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const perms: EffectivePermissions = apiConfigured ? (query.data ?? LEGACY_PERMS) : LEGACY_PERMS
  // Until the real permissions arrive we fall back to LEGACY_PERMS only for shape;
  // Shell shows a spinner while isLoading so a forbidden default never renders.
  const hasData = !apiConfigured || !!query.data

  const allowed = perms.allowedKeys
  const isAppAdmin = perms.isAppAdmin
  const recordScope = perms.recordScope

  const can = useCallback(
    (key: string) => key === 'home' || allowed.includes(key),
    [allowed],
  )

  const canRail = useCallback(
    (rail: string) => {
      if (rail === 'home') return true
      if (rail === 'admin') return isAppAdmin
      return railSubKeys(rail).some(k => allowed.includes(k))
    },
    [allowed, isAppAdmin],
  )

  const value = useMemo<PermissionsContextValue>(
    () => ({
      can,
      canRail,
      isAppAdmin,
      canManageUsers: perms.canManageUsers,
      recordScope,
      isLoading: apiConfigured && query.isLoading && !hasData,
      isError: apiConfigured && query.isError,
      configured: apiConfigured,
    }),
    [can, canRail, isAppAdmin, perms.canManageUsers, recordScope, query.isLoading, query.isError, hasData],
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions must be used inside <PermissionsProvider>')
  return ctx
}
