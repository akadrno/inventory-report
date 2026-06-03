import type { ResourceAssessment } from '../hooks/useAdminData'

const ACCOUNT = import.meta.env.VITE_STORAGE_ACCOUNT as string | undefined
const SAS = import.meta.env.VITE_TABLE_SAS as string | undefined
const TABLE = 'assessments'
const PARTITION_KEY = 'ppac'

export const tableStorageConfigured = !!(ACCOUNT && SAS)

// Resource IDs contain characters forbidden in RowKey (/, \, #, ?)
// Use base64url encoding to produce safe keys
function encodeRowKey(resourceId: string): string {
  const bytes = new TextEncoder().encode(resourceId)
  const bin = Array.from(bytes).map(b => String.fromCodePoint(b)).join('')
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodeRowKey(rowKey: string): string {
  const b64 = rowKey.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin.split('').map(c => c.charCodeAt(0)))
  return new TextDecoder().decode(bytes)
}

const JSON_HEADERS: Record<string, string> = {
  Accept: 'application/json;odata=nometadata',
  'Content-Type': 'application/json',
  'x-ms-version': '2019-02-02',
}

function entityUrl(rowKey?: string): string {
  const base = `https://${ACCOUNT}.table.core.windows.net/${TABLE}`
  const key = rowKey
    ? `(PartitionKey='${encodeURIComponent(PARTITION_KEY)}',RowKey='${encodeURIComponent(rowKey)}')`
    : ''
  return `${base}${key}?${SAS}`
}

export async function loadAllAssessments(): Promise<Record<string, ResourceAssessment>> {
  if (!tableStorageConfigured) return {}
  // Scope to the assessment partition so cache rows (govcache partition, below)
  // sharing this table aren't mistaken for assessments.
  const url = `${entityUrl()}&$filter=${encodeURIComponent("PartitionKey eq '" + PARTITION_KEY + "'")}`
  const res = await fetch(url, { headers: JSON_HEADERS })
  if (!res.ok) throw new Error(`Table Storage load failed: ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { value: Record<string, unknown>[] }
  const result: Record<string, ResourceAssessment> = {}
  for (const entity of json.value ?? []) {
    try {
      const resourceId = decodeRowKey(entity['RowKey'] as string)
      result[resourceId] = {
        resourceId,
        riskLevel: (entity['riskLevel'] as ResourceAssessment['riskLevel']) ?? 'None',
        complianceStatus: (entity['complianceStatus'] as ResourceAssessment['complianceStatus']) ?? 'Not Reviewed',
        notes: (entity['notes'] as string) ?? '',
        riskNotes: (entity['riskNotes'] as string) ?? '',
        lastUpdated: (entity['lastUpdated'] as string) ?? '',
        updatedBy: (entity['updatedBy'] as string) ?? '',
      }
    } catch {
      // skip any malformed entity
    }
  }
  return result
}

export async function upsertAssessment(assessment: ResourceAssessment): Promise<void> {
  if (!tableStorageConfigured) return
  const rowKey = encodeRowKey(assessment.resourceId)
  const body = {
    PartitionKey: PARTITION_KEY,
    RowKey: rowKey,
    resourceId: assessment.resourceId,
    riskLevel: assessment.riskLevel,
    complianceStatus: assessment.complianceStatus,
    notes: assessment.notes,
    riskNotes: assessment.riskNotes,
    lastUpdated: assessment.lastUpdated,
    updatedBy: assessment.updatedBy,
  }
  const res = await fetch(entityUrl(rowKey), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Table Storage upsert failed: ${res.status} ${res.statusText}`)
}

export async function deleteAssessment(resourceId: string): Promise<void> {
  if (!tableStorageConfigured) return
  const rowKey = encodeRowKey(resourceId)
  const res = await fetch(entityUrl(rowKey), {
    method: 'DELETE',
    headers: { ...JSON_HEADERS, 'If-Match': '*' },
  })
  if (!res.ok && res.status !== 404) throw new Error(`Table Storage delete failed: ${res.status} ${res.statusText}`)
}

// ── Tag Storage ───────────────────────────────────────────────────────────────

const TERM_STORE_TABLE = 'ppacTermStore'
const RESOURCE_TAGS_TABLE = 'ppacResourceTags'

export interface TermGroup {
  id: string
  name: string
  description: string
  sortOrder: number
}

export interface TermSet {
  id: string
  name: string
  description: string
  groupId: string
  isOpen: boolean
  sortOrder: number
}

export interface Term {
  id: string
  name: string
  description: string
  termSetId: string
  groupId: string
  synonyms: string[]
  sortOrder: number
  isActive: boolean
}

