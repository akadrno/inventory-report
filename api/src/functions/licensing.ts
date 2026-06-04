import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { requirePage } from '../lib/permissions'
import { getAppToken, SCOPES } from '../lib/tokens'
import { errorResponse, json } from '../lib/http'

// GET /api/licensing/skus — tenant subscribed SKUs (org-wide; no per-user split,
// so this is page-gated only). Mirrors graphApi.fetchSubscribedSkus.
async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    await requirePage(caller, 'licensing:summary')

    const token = await getAppToken(SCOPES.graph)
    const res = await fetch('https://graph.microsoft.com/v1.0/subscribedSkus', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const text = await res.text()
    if (!res.ok) return json({ error: `SubscribedSkus fetch failed (${res.status}): ${text}` }, res.status)
    const data = JSON.parse(text) as { value: unknown[] }
    return json(data.value ?? [])
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('licensing-skus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'licensing/skus',
  handler,
})
