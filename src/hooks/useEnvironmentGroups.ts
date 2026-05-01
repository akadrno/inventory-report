import { useInfiniteQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import { fetchEnvironmentGroupsPage } from '../api/powerPlatformApi'
import { useDebug } from '../context/DebugContext'
import type { ResourceQueryResponse } from '../types'

export function useEnvironmentGroups() {
  const { instance } = useMsal()
  const { addEntry } = useDebug()

  return useInfiniteQuery<ResourceQueryResponse, Error>({
    queryKey: ['environmentGroups'],
    queryFn: ({ pageParam }) =>
      fetchEnvironmentGroupsPage(instance, {
        skipToken: pageParam as string | undefined,
        top: 100,
        onDebug: addEntry,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.resultTruncated === 0 ? lastPage.skipToken : undefined,
  })
}
