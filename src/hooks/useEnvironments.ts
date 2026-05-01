import { useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import { fetchEnvironmentsPage } from '../api/powerPlatformApi'
import { useDebug } from '../context/DebugContext'
import type { ResourceQueryResponse } from '../types'

export function useEnvironments() {
  const { instance } = useMsal()
  const { addEntry } = useDebug()

  const query = useInfiniteQuery<ResourceQueryResponse, Error>({
    queryKey: ['environments'],
    queryFn: ({ pageParam }) =>
      fetchEnvironmentsPage(instance, {
        skipToken: pageParam as string | undefined,
        top: 500,
        onDebug: addEntry,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.resultTruncated === 0 ? lastPage.skipToken : undefined,
  })

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage()
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage])

  return query
}
