import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components'
import { msalInstance } from './auth/msalConfig'
import { DebugProvider } from './context/DebugContext'
import { SignInCacheProvider } from './context/SignInCacheContext'
import { ThemeProvider, useThemeMode } from './context/ThemeContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
})

function ThemedApp() {
  const { mode } = useThemeMode()
  return (
    <FluentProvider theme={mode === 'dark' ? webDarkTheme : webLightTheme}>
      <MsalProvider instance={msalInstance}>
        <QueryClientProvider client={queryClient}>
          <DebugProvider>
            <SignInCacheProvider>
              <App />
            </SignInCacheProvider>
          </DebugProvider>
        </QueryClientProvider>
      </MsalProvider>
    </FluentProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </StrictMode>,
)
