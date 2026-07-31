# Azure AD App Registration & Admin Consent

> [!IMPORTANT]
> This is unsupported sample code, not a Microsoft product. Microsoft Support does not support this app registration or its permissions. Review and approve every permission according to your organization's policies. See [SUPPORT.md](../SUPPORT.md).

The sample uses Microsoft identity platform to authenticate users and acquire delegated tokens. A single-tenant SPA app registration and Power Platform API delegated access are the only API configuration required for the minimum inventory experience.

> **This is a delegated-permissions app.** It acts as the signed-in user — it can only do what that user can already do. Granting admin consent does not give the app any permissions the user doesn't already hold.

---

## Step 1 — Create the App Registration

1. Go to the [Azure portal](https://portal.azure.com) and sign in as a Global Administrator or Application Administrator.
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**.
3. Fill in the form:
   - **Name:** `Power Platform Inventory Report` (or any name you prefer)
   - **Supported account types:** `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI:** Select `Single-page application (SPA)` from the drop-down
     - Enter the URL where the app will be hosted.
     - For local development: `http://localhost:3000`
     - For Azure Static Web Apps: `https://<your-swa-hostname>.azurestaticapps.net`
     - You can add multiple redirect URIs after creation.
4. Click **Register**.
5. Note the **Application (client) ID** and **Directory (tenant) ID** shown on the Overview page — you'll need them later.

---

## Step 2 — Add the required API permission

In the App Registration, go to **API permissions** → **Add a permission**.

### Power Platform API

1. Click **APIs my organization uses** and search for `Power Platform API`.
2. Select **Delegated permissions**.
3. Select the available delegated permission, normally `user_impersonation` or `User` depending on how the service principal is displayed in your tenant.
4. Click **Add permissions**.

> If `Power Platform API` does not appear in search, the service principal may not yet exist in your tenant. You can force it by visiting:
> `https://admin.powerplatform.microsoft.com` and signing in as a Global Admin once. Then retry the search.

> Do not add the Business Application Platform (BAP) API. This sample has no BAP dependency.

## Step 3 — Add optional feature permissions

Skip this step if you only need the basic inventory and governance experience.

### Power Apps Service - connections and sharing

1. Click **Add a permission** → **APIs my organization uses**.
2. Search for `Power Apps Service` or paste the resource URI `https://service.powerapps.com`.
3. Select **Delegated permissions** and add `User`.
4. Click **Add permissions**.

> Enables connection inventory and the Sharing section of the resource detail panel. The app requests this scope incrementally, which can trigger a one-time consent popup.

### Microsoft Graph

1. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Search for and add:
   - `User.ReadBasic.All` - resolve user and owner GUIDs to friendly names
   - `Organization.Read.All` - enable license and SKU capacity pages
   - `AuditLog.Read.All` - enable sign-in analytics and the Usage Heatmap
3. Click **Add permissions**.

> All Microsoft Graph permissions are optional. `AuditLog.Read.All` also requires the signed-in user to hold Reports Reader, Security Reader, Global Reader, or Global Administrator.

---

## Step 4 — Grant Admin Consent

Some permissions require tenant-wide admin consent before any user can use them.

1. On the **API permissions** page, click **Grant admin consent for \<your tenant name\>**.
2. Click **Yes** in the confirmation dialog.
3. Confirm that the permissions you selected show a granted status.

> Only a **Global Administrator** or **Privileged Role Administrator** can grant admin consent. If you don't have this access, ask your Azure AD admin to consent on your behalf.

**Alternative — consent URL:** You can also generate a consent URL and share it with your admin:

```
https://login.microsoftonline.com/{tenant-id}/adminconsent?client_id={client-id}
```

Replace `{tenant-id}` and `{client-id}` with your values.

---

## Step 5 — Configure the Redirect URI

If you are hosting on Azure Static Web Apps:

1. Go to **Authentication** in the App Registration.
2. Under **Single-page application**, click **Add URI**.
3. Enter `https://<your-swa-hostname>.azurestaticapps.net`.
4. Click **Save**.

For local development, add `http://localhost:3000` in the same place.

You can have multiple redirect URIs active at the same time.

---

## Step 6 — Record your values

| Value | Where to find it |
|---|---|
| **Client ID** | App Registration → Overview → Application (client) ID |
| **Tenant ID** | App Registration → Overview → Directory (tenant) ID |

You'll use these in `.env.local` (local dev) or as GitHub secrets (CI/CD).

---

## Checklist

- [ ] App Registration created
- [ ] Redirect URI(s) added (SPA type) — include `http://localhost:3000` for local dev
- [ ] Power Platform API delegated permission added (required)
- [ ] No BAP API permission added
- [ ] Power Apps Service delegated `User` permission added (optional: connections and sharing)
- [ ] Graph `User.ReadBasic.All` added (optional: friendly owner names)
- [ ] Graph `Organization.Read.All` added (Licensing — optional)
- [ ] Graph `AuditLog.Read.All` added (Usage Heatmap — optional; also needs an audit-reader Entra role)
- [ ] Admin consent granted (green checkmarks on all permissions)
- [ ] Client ID and Tenant ID noted

---

Next: [Azure Static Web Apps](03-azure-static-web-apps.md)
