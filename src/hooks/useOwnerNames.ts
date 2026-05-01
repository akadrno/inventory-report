import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import type { ResourceItem } from '../types'
import { getOwnerFromProperties } from '../types'
import { resolveOwnerIds } from '../api/graphApi'

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export { GUID_RE }

const SYSTEM_PREFIX = '00000000-0000-0000'

export { SYSTEM_PREFIX }

export function isSystemResource(r: ResourceItem): boolean {
  const owner = getOwnerFromProperties(r)
  return owner.startsWith(SYSTEM_PREFIX)
}

function extractOwnerIds(resources: ResourceItem[]): string[] {
  const ids = new Set<string>()
  for (const r of resources) {
    const owner = getOwnerFromProperties(r)
    if (GUID_RE.test(owner) && !owner.startsWith(SYSTEM_PREFIX)) ids.add(owner)
  }
  return [...ids].sort()
}

/**
 * Resolves Entra object IDs found in resource owner fields to display names.
 * Results are cached for 30 minutes via React Query.
 */
export function useOwnerNames(resources: ResourceItem[]): Map<string, string> {
  const { instance } = useMsal()

  const ownerIds = useMemo(() => extractOwnerIds(resources), [resources])

  const { data } = useQuery({
    queryKey: ['ownerNames', ownerIds.join(',')],
    queryFn: () => resolveOwnerIds(instance, ownerIds),
    enabled: ownerIds.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })

  return data ?? new Map()
}
