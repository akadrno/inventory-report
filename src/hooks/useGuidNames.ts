import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import { resolveOwnerIds } from '../api/graphApi'

/**
 * Resolves an arbitrary list of Entra GUIDs to display names. Dedupes and
 * sorts internally so the query cache key is stable regardless of input order.
 */
export function useGuidNames(guids: string[]): Map<string, string> {
  const { instance } = useMsal()

  const sorted = useMemo(() => [...new Set(guids)].sort(), [guids])

  const { data } = useQuery({
    queryKey: ['guidNames', sorted.join(',')],
    queryFn: () => resolveOwnerIds(instance, sorted),
    enabled: sorted.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })

  return data ?? new Map()
}
