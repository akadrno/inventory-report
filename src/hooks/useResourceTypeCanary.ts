import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import { fetchResourceTypeCensus } from '../api/powerPlatformApi'
import { useDebug } from '../context/DebugContext'
import {
  isInventoryNamespace,
  isKnownInventoryResourceType,
} from '../config/resourceCatalog'

export interface ResourceTypeCanaryResult {
  unknownTypes: string[]
  pagesScanned: number
  recordsScanned: number
  hasMore: boolean
  error?: string
}

export function useResourceTypeCanary(enabled: boolean) {
  const { instance } = useMsal()
  const { addEntry } = useDebug()

  const query = useQuery({
    queryKey: ['resource-type-canary'],
    enabled,
    retry: false,
    queryFn: () => fetchResourceTypeCensus(instance, { maxPages: 8, top: 500, onDebug: addEntry }),
    staleTime: 1000 * 60 * 60 * 6,
  })

  const unknownTypes = useMemo(() => {
    const all = query.data?.distinctTypes ?? []
    return all
      .filter(type => isInventoryNamespace(type))
      .filter(type => !isKnownInventoryResourceType(type))
      .sort()
  }, [query.data])

  const result: ResourceTypeCanaryResult = {
    unknownTypes,
    pagesScanned: query.data?.pagesScanned ?? 0,
    recordsScanned: query.data?.recordsScanned ?? 0,
    hasMore: query.data?.hasMore ?? false,
    error: query.error instanceof Error ? query.error.message : undefined,
  }

  return { query, result }
}
