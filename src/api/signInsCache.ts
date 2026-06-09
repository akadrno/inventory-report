import type { IPublicClientApplication } from '@azure/msal-browser'
import { fetchSignIns, type SignInRecord } from './signInsApi'

// ─── Sign-in heatmap cache ──────────────────────────────────────────────────────
// Caches the last 30 days of Entra sign-ins in a dedicated Azure Table so the
// Usage heatmap loads instantly from storage instead of waiting on a (slow,
// paginated) Microsoft Graph pull every visit. A background job re-pulls Graph
// and refreshes the cache; a cleanup pass purges any stored login data older
// than 90 days.
//
// Reuses the same direct REST + account-SAS approach as tableStorageApi.ts so
// no backend/Functions deployment is required — this runs entirely client-side.

const ACCOUNT = import.meta.env.VITE_STORAGE_ACCOUNT as string | undefined
const SAS = import.meta.env.VITE_TABLE_SAS as string | undefined
const TABLE = 'ppacSignInCache'
const PARTITION = 'signins'
const META_ROWKEY = '__meta'

// We cache the last CACHE_DAYS days and serve the 7- and 30-day heatmap windows
// from it. RETAIN_DAYS is the hard ceiling: anything older is purged on refresh.
export const CACHE_DAYS = 30
const RETAIN_DAYS = 90

// Table Storage caps a single string property at 32K UTF-16 chars. Each day's
// records are JSON-serialized and split into chunk entities of CHUNK chars,
// keyed `${day}|${idx}`, then reassembled on read. This avoids both the 32K
// per-property and 1 MB per-entity limits for high-volume days.
const CHUNK = 28000

// Cap how much we pull from Graph in a single refresh so a huge tenant can't
// blow past Table Storage limits or run forever. Mirrors the live path's intent.
const MAX_RECORDS = 10000

export const signInCacheConfigured = !!(ACCOUNT && SAS)

const JSON_HEADERS: Record<string, string> = {
  Accept: 'application/json;odata=nometadata',
  'Content-Type': 'application/json',
  'x-ms-version': '2019-02-02',
}

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_KEY_RE = /^(\d{4}-\d{2}-\d{2})\|(\d+)$/

/** UTC day stamp 'YYYY-MM-DD' for an ISO datetime. */
function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

/** UTC day stamp N days before now. */
function dayNDaysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10)
}

function pad4(n: number): string {
  return String(n).padStart(4, '0')
}

// ─── REST helpers ────────────────────────────────────────────────────────────

function entityUrl(rowKey: string): string {
  const base = `https://${ACCOUNT}.table.core.windows.net/${TABLE}`
  const key = `(PartitionKey='${encodeURIComponent(PARTITION)}',RowKey='${encodeURIComponent(rowKey)}')`
  return `${base}${key}?${SAS}`
}

function collectionUrl(filter?: string, contPk?: string, contRk?: string): string {
  let url = `https://${ACCOUNT}.table.core.windows.net/${TABLE}?${SAS}`
  if (filter) url += `&$filter=${encodeURIComponent(filter)}`
  if (contPk) url += `&NextPartitionKey=${encodeURIComponent(contPk)}`
  if (contRk) url += `&NextRowKey=${encodeURIComponent(contRk)}`
  return url
}

/**
 * Best-effort create of the cache table. The deployed account-SAS is typically
 * scoped to entity (object) operations only and can't create tables, so a 403
 * here is expected — the table is provisioned out-of-band (see docs). We only
 * surface unexpected failures; if the table is genuinely missing, the entity
 * writes below fail loudly with a 404 instead.
 *   409 = already exists, 403 = SAS lacks table-create rights → both are fine.
 */
