import { useState, useMemo } from 'react'
import { useResizableColumns, RESIZE_HANDLE_STYLE } from '../hooks/useResizableColumns'
import {
  makeStyles, tokens, Text, Caption1, Button, Badge, Input, Checkbox,
  Spinner, Divider,
  OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody,
  Select,
} from '@fluentui/react-components'
import {
  TagRegular, TagMultipleRegular, DismissRegular, AddRegular,
  EditRegular, DeleteRegular, SearchRegular,
  ChevronDownRegular, ChevronRightRegular, CheckmarkRegular,
  BookmarkRegular, SaveRegular, DismissCircleRegular,
  InfoRegular, SparkleRegular,
} from '@fluentui/react-icons'
import { useQueryClient } from '@tanstack/react-query'
import { useTermStore, useAllResourceTags, useTaggingMutations } from '../hooks/useTagging'
import type { TermGroup, TermSet, Term, ResourceTag } from '../hooks/useTagging'
import { ResourceTypeBadge } from './ResourceTypeBadge'
import { tableStorageConfigured } from '../api/tableStorageApi'
import type { ResourceItem } from '../types'
import { getDisplayName, getResourceCategory, getEnvironmentName } from '../types'
import { seedDemoTags, type SeedResult } from '../utils/seedDemoTags'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TagView = 'browser' | 'termstore'

interface ResourceTaggingViewProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  currentUser: string
  view: TagView
}

// ── Colour palette ─────────────────────────────────────────────────────────────

type BColor = 'brand' | 'informative' | 'success' | 'warning' | 'important' | 'severe'
const PALETTE: BColor[] = ['brand', 'informative', 'success', 'warning', 'important', 'severe']
function groupBadgeColor(idx: number): BColor { return PALETTE[idx % PALETTE.length] }

// ── Styles ────────────────────────────────────────────────────────────────────

