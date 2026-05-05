# Hosting on Azure Static Web Apps

Azure Static Web Apps (SWA) is a free-tier-eligible Azure service that hosts static web applications with built-in CI/CD integration. This is the recommended hosting option for this application.

> **Cost:** The Free tier of Azure Static Web Apps is sufficient for this application. No Azure Functions or API backends are used.
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

### Step 2 — Add environment variable secrets to GitHub

The build step needs your configuration values. Store them as GitHub repository secrets — never hard-code them in source files.

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**.
2. Add the following secrets (click **New repository secret** for each):

   | Secret name | Value |
   |---|---|
   | `SWA_DEPLOYMENT_TOKEN` | The deployment token from the SWA resource (see below) |
   | `VITE_CLIENT_ID` | Your App Registration's Client ID |
   | `VITE_TENANT_ID` | Your Azure AD Tenant ID or domain |
   | `VITE_STORAGE_ACCOUNT` | Storage account name *(optional — for persistent assessments and tagging)* |
   | `VITE_TABLE_SAS` | Account-level Table Storage SAS token *(optional — required if using storage)* |

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

# Build the app (add VITE_STORAGE_ACCOUNT and VITE_TABLE_SAS if using cloud storage)
VITE_CLIENT_ID=<your-client-id> \
VITE_TENANT_ID=<your-tenant-id> \
VITE_STORAGE_ACCOUNT=<your-storage-account> \
VITE_TABLE_SAS=<your-sas-token> \
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
> $env:VITE_STORAGE_ACCOUNT="<your-storage-account>"
> $env:VITE_TABLE_SAS="<your-sas-token>"
> npm run build
> ```

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
