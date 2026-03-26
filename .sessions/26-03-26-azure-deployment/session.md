# Session: Azure Deployment

**Date**: 26-03-26
**Branch**: `session/azure-deployment`
**Status**: In Progress

## Scope
Set up Azure cloud deployment for Zync. Includes making architecture decision, Terraform IaC, deployment pipeline, and documentation.

**Out of scope**: multi-region, custom domain/SSL, monitoring, production scaling.

## Todo
<<<<<<< HEAD
- [x] Research and decide Azure architecture
- [x] Migrate sessions from in-memory to PostgreSQL
- [x] Migrate database from SQLite to PostgreSQL
- [x] Dockerfile (multi-stage: build client+server → production image)
- [x] Backend: serve static frontend from Express
- [x] Terraform: core infrastructure (RG, Container Apps, PostgreSQL, ACR, Key Vault)
- [x] GitHub Actions: build image → push to GHCR → migration job → deploy Container Apps revision
=======
- [ ] Research and decide Azure architecture (App Service vs Container Apps vs VM, SQLite persistence strategy, frontend serving strategy)
- [ ] Terraform: core infrastructure based on architecture decision
- [ ] Terraform: app configuration (env vars, secrets, storage mounts)
- [ ] Build/package pipeline for the chosen architecture
- [ ] Backend: serve static frontend if needed (depends on architecture)
- [ ] GitHub Actions: extend deploy.yml with actual deployment
>>>>>>> 48472a7 (Add session file for Azure deployment work)
- [ ] Test full deployment end-to-end
- [ ] Documentation

## Notes
<<<<<<< HEAD
- Architecture decided: Container Apps + self-managed PostgreSQL on B1s VM (~$11-12/mo)
- VM chosen over Flexible Server to minimize cost ($4 vs $13) and for Azure practice
- Sessions moved from in-memory Map to PostgreSQL — enables scale-to-zero
- Database migrated from SQLite to PostgreSQL — all 22 IDatabase methods now async
- Functions ruled out: Express adapter too complex for marginal savings
- No VNET, custom domain, CDN, or monitoring — not needed yet
- Local dev uses Docker for PostgreSQL (`docker compose up -d`)

## Files Changed
- `docs/AZURE_ARCHITECTURE.md` — architecture plan with mermaid diagrams
- `server/src/services/session/interface.ts` — new `ISessionStore` async interface
- `server/src/services/session/pg-store.ts` — PostgreSQL session store implementation
- `server/src/services/session/store.ts` — updated in-memory store to implement `ISessionStore`
- `server/src/services/strava/token-manager.ts` — use `ISessionStore` interface, no private field access
- `server/src/middleware/auth.ts` — async session operations
- `server/src/controllers/auth.controller.ts` — async session operations
- `server/src/app.ts` — async `createApp()`, choose store based on `DATABASE_URL`
- `server/src/index.ts` — async startup, pg pool shutdown
- `server/src/config/index.ts` — added `DATABASE_URL` config
- `server/src/routes/*.ts` — use `ISessionStore` type
- `server/src/middleware/rateLimiter.ts` — import from interface
- `server/src/__tests__/sync.e2e.test.ts` — async session operations in tests
- `server/src/services/__tests__/session-store.test.ts` — new unit tests (15 tests)
=======


## Files Changed
>>>>>>> 48472a7 (Add session file for Azure deployment work)

