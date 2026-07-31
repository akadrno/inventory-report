# Prerequisites

> [!IMPORTANT]
> This is unsupported sample code, not a Microsoft product. Microsoft Support does not support its installation or operation. See [SUPPORT.md](../SUPPORT.md).

The minimum requirements below are enough to run the sample locally. Hosting, persistent storage, licensing, sharing, and sign-in analytics are optional extensions.

---

## Minimum requirements

| Requirement | Why |
|---|---|
| **Power Platform tenant** | Source tenant for inventory and governance data |
| **Power Platform Administrator** or **Global Administrator** account | Runs the sample with tenant-wide read access supported by the APIs |
| Permission to create a Microsoft Entra app registration | Creates the single-tenant SPA identity used by the sample |
| Tenant administrator who can grant consent | Grants the Power Platform API delegated permission |
| Node.js 20 LTS or later and npm | Builds and runs the local Vite application |
| Git | Clones and updates the repository |

> If you do not have Power Platform Administrator rights, the APIs will return empty results or HTTP 403 errors. The application does not elevate permissions beyond what your account already has.

---

## Required software

| Tool | Minimum version | Download |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| npm | Bundled with Node.js | bundled |
| Git | any recent version | https://git-scm.com |

Verify after installing:

```bash
node --version   # v20.x.x or higher
npm --version
git --version
```

---

## Optional features and requirements

| Feature | Additional requirement |
|---|---|
| Friendly owner names | Microsoft Graph delegated `User.ReadBasic.All` |
| Connections and sharing details | Power Apps Service delegated `User` permission (`https://service.powerapps.com/.default`) |
| Licensing pages | Microsoft Graph delegated `Organization.Read.All` |
| Usage analytics and heatmap | Microsoft Graph delegated `AuditLog.Read.All` plus Reports Reader, Security Reader, Global Reader, or Global Administrator |
| Shared persistence | Azure Storage account, Table service account SAS, `VITE_STORAGE_ACCOUNT`, and `VITE_TABLE_SAS` |
| Cloud hosting | Azure subscription and Azure Static Web Apps |
| Automated deployment | GitHub repository and GitHub Actions |

If an optional permission or service is omitted, the related feature shows a permission notice, uses browser `localStorage`, or fetches live data as described in the [User Guide](04-user-guide.md).

---

## Browser

Any modern Chromium-based browser (Edge, Chrome) or Firefox. The app uses the [MSAL.js popup/redirect flow](https://learn.microsoft.com/azure/active-directory/develop/msal-js-initializing-client-applications), which requires pop-ups to be allowed for the hosted domain.

---

## Network access

The browser running the app must be able to reach:

| Host | Purpose |
|---|---|
| `login.microsoftonline.com` | Azure AD authentication |
| `api.powerplatform.com` | Power Platform inventory, governance, Advisor, and billing policies |
| `service.powerapps.com` | Power Apps Service — resource sharing / permissions |
| `graph.microsoft.com` | Microsoft Graph — user names, license capacity, sign-in logs |
| `<account>.table.core.windows.net` | Azure Table Storage *(optional)* - persisted assessments, tags, sign-in cache |

No backend server or Azure Function is involved. All calls are made directly from the browser.

The Business Application Platform (BAP) API is not used and must not be added to the app registration.

---

Next: [App Registration & Admin Consent](02-app-registration.md)
