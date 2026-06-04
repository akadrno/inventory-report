# RBAC / Access Control — Setup & Architecture

This app has an in-app role-based access control (RBAC) system so people can use it
**without** holding Power Platform / Global admin themselves. A small Azure Functions
backend (`/api`) holds an elevated **service principal** and enforces access
server-side; the React app renders only what each user is allowed to see.

## How it works

```
Browser SPA (MSAL) ──Bearer(user token for api://<id>/access_as_user)──▶ /api (Functions)
                                                                          │ validates token (oid, upn, wids)
                                                                          │ looks up role assignments (Table Storage)
                                                                          │ computes effective permissions
                                                                          ▼
                                                  app-only token (service principal)
                                                                          ▼
                                          Power Platform / BAP / PowerApps / Graph
                                                                          │
                                       filter by page permission + record scope
                                                                          ▼
                                                       only-allowed data ──▶ SPA
```

- **Implicit admins:** anyone holding **Global Administrator**, **Power Platform
  Administrator**, or **Dynamics 365 Administrator** is automatically a full app-admin
  (sees the Admin console, can grant roles). Detected from the `wids` claim on their
  token — no extra call, and it bootstraps the first admin with zero config.
- **Roles:** 4 built-in (App Administrator, Usage Administrator, Full Viewer,
  Own-Records Viewer) plus custom roles you build in the Admin console. A role = a set
  of page/sub-page keys + flags (`isAppAdmin`, `canManageUsers`, `recordScope`).
- **Record scope `own`:** the user sees only resources they own/created (and, once the
  shared-with expansion is added, resources shared with them).

## Toggle

The whole backend is gated behind the **`VITE_API_BASE_URL`** build variable:

| Value | Mode |
|-------|------|
| unset / empty | **Legacy** — no backend; every user uses their own admin token (the app behaves exactly as before RBAC). Admin console hidden. |
| `/` | **Enabled, same-origin** — the SWA serves `/api/*`. Use this in production. |
| `https://host` | **Enabled, explicit origin** — for local dev against a separate Functions host. |

So merging this code changes nothing in production until you set `VITE_API_BASE_URL`.

## One-time Azure / Entra setup (Global Admin)

1. **Service principal** — create (or reuse) an app registration to be the elevated
   identity. Grant **application** permissions and admin-consent them:
   - Microsoft Graph: `User.Read.All`, `Organization.Read.All`, `AuditLog.Read.All`, `Directory.Read.All`
   - Register it as a Power Platform management app so app-only tokens work against
     BAP / PowerApps admin / resourcequery:
     ```powershell
     Install-Module Microsoft.PowerApps.Administration.PowerShell
     Add-PowerAppsAccount
     New-PowerAppManagementApplication -ApplicationId <sp-app-id>
     ```
   - Create a client secret **or** (preferred) a federated credential / managed identity.

2. **Frontend app registration** (`VITE_CLIENT_ID`, the powerappsscale app):
   - **Expose an API** → set Application ID URI `api://<frontend-client-id>` → add a
     delegated scope **`access_as_user`** (admin + user consent).
   - Under **Authorized client applications**, pre-authorize the same client id for the
     `access_as_user` scope (so the SPA gets the token silently).
   - Keep the existing SPA redirect URI (the SWA origin).
   - If you use a *separate* app id for the API, set `VITE_API_APP_ID` to it; otherwise
     it defaults to `VITE_CLIENT_ID`.

3. **Static Web App → Configuration (Function app settings):**
   - `TENANT_ID` = powerappsscale tenant id
   - `API_APP_ID` = the app id whose `api://…/access_as_user` scope the SPA requests
   - `SP_CLIENT_ID`, `SP_CLIENT_SECRET` = the service principal credentials
   - `STORAGE_CONNECTION_STRING` = connection string for the Table Storage account that
     holds `ppacRoles` / `ppacRoleAssignments` (tables auto-create on first write)

4. **GitHub repo secrets** (used by `.github/workflows/deploy.yml`):
   - `VITE_API_BASE_URL` = `/`
   - `VITE_API_APP_ID` = (only if using a separate API app id)

5. **Deploy** — push to `main`. The workflow now builds `./api` and deploys it with
   `--api-location ./api`.

## Local development

```bash
# Terminal 1 — API
cd api
cp local.settings.json.example local.settings.json   # fill in the values
npm install
npm start            # func start (http://localhost:7071)

# Terminal 2 — SPA
# set VITE_API_BASE_URL=http://localhost:7071 in .env.local
npm run dev
```

## Endpoints (implemented)

| Method | Route | Purpose | Guard |
|--------|-------|---------|-------|
| GET | `/api/me/permissions` | caller's effective access | any signed-in user |
| GET | `/api/directory/search?q=` | Entra people picker | canManageUsers |
| GET/POST | `/api/admin/roles` | list / create roles | isAppAdmin |
| PUT/DELETE | `/api/admin/roles/{id}` | edit / delete custom role | isAppAdmin |
| GET/POST | `/api/admin/assignments` | list / add user→role | canManageUsers |
| DELETE | `/api/admin/assignments/{id}` | remove assignment | canManageUsers |
| GET | `/api/powerplatform/query?kind=resources\|environments\|groups` | inventory resources / environments / groups (record-scoped) | page `inventory:all` / `:environments` / `:groups` |
| GET | `/api/licensing/skus` | tenant subscribed SKUs | page `licensing:summary` |

The matching frontend reads are already repointed behind `apiConfigured`:
`fetchResourcesPage` / `fetchEnvironmentsPage` / `fetchEnvironmentGroupsPage` /
`fetchAllResources` (`src/api/powerPlatformApi.ts`) and `fetchSubscribedSkus`
(`src/api/graphApi.ts`). With `VITE_API_BASE_URL` unset they keep using the user's
own token; with it set they call the proxy.

## Remaining work (data-proxy migration)

The RBAC management plane and the inventory + licensing reads are done. To fully
remove the admin-role requirement for the rest, port these behind `/api` following
`api/src/functions/powerplatform.ts` as the template, then repoint the matching
frontend `src/api/*.ts` `fetchX` bodies (guarded by `apiConfigured`):

- governance: DLP, tenant settings, capacity, billing, cross-tenant, advisor, connections (`governanceApi`) — note cross-tenant/advisor use async polling + per-environment fan-out
- usage sign-ins (`signInsApi`)
- owner-name resolution (`graphApi` batch `/users`) if you want non-admins to resolve names

Also extend `api/src/lib/scope.ts` `ownsResource` with the co-owner / shared-with
expansion (PowerApps admin per-resource permissions endpoint) per the agreed design.
Keep `api/src/lib/catalog.ts` in sync with `src/permissions/catalog.ts`.
