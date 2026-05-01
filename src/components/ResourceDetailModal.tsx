import { makeStyles, tokens, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, Button, Text, Badge, Caption1 } from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getOwnerFromProperties, getDisplayName } from '../types'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { EnvironmentBadge } from './EnvironmentBadge'

interface ResourceDetailModalProps {
  resource: ResourceItem
  onClose: () => void
}

const useClasses = makeStyles({
  surface: {
    maxWidth: '640px',
    width: '100%',
    maxHeight: '85vh',
  },
  content: {
    overflowY: 'auto',
    maxHeight: '60vh',
  },
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalXS,
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': {
      borderBottom: 'none',
    },
  },
  fieldLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  fieldValue: {
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-all',
  },
  propsBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase100,
    fontFamily: 'Consolas, monospace',
    overflowX: 'auto',
    maxHeight: '192px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    marginTop: tokens.spacingVerticalS,
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
})

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const classes = useClasses()
  if (value == null || value === '') return null
  return (
    <div className={classes.fieldRow}>
      <Text className={classes.fieldLabel}>{label}</Text>
      <Text className={classes.fieldValue}>{value}</Text>
    </div>
  )
}

export function ResourceDetailModal({ resource, onClose }: ResourceDetailModalProps) {
  const classes = useClasses()
  const owner = getOwnerFromProperties(resource)
  const displayName = getDisplayName(resource)

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={classes.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                aria-label="Close"
                onClick={onClose}
              />
            }
          >
            <div>
              {displayName}
              <div className={classes.subtitle}>
                <ResourceTypeBadge type={resource.type} kind={resource.kind} />
                <EnvironmentBadge name={resource.environmentName} type={resource.environmentType} />
              </div>
            </div>
          </DialogTitle>

          <DialogContent className={classes.content}>
            <div>
              <Field label="Owner" value={owner} />
              <Field label="Environment" value={resource.environmentName} />
              <Field label="Environment Type" value={resource.environmentType} />
              <Field label="Region" value={resource.environmentRegion ?? resource.location} />
              <Field label="Resource Type" value={resource.type} />
              <Field label="Environment ID" value={resource.environmentId} />
              <Field label="Resource ID" value={resource.id} />
              <Field
                label="Managed Environment"
                value={resource.isManagedEnvironment != null
                  ? (resource.isManagedEnvironment ? 'Yes' : 'No')
                  : undefined}
              />
              {resource.tags && Object.keys(resource.tags).length > 0 && (
                <div className={classes.fieldRow}>
                  <Text className={classes.fieldLabel}>Tags</Text>
                  <div className={classes.tagList}>
                    {Object.entries(resource.tags).map(([k, v]) => (
                      <Badge key={k} appearance="tint" color="subtle" size="small">
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {resource.properties && Object.keys(resource.properties).length > 0 && (
                <div style={{ marginTop: tokens.spacingVerticalM }}>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Properties</Caption1>
                  <pre className={classes.propsBox}>
                    {JSON.stringify(resource.properties, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
