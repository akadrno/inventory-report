import { IPublicClientApplication } from '@azure/msal-browser'
import { graphAuditLogScopes } from '../auth/msalConfig'

// Minimal shape we need from Microsoft Graph's signIn entity.
// https://learn.microsoft.com/en-us/graph/api/resources/signin
export interface SignInRecord {
  id: string
  createdDateTime: string
  userPrincipalName?: string
  appId?: string
  appDisplayName?: string
  location?: {
    city?: string
    state?: string
    countryOrRegion?: string
    geoCoordinates?: { latitude?: number; longitude?: number }
  }
  status?: { errorCode?: number; failureReason?: string }
}

export interface FetchSignInsOptions {
  /** ISO datetime (UTC). Sign-ins on or after this time. */
  since: string
  /** Optional Entra App IDs to scope to. When empty, returns all tenant sign-ins. */
  appIds?: string[]
  /** Soft cap so we don't burn through a huge tenant's log. Defaults to 5000. */
  maxRecords?: number
  /** Optional cancellation signal. */
  signal?: AbortSignal
}

export interface FetchSignInsResult {
  records: SignInRecord[]
  truncated: boolean
  totalFetched: number
}

const GRAPH = 'https://graph.microsoft.com/v1.0/auditLogs/signIns'

async function getGraphToken(msal: IPublicClientApplication): Promise<string> {
  const accounts = msal.getAllAccounts()
  if (!accounts.length) throw new Error('No authenticated account found')
  const res = await msal.acquireTokenSilent({
    scopes: graphAuditLogScopes,
    account: accounts[0],
  })
  return res.accessToken
}

function buildInitialUrl(opts: FetchSignInsOptions): string {
  const filters: string[] = [`createdDateTime ge ${opts.since}`]
  if (opts.appIds && opts.appIds.length) {
    const ored = opts.appIds.map(id => `appId eq '${id}'`).join(' or ')
    filters.push(`(${ored})`)
  }
  const params = new URLSearchParams({
    $top: '999',
    $filter: filters.join(' and '),
    $select: 'id,createdDateTime,userPrincipalName,appId,appDisplayName,location,status',
  })
  return `${GRAPH}?${params.toString()}`
}

export async function fetchSignIns(
  msal: IPublicClientApplication,
  opts: FetchSignInsOptions,
): Promise<FetchSignInsResult> {
  const token = await getGraphToken(msal)
  const maxRecords = opts.maxRecords ?? 5000
  const records: SignInRecord[] = []
  let url: string | undefined = buildInitialUrl(opts)
  let truncated = false

  while (url && records.length < maxRecords) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: opts.signal,
    })
    if (!res.ok) {
      // Surface a sharper error for the common "permission missing" case so
      // the UI can render a useful banner instead of a generic 4xx string.
      if (res.status === 403 || res.status === 401) {
        const body = await res.text().catch(() => '')
        throw new Error(
          `Sign-in logs unavailable (HTTP ${res.status}). The app needs AuditLog.Read.All ` +
          `Graph permission with admin consent. ${body.slice(0, 200)}`,
        )
      }
      throw new Error(`Graph signIns query failed: ${res.status} ${res.statusText}`)
    }
    const json = (await res.json()) as { value?: SignInRecord[]; '@odata.nextLink'?: string }
    for (const r of json.value ?? []) {
      records.push(r)
      if (records.length >= maxRecords) { truncated = !!json['@odata.nextLink']; break }
    }
    url = records.length < maxRecords ? json['@odata.nextLink'] : undefined
    if (!truncated && !url) break
  }

  return { records, truncated, totalFetched: records.length }
}

// ─── Aggregation ───────────────────────────────────────────────────────────────

export interface LocationBucket {
  /** Lower-cased city|country key so we de-dupe consistently. */
  key: string
  city: string
  country: string
  lat: number
  lng: number
  count: number
  uniqueUsers: number
}

export function aggregateByLocation(records: SignInRecord[]): LocationBucket[] {
  const buckets = new Map<string, LocationBucket & { users: Set<string> }>()
  for (const r of records) {
    const loc = r.location
    const lat = loc?.geoCoordinates?.latitude
    const lng = loc?.geoCoordinates?.longitude
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    const city = loc?.city ?? ''
    const country = loc?.countryOrRegion ?? ''
    const key = `${country}|${city}|${lat.toFixed(2)}|${lng.toFixed(2)}`.toLowerCase()
    const upn = (r.userPrincipalName ?? '').toLowerCase()
    let entry = buckets.get(key)
    if (!entry) {
      entry = {
        key, city, country, lat, lng, count: 0, uniqueUsers: 0,
        users: new Set<string>(),
      }
      buckets.set(key, entry)
    }
    entry.count += 1
    if (upn) entry.users.add(upn)
  }
  return [...buckets.values()].map(b => ({
    key: b.key, city: b.city, country: b.country, lat: b.lat, lng: b.lng,
    count: b.count, uniqueUsers: b.users.size,
  })).sort((a, b) => b.count - a.count)
}

export function aggregateByCountry(buckets: LocationBucket[]): { country: string; count: number; uniqueUsers: number }[] {
  const m = new Map<string, { country: string; count: number; users: Set<string> }>()
  // We don't have the user set per-country in LocationBucket, so we approximate
  // uniqueUsers by summing per-bucket uniques — overcounts users that signed in
  // from multiple cities within one country.
  for (const b of buckets) {
    const c = b.country || 'Unknown'
    const e = m.get(c) ?? { country: c, count: 0, users: new Set<string>() }
    e.count += b.count
    // approximate
    for (let i = 0; i < b.uniqueUsers; i++) e.users.add(`${c}|${b.key}|${i}`)
    m.set(c, e)
  }
  return [...m.values()].map(e => ({ country: e.country, count: e.count, uniqueUsers: e.users.size }))
    .sort((a, b) => b.count - a.count)
}
