<#
.SYNOPSIS
    Builds the Vite application and deploys it to Azure Static Web Apps.

.DESCRIPTION
    Sets the required environment variables, runs 'npm run build' to produce
    the production bundle in dist/, then deploys using the SWA CLI.

    !! WARNING !! — This script installs the @azure/static-web-apps-cli npm package
    globally if it is not already installed. This modifies your global npm environment.

    !! WARNING !! — The VITE_CLIENT_ID and VITE_TENANT_ID values are embedded into
    the compiled JavaScript bundle at build time. They are visible in the browser's
    source view. Do NOT use a client secret in these variables — only use the Client ID
    and Tenant ID, which are not themselves secret values.

    !! WARNING !! — This script deploys to the 'production' environment of your
    Static Web App. Any existing deployed version will be replaced immediately.

.PARAMETER ClientId
    Azure AD App Registration Client ID (injected as VITE_CLIENT_ID).

.PARAMETER TenantId
    Azure AD Tenant ID or domain (injected as VITE_TENANT_ID).

.PARAMETER DeploymentToken
    Azure Static Web Apps deployment token.

.PARAMETER Environment
    SWA deployment environment. Default: production.
#>

#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ClientId,
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$DeploymentToken,
    [string]$Environment = "production"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "  [05-Build-Deploy] Starting..." -ForegroundColor Cyan

# Locate repo root (two levels up from scripts/steps/)
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# Check npm dependencies are installed
if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
    Write-Host "  node_modules not found. Running npm install..."
    Push-Location $repoRoot
    npm install
    Pop-Location
}

# Set build-time environment variables
$env:VITE_CLIENT_ID = $ClientId
$env:VITE_TENANT_ID = $TenantId

# Run Vite build
Write-Host "  Building application (npm run build)..."
Push-Location $repoRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
Write-Host "  Build succeeded." -ForegroundColor Green

# Clear env vars (they are now baked into dist/)
Remove-Item Env:VITE_CLIENT_ID -ErrorAction SilentlyContinue
Remove-Item Env:VITE_TENANT_ID -ErrorAction SilentlyContinue

# Ensure SWA CLI is available
$swaCli = Get-Command "swa" -ErrorAction SilentlyContinue
if (-not $swaCli) {
    Write-Host "  SWA CLI not found. Installing @azure/static-web-apps-cli globally..."
    npm install -g @azure/static-web-apps-cli
}

# Deploy
Write-Host "  Deploying to Azure Static Web Apps (environment: $Environment)..."
$distPath = Join-Path $repoRoot "dist"

npx swa deploy $distPath `
    --deployment-token $DeploymentToken `
    --env $Environment

if ($LASTEXITCODE -ne 0) {
    Write-Error "SWA deployment failed. Check the output above for details."
}

Write-Host "  [05-Build-Deploy] Deployment complete." -ForegroundColor Green
