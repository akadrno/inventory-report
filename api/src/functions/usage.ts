import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { requirePage } from '../lib/permissions'
import { getAppToken, SCOPES } from '../lib/tokens'
import { errorResponse, HttpError, json } from '../lib/http'

const GRAPH = 'https://graph.microsoft.com/v1.0/auditLogs/signIns'

interface SignInRecord { id: string; createdDateTime: string; [k: string]: unknown }

function buildInitialUrl(since: string, appIds: string[]): string {
  const filters: string[] = [`createdDateTime ge ${since}`]
  if (appIds.length) filters.push(`(${appIds.map(id => `appId eq '${id}'`).join(' or ')})`)
  const params = new URLSearchParams({
    $top: '999',
    $filter: filters.join(' and '),
    $select: ['id', 'createdDateTime', 'userPrincipalName', 'userDisplayName', 'appId', 'appDisplayName', 'clientAppUsed', 'ipAddress', 'location', 'status'].join(','),
  })
  return `${GRAPH}?${params.toString()}`
}

// GET /api/usage/signins?since=ISO&appIds=a,b&maxRecords=5000
// Mirrors src/api/signInsApi.ts fetchSignIns, using the app-only Graph token.
async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    await requirePage(caller, 'usage:heatmap')

    const since = req.query.get('since') ?? ''
    if (!since) throw new HttpError(400, 'since (ISO datetime) is required')
    const appIds = (req.query.get('appIds') ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const maxRecords = Number(req.query.get('maxRecords') ?? '5000')

    const token = await getAppToken(SCOPES.graph)
    const records: SignInRecord[] = []
    let url: string | undefined = buildInitialUrl(since, appIds)
    let truncated = false
    let pagesFetched = 0

    while (url && records.length < maxRecords) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      pagesFetched++
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return json({ error: `Graph signIns query failed (${res.status}): ${body.slice(0, 200)}` }, res.status)
      }
      const j = await res.json() as { value?: SignInRecord[]; '@odata.nextLink'?: string }
      for (const r of j.value ?? []) {
        records.push(r)
        if (records.length >= maxRecords) { truncated = !!j['@odata.nextLink']; break }
      }
      url = records.length < maxRecords ? j['@odata.nextLink'] : undefined
      if (!truncated && !url) break
    }

    return json({ records, truncated, totalFetched: records.length, pagesFetched })
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('usage-signins', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'usage/signins',
  handler,
})
