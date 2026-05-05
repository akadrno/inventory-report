import type { TermStoreData, ResourceTag, Term } from '../api/tableStorageApi'
import type { ResourceItem } from '../types'
import { getDisplayName, getResourceCategory } from '../types'
import { upsertResourceTag } from '../api/tableStorageApi'
import { isSystemResource } from '../hooks/useOwnerNames'

export interface SeedResult {
  resourcesTagged: number
  tagsCreated: number
  errors: string[]
}

function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// [name regex, term name substrings to search for in the loaded term store]
const NAME_PATTERNS: [RegExp, string[]][] = [
  [/\bsales?\b|\bcrm\b|\bpipeline\b|\brevenue\b|\bquota\b/i,
    ['sales', 'commercial', 'revenue', 'account management', 'customer']],
  [/\bhr\b|\bhuman.?res|\bpersonnel\b|\bemployee\b|\bleave\b|\bonboard|\bpayroll\b|\brecruit/i,
    ['human resource', 'hr', 'people', 'talent', 'workforce']],
  [/\bfinanc|\baccounti|\baccounts?\b|\bbudget\b|\binvoice\b|\bexpense|\bpayable|\breceiv|\bfiscal/i,
    ['financ', 'account', 'budget', 'payment', 'fiscal']],
  [/\bhealth|\bmedic|\bclinic|\bnurs|\bpatient|\bhospital\b/i,
    ['health', 'medic', 'clinical', 'patient']],
  [/\bmarket|\bcampaign\b|\bpromo\b|\bbrand\b/i,
    ['market', 'campaign', 'promot', 'brand']],
  [/\bit\b|\btech(nol)?|\bsupport\b|\bhelpdesk\b|\bticket\b|\binfra|\bdeploy|\bdevops/i,
    ['it support', 'tech', 'helpdesk', 'infrastructure', 'operations']],
  [/\bretail\b|\bstore\b|\bshop\b|\bmerchan|\bpos\b|\bstock\b/i,
    ['retail', 'store', 'merchand']],
  [/\bapproval\b|\brequest\b|\breview\b|\bworkflow\b/i,
    ['approval', 'workflow', 'process', 'governance']],
  [/\binventor|\basset\b|\bequip/i,
    ['inventory', 'asset', 'equipment']],
  [/\bmaker\b|\bcitizen\b/i,
    ['maker', 'citizen dev', 'low-code', 'no-code']],
  [/\bpro.?dev\b|\bcode.?first\b/i,
    ['pro dev', 'professional dev', 'developer', 'fusion']],
  [/\bcopilot\b|\bagent\b|\bai\b|\bbot\b|\bchat\b|\bintelligent/i,
    ['agent', 'copilot', 'ai', 'bot', 'intelligent']],
  [/\breport\b|\bdash|\banalyti|\binsight\b|\btelemetry\b/i,
    ['report', 'analytic', 'dashboard', 'insight', 'bi']],
  [/\bnotif|\balert\b|\bremind\b/i,
    ['notification', 'alert', 'communicat']],
  [/\btraining\b|\blearn\b|\bdocument\b|\bknowledge\b/i,
    ['training', 'learn', 'document', 'knowledge']],
]

const TYPE_PATTERNS: Record<string, string[]> = {
  apps: ['canvas', 'model-driven', 'model driven', 'portal', 'app'],
  flows: ['flow', 'automat', 'scheduled', 'trigger', 'cloud flow'],
  agents: ['agent', 'copilot', 'bot', 'chatbot'],
}

const ENV_PATTERNS: [RegExp, string[]][] = [
  [/\bprod/i,                           ['production', 'prod', 'live']],
  [/\bdev\b|\bdevelop\b|\bsandbox\b/i,  ['development', 'dev', 'sandbox']],
  [/\btest\b|\buat\b|\bqa\b|\bstag/i,   ['test', 'uat', 'staging']],
]

