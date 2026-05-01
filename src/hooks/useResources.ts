import { useInfiniteQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import { fetchResourcesPage } from '../api/powerPlatformApi'
import { useDebug } from '../context/DebugContext'
import type { ResourceQueryResponse } from '../types'

export function useResources() {
  const { instance } = useMsal()
  const { addEntry } = useDebug()

  return useInfiniteQuery<ResourceQueryResponse, Error>({
    queryKey: ['resources'],
    queryFn: ({ pageParam }) =>
      fetchResourcesPage(instance, {
        skipToken: pageParam as string | undefined,
        top: 100,
        onDebug: addEntry,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.resultTruncated === 0 ? lastPage.skipToken : undefined,
  })
}
