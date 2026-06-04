<#
  One-time provisioning for the PPAC Inventory RBAC backend.

  RUN THIS YOURSELF — it needs interactive sign-in as a Global Administrator of the
  powerappsscale tenant (to create the service principal, consent app permissions,
  register the Power Platform management app, and expose the API scope), plus access
  to the akadrno subscription that hosts the Static Web App.

  Review every block before running. Steps are idempotent-ish but DO create a real
  app registration + client secret. Run block-by-block rather than all at once the
  first time. Requires: Azure CLI (az), GitHub CLI (gh), and the
  Microsoft.PowerApps.Administration.PowerShell module.

  Two tenants are involved:
    - powerappsscale (78ff038c-…) — app registrations, consent, PP management app.
    - akadrno subscription (d7da756e-…) — the Static Web App + its Function settings.
#>

# ── 0. Parameters (known values from project memory; fill the blanks) ──────────
$PowerAppsScaleTenant = '78ff038c-633d-4743-8ba1-9744b275a2d0'   # users + data tenant
$FrontendAppId        = 'bb08ccda-492b-44ad-a882-1354acb3ca32'   # existing SPA app reg
$AkadrnoSubscription  = 'd7da756e-9939-4beb-81ad-df222030b7fc'   # hosts the SWA
$ResourceGroup        = 'Scale-Tenant-Inventory-demo'
$SwaName              = 'ppac-inventory-scale'
$StorageConnString    = '<paste the RBAC storage account connection string>'      # ppacRoles/ppacRoleAssignments live here

# Microsoft Graph well-known app id + application-permission (role) ids
$GraphAppId = '00000003-0000-0000-c000-000000000000'
$GraphRoles = @{
  'User.Read.All'         = 'df021288-bdef-4463-88db-98f22de89214'
  'Organization.Read.All' = '498476ce-e0fe-48b0-b801-37ba7e2685c6'
  'AuditLog.Read.All'     = 'b0afded3-3588-46d8-8b3d-9842eff778da'
  'Directory.Read.All'    = '7ab1d382-f21e-4acd-a863-ba3e13f7da61'
}

# ── 1. Sign in to the powerappsscale tenant ────────────────────────────────────
az login --tenant $PowerAppsScaleTenant --allow-no-subscriptions | Out-Null

# ── 2. Create the service principal (elevated identity) ────────────────────────
$sp = az ad app create --display-name 'PPAC Inventory Backend SP' | ConvertFrom-Json
$SpClientId = $sp.appId
az ad sp create --id $SpClientId | Out-Null
# Client secret (store securely — shown once). Prefer a federated credential in prod.
$secret = az ad app credential reset --id $SpClientId --display-name 'rbac-backend' --years 1 | ConvertFrom-Json
$SpClientSecret = $secret.password
Write-Host "SP appId:  $SpClientId"
Write-Host "SP secret: $SpClientSecret   (copy now — not shown again)"

# ── 3. Grant + consent Graph application permissions ───────────────────────────
foreach ($name in $GraphRoles.Keys) {
  az ad app permission add --id $SpClientId --api $GraphAppId --api-permissions "$($GraphRoles[$name])=Role" | Out-Null
  Write-Host "added $name"
}
# Requires a Global Admin; grants tenant-wide consent for the app permissions above.
az ad app permission admin-consent --id $SpClientId

# ── 4. Register the SP as a Power Platform management application ───────────────
# Lets app-only tokens call BAP / PowerApps admin / resourcequery.
Install-Module Microsoft.PowerApps.Administration.PowerShell -Scope CurrentUser -Force
Add-PowerAppsAccount -TenantID $PowerAppsScaleTenant
New-PowerAppManagementApplication -ApplicationId $SpClientId

# ── 5. Expose the access_as_user scope on the FRONTEND app registration ─────────
# Easiest in the portal: Entra ID → App registrations → (frontend app) → Expose an
# API → Set Application ID URI to api://<FrontendAppId> → Add a scope
# "access_as_user" (admins + users) → Authorized client applications → add
# <FrontendAppId> for that scope.
#
# CLI equivalent (PATCH the app's api.oauth2PermissionScopes + pre-authorize):
$scopeId = [guid]::NewGuid().ToString()
$apiPatch = @{
  identifierUris = @("api://$FrontendAppId")
  api = @{
    oauth2PermissionScopes = @(@{
      id = $scopeId; value = 'access_as_user'; type = 'User'; isEnabled = $true
      adminConsentDisplayName = 'Access PPAC Inventory as the signed-in user'
      adminConsentDescription = 'Allows the app to call its backend as the signed-in user.'
      userConsentDisplayName  = 'Access PPAC Inventory on your behalf'
      userConsentDescription  = 'Allows the app to call its backend on your behalf.'
    })
    preAuthorizedApplications = @(@{ appId = $FrontendAppId; delegatedPermissionIds = @($scopeId) })
  }
} | ConvertTo-Json -Depth 8
$objId = az ad app show --id $FrontendAppId --query id -o tsv
$apiPatch | az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$objId" --headers 'Content-Type=application/json' --body '@-'

# ── 6. Function app settings on the Static Web App (akadrno sub) ────────────────
az account set --subscription $AkadrnoSubscription
az staticwebapp appsettings set --name $SwaName --resource-group $ResourceGroup --setting-names `
  "TENANT_ID=$PowerAppsScaleTenant" `
  "API_APP_ID=$FrontendAppId" `
  "SP_CLIENT_ID=$SpClientId" `
  "SP_CLIENT_SECRET=$SpClientSecret" `
  "STORAGE_CONNECTION_STRING=$StorageConnString"

# ── 7. GitHub secret to enable the backend at build time, then redeploy ─────────
gh secret set VITE_API_BASE_URL --body '/' --repo akadrno/inventory-report
# (optional) gh secret set VITE_API_APP_ID --body $FrontendAppId --repo akadrno/inventory-report
Write-Host "Done. Merge the PR (or push main) to trigger a deploy with RBAC enabled."
