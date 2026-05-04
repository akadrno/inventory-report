# Power Platform Inventory Report

A browser-based inventory and governance dashboard for Power Platform admins. It surfaces apps, cloud flows, Copilot Studio agents, environments, DLP policies, and tenant settings in a single read-only view — authenticated through your own Azure AD app registration.

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
| **Home** | At-a-glance health summary: critical issues, warnings, and resource counts |
| **Inventory** | Browse all Power Apps, Cloud Flows, Copilot Studio agents, and Environments |
| **Governance** | Managed environment status, DLP policy gaps, tenant settings review |
| **Report** | Aggregated recommendations with severity ratings |

All data is fetched live from the Power Platform and Microsoft Graph APIs using your signed-in user's delegated permissions. Nothing is stored outside your browser session.

## Documentation

| Guide | Description |
|---|---|
| [Prerequisites](docs/01-prerequisites.md) | What you need before you start |
| [App Registration & Admin Consent](docs/02-app-registration.md) | Create the Azure AD app and grant consent |
| [Azure Static Web Apps](docs/03-azure-static-web-apps.md) | Host the app in Azure |
| [User Guide](docs/04-user-guide.md) | How to use the dashboard |
| [API Reference](docs/05-api-reference.md) | All APIs called, with links to official docs |

## Quick start (summary)

1. [Register an Azure AD application](docs/02-app-registration.md) and grant admin consent.
2. Copy `.env.example` to `.env.local` and set `VITE_CLIENT_ID` and `VITE_TENANT_ID`.
3. Run locally: `npm install && npm run dev`, **or** deploy to Azure Static Web Apps following the [hosting guide](docs/03-azure-static-web-apps.md).
4. Sign in with a Power Platform admin account.

## Technology stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) build tooling
- [Fluent UI v9](https://react.fluentui.dev/) component library
- [MSAL Browser](https://github.com/AzureAD/microsoft-authentication-library-for-js) for Azure AD authentication
- [TanStack Query](https://tanstack.com/query) for data fetching and caching
- [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/overview) for hosting

## APIs used

- [Power Platform Resource Query API](https://learn.microsoft.com/rest/api/power-platform/)
- [Business Application Platform (BAP) API](https://learn.microsoft.com/power-platform/admin/programmability-extensibility-overview) — DLP policies, tenant settings
- [Microsoft Graph API](https://learn.microsoft.com/graph/overview) — user display name resolution

See [API Reference](docs/05-api-reference.md) for full details.

## License

MIT — see [LICENSE](LICENSE).
