# GitHub Actions Deployment

The repository includes a workflow (`.github/workflows/deploy.yml`) that builds and deploys the app automatically on every push to `main`. You can also trigger it manually from the Actions tab.

## How it works

1. Any push to `main` triggers the workflow
2. GitHub Actions checks out the code, installs dependencies, and runs `npm run build` with the `VITE_*` secrets injected as environment variables
3. The built `dist/` folder is deployed to Azure Static Web Apps using the SWA deployment token

---

## Prerequisites

- The Azure Static Web App already provisioned ([see hosting guide](03-azure-static-web-apps.md))
- Admin access to the GitHub repository (to add secrets)

---

## Step 1 — Get the SWA deployment token

```bash
az staticwebapp secrets list \
  --name "<your-swa-name>" \
  --resource-group "<your-resource-group>" \
  --query "properties.apiKey" \
  --output tsv
```

Or retrieve it from the Azure portal: **Static Web Apps resource → Overview → Manage deployment token**.

---

## Step 2 — Add GitHub repository secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret** and add each of the following:

| Secret name | Value |
|---|---|
| `SWA_DEPLOYMENT_TOKEN` | Deployment token from Step 1 |
| `VITE_CLIENT_ID` | App Registration Client ID (from [app registration guide](02-app-registration.md)) |
| `VITE_TENANT_ID` | Your Azure AD tenant ID or domain |
| `VITE_STORAGE_ACCOUNT` | Azure Storage account name (if using cloud storage) |
| `VITE_TABLE_SAS` | Account-level Table Storage SAS token (if using cloud storage) |

`VITE_STORAGE_ACCOUNT` and `VITE_TABLE_SAS` are optional — omit them if you don't need persistent assessments or resource tagging.

---

## Step 3 — Push to main

Any commit pushed to `main` will now trigger an automatic deploy. Watch the progress under **Actions** in your GitHub repository.

To trigger a deploy without a code change:

```bash
gh workflow run deploy.yml --repo <owner>/<repo>
```

---

## Troubleshooting

| Error | Likely cause |
|---|---|
| `Error: deployment token is invalid` | `SWA_DEPLOYMENT_TOKEN` secret is wrong or expired — regenerate from the Azure portal |
| `VITE_*` values are empty in build | Secrets were not added or have incorrect names — check Settings → Secrets |
| Build succeeds but app shows blank page | `VITE_CLIENT_ID` or `VITE_TENANT_ID` is wrong — verify against the App Registration |

---

Previous: [API Reference](05-api-reference.md)
