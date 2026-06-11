# Copilot Instructions — PPAC Inventory Report

## Build & Dev Commands

```bash
npm run dev          # Start Vite dev server on http://localhost:3000
npm run build        # TypeScript check + Vite production build (tsc && vite build)
npm run lint         # ESLint across .ts/.tsx (zero warnings allowed)
npm run preview      # Serve the production build locally
```

There is no test framework configured. No unit or integration tests exist.

## Environment Variables

The app requires `VITE_CLIENT_ID` and `VITE_TENANT_ID` in `.env.local` (copied from `.env.example`). Optional: `VITE_STORAGE_ACCOUNT` and `VITE_TABLE_SAS` enable Azure Table Storage for persisted assessments (otherwise falls back to `localStorage`).

All env vars use the `VITE_` prefix so Vite exposes them via `import.meta.env`.

## Architecture

This is a **read-only SPA** — a Power Platform admin governance dashboard. It fetches live data from Microsoft APIs and renders it in the browser; there is no backend.

### Provider Stack (main.tsx)

`ThemeProvider` → `FluentProvider` → `MsalProvider` → `QueryClientProvider` → `DebugProvider` → `SignInCacheProvider` → `App`

- **ThemeContext** drives light/dark mode; `FluentProvider` switches `webLightTheme`/`webDarkTheme`. The choice is persisted in `localStorage`. **Always style with `tokens.*` so both themes work** — avoid hardcoded hex except intentionally-dark "cinematic" surfaces (sign-in screen, home hero) and brand/logo colors.
- **MSAL** handles Azure AD auth with popup-based consent flows. Token acquisition uses `acquireTokenSilent` with `acquireTokenPopup` fallback for `InteractionRequiredAuthError`. Some scopes (Power Apps sharing, audit logs) are requested incrementally.
- **TanStack Query** manages most API data fetching/caching (5 min `staleTime`, 1 retry).
- **DebugContext** captures raw request/response logs for an in-app debug panel.
- **SignInCacheContext** owns the cached Entra sign-in dataset for the usage heatmap: it loads from Azure Table Storage on mount and auto-refreshes in the background (client-side, ~hourly) — there is no server cron.

### API Layer (`src/api/`)

Each file targets a different Microsoft API surface with its own OAuth scope:

| File | API | Scope |
|---|---|---|
| `powerPlatformApi.ts` | Power Platform Resource Query (KQLOM) | `api.powerplatform.com/.default` |
| `governanceApi.ts` | BAP admin + PP governance endpoints | `api.bap.microsoft.com/.default` + `api.powerplatform.com/.default` |
| `graphApi.ts` | Microsoft Graph (user/SP names; license SKUs) | `graph.microsoft.com/User.ReadBasic.All` + `Organization.Read.All` |
| `signInsApi.ts` / `signInsCache.ts` | Microsoft Graph sign-in logs (usage heatmap) + Azure Table cache | `graph.microsoft.com/AuditLog.Read.All` (read); account SAS (cache) |
| `sharingApi.ts` | Power Apps sharing/permissions | `service.powerapps.com/.default` |
| `tableStorageApi.ts` | Azure Table Storage (assessments/tags) | Account-level SAS token (no OAuth) |

Scopes are defined in `src/auth/msalConfig.ts`. Storage APIs are optional — gated on `VITE_STORAGE_ACCOUNT`/`VITE_TABLE_SAS`; without them, assessments/tags use `localStorage` and the heatmap fetches live.

Token acquisition uses a **singleton promise pattern** (`_inFlight`) to prevent concurrent popup races when multiple components request the same scope simultaneously.

### Data Flow

1. **Resources** — `useResources` hook uses `useInfiniteQuery` to auto-paginate through the Power Platform Resource Query API (500 items/page via `skipToken`). Resources are categorized into apps/flows/agents via `RESOURCE_TYPES` maps in `src/types/index.ts`.
2. **Owner resolution** — Owner IDs (GUIDs) are resolved to display names via MS Graph `$batch` calls (20 IDs/chunk), trying `/users/` first then `/servicePrincipals/` for 404s.
3. **Governance** — DLP policies, tenant settings, environment capacity, and billing policies are fetched independently via `useQuery` hooks in `src/hooks/useGovernance.ts`.

### Navigation

The app uses a **rail-based SPA** (no router library). `Shell.tsx` is the live root (`App` → `AppShell` → `Shell`) and manages all navigation in local state — a `RailSection` (`'home' | 'inventory' | 'governance' | 'usage' | 'tags' | 'licensing'`) plus a per-section sub-view union (e.g. `InvView`, `GovView`, `UsageSubView`, `LicensingView`, `TagView`). Each rail section renders a secondary `NavPanel` of sub-pages and a page component.

> `src/pages/Dashboard.tsx` and the monolithic `GovernanceView` component are **dead code**. `Shell.tsx` composes the **exported sub-components** from `GovernanceView.tsx` (e.g. `TenantSettingsSection`, `DLPSection`, `ConnectionsSection`). To add/modify a section, wire it into `Shell.tsx`, not just `GovernanceView.tsx`.

Key views: Home (`ReportView`), Usage (`UsageView` overview, `UsageDetail` per-product, `UsageHeatmap`, shared helpers in `usageShared.tsx`), Licensing (in `Shell.tsx`), Tagging (`ResourceTaggingView`), Risk (`RiskAssessmentView`), Maker (`MakerAnalyticsView`). The cinematic sign-in/home visuals live in `CommandCenter.tsx` (+ keyframes in `index.css`).

## Key Conventions

- **Fluent UI v9** for all UI components. Use `makeStyles` (Griffel) for styling with `tokens` for spacing/colors — no raw CSS values or CSS modules.
- **Fluent UI Icons** — import from `@fluentui/react-icons` with the `Regular` suffix (e.g., `ShieldRegular`, `WarningRegular`).
- **Custom hooks** wrap every TanStack Query call (`useResources`, `useDLPPolicies`, `useEnvironmentCapacity`, etc.) — never call `useQuery`/`useInfiniteQuery` directly from components.
- **Type definitions** — The `ResourceItem` interface in `src/types/index.ts` is the central data model. Helper functions (`getDisplayName`, `getResourceCategory`, `getOwnerFromProperties`, etc.) handle the many property-name variants across Power Platform API response shapes.
- **No routing library** — tab state is managed in component state. Don't add react-router.
- Resource type matching is case-insensitive and handles both current canonical names and legacy API type strings (see `RESOURCE_TYPES` and `DEFAULT_CLAUSES`).

## Deployment

The app deploys to **Azure Static Web Apps** via GitHub Actions (`deploy.yml`). Deployment scripts are in `scripts/`. The `public/staticwebapp.config.json` handles SWA routing config.
