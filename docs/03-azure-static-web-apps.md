# Hosting on Azure Static Web Apps

> [!IMPORTANT]
> This is unsupported sample code, not a Microsoft product. Microsoft Support does not support this deployment. You are responsible for Azure configuration, security, and costs. See [SUPPORT.md](../SUPPORT.md).

Azure hosting is optional. Run the sample locally if you only want to evaluate it. Azure Static Web Apps (SWA) is the documented cloud-hosting option because the application builds to static files and has no backend.

> **Cost:** The Free tier of Azure Static Web Apps is generally sufficient for this sample. Optional Azure Storage is a separate resource and can incur charges. Confirm current pricing and your organization's Azure policies before deployment.
> See [Azure Static Web Apps pricing](https://azure.microsoft.com/pricing/details/app-service/static/).

---

## Option A — Create via the Azure Portal (recommended for first-time setup)

### Step 1 — Create the resource

1. Go to the [Azure portal](https://portal.azure.com) and sign in.
2. Click **Create a resource** and search for `Static Web Apps`.
3. Click **Create**.
4. Fill in the form:

   | Field | Value |
   |---|---|
   | **Subscription** | Your Azure subscription |
   | **Resource Group** | Create new or use an existing one |
   | **Name** | e.g. `ppac-inventory-report` |
   | **Plan type** | Free |
   | **Region** | Any region close to your users |
   | **Source** | GitHub |

5. Click **Sign in with GitHub** and authorise Azure to access your GitHub account.
6. Select your **Organization**, **Repository** (`inventory-report`), and **Branch** (`main`).
7. Under **Build Details**, set:

   | Field | Value |
   |---|---|
   | **Build Presets** | Custom |
   | **App location** | `/` |
   | **API location** | *(leave blank)* |
   | **Output location** | `dist` |

8. Click **Review + create**, then **Create**.

> **Note:** Azure may attempt to commit a GitHub Actions workflow file to your repository automatically. If the repository already contains `.github/workflows/deploy.yml`, delete any auto-generated workflow Azure adds to avoid duplicate deploys.

---

### Step 2 — Add build and deployment secrets to GitHub

The build step needs your configuration values. Store them as GitHub repository secrets — never hard-code them in source files.

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**.
2. Add the following secrets (click **New repository secret** for each):

   | Secret name | Value |
   |---|---|
   | `SWA_DEPLOYMENT_TOKEN` | The deployment token from the SWA resource (see below) |
   | `VITE_CLIENT_ID` | Your App Registration's Client ID |
   | `VITE_TENANT_ID` | Your Azure AD Tenant ID or domain |
   | `VITE_STORAGE_ACCOUNT` | Storage account name *(optional; omit for browser-only persistence)* |
   | `VITE_TABLE_SAS` | Account-level Table Storage SAS token *(optional; required only with storage)* |

Only `SWA_DEPLOYMENT_TOKEN`, `VITE_CLIENT_ID`, and `VITE_TENANT_ID` are required for hosted deployment. Do not create storage resources or secrets unless shared persistence is required.

> `VITE_*` values are embedded in the browser bundle. A Table SAS is therefore visible to users of the deployed app. Use a narrowly scoped, expiring SAS and store only non-sensitive sample data.

**Finding the SWA deployment token:**
- Go to the Static Web Apps resource in the Azure portal.
- Click **Manage deployment token** in the Overview pane.
- Copy the token value.

---

### Step 3 — Trigger the first deployment

Push any change to the `main` branch (or open and merge a pull request). GitHub Actions will build the Vite app and deploy it to Azure.

Watch the progress under **Actions** in your GitHub repository. A successful run shows a green checkmark and the URL of your deployed app.

---

### Step 4 — Update the App Registration redirect URI

Once you know the hosted URL (e.g., `https://<yourhost>.azurestaticapps.net`):

1. Return to your App Registration in Azure AD → **Authentication**.
2. Add the SWA URL as a **Single-page application** redirect URI.
3. Click **Save**.

---

## Option B — Create via Azure CLI

If you prefer the command line:

```bash
az staticwebapp create \
  --name ppac-inventory-report \
  --resource-group <your-resource-group> \
  --source https://github.com/<your-org>/inventory-report \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --login-with-github
```

This still requires GitHub authorisation and creates the same GitHub Actions workflow.

---

## Option C — Manual deployment with SWA CLI

Use this to deploy the built `dist/` folder directly without GitHub Actions.

```bash
# Install the CLI
npm install -g @azure/static-web-apps-cli

# Build the app with the required values
VITE_CLIENT_ID=<your-client-id> \
VITE_TENANT_ID=<your-tenant-id> \
npm run build

# Deploy
npx swa deploy ./dist \
  --deployment-token "<your-swa-deployment-token>" \
  --env production
```

> On Windows PowerShell, set environment variables before building:
> ```powershell
> $env:VITE_CLIENT_ID="<your-client-id>"
> $env:VITE_TENANT_ID="<your-tenant-id>"
> npm run build
> ```
>
> Set `VITE_STORAGE_ACCOUNT` and `VITE_TABLE_SAS` only when optional Azure Table Storage is configured.

---

## Verifying the deployment

1. Open the SWA URL in your browser.
2. You should be redirected to the Microsoft sign-in page.
3. Sign in with a Power Platform Administrator account.
4. After consent (first sign-in only), the inventory dashboard loads.

---

## Checklist

- [ ] Azure Static Web Apps resource created (Free tier)
- [ ] GitHub repository linked
- [ ] GitHub secrets set: `SWA_DEPLOYMENT_TOKEN`, `VITE_CLIENT_ID`, `VITE_TENANT_ID` (plus `VITE_STORAGE_ACCOUNT` and `VITE_TABLE_SAS` if using cloud storage)
- [ ] GitHub Actions workflow ran successfully
- [ ] SWA URL added as redirect URI in the App Registration

---

Next: [User Guide](04-user-guide.md)
