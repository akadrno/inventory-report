import { useState } from 'react'
import { makeStyles, tokens, Text, Button, Badge, Caption1 } from '@fluentui/react-components'
import {
  DismissRegular,
  DeleteRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  TimerRegular,
} from '@fluentui/react-icons'
import { useDebug, type DebugEntry } from '../context/DebugContext'

const useClasses = makeStyles({
  panel: {
    position: 'fixed',
    insetBlock: 0,
    right: 0,
    zIndex: 200,
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorNeutralStroke2,
    boxShadow: tokens.shadow64,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  panelHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  panelHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  configBar: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorPaletteRoyalBlueBackground2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  configText: {
    color: tokens.colorPaletteRoyalBlueForeground2,
    fontSize: tokens.fontSizeBase100,
  },
  entriesList: {
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  emptyState: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    paddingTop: tokens.spacingVerticalXXL,
  },
  entryCard: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  entryCardError: {
    border: `1px solid ${tokens.colorPaletteRedBorder2}`,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  entryHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    minWidth: 0,
  },
  entryHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
    marginLeft: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
  entryBody: {
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
  },
  entrySection: {
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    ':last-child': { borderBottom: 'none' },
  },
  sectionLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: '2px',
  },
  monoText: {
    fontFamily: 'Consolas, monospace',
    fontSize: tokens.fontSizeBase100,
    wordBreak: 'break-all',
  },
  prePre: {
    fontFamily: 'Consolas, monospace',
    fontSize: tokens.fontSizeBase100,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalXS,
    overflowX: 'auto',
    maxHeight: '160px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    margin: 0,
  },
})

function StatusBadge({ status, error }: { status?: number; error?: string }) {
  if (error && !status) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: tokens.colorPaletteRedForeground3, fontSize: tokens.fontSizeBase100 }}>
        <DismissCircleRegular fontSize={14} /> Network error
      </span>
    )
  }
  if (!status) return null
  const ok = status >= 200 && status < 300
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: ok ? tokens.colorPaletteGreenForeground3 : tokens.colorPaletteRedForeground3, fontSize: tokens.fontSizeBase100 }}>
      {ok ? <CheckmarkCircleRegular fontSize={14} /> : <DismissCircleRegular fontSize={14} />}
      {status}
    </span>
  )
}

function EntryRow({ entry }: { entry: DebugEntry }) {
  const [expanded, setExpanded] = useState(false)
  const classes = useClasses()
  const isError = !!entry.error || (entry.status !== undefined && entry.status >= 400)

  let parsedResponse: unknown = null
  try {
    if (entry.responseBody) parsedResponse = JSON.parse(entry.responseBody)
  } catch {
    parsedResponse = entry.responseBody
  }

  return (
    <div className={`${classes.entryCard} ${isError ? classes.entryCardError : ''}`}>
      <div
        className={classes.entryHeader}
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(x => !x)}
      >
        <div className={classes.entryHeaderLeft}>
          {expanded
            ? <ChevronDownRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
            : <ChevronRightRegular fontSize={14} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />}
          <StatusBadge status={entry.status} error={entry.error} />
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {entry.timestamp.toLocaleTimeString()}
          </Caption1>
        </div>
        <div className={classes.entryHeaderRight}>
          <TimerRegular fontSize={12} />
          <span>{entry.durationMs}ms</span>
        </div>
      </div>

      {expanded && (
        <div className={classes.entryBody}>
          {entry.error && (
            <div className={classes.entrySection}>
              <div className={classes.sectionLabel} style={{ color: tokens.colorPaletteRedForeground3 }}>Error</div>
              <Text className={classes.monoText} style={{ color: tokens.colorPaletteRedForeground3 }}>{entry.error}</Text>
            </div>
          )}
          <div className={classes.entrySection}>
            <div className={classes.sectionLabel}>Request URL</div>
            <Text className={classes.monoText}>{entry.requestUrl}</Text>
          </div>
          <div className={classes.entrySection}>
            <div className={classes.sectionLabel}>Request Body</div>
            <pre className={classes.prePre}>{JSON.stringify(entry.requestBody, null, 2)}</pre>
          </div>
          {entry.responseBody && (
            <div className={classes.entrySection}>
              <div className={classes.sectionLabel}>
                Response {entry.status !== undefined ? `(${entry.status})` : ''}
              </div>
              <pre className={classes.prePre}>
                {typeof parsedResponse === 'string'
                  ? parsedResponse
                  : JSON.stringify(parsedResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DebugPanel() {
  const { entries, clear, setIsOpen, unknownTypes } = useDebug()
  const classes = useClasses()
  const errorCount = entries.filter(e => e.error || (e.status !== undefined && e.status >= 400)).length

  return (
    <div className={classes.panel}>
      <div className={classes.panelHeader}>
        <div className={classes.panelHeaderLeft}>
          <Text weight="semibold" size={200}>Debug Panel</Text>
          {errorCount > 0 && (
            <Badge color="danger" size="small">{errorCount}</Badge>
          )}
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {entries.length} request{entries.length !== 1 ? 's' : ''}
          </Caption1>
        </div>
        <div className={classes.panelHeaderRight}>
          <Button
            appearance="subtle"
            icon={<DeleteRegular />}
            size="small"
            onClick={clear}
          >
            Clear
          </Button>
          <Button
            appearance="subtle"
            icon={<DismissRegular />}
            size="small"
            onClick={() => setIsOpen(false)}
            aria-label="Close debug panel"
          />
        </div>
      </div>

      <div className={classes.configBar}>
        <div className={classes.configText}>
          <strong>Client ID:</strong> {import.meta.env.VITE_CLIENT_ID || '⚠ not set'}
        </div>
        <div className={classes.configText}>
          <strong>Tenant:</strong> {import.meta.env.VITE_TENANT_ID || '⚠ not set'}
        </div>
        <div className={classes.configText}>
          <strong>Unknown inventory types:</strong> {unknownTypes.length}
        </div>
      </div>

      {unknownTypes.length > 0 && (
        <div className={classes.entrySection} style={{ margin: tokens.spacingVerticalXS }}>
          <div className={classes.sectionLabel} style={{ color: tokens.colorStatusWarningForeground1 }}>
            New resource types not mapped in UI
          </div>
          <pre className={classes.prePre}>{unknownTypes.join('\n')}</pre>
        </div>
      )}

      <div className={classes.entriesList}>
        {entries.length === 0 ? (
          <div className={classes.emptyState}>
            <Caption1>No API requests yet. Requests will appear here as the app fetches data.</Caption1>
          </div>
        ) : (
          entries.map(entry => <EntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  )
}