export interface ResourceTag {
  resourceId: string
  termId: string
  termName: string
  termSetId: string
  termSetName: string
  groupId: string
  groupName: string
  appliedBy: string
  appliedAt: string
}

export interface TermStoreData {
  groups: TermGroup[]
  termSets: TermSet[]
  terms: Term[]
}

function tagEntityUrl(tableName: string, partitionKey?: string, rowKey?: string): string {
  const base = `https://${ACCOUNT}.table.core.windows.net/${tableName}`
  const key = partitionKey && rowKey
    ? `(PartitionKey='${encodeURIComponent(partitionKey)}',RowKey='${encodeURIComponent(rowKey)}')`
    : ''
  return `${base}${key}?${SAS}`
}

async function queryAllEntities(tableName: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = []
  let url: string | null = tagEntityUrl(tableName)
  while (url) {
    const res = await fetch(url, { headers: JSON_HEADERS })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`Tag table query failed (${tableName}): ${res.status}`)
    const json = await res.json() as { value: Record<string, unknown>[] }
    all.push(...(json.value ?? []))
    const nextPk = res.headers.get('x-ms-continuation-NextPartitionKey')
    const nextRk = res.headers.get('x-ms-continuation-NextRowKey')
    url = nextPk ? `${tagEntityUrl(tableName)}&NextPartitionKey=${encodeURIComponent(nextPk)}${nextRk ? `&NextRowKey=${encodeURIComponent(nextRk)}` : ''}` : null
  }
  return all
}

async function putTagEntity(tableName: string, pk: string, rk: string, body: Record<string, unknown>): Promise<void> {
  if (!tableStorageConfigured) return
  const res = await fetch(tagEntityUrl(tableName, pk, rk), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ PartitionKey: pk, RowKey: rk, ...body }),
  })
  if (!res.ok) throw new Error(`Tag table upsert failed (${tableName}): ${res.status} ${res.statusText}`)
}

async function deleteTagEntity(tableName: string, pk: string, rk: string): Promise<void> {
  if (!tableStorageConfigured) return
  const res = await fetch(tagEntityUrl(tableName, pk, rk), {
    method: 'DELETE',
    headers: { ...JSON_HEADERS, 'If-Match': '*' },
  })
  if (!res.ok && res.status !== 404) throw new Error(`Tag table delete failed (${tableName}): ${res.status} ${res.statusText}`)
}

export async function loadTermStore(): Promise<TermStoreData> {
  if (!tableStorageConfigured) return { groups: [], termSets: [], terms: [] }
  const entities = await queryAllEntities(TERM_STORE_TABLE)
  const groups: TermGroup[] = []
  const termSets: TermSet[] = []
  const terms: Term[] = []
  for (const e of entities) {
    const pk = e['PartitionKey'] as string
    const rk = e['RowKey'] as string
    if (pk === 'grp') {
      groups.push({ id: rk, name: (e['name'] as string) ?? '', description: (e['description'] as string) ?? '', sortOrder: (e['sortOrder'] as number) ?? 0 })
    } else if (pk === 'ts') {
      termSets.push({ id: rk, name: (e['name'] as string) ?? '', description: (e['description'] as string) ?? '', groupId: (e['groupId'] as string) ?? '', isOpen: (e['isOpen'] as boolean) ?? true, sortOrder: (e['sortOrder'] as number) ?? 0 })
    } else if (pk === 'tm') {
      let synonyms: string[] = []
      try { synonyms = JSON.parse((e['synonyms'] as string) ?? '[]') } catch { synonyms = [] }
      terms.push({ id: rk, name: (e['name'] as string) ?? '', description: (e['description'] as string) ?? '', termSetId: (e['termSetId'] as string) ?? '', groupId: (e['groupId'] as string) ?? '', synonyms, sortOrder: (e['sortOrder'] as number) ?? 0, isActive: (e['isActive'] as boolean) ?? true })
    }
  }
  return { groups, termSets, terms }
}

export async function upsertTermGroup(g: TermGroup): Promise<void> {
  await putTagEntity(TERM_STORE_TABLE, 'grp', g.id, { name: g.name, description: g.description, sortOrder: g.sortOrder })
}

export async function deleteTermGroup(id: string): Promise<void> {
  await deleteTagEntity(TERM_STORE_TABLE, 'grp', id)
}

export async function upsertTermSet(ts: TermSet): Promise<void> {
  await putTagEntity(TERM_STORE_TABLE, 'ts', ts.id, { name: ts.name, description: ts.description, groupId: ts.groupId, isOpen: ts.isOpen, sortOrder: ts.sortOrder })
}

