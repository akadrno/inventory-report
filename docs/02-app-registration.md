# Azure AD App Registration & Admin Consent

The application uses Microsoft Identity Platform (Azure AD) to authenticate the signed-in user and acquire tokens for the Power Platform, Power Apps Service, and Graph APIs. You must create an App Registration in your tenant before the app can be used.

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

## Step 2 — Add API Permissions

In the App Registration, go to **API permissions** → **Add a permission**.

### Power Platform API

1. Click **APIs my organization uses** and search for `Power Platform API`.
2. Select **Delegated permissions**.
3. Expand and select all available permissions, or at minimum:
   - `User` (grants the signed-in user access to their Power Platform data)
4. Click **Add permissions**.

> If `Power Platform API` does not appear in search, the service principal may not yet exist in your tenant. You can force it by visiting:
> `https://admin.powerplatform.microsoft.com` and signing in as a Global Admin once. Then retry the search.

### Power Apps Service (for resource sharing)

1. Click **Add a permission** → **APIs my organization uses**.
2. Search for `Power Apps Service` or paste the resource URI `https://service.powerapps.com`.
3. Select **Delegated permissions** and add the available permission (typically `user_impersonation`).
4. Click **Add permissions**.

> Used to read who an app/flow is shared with (the "Sharing" section of the resource detail panel). The app requests this scope incrementally (a one-time extra consent popup) the first time you open sharing.

### Microsoft Graph

1. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Search for and add:
   - `User.ReadBasic.All` — resolve user/owner GUIDs to display names (core)
   - `Organization.Read.All` — read license/SKU capacity for the **Licensing** section
   - `AuditLog.Read.All` — read Entra sign-in logs for the **Usage Heatmap** and usage analytics
3. Click **Add permissions**.

> `User.ReadBasic.All` is the only one needed for core inventory. `Organization.Read.All` and `AuditLog.Read.All` light up Licensing and Usage respectively — omit them if you don't need those sections (the app shows a permission notice instead). `AuditLog.Read.All` additionally requires the signed-in user to hold an Entra role that can read audit logs (Reports Reader, Security Reader, Global Reader, or Global Administrator).

---

## Step 3 — Grant Admin Consent

Some permissions require tenant-wide admin consent before any user can use them.

1. On the **API permissions** page, click **Grant admin consent for \<your tenant name\>**.
2. Click **Yes** in the confirmation dialog.
3. All permissions should show a green ✔ status under **Status**.

> Only a **Global Administrator** or **Privileged Role Administrator** can grant admin consent. If you don't have this access, ask your Azure AD admin to consent on your behalf.

**Alternative — consent URL:** You can also generate a consent URL and share it with your admin:

```
https://login.microsoftonline.com/{tenant-id}/adminconsent?client_id={client-id}
```

Replace `{tenant-id}` and `{client-id}` with your values.

---

## Step 4 — Configure the Redirect URI

If you are hosting on Azure Static Web Apps:

1. Go to **Authentication** in the App Registration.
2. Under **Single-page application**, click **Add URI**.
3. Enter `https://<your-swa-hostname>.azurestaticapps.net`.
4. Click **Save**.

For local development, add `http://localhost:3000` in the same place.

You can have multiple redirect URIs active at the same time.

---

## Step 5 — Record your values

| Value | Where to find it |
|---|---|
| **Client ID** | App Registration → Overview → Application (client) ID |
| **Tenant ID** | App Registration → Overview → Directory (tenant) ID |

You'll use these in `.env.local` (local dev) or as GitHub secrets (CI/CD).

---

## Checklist

- [ ] App Registration created
- [ ] Redirect URI(s) added (SPA type) — include `http://localhost:3000` for local dev
- [ ] Power Platform API delegated permissions added
- [ ] Power Apps Service delegated permission added (resource sharing)
- [ ] Graph `User.ReadBasic.All` added (core)
- [ ] Graph `Organization.Read.All` added (Licensing — optional)
- [ ] Graph `AuditLog.Read.All` added (Usage Heatmap — optional; also needs an audit-reader Entra role)
- [ ] Admin consent granted (green checkmarks on all permissions)
- [ ] Client ID and Tenant ID noted

---

Next: [Azure Static Web Apps](03-azure-static-web-apps.md)
