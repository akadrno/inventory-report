import { useMemo, useState } from 'react'
import {
  makeStyles, tokens, Button, Input, Field, Switch, Checkbox,
  Radio, RadioGroup, Text, Spinner, MessageBar, MessageBarBody,
} from '@fluentui/react-components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PERMISSION_CATALOG } from '../../permissions/catalog'
import { createRole, updateRole } from '../../api/rbacApi'
import type { RecordScope, RoleDefinition } from '../../types/permissions'

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px' },
  flags: { display: 'flex', flexDirection: 'column', gap: '8px' },
  matrix: { display: 'flex', flexDirection: 'column', gap: '14px' },
  group: { border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: '6px', overflow: 'hidden' },
  groupHead: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontWeight: 600,
  },
  leaves: {
    display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '4px 16px', padding: '12px 14px',
  },
  actions: { display: 'flex', gap: '8px', paddingTop: '8px' },
  sectionLabel: { fontSize: '13px', fontWeight: 600, color: tokens.colorNeutralForeground2 },
})

interface RoleEditorProps {
  role: RoleDefinition | null // null = new role
  onClose: () => void
}

const NEW_DRAFT = {
  name: '',
  allowedKeys: [] as string[],
  isAppAdmin: false,
  canManageUsers: false,
  recordScope: 'all' as RecordScope,
}

export function RoleEditor({ role, onClose }: RoleEditorProps) {
  const classes = useClasses()
  const queryClient = useQueryClient()
  const readOnly = !!role?.isPredefined

  const [name, setName] = useState(role?.name ?? NEW_DRAFT.name)
  const [keys, setKeys] = useState<Set<string>>(new Set(role?.allowedKeys ?? NEW_DRAFT.allowedKeys))
  const [isAppAdmin, setIsAppAdmin] = useState(role?.isAppAdmin ?? NEW_DRAFT.isAppAdmin)
  const [canManageUsers, setCanManageUsers] = useState(role?.canManageUsers ?? NEW_DRAFT.canManageUsers)
  const [recordScope, setRecordScope] = useState<RecordScope>(role?.recordScope ?? NEW_DRAFT.recordScope)

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), allowedKeys: [...keys], isAppAdmin, canManageUsers, recordScope }
      return role && !role.isPredefined
        ? updateRole({ ...role, ...payload })
        : createRole(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      onClose()
    },
  })

  const toggleLeaf = (key: string, on: boolean) =>
    setKeys(prev => {
      const next = new Set(prev)
      if (on) next.add(key); else next.delete(key)
      return next
    })

  const setGroup = (railKeys: string[], on: boolean) =>
    setKeys(prev => {
      const next = new Set(prev)
      for (const k of railKeys) { if (on) next.add(k); else next.delete(k) }
      return next
    })

  const canSave = name.trim().length > 0 && !readOnly && !mutation.isPending

  const groupStates = useMemo(() => PERMISSION_CATALOG.map(rail => {
    const railKeys = rail.subs.map(s => s.key)
    const selected = railKeys.filter(k => keys.has(k)).length
    const checked: boolean | 'mixed' = selected === 0 ? false : selected === railKeys.length ? true : 'mixed'
    return { rail, railKeys, checked }
  }), [keys])

  return (
    <div className={classes.root}>
      {readOnly && (
        <MessageBar intent="info">
          <MessageBarBody>This is a predefined role and can't be edited. Create a custom role to tailor access.</MessageBarBody>
        </MessageBar>
      )}

      <Field label="Role name" required>
        <Input value={name} disabled={readOnly} onChange={(_, d) => setName(d.value)} placeholder="e.g. Inventory Reviewer" />
      </Field>

      <div className={classes.flags}>
        <Text className={classes.sectionLabel}>Capabilities</Text>
        <Switch checked={isAppAdmin} disabled={readOnly} onChange={(_, d) => setIsAppAdmin(d.checked)}
          label="App administrator — full access and can manage roles & users" />
        <Switch checked={canManageUsers} disabled={readOnly} onChange={(_, d) => setCanManageUsers(d.checked)}
          label="Can manage users — add/remove people and assign roles" />
      </div>

      <Field label="Record visibility">
        <RadioGroup value={recordScope} disabled={readOnly} onChange={(_, d) => setRecordScope(d.value as RecordScope)}>
          <Radio value="all" label="All records across the tenant" />
          <Radio value="own" label="Only records the user owns or is shared on" />
        </RadioGroup>
      </Field>

      <div>
        <Text className={classes.sectionLabel}>Page access</Text>
        <div className={classes.matrix} style={{ marginTop: 8 }}>
          {groupStates.map(({ rail, railKeys, checked }) => (
            <div key={rail.rail} className={classes.group}>
              <div className={classes.groupHead}>
                <Checkbox
                  checked={checked}
                  disabled={readOnly}
                  onChange={(_, d) => setGroup(railKeys, !!d.checked)}
                  label={rail.label}
                />
              </div>
              <div className={classes.leaves}>
                {rail.subs.map(sub => (
                  <Checkbox
                    key={sub.key}
                    checked={keys.has(sub.key)}
                    disabled={readOnly}
                    onChange={(_, d) => toggleLeaf(sub.key, !!d.checked)}
                    label={sub.label}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {mutation.isError && (
        <MessageBar intent="error">
          <MessageBarBody>{(mutation.error as Error).message}</MessageBarBody>
        </MessageBar>
      )}

      <div className={classes.actions}>
        <Button appearance="primary" disabled={!canSave} onClick={() => mutation.mutate()}>
          {mutation.isPending ? <Spinner size="tiny" /> : role && !role.isPredefined ? 'Save changes' : 'Create role'}
        </Button>
        <Button appearance="secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
      </div>
    </div>
  )
}
