import { useState } from 'react'
import { makeStyles, tokens, Tab, TabList, Text } from '@fluentui/react-components'
import { PeopleRegular, ShieldKeyholeRegular } from '@fluentui/react-icons'
import { UsersTab } from './UsersTab'
import { RolesTab } from './RolesTab'

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, flex: 1 },
  header: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  title: { fontSize: '21px', fontWeight: 600, lineHeight: '28px' },
  sub: { fontSize: '13px', color: tokens.colorNeutralForeground3 },
  body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
})

type AdminTab = 'users' | 'roles'

export function AdminConsole() {
  const classes = useClasses()
  const [tab, setTab] = useState<AdminTab>('users')

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <Text className={classes.title}>Admin Console</Text>
        <Text className={classes.sub}>
          Control who can use this app, which pages they see, and whether they're limited to their own records.
        </Text>
      </div>

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as AdminTab)}>
        <Tab value="users" icon={<PeopleRegular />}>Users</Tab>
        <Tab value="roles" icon={<ShieldKeyholeRegular />}>Roles</Tab>
      </TabList>

      <div className={classes.body}>
        {tab === 'users' ? <UsersTab /> : <RolesTab />}
      </div>
    </div>
  )
}
