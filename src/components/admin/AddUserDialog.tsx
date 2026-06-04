import { useState } from 'react'
import {
  makeStyles, tokens, Button, Spinner, Text, Field,
  Combobox, Option, Dropdown, MessageBar, MessageBarBody,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent,
} from '@fluentui/react-components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAssignment, listRoles, searchDirectory } from '../../api/rbacApi'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { DirectoryUser, RoleDefinition } from '../../types/permissions'

const useClasses = makeStyles({
  picked: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    padding: '8px 12px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  pickedName: { fontWeight: 600 },
  pickedUpn: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  actions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' },
})

interface AddUserDialogProps {
  open: boolean
  onClose: () => void
}

export function AddUserDialog({ open, onClose }: AddUserDialogProps) {
  const classes = useClasses()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<DirectoryUser | null>(null)
  const [roleId, setRoleId] = useState<string>('')
  const [roleName, setRoleName] = useState<string>('')

  const debounced = useDebouncedValue(query, 300)

  const search = useQuery<DirectoryUser[], Error>({
    queryKey: ['directory-search', debounced],
    queryFn: ({ signal }) => searchDirectory(debounced, signal),
    enabled: open && debounced.trim().length >= 2 && !picked,
    staleTime: 60 * 1000,
    retry: false,
  })

  const rolesQuery = useQuery<RoleDefinition[], Error>({
    queryKey: ['admin-roles'],
    queryFn: ({ signal }) => listRoles(signal),
    enabled: open,
    retry: false,
    staleTime: 60 * 1000,
  })

  const addMutation = useMutation({
    mutationFn: () => createAssignment({ principalId: picked!.id, roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
      reset()
      onClose()
    },
  })

  function reset() {
    setQuery(''); setPicked(null); setRoleId(''); setRoleName('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  const results = search.data ?? []

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) handleClose() }}>
      <DialogSurface style={{ maxWidth: '520px' }}>
        <DialogBody>
          <DialogTitle>Add user</DialogTitle>
          <DialogContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Person" hint="Search your directory by name or email">
                {picked ? (
                  <div className={classes.picked}>
                    <Text className={classes.pickedName}>{picked.displayName}</Text>
                    <Text className={classes.pickedUpn}>{picked.userPrincipalName}</Text>
                    <div>
                      <Button appearance="subtle" size="small" onClick={() => { setPicked(null); setQuery('') }}>
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Combobox
                    placeholder="Start typing a name or email…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onOptionSelect={(_, d) => {
                      const u = results.find(r => r.id === d.optionValue)
                      if (u) { setPicked(u); setQuery(u.displayName) }
                    }}
                    freeform
                  >
                    {search.isLoading && <Option value="__loading" disabled text="Searching…">Searching…</Option>}
                    {!search.isLoading && debounced.trim().length >= 2 && results.length === 0 && (
                      <Option value="__none" disabled text="No matches">No matches</Option>
                    )}
                    {results.map(u => (
                      <Option key={u.id} value={u.id} text={u.displayName}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{u.displayName}</span>
                          <span style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>{u.userPrincipalName}</span>
                        </div>
                      </Option>
                    ))}
                  </Combobox>
                )}
              </Field>

              <Field label="Role" required>
                <Dropdown
                  placeholder="Select a role"
                  selectedOptions={roleId ? [roleId] : []}
                  value={roleName}
                  onOptionSelect={(_, d) => {
                    setRoleId(d.optionValue ?? '')
                    setRoleName(d.optionText ?? '')
                  }}
                >
                  {(rolesQuery.data ?? []).map(r => (
                    <Option key={r.id} value={r.id} text={r.name}>{r.name}</Option>
                  ))}
                </Dropdown>
              </Field>

              {search.isError && (
                <MessageBar intent="error"><MessageBarBody>Directory search failed: {search.error.message}</MessageBarBody></MessageBar>
              )}
              {addMutation.isError && (
                <MessageBar intent="error"><MessageBarBody>{(addMutation.error as Error).message}</MessageBarBody></MessageBar>
              )}

              <div className={classes.actions}>
                <Button appearance="secondary" onClick={handleClose}>Cancel</Button>
                <Button appearance="primary" disabled={!picked || !roleId || addMutation.isPending}
                  onClick={() => addMutation.mutate()}>
                  {addMutation.isPending ? <Spinner size="tiny" /> : 'Add user'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
