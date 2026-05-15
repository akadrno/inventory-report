import { useState, useMemo } from 'react'
import { makeStyles, tokens, Caption1, Button, Title2, mergeClasses } from '@fluentui/react-components'
import { ArrowClockwiseRegular } from '@fluentui/react-icons'
import { useResources } from '../hooks/useResources'
import { useEnvironmentGroups } from '../hooks/useEnvironmentGroups'
import { useEnvironments } from '../hooks/useEnvironments'
import { useOwnerNames } from '../hooks/useOwnerNames'
import { StatCards } from '../components/StatCards'
import { Filters } from '../components/Filters'
import { ResourceTable } from '../components/ResourceTable'
import { GroupsView } from '../components/GroupsView'
import { UsersView } from '../components/UsersView'
import { EnvironmentsView } from '../components/EnvironmentsView'
import { GovernanceView } from '../components/GovernanceView'
import { ReportView } from '../components/ReportView'
import { ErrorBanner } from '../components/ErrorBanner'
import type { ResourceFilters } from '../types'
import { getResourceCategory, getDisplayName, getEnvironmentName, getOwnerFromProperties } from '../types'
import { GUID_RE, SYSTEM_PREFIX } from '../hooks/useOwnerNames'

const useClasses = makeStyles({
  main: {
    maxWidth: '1440px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    paddingTop: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalXL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  spinning: {
    animationName: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
})

const DRILLDOWN_TABS = new Set(['groups', 'users', 'environments', 'governance', 'report'])

export function Dashboard() {
  const resources = useResources()
  const groups = useEnvironmentGroups()
  const environmentsQuery = useEnvironments()
  const classes = useClasses()

  const [filters, setFilters] = useState<ResourceFilters>({
    search: '',
    environment: '',
    resourceTab: 'all',
  })

  const allResources = useMemo(
    () => resources.data?.pages.flatMap(p => p.data) ?? [],
    [resources.data],
  )

  const allGroups = useMemo(
    () => groups.data?.pages.flatMap(p => p.data) ?? [],
    [groups.data],
  )

  const allEnvironments = useMemo(
    () => environmentsQuery.data?.pages.flatMap(p => p.data) ?? [],
    [environmentsQuery.data],
  )

  const environments = useMemo(
    () => [...new Set(
      allResources
        .map(r => getEnvironmentName(r))
        .filter((n): n is string => !!n),
    )].sort(),
    [allResources],
  )

  const ownerNames = useOwnerNames(allResources)

  const userCount = useMemo(() => {
    const ids = new Set<string>()
    for (const r of allResources) {
      const owner = getOwnerFromProperties(r)
      if (owner !== '—') ids.add(owner)
    }
    return ids.size
  }, [allResources])

  const envNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const env of allEnvironments) {
      const name = getDisplayName(env)
      m.set(env.id.toLowerCase(), name)
      m.set(env.name.toLowerCase(), name)
      const seg = env.id.split('/').pop()
      if (seg) m.set(seg.toLowerCase(), name)
    }
    return m
  }, [allEnvironments])

  const ENV_IN_PATH_RE = /\/environments\/([^/]+)/i

  const resolveEnvName = (r: typeof allResources[number]): string => {
    if (r.environmentId) {
      const n = envNameById.get(r.environmentId.toLowerCase())
      if (n) return n
    }
    const pathEnv = ENV_IN_PATH_RE.exec(r.id)?.[1]
    if (pathEnv) {
      const n = envNameById.get(pathEnv.toLowerCase())
      if (n) return n
    }
    return getEnvironmentName(r) ?? ''
  }

  const resolveOwnerName = (r: typeof allResources[number]): string => {
    const raw = getOwnerFromProperties(r)
    if (raw === '—') return ''
    if (raw.startsWith(SYSTEM_PREFIX)) return 'system'
    return GUID_RE.test(raw) ? (ownerNames?.get(raw) ?? raw) : raw
  }

  const filtered = useMemo(() => {
    if (DRILLDOWN_TABS.has(filters.resourceTab)) return []
    let items = allResources
    if (filters.resourceTab !== 'all') {
      items = items.filter(r => getResourceCategory(r.type) === filters.resourceTab)
    }
    if (filters.environment) {
      items = items.filter(r => getEnvironmentName(r) === filters.environment)
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      items = items.filter(r => {
        const region = (r.environmentRegion ?? r.location ?? '').toLowerCase()
        return (
          getDisplayName(r).toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          resolveEnvName(r).toLowerCase().includes(q) ||
          resolveOwnerName(r).toLowerCase().includes(q) ||
          region.includes(q) ||
          r.type.toLowerCase().includes(q)
        )
      })
    }
    return items
  }, [allResources, filters, envNameById, ownerNames])

  const isLoadingResources = resources.isLoading && allResources.length === 0
  const isLoadingGroups = groups.isLoading && allGroups.length === 0
  const isRefreshing = resources.isLoading || groups.isLoading
  const lastUpdated = resources.data ? new Date() : null

  return (
    <main className={classes.main}>
      <div className={classes.titleRow}>
        <div>
          <Title2>Resource Inventory</Title2>
          {lastUpdated && (
            <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: '2px' }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
              {allResources.length > 0 && ` · ${allResources.length} resources`}
            </Caption1>
          )}
        </div>
        <Button
          appearance="secondary"
          icon={<ArrowClockwiseRegular className={mergeClasses(isRefreshing && classes.spinning)} />}
          onClick={() => { resources.refetch(); groups.refetch() }}
        >
          Refresh
        </Button>
      </div>

      <StatCards
        resources={allResources}
        groupCount={allGroups.length}
        environmentCount={allEnvironments.length}
        userCount={userCount}
        isLoading={isLoadingResources}
        onTabChange={tab => setFilters(f => ({ ...f, resourceTab: tab }))}
      />

      {resources.error && <ErrorBanner error={resources.error} onRetry={() => resources.refetch()} />}
      {groups.error && <ErrorBanner error={groups.error} onRetry={() => groups.refetch()} />}

      <Filters filters={filters} environments={environments} onChange={setFilters} />

      {filters.resourceTab !== 'groups' && filters.resourceTab !== 'users' && filters.resourceTab !== 'environments' && resources.hasNextPage && (
        <div style={{ textAlign: 'center' }}>
          <Button
            appearance="transparent"
            disabled={resources.isFetchingNextPage}
            onClick={() => resources.fetchNextPage()}
          >
            {resources.isFetchingNextPage
              ? 'Loading more...'
              : `Load more (${allResources.length} loaded so far)`}
          </Button>
        </div>
      )}

      {filters.resourceTab === 'groups' ? (
        <GroupsView
          groups={allGroups}
          environments={allEnvironments}
          allResources={allResources}
          ownerNames={ownerNames}
          isLoading={isLoadingGroups}
        />
      ) : filters.resourceTab === 'users' ? (
        <UsersView
          resources={allResources}
          ownerNames={ownerNames}
          allEnvironments={allEnvironments}
        />
      ) : filters.resourceTab === 'environments' ? (
        <EnvironmentsView
          environments={allEnvironments}
          allResources={allResources}
          ownerNames={ownerNames}
        />
      ) : filters.resourceTab === 'governance' ? (
        <GovernanceView
          allResources={allResources}
          allEnvironments={allEnvironments}
        />
      ) : filters.resourceTab === 'report' ? (
        <ReportView
          allResources={allResources}
          allEnvironments={allEnvironments}
          ownerNames={ownerNames}
        />
      ) : (
        <ResourceTable
          resources={filtered}
          isLoading={isLoadingResources}
          ownerNames={ownerNames}
          allEnvironments={allEnvironments}
        />
      )}
    </main>
  )
}