export async function deleteTermSet(id: string): Promise<void> {
  await deleteTagEntity(TERM_STORE_TABLE, 'ts', id)
}

export async function upsertTerm(t: Term): Promise<void> {
  await putTagEntity(TERM_STORE_TABLE, 'tm', t.id, { name: t.name, description: t.description, termSetId: t.termSetId, groupId: t.groupId, synonyms: JSON.stringify(t.synonyms), sortOrder: t.sortOrder, isActive: t.isActive })
}

export async function deleteTerm(id: string): Promise<void> {
  await deleteTagEntity(TERM_STORE_TABLE, 'tm', id)
}

export async function loadAllResourceTags(): Promise<ResourceTag[]> {
  if (!tableStorageConfigured) return []
  const entities = await queryAllEntities(RESOURCE_TAGS_TABLE)
  return entities.map(e => ({
    resourceId: (e['resourceId'] as string) ?? '',
    termId: (e['RowKey'] as string) ?? '',
    termName: (e['termName'] as string) ?? '',
    termSetId: (e['termSetId'] as string) ?? '',
    termSetName: (e['termSetName'] as string) ?? '',
    groupId: (e['groupId'] as string) ?? '',
    groupName: (e['groupName'] as string) ?? '',
    appliedBy: (e['appliedBy'] as string) ?? '',
    appliedAt: (e['appliedAt'] as string) ?? '',
  }))
}

export async function upsertResourceTag(tag: ResourceTag): Promise<void> {
  const pk = encodeRowKey(tag.resourceId)
  await putTagEntity(RESOURCE_TAGS_TABLE, pk, tag.termId, {
    resourceId: tag.resourceId, termName: tag.termName,
    termSetId: tag.termSetId, termSetName: tag.termSetName,
    groupId: tag.groupId, groupName: tag.groupName,
    appliedBy: tag.appliedBy, appliedAt: tag.appliedAt,
  })
}

export async function deleteResourceTag(resourceId: string, termId: string): Promise<void> {
  await deleteTagEntity(RESOURCE_TAGS_TABLE, encodeRowKey(resourceId), termId)
}

// ── Governance JSON-blob cache ───────────────────────────────────────────────
// Caches expensive/async governance payloads (e.g. the cross-tenant connection
// report) so the page loads instantly from storage instead of regenerating the
// report each visit. Reuses the existing `assessments` table under a separate
// partition so no new table — and no table-create permission — is needed.

const CACHE_PARTITION = 'govcache'
// Table Storage caps a single string property at 32K UTF-16 chars; chunk under
// that and reassemble on read. Entity total is capped at 1 MB (~32 chunks).
const CACHE_CHUNK = 28000

export interface CachedBlob<T> {
  data: T
  cachedAt: string
}

function cacheEntityUrl(rowKey: string): string {
  const base = `https://${ACCOUNT}.table.core.windows.net/${TABLE}`
  return `${base}(PartitionKey='${encodeURIComponent(CACHE_PARTITION)}',RowKey='${encodeURIComponent(rowKey)}')?${SAS}`
}

export async function loadGovernanceCache<T>(rowKey: string): Promise<CachedBlob<T> | null> {
  if (!tableStorageConfigured) return null
  const res = await fetch(cacheEntityUrl(rowKey), { headers: JSON_HEADERS })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Governance cache load failed: ${res.status} ${res.statusText}`)
  const e = (await res.json()) as Record<string, unknown>
  const chunks: string[] = []
  for (let i = 0; i < 32; i++) {
    const c = e[`data${i}`]
    if (typeof c !== 'string') break
    chunks.push(c)
  }
  if (!chunks.length) return null
  try {
    return { data: JSON.parse(chunks.join('')) as T, cachedAt: (e['cachedAt'] as string) ?? '' }
  } catch {
    return null
  }
}

export async function saveGovernanceCache<T>(rowKey: string, data: T): Promise<string> {
  if (!tableStorageConfigured) return ''
  const cachedAt = new Date().toISOString()
  const json = JSON.stringify(data)
  const body: Record<string, unknown> = { PartitionKey: CACHE_PARTITION, RowKey: rowKey, cachedAt }
  let idx = 0
  for (let i = 0; i < json.length; i += CACHE_CHUNK, idx++) {
    body[`data${idx}`] = json.slice(i, i + CACHE_CHUNK)
  }
  if (idx > 32) throw new Error('Governance cache payload too large to store')
  // PUT fully replaces the entity, so stale chunks from a larger prior payload
  // are dropped automatically.
  const res = await fetch(cacheEntityUrl(rowKey), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Governance cache save failed: ${res.status} ${res.statusText}`)
  return cachedAt
}
