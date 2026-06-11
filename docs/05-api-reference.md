# API Reference

This application calls several Microsoft APIs directly from the browser using **delegated** permissions — no backend server is involved. Tokens are acquired per-API via MSAL (`acquireTokenSilent` with popup fallback). An optional Azure Table Storage account (account-level SAS, no OAuth) persists a few features.

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

## 3. Power Apps Service API

**Base URL:** `https://api.powerapps.com`

**Used for:** Reading who an app is shared with (the **Sharing** section of the resource detail panel).

### Endpoint — App permissions

```
GET https://api.powerapps.com/providers/Microsoft.PowerApps/apps/{appId}/permissions?api-version=2016-11-01
```

Returns the principals (users, groups, tenant) an app is shared with and their role (`CanView`, `CanEdit`, `Owner`).

### Authentication scope

```
https://service.powerapps.com/.default
```

This scope is requested **incrementally** — only when sharing is first opened — which may surface a one-time consent popup.

### Official documentation

- [Power Apps for Admins connector](https://learn.microsoft.com/connectors/powerappsforadmins/)

---

## 4. Microsoft Graph API

**Base URL:** `https://graph.microsoft.com/v1.0`

**Used for:** Resolving owner GUIDs to display names, reading license capacity, and reading sign-in logs for the usage heatmap.

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

### Endpoint — License capacity (Licensing section)

```
GET https://graph.microsoft.com/v1.0/subscribedSkus
```

Returns the tenant's subscribed SKUs with prepaid/consumed unit counts. The app filters to Power Platform SKUs and renders capacity and utilization. Requires `Organization.Read.All`.

### Endpoint — Sign-in logs (Usage heatmap & analytics)

```
GET https://graph.microsoft.com/v1.0/auditLogs/signIns?$filter=createdDateTime ge {since}&$top=999
```

Returns Entra sign-in records (user, app, location/geo, client, status, timestamp). The app aggregates these by location, user, product, and day. Requires `AuditLog.Read.All` **and** an Entra role that can read audit logs (Reports Reader, Security Reader, Global Reader, or Global Administrator). When Azure Storage is configured, results are cached (see section 6) so the heatmap loads instantly.

### Authentication scopes

```
https://graph.microsoft.com/User.ReadBasic.All      # owner name resolution (core)
https://graph.microsoft.com/Organization.Read.All    # Licensing (optional)
https://graph.microsoft.com/AuditLog.Read.All        # Usage heatmap (optional)
```

### Official documentation

- [Microsoft Graph overview](https://learn.microsoft.com/graph/overview)
- [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer)
- [Batch requests](https://learn.microsoft.com/graph/json-batching)
- [List users](https://learn.microsoft.com/graph/api/user-list)
- [List subscribedSkus](https://learn.microsoft.com/graph/api/subscribedsku-list)
- [List signIns](https://learn.microsoft.com/graph/api/signin-list)
- [Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference)

---

## 5. Azure Table Storage *(optional)*

**Base URL:** `https://{account}.table.core.windows.net`

**Used for:** Persisting risk assessments, resource tags, and a cached Entra sign-in dataset for the usage heatmap. Configured via `VITE_STORAGE_ACCOUNT` and an account-level Table SAS (`VITE_TABLE_SAS`). When unset, risk assessments and tags fall back to `localStorage` and the heatmap fetches sign-ins live.

### Authentication

Account-level **SAS token** (not OAuth) appended to each request. The SAS needs Read, Add, Create, Update, Delete, and List permissions on the Table service. Tables must be provisioned out-of-band (an object/container-scoped SAS cannot create tables).

> **Security note:** A Table SAS is a credential. Scope it narrowly (Table service only), set a sensible expiry, and rotate it. It is embedded in the built client bundle, so treat the hosted app's storage as non-sensitive cache data.

### Official documentation

- [Table Service REST API](https://learn.microsoft.com/rest/api/storageservices/table-service-rest-api)
- [Create an account SAS](https://learn.microsoft.com/rest/api/storageservices/create-account-sas)

---

## API permission summary

The table below matches each API to the permissions that must be configured in the Azure AD App Registration:

| API | Permission type | Scope / Permission name | Admin consent required | Powers |
|---|---|---|---|---|
| Power Platform API | Delegated | `https://api.powerplatform.com/.default` | Yes | Inventory |
| BAP API | Delegated | `https://api.bap.microsoft.com/.default` | Yes | Governance |
| Power Apps Service | Delegated | `https://service.powerapps.com/.default` | Yes | Sharing |
| Microsoft Graph | Delegated | `User.ReadBasic.All` | No (but recommended) | Owner names (core) |
| Microsoft Graph | Delegated | `Organization.Read.All` | Yes | Licensing (optional) |
| Microsoft Graph | Delegated | `AuditLog.Read.All` | Yes | Usage heatmap (optional) — also needs an audit-reader Entra role |
| Azure Table Storage | Account SAS | `VITE_TABLE_SAS` | n/a | Persisted assessments, tags, sign-in cache (optional) |

---

## Rate limits and quotas

| API | Notes |
|---|---|
| Power Platform Resource Query | Paginated; the app fetches up to 200 resources per page |
| BAP API | No published limit; single call per session |
| Microsoft Graph `$batch` | Max 20 requests per batch; the app chunks automatically |

---

## Data residency and privacy

- All API calls are made to Microsoft-owned infrastructure (Microsoft Graph, Power Platform, BAP, and — if configured — your own Azure Storage account).
- No data is sent to any third-party service.
- By default no data is persisted beyond the browser session (tokens in `sessionStorage`, API responses in React Query's in-memory cache).
- **If** `VITE_STORAGE_ACCOUNT`/`VITE_TABLE_SAS` are configured, the app persists risk assessments, resource tags, and a trimmed sign-in cache to **your** Azure Table Storage; otherwise assessments/tags use `localStorage`.
- The application is read-only with respect to Power Platform — it does not create, modify, or delete apps, flows, agents, environments, or policies. The only data it writes is your risk assessments and tags, to your own storage.

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
