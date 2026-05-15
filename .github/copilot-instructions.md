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

`FluentProvider` → `MsalProvider` → `QueryClientProvider` → `DebugProvider` → `App`

- **MSAL** handles Azure AD auth with popup-based consent flows. Token acquisition uses `acquireTokenSilent` with `acquireTokenPopup` fallback for `InteractionRequiredAuthError`.
- **TanStack Query** manages all API data fetching/caching (5 min `staleTime`, 1 retry).
- **DebugContext** captures raw request/response logs for an in-app debug panel.

### API Layer (`src/api/`)

Each file targets a different Microsoft API surface with its own OAuth scope:

| File | API | Scope |
|---|---|---|
| `powerPlatformApi.ts` | Power Platform Resource Query (KQLOM) | `api.powerplatform.com/.default` |
| `governanceApi.ts` | BAP admin + PP governance endpoints | `api.bap.microsoft.com/.default` + `api.powerplatform.com/.default` |
| `graphApi.ts` | Microsoft Graph (user/SP name resolution) | `graph.microsoft.com/User.ReadBasic.All` |
| `sharingApi.ts` | Power Apps sharing/permissions | `service.powerapps.com/.default` |
| `tableStorageApi.ts` | Azure Table Storage (assessments/tags) | Account-level SAS token (no OAuth) |

Token acquisition uses a **singleton promise pattern** (`_inFlight`) to prevent concurrent popup races when multiple components request the same scope simultaneously.

### Data Flow

1. **Resources** — `useResources` hook uses `useInfiniteQuery` to auto-paginate through the Power Platform Resource Query API (500 items/page via `skipToken`). Resources are categorized into apps/flows/agents via `RESOURCE_TYPES` maps in `src/types/index.ts`.
2. **Owner resolution** — Owner IDs (GUIDs) are resolved to display names via MS Graph `$batch` calls (20 IDs/chunk), trying `/users/` first then `/servicePrincipals/` for 404s.
3. **Governance** — DLP policies, tenant settings, environment capacity, and billing policies are fetched independently via `useQuery` hooks in `src/hooks/useGovernance.ts`.

### Navigation

The app uses a **tab-based SPA** (no router library). `Shell.tsx` manages navigation state via a `ResourceTab` union type: `'all' | 'apps' | 'flows' | 'agents' | 'groups' | 'users' | 'environments' | 'governance' | 'report'`.

## Key Conventions

- **Fluent UI v9** for all UI components. Use `makeStyles` (Griffel) for styling with `tokens` for spacing/colors — no raw CSS values or CSS modules.
- **Fluent UI Icons** — import from `@fluentui/react-icons` with the `Regular` suffix (e.g., `ShieldRegular`, `WarningRegular`).
- **Custom hooks** wrap every TanStack Query call (`useResources`, `useDLPPolicies`, `useEnvironmentCapacity`, etc.) — never call `useQuery`/`useInfiniteQuery` directly from components.
- **Type definitions** — The `ResourceItem` interface in `src/types/index.ts` is the central data model. Helper functions (`getDisplayName`, `getResourceCategory`, `getOwnerFromProperties`, etc.) handle the many property-name variants across Power Platform API response shapes.
- **No routing library** — tab state is managed in component state. Don't add react-router.
- Resource type matching is case-insensitive and handles both current canonical names and legacy API type strings (see `RESOURCE_TYPES` and `DEFAULT_CLAUSES`).

## Deployment

The app deploys to **Azure Static Web Apps** via GitHub Actions (`deploy.yml`). Deployment scripts are in `scripts/`. The `public/staticwebapp.config.json` handles SWA routing config.
