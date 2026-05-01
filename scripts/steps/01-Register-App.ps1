<#
.SYNOPSIS
    Creates an Azure AD App Registration for the Power Platform Inventory Report.

.DESCRIPTION
    - Creates the App Registration (or reuses an existing one with the same name)
    - Adds a Single-Page Application redirect URI for localhost (dev) and optionally a hosted URL
    - Adds delegated API permissions for:
        Power Platform API   (https://api.powerplatform.com)
        BAP API              (https://api.bap.microsoft.com)
        Microsoft Graph      User.ReadBasic.All
    - Does NOT grant admin consent (see 02-Grant-Consent.ps1)
    - Returns an object with ClientId and TenantId

    !! WARNING !! — This script creates a real Azure AD App Registration in your tenant.
    It is NOT guaranteed to work in all tenants. Service principal availability for the
    Power Platform API and BAP API varies by tenant configuration. If permission lookups
    fail, the script will warn you and provide manual steps.

.PARAMETER TenantId
    Your Azure AD Tenant ID or domain.

.PARAMETER AppName
    Display name for the App Registration.

.PARAMETER HostedUrl
    Optional. The Azure Static Web Apps URL to add as an additional redirect URI.

.OUTPUTS
    PSCustomObject with ClientId and TenantId properties.
#>

#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$TenantId,
    [string]$AppName    = "ppac-inventory-report",
    [string]$HostedUrl  = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "  [01-Register-App] Starting..." -ForegroundColor Cyan

# ── Well-known Microsoft app IDs ──────────────────────────────────────────────
# These are Microsoft first-party service principal app IDs.
# They should be consistent across tenants, but service principals must be
# provisioned in your tenant before they can be used as API permission targets.
# If lookups fail, visit the relevant admin portals to trigger provisioning.

$GRAPH_APP_ID      = "00000003-0000-0000-c000-000000000000"  # Microsoft Graph
$BAP_APP_ID        = "00000007-0000-0000-c000-000000000000"  # Business Application Platform
$PP_API_APP_ID     = "8578e004-a5c6-46e7-913e-12f58912df43"  # Power Platform API

# Microsoft Graph — User.ReadBasic.All permission ID (stable across tenants)
$GRAPH_USER_READ_BASIC_ALL = "b340eb25-3456-403f-be2f-af7a0d370277"

# ── Check for existing app registration ──────────────────────────────────────

Write-Host "  Checking for existing app registration '$AppName'..."

$existingApp = az ad app list --display-name $AppName --query "[0].appId" -o tsv 2>$null
if ($existingApp -and $existingApp.Trim()) {
    $appId = $existingApp.Trim()
    Write-Host "  Found existing app registration: $appId (reusing)" -ForegroundColor Yellow
} else {
    Write-Host "  Creating new app registration..."
    $appId = az ad app create `
        --display-name $AppName `
        --sign-in-audience "AzureADMyOrg" `
        --query "appId" -o tsv
    Write-Host "  Created App Registration: $appId"
}

# ── Configure SPA redirect URIs ───────────────────────────────────────────────

Write-Host "  Configuring redirect URIs..."

$redirectUris = @("http://localhost:5173")
if ($HostedUrl -and $HostedUrl.Trim()) {
    $redirectUris += $HostedUrl.Trim().TrimEnd("/")
}

$redirectUrisJson = $redirectUris | ConvertTo-Json -Compress
az ad app update --id $appId --spa-redirect-uris $redirectUrisJson --output none

Write-Host "  Redirect URIs: $($redirectUris -join ', ')"

# ── Ensure service principal exists for the app ───────────────────────────────

$spExists = az ad sp show --id $appId --query "appId" -o tsv 2>$null
if (-not $spExists) {
    Write-Host "  Creating service principal for app..."
    az ad sp create --id $appId --output none
}

# ── Helper: get or provision a Microsoft service principal ────────────────────

function Get-OrProvisionSP([string]$AppId, [string]$DisplayName) {
    $sp = az ad sp show --id $AppId --query "id" -o tsv 2>$null
    if (-not $sp -or -not $sp.Trim()) {
        Write-Host "  '$DisplayName' service principal not found. Attempting to provision..."
        az ad sp create --id $AppId --output none 2>$null
        Start-Sleep -Seconds 3
        $sp = az ad sp show --id $AppId --query "id" -o tsv 2>$null
    }
    return $sp
}

# ── Helper: get delegated permission scope ID from a service principal ────────

function Get-ScopeId([string]$SpAppId, [string]$ScopeName) {
    $scopes = az ad sp show --id $SpAppId --query "oauth2PermissionScopes" -o json 2>$null | ConvertFrom-Json
    if (-not $scopes) { return $null }
    $match = $scopes | Where-Object { $_.value -eq $ScopeName }
    return $match | Select-Object -ExpandProperty id -First 1
}

# ── Add Graph permission: User.ReadBasic.All ─────────────────────────────────

Write-Host "  Adding Microsoft Graph permission (User.ReadBasic.All)..."
try {
    az ad app permission add `
        --id $appId `
        --api $GRAPH_APP_ID `
        --api-permissions "${GRAPH_USER_READ_BASIC_ALL}=Scope" `
        --output none
    Write-Host "  Graph permission added." -ForegroundColor Green
} catch {
    Write-Warning "  Failed to add Graph permission: $_"
    Write-Warning "  Add 'User.ReadBasic.All' manually in the Azure portal."
}

# ── Add Power Platform API permission ─────────────────────────────────────────

Write-Host "  Adding Power Platform API permissions..."
try {
    $ppSp = Get-OrProvisionSP -AppId $PP_API_APP_ID -DisplayName "Power Platform API"
    if ($ppSp -and $ppSp.Trim()) {
        $ppScopeId = Get-ScopeId -SpAppId $PP_API_APP_ID -ScopeName "user_impersonation"
        if (-not $ppScopeId) {
            # Fall back to any available scope
            $ppScopeId = az ad sp show --id $PP_API_APP_ID `
                --query "oauth2PermissionScopes[0].id" -o tsv 2>$null
        }
        if ($ppScopeId -and $ppScopeId.Trim()) {
            az ad app permission add `
                --id $appId `
                --api $PP_API_APP_ID `
                --api-permissions "$($ppScopeId.Trim())=Scope" `
                --output none
            Write-Host "  Power Platform API permission added." -ForegroundColor Green
        } else {
            Write-Warning "  Could not find a delegated scope on the Power Platform API SP."
            Write-Warning "  Add it manually: Azure portal -> App registrations -> API permissions -> Power Platform API"
        }
    } else {
        Write-Warning "  Power Platform API service principal not found in this tenant."
        Write-Warning "  To provision it: visit https://admin.powerplatform.microsoft.com as Global Admin,"
        Write-Warning "  then re-run this script."
        Write-Warning "  Alternatively, add the permission manually in the Azure portal."
    }
} catch {
    Write-Warning "  Power Platform API permission step failed: $_"
    Write-Warning "  Add this permission manually in the Azure portal."
}

