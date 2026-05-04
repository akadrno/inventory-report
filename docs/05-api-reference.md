# API Reference

This application calls three Microsoft APIs from the browser using delegated permissions. No backend server is involved — all calls are made directly from the user's browser session using tokens acquired via MSAL.

---

## Authentication

All API calls use **OAuth 2.0 delegated access** via the [Microsoft Authentication Library (MSAL.js)](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-browser).

- Token acquisition: silent (`acquireTokenSilent`) with popup fallback (`acquireTokenPopup`)
- Token storage: `sessionStorage` (cleared when the browser tab is closed)
- Authority: `https://login.microsoftonline.com/{tenantId}`

---

## 1. Power Platform Resource Query API

**Base URL:** `https://api.powerplatform.com`

**Used for:** Fetching all Power Apps, Power Automate flows, Copilot Studio agents, and environments across the tenant.

### Endpoint

```
POST https://api.powerplatform.com/resourcequery/resources/query?api-version=2022-03-01-preview
```

### Request body

The API accepts a Kusto-like filter and projection syntax:

```json
{
  "query": {
    "top": 200,
    "skipToken": "<pagination token>",
    "filter": {
      "type": {
        "in": [
          "Microsoft.PowerApps/apps",
          "Microsoft.Flow/flows",
          "Microsoft.PowerVirtualAgents/bots",
          "Microsoft.PowerPlatform/environments"
        ]
      }
    }
  }
}
```

### Authentication scope

```
https://api.powerplatform.com/.default
```

### Pagination

The API returns a `skipToken` in the response when more results are available. The app loops until `skipToken` is absent.

### Official documentation

- [Power Platform API overview](https://learn.microsoft.com/rest/api/power-platform/)
- [Resource Query API](https://learn.microsoft.com/rest/api/power-platform/resource-query)
- [Power Platform admin extensibility](https://learn.microsoft.com/power-platform/admin/programmability-extensibility-overview)

---

## 2. Business Application Platform (BAP) API

**Base URL:** `https://api.bap.microsoft.com`

**Used for:** DLP policies and tenant-level Power Platform settings.

### Endpoint — DLP Policies

```
GET https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/apiPolicies?api-version=2016-11-01
```

Returns all Data Loss Prevention (DLP) policies defined in the tenant. The app uses this to check which environments have a DLP policy applied.

### Endpoint — Tenant Settings

```
POST https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/listTenantSettings?api-version=2021-04-01
Content-Type: application/json

{}
```

Returns the full set of tenant-level Power Platform settings (e.g., ability to create environments, trial policies, sharing controls).

### Authentication scope

```
https://api.bap.microsoft.com/.default
```

### Official documentation

- [Power Platform programmability and extensibility](https://learn.microsoft.com/power-platform/admin/programmability-extensibility-overview)
- [DLP policies via API](https://learn.microsoft.com/power-platform/admin/powerapps-powershell#data-loss-prevention-dlp-policy-commands)
- [Tenant settings reference](https://learn.microsoft.com/power-platform/admin/tenant-settings)
- [Power Platform admin connector](https://learn.microsoft.com/connectors/powerplatformforadmins/)

---

## 3. Microsoft Graph API

**Base URL:** `https://graph.microsoft.com/v1.0`

**Used for:** Resolving Azure AD object IDs (GUIDs) to human-readable display names for resource owners.

### Endpoint — Batch user/service principal lookup

```
POST https://graph.microsoft.com/v1.0/$batch
```

The app collects all unique owner GUIDs from the Power Platform resources and resolves them in batches of up to 20 using the `$batch` endpoint:

```json
{
  "requests": [
    {
      "id": "1",
      "method": "GET",
      "url": "/users/{id}?$select=displayName,userPrincipalName"
    },
    {
      "id": "2",
      "method": "GET",
      "url": "/servicePrincipals/{id}?$select=displayName,appDisplayName"
    }
  ]
}
```

If a GUID is not found as a user, it retries as a service principal (to handle app/SPN ownership). Unknown GUIDs are displayed as-is.

### Authentication scope

```
https://graph.microsoft.com/User.ReadBasic.All
```

### Official documentation

- [Microsoft Graph overview](https://learn.microsoft.com/graph/overview)
- [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer)
- [Batch requests](https://learn.microsoft.com/graph/json-batching)
- [List users](https://learn.microsoft.com/graph/api/user-list)
- [List service principals](https://learn.microsoft.com/graph/api/serviceprincipal-list)
- [`User.ReadBasic.All` permission](https://learn.microsoft.com/graph/permissions-reference#user-permissions)

---

## API permission summary

The table below matches each API to the permissions that must be configured in the Azure AD App Registration:

| API | Permission type | Scope / Permission name | Admin consent required |
|---|---|---|---|
| Power Platform API | Delegated | `https://api.powerplatform.com/.default` | Yes |
| BAP API | Delegated | `https://api.bap.microsoft.com/.default` | Yes |
| Microsoft Graph | Delegated | `User.ReadBasic.All` | No (but recommended) |

---

## Rate limits and quotas

| API | Notes |
|---|---|
| Power Platform Resource Query | Paginated; the app fetches up to 200 resources per page |
| BAP API | No published limit; single call per session |
| Microsoft Graph `$batch` | Max 20 requests per batch; the app chunks automatically |

---

## Data residency and privacy

- All API calls are made to Microsoft-owned infrastructure.
- No data is sent to any third-party service.
- No data is persisted beyond the browser session (tokens in `sessionStorage`, API responses in React Query's in-memory cache).
- The application is read-only; it does not write, modify, or delete any resource.

---

## Additional learning resources

| Resource | URL |
|---|---|
| Power Platform admin documentation | https://learn.microsoft.com/power-platform/admin/ |
| Power Platform CoE Starter Kit | https://learn.microsoft.com/power-platform/guidance/coe/starter-kit |
| Microsoft Graph documentation | https://learn.microsoft.com/graph/ |
| MSAL.js documentation | https://learn.microsoft.com/azure/active-directory/develop/msal-overview |
| Azure Static Web Apps documentation | https://learn.microsoft.com/azure/static-web-apps/ |
| Power Platform Licensing guide | https://learn.microsoft.com/power-platform/admin/pricing-billing-skus |
| Managed Environments overview | https://learn.microsoft.com/power-platform/admin/managed-environment-overview |
| DLP policies overview | https://learn.microsoft.com/power-platform/admin/wp-data-loss-prevention |
