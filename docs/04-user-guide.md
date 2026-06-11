# User Guide

This guide explains the features available in the Power Platform Inventory Report and how to use them effectively as a Power Platform admin.

---

## Signing in

When you open the application you see a "command center" sign-in screen. Click **Sign in with Microsoft** and authenticate with an account that has **Power Platform Administrator** or **Global Administrator** rights in your tenant.

On first use you may be prompted to consent to the permissions the app requests. If a Global Admin has already granted tenant-wide admin consent, you won't see this prompt. Some capabilities (resource sharing) acquire an additional scope on demand, which may trigger a one-time consent popup the first time you use them.

> Core data is fetched live from the APIs each session and held in browser memory only. If an optional Azure Storage account is configured, risk assessments, resource tags, and the cached sign-in dataset are persisted there; otherwise risk assessments and tags fall back to `localStorage`.

---

## Theme

A **light / dark mode** toggle (sun / moon icon) sits in the top-right header next to your name. Your choice is remembered across sessions.

---

## Navigation

A vertical **icon rail** on the left switches between the six top-level areas:

| Rail | Description |
|---|---|
| **Home** | Command-center overview and governance health |
| **Inventory** | Browse all Power Platform resources |
| **Governance** | Governance posture, policies, recommendations, and risk |
| **Usage** | Adoption analytics and sign-in geography |
| **Tagging** | Tag resources and manage the term store |
| **Licensing** | License capacity and SKU utilization |

Selecting a rail (other than Home) opens a **secondary panel** listing that area's sub-pages. Collapse it to icon-only mode with the **‹** button, or expand again with **›**. Clicking the active rail icon also toggles the panel.

---

## Home

The home screen is a cinematic dashboard:

- **Live counters** for Agents, Apps, and Flows across the tenant, plus Environments, Managed Environments, and total resources.
- **Health chips** showing critical and high-priority governance findings, compliant resource count, and resources not yet reviewed. Clicking a chip jumps to the relevant page (Recommendations or Risk Assessments).
- A **usage sign-in cache status** strip (when Azure Storage is configured) showing when the heatmap data was last refreshed, with an **Update now** button.
- Tabs below the hero: **Overview** (resource breakdown + recently created), **Tenant Governance**, **DLP Policies**, and **Recommendations**.

---

## Inventory

The Inventory panel offers: **All Resources, Apps, Flows, Agents, Environments, Environment Groups,** and **Users**.

Shared controls on the resource lists:
- **Search** by name, type, environment, owner, or region.
- **System hidden / Show system** toggle to include or exclude system-generated resources.
- **Refresh** to re-pull from the API.

### Apps / Flows / Agents
Each shows a sortable table (name, type, owner, environment). Sub-filter buttons narrow by subtype — Apps: Canvas / Model-driven / Code / App Builder; Flows: Cloud / Agent / Workflow Agent; Agents: Copilot Studio / M365 Agent Builder. Click any row to open the **resource detail panel**.

### Environments
Lists environments with type, region, and managed status, filterable by type (Production, Default, Sandbox, Trial, Developer, Dataverse for Teams). Drill in to see the resources within an environment.

### Environment Groups
Group cards (with a cinematic accent treatment) show each group and its environment count. Click a card to drill into its environments, then into a specific environment's resources. The shield icon opens the group's enabled rules/policies.

### Users
Aggregates resources by owner so you can see who owns what across the tenant.

### Resource detail panel
Opening any resource slides in a panel with tabs:
- **Overview** — name, owner, type, environment, status, activity (created / modified / published).
- **Configuration** — connectors (with tier/publisher), and for agents their knowledge, tools, connected agents, flows, channels, and topics; plus a **Sharing** section listing who the resource is shared with (users/groups and their roles).
- **Usage** — inventory-derived activity timestamps.
- **More** — any remaining raw inventory fields. A "Show raw data" toggle reveals the full JSON.

---

## Governance

The Governance panel offers eight pages:

