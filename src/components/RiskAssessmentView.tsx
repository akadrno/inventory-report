import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useResizableColumns, RESIZE_HANDLE_STYLE } from '../hooks/useResizableColumns'
import {
  makeStyles, tokens, Text, Caption1, Badge, Button, Input, Spinner, Textarea,
  OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, DrawerFooter,
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
  QuestionCircleRegular,
  ClockRegular,
  DismissCircleRegular,
  ShieldCheckmarkRegular,
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
  Critical: { color: tokens.colorStatusDangerForeground1, bg: tokens.colorStatusDangerBackground1 },
  High:     { color: tokens.colorStatusWarningForeground1, bg: tokens.colorStatusWarningBackground1 },
  Medium:   { color: tokens.colorPalettePurpleForeground2, bg: tokens.colorPalettePurpleBackground2 },
  Low:      { color: tokens.colorStatusSuccessForeground1, bg: tokens.colorStatusSuccessBackground1 },
  None:     { color: tokens.colorNeutralForeground3, bg: tokens.colorNeutralBackground3 },
}

const COMPLIANCE_CONFIG: Record<ComplianceStatus, { color: string; bg: string }> = {
  'Not Reviewed':  { color: tokens.colorNeutralForeground3, bg: tokens.colorNeutralBackground3 },
  'In Review':     { color: tokens.colorBrandForeground2, bg: tokens.colorBrandBackground2 },
  'Compliant':     { color: tokens.colorStatusSuccessForeground1, bg: tokens.colorStatusSuccessBackground1 },
  'Non-Compliant': { color: tokens.colorStatusDangerForeground1, bg: tokens.colorStatusDangerBackground1 },
  'Exempted':      { color: tokens.colorStatusWarningForeground1, bg: tokens.colorStatusWarningBackground1 },
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
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    boxShadow: tokens.shadow8,
    transition: 'transform 0.16s ease, box-shadow 0.16s ease',
    ':hover': { transform: 'translateY(-2px)', boxShadow: tokens.shadow16 },
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: tokens.shadow8,
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px 10px',
    backgroundImage: `linear-gradient(180deg, ${tokens.colorNeutralBackground2}, transparent)`,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    fontSize: '14px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' as const },
  th: {
    padding: '8px 16px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  td: {
    padding: '10px 16px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
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

interface EditForm {
  riskLevel: RiskLevel
  complianceStatus: ComplianceStatus
  riskNotes: string
  notes: string
}

function AssessmentSidePanel({
  resource,
  assessment,
  mode,
  currentUser,
  ownerNames,
  onSave,
  onClose,
  onEditMode,
  onCancelEdit,
}: {
  resource: ResourceItem
  assessment: ResourceAssessment | undefined
  mode: 'view' | 'edit'
  currentUser: string
  ownerNames: Map<string, string>
  onSave: (a: ResourceAssessment) => void
  onClose: () => void
  onEditMode: () => void
  onCancelEdit: () => void
}) {
  const classes = useClasses()
  const ownerRaw = getOwnerFromProperties(resource)
  const owner = resolveOwner(ownerRaw, ownerNames)
  const isApp = getResourceCategory(resource.type) === 'apps'

  const [form, setForm] = useState<EditForm>({
    riskLevel: assessment?.riskLevel ?? 'None',
    complianceStatus: assessment?.complianceStatus ?? 'Not Reviewed',
    riskNotes: assessment?.riskNotes ?? '',
    notes: assessment?.notes ?? '',
  })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [sharing, setSharing] = useState<AppPermission[] | null>(null)
  const [loadingSharing, setLoadingSharing] = useState(false)

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
  }

  const lbl: React.CSSProperties = {
    fontSize: '10px', fontWeight: 600, color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    display: 'block', marginBottom: '3px',
  }

  return (
    <OverlayDrawer open position="end" size="medium" onOpenChange={(_, d) => { if (!d.open) onClose() }}>
      <DrawerHeader style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, paddingBottom: '10px' }}>
        <DrawerHeaderTitle
          action={<Button appearance="subtle" icon={<DismissRegular />} aria-label="Close" onClick={onClose} />}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ flexShrink: 0 }}><ResourceTypeIcon type={resource.type} /></span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '15px', fontWeight: 600 }}>
              {getDisplayName(resource)}
            </span>
          </div>
        </DrawerHeaderTitle>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: '2px', paddingLeft: '2px' }}>
          {resource.type.split('/').pop()}{owner !== '—' ? ` · ${owner}` : ''}
        </Caption1>
      </DrawerHeader>

      <DrawerBody style={{ padding: '14px 16px', overflowY: 'auto' }}>
        {mode === 'view' ? (
          assessment ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span style={lbl}>Risk Level</span>
                  <RiskBadge level={assessment.riskLevel} />
                </div>
                <div>
                  <span style={lbl}>Compliance</span>
                  <ComplianceBadge status={assessment.complianceStatus} />
                </div>
                {assessment.lastUpdated && (
                  <div>
                    <span style={lbl}>Last Reviewed</span>
                    <Text style={{ fontSize: '12px', color: tokens.colorNeutralForeground1 }}>
                      {new Date(assessment.lastUpdated).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </Text>
                  </div>
                )}
                {assessment.updatedBy && (
                  <div>
                    <span style={lbl}>Reviewed By</span>
                    <Text style={{ fontSize: '12px', color: tokens.colorNeutralForeground1 }}>{assessment.updatedBy}</Text>
                  </div>
                )}
              </div>
              {(assessment.riskNotes || assessment.notes) && (
                <div style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}`, paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {assessment.riskNotes && (
                    <div>
                      <span style={lbl}>Risk Notes</span>
                      <Text style={{ fontSize: '12px', color: tokens.colorNeutralForeground1, lineHeight: '18px', whiteSpace: 'pre-wrap' }}>{assessment.riskNotes}</Text>
                    </div>
                  )}
                  {assessment.notes && (
                    <div>
                      <span style={lbl}>Admin Notes</span>
                      <Text style={{ fontSize: '12px', color: tokens.colorNeutralForeground1, lineHeight: '18px', whiteSpace: 'pre-wrap' }}>{assessment.notes}</Text>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '24px 0' }}>
              <ShieldRegular fontSize={28} style={{ color: tokens.colorNeutralForeground3 }} />
              <Text style={{ fontSize: '13px', color: tokens.colorNeutralForeground3 }}>No assessment recorded for this resource.</Text>
            </div>
          )
        ) : (
          <div>
            <div className={classes.formField}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1 }}>Risk Level <span style={{ color: tokens.colorStatusDangerForeground1 }}>*</span></Text>
              <div className={classes.toggleGroup}>
                {RISK_LEVELS.map(level => {
                  const active = form.riskLevel === level
                  const c = RISK_CONFIG[level]
                  return (
                    <button key={level} onClick={() => setForm(f => ({ ...f, riskLevel: level }))} style={{
                      padding: '4px 12px', borderRadius: '10px', fontSize: '12px',
                      fontWeight: active ? 700 : 400, cursor: 'pointer',
                      border: `2px solid ${active ? c.color : tokens.colorNeutralStroke2}`,
                      backgroundColor: active ? c.bg : tokens.colorNeutralBackground1,
                      color: active ? c.color : tokens.colorNeutralForeground1, transition: 'all 0.1s',
                    }}>{level}</button>
                  )
                })}
              </div>
              {submitAttempted && form.riskLevel === 'None' && (
                <Caption1 style={{ color: tokens.colorStatusDangerForeground1, display: 'block', marginTop: '4px' }}>Select a risk level</Caption1>
              )}
            </div>

            <div className={classes.formField}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1 }}>Compliance Status <span style={{ color: tokens.colorStatusDangerForeground1 }}>*</span></Text>
              <div className={classes.toggleGroup}>
                {COMPLIANCE_STATUSES.map(status => {
                  const active = form.complianceStatus === status
                  const c = COMPLIANCE_CONFIG[status]
                  return (
                    <button key={status} onClick={() => setForm(f => ({ ...f, complianceStatus: status }))} style={{
                      padding: '4px 10px', borderRadius: '10px', fontSize: '11px',
                      fontWeight: active ? 700 : 400, cursor: 'pointer',
                      border: `2px solid ${active ? c.color : tokens.colorNeutralStroke2}`,
                      backgroundColor: active ? c.bg : tokens.colorNeutralBackground1,
                      color: active ? c.color : tokens.colorNeutralForeground1, transition: 'all 0.1s',
                    }}>{status}</button>
                  )
                })}
              </div>
              {submitAttempted && form.complianceStatus === 'Not Reviewed' && (
                <Caption1 style={{ color: tokens.colorStatusDangerForeground1, display: 'block', marginTop: '4px' }}>Select a compliance status</Caption1>
              )}
            </div>

            <div className={classes.formField}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1 }}>Risk Notes <span style={{ color: tokens.colorStatusDangerForeground1 }}>*</span></Text>
              <Textarea value={form.riskNotes} onChange={(_, d) => setForm(f => ({ ...f, riskNotes: d.value }))}
                aria-label="Risk Notes"
                placeholder="Document specific risk findings, vulnerabilities, or compliance gaps…" resize="vertical" rows={3} />
              {submitAttempted && !form.riskNotes.trim() && (
                <Caption1 style={{ color: tokens.colorStatusDangerForeground1, display: 'block', marginTop: '4px' }}>Risk notes are required</Caption1>
              )}
            </div>

            <div className={classes.formField} style={{ marginBottom: isApp ? '14px' : 0 }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1 }}>Admin Notes <span style={{ color: tokens.colorStatusDangerForeground1 }}>*</span></Text>
              <Textarea value={form.notes} onChange={(_, d) => setForm(f => ({ ...f, notes: d.value }))}
                aria-label="Admin Notes"
                placeholder="General notes, remediation steps, or context for this resource…" resize="vertical" rows={3} />
              {submitAttempted && !form.notes.trim() && (
                <Caption1 style={{ color: tokens.colorStatusDangerForeground1, display: 'block', marginTop: '4px' }}>Admin notes are required</Caption1>
              )}
            </div>

            {isApp && (
              <div style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}`, paddingTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Text style={{ fontSize: '12px', fontWeight: 600, color: tokens.colorNeutralForeground1 }}>App Sharing</Text>
                  {sharing === null && (
                    <Button size="small" appearance="subtle" onClick={loadSharing} disabled={loadingSharing}>
                      {loadingSharing ? 'Loading…' : 'Load permissions'}
                    </Button>
                  )}
                </div>
                {sharing !== null && sharing.length === 0 && (
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No sharing permissions found, or permissions API unavailable for this app.</Caption1>
                )}
                {sharing !== null && sharing.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sharing.slice(0, 12).map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <PersonRegular fontSize={12} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: tokens.colorNeutralForeground1 }}>
                          {p.principalDisplayName || p.principalEmail || p.principalObjectId || 'Unknown'}
                        </span>
                        <span style={{
                          padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, flexShrink: 0,
                          color: p.roleName === 'Owner' ? tokens.colorBrandForeground2 : p.roleName === 'CanEdit' ? tokens.colorPalettePurpleForeground2 : tokens.colorNeutralForeground3,
                          backgroundColor: p.roleName === 'Owner' ? tokens.colorBrandBackground2 : p.roleName === 'CanEdit' ? tokens.colorPalettePurpleBackground2 : tokens.colorNeutralBackground3,
                        }}>{p.roleName}</span>
                      </div>
                    ))}
                    {sharing.length > 12 && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>…and {sharing.length - 12} more</Caption1>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DrawerBody>

      <DrawerFooter style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}`, padding: '12px 16px', display: 'flex', gap: '8px' }}>
        {mode === 'view' ? (
          <>
            <Button appearance="primary" onClick={onEditMode}>{assessment ? 'Edit Assessment' : 'Add Assessment'}</Button>
            <Button appearance="secondary" onClick={onClose}>Close</Button>
          </>
        ) : (
          <>
            <Button appearance="primary" onClick={handleSave}>Save Assessment</Button>
            <Button appearance="secondary" onClick={onCancelEdit}>Cancel</Button>
          </>
        )}
      </DrawerFooter>
    </OverlayDrawer>
  )
}

export function RiskAssessmentView({ allResources, ownerNames, currentUser }: RiskAssessmentViewProps) {
  const classes = useClasses()
  const { widths: riskWidths, getResizeProps: getRiskResize } = useResizableColumns({ resource: 260, owner: 150, risk: 110, compliance: 130, lastReviewed: 130, reviewedBy: 150, action: 72 })
  const { data: assessments, isLoading: assessmentsLoading, error: assessmentsError, save, saveMany, isSavingMany, exportData, importData } = useAdminData()
  const [selectedForPanel, setSelectedForPanel] = useState<ResourceItem | null>(null)
  const [panelMode, setPanelMode] = useState<'view' | 'edit'>('view')
  const [search, setSearch] = useState('')

  const openPanel = (r: ResourceItem, mode: 'view' | 'edit' = 'view') => {
    setSelectedForPanel(r)
    setPanelMode(mode)
  }
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('All')
  const [complianceFilter, setComplianceFilter] = useState<ComplianceStatus | 'All'>('All')
  const [typeFilter, setTypeFilter] = useState<'all' | 'apps' | 'flows' | 'agents'>('all')
  const [hideSystem, setHideSystem] = useState(true)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setCurrentPage(1) }, [search, riskFilter, complianceFilter, typeFilter, hideSystem])

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

  const complianceCounts = useMemo(() => {
    const counts: Record<ComplianceStatus, number> = {
      'Not Reviewed': 0, 'In Review': 0, 'Compliant': 0, 'Non-Compliant': 0, 'Exempted': 0,
    }
    for (const r of visibleResources) {
      const status = assessments[r.id]?.complianceStatus ?? 'Not Reviewed'
      counts[status]++
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
    if (complianceFilter !== 'All') {
      items = items.filter(r => (assessments[r.id]?.complianceStatus ?? 'Not Reviewed') === complianceFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(r => getDisplayName(r).toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
    }
    return items
  }, [visibleResources, typeFilter, riskFilter, complianceFilter, search, assessments])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStart = (safeCurrentPage - 1) * pageSize
  const paginated = filtered.slice(pageStart, pageStart + pageSize)
  const displayStart = filtered.length === 0 ? 0 : pageStart + 1
  const displayEnd = Math.min(pageStart + pageSize, filtered.length)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { importData(ev.target?.result as string) }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (assessmentsLoading) {
    return <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}><Spinner size="small" /><Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Loading assessments…</Caption1></div>
  }

  if (assessmentsError) {
    return (
      <div style={{ padding: '16px', backgroundColor: tokens.colorStatusDangerBackground1, border: `1px solid ${tokens.colorStatusDangerBorder1}`, borderRadius: '4px' }}>
        <Text style={{ fontSize: '13px', fontWeight: 600, color: tokens.colorStatusDangerForeground1 }}>Failed to load assessments from Azure Table Storage</Text>
        <Caption1 style={{ display: 'block', color: tokens.colorNeutralForeground3, marginTop: '4px' }}>{assessmentsError.message}</Caption1>
      </div>
    )
  }

  const riskSummaryItems: Array<{ key: RiskFilter; color: string; accent: string; label: string; icon: React.ReactNode; count: number }> = [
    { key: 'Critical',    color: tokens.colorStatusDangerForeground1, accent: '#e0626d', label: 'Critical',     icon: <ErrorCircleRegular fontSize={24} style={{ color: tokens.colorStatusDangerForeground1 }} />,   count: riskCounts.Critical },
    { key: 'High',        color: tokens.colorStatusWarningForeground1, accent: '#e6a23c', label: 'High',         icon: <WarningRegular fontSize={24} style={{ color: tokens.colorStatusWarningForeground1 }} />,        count: riskCounts.High },
    { key: 'Medium',      color: tokens.colorPalettePurpleForeground2, accent: '#b07cff', label: 'Medium',       icon: <InfoRegular fontSize={24} style={{ color: tokens.colorPalettePurpleForeground2 }} />,           count: riskCounts.Medium },
    { key: 'Low',         color: tokens.colorStatusSuccessForeground1, accent: '#5bb26b', label: 'Low',          icon: <CheckmarkCircleRegular fontSize={24} style={{ color: tokens.colorStatusSuccessForeground1 }} />, count: riskCounts.Low },
    { key: 'NotAssessed', color: tokens.colorNeutralForeground3, accent: '#8a8886', label: 'Not Assessed', icon: <ShieldRegular fontSize={24} style={{ color: tokens.colorNeutralForeground3 }} />,         count: riskCounts.NotAssessed },
  ]

  const complianceSummaryItems: Array<{ key: ComplianceStatus; color: string; accent: string; label: string; icon: React.ReactNode; count: number }> = [
    { key: 'Non-Compliant', color: tokens.colorStatusDangerForeground1, accent: '#e0626d', label: 'Non-Compliant', icon: <DismissCircleRegular fontSize={24} style={{ color: tokens.colorStatusDangerForeground1 }} />,    count: complianceCounts['Non-Compliant'] },
    { key: 'In Review',     color: tokens.colorBrandForeground1, accent: '#4aa8ff', label: 'In Review',     icon: <ClockRegular fontSize={24} style={{ color: tokens.colorBrandForeground1 }} />,             count: complianceCounts['In Review'] },
    { key: 'Not Reviewed',  color: tokens.colorNeutralForeground3, accent: '#8a8886', label: 'Not Reviewed',  icon: <QuestionCircleRegular fontSize={24} style={{ color: tokens.colorNeutralForeground3 }} />,    count: complianceCounts['Not Reviewed'] },
    { key: 'Compliant',     color: tokens.colorStatusSuccessForeground1, accent: '#5bb26b', label: 'Compliant',     icon: <CheckmarkCircleRegular fontSize={24} style={{ color: tokens.colorStatusSuccessForeground1 }} />,   count: complianceCounts['Compliant'] },
    { key: 'Exempted',      color: tokens.colorStatusWarningForeground1, accent: '#e6a23c', label: 'Exempted',      icon: <ShieldCheckmarkRegular fontSize={24} style={{ color: tokens.colorStatusWarningForeground1 }} />,   count: complianceCounts['Exempted'] },
  ]

  const sectionLabel: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase', letterSpacing: '0.4px',
  }

  return (
    <div className={classes.root}>
      {selectedForPanel && (
        <AssessmentSidePanel
          key={selectedForPanel.id}
          resource={selectedForPanel}
          assessment={assessments[selectedForPanel.id]}
          mode={panelMode}
          currentUser={currentUser}
          ownerNames={ownerNames}
          onSave={(a) => { save(a); setPanelMode('view') }}
          onClose={() => setSelectedForPanel(null)}
          onEditMode={() => setPanelMode('edit')}
          onCancelEdit={() => setPanelMode('view')}
        />
      )}

      {/* Risk summary cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={sectionLabel}>Risk Level</span>
        <div className={classes.summaryGrid}>
          {riskSummaryItems.map(({ key, accent, label, icon, count }) => (
            <div
              key={key}
              className={classes.summaryCard}
              style={{
                borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: accent,
                backgroundImage: `radial-gradient(130% 130% at 100% 0%, ${accent}22, transparent 55%)`,
                outline: riskFilter === key ? `2px solid ${accent}` : undefined,
              }}
              onClick={() => setRiskFilter(riskFilter === key ? 'All' : key)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRiskFilter(riskFilter === key ? 'All' : key) } }}
            >
              {icon}
              <div>
                <Text style={{ display: 'block', fontSize: '26px', fontWeight: 700, lineHeight: 1, color: tokens.colorNeutralForeground1 }}>{count}</Text>
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{label}</Caption1>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance summary cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={sectionLabel}>Compliance Status</span>
        <div className={classes.summaryGrid}>
          {complianceSummaryItems.map(({ key, accent, label, icon, count }) => (
            <div
              key={key}
              className={classes.summaryCard}
              style={{
                borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: accent,
                backgroundImage: `radial-gradient(130% 130% at 100% 0%, ${accent}22, transparent 55%)`,
                outline: complianceFilter === key ? `2px solid ${accent}` : undefined,
              }}
              onClick={() => setComplianceFilter(complianceFilter === key ? 'All' : key)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setComplianceFilter(complianceFilter === key ? 'All' : key) } }}
            >
              {icon}
              <div>
                <Text style={{ display: 'block', fontSize: '26px', fontWeight: 700, lineHeight: 1, color: tokens.colorNeutralForeground1 }}>{count}</Text>
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{label}</Caption1>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Input
          contentBefore={<SearchRegular />}
          aria-label="Search resources"
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
          <ShieldRegular fontSize={16} style={{ color: tokens.colorBrandForeground1 }} />
          Resource Risk Assessments
          <Badge appearance="tint" color="subtle" size="small">{filtered.length} resource{filtered.length !== 1 ? 's' : ''}</Badge>
          {(riskFilter !== 'All' || complianceFilter !== 'All') && (
            <Button size="small" appearance="subtle" onClick={() => { setRiskFilter('All'); setComplianceFilter('All') }} style={{ marginLeft: 'auto', padding: '0 8px' }}>
              Clear filters
            </Button>
          )}
        </div>
        {visibleResources.length === 0 && allResources.length === 0 ? (
          <div style={{ padding: '16px' }}><Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No resources loaded. Load inventory data first.</Caption1></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '16px' }}><Caption1 style={{ color: tokens.colorNeutralForeground3 }}>No resources match the current filters.</Caption1></div>
        ) : (
          <>
          <div style={{ overflowX: 'auto' }}>
            <table className={classes.table}>
              <colgroup>
                <col style={{ width: riskWidths.resource }} />
                <col style={{ width: riskWidths.owner }} />
                <col style={{ width: riskWidths.risk }} />
                <col style={{ width: riskWidths.compliance }} />
                <col style={{ width: riskWidths.lastReviewed }} />
                <col style={{ width: riskWidths.reviewedBy }} />
                <col style={{ width: riskWidths.action }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={classes.th}>Resource<div {...getRiskResize('resource')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th}>Owner<div {...getRiskResize('owner')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th}>Risk Level<div {...getRiskResize('risk')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th}>Compliance<div {...getRiskResize('compliance')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th}>Last Reviewed<div {...getRiskResize('lastReviewed')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th}>Reviewed By<div {...getRiskResize('reviewedBy')} style={RESIZE_HANDLE_STYLE} /></th>
                  <th className={classes.th} />
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => {
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
                                fontSize: '13px', fontWeight: 600, color: tokens.colorBrandForeground1,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {getDisplayName(r)}
                            </button>
                            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{r.type.split('/').pop()}</Caption1>
                          </div>
                        </div>
                      </td>
                      <td className={classes.td}>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{resolveOwner(getOwnerFromProperties(r), ownerNames)}</Caption1>
                      </td>
                      <td className={classes.td}>
                        <RiskBadge level={a?.riskLevel ?? 'None'} />
                      </td>
                      <td className={classes.td}>
                        <ComplianceBadge status={a?.complianceStatus ?? 'Not Reviewed'} />
                      </td>
                      <td className={classes.td}>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                          {a?.lastUpdated ? new Date(a.lastUpdated).toLocaleDateString() : '—'}
                        </Caption1>
                      </td>
                      <td className={classes.td}>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{a?.updatedBy ?? '—'}</Caption1>
                      </td>
                      <td className={classes.td}>
                        <Button size="small" appearance="subtle" onClick={() => openPanel(r, 'edit')}>Edit</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{
            padding: '8px 16px', borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            backgroundColor: tokens.colorNeutralBackground3,
          }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, flex: 1, whiteSpace: 'nowrap' }}>
              {filtered.length === 0
                ? 'No resources'
                : `Showing ${displayStart}–${displayEnd} of ${filtered.length} resource${filtered.length !== 1 ? 's' : ''}`
              }
            </Caption1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Button
                size="small" appearance="subtle"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >← Prev</Button>
              <Caption1 style={{ color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'center' }}>
                Page {safeCurrentPage} of {totalPages}
              </Caption1>
              <Button
                size="small" appearance="subtle"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >Next →</Button>
              <select
                aria-label="Resources per page"
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                style={{
                  fontSize: '12px', padding: '4px 8px', borderRadius: '4px',
                  border: `1px solid ${tokens.colorNeutralStroke1}`, color: tokens.colorNeutralForeground1, backgroundColor: tokens.colorNeutralBackground1,
                  cursor: 'pointer', marginLeft: '4px',
                }}
              >
                {[25, 50, 100, 150, 200, 300, 500, 1000].map(n => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