# ── Add BAP API permission ────────────────────────────────────────────────────

Write-Host "  Adding BAP API permissions..."
try {
    $bapSp = Get-OrProvisionSP -AppId $BAP_APP_ID -DisplayName "Business Application Platform"
    if ($bapSp -and $bapSp.Trim()) {
        $bapScopeId = Get-ScopeId -SpAppId $BAP_APP_ID -ScopeName "user_impersonation"
        if ($bapScopeId -and $bapScopeId.Trim()) {
            az ad app permission add `
                --id $appId `
                --api $BAP_APP_ID `
                --api-permissions "$($bapScopeId.Trim())=Scope" `
                --output none
            Write-Host "  BAP API permission added." -ForegroundColor Green
        } else {
            Write-Warning "  Could not resolve BAP API scope ID. Add manually in Azure portal."
        }
    } else {
        Write-Warning "  BAP API service principal not found in this tenant."
        Write-Warning "  Add the permission manually in the Azure portal."
    }
} catch {
    Write-Warning "  BAP API permission step failed: $_"
    Write-Warning "  Add this permission manually in the Azure portal."
}

# ── Return result ─────────────────────────────────────────────────────────────

Write-Host "  [01-Register-App] Complete." -ForegroundColor Green
Write-Host ""
Write-Host "  IMPORTANT: Admin consent has NOT been granted yet."
Write-Host "  Run 02-Grant-Consent.ps1, or grant consent manually in the Azure portal."
Write-Host ""

return [PSCustomObject]@{
    ClientId = $appId
    TenantId = $TenantId
}
