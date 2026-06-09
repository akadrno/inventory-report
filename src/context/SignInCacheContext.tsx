import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import type { SignInRecord } from '../api/signInsApi'
import {
  CACHE_DAYS,
  loadCachedSignIns,
  refreshSignInCache,
  signInCacheConfigured,
} from '../api/signInsCache'

// Shared state for the cached Entra sign-in data that powers the Usage heatmap.
// One provider owns the cache lifecycle so both the heatmap and the home page
// see the same records, last-updated time, and background-refresh status.

export type SignInCacheStatus = 'idle' | 'refreshing' | 'error'

export interface SignInCacheValue {
  /** Trimmed sign-in records for the last CACHE_DAYS days, served from storage. */
  records: SignInRecord[]
  /** ISO timestamp of the last successful refresh, or null if never cached. */
  cachedAt: string | null
  recordCount: number
  /** True if the last refresh hit the Graph record cap. */
  truncated: boolean
  /** Initial read of the cache table is still in flight. */
  loadingFromCache: boolean
  /** Background-refresh state. */
  status: SignInCacheStatus
  error: string | null
  /** Whether Azure Storage is configured at all (falls back to live fetch if not). */
  configured: boolean
  /** Number of days the cache covers. */
  cacheDays: number
  /** Manually kick off a background refresh (the "Update now" button). */
  refreshNow: () => void
}

const SignInCacheContext = createContext<SignInCacheValue | null>(null)

// Auto-refresh in the background when the cache is older than this on app load.
const REFRESH_AFTER_MS = 60 * 60 * 1000 // 1 hour

export function SignInCacheProvider({ children }: { children: React.ReactNode }) {
  const { instance } = useMsal()

  const [records, setRecords] = useState<SignInRecord[]>([])
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loadingFromCache, setLoadingFromCache] = useState(signInCacheConfigured)
  const [status, setStatus] = useState<SignInCacheStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Guards against overlapping refreshes (manual click while auto-refresh runs).
  const refreshingRef = useRef(false)

  const doRefresh = useCallback(async () => {
    if (!signInCacheConfigured || refreshingRef.current) return
    refreshingRef.current = true
    setStatus('refreshing')
    setError(null)
    try {
      await refreshSignInCache(instance)
      const fresh = await loadCachedSignIns(CACHE_DAYS)
      setRecords(fresh.records)
      setCachedAt(fresh.cachedAt)
      setTruncated(fresh.truncated)
      setStatus('idle')
    } catch (e) {
      // Keep showing the previous cache; just surface that the update failed.
      setError((e as Error)?.message ?? 'Failed to update sign-in data.')
      setStatus('error')
    } finally {
      refreshingRef.current = false
    }
  }, [instance])

  // Keep a stable ref so the mount effect can call the latest doRefresh without
  // re-running on every render.
  const doRefreshRef = useRef(doRefresh)
  doRefreshRef.current = doRefresh

  const refreshNow = useCallback(() => { void doRefreshRef.current() }, [])

  // On mount: read the cache for an instant render, then auto-refresh in the
  // background if it's missing or stale.
  useEffect(() => {
    if (!signInCacheConfigured) {
      setLoadingFromCache(false)
      return
    }
    let cancelled = false
    void (async () => {
      let loaded: Awaited<ReturnType<typeof loadCachedSignIns>> | null = null
      try {
        loaded = await loadCachedSignIns(CACHE_DAYS)
        if (cancelled) return
        setRecords(loaded.records)
        setCachedAt(loaded.cachedAt)
        setTruncated(loaded.truncated)
      } catch {
        // Ignore a failed initial read — a refresh will repopulate.
      } finally {
        if (!cancelled) setLoadingFromCache(false)
      }
      if (cancelled) return
      const age = loaded?.cachedAt ? Date.now() - new Date(loaded.cachedAt).getTime() : Infinity
      if (age > REFRESH_AFTER_MS) void doRefreshRef.current()
    })()
    return () => { cancelled = true }
  }, [])

  const value: SignInCacheValue = {
    records,
    cachedAt,
    recordCount: records.length,
    truncated,
    loadingFromCache,
    status,
    error,
    configured: signInCacheConfigured,
    cacheDays: CACHE_DAYS,
    refreshNow,
  }

  return <SignInCacheContext.Provider value={value}>{children}</SignInCacheContext.Provider>
}

export function useSignInCache(): SignInCacheValue {
  const ctx = useContext(SignInCacheContext)
  if (!ctx) throw new Error('useSignInCache must be used within a SignInCacheProvider')
  return ctx
}
