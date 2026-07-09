# Platform 360: A Power Platform Inventory and Governance App

A browser-based inventory, governance, and usage dashboard for Power Platform admins. It surfaces apps, cloud flows, Copilot Studio agents, environments, DLP policies, tenant settings, licensing, sign-in usage, and resource tagging in a single read-only view — authenticated through your own Azure AD app registration. It ships with a light/dark theme and a "command center" home screen.

---

> ## ⚠️ IMPORTANT DISCLAIMER
>
> **This is a sample application provided for educational and exploratory purposes only.**
>
> - It is **NOT a production-ready application** and has not been hardened, performance-tested, or security-reviewed for enterprise use.
> - It is **NOT an officially supported Microsoft product or sample**. No warranty, SLA, or support commitment of any kind is offered.
> - By downloading, installing, or running this application you accept **full responsibility for its use** in your environment. You assume all risk, including (but not limited to) unintended data access, cost incurred in Azure, or misconfiguration of your tenant.
> - **Read all setup instructions carefully** before running the application in any environment that contains real data.
> - This application calls live Microsoft APIs using credentials you supply. Ensure you understand the permissions being granted before proceeding.
> - Always follow your organisation's security and compliance policies.

---

## What it does

| Section | Description |
|---|---|
| **Home** | Overview: live Agent / App / Flow counts, governance health (critical, warnings, compliance), and tabs for resource breakdown, tenant governance, and recommendations |
| **Inventory** | Browse all resources — Apps (canvas / model-driven / code), Flows (cloud / agent), Agents (Copilot Studio / M365), Environments, Environment Groups, and Users — with search and a detail panel (configuration, sharing, activity) |
| **Governance** | Overview & resource insights, Tenant Settings, DLP Policies, Cross-Tenant Connections, Connections, Recommendations (Advisor + computed), Maker Analytics, and Risk Assessments |
| **Usage** | Adoption analytics from Entra sign-ins + inventory: active users, sessions, success rate, geography, top users; per-product (Apps / Flows / Agents) drill-ins; and a world **Heatmap** of where users sign in |
| **Tagging** | Browse and tag resources, backed by a SharePoint-style Term Store (groups, term sets, terms) |
| **Licensing** | Power Platform license capacity and SKU utilization (Power Apps, Power Automate, Copilot Studio) |

Most data is fetched live from the Power Platform, BAP, and Microsoft Graph APIs using your signed-in user's **delegated** permissions and held only in your browser session. Optionally, an Azure Storage account (account-level Table SAS) can persist risk assessments, resource tags, and a cached sign-in dataset for the usage heatmap — see the [hosting guide](docs/03-azure-static-web-apps.md). Without it, those features fall back to `localStorage` or live fetches.

## Documentation

| Guide | Description |
|---|---|
| [Prerequisites](docs/01-prerequisites.md) | What you need before you start |
| [App Registration & Admin Consent](docs/02-app-registration.md) | Create the Azure AD app and grant consent |
| [Azure Static Web Apps](docs/03-azure-static-web-apps.md) | Host the app in Azure |
| [User Guide](docs/04-user-guide.md) | How to use the dashboard |
| [API Reference](docs/05-api-reference.md) | All APIs called, with links to official docs |
| [GitHub Actions Deployment](docs/06-github-actions-deployment.md) | Automated deployment via GitHub Actions on every push to main |

## Quick start (summary)

1. [Register an Azure AD application](docs/02-app-registration.md) and grant admin consent.
2. Copy `.env.example` to `.env.local` and set `VITE_CLIENT_ID` and `VITE_TENANT_ID` (optionally `VITE_STORAGE_ACCOUNT` + `VITE_TABLE_SAS` for persistence).
3. Run locally: `npm install && npm run dev` (serves on `http://localhost:3000`), **or** deploy to Azure Static Web Apps following the [hosting guide](docs/03-azure-static-web-apps.md).
4. Add your app URL (e.g. `http://localhost:3000`) as a redirect URI on the app registration, then sign in with a Power Platform admin account.

## Technology stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) build tooling
- [Fluent UI v9](https://react.fluentui.dev/) component library
- [MSAL Browser](https://github.com/AzureAD/microsoft-authentication-library-for-js) for Azure AD authentication
- [TanStack Query](https://tanstack.com/query) for data fetching and caching
- [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/overview) for hosting

## APIs used

- [Power Platform Resource Query API](https://learn.microsoft.com/rest/api/power-platform/) — apps, flows, agents, environments inventory
- [Business Application Platform (BAP) API](https://learn.microsoft.com/power-platform/admin/programmability-extensibility-overview) — DLP policies, tenant settings, recommendations, connections
- [Power Apps Service API](https://learn.microsoft.com/connectors/powerappsforadmins/) — resource sharing / permissions
- [Microsoft Graph API](https://learn.microsoft.com/graph/overview) — user name resolution (`User.ReadBasic.All`), license capacity (`Organization.Read.All`), and sign-in logs for the usage heatmap (`AuditLog.Read.All`)
- [Azure Table Storage](https://learn.microsoft.com/rest/api/storageservices/table-service-rest-api) *(optional)* — persists risk assessments, tags, and the cached sign-in dataset via an account-level SAS

See [API Reference](docs/05-api-reference.md) for full details.

## License

MIT — see [LICENSE](LICENSE).
