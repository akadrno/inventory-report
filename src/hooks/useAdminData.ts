import { useState, useCallback } from 'react'

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

const STORAGE_KEY = 'ppac_admin_assessments'

function loadFromStorage(): Record<string, ResourceAssessment> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ResourceAssessment>) : {}
  } catch {
    return {}
  }
}

function saveToStorage(data: Record<string, ResourceAssessment>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage quota exceeded — fail silently
  }
}

export function useAdminData() {
  const [data, setData] = useState<Record<string, ResourceAssessment>>(loadFromStorage)

  const save = useCallback((assessment: ResourceAssessment) => {
    setData(prev => {
      const next = { ...prev, [assessment.resourceId]: assessment }
      saveToStorage(next)
      return next
    })
  }, [])

  const remove = useCallback((resourceId: string) => {
    setData(prev => {
      const next = { ...prev }
      delete next[resourceId]
      saveToStorage(next)
      return next
    })
  }, [])

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

  const importData = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as Record<string, ResourceAssessment>
      saveToStorage(parsed)
      setData(parsed)
      return true
    } catch {
      return false
    }
  }, [])

  return { data, save, remove, exportData, importData }
}
