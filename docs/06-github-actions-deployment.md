# GitHub Actions Deployment

This guide sets up a one-click **Deploy** button in GitHub Actions that builds and deploys the app to your Azure Static Web App. Authentication uses **OpenID Connect (OIDC) / Workload Identity Federation** — no passwords or long-lived credentials are stored anywhere.

## How it works

1. You click **Run workflow** in the GitHub Actions tab
2. GitHub issues a short-lived OIDC token to the workflow
3. Azure validates the token against a trusted federated credential you configure once
4. The workflow signs in, builds the app with your configuration, and deploys — no secrets ever leave Azure

---

## Prerequisites

- Azure CLI installed and signed in (`az login`)
- Owner or User Access Administrator role on the target resource group
- The Azure Static Web App already provisioned ([see hosting guide](03-azure-static-web-apps.md))

---

## Step 1 — Create a service principal

```bash
az ad sp create-for-rbac \
  --name "ppac-inventory-deploy" \
  --skip-assignment
```

Note the `appId` and `id` values from the output — you'll need them in the next steps.

---

## Step 2 — Assign the Contributor role on your resource group

Replace the placeholders with your values:

```bash
az role assignment create \
  --assignee "<APP_ID>" \
  --role "Contributor" \
  --scope "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>"
```

> **Least-privilege alternative:** Instead of `Contributor`, create a custom role with only `Microsoft.Web/staticSites/listSecrets/action` and assign that. This is more secure but requires extra steps.

---

## Step 3 — Add a federated credential (OIDC trust)

This tells Azure to trust GitHub's OIDC token for this specific repo and environment — no client secret is created or needed.

```bash
az ad app federated-credential create \
  --id "<APP_OBJECT_ID>" \
  --parameters '{
    "name": "github-actions-production",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:<GITHUB_ORG_OR_USER>/<REPO_NAME>:environment:production",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

Replace:
- `<APP_OBJECT_ID>` — the `id` field from Step 1 (not `appId`)
- `<GITHUB_ORG_OR_USER>` — your GitHub username or organisation name
- `<REPO_NAME>` — the repository name

---

## Step 4 — Create a GitHub Environment

1. Go to your repo → **Settings** → **Environments** → **New environment**
2. Name it `production`
3. Optionally add **Required reviewers** so every deployment needs manual approval
4. Save

---

## Step 5 — Add GitHub secrets

In **Settings → Environments → production → Environment secrets**, add each of the following. Do not add these as repository-level secrets — keeping them in the environment ensures they are only accessible when deploying to `production`.

| Secret name | Value |
|---|---|
| `AZURE_CLIENT_ID` | `appId` from Step 1 |
| `AZURE_TENANT_ID` | Your Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID |
| `AZURE_RESOURCE_GROUP` | Resource group containing the Static Web App |
| `SWA_APP_NAME` | Static Web App resource name in Azure |
| `VITE_CLIENT_ID` | App registration client ID (from [app registration guide](02-app-registration.md)) |
| `VITE_TENANT_ID` | Your Azure AD tenant ID (same as above) |
| `VITE_STORAGE_ACCOUNT` | Storage account name |
| `VITE_TABLE_SAS` | Table Storage SAS token |

---

## Step 6 — Run the workflow

1. Go to your repo → **Actions** → **Deploy**
2. Click **Run workflow**
3. Select `production` and click **Run workflow**

The workflow will sign in to Azure via OIDC, build the app, and deploy — no manual steps needed.

---

## Security notes

- **No secrets are stored as credentials.** The OIDC token is issued fresh per run and expires after the job completes.
- **The deployment token is never stored.** It is fetched live from Azure during the workflow run and masked in all logs (`::add-mask::`), so it never appears in plain text.
- **Environment secrets are scoped.** Secrets added to the `production` environment are only accessible when the job explicitly targets that environment.
- **Optional: add required reviewers** to the `production` environment in GitHub so every deployment requires manual approval before it runs.
- Rotate `VITE_TABLE_SAS` by generating a new SAS token in Azure Storage and updating the environment secret. No other credentials need rotation.

---

## Troubleshooting

| Error | Likely cause |
|---|---|
| `AADSTS70021: No matching federated identity record found` | The `subject` in the federated credential doesn't match. Verify the org/repo name and environment name are exact. |
| `AuthorizationFailed` on `az staticwebapp secrets list` | The service principal lacks the role assigned in Step 2, or the resource group name in `AZURE_RESOURCE_GROUP` is wrong. |
| `VITE_*` values are empty in build | Secrets are added at repo level instead of inside the `production` environment. Move them to the environment. |

---

Previous: [API Reference](05-api-reference.md)
