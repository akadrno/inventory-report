# Local Development

Run the application on your own machine for development or testing purposes.

---

## Requirements

- Node.js 18 LTS or higher
- A completed [App Registration](02-app-registration.md) with `http://localhost:5173` added as a redirect URI

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/<your-org>/inventory-report.git
cd inventory-report
```

---

## Step 2 — Install dependencies

```bash
npm install
```

---

## Step 3 — Create your local environment file

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

```env
VITE_CLIENT_ID=your-app-registration-client-id
VITE_TENANT_ID=your-tenant-id-or-domain
```

| Variable | Where to find it |
|---|---|
| `VITE_CLIENT_ID` | Azure portal → App Registration → Overview → **Application (client) ID** |
| `VITE_TENANT_ID` | Azure portal → App Registration → Overview → **Directory (tenant) ID**, or your `.onmicrosoft.com` domain |

> `.env.local` is excluded by `.gitignore`. Never commit it.

---

## Step 4 — Start the dev server

```bash
npm run dev
```

Vite starts a local server at `http://localhost:5173`. Open it in your browser.

---

## Step 5 — Sign in

1. The app redirects you to the Microsoft sign-in page.
2. Sign in with an account that has **Power Platform Administrator** or **Global Administrator** rights.
3. On first sign-in, you may be asked to consent to the permissions the app requests. If admin consent has already been granted for your tenant, this step is skipped.

---

## Development workflow

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot module replacement |
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run preview` | Serve the `dist/` folder locally to test the production build |
| `npm run lint` | Run ESLint |

---

## Environment variables

All variables must be prefixed with `VITE_` to be accessible in the browser bundle. Do not put secrets (client secrets, passwords) in frontend environment variables — they are visible in the compiled JavaScript.

| Variable | Required | Description |
|---|---|---|
| `VITE_CLIENT_ID` | Yes | Azure AD App Registration Client ID |
| `VITE_TENANT_ID` | Yes | Azure AD Tenant ID or primary domain |

---

## Adding a second redirect URI

If you want to run the app on a port other than 5173, add the new URI to your App Registration:

1. Azure portal → App Registration → **Authentication** → **Single-page application**.
2. Add `http://localhost:<port>`.
3. Save.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page or `MSAL` error in console | Check that `VITE_CLIENT_ID` and `VITE_TENANT_ID` are set correctly in `.env.local` |
| "Redirect URI mismatch" error | Add `http://localhost:5173` (or your port) as a SPA redirect URI in the App Registration |
| API calls return 403 | The signed-in account does not have Power Platform Administrator rights |
| API calls return 401 | Admin consent has not been granted — follow [Step 3 of the App Registration guide](02-app-registration.md#step-3--grant-admin-consent) |
| `node_modules` errors | Delete `node_modules` and `package-lock.json`, then run `npm install` again |

---

Next: [User Guide](06-user-guide.md)
