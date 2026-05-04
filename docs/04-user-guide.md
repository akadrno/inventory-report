# User Guide

This guide explains the features available in the Power Platform Inventory Report and how to use them effectively as a Power Platform admin.

---

## Signing in

When you open the application you are immediately redirected to the Microsoft sign-in page. Sign in with an account that has **Power Platform Administrator** or **Global Administrator** rights in your tenant.

On first use, you may be prompted to consent to the permissions the app requests. If your Global Admin has already granted tenant-wide admin consent, you will not see this prompt.

> The app does not store any data. All information is fetched live from the APIs each session and held in browser memory only.

---

## Navigation

The left-hand side panel contains two top-level sections:

| Section | Description |
|---|---|
| **Home** | Dashboard overview with health summary |
| **Inventory** | Browse all Power Platform resources |
| **Governance** | Governance status, recommendations, and settings |

The side panel can be collapsed to icon-only mode by clicking the **‹** button at the top of the panel. Click any icon in the collapsed rail to navigate directly, or click **›** to expand the panel again.

---

## Home (Dashboard)

The home screen shows a summary of your tenant's Power Platform health:

- **Critical issues** — items that require immediate attention (e.g., environments with no DLP policy)
- **Warnings** — items that should be reviewed (e.g., environments not using managed features)
- **Resource totals** — counts of apps, flows, agents, and environments

Clicking **Critical** or **Warnings** takes you directly to the Recommendations page in Governance.

### Resource Insights

Below the summary cards, the **Resource Insights** section highlights specific patterns such as unmanaged environments. Clicking an insight row drills into a detail view showing which environments or resources are affected.

---

## Inventory

### Apps

Lists all Power Apps canvas apps across all environments. Each row shows:
- App name and icon
- Environment name
- Owner (resolved to display name where possible)
- Resource type badge

Click any row to open the resource detail panel with full metadata including the resource ID, environment details, and raw API properties.

### Flows

Lists all Power Automate cloud flows across all environments, with the same columns as Apps.

### Agents

Lists all Copilot Studio agents (chatbots) across all environments.

### Environments

Lists all Power Platform environments with:
- Environment name
- Type badge (Production, Sandbox, Developer, Trial, Default)
- Azure region
- Resource count

**Three-dot menu (⋮)** on each row opens two options:
- **View Metadata** — opens a modal with the environment's detailed properties: type, region, Dataverse URL, language, currency, managed environment status, and raw API properties
- **View Resources** — drills into the list of apps, flows, and agents within that environment

Clicking a row directly also opens the resource drill-down view.

**Sorting:** Click any column header to sort ascending or descending. The default sort is by resource count (highest first).

---

## Governance

### Overview

The governance overview shows three summary cards:

| Card | What it shows |
|---|---|
| **Critical** | Count of critical recommendations — click to go to Recommendations |
| **Warnings** | Count of high/medium recommendations — click to go to Recommendations |
| **Managed Environments** | How many environments have Managed Environments enabled — click to go to Environments |

Below the cards, **Resource Insights** lists specific governance findings with drill-down capability.

### Recommendations

A prioritised list of governance recommendations. Each recommendation shows:
- **Priority** badge (Critical / High / Medium)
- Title and description
- Affected environment or resource

Priorities are defined as:
- **Critical** — significant governance gap (e.g., environment has no DLP policy applied)
- **High** — recommended action (e.g., environment not managed)
- **Medium** — advisory (e.g., settings that could be tightened)

### Tenant Settings

Displays the current tenant-level Power Platform settings returned by the BAP API, categorised by topic. Settings that differ from recommended values are flagged.

---

## Performance notes

- Data is cached in browser memory for the duration of your session (5–30 minutes depending on the API).
- Large tenants with many environments may take 10–30 seconds for the initial load as the app paginates through API results.
- Refreshing the page clears the cache and re-fetches all data.

---

## Signing out

There is no explicit sign-out button. Close the browser tab or clear session storage to end the session. Authentication tokens are stored in `sessionStorage` and are automatically discarded when the browser tab is closed.

---

## Limitations

| Limitation | Notes |
|---|---|
| Read-only | The app does not create, modify, or delete any Power Platform resources |
| No export | There is no built-in export or reporting feature |
| Single tenant | The app displays data for the tenant the signed-in user belongs to only |
| Sample only | Not all environments or resource types may be returned depending on API pagination limits |
| No real-time updates | Data is fetched once per session; it does not auto-refresh |

---

Next: [API Reference](05-api-reference.md)