async function ensureTable(): Promise<void> {
  try {
    const res = await fetch(`https://${ACCOUNT}.table.core.windows.net/Tables?${SAS}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ TableName: TABLE }),
    })
    if (!res.ok && res.status !== 409 && res.status !== 403) {
      throw new Error(`Sign-in cache table create failed: ${res.status} ${res.statusText}`)
    }
  } catch {
    // Network/permission hiccups on create are non-fatal; entity writes will
    // surface a real error if the table actually doesn't exist.
  }
}

async function listEntities(filter?: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = []
  let contPk: string | undefined
  let contRk: string | undefined
  do {
    const res = await fetch(collectionUrl(filter, contPk, contRk), { headers: JSON_HEADERS })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`Sign-in cache query failed: ${res.status} ${res.statusText}`)
    const json = (await res.json()) as { value?: Record<string, unknown>[] }
    all.push(...(json.value ?? []))
    contPk = res.headers.get('x-ms-continuation-NextPartitionKey') ?? undefined
    contRk = res.headers.get('x-ms-continuation-NextRowKey') ?? undefined
  } while (contPk)
  return all
}

async function putEntity(rowKey: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(entityUrl(rowKey), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ PartitionKey: PARTITION, RowKey: rowKey, ...body }),
  })
  if (!res.ok) throw new Error(`Sign-in cache write failed: ${res.status} ${res.statusText}`)
}

async function deleteEntity(rowKey: string): Promise<void> {
  const res = await fetch(entityUrl(rowKey), {
    method: 'DELETE',
    headers: { ...JSON_HEADERS, 'If-Match': '*' },
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Sign-in cache delete failed: ${res.status} ${res.statusText}`)
  }
}

// ─── Record trimming ─────────────────────────────────────────────────────────
// Keep only the fields the heatmap actually renders/aggregates, so 30 days of
// sign-ins stay small enough to cache. Shape stays compatible with SignInRecord
// so the existing aggregation helpers work unchanged.
function trim(r: SignInRecord): SignInRecord {
  const out: SignInRecord = { id: r.id, createdDateTime: r.createdDateTime }
  if (r.userPrincipalName) out.userPrincipalName = r.userPrincipalName
  if (r.userDisplayName) out.userDisplayName = r.userDisplayName
  if (r.appId) out.appId = r.appId
  if (r.appDisplayName) out.appDisplayName = r.appDisplayName
  if (r.location) {
    const loc: NonNullable<SignInRecord['location']> = {}
    if (r.location.city) loc.city = r.location.city
    if (r.location.countryOrRegion) loc.countryOrRegion = r.location.countryOrRegion
    const lat = r.location.geoCoordinates?.latitude
    const lng = r.location.geoCoordinates?.longitude
    if (typeof lat === 'number' && typeof lng === 'number') {
      loc.geoCoordinates = { latitude: lat, longitude: lng }
    }
    out.location = loc
  }
  if (r.status) out.status = { errorCode: r.status.errorCode }
  return out
}

// ─── Read ────────────────────────────────────────────────────────────────────

export interface CachedSignIns {
  records: SignInRecord[]
  /** ISO timestamp of the most recent successful refresh, or null if never. */
  cachedAt: string | null
  /** True if the last refresh hit the Graph record cap. */
  truncated: boolean
}

/**
 * Load the cached sign-ins for the last `days` days (≤ CACHE_DAYS). RowKeys are
 * `YYYY-MM-DD|idx`, so a lexical `>=` filter on the date prefix scopes the read
 * cheaply without scanning the whole table.
 */
export async function loadCachedSignIns(days: number = CACHE_DAYS): Promise<CachedSignIns> {
  if (!signInCacheConfigured) return { records: [], cachedAt: null, truncated: false }
  const minDay = dayNDaysAgo(days)
  const entities = await listEntities(
    `PartitionKey eq '${PARTITION}' and RowKey ge '${minDay}|'`,
  )

  // Reassemble each day's chunks in order, then JSON.parse.
  const chunksByDay = new Map<string, string[]>()
  let cachedAt: string | null = null
  let truncated = false
  for (const e of entities) {
    const rk = e['RowKey'] as string
    if (rk === META_ROWKEY) {
      cachedAt = (e['cachedAt'] as string) ?? cachedAt
      truncated = (e['truncated'] as boolean) ?? truncated
      continue
    }
    const m = DAY_KEY_RE.exec(rk)
    if (!m) continue
    const day = m[1]
    const idx = Number(m[2])
    let arr = chunksByDay.get(day)
    if (!arr) { arr = []; chunksByDay.set(day, arr) }
    arr[idx] = (e['c'] as string) ?? ''
    const t = e['cachedAt'] as string | undefined
    if (t && (!cachedAt || t > cachedAt)) cachedAt = t
  }

  const records: SignInRecord[] = []
  for (const arr of chunksByDay.values()) {
    try {
      const dayRecords = JSON.parse(arr.join('')) as SignInRecord[]
      records.push(...dayRecords)
    } catch {
      // Skip a day whose chunks are incomplete/corrupt rather than failing the load.
    }
  }
  return { records, cachedAt, truncated }
}

