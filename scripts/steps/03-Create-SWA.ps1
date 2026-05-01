<#
.SYNOPSIS
    Creates an Azure Static Web App resource for the Power Platform Inventory Report.

.DESCRIPTION
    Creates (or reuses) an Azure Static Web App in the specified resource group,
    then retrieves the deployment token needed for CI/CD and SWA CLI deployments.

    !! WARNING !! — This script creates a real Azure resource in your subscription.
    While the Free tier has no compute charge, resource group creation, and SWA
    resources are subject to your Azure subscription's policies and quotas.

    !! WARNING !! — Azure Policy assignments in your subscription may prevent
    resource creation (e.g., allowed-locations policies, naming convention policies,
    tag requirements). This script cannot anticipate all policy configurations and
    will fail if any policy blocks the deployment.

    !! WARNING !! — The deployment token returned by this script grants full
    write access to your Static Web App. Treat it like a password. Never commit it
    to source control. The script outputs it to the console — close your terminal
    session when done or clear the console history.

.PARAMETER ResourceGroup
    Azure Resource Group name.

.PARAMETER AppName
    Name for the Static Web App resource.

.PARAMETER Location
    Azure region. Default: eastus2.

.PARAMETER SubscriptionId
    Azure Subscription ID.

.OUTPUTS
    PSCustomObject with Hostname and DeploymentToken properties.
#>

#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [Parameter(Mandatory)][string]$AppName,
    [Parameter(Mandatory)][string]$SubscriptionId,
    [string]$Location = "eastus2"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "  [03-Create-SWA] Starting..." -ForegroundColor Cyan

# Set subscription context
az account set --subscription $SubscriptionId --output none

# Check if SWA already exists
Write-Host "  Checking for existing Static Web App '$AppName'..."
$existingHostname = az staticwebapp show `
    --name $AppName `
    --resource-group $ResourceGroup `
    --query "defaultHostname" -o tsv 2>$null

if ($existingHostname -and $existingHostname.Trim()) {
    Write-Host "  Found existing Static Web App: $existingHostname (reusing)" -ForegroundColor Yellow
    $hostname = $existingHostname.Trim()
} else {
    Write-Host "  Creating Static Web App '$AppName' in '$ResourceGroup' ($Location)..."
    Write-Host "  Note: Creating without GitHub integration. CI/CD will be configured separately."

    $hostname = az staticwebapp create `
        --name $AppName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Free `
        --query "defaultHostname" -o tsv

    if (-not $hostname -or -not $hostname.Trim()) {
        Write-Error "Static Web App creation failed — no hostname returned. Check the Azure portal for errors."
    }
    $hostname = $hostname.Trim()
    Write-Host "  Static Web App created: https://$hostname" -ForegroundColor Green
}

# Retrieve the deployment token
Write-Host "  Retrieving deployment token..."
$deploymentToken = az staticwebapp secrets list `
    --name $AppName `
    --resource-group $ResourceGroup `
    --query "properties.apiKey" -o tsv

if (-not $deploymentToken -or -not $deploymentToken.Trim()) {
    Write-Error "Could not retrieve the deployment token. Check permissions on the Static Web App resource."
}
$deploymentToken = $deploymentToken.Trim()

Write-Host "  Deployment token retrieved." -ForegroundColor Green
Write-Host ""
Write-Host "  !! KEEP THIS TOKEN SECURE. Do NOT share or commit it. !!" -ForegroundColor Red
Write-Host "  Hostname: $hostname"
Write-Host ""

Write-Host "  [03-Create-SWA] Complete." -ForegroundColor Green

return [PSCustomObject]@{
    Hostname        = $hostname
    DeploymentToken = $deploymentToken
}
