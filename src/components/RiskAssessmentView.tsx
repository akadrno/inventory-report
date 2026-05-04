import { useState, useMemo, useRef, useCallback } from 'react'
import {
  makeStyles, Text, Caption1, Badge, Button, Input, Spinner,
  Dialog, DialogSurface, DialogTitle, DialogBody,
  DialogActions, DialogContent, Textarea,
  OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, DrawerFooter,
  Divider,
} from '@fluentui/react-components'
import {
  ShieldRegular,
  ErrorCircleRegular,
  WarningRegular,
  CheckmarkCircleRegular,
  SearchRegular,
  PersonRegular,
  InfoRegular,
  DismissRegular,
  CalendarRegular,
  NoteRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getDisplayName, getOwnerFromProperties, getResourceCategory } from '../types'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'
import { useAdminData, type ResourceAssessment, type RiskLevel, type ComplianceStatus } from '../hooks/useAdminData'
import { generateDemoAssessments } from '../utils/seedDemoAssessments'
import { GUID_RE, SYSTEM_PREFIX, isSystemResource } from '../hooks/useOwnerNames'
import { fetchAppPermissions, type AppPermission } from '../api/sharingApi'

interface RiskAssessmentViewProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  ownerNames: Map<string, string>
  currentUser: string
}

function resolveOwner(raw: string, ownerNames: Map<string, string>): string {
  if (raw === '—') return '—'
  if (raw.startsWith(SYSTEM_PREFIX)) return 'System'
  return GUID_RE.test(raw) ? (ownerNames.get(raw) ?? raw) : raw
}

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string }> = {
  Critical: { color: '#c50f1f', bg: '#fde7e9' },
  High:     { color: '#e17800', bg: '#fff4ce' },
  Medium:   { color: '#8764b8', bg: '#f0ebf8' },
  Low:      { color: '#107c10', bg: '#dff6dd' },
  None:     { color: '#616161', bg: '#f3f2f1' },
}

const COMPLIANCE_CONFIG: Record<ComplianceStatus, { color: string; bg: string }> = {
  'Not Reviewed':  { color: '#616161', bg: '#f3f2f1' },
  'In Review':     { color: '#004578', bg: '#cfe4fa' },
  'Compliant':     { color: '#107c10', bg: '#dff6dd' },
  'Non-Compliant': { color: '#c50f1f', bg: '#fde7e9' },
  'Exempted':      { color: '#e17800', bg: '#fff4ce' },
}

const RISK_LEVELS: RiskLevel[] = ['None', 'Low', 'Medium', 'High', 'Critical']
const COMPLIANCE_STATUSES: ComplianceStatus[] = ['Not Reviewed', 'In Review', 'Compliant', 'Non-Compliant', 'Exempted']

type RiskFilter = Exclude<RiskLevel, 'None'> | 'All' | 'NotAssessed'

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '20px' },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '12px',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #edebe9',
    borderRadius: '4px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    ':hover': { boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #edebe9',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px 10px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#edebe9',
    fontSize: '14px',
    fontWeight: 600,
    color: '#323130',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 16px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '11px',
    color: '#605e5c',
    backgroundColor: '#faf9f8',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#edebe9',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  td: {
    padding: '10px 16px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#edebe9',
    verticalAlign: 'middle',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '14px',
  },
  toggleGroup: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
})

function RiskBadge({ level }: { level: RiskLevel }) {
  const c = RISK_CONFIG[level]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '10px',
      fontSize: '11px', fontWeight: 600,
      color: c.color, backgroundColor: c.bg,
    }}>
      {level}
    </span>
  )
}

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const c = COMPLIANCE_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '10px',
      fontSize: '11px', fontWeight: 600,
      color: c.color, backgroundColor: c.bg,
    }}>
      {status}
    </span>
  )
}

function ResourceTypeIcon({ type }: { type: string }) {
  const cat = getResourceCategory(type)
  if (cat === 'apps') return <PowerAppsIcon fontSize={14} />
  if (cat === 'flows') return <PowerAutomateIcon fontSize={14} />
  if (cat === 'agents') return <CopilotStudioIcon fontSize={14} />
  return null
}

