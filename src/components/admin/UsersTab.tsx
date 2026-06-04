import { useState } from 'react'
import {
  makeStyles, tokens, Button, Spinner, Text, Badge, Avatar,
  MessageBar, MessageBarBody,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent,
} from '@fluentui/react-components'
import { AddRegular, DeleteRegular, PersonRegular } from '@fluentui/react-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAssignment, listAssignments } from '../../api/rbacApi'
import type { Assignment } from '../../types/permissions'
import { AddUserDialog } from './AddUserDialog'

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '12px' },
  toolbar: { display: 'flex', justifyContent: 'flex-end' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  td: { padding: '10px 12px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, verticalAlign: 'middle' },
  person: { display: 'flex', alignItems: 'center', gap: '10px' },
  personText: { display: 'flex', flexDirection: 'column' },
  upn: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    padding: '40px 0', color: tokens.colorNeutralForeground3,
  },
})

export function UsersTab() {
  const classes = useClasses()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<Assignment | null>(null)

  const query = useQuery<Assignment[], Error>({
    queryKey: ['admin-assignments'],
    queryFn: ({ signal }) => listAssignments(signal),
    retry: false,
    staleTime: 30 * 1000,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
      setConfirmRemove(null)
    },
  })

  const assignments = query.data ?? []

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <Button appearance="primary" icon={<AddRegular />} onClick={() => setAddOpen(true)}>Add user</Button>
      </div>

      {query.isError && (
        <MessageBar intent="error"><MessageBarBody>Couldn't load users: {query.error.message}</MessageBarBody></MessageBar>
      )}

      {query.isLoading ? (
        <Spinner size="small" label="Loading users…" />
      ) : assignments.length === 0 ? (
        <div className={classes.empty}>
          <PersonRegular fontSize={32} />
          <Text>No users assigned yet. Tenant admins always have access; add others here.</Text>
        </div>
      ) : (
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.th}>User</th>
              <th className={classes.th}>Role</th>
              <th className={classes.th} style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id}>
                <td className={classes.td}>
                  <div className={classes.person}>
                    <Avatar name={a.principalName} size={28} />
                    <div className={classes.personText}>
                      <Text weight="semibold">{a.principalName || a.principalUpn}</Text>
                      <Text className={classes.upn}>{a.principalUpn}</Text>
                    </div>
                  </div>
                </td>
                <td className={classes.td}><Badge appearance="tint" color="brand">{a.roleName}</Badge></td>
                <td className={classes.td}>
                  <Button appearance="subtle" size="small" icon={<DeleteRegular />}
                    onClick={() => setConfirmRemove(a)} aria-label="Remove user" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <Dialog open={!!confirmRemove} onOpenChange={(_, d) => { if (!d.open) setConfirmRemove(null) }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Remove access</DialogTitle>
            <DialogContent>
              <Text>
                Remove <strong>{confirmRemove?.principalName || confirmRemove?.principalUpn}</strong> from the app?
                They'll lose access unless they hold a tenant admin role.
              </Text>
              {removeMutation.isError && (
                <MessageBar intent="error" style={{ marginTop: 12 }}>
                  <MessageBarBody>{(removeMutation.error as Error).message}</MessageBarBody>
                </MessageBar>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <Button appearance="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Button>
                <Button appearance="primary" disabled={removeMutation.isPending}
                  onClick={() => confirmRemove && removeMutation.mutate(confirmRemove.id)}>
                  {removeMutation.isPending ? <Spinner size="tiny" /> : 'Remove'}
                </Button>
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
