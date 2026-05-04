import type { ResourceAssessment } from '../hooks/useAdminData'

const ACCOUNT = import.meta.env.VITE_STORAGE_ACCOUNT as string | undefined
const SAS = import.meta.env.VITE_TABLE_SAS as string | undefined
const TABLE = 'assessments'
const PARTITION_KEY = 'ppac'

export const tableStorageConfigured = !!(ACCOUNT && SAS)

// Resource IDs contain characters forbidden in RowKey (/, \, #, ?)
// Use base64url encoding to produce safe keys
function encodeRowKey(resourceId: string): string {
  const bytes = new TextEncoder().encode(resourceId)
  const bin = Array.from(bytes).map(b => String.fromCodePoint(b)).join('')
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodeRowKey(rowKey: string): string {
  const b64 = rowKey.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin.split('').map(c => c.charCodeAt(0)))
  return new TextDecoder().decode(bytes)
}

const JSON_HEADERS: Record<string, string> = {
  Accept: 'application/json;odata=nometadata',
  'Content-Type': 'application/json',
  'x-ms-version': '2019-02-02',
}

function entityUrl(rowKey?: string): string {
  const base = `https://${ACCOUNT}.table.core.windows.net/${TABLE}`
  const key = rowKey
    ? `(PartitionKey='${encodeURIComponent(PARTITION_KEY)}',RowKey='${encodeURIComponent(rowKey)}')`
    : ''
  return `${base}${key}?${SAS}`
}

export async function loadAllAssessments(): Promise<Record<string, ResourceAssessment>> {
  if (!tableStorageConfigured) return {}
  const res = await fetch(entityUrl(), { headers: JSON_HEADERS })
  if (!res.ok) throw new Error(`Table Storage load failed: ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { value: Record<string, unknown>[] }
  const result: Record<string, ResourceAssessment> = {}
  for (const entity of json.value ?? []) {
    try {
      const resourceId = decodeRowKey(entity['RowKey'] as string)
      result[resourceId] = {
        resourceId,
        riskLevel: (entity['riskLevel'] as ResourceAssessment['riskLevel']) ?? 'None',
        complianceStatus: (entity['complianceStatus'] as ResourceAssessment['complianceStatus']) ?? 'Not Reviewed',
        notes: (entity['notes'] as string) ?? '',
        riskNotes: (entity['riskNotes'] as string) ?? '',
        lastUpdated: (entity['lastUpdated'] as string) ?? '',
        updatedBy: (entity['updatedBy'] as string) ?? '',
      }
    } catch {
      // skip any malformed entity
    }
  }
  return result
}

export async function upsertAssessment(assessment: ResourceAssessment): Promise<void> {
  if (!tableStorageConfigured) return
  const rowKey = encodeRowKey(assessment.resourceId)
  const body = {
    PartitionKey: PARTITION_KEY,
    RowKey: rowKey,
    resourceId: assessment.resourceId,
    riskLevel: assessment.riskLevel,
    complianceStatus: assessment.complianceStatus,
    notes: assessment.notes,
    riskNotes: assessment.riskNotes,
    lastUpdated: assessment.lastUpdated,
    updatedBy: assessment.updatedBy,
  }
  const res = await fetch(entityUrl(rowKey), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Table Storage upsert failed: ${res.status} ${res.statusText}`)
}

export async function deleteAssessment(resourceId: string): Promise<void> {
  if (!tableStorageConfigured) return
  const rowKey = encodeRowKey(resourceId)
  const res = await fetch(entityUrl(rowKey), {
    method: 'DELETE',
    headers: { ...JSON_HEADERS, 'If-Match': '*' },
  })
  if (!res.ok && res.status !== 404) throw new Error(`Table Storage delete failed: ${res.status} ${res.statusText}`)
}
