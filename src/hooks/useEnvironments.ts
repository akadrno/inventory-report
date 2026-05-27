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
    getNextPageParam: (lastPage) => lastPage.skipToken ?? undefined,
  })

  const pagesLoaded = query.data?.pages.length ?? 0
  const lastPage = query.data?.pages[pagesLoaded - 1]

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) {
      query.fetchNextPage()
    }
    if (lastPage && lastPage.resultTruncated && !lastPage.skipToken) {
      console.warn('useEnvironments: page reports truncated results without a skipToken; cannot continue pagination', lastPage)
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.isError, query.fetchNextPage, pagesLoaded, lastPage])

  return query
}