const useClasses = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, flexShrink: 0 },
  tableWrapper: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    overflow: 'hidden',
    boxShadow: tokens.shadow4,
    flexShrink: 0,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.fontSizeBase200, tableLayout: 'fixed' as const },
  thead: { backgroundColor: tokens.colorNeutralBackground3 },
  th: {
    paddingLeft: tokens.spacingHorizontalM, paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalS,
    textAlign: 'left', fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    whiteSpace: 'nowrap' as const,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  td: {
    paddingLeft: tokens.spacingHorizontalM, paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: tokens.colorNeutralStroke2,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
  },
  tr: { ':hover': { backgroundColor: tokens.colorBrandBackground2 }, ':last-child td': { borderBottom: 'none' } },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' },
  summaryRow: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap', alignItems: 'center' },
  filterBar: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center', flexWrap: 'wrap' },
  emptyState: {
    textAlign: 'center', padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXL}`,
    color: tokens.colorNeutralForeground3,
  },
  // Term store layout
  tsLayout: { display: 'flex', gap: tokens.spacingHorizontalL, minHeight: '480px' },
  tsTree: {
    width: '260px', minWidth: '260px', flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    overflowY: 'auto', padding: tokens.spacingVerticalS,
  },
  tsDetail: {
    flex: 1, minWidth: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    overflowY: 'auto', padding: tokens.spacingVerticalM,
    display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM,
  },
  treeGroup: {
    borderRadius: tokens.borderRadiusMedium, overflow: 'hidden', marginBottom: '2px',
  },
  treeGroupHeader: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 8px', cursor: 'pointer', userSelect: 'none',
    borderRadius: tokens.borderRadiusMedium,
    ':hover': { backgroundColor: tokens.colorNeutralBackground3 },
  },
  treeGroupHeaderActive: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 8px', cursor: 'pointer', userSelect: 'none',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  treeTermSet: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '5px 8px 5px 24px', cursor: 'pointer', userSelect: 'none',
    borderRadius: tokens.borderRadiusMedium, fontSize: tokens.fontSizeBase200,
    ':hover': { backgroundColor: tokens.colorNeutralBackground3 },
  },
  treeTermSetActive: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '5px 8px 5px 24px', cursor: 'pointer', userSelect: 'none',
    borderRadius: tokens.borderRadiusMedium, fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  inlineForm: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium, padding: tokens.spacingVerticalS,
    display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS,
  },
  termRow: {
    display: 'flex', alignItems: 'flex-start', gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    ':hover': { backgroundColor: tokens.colorNeutralBackground2 },
  },
  setupNotice: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'flex-start',
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function newId(): string { return crypto.randomUUID() }

const ENV_IN_PATH_RE = /\/environments\/([^/]+)/i

function extractEnvIdFromPath(id: string): string | undefined {
  return ENV_IN_PATH_RE.exec(id)?.[1]
}

function envMapLookup(key: string, envMap: Map<string, string>): string | undefined {
  return envMap.get(key) ?? envMap.get(key.toLowerCase())
}

function buildEnvMap(environments: ResourceItem[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const env of environments) {
    const displayName = getDisplayName(env)
    m.set(env.id, displayName)
    m.set(env.name, displayName)
    const seg = env.id.split('/').pop()
    if (seg) m.set(seg, displayName)
    m.set(env.id.toLowerCase(), displayName)
    m.set(env.name.toLowerCase(), displayName)
    if (seg) m.set(seg.toLowerCase(), displayName)
  }
  return m
}

function resolveEnvName(resource: ResourceItem, envMap: Map<string, string>): string {
  if (resource.environmentId) {
    const r = envMapLookup(resource.environmentId, envMap)
    if (r) return r
  }
  const envIdFromPath = extractEnvIdFromPath(resource.id)
  if (envIdFromPath) {
    const r = envMapLookup(envIdFromPath, envMap)
    if (r) return r
    if (envMap.size === 0) return envIdFromPath
  }
  const raw = getEnvironmentName(resource)
  if (raw) {
    const r = envMapLookup(raw, envMap)
    if (r) return r
    return raw
  }
  return envIdFromPath ?? resource.environmentId ?? '—'
}

// ── TagChip ───────────────────────────────────────────────────────────────────

function TagChip({ label, color, onDismiss }: { label: string; color: BColor; onDismiss?: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      <Badge appearance="tint" color={color} size="small">{label}</Badge>
      {onDismiss && (
        <button
          onClick={onDismiss}
          title="Remove tag"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', display: 'flex', color: tokens.colorNeutralForeground3, lineHeight: 1 }}
        >
          <DismissCircleRegular fontSize={12} />
        </button>
      )}
    </span>
  )
}

// ── TagPickerPanel ─────────────────────────────────────────────────────────────

function TagPickerPanel({
  resource, environments, allTags, termStore, currentUser,
  isOpen, onClose, onAdd, onRemove,
}: {
  resource: ResourceItem | null
  environments: ResourceItem[]
  allTags: ResourceTag[]
  termStore: { groups: TermGroup[]; termSets: TermSet[]; terms: Term[] }
  currentUser: string
  isOpen: boolean
  onClose: () => void
  onAdd: (tag: ResourceTag) => void
  onRemove: (resourceId: string, termId: string) => void
}) {
  const classes = useClasses()
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const envMap = useMemo(() => buildEnvMap(environments), [environments])

  if (!resource) return null

  const applied = allTags.filter(t => t.resourceId === resource.id)
  const appliedIds = new Set(applied.map(t => t.termId))

  const groupColorMap = new Map(termStore.groups.map((g, i) => [g.id, groupBadgeColor(i)]))

  const filteredTerms = search
    ? termStore.terms.filter(t =>
        t.isActive && (
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.synonyms.some(s => s.toLowerCase().includes(search.toLowerCase()))
        )
      )
    : termStore.terms.filter(t => t.isActive)

  const visibleGroupIds = new Set(filteredTerms.map(t => t.groupId))

  const toggleGroup = (id: string) => setExpandedGroups(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const handleAdd = (term: Term) => {
    const ts = termStore.termSets.find(s => s.id === term.termSetId)
    const grp = termStore.groups.find(g => g.id === term.groupId)
    onAdd({
      resourceId: resource.id, termId: term.id, termName: term.name,
      termSetId: term.termSetId, termSetName: ts?.name ?? '',
      groupId: term.groupId, groupName: grp?.name ?? '',
      appliedBy: currentUser, appliedAt: new Date().toISOString(),
    })
  }

  return (
    <OverlayDrawer position="end" open={isOpen} onOpenChange={(_, s) => { if (!s.open) onClose() }} style={{ width: '400px' }}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" icon={<DismissRegular />} aria-label="Close" onClick={onClose} />}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
            <TagRegular style={{ color: tokens.colorBrandForeground1, fontSize: '18px' }} />
            Tag Resource
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, paddingBottom: tokens.spacingVerticalL }}>
          {/* Resource */}
          <div>
            <Text weight="semibold" style={{ display: 'block' }}>{getDisplayName(resource)}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <ResourceTypeBadge type={resource.type} kind={resource.kind} />
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{resolveEnvName(resource, envMap)}</Caption1>
            </div>
          </div>

          {/* Applied tags */}
          <div>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '6px' }}>
              Applied tags ({applied.length})
            </Caption1>
            {applied.length === 0
              ? <Caption1 style={{ color: tokens.colorNeutralForeground3, fontStyle: 'italic' }}>None — search below to add tags</Caption1>
              : (
                <div className={classes.tagRow}>
                  {applied.map(t => (
                    <TagChip
                      key={t.termId} label={t.termName}
                      color={groupColorMap.get(t.groupId) ?? 'subtle' as BColor}
                      onDismiss={() => onRemove(resource.id, t.termId)}
                    />
                  ))}
                </div>
              )
            }
          </div>

          <Divider />

          {/* Search */}
          <Input
            contentBefore={<SearchRegular />}
            placeholder="Search terms…"
            aria-label="Search terms"
            value={search}
            onChange={(_, d) => setSearch(d.value)}
          />

          {/* Term hierarchy */}
          {termStore.groups.length === 0 && (
            <Caption1 style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', display: 'block', padding: tokens.spacingVerticalM }}>
              No terms defined. Go to Term Store to add terms.
            </Caption1>
          )}

          {termStore.groups.filter(g => !search || visibleGroupIds.has(g.id)).map((group, gi) => {
            const color = groupBadgeColor(gi)
            const expanded = search ? true : expandedGroups.has(group.id)
            const groupTermSets = termStore.termSets.filter(ts => ts.groupId === group.id)
            return (
              <div key={group.id}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', cursor: 'pointer', userSelect: 'none' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleGroup(group.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(group.id) } }}
                >
                  {expanded ? <ChevronDownRegular fontSize={14} /> : <ChevronRightRegular fontSize={14} />}
                  <Badge appearance="tint" color={color} size="small">{group.name}</Badge>
                </div>
                {expanded && groupTermSets.map(ts => {
                  const tsTerms = filteredTerms.filter(t => t.termSetId === ts.id)
                  if (tsTerms.length === 0) return null
                  return (
                    <div key={ts.id} style={{ marginLeft: '20px', marginBottom: tokens.spacingVerticalXS }}>
                      <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '4px', fontWeight: tokens.fontWeightSemibold }}>
                        {ts.name}
                      </Caption1>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {tsTerms.map(term => {
                          const already = appliedIds.has(term.id)
                          return (
                            <button
                              key={term.id}
                              onClick={() => already ? onRemove(resource.id, term.id) : handleAdd(term)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '4px 8px', border: 'none', borderRadius: tokens.borderRadiusMedium,
                                cursor: 'pointer', textAlign: 'left',
                                backgroundColor: already ? tokens.colorBrandBackground2 : 'transparent',
                                width: '100%',
                              }}
                            >
                              <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {already && <CheckmarkRegular fontSize={14} style={{ color: tokens.colorBrandForeground1 }} />}
                              </span>
                              <Text style={{ fontSize: tokens.fontSizeBase200 }}>{term.name}</Text>
                              {term.synonyms.length > 0 && (
                                <Caption1 style={{ color: tokens.colorNeutralForeground3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {term.synonyms.join(', ')}
                                </Caption1>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </DrawerBody>
    </OverlayDrawer>
  )
}

// ── Tag Browser ───────────────────────────────────────────────────────────────

function TagBrowserView({ allResources, allEnvironments, currentUser }: { allResources: ResourceItem[]; allEnvironments: ResourceItem[]; currentUser: string }) {
  const classes = useClasses()
  const { data: termStore = { groups: [], termSets: [], terms: [] }, isLoading: storeLoading } = useTermStore()
  const { data: allTags = [], isLoading: tagsLoading } = useAllResourceTags()
  const mutations = useTaggingMutations()
  const { widths, getResizeProps } = useResizableColumns({ resource: 260, type: 150, environment: 210, tags: 300 })

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('')
  const [panelResource, setPanelResource] = useState<ResourceItem | null>(null)
  const [showTaggedOnly, setShowTaggedOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const PAGE_SIZE_OPTIONS = [25, 50, 100, 150, 200, 300, 500, 1000]

  const envMap = useMemo(() => buildEnvMap(allEnvironments), [allEnvironments])
  const groupColorMap = useMemo(() => new Map(termStore.groups.map((g, i) => [g.id, groupBadgeColor(i)])), [termStore.groups])
  const tagsByResource = useMemo(() => {
    const m = new Map<string, ResourceTag[]>()
    for (const t of allTags) {
      const existing = m.get(t.resourceId) ?? []
      existing.push(t)
      m.set(t.resourceId, existing)
    }
    return m
  }, [allTags])

  const taggedCount = useMemo(() => new Set(allTags.map(t => t.resourceId)).size, [allTags])

  const termUsageCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of allTags) m.set(t.termId, (m.get(t.termId) ?? 0) + 1)
    return m
  }, [allTags])

  const topTerms = useMemo(() => {
    return [...termUsageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([termId, count]) => {
        const term = termStore.terms.find(t => t.id === termId)
        const color = term ? (groupColorMap.get(term.groupId) ?? 'subtle' as BColor) : 'subtle' as BColor
        return { termId, label: term?.name ?? termId, count, color }
      })
  }, [termUsageCounts, termStore.terms, groupColorMap])

  const filtered = useMemo(() => {
    let items = allResources
    if (typeFilter !== 'all') items = items.filter(r => getResourceCategory(r.type) === typeFilter)
    if (groupFilter) items = items.filter(r => tagsByResource.get(r.id)?.some(t => t.groupId === groupFilter))
    if (showTaggedOnly) items = items.filter(r => (tagsByResource.get(r.id)?.length ?? 0) > 0)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(r => getDisplayName(r).toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
    }
    return items
  }, [allResources, typeFilter, groupFilter, showTaggedOnly, search, tagsByResource])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const paginated = filtered.slice(pageStart, pageStart + pageSize)
  const displayStart = filtered.length === 0 ? 0 : pageStart + 1
  const displayEnd = Math.min(pageStart + pageSize, filtered.length)

  const isLoading = storeLoading || tagsLoading

  return (
    <div className={classes.root}>
      {/* Summary */}
      <div className={classes.summaryRow}>
        <Badge appearance="tint" color="informative" size="medium">
          <TagMultipleRegular fontSize={14} style={{ marginRight: 4 }} />
          {taggedCount} tagged resource{taggedCount !== 1 ? 's' : ''}
        </Badge>
        {topTerms.map(t => (
          <Badge key={t.termId} appearance="tint" color={t.color} size="small">{t.label} ×{t.count}</Badge>
        ))}
      </div>

      {/* Filters */}
      <div className={classes.filterBar}>
        <Input
          contentBefore={<SearchRegular />}
          placeholder="Search resources…"
          aria-label="Search resources"
          value={search}
          onChange={(_, d) => { setSearch(d.value); setCurrentPage(1) }}
          style={{ width: '220px' }}
        />
        <Select size="small" aria-label="Filter by type" value={typeFilter} onChange={(_, d) => { setTypeFilter(d.value); setCurrentPage(1) }}>
          <option value="all">All types</option>
          <option value="apps">Apps</option>
          <option value="flows">Flows</option>
          <option value="agents">Agents</option>
        </Select>
        {termStore.groups.length > 0 && (
          <Select size="small" aria-label="Filter by group" value={groupFilter} onChange={(_, d) => { setGroupFilter(d.value); setCurrentPage(1) }}>
            <option value="">All groups</option>
            {termStore.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        )}
        <Button
          size="small"
          appearance={showTaggedOnly ? 'primary' : 'subtle'}
          icon={<TagRegular />}
          onClick={() => { setShowTaggedOnly(x => !x); setCurrentPage(1) }}
        >
          {showTaggedOnly ? 'Tagged only' : 'Show all'}
        </Button>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {filtered.length} resource{filtered.length !== 1 ? 's' : ''}
        </Caption1>
      </div>

      {isLoading
        ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}><Spinner size="small" /><Caption1>Loading…</Caption1></div>
        : (
          <div className={classes.tableWrapper}>
            <div style={{ overflowX: 'auto' }}>
              <table className={classes.table}>
                <colgroup>
                  <col style={{ width: widths.resource }} />
                  <col style={{ width: widths.type }} />
                  <col style={{ width: widths.environment }} />
                  <col style={{ width: widths.tags }} />
                </colgroup>
                <thead className={classes.thead}>
                  <tr>
                    <th className={classes.th}>Resource<div {...getResizeProps('resource')} style={RESIZE_HANDLE_STYLE} /></th>
                    <th className={classes.th}>Type<div {...getResizeProps('type')} style={RESIZE_HANDLE_STYLE} /></th>
                    <th className={classes.th}>Environment<div {...getResizeProps('environment')} style={RESIZE_HANDLE_STYLE} /></th>
                    <th className={classes.th}>Tags<div {...getResizeProps('tags')} style={RESIZE_HANDLE_STYLE} /></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0
                    ? (
                      <tr>
                        <td colSpan={4} className={classes.td}>
                          <div className={classes.emptyState}>
                            <TagMultipleRegular fontSize={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                            <Text style={{ display: 'block', color: tokens.colorNeutralForeground3 }}>No resources match the current filters</Text>
                          </div>
                        </td>
                      </tr>
                    )
                    : paginated.map(r => {
                      const tags = tagsByResource.get(r.id) ?? []
                      return (
                        <tr key={r.id} className={classes.tr}>
                          <td className={classes.td}>
                            <button
                              onClick={() => setPanelResource(r)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                            >
                              <Text weight="semibold" style={{ color: tokens.colorBrandForeground1, display: 'block' }}>
                                {getDisplayName(r)}
                              </Text>
                            </button>
                          </td>
                          <td className={classes.td}>
                            <ResourceTypeBadge type={r.type} kind={r.kind} />
                          </td>
                          <td className={classes.td}>
                            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>{resolveEnvName(r, envMap)}</Caption1>
                          </td>
                          <td className={classes.td}>
                            <div className={classes.tagRow}>
                              {tags.map(t => (
                                <TagChip
                                  key={t.termId} label={t.termName}
                                  color={groupColorMap.get(t.groupId) ?? 'subtle' as BColor}
                                  onDismiss={() => mutations.removeTag.mutate({ resourceId: r.id, termId: t.termId })}
                                />
                              ))}
                              <Button
                                appearance="subtle" size="small" icon={<AddRegular fontSize={12} />}
                                title="Add tags"
                                aria-label="Add tags"
                                onClick={() => setPanelResource(r)}
                                style={{ minWidth: 0, padding: '0 4px', height: '20px' }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacingHorizontalS, padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`, borderTop: `1px solid ${tokens.colorNeutralStroke2}`, backgroundColor: tokens.colorNeutralBackground3 }}>
              <Caption1 style={{ color: tokens.colorNeutralForeground3, flex: 1, whiteSpace: 'nowrap' }}>
                {filtered.length === 0 ? 'No resources' : `Showing ${displayStart}–${displayEnd} of ${filtered.length} resource${filtered.length !== 1 ? 's' : ''}`}
              </Caption1>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
                <Button size="small" appearance="secondary" disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)}>← Prev</Button>
                <Caption1 style={{ color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'center' }}>Page {safePage} of {totalPages}</Caption1>
                <Button size="small" appearance="secondary" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next →</Button>
                <select
                  value={pageSize}
                  aria-label="Results per page"
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                  style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${tokens.colorNeutralStroke1}`, color: tokens.colorNeutralForeground1, backgroundColor: tokens.colorNeutralBackground1, cursor: 'pointer', marginLeft: '4px' }}
                >
                  {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} per page</option>)}
                </select>
              </div>
            </div>
          </div>
        )
      }

      <TagPickerPanel
        resource={panelResource}
        environments={allEnvironments}
        allTags={allTags}
        termStore={termStore}
        currentUser={currentUser}
        isOpen={!!panelResource}
        onClose={() => setPanelResource(null)}
        onAdd={tag => mutations.addTag.mutate(tag)}
        onRemove={(rid, tid) => mutations.removeTag.mutate({ resourceId: rid, termId: tid })}
      />
    </div>
  )
}

// ── Term Store Manager ────────────────────────────────────────────────────────

type EditTarget = { kind: 'group'; item: TermGroup } | { kind: 'termset'; item: TermSet } | { kind: 'term'; item: Term } | null
type AddTarget = { kind: 'group' } | { kind: 'termset'; groupId: string } | { kind: 'term'; termSetId: string; groupId: string } | null
type SeedState = 'idle' | 'seeding' | 'done' | 'error'

interface TermStoreManagerProps {
  allResources: ResourceItem[]
  allEnvironments: ResourceItem[]
  currentUser: string
}

function TermStoreManager({ allResources, allEnvironments, currentUser }: TermStoreManagerProps) {
  const classes = useClasses()
  const qc = useQueryClient()
  const { data: store = { groups: [], termSets: [], terms: [] }, isLoading } = useTermStore()
  const mutations = useTaggingMutations()

  const [seedState, setSeedState] = useState<SeedState>('idle')
  const [seedProgress, setSeedProgress] = useState({ done: 0, total: 0 })
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null)

  const handleSeedDemoTags = async () => {
    if (seedState === 'seeding') return
    setSeedState('seeding')
    setSeedProgress({ done: 0, total: 0 })
    setSeedResult(null)
    try {
      const result = await seedDemoTags(
        allResources, store, allEnvironments, currentUser,
        (done, total) => setSeedProgress({ done, total }),
      )
      setSeedResult(result)
      setSeedState(result.errors.length > 0 ? 'error' : 'done')
      qc.invalidateQueries({ queryKey: ['allResourceTags'] })
    } catch (e) {
      setSeedResult({ resourcesTagged: 0, tagsCreated: 0, errors: [String(e)] })
      setSeedState('error')
    }
  }

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedTermSetId, setSelectedTermSetId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<EditTarget>(null)
  const [adding, setAdding] = useState<AddTarget>(null)

  // Form fields
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formSynonyms, setFormSynonyms] = useState('')
  const [formIsOpen, setFormIsOpen] = useState(true)
  const [formIsActive, setFormIsActive] = useState(true)

  const startAdd = (target: AddTarget) => {
    setAdding(target)
    setEditing(null)
    setFormName(''); setFormDesc(''); setFormSynonyms(''); setFormIsOpen(true); setFormIsActive(true)
  }

  const startEdit = (target: EditTarget) => {
    setEditing(target)
    setAdding(null)
    if (!target) return
    if (target.kind === 'group') { setFormName(target.item.name); setFormDesc(target.item.description) }
    if (target.kind === 'termset') { setFormName(target.item.name); setFormDesc(target.item.description); setFormIsOpen(target.item.isOpen) }
    if (target.kind === 'term') { setFormName(target.item.name); setFormDesc(target.item.description); setFormSynonyms(target.item.synonyms.join(', ')); setFormIsActive(target.item.isActive) }
  }

  const cancelForm = () => { setEditing(null); setAdding(null) }

  const saveForm = () => {
    if (!formName.trim()) return

    if (editing) {
      if (editing.kind === 'group') {
        mutations.saveGroup.mutate({ ...editing.item, name: formName.trim(), description: formDesc.trim() })
      } else if (editing.kind === 'termset') {
        mutations.saveTermSet.mutate({ ...editing.item, name: formName.trim(), description: formDesc.trim(), isOpen: formIsOpen })
      } else if (editing.kind === 'term') {
        mutations.saveTerm.mutate({ ...editing.item, name: formName.trim(), description: formDesc.trim(), synonyms: formSynonyms.split(',').map(s => s.trim()).filter(Boolean), isActive: formIsActive })
      }
    } else if (adding) {
      if (adding.kind === 'group') {
        mutations.saveGroup.mutate({ id: newId(), name: formName.trim(), description: formDesc.trim(), sortOrder: store.groups.length })
      } else if (adding.kind === 'termset') {
        const grp = store.groups.find(g => g.id === adding.groupId)!
        mutations.saveTermSet.mutate({ id: newId(), name: formName.trim(), description: formDesc.trim(), groupId: adding.groupId, isOpen: formIsOpen, sortOrder: store.termSets.filter(ts => ts.groupId === adding.groupId).length })
        setExpandedGroups(prev => new Set([...prev, grp.id]))
      } else if (adding.kind === 'term') {
        mutations.saveTerm.mutate({ id: newId(), name: formName.trim(), description: formDesc.trim(), termSetId: adding.termSetId, groupId: adding.groupId, synonyms: formSynonyms.split(',').map(s => s.trim()).filter(Boolean), sortOrder: store.terms.filter(t => t.termSetId === adding.termSetId).length, isActive: formIsActive })
        setSelectedTermSetId(adding.termSetId)
      }
    }
    cancelForm()
  }

  const deleteGroup = (g: TermGroup) => {
    const tsIds = store.termSets.filter(ts => ts.groupId === g.id).map(ts => ts.id)
    store.terms.filter(t => tsIds.includes(t.termSetId)).forEach(t => mutations.removeTerm.mutate(t.id))
    store.termSets.filter(ts => ts.groupId === g.id).forEach(ts => mutations.removeTermSet.mutate(ts.id))
    mutations.removeGroup.mutate(g.id)
    if (selectedGroupId === g.id) { setSelectedGroupId(null); setSelectedTermSetId(null) }
  }

  const deleteTermSet = (ts: TermSet) => {
    store.terms.filter(t => t.termSetId === ts.id).forEach(t => mutations.removeTerm.mutate(t.id))
    mutations.removeTermSet.mutate(ts.id)
    if (selectedTermSetId === ts.id) setSelectedTermSetId(null)
  }

  const deleteTerm = (t: Term) => { mutations.removeTerm.mutate(t.id) }

  const selectedTermSet = store.termSets.find(ts => ts.id === selectedTermSetId)
  const selectedGroupForTs = selectedTermSet ? store.groups.find(g => g.id === selectedTermSet.groupId) : null
  const selectedGroupIdx = store.groups.findIndex(g => g.id === selectedGroupForTs?.id)
  const tsTerms = selectedTermSet ? store.terms.filter(t => t.termSetId === selectedTermSet.id).sort((a, b) => a.sortOrder - b.sortOrder) : []

  const InlineForm = (
    <div className={classes.inlineForm}>
      <Input placeholder="Name *" aria-label="Name" value={formName} onChange={(_, d) => setFormName(d.value)} size="small" />
      <Input placeholder="Description (optional)" aria-label="Description" value={formDesc} onChange={(_, d) => setFormDesc(d.value)} size="small" />
      {(adding?.kind === 'term' || editing?.kind === 'term') && (
        <>
          <Input placeholder="Synonyms (comma separated)" aria-label="Synonyms (comma separated)" value={formSynonyms} onChange={(_, d) => setFormSynonyms(d.value)} size="small" />
          <Checkbox label="Available for tagging" checked={formIsActive} onChange={(_, d) => setFormIsActive(!!d.checked)} />
        </>
      )}
      {(adding?.kind === 'termset' || editing?.kind === 'termset') && (
        <Checkbox label="Open (allow tagging with new terms)" checked={formIsOpen} onChange={(_, d) => setFormIsOpen(!!d.checked)} />
      )}
      <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS, marginTop: '2px' }}>
        <Button size="small" appearance="primary" icon={<SaveRegular />} onClick={saveForm} disabled={!formName.trim()}>Save</Button>
        <Button size="small" appearance="subtle" onClick={cancelForm}>Cancel</Button>
      </div>
    </div>
  )

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}><Spinner size="small" /><Caption1>Loading term store…</Caption1></div>

  return (
    <div className={classes.root}>
      {/* Demo data seeder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' }}>
        <Button
          appearance="subtle"
          size="small"
          icon={seedState === 'seeding' ? <Spinner size="tiny" /> : <SparkleRegular />}
          disabled={seedState === 'seeding' || store.terms.length === 0}
          onClick={handleSeedDemoTags}
        >
          Seed Demo Tags
        </Button>
        {seedState === 'seeding' && (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            Writing tags… {seedProgress.total > 0 ? `${seedProgress.done}/${seedProgress.total}` : ''}
          </Caption1>
        )}
        {seedState === 'done' && seedResult && (
          <Caption1 style={{ color: tokens.colorPaletteGreenForeground1 }}>
            Done — {seedResult.resourcesTagged} resources tagged with {seedResult.tagsCreated} tags
          </Caption1>
        )}
        {seedState === 'error' && seedResult && (
          <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>
            {seedResult.tagsCreated > 0
              ? `Partial: ${seedResult.tagsCreated} tags written, ${seedResult.errors.length} error(s)`
              : `Failed: ${seedResult.errors[0] ?? 'Unknown error'}`}
          </Caption1>
        )}
      </div>
      <div className={classes.tsLayout}>
        {/* Tree */}
        <div className={classes.tsTree}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacingVerticalS, padding: '0 4px' }}>
            <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 }}>GROUPS</Text>
            <Button size="small" appearance="subtle" icon={<AddRegular fontSize={12} />} onClick={() => startAdd({ kind: 'group' })} title="Add group" aria-label="Add group" />
          </div>

          {adding?.kind === 'group' && <div style={{ marginBottom: tokens.spacingVerticalXS }}>{InlineForm}</div>}

          {store.groups.length === 0 && (
            <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', textAlign: 'center', padding: tokens.spacingVerticalM }}>
              No groups yet. Add one above.
            </Caption1>
          )}

          {store.groups.map((group, gi) => {
            const color = groupBadgeColor(gi)
            const expanded = expandedGroups.has(group.id)
            const groupTermSets = store.termSets.filter(ts => ts.groupId === group.id).sort((a, b) => a.sortOrder - b.sortOrder)
            const isEditingThis = editing?.kind === 'group' && editing.item.id === group.id

            return (
              <div key={group.id} className={classes.treeGroup}>
                <div
                  className={selectedGroupId === group.id ? classes.treeGroupHeaderActive : classes.treeGroupHeader}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedGroupId(group.id)
                    setExpandedGroups(prev => {
                      const next = new Set(prev)
                      if (next.has(group.id)) next.delete(group.id); else next.add(group.id)
                      return next
                    })
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault();
                    setSelectedGroupId(group.id)
                    setExpandedGroups(prev => {
                      const next = new Set(prev)
                      if (next.has(group.id)) next.delete(group.id); else next.add(group.id)
                      return next
                    })
                  } }}
                >
                  {expanded ? <ChevronDownRegular fontSize={14} /> : <ChevronRightRegular fontSize={14} />}
                  <Badge appearance="tint" color={color} size="small" style={{ flexShrink: 0 }}>{group.name}</Badge>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3, marginLeft: 'auto', flexShrink: 0 }}>{groupTermSets.length}</Caption1>
                </div>

                {isEditingThis && <div style={{ margin: '4px 0' }}>{InlineForm}</div>}

                {expanded && (
                  <div>
                    {adding?.kind === 'termset' && adding.groupId === group.id && (
                      <div style={{ paddingLeft: '24px', marginBottom: '2px' }}>{InlineForm}</div>
                    )}
                    {groupTermSets.map(ts => {
                      const isEditingTs = editing?.kind === 'termset' && editing.item.id === ts.id
                      return (
                        <div key={ts.id}>
                          <div
                            className={selectedTermSetId === ts.id ? classes.treeTermSetActive : classes.treeTermSet}
                            role="button"
                            tabIndex={0}
                            onClick={() => { setSelectedTermSetId(ts.id); setSelectedGroupId(group.id) }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTermSetId(ts.id); setSelectedGroupId(group.id) } }}
                          >
                            <BookmarkRegular fontSize={14} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ts.name}</span>
                            <Caption1 style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}>
                              {store.terms.filter(t => t.termSetId === ts.id).length}
                            </Caption1>
                          </div>
                          {isEditingTs && <div style={{ paddingLeft: '24px', margin: '2px 0' }}>{InlineForm}</div>}
                        </div>
                      )
                    })}
                    <button
                      onClick={e => { e.stopPropagation(); startAdd({ kind: 'termset', groupId: group.id }) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px 4px 24px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', color: tokens.colorBrandForeground1, fontSize: tokens.fontSizeBase200, borderRadius: tokens.borderRadiusMedium }}
                    >
                      <AddRegular fontSize={12} /> Add term set
                    </button>
                    <div style={{ display: 'flex', gap: 4, padding: '2px 8px', justifyContent: 'flex-end' }}>
                      <Button size="small" appearance="subtle" icon={<EditRegular fontSize={12} />} onClick={e => { e.stopPropagation(); startEdit({ kind: 'group', item: group }) }} title="Edit group" aria-label="Edit group" />
                      <Button size="small" appearance="subtle" icon={<DeleteRegular fontSize={12} />} onClick={e => { e.stopPropagation(); deleteGroup(group) }} title="Delete group" aria-label="Delete group" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        <div className={classes.tsDetail}>
          {!selectedTermSet ? (
            <div className={classes.emptyState}>
              <BookmarkRegular fontSize={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              <Text style={{ display: 'block', color: tokens.colorNeutralForeground3 }}>Select a term set from the tree to manage its terms</Text>
            </div>
          ) : (
            <>
              {/* Term set header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spacingHorizontalS }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {selectedGroupForTs && <Badge appearance="tint" color={groupBadgeColor(selectedGroupIdx)} size="small">{selectedGroupForTs.name}</Badge>}
                    <Text weight="semibold">{selectedTermSet.name}</Text>
                    <Badge appearance="tint" color={selectedTermSet.isOpen ? 'success' : 'warning'} size="small">
                      {selectedTermSet.isOpen ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                  {selectedTermSet.description && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{selectedTermSet.description}</Caption1>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => startEdit({ kind: 'termset', item: selectedTermSet })}>Edit</Button>
                  <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => deleteTermSet(selectedTermSet)}>Delete</Button>
                </div>
              </div>

              {editing?.kind === 'termset' && editing.item.id === selectedTermSet.id && InlineForm}

              <Divider />

              {/* Terms */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text weight="semibold" style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 }}>
                  TERMS ({tsTerms.length})
                </Text>
                <Button size="small" appearance="subtle" icon={<AddRegular />} onClick={() => startAdd({ kind: 'term', termSetId: selectedTermSet.id, groupId: selectedTermSet.groupId })}>
                  Add Term
                </Button>
              </div>

              {adding?.kind === 'term' && adding.termSetId === selectedTermSet.id && InlineForm}

              {tsTerms.length === 0 && !adding && (
                <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', textAlign: 'center', padding: tokens.spacingVerticalM }}>
                  No terms yet. Add one to start tagging.
                </Caption1>
              )}

              {tsTerms.map(term => {
                const isEditingTerm = editing?.kind === 'term' && editing.item.id === term.id
                return (
                  <div key={term.id} className={classes.termRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Text style={{ fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase200 }}>{term.name}</Text>
                        {!term.isActive && <Badge appearance="tint" color="warning" size="small">Inactive</Badge>}
                      </div>
                      {term.description && <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>{term.description}</Caption1>}
                      {term.synonyms.length > 0 && (
                        <Caption1 style={{ color: tokens.colorNeutralForeground3, fontStyle: 'italic', display: 'block' }}>
                          Also: {term.synonyms.join(', ')}
                        </Caption1>
                      )}
                      {isEditingTerm && <div style={{ marginTop: tokens.spacingVerticalXS }}>{InlineForm}</div>}
                    </div>
                    {!isEditingTerm && (
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <Button size="small" appearance="subtle" icon={<EditRegular fontSize={14} />} onClick={() => startEdit({ kind: 'term', item: term })} title="Edit" aria-label="Edit term" />
                        <Button size="small" appearance="subtle" icon={<DeleteRegular fontSize={14} />} onClick={() => deleteTerm(term)} title="Delete" aria-label="Delete term" />
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ResourceTaggingView({ allResources, allEnvironments, currentUser, view }: ResourceTaggingViewProps) {
  const classes = useClasses()

  if (!tableStorageConfigured) {
    return (
      <div className={classes.root}>
        <div className={classes.setupNotice}>
          <InfoRegular fontSize={20} style={{ color: tokens.colorStatusWarningForeground1, marginTop: 2, flexShrink: 0 }} />
          <div>
            <Text weight="semibold" style={{ display: 'block', color: tokens.colorStatusWarningForeground1 }}>Azure Table Storage not configured</Text>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: 4 }}>
              Set <code>VITE_STORAGE_ACCOUNT</code> and <code>VITE_TABLE_SAS</code> to enable cloud storage.
              Tags will be saved to browser local storage in the meantime.
            </Caption1>
          </div>
        </div>
        {view === 'browser'
          ? <TagBrowserView allResources={allResources} allEnvironments={allEnvironments} currentUser={currentUser} />
          : <TermStoreManager allResources={allResources} allEnvironments={allEnvironments} currentUser={currentUser} />
        }
      </div>
    )
  }

  return view === 'browser'
    ? <TagBrowserView allResources={allResources} allEnvironments={allEnvironments} currentUser={currentUser} />
    : <TermStoreManager allResources={allResources} allEnvironments={allEnvironments} currentUser={currentUser} />
}
