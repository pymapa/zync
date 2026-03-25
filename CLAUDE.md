# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skills

- Always use the `frontend-design` skill when designing or building UI components, pages, or layouts.
- Always use the `tailwind-css` skill when writing or modifying Tailwind CSS classes and styling components.
- Always use the `sqlite` skill when working with SQLite databases, writing queries, or implementing data persistence.
- Always use the `strava-api` skill when working with Strava OAuth, API calls, webhooks, or activity data.
- Always use the `tdd` skill when implementing features or fixing bugs — write failing tests first.
- Always use the `debugging` skill when investigating bugs or test failures — find root cause before fixing.
- Always use the `verify-completion` skill before claiming work is done — run the command, read the output.
- Always use the `design-first` skill when starting features or making significant changes — think before coding.

---

## Project Overview

Zync is a personal fitness dashboard that syncs activities from Strava. It is a monorepo with two separate packages:

- **Frontend** (`/client`): React 19 + Vite + Tailwind CSS v4 + TanStack Query
- **Backend** (`/server`): Node.js + Express + TypeScript (CommonJS) + SQLite (better-sqlite3)

Each has its own `package.json` and `node_modules`. Run commands from their respective directories.

## Commands

### Frontend (run from `client/`)
```bash
npm run dev          # Vite dev server on port 5173
npm run build        # tsc + vite build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm test             # vitest run (jsdom environment)
npm run test:watch   # vitest watch
npm run generate:types  # OpenAPI → client/src/types/api.generated.ts
```

### Backend (run from `server/`)
```bash
npm run dev          # ts-node-dev with hot reload (port 3001)
npm run build        # tsc → dist/
npm start            # node dist/index.js
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest watch
npm run test:coverage
npm run db:migrate   # Run pending SQL migrations manually
npm run db:shell     # SQLite interactive shell
npm run seed         # Seed development data
npm run generate:types  # OpenAPI → server/src/types/api.generated.ts
```

### Running a single test
```bash
# Frontend (from client/)
npm test -- --reporter=verbose path/to/test.ts

# Backend (from server/)
npm test -- path/to/test.ts
```

## Architecture

### API Contract
The API is defined in `server/src/openapi.yaml`. TypeScript types are generated from it and must be kept in sync on both sides:
- Frontend: `client/src/types/api.generated.ts`
- Backend: `server/src/types/api.generated.ts`

Run `npm run generate:types` in both `client/` and `server/` after changing `openapi.yaml`.

### Backend request flow
```
Express route (routes/) → Controller (controllers/) → Service (services/) → IDatabase (services/database/)
```

- **`IDatabase` interface** (`services/database/interface.ts`) abstracts the database. The SQLite implementation is in `services/database/sqlite.ts`. Always extend the interface when adding DB methods.
- **Config** is loaded and validated with Zod at startup (`src/config/index.ts`). All env vars are accessed through `config`, never `process.env` directly.
- **Errors** use the typed `AppError` / `ErrorCode` system (`utils/errors.ts`). The global error handler in `middleware/errorHandler.ts` serializes them to HTTP responses.
- **Session auth**: Sessions are stored in an in-memory `SessionStore` with signed cookies (`services/session/store.ts`). There is no JWT. The `requireAuth` middleware reads from the session. Session contains the Strava athlete ID and OAuth tokens.
- **OAuth**: Uses PKCE flow with Strava (`services/strava/oauth.ts`). Token refresh is automatic on expiry via `token-manager.ts`.
- **In-memory LRU cache** (`services/cache/cache.ts`) is used for activity list/stats responses. Cache is invalidated on sync.

### Database
- SQLite file at `data/zync.db` (created automatically).
- Migrations are numbered SQL files in `server/src/services/database/migrations/`. The runner (`migrations/runner.ts`) applies them in order on startup — never edit existing migration files, always add new ones.
- All timestamps are **Unix seconds** (not milliseconds).
- **FTS5** virtual table `activities_fts` indexes activity `name` for full-text search. It is maintained by SQLite triggers defined in `001_initial.sql`.
- **Geohash** (`services/database/geohash.ts`) encodes start coordinates for prefix-based location queries.

### Strava sync
`services/sync/index.ts` handles full and incremental syncs. It paginates Strava's API (200 activities/page), upserts to SQLite, and tracks progress in `sync_status`. Rate limit compliance is built in (1s delay between pages). The `mapStravaActivityToInput()` function is the canonical transform from Strava API shape to DB shape.

### Frontend data flow
```
Page/Component → hook (hooks/) → lib/api/*.api.ts (axios) → backend
```

- **TanStack Query** manages all server state. Hooks in `hooks/` encapsulate query keys, fetching, and caching. Mutations (e.g. trigger sync) invalidate related queries.
- **`lib/api/client.ts`**: Configured axios instance with base URL and credentials. All API modules import from this.
- **Route guards**: `AuthGuard` / `GuestGuard` in `client/src/router/guards/` protect pages based on `useAuth()` state.
- **URL state**: Activity list filters are stored in URL search params, making them bookmarkable.

### Testing
- Backend e2e tests use **supertest** with mocked config, auth middleware, and Strava client. Mock factories (e.g. `createMockStravaActivity`) are in `services/__tests__/mocks.ts`.
- Frontend tests use **jsdom** environment via vitest.

### CI/CD
- **CI** (`.github/workflows/ci.yml`): Runs typecheck, lint, test, and build for both packages on PRs to main.
- **Deploy** (`.github/workflows/deploy.yml`): On push to main, runs CI checks. Deployment target not yet configured.
