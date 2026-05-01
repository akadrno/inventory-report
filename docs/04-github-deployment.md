# GitHub CI/CD Deployment

This repository includes a GitHub Actions workflow that automatically builds and deploys the app to Azure Static Web Apps on every push to `main`.

---

## How it works

```
Push to main branch
      │
      ▼
GitHub Actions: build_and_deploy job
      │
      ├─ Checkout source code
      ├─ Inject VITE_CLIENT_ID and VITE_TENANT_ID as env vars
      ├─ Run Vite build (tsc && vite build → dist/)
      └─ Upload dist/ to Azure Static Web Apps
```

Pull requests against `main` automatically get a **preview environment** with a unique URL — useful for reviewing changes before merging. When the PR is closed, the preview is cleaned up automatically.

---

## Setup steps

### 1 — Fork or push the repository

If you cloned this repository, push it to your own GitHub account:

```bash
git remote set-url origin https://github.com/<your-username>/inventory-report.git
git push -u origin main
```

Or fork it through the GitHub UI and clone your fork.

---

### 2 — Create the Azure Static Web Apps resource

Follow [the Azure Static Web Apps guide](03-azure-static-web-apps.md) to create the resource and link it to your repository. Azure will automatically commit the workflow file `.github/workflows/azure-static-web-apps.yml`.

If you already have a workflow file in the repo, Azure merges the deployment token into it rather than creating a duplicate.

---

### 3 — Add repository secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret name | Description |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token from the Azure SWA resource |
| `VITE_CLIENT_ID` | Azure AD App Registration Client ID |
| `VITE_TENANT_ID` | Azure AD Tenant ID or domain |

> Secrets are encrypted and are never visible in logs. Do **not** put these values in any source file.

---

### 4 — Trigger a deployment

Push a commit to `main`:

```bash
git add .
git commit -m "initial deployment"
git push
```

Go to the **Actions** tab in your GitHub repository to watch the build. A green checkmark means the deployment succeeded.

---

## Workflow file reference

The workflow file is at `.github/workflows/azure-static-web-apps.yml`:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: "/"
          api_location: ""
          output_location: "dist"
        env:
          VITE_CLIENT_ID: ${{ secrets.VITE_CLIENT_ID }}
          VITE_TENANT_ID: ${{ secrets.VITE_TENANT_ID }}

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Close Pull Request
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: close
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails with `VITE_CLIENT_ID is not defined` | Secret not set or misspelled | Check **Settings → Secrets** and verify the exact secret name |
| Build succeeds but app shows auth error | Wrong Client ID or Tenant ID | Double-check values in secrets match your App Registration |
| `azure_static_web_apps_api_token` error | Deployment token expired or wrong | Regenerate the token in the Azure portal and update the secret |
| TypeScript compilation errors | Code changes broke the build | Run `npm run build` locally to diagnose |

---

## Updating the deployment token

Deployment tokens do not expire but can be rotated if compromised:

1. Go to the Static Web Apps resource in the Azure portal.
2. Click **Manage deployment token** → **Reset token**.
3. Copy the new token.
4. Update the `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret.

---

Next: [Local Development](05-local-development.md)
