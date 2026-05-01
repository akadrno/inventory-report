<#
.SYNOPSIS
    Grants tenant-wide admin consent for an Azure AD App Registration.

.DESCRIPTION
    Uses Azure CLI to grant admin consent for all configured delegated permissions
    on the specified App Registration.

    !! WARNING !! — Admin consent is a privileged action that affects your entire
    tenant. Any user in your tenant will be able to sign in to this application
    without being individually prompted for consent once this step is complete.

    !! WARNING !! — This step requires the signed-in Azure CLI user to be a
    Global Administrator or Privileged Role Administrator. It WILL FAIL if the
    account does not have this role.

    !! WARNING !! — Some tenants enforce custom admin consent workflows
    (Azure AD admin consent request policies). In those tenants, this script will
    fail and consent must be approved through the configured workflow instead.
    Check your tenant's consent settings at:
    https://portal.azure.com/#view/Microsoft_AAD_IAM/ConsentPoliciesMenuBlade

    !! WARNING !! — Granting consent cannot be undone via script. To revoke it,
    go to Azure AD -> Enterprise Applications -> find the app -> Permissions ->
    Revoke admin consent.

.PARAMETER TenantId
    Your Azure AD Tenant ID or domain.

.PARAMETER ClientId
    The Application (client) ID of the App Registration.
#>

#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$ClientId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "  [02-Grant-Consent] Starting..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  !! This grants tenant-wide admin consent. !!" -ForegroundColor Red
Write-Host "  !! The signed-in account must be a Global Administrator. !!" -ForegroundColor Red
Write-Host ""
Write-Host "  App ID:    $ClientId"
Write-Host "  Tenant:    $TenantId"
Write-Host ""

$confirm = Read-Host "  Type YES to grant admin consent, anything else to skip"
if ($confirm -ne "YES") {
    Write-Host "  Consent step skipped. Grant consent manually in the Azure portal:" -ForegroundColor Yellow
    Write-Host "  https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$ClientId"
    return
}

# Verify the service principal exists
$spObjectId = az ad sp show --id $ClientId --query "id" -o tsv 2>$null
if (-not $spObjectId -or -not $spObjectId.Trim()) {
    Write-Host "  Service principal not found. Creating it..."
    az ad sp create --id $ClientId --output none
    Start-Sleep -Seconds 5
    $spObjectId = az ad sp show --id $ClientId --query "id" -o tsv
}

Write-Host "  Granting admin consent via Azure CLI..."
try {
    az ad app permission admin-consent --id $ClientId --output none
    Write-Host "  Admin consent granted successfully." -ForegroundColor Green
} catch {
    Write-Warning "  Azure CLI consent command failed: $_"
    Write-Warning ""
    Write-Warning "  This can happen when:"
    Write-Warning "   - The account is not a Global Administrator"
    Write-Warning "   - Your tenant requires a consent approval workflow"
    Write-Warning "   - The permissions haven't fully propagated yet (wait 30s and retry)"
    Write-Warning ""
    Write-Warning "  Grant consent manually at:"
    Write-Warning "  https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$ClientId"
    Write-Warning ""
    Write-Warning "  Or use the admin consent URL directly:"
    Write-Warning "  https://login.microsoftonline.com/$TenantId/adminconsent?client_id=$ClientId"
}

Write-Host "  [02-Grant-Consent] Complete." -ForegroundColor Green
