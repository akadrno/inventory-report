import { createContext, useCallback, useContext, useRef, useState } from 'react'

export interface DebugEntry {
  id: string
  timestamp: Date
  requestUrl: string
  requestBody: unknown
  status?: number
  responseBody?: string
  durationMs: number
  error?: string
}

interface DebugContextValue {
  entries: DebugEntry[]
  addEntry: (entry: Omit<DebugEntry, 'id'>) => void
  unknownTypes: string[]
  setUnknownTypes: (types: string[]) => void
  clear: () => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const DebugContext = createContext<DebugContextValue | null>(null)

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<DebugEntry[]>([])
  const [unknownTypes, setUnknownTypes] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const counter = useRef(0)

  const addEntry = useCallback((entry: Omit<DebugEntry, 'id'>) => {
    const id = String(++counter.current)
    setEntries(prev => [{ ...entry, id }, ...prev].slice(0, 50))
  }, [])

  const clear = useCallback(() => setEntries([]), [])

  return (
    <DebugContext.Provider value={{ entries, addEntry, unknownTypes, setUnknownTypes, clear, isOpen, setIsOpen }}>
      {children}
    </DebugContext.Provider>
  )
}

export function useDebug() {
  const ctx = useContext(DebugContext)
  if (!ctx) throw new Error('useDebug must be used within DebugProvider')
  return ctx
}