// ─── Refresh + cleanup ─────────────────────────────────────────────────────────

export interface RefreshResult {
  recordCount: number
  cachedAt: string
  truncated: boolean
}

/**
 * Pull the last CACHE_DAYS days of sign-ins from Graph and rewrite the cache,
 * then purge anything older than RETAIN_DAYS. Intended to run as a background
 * job (the user keeps seeing the previous cache until this resolves).
 */
export async function refreshSignInCache(
  msal: IPublicClientApplication,
  opts?: { signal?: AbortSignal },
): Promise<RefreshResult> {
  if (!signInCacheConfigured) throw new Error('Azure Storage is not configured for sign-in caching.')

  const sinceIso = new Date(Date.now() - CACHE_DAYS * DAY_MS).toISOString()
  const result = await fetchSignIns(msal, {
    since: sinceIso,
    maxRecords: MAX_RECORDS,
    signal: opts?.signal,
  })

  await ensureTable()
  const cachedAt = new Date().toISOString()

  // Group trimmed records by UTC day.
  const byDay = new Map<string, SignInRecord[]>()
  for (const r of result.records) {
    const day = dayOf(r.createdDateTime)
    let arr = byDay.get(day)
    if (!arr) { arr = []; byDay.set(day, arr) }
    arr.push(trim(r))
  }

  // Write each day's chunks. Track chunk counts so cleanup can drop leftovers
  // from a previously larger day.
  const writtenChunks = new Map<string, number>()
  for (const [day, recs] of byDay) {
    const json = JSON.stringify(recs)
    const n = Math.max(1, Math.ceil(json.length / CHUNK))
    for (let i = 0; i < n; i++) {
      await putEntity(`${day}|${pad4(i)}`, { c: json.slice(i * CHUNK, (i + 1) * CHUNK), cachedAt })
    }
    writtenChunks.set(day, n)
  }

  // Stamp a meta row so we can report cachedAt even when zero records came back.
  await putEntity(META_ROWKEY, {
    cachedAt,
    recordCount: result.records.length,
    truncated: result.truncated,
  })

  await cleanup(writtenChunks)

  return { recordCount: result.records.length, cachedAt, truncated: result.truncated }
}

/**
 * Delete: (1) any day older than RETAIN_DAYS (the 90-day purge), and (2) stale
 * chunks within the refreshed window — either days we just rewrote with fewer
 * chunks, or days inside the cache window that returned no records this time.
 * Days between CACHE_DAYS and RETAIN_DAYS are left untouched to age out naturally.
 */
async function cleanup(writtenChunks: Map<string, number>): Promise<void> {
  const purgeBefore = dayNDaysAgo(RETAIN_DAYS) // delete days strictly older than this
  const windowStart = dayNDaysAgo(CACHE_DAYS)
  const entities = await listEntities(`PartitionKey eq '${PARTITION}'`)
  for (const e of entities) {
    const rk = e['RowKey'] as string
    if (rk === META_ROWKEY) continue
    const m = DAY_KEY_RE.exec(rk)
    if (!m) continue
    const day = m[1]
    const idx = Number(m[2])

    let remove = false
    if (day < purgeBefore) {
      remove = true // older than 90 days → purge
    } else if (day >= windowStart) {
      // Inside the cache window: this day should have been fully rewritten.
      const n = writtenChunks.get(day)
      if (n === undefined) remove = true   // day no longer has any records
      else if (idx >= n) remove = true     // leftover chunk from a larger prior write
    }
    if (remove) await deleteEntity(rk)
  }
}
