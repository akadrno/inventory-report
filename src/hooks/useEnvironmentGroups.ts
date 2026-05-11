import { useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import { fetchEnvironmentGroupsPage } from '../api/powerPlatformApi'
import { useDebug } from '../context/DebugContext'
import type { ResourceQueryResponse } from '../types'

export function useEnvironmentGroups() {
  const { instance } = useMsal()
  const { addEntry } = useDebug()

  const query = useInfiniteQuery<ResourceQueryResponse, Error>({
    queryKey: ['environmentGroups'],
    queryFn: ({ pageParam }) =>
      fetchEnvironmentGroupsPage(instance, {
        skipToken: pageParam as string | undefined,
        top: 500,
        onDebug: addEntry,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.skipToken,
  })

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage()
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage])

  return query
}
