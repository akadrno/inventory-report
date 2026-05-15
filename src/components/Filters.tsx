import { makeStyles, tokens, TabList, Tab, Input, Dropdown, Option } from '@fluentui/react-components'
import {
  GridRegular,
  AppGenericRegular,
  FlowRegular,
  BotRegular,
  FolderOpenRegular,
  PersonRegular,
  GlobeRegular,
  ShieldRegular,
  DocumentRegular,
  SearchRegular,
} from '@fluentui/react-icons'
import type { ResourceFilters, ResourceTab } from '../types'

const useClasses = makeStyles({
  container: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    overflowX: 'auto',
  },
  rightSection: {
    display: 'flex',
    flex: '1 1 240px',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    minWidth: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
  },
  dropdown: {
    minWidth: '180px',
    flexShrink: 0,
  },
})

const RESOURCE_TABS: { id: ResourceTab; label: string; icon: React.ReactElement }[] = [
  { id: 'report', label: 'Report', icon: <DocumentRegular /> },
  { id: 'all', label: 'All', icon: <GridRegular /> },
  { id: 'apps', label: 'Apps', icon: <AppGenericRegular /> },
  { id: 'flows', label: 'Flows', icon: <FlowRegular /> },
  { id: 'agents', label: 'Agents', icon: <BotRegular /> },
  { id: 'groups', label: 'Groups', icon: <FolderOpenRegular /> },
  { id: 'users', label: 'Users', icon: <PersonRegular /> },
  { id: 'environments', label: 'Environments', icon: <GlobeRegular /> },
  { id: 'governance', label: 'Governance', icon: <ShieldRegular /> },
]

const SEARCH_HIDDEN: ResourceTab[] = ['groups', 'users', 'environments', 'governance', 'report']

interface FiltersProps {
  filters: ResourceFilters
  environments: string[]
  onChange: (filters: ResourceFilters) => void
}

export function Filters({ filters, environments, onChange }: FiltersProps) {
  const classes = useClasses()
  const set = (patch: Partial<ResourceFilters>) => onChange({ ...filters, ...patch })
  const showSearch = !SEARCH_HIDDEN.includes(filters.resourceTab)

  return (
    <div className={classes.container}>
      <TabList
        selectedValue={filters.resourceTab}
        onTabSelect={(_, d) => set({ resourceTab: d.value as ResourceTab })}
      >
        {RESOURCE_TABS.map(tab => (
          <Tab key={tab.id} value={tab.id} icon={tab.icon}>
            {tab.label}
          </Tab>
        ))}
      </TabList>

      {showSearch && (
        <div className={classes.rightSection}>
          <Input
            className={classes.searchInput}
            contentBefore={<SearchRegular />}
            placeholder="Search by name, environment, owner, or region..."
            value={filters.search}
            onChange={(_, d) => set({ search: d.value })}
          />
          {environments.length > 0 && (
            <Dropdown
              className={classes.dropdown}
              placeholder="All Environments"
              value={filters.environment || undefined}
              selectedOptions={filters.environment ? [filters.environment] : []}
              onOptionSelect={(_, d) => set({ environment: (d.optionValue as string) ?? '' })}
            >
              <Option value="">All Environments</Option>
              {environments.map(env => (
                <Option key={env} value={env}>{env}</Option>
              ))}
            </Dropdown>
          )}
        </div>
      )}
    </div>
  )
}
