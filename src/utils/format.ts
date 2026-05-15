// Locale-aware value formatting helpers used by the resource detail panel.

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const SYSTEM_GUID_PREFIX = '00000000-0000-0000'

// Property keys whose value should be treated as an Entra object reference.
const PERSON_KEY_SET = new Set<string>([
  'owner', 'ownerid', 'ownerobjectid', 'owneremail',
  'createdby', 'createdbyuser', 'createdbyid', 'creator',
  'lastmodifiedby', 'lastmodifiedbyuser', 'modifiedby', 'modifiedbyuser',
  'author', 'publishedby', 'updatedby',
])

export function isGuid(value: unknown): value is string {
  return typeof value === 'string' && GUID_RE.test(value)
}

export function isSystemGuid(value: string): boolean {
  return value.startsWith(SYSTEM_GUID_PREFIX)
}

export function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value)
}

export function isPersonKey(key: string): boolean {
  return PERSON_KEY_SET.has(key.toLowerCase())
}

// Render a date string in the user's locale and timezone. Falls back to the
// raw string if parsing fails so we never lose data on display.
export function formatLocalDateTime(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// camelCase / PascalCase / snake_case → sentence case ("createdTime" → "Created time")
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

// Pull out an Entra GUID from a person-typed property value, ignoring
// system GUIDs (which represent service identities, not real users).
export function extractPersonGuid(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return isGuid(value) && !isSystemGuid(value) ? value : undefined
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // If the API already gave us a display name, no resolution needed.
    if (typeof obj.displayName === 'string' && obj.displayName) return undefined
    const id = obj.id ?? obj.objectId ?? obj.userId ?? obj.aadObjectId
    if (typeof id === 'string' && isGuid(id) && !isSystemGuid(id)) return id
  }
  return undefined
}

// Render a person-typed property value to a string, using a resolved-name
// map when the value is just a GUID.
export function formatPerson(value: unknown, nameMap: Map<string, string>): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    if (!value) return undefined
    if (isGuid(value)) {
      if (isSystemGuid(value)) return 'System'
      return nameMap.get(value) ?? value
    }
    return value
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.displayName === 'string' && obj.displayName) return obj.displayName
    if (typeof obj.email === 'string' && obj.email) return obj.email
    if (typeof obj.userPrincipalName === 'string' && obj.userPrincipalName) return obj.userPrincipalName
    const id = obj.id ?? obj.objectId ?? obj.userId ?? obj.aadObjectId
    if (typeof id === 'string') {
      if (isGuid(id)) {
        if (isSystemGuid(id)) return 'System'
        return nameMap.get(id) ?? id
      }
      return id
    }
  }
  return undefined
}

// Render a single property value as plain text — used when copying the
// friendly view to the clipboard. Mirrors the rules used by <PropertyRow>.
export function formatPropertyValueAsText(
  key: string,
  value: unknown,
  nameMap: Map<string, string>,
): string | undefined {
  if (isPersonKey(key)) {
    return formatPerson(value, nameMap)
  }
  if (typeof value === 'string' && isGuid(value)) {
    return isSystemGuid(value) ? 'System' : value
  }
  const prim = formatPrimitive(value)
  if (prim !== undefined) return String(prim)
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined
    return JSON.stringify(value, null, 2)
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.displayName === 'string' && obj.displayName) return obj.displayName
    return JSON.stringify(value, null, 2)
  }
  return undefined
}

export type PrimitiveValue = string | number | boolean

// Format a primitive value for friendly display: dates → locale, booleans → Yes/No.
// Returns undefined if the value can't be rendered as a simple primitive.
export function formatPrimitive(value: unknown): PrimitiveValue | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    if (!value.trim()) return undefined
    if (isIsoDateString(value)) return formatLocalDateTime(value)
    return value
  }
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return undefined
}
