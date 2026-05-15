import type { ResourceItem } from '../types'
import { getDisplayName, getEnvironmentName } from '../types'

const ENV_IN_PATH_RE = /\/environments\/([^/]+)/i

export function extractEnvIdFromPath(id: string): string | undefined {
  return ENV_IN_PATH_RE.exec(id)?.[1]
}

// Build a lookup map keyed by every plausible variant (full id, last path
// segment, name, and lowercased versions) so we can resolve env names
// regardless of which form a given resource carries.
export function buildEnvMap(environments: ResourceItem[] | undefined): Map<string, string> {
  const m = new Map<string, string>()
  for (const env of environments ?? []) {
    const displayName = getDisplayName(env)
    m.set(env.id, displayName)
    m.set(env.name, displayName)
    const seg = env.id.split('/').pop()
    if (seg) m.set(seg, displayName)
    m.set(env.id.toLowerCase(), displayName)
    m.set(env.name.toLowerCase(), displayName)
    if (seg) m.set(seg.toLowerCase(), displayName)
  }
  return m
}

function envMapLookup(key: string, envMap: Map<string, string>): string | undefined {
  return envMap.get(key) ?? envMap.get(key.toLowerCase())
}

export function resolveEnvironmentName(item: ResourceItem, envMap: Map<string, string>): string {
  if (item.environmentId) {
    const r = envMapLookup(item.environmentId, envMap)
    if (r) return r
  }
  const envIdFromPath = extractEnvIdFromPath(item.id)
  if (envIdFromPath) {
    const r = envMapLookup(envIdFromPath, envMap)
    if (r) return r
    // Map still loading — fall through to property-derived name before giving up.
    if (envMap.size === 0) return envIdFromPath
  }
  const raw = getEnvironmentName(item)
  if (raw) {
    const r = envMapLookup(raw, envMap)
    if (r) return r
    return raw
  }
  return envIdFromPath ?? item.environmentId ?? '—'
}