function findMatchingTerms(substrings: string[], terms: Term[], limit: number): Term[] {
  const matches: Term[] = []
  for (const t of terms) {
    if (!t.isActive) continue
    const haystack = [t.name, ...t.synonyms].join(' ').toLowerCase()
    if (substrings.some(s => haystack.includes(s.toLowerCase()))) {
      matches.push(t)
      if (matches.length >= limit) break
    }
  }
  return matches
}

export async function seedDemoTags(
  resources: ResourceItem[],
  termStore: TermStoreData,
  environments: ResourceItem[],
  appliedBy: string,
  onProgress?: (done: number, total: number) => void,
): Promise<SeedResult> {
  const activeTerms = termStore.terms.filter(t => t.isActive)
  if (!resources.length || !activeTerms.length) {
    return { resourcesTagged: 0, tagsCreated: 0, errors: [] }
  }

  const termSetMap = new Map(termStore.termSets.map(ts => [ts.id, ts]))
  const groupMap = new Map(termStore.groups.map(g => [g.id, g]))

  const makeTag = (resourceId: string, term: Term): ResourceTag => ({
    resourceId,
    termId: term.id,
    termName: term.name,
    termSetId: term.termSetId,
    termSetName: termSetMap.get(term.termSetId)?.name ?? '',
    groupId: term.groupId,
    groupName: groupMap.get(term.groupId)?.name ?? '',
    appliedBy,
    appliedAt: new Date().toISOString(),
  })

  // Exclude system resources and resources with GUID-only names
  const candidates = resources
    .filter(r => {
      if (isSystemResource(r)) return false
      const name = getDisplayName(r)
      return name.length > 5 && !name.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)
    })
    .slice(0, 80)

  const tagsToCreate: ResourceTag[] = []

  for (const resource of candidates) {
    const name = getDisplayName(resource)
    const category = getResourceCategory(resource.type)
    const envId = resource.environmentId ??
      ((resource.properties?.['environment'] as Record<string, unknown> | undefined)?.['id'] as string | undefined) ?? ''
    const envResource = environments.find(e => e.id === envId || e.name === envId)
    const envDisplayName = envResource ? getDisplayName(envResource) : (resource.environmentName ?? '')

    const assigned = new Set<string>()
    const assign = (...terms: Term[]) => {
      for (const t of terms) {
        if (assigned.size >= 4 || assigned.has(t.id)) continue
        assigned.add(t.id)
        tagsToCreate.push(makeTag(resource.id, t))
      }
    }

    // Name-based: stop after 2 matching patterns to keep tags focused
    let nameHits = 0
    for (const [pattern, substrings] of NAME_PATTERNS) {
      if (nameHits >= 2) break
      if (pattern.test(name)) {
        const matches = findMatchingTerms(substrings, activeTerms, 2)
        if (matches.length > 0) { assign(...matches); nameHits++ }
      }
    }

    // Type-based
    const typeSubstrings = TYPE_PATTERNS[category] ?? []
    if (typeSubstrings.length > 0) {
      assign(...findMatchingTerms(typeSubstrings, activeTerms, 1))
    }

    // Environment-based
    for (const [pattern, substrings] of ENV_PATTERNS) {
      if (pattern.test(envDisplayName)) {
        assign(...findMatchingTerms(substrings, activeTerms, 1))
        break
      }
    }

    // Fallback: ensure every resource gets at least one tag using a stable hash
    if (assigned.size === 0) {
      const idx = stableHash(resource.id) % activeTerms.length
      assign(activeTerms[idx])
    }
  }

  const total = tagsToCreate.length
  let done = 0
  const errors: string[] = []
  const taggedIds = new Set(tagsToCreate.map(t => t.resourceId))

  for (const tag of tagsToCreate) {
    try {
      await upsertResourceTag(tag)
      done++
      onProgress?.(done, total)
    } catch (e) {
      errors.push(String(e))
    }
  }

  return { resourcesTagged: taggedIds.size, tagsCreated: done, errors }
}
