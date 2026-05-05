<#
.SYNOPSIS
    Writes required GitHub Actions secrets to a GitHub repository.

.DESCRIPTION
    Uses the GitHub CLI to set repository secrets required by the deploy workflow:
      - SWA_DEPLOYMENT_TOKEN  : SWA deployment token
      - VITE_CLIENT_ID        : Azure AD App Registration Client ID
      - VITE_TENANT_ID        : Azure AD Tenant ID
      - VITE_STORAGE_ACCOUNT  : Azure Storage account name (optional)
      - VITE_TABLE_SAS        : Account-level Table Storage SAS token (optional)

    !! WARNING !! — This script writes secrets to a GitHub repository. The account
    authenticated with GitHub CLI must have Admin access to that repository.

    !! WARNING !! — GitHub repository secrets are accessible to all GitHub Actions
    workflows in that repository. If your repository is public or has other workflows,
    those workflows will also have access to these secrets.

    !! WARNING !! — Setting 'SWA_DEPLOYMENT_TOKEN' gives any workflow in this
    repository full write access to your Azure Static Web App. Treat it with
    the same care as a service account password.

    !! WARNING !! — This script will OVERWRITE any existing secrets with the same names.
    If you have previously configured different values, they will be replaced.

.PARAMETER GitHubRepo
    Repository in owner/repo format (e.g. akadrno/inventory-report).

.PARAMETER ClientId
    Azure AD App Registration Client ID (VITE_CLIENT_ID).

.PARAMETER TenantId
    Azure AD Tenant ID or domain (VITE_TENANT_ID).

.PARAMETER DeploymentToken
    Azure Static Web Apps deployment token (SWA_DEPLOYMENT_TOKEN).

.PARAMETER StorageAccount
    Azure Storage account name (VITE_STORAGE_ACCOUNT). Optional.

.PARAMETER TableSas
    Account-level Table Storage SAS token (VITE_TABLE_SAS). Optional.
#>

#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$GitHubRepo,
    [Parameter(Mandatory)][string]$ClientId,
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$DeploymentToken,
    [string]$StorageAccount = "",
    [string]$TableSas        = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "  [04-Set-GitHub-Secrets] Starting..." -ForegroundColor Cyan

# Verify GitHub CLI is authenticated
$ghStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "GitHub CLI is not authenticated. Run: gh auth login"
}

# Verify access to the repository
Write-Host "  Verifying access to '$GitHubRepo'..."
$repoCheck = gh repo view $GitHubRepo --json name 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cannot access repository '$GitHubRepo'. Check that GitHub CLI is authenticated and the account has admin access."
}

Write-Host "  Setting SWA_DEPLOYMENT_TOKEN..."
$DeploymentToken | gh secret set SWA_DEPLOYMENT_TOKEN --repo $GitHubRepo

Write-Host "  Setting VITE_CLIENT_ID..."
$ClientId | gh secret set VITE_CLIENT_ID --repo $GitHubRepo

Write-Host "  Setting VITE_TENANT_ID..."
$TenantId | gh secret set VITE_TENANT_ID --repo $GitHubRepo

if ($StorageAccount) {
    Write-Host "  Setting VITE_STORAGE_ACCOUNT..."
    $StorageAccount | gh secret set VITE_STORAGE_ACCOUNT --repo $GitHubRepo
}

if ($TableSas) {
    Write-Host "  Setting VITE_TABLE_SAS..."
    $TableSas | gh secret set VITE_TABLE_SAS --repo $GitHubRepo
}

Write-Host "  All secrets written to $GitHubRepo." -ForegroundColor Green
Write-Host ""
Write-Host "  Secrets set:"
Write-Host "    SWA_DEPLOYMENT_TOKEN    [deployment token — redacted]"
Write-Host "    VITE_CLIENT_ID          $ClientId"
Write-Host "    VITE_TENANT_ID          $TenantId"
if ($StorageAccount) { Write-Host "    VITE_STORAGE_ACCOUNT    $StorageAccount" }
if ($TableSas)        { Write-Host "    VITE_TABLE_SAS          [redacted]" }
Write-Host ""

Write-Host "  [04-Set-GitHub-Secrets] Complete." -ForegroundColor Green
