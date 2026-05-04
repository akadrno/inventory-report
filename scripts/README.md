# Automated Setup Scripts

These PowerShell scripts automate the end-to-end deployment of the Power Platform Inventory Report using Azure CLI and GitHub CLI. They are intended for advanced users who are comfortable with scripting, Azure administration, and PowerShell.

---

> ## ⚠️ CRITICAL WARNINGS — READ BEFORE PROCEEDING
>
> **These scripts are provided as-is, with NO guarantee of correctness, completeness, or compatibility with your environment.**
>
> - **NOT guaranteed to work in all tenants.** Every Microsoft 365 and Azure tenant has unique configurations, conditional access policies, admin restrictions, and security settings that can cause these scripts to fail or behave unexpectedly. Common blockers include tenant-level restrictions on app registrations, custom admin consent workflows, Azure Policy restrictions on resource creation, and differences in service principal availability.
> - **NOT a supported or official Microsoft tool.** These scripts are sample automation for a sample application. They come with no warranty, SLA, or Microsoft support.
> - **Human error can cause real problems.** Providing incorrect values for tenant ID, subscription ID, or resource group names can create unwanted resources, grant unintended permissions, or fail partway through — leaving your environment in a partially-configured state. Read each script and understand what it does before running it.
> - **These scripts make real changes to your Azure AD and Azure subscription.** App registrations, resource groups, and Azure Static Web Apps created by these scripts will incur Azure AD object quota usage and may incur Azure costs (though the SWA Free tier has no compute charge).
> - **Admin consent is irreversible without manual cleanup.** Granting admin consent via script has the same effect as granting it in the portal. If you run the consent step with the wrong app ID, you will need to revoke consent manually.
> - **Use the cleanup script after testing.** `Remove-Deployment.ps1` removes the resources created by these scripts. Always run it when you no longer need the deployment to avoid leaving orphaned app registrations.
> - **Review all script parameters before execution.** Treat every parameter as if you were filling in a production form — because in your tenant, you are.

---

## What these scripts do

| Script | Purpose |
|---|---|
| `Deploy-All.ps1` | Master orchestration — runs all steps in sequence |
| `steps/01-Register-App.ps1` | Creates the Azure AD App Registration and configures API permissions |
| `steps/02-Grant-Consent.ps1` | Grants tenant-wide admin consent for the App Registration |
| `steps/03-Create-SWA.ps1` | Creates the Azure Static Web App resource |
| `steps/04-Set-GitHub-Secrets.ps1` | Writes deployment secrets into your GitHub repository |
| `steps/05-Build-Deploy.ps1` | Builds the Vite app and deploys to Azure Static Web Apps |
| `Remove-Deployment.ps1` | Removes all resources created by the deployment scripts |

---

## Prerequisites

All of the following must be installed and authenticated **before** running any script.

### Tools

| Tool | Minimum version | Install |
|---|---|---|
| PowerShell | 5.1 (Windows) or 7.x (cross-platform) | https://aka.ms/powershell |
| Azure CLI | 2.50.0+ | https://learn.microsoft.com/cli/azure/install-azure-cli |
| GitHub CLI | 2.x | https://cli.github.com |
| Node.js | 18 LTS | https://nodejs.org |

Verify:
```powershell
az --version
gh --version
node --version
```

### Authentication

Log in before running scripts:

```powershell
# Azure CLI — sign in as a user with Global Administrator rights
az login --tenant <your-tenant-id>

# Set the correct subscription
az account set --subscription <your-subscription-id>

# GitHub CLI
gh auth login
```

### Required permissions

The account used for Azure CLI must have:
- **Global Administrator** in Azure AD (required for app registration and admin consent)
- **Owner** or **Contributor** on the target Azure subscription (required for SWA creation)

The account used for GitHub CLI must have:
- **Admin** access to the target GitHub repository (required to write secrets)

---

## Quick start

```powershell
# Clone the repository
git clone https://github.com/akadrno/inventory-report.git
cd inventory-report

# Run the full automated deployment
.\scripts\Deploy-All.ps1 `
  -TenantId        "<your-tenant-id>" `
  -SubscriptionId  "<your-subscription-id>" `
  -ResourceGroup   "rg-ppac-inventory" `
  -GitHubRepo      "akadrno/inventory-report" `
  -AppName         "ppac-inventory-report" `
  -Location        "eastus2"
```

To run individual steps, see each script in the `steps/` folder.

---

## Known failure modes

These are the most common reasons the scripts fail. They are not bugs — they are tenant or environment differences that cannot be predicted or coded around.

| Failure | Cause | Resolution |
|---|---|---|
| `Insufficient privileges to complete the operation` | The signed-in user is not a Global Administrator | Re-run `az login` with a Global Admin account |
| `Power Platform API service principal not found` | The service principal hasn't been provisioned in your tenant yet | Visit https://admin.powerplatform.microsoft.com as a Global Admin first, then retry |
| `Admin consent workflow required` | Your tenant has a custom consent policy requiring approval | Complete consent manually in the Azure portal following [the app registration guide](../docs/02-app-registration.md) |
| `ResourceGroupNotFound` | The resource group doesn't exist yet | Run with `-CreateResourceGroup` flag or create it first with `az group create` |
| `Static Web Apps quota exceeded` | Azure subscription limits | Use a different subscription or region |
| `GitHub secret already exists` | A secret with that name already exists in the repo | The script will overwrite it — this is safe if you intend to update the value |
| `App registration already exists` | A registration with the same name already exists | The script will skip creation and use the existing one |
| Partial failure midway through | Any error in steps 1–4 | Run `Remove-Deployment.ps1` to clean up, fix the issue, and start again |

---

## Step-by-step reference

For full manual instructions, see the docs folder:

- [App Registration & Admin Consent](../docs/02-app-registration.md)
- [Azure Static Web Apps](../docs/03-azure-static-web-apps.md)
- [User Guide](../docs/04-user-guide.md)
- [API Reference](../docs/05-api-reference.md)
