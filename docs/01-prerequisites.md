# Prerequisites

Before you can deploy or run the Power Platform Inventory Report, confirm you have everything listed below.

---

## Permissions

| Requirement | Why |
|---|---|
| **Power Platform Administrator** or **Global Administrator** role | The signed-in user must be able to read all environments, DLP policies, and tenant settings across the entire tenant |
| **Azure AD** permission to create App Registrations | Required to create the identity the app uses to call APIs |
| **Azure Subscription** (for hosting) | Required only if you want to deploy to Azure Static Web Apps; not needed for local development |

> If you do not have Power Platform Administrator rights, the APIs will return empty results or HTTP 403 errors. The application does not elevate permissions beyond what your account already has.

---

## Software (local development or CI/CD)

| Tool | Minimum version | Download |
|---|---|---|
| Node.js | 18 LTS | https://nodejs.org |
| npm | 9 (bundled with Node 18) | bundled |
| Git | any recent version | https://git-scm.com |

Verify after installing:

```bash
node --version   # v18.x.x or higher
npm --version    # 9.x.x or higher
git --version
```

---

## Accounts and services

| Account/Service | Notes |
|---|---|
| **Microsoft 365 / Azure AD tenant** | The tenant whose Power Platform data you want to view |
| **GitHub account** | Required for the CI/CD deployment option |
| **Azure subscription** | Required for the Azure Static Web Apps hosting option |

---

## Browser

Any modern Chromium-based browser (Edge, Chrome) or Firefox. The app uses the [MSAL.js popup/redirect flow](https://learn.microsoft.com/azure/active-directory/develop/msal-js-initializing-client-applications), which requires pop-ups to be allowed for the hosted domain.

---

## Network access

The browser running the app must be able to reach:

| Host | Purpose |
|---|---|
| `login.microsoftonline.com` | Azure AD authentication |
| `api.powerplatform.com` | Power Platform Resource Query API |
| `api.bap.microsoft.com` | BAP API — DLP policies and tenant settings |
| `graph.microsoft.com` | Microsoft Graph — user display names |

No backend server or Azure Function is involved. All calls are made directly from the browser.

---

Next: [App Registration & Admin Consent](02-app-registration.md)
