import { useInfiniteQuery } from '@tanstack/react-query'
import { useMsal } from '@azure/msal-react'
import { fetchEnvironmentsPage } from '../api/powerPlatformApi'
import { useDebug } from '../context/DebugContext'
import type { ResourceQueryResponse } from '../types'

export function useEnvironments() {
  const { instance } = useMsal()
  const { addEntry } = useDebug()

  return useInfiniteQuery<ResourceQueryResponse, Error>({
    queryKey: ['environments'],
    queryFn: ({ pageParam }) =>
      fetchEnvironmentsPage(instance, {
        skipToken: pageParam as string | undefined,
        top: 200,
        onDebug: addEntry,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.resultTruncated === 0 ? lastPage.skipToken : undefined,
  })
}
