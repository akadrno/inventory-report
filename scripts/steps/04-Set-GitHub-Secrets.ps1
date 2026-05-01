<#
.SYNOPSIS
    Writes required GitHub Actions secrets to a GitHub repository.

.DESCRIPTION
    Uses the GitHub CLI to set three repository secrets:
      - AZURE_STATIC_WEB_APPS_API_TOKEN : SWA deployment token
      - VITE_CLIENT_ID                   : Azure AD App Registration Client ID
      - VITE_TENANT_ID                   : Azure AD Tenant ID

    !! WARNING !! — This script writes secrets to a GitHub repository. The account
    authenticated with GitHub CLI must have Admin access to that repository.

    !! WARNING !! — GitHub repository secrets are accessible to all GitHub Actions
    workflows in that repository. If your repository is public or has other workflows,
    those workflows will also have access to these secrets. Consider using
    environment-scoped secrets for additional isolation.

    !! WARNING !! — Setting 'AZURE_STATIC_WEB_APPS_API_TOKEN' gives any workflow
    in this repository full write access to your Azure Static Web App. Treat it with
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
    Azure Static Web Apps deployment token (AZURE_STATIC_WEB_APPS_API_TOKEN).
#>

#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$GitHubRepo,
    [Parameter(Mandatory)][string]$ClientId,
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$DeploymentToken
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

Write-Host "  Setting AZURE_STATIC_WEB_APPS_API_TOKEN..."
$DeploymentToken | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo $GitHubRepo

Write-Host "  Setting VITE_CLIENT_ID..."
$ClientId | gh secret set VITE_CLIENT_ID --repo $GitHubRepo

Write-Host "  Setting VITE_TENANT_ID..."
$TenantId | gh secret set VITE_TENANT_ID --repo $GitHubRepo

Write-Host "  All secrets written to $GitHubRepo." -ForegroundColor Green
Write-Host ""
Write-Host "  Secrets set:"
Write-Host "    AZURE_STATIC_WEB_APPS_API_TOKEN  [deployment token — redacted]"
Write-Host "    VITE_CLIENT_ID                   $ClientId"
Write-Host "    VITE_TENANT_ID                   $TenantId"
Write-Host ""

Write-Host "  [04-Set-GitHub-Secrets] Complete." -ForegroundColor Green
