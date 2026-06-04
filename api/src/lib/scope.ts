// Record-scope ('own') ownership test, ported from the frontend's
// getOwnerFromProperties (src/types/index.ts). A resource is "owned" by the caller
// when any of its owner/creator fields resolves to the caller's Entra oid or UPN.
//
// TODO (co-owner / shared-with): the confirmed design also counts resources the
// user is shared on. That requires the PowerApps admin per-resource permissions
// endpoint (GET .../apps/{id}/permissions) and is intentionally not done here to
// avoid an extra call per row; add it as a follow-up, ideally fetched in bulk.

interface OwnedResource {
  properties?: Record<string, unknown>
}

const OWNER_FIELDS = [
  'owner', 'createdBy', 'lastModifiedBy', 'author', 'createdByUser',
  'modifiedBy', 'modifiedByUser', 'publishedBy', 'ownerObjectId',
]

function candidateIdentities(item: OwnedResource): string[] {
  const p = item.properties
  if (!p) return []
  const out: string[] = []
  for (const field of OWNER_FIELDS) {
    const v = p[field]
    if (typeof v === 'string' && v) {
      out.push(v)
    } else if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      for (const k of ['id', 'objectId', 'userPrincipalName', 'email']) {
        if (typeof obj[k] === 'string' && obj[k]) out.push(obj[k] as string)
      }
    }
  }
  return out
}

export function ownsResource(item: OwnedResource, oid: string, upn: string): boolean {
  const wanted = new Set([oid.toLowerCase(), upn.toLowerCase()].filter(Boolean))
  return candidateIdentities(item).some(id => wanted.has(id.toLowerCase()))
}
