import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { msalInstance } from './auth/msalConfig'
import { DebugProvider } from './context/DebugContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={webLightTheme}>
      <MsalProvider instance={msalInstance}>
        <QueryClientProvider client={queryClient}>
          <DebugProvider>
            <App />
          </DebugProvider>
        </QueryClientProvider>
      </MsalProvider>
    </FluentProvider>
  </StrictMode>,
)
