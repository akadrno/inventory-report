import { useQuery } from '@tanstack/react-query'
import { fetchConnectorMetadata } from '../api/connectorsApi'
import type { ConnectorMetadata } from '../api/connectorsApi'

export type { ConnectorMetadata }

// Connector tier/publisher metadata for one environment. The catalog rarely
// changes, so it's cached aggressively and shared across resources in the same
// environment. Disabled until an environment id is known; failures are non-fatal
// (callers fall back to the static connector lookup).
export function useConnectorMetadata(environmentId: string | undefined) {
  return useQuery<Record<string, ConnectorMetadata>, Error>({
    queryKey: ['connector-metadata', environmentId],
    queryFn: ({ signal }) => fetchConnectorMetadata(environmentId!, signal),
    enabled: !!environmentId,
    retry: false,
    staleTime: 30 * 60 * 1000,
  })
}
