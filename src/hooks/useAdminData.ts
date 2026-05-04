import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { loadAllAssessments, upsertAssessment, deleteAssessment, tableStorageConfigured } from '../api/tableStorageApi'

export type RiskLevel = 'None' | 'Low' | 'Medium' | 'High' | 'Critical'
export type ComplianceStatus = 'Not Reviewed' | 'In Review' | 'Compliant' | 'Non-Compliant' | 'Exempted'

export interface ResourceAssessment {
  resourceId: string
  riskLevel: RiskLevel
  complianceStatus: ComplianceStatus
  notes: string
  riskNotes: string
  lastUpdated: string
  updatedBy: string
}

// localStorage fallback (used when Table Storage is not configured)
const LS_KEY = 'ppac_admin_assessments'

function lsLoad(): Record<string, ResourceAssessment> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ResourceAssessment>) : {}
  } catch { return {} }
}

function lsSave(data: Record<string, ResourceAssessment>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch { /* quota */ }
}

async function fetchAssessments(): Promise<Record<string, ResourceAssessment>> {
  if (tableStorageConfigured) return loadAllAssessments()
  return lsLoad()
}

export function useAdminData() {
  const queryClient = useQueryClient()

  const { data = {}, isLoading, error } = useQuery({
    queryKey: ['assessments'],
    queryFn: fetchAssessments,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const saveMutation = useMutation({
    mutationFn: async (assessment: ResourceAssessment) => {
      if (tableStorageConfigured) {
        await upsertAssessment(assessment)
      } else {
        const next = { ...lsLoad(), [assessment.resourceId]: assessment }
        lsSave(next)
      }
      return assessment
    },
    onMutate: async (assessment) => {
      await queryClient.cancelQueries({ queryKey: ['assessments'] })
      const prev = queryClient.getQueryData<Record<string, ResourceAssessment>>(['assessments'])
      queryClient.setQueryData<Record<string, ResourceAssessment>>(['assessments'], old => ({
        ...(old ?? {}),
        [assessment.resourceId]: assessment,
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['assessments'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['assessments'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      if (tableStorageConfigured) {
        await deleteAssessment(resourceId)
      } else {
        const next = { ...lsLoad() }
        delete next[resourceId]
        lsSave(next)
      }
    },
    onMutate: async (resourceId) => {
      await queryClient.cancelQueries({ queryKey: ['assessments'] })
      const prev = queryClient.getQueryData<Record<string, ResourceAssessment>>(['assessments'])
      queryClient.setQueryData<Record<string, ResourceAssessment>>(['assessments'], old => {
        const next = { ...(old ?? {}) }
        delete next[resourceId]
        return next
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['assessments'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['assessments'] }),
  })

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-assessments-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [data])

  const importData = useCallback(async (json: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(json) as Record<string, ResourceAssessment>
      if (tableStorageConfigured) {
        await Promise.all(Object.values(parsed).map(upsertAssessment))
      } else {
        lsSave(parsed)
      }
      queryClient.invalidateQueries({ queryKey: ['assessments'] })
      return true
    } catch { return false }
  }, [queryClient])

  return {
    data,
    isLoading,
    error: error as Error | null,
    save: saveMutation.mutate,
    remove: removeMutation.mutate,
    exportData,
    importData,
  }
}
