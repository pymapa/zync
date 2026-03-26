# Session: Azure Deployment

**Date**: 26-03-26
**Branch**: `session/azure-deployment`
**Status**: In Progress

## Scope
Set up Azure cloud deployment for Zync. Includes making architecture decision, Terraform IaC, deployment pipeline, and documentation.

**Out of scope**: multi-region, custom domain/SSL, monitoring, production scaling.

## Todo
- [ ] Research and decide Azure architecture (App Service vs Container Apps vs VM, SQLite persistence strategy, frontend serving strategy)
- [ ] Terraform: core infrastructure based on architecture decision
- [ ] Terraform: app configuration (env vars, secrets, storage mounts)
- [ ] Build/package pipeline for the chosen architecture
- [ ] Backend: serve static frontend if needed (depends on architecture)
- [ ] GitHub Actions: extend deploy.yml with actual deployment
- [ ] Test full deployment end-to-end
- [ ] Documentation

## Notes


## Files Changed

