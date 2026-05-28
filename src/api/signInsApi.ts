import { IPublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import { graphAuditLogScopes } from '../auth/msalConfig'

// Minimal shape we need from Microsoft Graph's signIn entity.
// https://learn.microsoft.com/en-us/graph/api/resources/signin
export interface SignInRecord {
  id: string
  createdDateTime: string
  userPrincipalName?: string
  userDisplayName?: string
  appId?: string
  appDisplayName?: string
  clientAppUsed?: string
  ipAddress?: string
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
  /** Number of pages fetched from Graph (for debugging). */
  pagesFetched: number
}

const GRAPH = 'https://graph.microsoft.com/v1.0/auditLogs/signIns'

async function getGraphToken(msal: IPublicClientApplication): Promise<string> {
  const accounts = msal.getAllAccounts()
  if (!accounts.length) throw new Error('No authenticated account found')
  const account = accounts[0]
  try {
    const res = await msal.acquireTokenSilent({ scopes: graphAuditLogScopes, account })
    return res.accessToken
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      const res = await msal.acquireTokenPopup({ scopes: graphAuditLogScopes, account })
      return res.accessToken
    }
    throw e
  }
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
    // Pull richer fields so we can surface app names, IPs, success/fail in
    // the UI without re-fetching.
    $select: [
      'id', 'createdDateTime',
      'userPrincipalName', 'userDisplayName',
      'appId', 'appDisplayName', 'clientAppUsed',
      'ipAddress', 'location', 'status',
    ].join(','),
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
  let pagesFetched = 0

  while (url && records.length < maxRecords) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: opts.signal,
    })
    pagesFetched++
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        const body = await res.text().catch(() => '')
        throw new Error(
          `Sign-in logs unavailable (HTTP ${res.status}). The signed-in user needs ` +
          `the AuditLog.Read.All Graph permission AND an Entra role that can read ` +
          `audit logs (Reports Reader, Security Reader, Global Reader, or Global Admin). ` +
          `${body.slice(0, 200)}`,
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

  return { records, truncated, totalFetched: records.length, pagesFetched }
}

// ─── Aggregation ───────────────────────────────────────────────────────────────

export interface LocationBucket {
  /** Lower-cased "country|city|lat|lng" key so we de-dupe consistently. */
  key: string
  city: string
  country: string
  lat: number
  lng: number
  count: number
  uniqueUsers: number
  users: string[]   // up to first 10, for popup display
  apps: string[]    // up to first 10 distinct app display names
}

export interface CountBucket {
  label: string
  count: number
}

export interface SignInDiagnostics {
  totalRecords: number
  withGeo: number
  withoutGeo: number
  successful: number
  failed: number
  distinctUsers: number
  distinctApps: number
}

export function diagnoseSignIns(records: SignInRecord[]): SignInDiagnostics {
  const users = new Set<string>()
  const apps = new Set<string>()
  let withGeo = 0, withoutGeo = 0, successful = 0, failed = 0
  for (const r of records) {
    const lat = r.location?.geoCoordinates?.latitude
    const lng = r.location?.geoCoordinates?.longitude
    if (typeof lat === 'number' && typeof lng === 'number') withGeo++
    else withoutGeo++
    if ((r.status?.errorCode ?? 0) === 0) successful++
    else failed++
    if (r.userPrincipalName) users.add(r.userPrincipalName.toLowerCase())
    if (r.appDisplayName) apps.add(r.appDisplayName)
  }
  return {
    totalRecords: records.length,
    withGeo, withoutGeo, successful, failed,
    distinctUsers: users.size, distinctApps: apps.size,
  }
}

export function aggregateByLocation(records: SignInRecord[]): LocationBucket[] {
  // Track unique users by UPN (canonical identity) but display the friendly
  // name in the popup. Falls back to UPN when displayName is missing.
  const map = new Map<string, LocationBucket & {
    upnSet: Set<string>
    nameByUpn: Map<string, string>
    appSet: Set<string>
  }>()
  for (const r of records) {
    const loc = r.location
    const lat = loc?.geoCoordinates?.latitude
    const lng = loc?.geoCoordinates?.longitude
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    const city = loc?.city ?? ''
    const country = loc?.countryOrRegion ?? ''
    // Use coarser precision so nearby IPs in the same city collapse to one
    // bucket (Entra's IP→geo can vary by ~0.01 deg for the same metro).
    const key = `${country}|${city}|${lat.toFixed(2)}|${lng.toFixed(2)}`.toLowerCase()
    const upn = (r.userPrincipalName ?? '').toLowerCase()
    const displayName = r.userDisplayName?.trim() || r.userPrincipalName || ''
    const app = r.appDisplayName ?? ''
    let entry = map.get(key)
    if (!entry) {
      entry = {
        key, city, country, lat, lng,
        count: 0, uniqueUsers: 0, users: [], apps: [],
        upnSet: new Set<string>(),
        nameByUpn: new Map<string, string>(),
        appSet: new Set<string>(),
      }
      map.set(key, entry)
    }
    entry.count += 1
    if (upn) {
      entry.upnSet.add(upn)
      // First non-empty display name wins; later records that lack it don't clobber.
      if (displayName && !entry.nameByUpn.has(upn)) entry.nameByUpn.set(upn, displayName)
    } else if (displayName) {
      // No UPN — fall back to using the display name as both identity + label.
      entry.upnSet.add(displayName.toLowerCase())
      entry.nameByUpn.set(displayName.toLowerCase(), displayName)
    }
    if (app) entry.appSet.add(app)
  }
  return [...map.values()].map(b => ({
    key: b.key, city: b.city, country: b.country, lat: b.lat, lng: b.lng,
    count: b.count,
    uniqueUsers: b.upnSet.size,
    users: [...b.upnSet].slice(0, 10).map(upn => b.nameByUpn.get(upn) ?? upn),
    apps: [...b.appSet].slice(0, 10),
  })).sort((a, b) => b.count - a.count)
}

export function aggregateByField(
  records: SignInRecord[],
  pick: (r: SignInRecord) => string | undefined,
  fallback = 'Unknown',
): CountBucket[] {
  const m = new Map<string, number>()
  for (const r of records) {
    const v = pick(r)?.trim() || fallback
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}
