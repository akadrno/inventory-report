import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  loadTermStore, upsertTermGroup, deleteTermGroup,
  upsertTermSet, deleteTermSet,
  upsertTerm, deleteTerm,
  loadAllResourceTags, upsertResourceTag, deleteResourceTag,
  tableStorageConfigured,
} from '../api/tableStorageApi'

export type { TermGroup, TermSet, Term, ResourceTag, TermStoreData } from '../api/tableStorageApi'

// ── localStorage fallback (same pattern as assessments) ──────────────────────

const LS_TERM_STORE = 'ppac_term_store'
const LS_RESOURCE_TAGS = 'ppac_resource_tags'

import type { TermStoreData, ResourceTag } from '../api/tableStorageApi'

function lsLoadTermStore(): TermStoreData {
  try {
    const raw = localStorage.getItem(LS_TERM_STORE)
    return raw ? (JSON.parse(raw) as TermStoreData) : { groups: [], termSets: [], terms: [] }
  } catch { return { groups: [], termSets: [], terms: [] } }
}

function lsSaveTermStore(data: TermStoreData) {
  try { localStorage.setItem(LS_TERM_STORE, JSON.stringify(data)) } catch { /* quota */ }
}

function lsLoadTags(): ResourceTag[] {
  try {
    const raw = localStorage.getItem(LS_RESOURCE_TAGS)
    return raw ? (JSON.parse(raw) as ResourceTag[]) : []
  } catch { return [] }
}

function lsSaveTags(tags: ResourceTag[]) {
  try { localStorage.setItem(LS_RESOURCE_TAGS, JSON.stringify(tags)) } catch { /* quota */ }
}

// ── Query keys ────────────────────────────────────────────────────────────────

const TERM_STORE_KEY = ['termStore']
const TAGS_KEY = ['allResourceTags']

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useTermStore() {
  return useQuery<TermStoreData>({
    queryKey: TERM_STORE_KEY,
    queryFn: () => tableStorageConfigured ? loadTermStore() : lsLoadTermStore(),
    staleTime: 30_000,
  })
}

export function useAllResourceTags() {
  return useQuery<ResourceTag[]>({
    queryKey: TAGS_KEY,
    queryFn: () => tableStorageConfigured ? loadAllResourceTags() : lsLoadTags(),
    staleTime: 15_000,
  })
}

export function useTaggingMutations() {
  const qc = useQueryClient()
  const invalidateStore = () => qc.invalidateQueries({ queryKey: TERM_STORE_KEY })
  const invalidateTags = () => qc.invalidateQueries({ queryKey: TAGS_KEY })

  // LS helpers that mirror the async API shape
  const lsUpsertGroup = async (g: import('../api/tableStorageApi').TermGroup) => {
    const d = lsLoadTermStore()
    const idx = d.groups.findIndex(x => x.id === g.id)
    if (idx >= 0) d.groups[idx] = g; else d.groups.push(g)
    lsSaveTermStore(d)
  }
  const lsDeleteGroup = async (id: string) => {
    const d = lsLoadTermStore()
    const tsIds = d.termSets.filter(ts => ts.groupId === id).map(ts => ts.id)
    d.groups = d.groups.filter(g => g.id !== id)
    d.termSets = d.termSets.filter(ts => ts.groupId !== id)
    d.terms = d.terms.filter(t => !tsIds.includes(t.termSetId))
    lsSaveTermStore(d)
  }
  const lsUpsertTermSet = async (ts: import('../api/tableStorageApi').TermSet) => {
    const d = lsLoadTermStore()
    const idx = d.termSets.findIndex(x => x.id === ts.id)
    if (idx >= 0) d.termSets[idx] = ts; else d.termSets.push(ts)
    lsSaveTermStore(d)
  }
  const lsDeleteTermSet = async (id: string) => {
    const d = lsLoadTermStore()
    d.termSets = d.termSets.filter(ts => ts.id !== id)
    d.terms = d.terms.filter(t => t.termSetId !== id)
    lsSaveTermStore(d)
  }
  const lsUpsertTerm = async (t: import('../api/tableStorageApi').Term) => {
    const d = lsLoadTermStore()
    const idx = d.terms.findIndex(x => x.id === t.id)
    if (idx >= 0) d.terms[idx] = t; else d.terms.push(t)
    lsSaveTermStore(d)
  }
  const lsDeleteTerm = async (id: string) => {
    const d = lsLoadTermStore()
    d.terms = d.terms.filter(t => t.id !== id)
    lsSaveTermStore(d)
  }
  const lsAddTag = async (tag: ResourceTag) => {
    const tags = lsLoadTags().filter(t => !(t.resourceId === tag.resourceId && t.termId === tag.termId))
    tags.push(tag)
    lsSaveTags(tags)
  }
  const lsRemoveTag = async (args: { resourceId: string; termId: string }) => {
    lsSaveTags(lsLoadTags().filter(t => !(t.resourceId === args.resourceId && t.termId === args.termId)))
  }

  return {
    saveGroup: useMutation({
      mutationFn: (g: import('../api/tableStorageApi').TermGroup) => tableStorageConfigured ? upsertTermGroup(g) : lsUpsertGroup(g),
      onSuccess: invalidateStore,
    }),
    removeGroup: useMutation({
      mutationFn: (id: string) => tableStorageConfigured ? deleteTermGroup(id) : lsDeleteGroup(id),
      onSuccess: invalidateStore,
    }),
    saveTermSet: useMutation({
      mutationFn: (ts: import('../api/tableStorageApi').TermSet) => tableStorageConfigured ? upsertTermSet(ts) : lsUpsertTermSet(ts),
      onSuccess: invalidateStore,
    }),
    removeTermSet: useMutation({
      mutationFn: (id: string) => tableStorageConfigured ? deleteTermSet(id) : lsDeleteTermSet(id),
      onSuccess: invalidateStore,
    }),
    saveTerm: useMutation({
      mutationFn: (t: import('../api/tableStorageApi').Term) => tableStorageConfigured ? upsertTerm(t) : lsUpsertTerm(t),
      onSuccess: invalidateStore,
    }),
    removeTerm: useMutation({
      mutationFn: (id: string) => tableStorageConfigured ? deleteTerm(id) : lsDeleteTerm(id),
      onSuccess: invalidateStore,
    }),
    addTag: useMutation({
      mutationFn: (tag: ResourceTag) => tableStorageConfigured ? upsertResourceTag(tag) : lsAddTag(tag),
      onSuccess: invalidateTags,
    }),
    removeTag: useMutation({
      mutationFn: (args: { resourceId: string; termId: string }) =>
        tableStorageConfigured ? deleteResourceTag(args.resourceId, args.termId) : lsRemoveTag(args),
      onSuccess: invalidateTags,
    }),
  }
}
