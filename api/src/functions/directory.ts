import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { validateUser } from '../lib/auth'
import { requireManageUsers } from '../lib/permissions'
import { getAppToken, SCOPES } from '../lib/tokens'
import { errorResponse, json } from '../lib/http'

interface GraphUser {
  id: string
  displayName?: string
  userPrincipalName?: string
  mail?: string
}

// GET /api/directory/search?q=  — Entra people picker. Only users who can manage
// users may search the directory. Uses the SP app-only Graph token.
async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const caller = await validateUser(req)
    await requireManageUsers(caller)

    const q = (req.query.get('q') ?? '').trim()
    if (q.length < 2) return json([])

    const token = await getAppToken(SCOPES.graph)
    const search = encodeURIComponent(`"displayName:${q}" OR "mail:${q}" OR "userPrincipalName:${q}"`)
    const url =
      `https://graph.microsoft.com/v1.0/users?$search=${search}` +
      `&$select=id,displayName,userPrincipalName,mail&$top=15`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return json({ error: `Directory search failed (${res.status}): ${text}` }, res.status)
    }
    const data = (await res.json()) as { value: GraphUser[] }
    const users = (data.value ?? []).map(u => ({
      id: u.id,
      displayName: u.displayName ?? '',
      userPrincipalName: u.userPrincipalName ?? u.mail ?? '',
      mail: u.mail,
    }))
    return json(users)
  } catch (e) {
    return errorResponse(e)
  }
}

app.http('directory-search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'directory/search',
  handler,
})
