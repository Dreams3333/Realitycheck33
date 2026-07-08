# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this is

**Reality Check** is a mobile app that takes a user-submitted claim (e.g. "Social
media algorithms are designed to maximize outrage") and returns AI-generated
analysis of it from multiple viewpoints — left, right, historical, scientific,
and (for premium) contrarian — each with a short summary, a paragraph of
analysis, and cited sources. Tagline: *"No agenda. Just angles."*

The repo is a **monorepo with three independent apps**, each with its own
`package.json`, `tsconfig.json`, and deploy target:

| Path        | App                        | Stack                                   | Deploys to        |
|-------------|----------------------------|-----------------------------------------|-------------------|
| `/` (root)  | Mobile app (the product)   | Expo / React Native + expo-router       | EAS → App/Play    |
| `/backend`  | REST API                   | Express + TypeScript + PostgreSQL       | Render (live)     |
| `/admin`    | Admin dashboard            | Vite + React 18 + react-router          | Vercel            |

The three are separate npm projects. `cd` into the one you're working on and run
its scripts there — there is no root-level workspace tooling that spans them.

## Repository layout

```
/                          Expo mobile app (root package.json)
  app/                     expo-router screens (file-based routing)
    _layout.tsx            Root stack; bootstraps auth/session on launch
    index.tsx              Animated splash → routes to onboarding/login/tabs
    onboarding.tsx
    (auth)/                login, register
    (tabs)/                index (Feed), submit (Check), profile, explore(hidden)
    claim/[id].tsx         Claim detail + perspectives
    claim/discussion/[id]  Comments thread (modal)
  components/              Reusable UI (home/, claim/, discussion/, ui/)
  services/                api.ts (fetch wrapper), auth.ts (token storage)
  store/useStore.ts        Zustand global store
  constants/theme.ts       Colors, Spacing, Radius design tokens
  constants/types.ts       Shared frontend TS types
  hooks/                   Color-scheme / theme hooks

  backend/
    src/index.ts           Express entry (prod / serverless)
    src/dev.ts             In-memory dev server, NO database needed
    src/routes/            auth, claims, stripe, admin
    src/middleware/auth.ts requireAuth / requirePremium / requireAdmin
    src/services/          claude.ts (perspective generation), email.ts
    src/db/                index.ts (pool + query helpers), schema.sql, migrate.ts
    src/types/index.ts     Backend TS types (snake_case DB rows)

  admin/
    src/App.tsx            Sidebar shell; local page state (no router used)
    src/pages/             Dashboard, Users, Claims
    src/services/api.ts    adminApi client (x-admin-key auth)

  DEPLOYMENT.md            Full deploy runbook (READ before infra changes)
  render.yaml              Render service config (current live backend)
  .github/workflows/keepalive.yml   Pings Render /health every 10 min
```

## Running things locally

**Mobile app** (from repo root):
```bash
npm install
npx expo start        # then press i / a / w, or scan QR in Expo Go
npm run lint          # expo lint (ESLint flat config)
```

**Backend** — two modes:
```bash
cd backend
npm install
npm run dev:local     # in-memory server, no DB, no keys — fastest for UI work
# — or —
cp .env.example .env  # fill in DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, ...
npm run dev           # real Postgres-backed server (tsx watch src/index.ts)
npm run build         # tsc → dist/
```
`dev:local` (`src/dev.ts`) is a **fully self-contained** Express server with
in-memory storage but real bcrypt + JWT. Use it when you don't want to stand up
Postgres or provide API keys. `src/index.ts` is the real server used in prod.

**Admin dashboard**:
```bash
cd admin
npm install
# create .env.local with VITE_API_URL and VITE_ADMIN_KEY
npm run dev           # vite
npm run build         # tsc && vite build
```

There is **no test suite** in any of the three projects. Verify changes by
running the app / hitting the API. `npm run lint` (root) is the only automated
check.

## Architecture & data flow

1. Mobile app calls the backend via `services/api.ts`. Base URL resolution
   (see `getBaseUrl`): `EXPO_PUBLIC_API_URL` env var wins; else in dev it points
   at `localhost:3000` (`10.0.2.2` on Android emulator); else prod defaults to
   `https://realitycheck33-check-api.onrender.com/api`.
2. Auth is **JWT bearer tokens**. The token is stored via `expo-secure-store` on
   native and `localStorage` on web (`services/auth.ts` abstracts this). `api.ts`
   attaches `Authorization: Bearer <token>` automatically.
3. Submitting a claim (`POST /api/claims`) is **synchronous**: the request
   generates perspectives + heat score inline before responding. This is
   deliberate — the serverless deploy target has no background job runner. Two
   Claude calls run in parallel (`generatePerspectives` + `calculateHeatScore`).
4. `backend/src/services/claude.ts` uses the Anthropic SDK with model
   **`claude-haiku-4-5-20251001`**. If `ANTHROPIC_API_KEY` is unset, it falls
   back to `mockPerspectives()` / a random heat score so the app still works
   without keys. It asks Claude to return a JSON array and parses it defensively.
5. Admin dashboard talks to `/api/admin/*`, gated by an `x-admin-key` header
   (`requireAdmin`) rather than JWT.

### Tiers & limits
- Users are `free` or `premium` (`users.tier`). Free users get `daily_limit = 5`
  checks/day (`checks_used_today`, reset by the `reset_daily_checks()` SQL
  function via cron). Premium is unlimited (`daily_limit = 999`) and unlocks the
  `contrarian` perspective (`is_premium_only`).
- Premium is a Stripe subscription ($4.99/mo) with a 7-day trial. `startTrial` on
  register grants immediate premium with `trial_ends_at`; login downgrades an
  expired trial back to free.

### Database
Schema lives in `backend/src/db/schema.sql` (Postgres, `uuid-ossp`). Tables:
`users`, `claims`, `perspectives`, `comments`, `comment_likes`, `saved_claims`.
`db/index.ts` uses `@neondatabase/serverless` with a WebSocket constructor and
strips `channel_binding` from the connection string (pg doesn't support it).
Apply schema with `npm run db:migrate` (runs `psql $DATABASE_URL -f schema.sql`);
the file is idempotent (`CREATE TABLE IF NOT EXISTS`).

## Conventions

- **TypeScript strict mode everywhere.** All three tsconfigs set `strict: true`.
- **Path alias `@/*`** maps to the repo root in the mobile app
  (`import { api } from '@/services/api'`). Root `tsconfig.json` **excludes**
  `backend/` and `admin/` — they compile independently.
- **Backend imports use explicit `.js` extensions** (`'./routes/auth.js'`) even
  though the source is `.ts`. This is required by the module setup — keep it
  consistent when adding imports.
- **Naming:** the DB and backend row types use `snake_case`
  (`display_name`, `heat_score`). API responses to the client are mapped to
  `camelCase` (`displayName`, `heatScore`) in the route handlers, and the
  frontend types (`constants/types.ts`) are camelCase. Preserve this boundary —
  do the snake→camel mapping in the route, don't leak DB casing to the client.
- **Styling:** React Native `StyleSheet.create` with tokens from
  `constants/theme.ts` (`Colors`, `Spacing`, `Radius`). The app is **dark-mode
  only** (`userInterfaceStyle: "dark"`, background `#0D0A14`, accent `#00A8FF`).
  Don't hardcode hex values — use the theme tokens. The admin app uses inline
  styles with its own dark palette.
- **State:** global app/auth/session state is a single Zustand store
  (`store/useStore.ts`). Screen-local state uses `useState`. There is no
  react-query / redux.
- **Error handling:** backend routes rely on `express-async-errors` so `async`
  handlers can throw; a top-level error middleware returns 500. Client `api.ts`
  throws `Error(data.message)` on non-2xx. Screens generally fall back to mock
  data on fetch failure (see `MOCK_CLAIMS` in the Feed) so the UI degrades
  gracefully rather than erroring.
- **Screens are resilient to a missing backend:** several screens ship
  `MOCK_*` fixtures used when the API call fails. Keep these in sync with real
  response shapes when you change an endpoint.

## Deployment notes (read before touching infra)

`DEPLOYMENT.md` is the authoritative runbook. Key nuances:

- The **backend currently runs on Render** (`render.yaml`, live URL
  `realitycheck33-check-api.onrender.com`, kept warm by the `keepalive.yml`
  GitHub Action). The repo *also* contains `backend/railway.toml` and
  `backend/vercel.json` from earlier deploy targets, and `DEPLOYMENT.md`
  describes a Railway setup. **Render is the source of truth for what's live** —
  don't assume Railway/Vercel for the API. If you change the backend host, update
  `getBaseUrl()` in `services/api.ts`, `keepalive.yml`, and `render.yaml`.
- **Env vars** the backend reads: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  `ANTHROPIC_API_KEY`, `ADMIN_SECRET_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_PRICE_ID`, SMTP_* (email digest),
  `APP_URL`. See `backend/.env.example`. `/api/*` routes 503 if `DATABASE_URL`
  is unset; `/health` always answers (used by the keepalive ping).
- **Mobile app** ships via EAS build (`eas build --platform ios|android`). Set
  `EXPO_PUBLIC_API_URL` for the build to point at the right API.
- The Stripe route hardcodes an API base in `backend/src/routes/stripe.ts`
  (`API_BASE`) for success/cancel redirect URLs — check it if you change hosts.
- **Never commit secrets.** `.env`, `backend/.env`, and `*.local` are
  gitignored; keep them that way.

## Working in this repo

- Match the surrounding style of whichever of the three apps you're in — they
  have different React versions (RN 0.81 / React 19 in the app, React 18 in
  admin) and different conventions (StyleSheet vs inline styles).
- When adding an API endpoint, update **both** sides: the route + snake→camel
  mapping in `backend/src/routes/*`, and the caller in `services/api.ts` /
  `admin/src/services/api.ts` plus any affected type in `constants/types.ts`.
- If you add a DB column, edit `schema.sql` (keep it idempotent) and the row
  type in `backend/src/types/index.ts`, and remember `dev.ts`'s in-memory store
  is a separate implementation that may also need updating.
- Run `npm run lint` at the repo root before finishing mobile-app changes.
