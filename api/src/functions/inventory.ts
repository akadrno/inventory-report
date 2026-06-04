import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { requirePage } from '../lib/permissions'
import { getAppToken, SCOPES } from '../lib/tokens'
import { ownsResource } from '../lib/scope'
import { errorResponse, json } from '../lib/http'

const API_URL = 'https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01'

const DEFAULT_CLAUSES = [
  {
    $type: 'where',
    FieldName: 'type',
    Operator: 'in~',
    Values: [
      "'microsoft.powerapps/canvasapps'",
      "'microsoft.powerapps/modeldrivenapps'",
      "'microsoft.powerapps/codeapps'",
      "'microsoft.powerautomate/cloudflows'",
      "'microsoft.powerautomate/agentflows'",
      "'microsoft.powerautomate/m365agentflows'",
      "'microsoft.copilotstudio/agents'",
      "'microsoft.powerapps/apps'",
      "'microsoft.flow/flows'",
      "'microsoft.powerapps/flows'",
      "'microsoft.powerva/bots'",
      "'microsoft.powervirtualagents/bots'",
      "'microsoft.logic/workflows'",
    ],
  },
]

interface ResourceItem {
  id: string
  name: string
  type: string
  properties?: Record<string, unknown>
}

interface ResourceQueryResponse {
  count: number
  totalRecords: number
  resultTruncated: number
  skipToken?: string
  data: ResourceItem[]
}

// GET /api/inventory/resources?skipToken=...&top=...
// Template for all data-proxy endpoints: (1) gate on the page permission, (2) fetch
// with the SP app-only token, (3) record-scope filter when the caller is 'own'.
async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    const perms = await requirePage(caller, 'inventory:all')

    const skipToken = req.query.get('skipToken') ?? undefined
    const top = Number(req.query.get('top') ?? '100')

    const token = await getAppToken(SCOPES.powerPlatform)
    const body = {
      TableName: 'PowerPlatformResources',
      Clauses: DEFAULT_CLAUSES,
      Options: { Top: top, ...(skipToken ? { SkipToken: skipToken } : { Skip: 0 }) },
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) return json({ error: `Power Platform query failed (${res.status}): ${text}` }, res.status)

    const payload = JSON.parse(text) as ResourceQueryResponse

    // Record scoping: when the role limits the user to their own records, drop
    // resources they don't own. NOTE: co-owner / shared-with expansion is a TODO —
    // it needs the PowerApps admin per-resource permissions endpoint (see scope.ts).
    if (perms.recordScope === 'own') {
      payload.data = (payload.data ?? []).filter(r => ownsResource(r, caller.oid, caller.upn))
      payload.count = payload.data.length
    }

    return json(payload)
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('inventory-resources', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'inventory/resources',
  handler,
})
