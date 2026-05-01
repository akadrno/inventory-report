import { Configuration, PublicClientApplication } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_CLIENT_ID as string
const tenantId = (import.meta.env.VITE_TENANT_ID as string) || 'akadrno.onmicrosoft.com'

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

export const powerPlatformScopes = ['https://api.powerplatform.com/.default']
export const graphScopes = ['https://graph.microsoft.com/User.ReadBasic.All']
export const bapScopes = ['https://api.bap.microsoft.com/.default']

export const msalInstance = new PublicClientApplication(msalConfig)