function AssessmentSidePanel({
  resource,
  assessment,
  ownerNames,
  onClose,
  onEdit,
}: {
  resource: ResourceItem
  assessment: ResourceAssessment | undefined
  ownerNames: Map<string, string>
  onClose: () => void
  onEdit: () => void
}) {
  const ownerRaw = getOwnerFromProperties(resource)
  const owner = resolveOwner(ownerRaw, ownerNames)

  return (
    <OverlayDrawer open position="end" size="medium" onOpenChange={(_, d) => { if (!d.open) onClose() }}>
      <DrawerHeader style={{ borderBottom: '1px solid #edebe9', paddingBottom: '12px' }}>
        <DrawerHeaderTitle
          action={
            <Button appearance="subtle" icon={<DismissRegular />} aria-label="Close" onClick={onClose} />
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ flexShrink: 0 }}><ResourceTypeIcon type={resource.type} /></span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '16px', fontWeight: 600 }}>
              {getDisplayName(resource)}
            </span>
          </div>
        </DrawerHeaderTitle>
        <Caption1 style={{ color: '#737373', marginTop: '4px', paddingLeft: '4px' }}>
          {resource.type.split('/').pop()}
          {owner !== '—' ? ` · ${owner}` : ''}
        </Caption1>
      </DrawerHeader>

      <DrawerBody style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Badges row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div>
            <Caption1 style={{ color: '#737373', display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Risk Level</Caption1>
            <RiskBadge level={assessment?.riskLevel ?? 'None'} />
          </div>
          <div style={{ width: '1px', backgroundColor: '#edebe9', margin: '0 4px' }} />
          <div>
            <Caption1 style={{ color: '#737373', display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Compliance</Caption1>
            <ComplianceBadge status={assessment?.complianceStatus ?? 'Not Reviewed'} />
          </div>
        </div>

        <Divider />

        {assessment ? (
          <>
            {assessment.riskNotes && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <ShieldRegular fontSize={14} style={{ color: '#605e5c' }} />
                  <Text style={{ fontSize: '12px', fontWeight: 600, color: '#323130' }}>Risk Notes</Text>
                </div>
                <Text style={{ fontSize: '13px', color: '#323130', lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{assessment.riskNotes}</Text>
              </div>
            )}

            {assessment.notes && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <NoteRegular fontSize={14} style={{ color: '#605e5c' }} />
                  <Text style={{ fontSize: '12px', fontWeight: 600, color: '#323130' }}>Admin Notes</Text>
                </div>
                <Text style={{ fontSize: '13px', color: '#323130', lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{assessment.notes}</Text>
              </div>
            )}

            <Divider />

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {assessment.lastUpdated && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <CalendarRegular fontSize={14} style={{ color: '#605e5c' }} />
                    <Caption1 style={{ fontWeight: 600, color: '#605e5c', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Last Reviewed</Caption1>
                  </div>
                  <Text style={{ fontSize: '13px', color: '#323130' }}>{new Date(assessment.lastUpdated).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
                </div>
              )}
              {assessment.updatedBy && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <PersonRegular fontSize={14} style={{ color: '#605e5c' }} />
                    <Caption1 style={{ fontWeight: 600, color: '#605e5c', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Reviewed By</Caption1>
                  </div>
                  <Text style={{ fontSize: '13px', color: '#323130' }}>{assessment.updatedBy}</Text>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '24px 0', color: '#737373' }}>
            <ShieldRegular fontSize={32} />
            <Text style={{ fontSize: '13px', color: '#737373' }}>No assessment recorded for this resource.</Text>
          </div>
        )}
      </DrawerBody>

      <DrawerFooter style={{ borderTop: '1px solid #edebe9', padding: '12px 20px', display: 'flex', gap: '8px' }}>
        <Button appearance="primary" onClick={onEdit}>
          {assessment ? 'Edit Assessment' : 'Add Assessment'}
        </Button>
        <Button appearance="secondary" onClick={onClose}>Close</Button>
      </DrawerFooter>
    </OverlayDrawer>
  )
}

interface EditForm {
  riskLevel: RiskLevel
  complianceStatus: ComplianceStatus
  riskNotes: string
  notes: string
}

function AssessmentDialog({
  resource,
  existing,
  currentUser,
  ownerNames,
  onSave,
  onClose,
}: {
  resource: ResourceItem
  existing: ResourceAssessment | undefined
  currentUser: string
  ownerNames: Map<string, string>
  onSave: (a: ResourceAssessment) => void
  onClose: () => void
}) {
  const classes = useClasses()
  const [form, setForm] = useState<EditForm>({
    riskLevel: existing?.riskLevel ?? 'None',
    complianceStatus: existing?.complianceStatus ?? 'Not Reviewed',
    riskNotes: existing?.riskNotes ?? '',
    notes: existing?.notes ?? '',
  })
  const [sharing, setSharing] = useState<AppPermission[] | null>(null)
  const [loadingSharing, setLoadingSharing] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const isApp = getResourceCategory(resource.type) === 'apps'
  const ownerRaw = getOwnerFromProperties(resource)

  const loadSharing = useCallback(async () => {
    setLoadingSharing(true)
    try {
      const perms = await fetchAppPermissions(resource.name)
      setSharing(perms)
    } catch {
      setSharing([])
    } finally {
      setLoadingSharing(false)
    }
  }, [resource.name])

  const handleSave = () => {
    setSubmitAttempted(true)
    if (
      form.riskLevel === 'None' ||
      form.complianceStatus === 'Not Reviewed' ||
      !form.riskNotes.trim() ||
      !form.notes.trim()
    ) return
    onSave({
      resourceId: resource.id,
      riskLevel: form.riskLevel,
      complianceStatus: form.complianceStatus,
      riskNotes: form.riskNotes,
      notes: form.notes,
      lastUpdated: new Date().toISOString(),
      updatedBy: currentUser,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose() }}>
      <DialogSurface style={{ maxWidth: '560px', width: '100%' }}>
        <DialogBody>
          <DialogTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ResourceTypeIcon type={resource.type} />
              <span style={{ fontSize: '16px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getDisplayName(resource)}
              </span>
            </div>
          </DialogTitle>
          <DialogContent>
            <div style={{ fontSize: '12px', color: '#737373', marginBottom: '16px' }}>
              {resource.type.split('/').pop()} · {resolveOwner(ownerRaw, ownerNames)}
            </div>

            <div className={classes.formField}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: '#323130' }}>Risk Level <span style={{ color: '#c50f1f' }}>*</span></Text>
              <div className={classes.toggleGroup}>
                {RISK_LEVELS.map(level => {
                  const active = form.riskLevel === level
                  const c = RISK_CONFIG[level]
                  return (
                    <button
                      key={level}
                      onClick={() => setForm(f => ({ ...f, riskLevel: level }))}
                      style={{
                        padding: '4px 12px', borderRadius: '10px', fontSize: '12px',
                        fontWeight: active ? 700 : 400, cursor: 'pointer',
                        border: `2px solid ${active ? c.color : '#edebe9'}`,
                        backgroundColor: active ? c.bg : '#ffffff',
                        color: active ? c.color : '#323130',
                        transition: 'all 0.1s',
                      }}
                    >
                      {level}
                    </button>
                  )
                })}
              </div>
              {submitAttempted && form.riskLevel === 'None' && (
                <Caption1 style={{ color: '#c50f1f', display: 'block', marginTop: '4px' }}>Select a risk level</Caption1>
              )}
            </div>

            <div className={classes.formField}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: '#323130' }}>Compliance Status <span style={{ color: '#c50f1f' }}>*</span></Text>
              <div className={classes.toggleGroup}>
                {COMPLIANCE_STATUSES.map(status => {
                  const active = form.complianceStatus === status
                  const c = COMPLIANCE_CONFIG[status]
                  return (
                    <button
                      key={status}
                      onClick={() => setForm(f => ({ ...f, complianceStatus: status }))}
                      style={{
                        padding: '4px 10px', borderRadius: '10px', fontSize: '11px',
                        fontWeight: active ? 700 : 400, cursor: 'pointer',
                        border: `2px solid ${active ? c.color : '#edebe9'}`,
                        backgroundColor: active ? c.bg : '#ffffff',
                        color: active ? c.color : '#323130',
                        transition: 'all 0.1s',
                      }}
                    >
                      {status}
                    </button>
                  )
                })}
              </div>
              {submitAttempted && form.complianceStatus === 'Not Reviewed' && (
                <Caption1 style={{ color: '#c50f1f', display: 'block', marginTop: '4px' }}>Select a compliance status</Caption1>
              )}
            </div>

            <div className={classes.formField}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: '#323130' }}>Risk Notes <span style={{ color: '#c50f1f' }}>*</span></Text>
              <Textarea
                value={form.riskNotes}
                onChange={(_, d) => setForm(f => ({ ...f, riskNotes: d.value }))}
                placeholder="Document specific risk findings, vulnerabilities, or compliance gaps…"
                resize="vertical"
                rows={3}
              />
              {submitAttempted && !form.riskNotes.trim() && (
                <Caption1 style={{ color: '#c50f1f', display: 'block', marginTop: '4px' }}>Risk notes are required</Caption1>
              )}
            </div>

            <div className={classes.formField} style={{ marginBottom: isApp ? '14px' : 0 }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: '#323130' }}>Admin Notes <span style={{ color: '#c50f1f' }}>*</span></Text>
              <Textarea
                value={form.notes}
                onChange={(_, d) => setForm(f => ({ ...f, notes: d.value }))}
                placeholder="General notes, remediation steps, or context for this resource…"
                resize="vertical"
                rows={3}
              />
              {submitAttempted && !form.notes.trim() && (
                <Caption1 style={{ color: '#c50f1f', display: 'block', marginTop: '4px' }}>Admin notes are required</Caption1>
              )}
            </div>

            {isApp && (
              <div style={{ borderTop: '1px solid #edebe9', paddingTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Text style={{ fontSize: '12px', fontWeight: 600, color: '#323130' }}>App Sharing</Text>
                  {sharing === null && (
                    <Button size="small" appearance="subtle" onClick={loadSharing} disabled={loadingSharing}>
                      {loadingSharing ? 'Loading…' : 'Load permissions'}
                    </Button>
                  )}
                </div>
                {sharing !== null && sharing.length === 0 && (
                  <Caption1 style={{ color: '#737373' }}>No sharing permissions found, or permissions API unavailable for this app.</Caption1>
                )}
                {sharing !== null && sharing.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sharing.slice(0, 12).map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <PersonRegular fontSize={12} style={{ color: '#605e5c', flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#242424' }}>
                          {p.principalDisplayName || p.principalEmail || p.principalObjectId || 'Unknown'}
                        </span>
                        <span style={{
                          padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, flexShrink: 0,
                          color: p.roleName === 'Owner' ? '#004578' : p.roleName === 'CanEdit' ? '#8764b8' : '#605e5c',
                          backgroundColor: p.roleName === 'Owner' ? '#cfe4fa' : p.roleName === 'CanEdit' ? '#f0ebf8' : '#f3f2f1',
                        }}>
                          {p.roleName}
                        </span>
                      </div>
                    ))}
                    {sharing.length > 12 && (
                      <Caption1 style={{ color: '#737373' }}>…and {sharing.length - 12} more</Caption1>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" onClick={handleSave}>Save Assessment</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

export function RiskAssessmentView({ allResources, ownerNames, currentUser }: RiskAssessmentViewProps) {
  const classes = useClasses()
  const { data: assessments, isLoading: assessmentsLoading, error: assessmentsError, save, saveMany, isSavingMany, exportData, importData } = useAdminData()
  const [editTarget, setEditTarget] = useState<ResourceItem | null>(null)
  const [selectedForPanel, setSelectedForPanel] = useState<ResourceItem | null>(null)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('All')
  const [typeFilter, setTypeFilter] = useState<'all' | 'apps' | 'flows' | 'agents'>('all')
  const [hideSystem, setHideSystem] = useState(true)
  const importRef = useRef<HTMLInputElement>(null)

  const visibleResources = useMemo(
    () => hideSystem ? allResources.filter(r => !isSystemResource(r)) : allResources,
    [allResources, hideSystem],
  )

  const systemCount = useMemo(() => allResources.filter(isSystemResource).length, [allResources])

  const riskCounts = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, NotAssessed: 0 }
    for (const r of visibleResources) {
      const a = assessments[r.id]
      const level = a?.riskLevel ?? 'None'
      if (!a || level === 'None') counts.NotAssessed++
      else counts[level as keyof typeof counts]++
    }
    return counts
  }, [visibleResources, assessments])

  const filtered = useMemo(() => {
    let items = visibleResources
    if (typeFilter !== 'all') items = items.filter(r => getResourceCategory(r.type) === typeFilter)
    if (riskFilter !== 'All') {
      if (riskFilter === 'NotAssessed') {
        items = items.filter(r => !assessments[r.id] || assessments[r.id].riskLevel === 'None')
      } else {
        items = items.filter(r => assessments[r.id]?.riskLevel === riskFilter)
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(r => getDisplayName(r).toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
    }
    return items
  }, [visibleResources, typeFilter, riskFilter, search, assessments])

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { importData(ev.target?.result as string) }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (assessmentsLoading) {
    return <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}><Spinner size="small" /><Caption1 style={{ color: '#737373' }}>Loading assessments…</Caption1></div>
  }

  if (assessmentsError) {
    return (
      <div style={{ padding: '16px', backgroundColor: '#fde7e9', border: '1px solid #c50f1f', borderRadius: '4px' }}>
        <Text style={{ fontSize: '13px', fontWeight: 600, color: '#c50f1f' }}>Failed to load assessments from Azure Table Storage</Text>
        <Caption1 style={{ display: 'block', color: '#605e5c', marginTop: '4px' }}>{assessmentsError.message}</Caption1>
      </div>
    )
  }

  const summaryItems: Array<{ key: RiskFilter; color: string; label: string; icon: React.ReactNode; count: number }> = [
    { key: 'Critical',    color: '#c50f1f', label: 'Critical',     icon: <ErrorCircleRegular fontSize={24} style={{ color: '#c50f1f' }} />,   count: riskCounts.Critical },
    { key: 'High',        color: '#e17800', label: 'High',         icon: <WarningRegular fontSize={24} style={{ color: '#e17800' }} />,        count: riskCounts.High },
    { key: 'Medium',      color: '#8764b8', label: 'Medium',       icon: <InfoRegular fontSize={24} style={{ color: '#8764b8' }} />,           count: riskCounts.Medium },
    { key: 'Low',         color: '#107c10', label: 'Low',          icon: <CheckmarkCircleRegular fontSize={24} style={{ color: '#107c10' }} />, count: riskCounts.Low },
    { key: 'NotAssessed', color: '#616161', label: 'Not Assessed', icon: <ShieldRegular fontSize={24} style={{ color: '#616161' }} />,         count: riskCounts.NotAssessed },
  ]

  return (
    <div className={classes.root}>
      {editTarget && (
        <AssessmentDialog
          resource={editTarget}
          existing={assessments[editTarget.id]}
          currentUser={currentUser}
          ownerNames={ownerNames}
          onSave={save}
          onClose={() => setEditTarget(null)}
        />
      )}

      {selectedForPanel && (
        <AssessmentSidePanel
          resource={selectedForPanel}
          assessment={assessments[selectedForPanel.id]}
          ownerNames={ownerNames}
          onClose={() => setSelectedForPanel(null)}
          onEdit={() => {
            setEditTarget(selectedForPanel)
            setSelectedForPanel(null)
          }}
        />
      )}

      {/* Summary cards */}
      <div className={classes.summaryGrid}>
        {summaryItems.map(({ key, color, label, icon, count }) => (
          <div
            key={key}
            className={classes.summaryCard}
            style={{
              borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: color,
              outline: riskFilter === key ? `2px solid ${color}` : undefined,
            }}
            onClick={() => setRiskFilter(riskFilter === key ? 'All' : key)}
            role="button"
          >
            {icon}
            <div>
              <Text style={{ display: 'block', fontSize: '26px', fontWeight: 700, lineHeight: 1, color: '#242424' }}>{count}</Text>
              <Caption1 style={{ color: '#737373' }}>{label}</Caption1>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Input
          contentBefore={<SearchRegular />}
          placeholder="Search resources…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          style={{ width: '220px' }}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'apps', 'flows', 'agents'] as const).map(t => (
            <Button key={t} size="small" appearance={typeFilter === t ? 'primary' : 'subtle'}
              onClick={() => setTypeFilter(t)}>
              {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
        <Button
          size="small"
          appearance={hideSystem ? 'primary' : 'subtle'}
          onClick={() => setHideSystem(h => !h)}
        >
          {hideSystem ? `System hidden (${systemCount})` : 'Show system'}
        </Button>
        <div style={{ flex: 1 }} />
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <Button size="small" appearance="subtle" onClick={() => importRef.current?.click()}>Import JSON</Button>
        <Button size="small" appearance="subtle" onClick={exportData}>Export JSON</Button>
        {import.meta.env.DEV && (
          <Button
            size="small"
            appearance="subtle"
            disabled={isSavingMany || allResources.length === 0}
            onClick={async () => {
              const items = generateDemoAssessments(allResources, currentUser)
              await saveMany(items)
            }}
          >
            {isSavingMany ? 'Seeding…' : 'Seed Demo Data'}
          </Button>
        )}
      </div>

      {/* Resource table */}
      <div className={classes.card}>
        <div className={classes.cardHead}>
          <ShieldRegular fontSize={16} style={{ color: '#004578' }} />
          Resource Risk Assessments
          <Badge appearance="tint" color="subtle" size="small">{filtered.length} resource{filtered.length !== 1 ? 's' : ''}</Badge>
          {riskFilter !== 'All' && (
            <Button size="small" appearance="subtle" onClick={() => setRiskFilter('All')} style={{ marginLeft: 'auto', padding: '0 8px' }}>
              Clear filter
            </Button>
          )}
        </div>
        {visibleResources.length === 0 && allResources.length === 0 ? (
          <div style={{ padding: '16px' }}><Caption1 style={{ color: '#737373' }}>No resources loaded. Load inventory data first.</Caption1></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '16px' }}><Caption1 style={{ color: '#737373' }}>No resources match the current filters.</Caption1></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Resource</th>
                  <th className={classes.th}>Owner</th>
                  <th className={classes.th}>Risk Level</th>
                  <th className={classes.th}>Compliance</th>
                  <th className={classes.th}>Last Reviewed</th>
                  <th className={classes.th}>Reviewed By</th>
                  <th className={classes.th} style={{ width: '72px' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const a = assessments[r.id]
                  return (
                    <tr key={r.id}>
                      <td className={classes.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ flexShrink: 0 }}><ResourceTypeIcon type={r.type} /></span>
                          <div style={{ minWidth: 0 }}>
                            <button
                              onClick={() => setSelectedForPanel(r)}
                              style={{
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                display: 'block', width: '100%', textAlign: 'left',
                                fontSize: '13px', fontWeight: 600, color: '#0078d4',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {getDisplayName(r)}
                            </button>
                            <Caption1 style={{ color: '#737373' }}>{r.type.split('/').pop()}</Caption1>
                          </div>
                        </div>
                      </td>
                      <td className={classes.td}>
                        <Caption1 style={{ color: '#605e5c' }}>{resolveOwner(getOwnerFromProperties(r), ownerNames)}</Caption1>
                      </td>
                      <td className={classes.td}>
                        <RiskBadge level={a?.riskLevel ?? 'None'} />
                      </td>
                      <td className={classes.td}>
                        <ComplianceBadge status={a?.complianceStatus ?? 'Not Reviewed'} />
                      </td>
                      <td className={classes.td}>
                        <Caption1 style={{ color: '#737373' }}>
                          {a?.lastUpdated ? new Date(a.lastUpdated).toLocaleDateString() : '—'}
                        </Caption1>
                      </td>
                      <td className={classes.td}>
                        <Caption1 style={{ color: '#737373' }}>{a?.updatedBy ?? '—'}</Caption1>
                      </td>
                      <td className={classes.td}>
                        <Button size="small" appearance="subtle" onClick={() => setEditTarget(r)}>Edit</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
