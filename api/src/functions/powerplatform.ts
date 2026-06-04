import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { requirePage } from '../lib/permissions'
import { getAppToken, SCOPES } from '../lib/tokens'
import { ownsResource } from '../lib/scope'
import { errorResponse, HttpError, json } from '../lib/http'

const API_URL = 'https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01'

// Clause sets mirror src/api/powerPlatformApi.ts.
const RESOURCE_CLAUSES = [
  {
    $type: 'where', FieldName: 'type', Operator: 'in~',
    Values: [
      "'microsoft.powerapps/canvasapps'", "'microsoft.powerapps/modeldrivenapps'", "'microsoft.powerapps/codeapps'",
      "'microsoft.powerautomate/cloudflows'", "'microsoft.powerautomate/agentflows'", "'microsoft.powerautomate/m365agentflows'",
      "'microsoft.copilotstudio/agents'", "'microsoft.powerapps/apps'", "'microsoft.flow/flows'", "'microsoft.powerapps/flows'",
      "'microsoft.powerva/bots'", "'microsoft.powervirtualagents/bots'", "'microsoft.logic/workflows'",
    ],
  },
]
const ENVIRONMENT_CLAUSES = [
  {
    $type: 'where', FieldName: 'type', Operator: 'in~',
    Values: ["'microsoft.powerplatform/environments'", "'microsoft.businessapplicationplatform/environments'"],
  },
]
const GROUP_CLAUSES = [{ $type: 'where', FieldName: 'type', Operator: 'contains', Values: ["'environmentgroups'"] }]

type Kind = 'resources' | 'environments' | 'groups'

const KIND_CONFIG: Record<Kind, { clauses: unknown[]; pageKey: string; scoped: boolean }> = {
  resources: { clauses: RESOURCE_CLAUSES, pageKey: 'inventory:all', scoped: true },
  environments: { clauses: ENVIRONMENT_CLAUSES, pageKey: 'inventory:environments', scoped: false },
  groups: { clauses: GROUP_CLAUSES, pageKey: 'inventory:groups', scoped: false },
}

interface ResourceItem { id: string; name: string; type: string; properties?: Record<string, unknown> }
interface ResourceQueryResponse {
  count: number; totalRecords: number; resultTruncated: number; skipToken?: string; data: ResourceItem[]
}

// GET /api/powerplatform/query?kind=resources|environments|groups&skipToken=&top=
// Unified proxy for the three resourcequery shapes. Gates on the matching page key
// and applies record scoping to owned resources.
async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    const kind = (req.query.get('kind') ?? 'resources') as Kind
    const cfg = KIND_CONFIG[kind]
    if (!cfg) throw new HttpError(400, `Unknown kind: ${kind}`)

    const perms = await requirePage(caller, cfg.pageKey)

    const skipToken = req.query.get('skipToken') ?? undefined
    const top = Number(req.query.get('top') ?? '100')

    const token = await getAppToken(SCOPES.powerPlatform)
    const body = {
      TableName: 'PowerPlatformResources',
      Clauses: cfg.clauses,
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
    if (cfg.scoped && perms.recordScope === 'own') {
      payload.data = (payload.data ?? []).filter(r => ownsResource(r, caller.oid, caller.upn))
      payload.count = payload.data.length
    }
    return json(payload)
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('powerplatform-query', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'powerplatform/query',
  handler,
})
