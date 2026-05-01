<#
.SYNOPSIS
    Master deployment script for Power Platform Inventory Report.

.DESCRIPTION
    Orchestrates all deployment steps in sequence:
      1. Create Azure AD App Registration
      2. Grant tenant-wide admin consent
      3. Create Azure Static Web App
      4. Write GitHub repository secrets
      5. Build and deploy the application

    !! WARNING !! — Read scripts/README.md before running this script.
    This script makes real changes to your Azure AD tenant and Azure subscription.
    It is NOT guaranteed to work in all tenants. Tenant policies, conditional access
    rules, service principal availability, and Azure subscription quotas can all
    cause failures. Review every parameter carefully before proceeding.

.PARAMETER TenantId
    Your Azure AD Tenant ID (GUID) or primary domain (e.g. contoso.onmicrosoft.com).

.PARAMETER SubscriptionId
    The Azure Subscription ID where the Static Web App will be created.

.PARAMETER ResourceGroup
    The Azure Resource Group name. Will be created if it does not exist.

.PARAMETER GitHubRepo
    GitHub repository in owner/repo format (e.g. akadrno/inventory-report).

.PARAMETER AppName
    Base name used for the App Registration and Static Web App. Default: ppac-inventory-report.

.PARAMETER Location
    Azure region for the Static Web App. Default: eastus2.

.PARAMETER SkipConsent
    Skip the admin consent step (useful if consent was already granted or requires a separate admin).

.PARAMETER SkipGitHub
    Skip setting GitHub secrets (useful if you want to configure CI/CD separately).

.PARAMETER CreateResourceGroup
    Create the resource group if it does not already exist.

.EXAMPLE
    .\Deploy-All.ps1 `
      -TenantId "00000000-0000-0000-0000-000000000000" `
      -SubscriptionId "00000000-0000-0000-0000-000000000000" `
      -ResourceGroup "rg-ppac-inventory" `
      -GitHubRepo "akadrno/inventory-report" `
      -CreateResourceGroup
#>

#Requires -Version 5.1

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$ResourceGroup,
    [Parameter(Mandatory)][string]$GitHubRepo,
    [string]$AppName    = "ppac-inventory-report",
    [string]$Location   = "eastus2",
    [switch]$SkipConsent,
    [switch]$SkipGitHub,
    [switch]$CreateResourceGroup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Banner ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "  Power Platform Inventory Report — Automated Deployment"   -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "WARNING: This script makes real changes to your tenant."     -ForegroundColor Red
Write-Host "         It is a SAMPLE and NOT guaranteed to work in"       -ForegroundColor Red
Write-Host "         all environments. Proceed at your own risk."        -ForegroundColor Red
Write-Host ""
Write-Host "Tenant:         $TenantId"
Write-Host "Subscription:   $SubscriptionId"
Write-Host "Resource Group: $ResourceGroup"
Write-Host "App Name:       $AppName"
Write-Host "GitHub Repo:    $GitHubRepo"
Write-Host "Location:       $Location"
Write-Host ""

$confirm = Read-Host "Type YES to continue, anything else to abort"
if ($confirm -ne "YES") {
    Write-Host "Aborted." -ForegroundColor Cyan
    exit 0
}

# ── Prerequisite checks ───────────────────────────────────────────────────────

Write-Host "`n[0/5] Checking prerequisites..." -ForegroundColor Cyan

function Test-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Error "'$Name' is not installed or not in PATH. See scripts/README.md for prerequisites."
    }
}

Test-Command "az"
Test-Command "gh"
Test-Command "node"
Test-Command "npm"

# Verify Azure CLI is logged in to the correct tenant
$currentAccount = az account show --query "{tenantId:tenantId, subscriptionId:id}" -o json 2>$null | ConvertFrom-Json
if (-not $currentAccount) {
    Write-Error "Not logged in to Azure CLI. Run: az login --tenant $TenantId"
}
if ($currentAccount.tenantId -ne $TenantId -and $currentAccount.subscriptionId -ne $SubscriptionId) {
    Write-Warning "Current Azure CLI session may be for a different tenant/subscription."
    Write-Warning "Expected tenant: $TenantId — Got: $($currentAccount.tenantId)"
    $continueAnyway = Read-Host "Continue anyway? (yes/no)"
    if ($continueAnyway -ne "yes") { exit 1 }
}

