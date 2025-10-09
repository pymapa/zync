# PRP: Mock API for Development

**Date:** 2025-10-09  

---

## Problem

### Problem Statement
We need to develop and test the frontend without a real backend. Currently, OAuth buttons just log to console and there's no way to simulate authentication flows or fetch fitness data during development.

### Scope
**Will do:**
- [ ] Create mock API service for authentication
- [ ] Mock Strava OAuth flow
- [ ] Simulate API delays and responses

**Won't do:**
- [ ] Real OAuth implementation (that's for later)
- [ ] Persistent database (just in-memory for now)
- [ ] Real Strava API integration

### Success
- [ ] Can "login" with Strava without real OAuth
- [ ] Get mock fitness data to display in dashboard
- [ ] Frontend works completely offline in dev mode
- [ ] Easy to switch between mock and real API later

---

## Requirements

### What it needs to do
- **REQ-001:** Mock Authentication
  - **Priority:** High
  - **Acceptance:** 
    - [ ] Mock Strava OAuth callback
    - [ ] Return fake auth token
    - [ ] Store session in localStorage or memory

- **REQ-002:** Mock Fitness Data
  - **Priority:** High
  - **Acceptance:** 
    - [ ] Mock activities endpoint (runs, rides, etc.)
    - [ ] Mock stats endpoint (weekly totals, charts)
    - [ ] Realistic sample data

- **REQ-003:** API Service Architecture
  - **Priority:** Medium
  - **Acceptance:** 
    - [ ] Clean service interface
    - [ ] Easy to swap mock/real implementation
    - [ ] TypeScript types for all responses

### How it should work
- Mock API responds instantly (or with configurable delay)
- Returns realistic fitness data
- Matches Strava API structure when possible
- Works entirely client-side

---

## Plan

### Approach
Build a mock API service that mimics real backend behavior, allowing full frontend development without dependencies.

### Steps

#### 1. Mock API Service Setup
**Tasks:**
- [ ] Create `/src/services/api/` folder structure
- [ ] Define TypeScript interfaces for API responses
- [ ] Create mock data generator utilities

#### 2. Authentication Mock
**Tasks:**
- [ ] Implement mock OAuth callback handler
- [ ] Generate fake JWT/session tokens
- [ ] Create auth context/provider for React
- [ ] Update Login page to use mock auth

#### 3. Fitness Data Mock
**Tasks:**
- [ ] Create mock activities data (10-20 sample activities)
- [ ] Create mock stats/metrics data
- [ ] Build API service methods (getActivities, getStats, etc.)
- [ ] Add TypeScript types for all data models

#### 4. Integration
**Tasks:**
- [ ] Set up environment-based API switching (mock vs real)
- [ ] Add loading states and error handling
- [ ] Test full flow: login → dashboard → data display

---

## References

### Related Documents
- **PRP_global:** Global project requirements and constraints
- **PRP 002:** Login page implementation
- **Future:** Real Strava API integration PRP

### Technical Notes
- Use fetch API or axios for consistency
- Consider using MSW (Mock Service Worker) or simple in-memory mock
- Store mock data in `/src/services/api/mockData.ts`
- Authentication state should persist across page refreshes during dev

### Implementation Notes
- Mock data should include:
  - Activities: runs, rides, swims with distance, pace, heart rate
  - Weekly/monthly aggregated stats
  - User profile info
- Consider adding dev tools to reset mock state
- Add configurable API delay for testing loading states
