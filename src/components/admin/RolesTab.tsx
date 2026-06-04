import { useState } from 'react'
import {
  makeStyles, tokens, Button, Spinner, Text, Badge, MessageBar, MessageBarBody,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent,
} from '@fluentui/react-components'
import { AddRegular, DeleteRegular, EditRegular } from '@fluentui/react-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteRole, listRoles } from '../../api/rbacApi'
import { PREDEFINED_ROLES } from '../../permissions/catalog'
import type { RoleDefinition } from '../../types/permissions'
import { RoleEditor } from './RoleEditor'

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '12px' },
  toolbar: { display: 'flex', justifyContent: 'flex-end' },
  list: { display: 'flex', flexDirection: 'column', gap: '6px' },
  row: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  rowMain: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 },
  name: { fontWeight: 600 },
  meta: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  rowActions: { display: 'flex', gap: '4px' },
})

function summarize(role: RoleDefinition): string {
  const parts: string[] = []
  if (role.isAppAdmin) parts.push('App admin')
  if (role.canManageUsers) parts.push('Manages users')
  parts.push(role.recordScope === 'own' ? 'Own records only' : 'All records')
  parts.push(`${role.allowedKeys.length} page${role.allowedKeys.length === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

export function RolesTab() {
  const classes = useClasses()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<RoleDefinition | null | undefined>(undefined) // undefined = closed, null = new
  const [confirmDelete, setConfirmDelete] = useState<RoleDefinition | null>(null)

  // Fall back to the bundled predefined roles if the backend isn't reachable yet,
  // so the tab is never empty.
  const query = useQuery<RoleDefinition[], Error>({
    queryKey: ['admin-roles'],
    queryFn: ({ signal }) => listRoles(signal),
    retry: false,
    staleTime: 60 * 1000,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setConfirmDelete(null)
    },
  })

  const roles = query.data ?? (query.isError ? PREDEFINED_ROLES : undefined)

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <Button appearance="primary" icon={<AddRegular />} onClick={() => setEditing(null)}>New role</Button>
      </div>

      {query.isError && (
        <MessageBar intent="warning">
          <MessageBarBody>Couldn't reach the backend; showing built-in roles only.</MessageBarBody>
        </MessageBar>
      )}

      {!roles ? (
        <Spinner size="small" label="Loading roles…" />
      ) : (
        <div className={classes.list}>
          {roles.map(role => (
            <div key={role.id} className={classes.row}>
              <div className={classes.rowMain}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text className={classes.name}>{role.name}</Text>
                  {role.isPredefined && <Badge appearance="tint" color="informative" size="small">Built-in</Badge>}
                </div>
                <Text className={classes.meta}>{summarize(role)}</Text>
              </div>
              <div className={classes.rowActions}>
                <Button
                  appearance="subtle" size="small"
                  icon={<EditRegular />}
                  onClick={() => setEditing(role)}
                >
                  {role.isPredefined ? 'View' : 'Edit'}
                </Button>
                {!role.isPredefined && (
                  <Button
                    appearance="subtle" size="small"
                    icon={<DeleteRegular />}
                    onClick={() => setConfirmDelete(role)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role editor dialog */}
      <Dialog open={editing !== undefined} onOpenChange={(_, d) => { if (!d.open) setEditing(undefined) }}>
        <DialogSurface style={{ maxWidth: '760px' }}>
          <DialogBody>
            <DialogTitle>{editing == null ? 'New role' : editing.isPredefined ? editing.name : `Edit ${editing.name}`}</DialogTitle>
            <DialogContent>
              {editing !== undefined && (
                <RoleEditor role={editing} onClose={() => setEditing(undefined)} />
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(_, d) => { if (!d.open) setConfirmDelete(null) }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete role</DialogTitle>
            <DialogContent>
              <Text>
                Delete <strong>{confirmDelete?.name}</strong>? Users assigned only this role will lose their access.
              </Text>
              {removeMutation.isError && (
                <MessageBar intent="error" style={{ marginTop: 12 }}>
                  <MessageBarBody>{(removeMutation.error as Error).message}</MessageBarBody>
                </MessageBar>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <Button appearance="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button appearance="primary" disabled={removeMutation.isPending}
                  onClick={() => confirmDelete && removeMutation.mutate(confirmDelete.id)}>
                  {removeMutation.isPending ? <Spinner size="tiny" /> : 'Delete'}
                </Button>
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
