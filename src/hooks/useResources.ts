import { useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import { fetchResourcesPage } from '../api/powerPlatformApi'
import { useDebug } from '../context/DebugContext'
import type { ResourceQueryResponse } from '../types'

export function useResources() {
  const { instance } = useMsal()
  const { addEntry } = useDebug()

  const query = useInfiniteQuery<ResourceQueryResponse, Error>({
    queryKey: ['resources'],
    queryFn: ({ pageParam }) =>
      fetchResourcesPage(instance, {
        skipToken: pageParam as string | undefined,
        top: 500,
        onDebug: addEntry,
      }),
    initialPageParam: undefined,
    // Continue paginating as long as the API hands us a continuation token.
    // We deliberately ignore `resultTruncated` here — only the absence of a
    // skipToken signals the true end of the result set.
    getNextPageParam: (lastPage) => lastPage.skipToken ?? undefined,
  })

  const pagesLoaded = query.data?.pages.length ?? 0
  const lastPage = query.data?.pages[pagesLoaded - 1]

  // Auto-chain page fetches until exhausted. We include `pagesLoaded` so the
  // effect retriggers after every successful page (otherwise hasNextPage may
  // stay `true` across renders and React skips the re-run).
  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) {
      query.fetchNextPage()
    }
    // Surface the rare case where the API reports more data without giving
    // us a way to fetch it — otherwise we'd silently under-report counts.
    if (lastPage && lastPage.resultTruncated && !lastPage.skipToken) {
      console.warn('useResources: page reports truncated results without a skipToken; cannot continue pagination', lastPage)
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.isError, query.fetchNextPage, pagesLoaded, lastPage])

  return query
}
