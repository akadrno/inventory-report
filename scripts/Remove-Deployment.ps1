<#
.SYNOPSIS
    Removes all Azure AD and Azure resources created by the deployment scripts.

.DESCRIPTION
    Deletes:
      - The Azure AD App Registration (and its service principal)
      - The Azure Static Web App resource

    Optionally deletes the Azure Resource Group entirely.

    !! WARNING !! — This script permanently deletes Azure resources.
    Deletion CANNOT be undone. The App Registration, all its permissions,
    admin consent grants, and the Static Web App will be removed.

    !! WARNING !! — If you pass -DeleteResourceGroup, ALL resources in that
    resource group are deleted — not just the Static Web App. Only use this
    flag if the resource group was created exclusively for this application.

    !! WARNING !! — This script does NOT remove GitHub repository secrets.
    After running this script, manually remove the following secrets from your
    GitHub repository to avoid failed workflow runs:
      - AZURE_STATIC_WEB_APPS_API_TOKEN
      - VITE_CLIENT_ID
      - VITE_TENANT_ID

    !! WARNING !! — This script does NOT remove redirect URIs from any other
    applications. If you shared the App Registration with other apps, do not
    run this script.

.PARAMETER TenantId
    Your Azure AD Tenant ID or domain.

.PARAMETER ResourceGroup
    Azure Resource Group containing the Static Web App.

.PARAMETER AppName
    Name of the App Registration and Static Web App to delete.

.PARAMETER SubscriptionId
    Azure Subscription ID.

.PARAMETER DeleteResourceGroup
    If specified, deletes the entire resource group rather than just the SWA resource.
    Only use this if the resource group contains nothing else.
#>

#Requires -Version 5.1

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$ResourceGroup,
    [Parameter(Mandatory)][string]$AppName,
    [string]$SubscriptionId  = "",
    [switch]$DeleteResourceGroup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Red
Write-Host "  CLEANUP — Power Platform Inventory Report"                 -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Red
Write-Host ""
Write-Host "This will PERMANENTLY DELETE:"
Write-Host "  - Azure AD App Registration: $AppName"
Write-Host "  - Azure Static Web App:      $AppName (in $ResourceGroup)"
if ($DeleteResourceGroup) {
    Write-Host "  - ENTIRE Resource Group:     $ResourceGroup (ALL resources inside)" -ForegroundColor Red
}
Write-Host ""
Write-Host "This action CANNOT be undone." -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Type DELETE to confirm, anything else to abort"
if ($confirm -ne "DELETE") {
    Write-Host "Aborted. Nothing was deleted." -ForegroundColor Cyan
    exit 0
}

# ── Delete Azure AD App Registration ─────────────────────────────────────────

Write-Host "`nLooking up App Registration '$AppName'..."
$appId = az ad app list --display-name $AppName --query "[0].appId" -o tsv 2>$null

if ($appId -and $appId.Trim()) {
    $appId = $appId.Trim()
    Write-Host "  Deleting App Registration $appId..."
    az ad app delete --id $appId --output none
    Write-Host "  App Registration deleted." -ForegroundColor Green
} else {
    Write-Host "  App Registration '$AppName' not found — skipping." -ForegroundColor Yellow
}

# ── Delete Azure Static Web App ───────────────────────────────────────────────

if ($SubscriptionId) {
    az account set --subscription $SubscriptionId --output none
}

if ($DeleteResourceGroup) {
    Write-Host "`nDeleting entire resource group '$ResourceGroup'..."
    Write-Host "This will delete ALL resources inside it." -ForegroundColor Red
    az group delete --name $ResourceGroup --yes --no-wait --output none
    Write-Host "  Resource group deletion initiated (running in background)." -ForegroundColor Green
} else {
    Write-Host "`nDeleting Static Web App '$AppName' from '$ResourceGroup'..."
    $swaExists = az staticwebapp show --name $AppName --resource-group $ResourceGroup --query "name" -o tsv 2>$null
    if ($swaExists -and $swaExists.Trim()) {
        az staticwebapp delete --name $AppName --resource-group $ResourceGroup --yes --output none
        Write-Host "  Static Web App deleted." -ForegroundColor Green
    } else {
        Write-Host "  Static Web App '$AppName' not found — skipping." -ForegroundColor Yellow
    }
}

# ── Reminder about GitHub secrets ────────────────────────────────────────────

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "  Cleanup complete."                                          -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "REMINDER: GitHub repository secrets were NOT removed."
Write-Host "Manually delete these secrets from your GitHub repository"
Write-Host "to avoid failed CI/CD workflow runs:"
Write-Host "  - AZURE_STATIC_WEB_APPS_API_TOKEN"
Write-Host "  - VITE_CLIENT_ID"
Write-Host "  - VITE_TENANT_ID"
Write-Host ""
Write-Host "GitHub repo secrets page:"
Write-Host "  https://github.com/<your-org>/<your-repo>/settings/secrets/actions"
Write-Host ""