| Page | What it shows |
|---|---|
| **Overview** | Summary cards (Critical / Warnings / Managed Environments) and **Resource Insights** with drill-down |
| **Tenant Settings** | Tenant-level Power Platform settings from the BAP API, with warnings on risky values |
| **DLP Policies** | All DLP policies, connector classification (Confidential / General / Blocked), and findings (no policies, no data separation, nothing blocked) |
| **Cross Tenant Connections** | Cross-tenant connection report (cached, with refresh) |
| **Connections** | Connections enumerated across environments |
| **Recommendations** | Advisor (security & governance) recommendations plus the app's own computed remediation actions with `pac`/portal guidance |
| **Maker Analytics** | Maker activity — who is building, where, and in unmanaged environments |
| **Risk Assessments** | Assign risk level and compliance status to resources; persisted to Azure Storage (or `localStorage`) |

Many governance pages require Power Platform admin permissions (BAP API); without them the page shows a permission notice instead of failing.

---

## Usage

The Usage panel offers **Overview, Apps, Flows, Agents,** and **Heatmap**.

Usage analytics combine two sources: **inventory** (counts, creation/activity, owners, environments, active/stale/ownerless) and **Entra sign-in logs** (sessions, active users, locations, success rate). Sign-in data attributes at the **product level** (Power Apps / Power Automate / Copilot Studio) — individual canvas apps share first-party sign-in identities, so per-resource sign-in counts aren't available; the UI labels this accordingly.

### Overview
- KPI cards: **active users (30d), sign-ins/sessions, countries, success rate**.
- **Sign-in activity** — a 30-day daily trend plus a success/failed breakdown.
- **Where users sign in** (top countries) with a link to the full map.
- **Most active users** leaderboard.
- **By product** — Apps / Flows / Agents cards (inventory count + sessions + active users + a creation trend). Click one to drill in.
- **Inventory health** — total, active (30d), stale (90d+), and ownerless counts.

### Apps / Flows / Agents drill-ins
Per product: KPIs (total, active, stale, ownerless, plus sessions & active users), creation and sign-in trends, breakdown by subtype, where it's used and most active users, top owners and environments, and a recent-resources table (click a row for the detail panel and its sharing info).

### Heatmap
A world map of where users sign in to Power Platform, with 7 / 30 / 90-day windows. The 7- and 30-day views render from a cached sign-in dataset (instant); 90-day fetches live. A background job refreshes the cache hourly while the app is open, and **Update now** triggers it manually. Requires `AuditLog.Read.All` and an audit-reader Entra role.

---

## Tagging

The Tagging panel offers **Resources** and **Term Store**.

- **Resources** — browse your resources and apply tags.
- **Term Store** — manage a SharePoint-style taxonomy of groups, term sets, and terms used for tagging.

Tags persist to Azure Storage when configured, otherwise to `localStorage`.

---

## Licensing

The Licensing panel offers a **Summary** plus per-product pages (**Power Apps, Power Automate, Copilot Studio**). Each shows license capacity (SKUs, purchased, assigned/consumed) and per-SKU utilization, flagging over-allocation. Requires the Graph `Organization.Read.All` permission; without it the page shows a permission notice.

---

## Performance notes

- Data is cached in browser memory for the duration of your session (5–30 minutes depending on the API).
- Large tenants may take 10–30 seconds for the initial load as the app paginates through API results (it auto-loads pages).
- The usage heatmap loads instantly from the cached sign-in dataset and refreshes in the background.
- Refreshing the page clears in-memory caches and re-fetches; persisted data (assessments, tags, sign-in cache) survives in Azure Storage.

---

## Signing out

Use the **Sign out** button in the top-right header. Authentication tokens are stored in `sessionStorage` and are also discarded when the browser tab is closed.

---

## Limitations

| Limitation | Notes |
|---|---|
| Read-only | The app does not create, modify, or delete Power Platform resources (risk assessments and tags are the only data it writes, to your own storage) |
| Product-level usage | Sign-in usage attributes to products, not individual apps/flows/agents |
| Single tenant | Displays data for the signed-in user's tenant only |
| Permission-gated | Governance, Licensing, and Usage sections show a notice when the required permission/role is missing |
| Sample only | Not a production or officially supported Microsoft product |

---

Next: [API Reference](05-api-reference.md)
