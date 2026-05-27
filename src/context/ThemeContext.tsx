import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  toggleMode: () => void
  setMode: (m: ThemeMode) => void
}

const STORAGE_KEY = 'ppac-inventory.theme-mode'

function readInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode)

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, mode) } catch { /* ignore quota / privacy errors */ }
  }, [mode])

  const setMode = useCallback((m: ThemeMode) => setModeState(m), [])
  const toggleMode = useCallback(() => setModeState(m => (m === 'light' ? 'dark' : 'light')), [])

  const value = useMemo<ThemeContextValue>(() => ({ mode, toggleMode, setMode }), [mode, toggleMode, setMode])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode must be used inside <ThemeProvider>')
  return ctx
}
