import { Configuration, PublicClientApplication } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_CLIENT_ID as string
const tenantId = (import.meta.env.VITE_TENANT_ID as string) || 'organizations'

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: 3, // Warning
    },
  },
}

// Scope for this app's own backend (Azure Functions). The backend app registration
// exposes an `access_as_user` delegated scope; the SPA sends a token for it as the
// Bearer to /api/*. Defaults to the frontend client id when no dedicated API app id
// is configured (single-registration setup).
const apiAppId = (import.meta.env.VITE_API_APP_ID as string) || clientId
export const apiScopes = [`api://${apiAppId}/access_as_user`]

export const powerPlatformScopes = ['https://api.powerplatform.com/.default']
export const graphScopes = ['https://graph.microsoft.com/User.ReadBasic.All']
export const graphOrgScopes = ['https://graph.microsoft.com/Organization.Read.All']
export const graphAuditLogScopes = ['https://graph.microsoft.com/AuditLog.Read.All']
export const bapScopes = ['https://api.bap.microsoft.com/.default']
export const powerAppsScopes = ['https://service.powerapps.com/.default']

export const msalInstance = new PublicClientApplication(msalConfig)