Write-Host "  Prerequisites OK." -ForegroundColor Green

# ── Step 1: App Registration ──────────────────────────────────────────────────

Write-Host "`n[1/5] Creating App Registration..." -ForegroundColor Cyan

$scriptRoot = Split-Path -Parent $PSCommandPath
$step1Result = & "$scriptRoot\steps\01-Register-App.ps1" `
    -TenantId $TenantId `
    -AppName  $AppName

if (-not $step1Result -or -not $step1Result.ClientId) {
    Write-Error "Step 1 failed: could not retrieve App Registration details."
}

$clientId = $step1Result.ClientId
Write-Host "  App Registration complete. Client ID: $clientId" -ForegroundColor Green

# ── Step 2: Admin Consent ─────────────────────────────────────────────────────

if (-not $SkipConsent) {
    Write-Host "`n[2/5] Granting admin consent..." -ForegroundColor Cyan
    & "$scriptRoot\steps\02-Grant-Consent.ps1" -TenantId $TenantId -ClientId $clientId
    Write-Host "  Admin consent granted." -ForegroundColor Green
} else {
    Write-Host "`n[2/5] Skipping admin consent (--SkipConsent)." -ForegroundColor DarkGray
}

# ── Step 3: Azure Static Web App ─────────────────────────────────────────────

Write-Host "`n[3/5] Creating Azure Static Web App..." -ForegroundColor Cyan

if ($CreateResourceGroup) {
    Write-Host "  Creating resource group '$ResourceGroup' in '$Location'..."
    az group create --name $ResourceGroup --location $Location --output none
}

$step3Result = & "$scriptRoot\steps\03-Create-SWA.ps1" `
    -ResourceGroup   $ResourceGroup `
    -AppName         $AppName `
    -Location        $Location `
    -SubscriptionId  $SubscriptionId

if (-not $step3Result -or -not $step3Result.Hostname) {
    Write-Error "Step 3 failed: could not retrieve Static Web App details."
}

$swaHostname      = $step3Result.Hostname
$deploymentToken  = $step3Result.DeploymentToken

Write-Host "  Static Web App created: https://$swaHostname" -ForegroundColor Green

# ── Step 4: GitHub Secrets ────────────────────────────────────────────────────

if (-not $SkipGitHub) {
    Write-Host "`n[4/5] Writing GitHub secrets..." -ForegroundColor Cyan
    & "$scriptRoot\steps\04-Set-GitHub-Secrets.ps1" `
        -GitHubRepo      $GitHubRepo `
        -ClientId        $clientId `
        -TenantId        $TenantId `
        -DeploymentToken $deploymentToken
    Write-Host "  GitHub secrets written." -ForegroundColor Green
} else {
    Write-Host "`n[4/5] Skipping GitHub secrets (--SkipGitHub)." -ForegroundColor DarkGray
}

# ── Step 5: Build and deploy ──────────────────────────────────────────────────

Write-Host "`n[5/5] Building and deploying application..." -ForegroundColor Cyan
& "$scriptRoot\steps\05-Build-Deploy.ps1" `
    -ClientId        $clientId `
    -TenantId        $TenantId `
    -DeploymentToken $deploymentToken
Write-Host "  Deployment complete." -ForegroundColor Green

# ── Post-deployment instructions ──────────────────────────────────────────────

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Deployment complete!"                                       -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App URL:   https://$swaHostname"
Write-Host "  Client ID: $clientId"
Write-Host "  Tenant ID: $TenantId"
Write-Host ""
Write-Host "NEXT STEPS:"
Write-Host "  1. Add 'https://$swaHostname' as a redirect URI in your"
Write-Host "     App Registration (Authentication -> Single-page application)."
Write-Host "     Azure portal: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps"
Write-Host ""
Write-Host "  2. Sign in to the app with a Power Platform Administrator account."
Write-Host ""
Write-Host "  3. If you see a 403 error, ensure the signed-in user has the"
Write-Host "     Power Platform Administrator role in your tenant."
Write-Host ""
Write-Host "To remove all resources created by this script, run:"
Write-Host "  .\scripts\Remove-Deployment.ps1 -TenantId $TenantId -ResourceGroup $ResourceGroup -AppName $AppName"
Write-Host ""
