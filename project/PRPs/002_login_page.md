# PRP: Login Page

**Date:** 2025-10-09  

---

## Problem

### Problem Statement
Users who click "Get Started" on the landing page have nowhere to go because there's no login/signup page.

### Scope
**Will do:**
- [x] Login page with 3rd party login (OAuth 2.0)
- [x] Sign up option for new users
- [x] Responsive design

**Won't do:**
- [x] Actual backend authentication (just frontend for now)

### Success
- [x] Users can access login page from hero button
- [x] Form looks professional and works on all devices
- [x] Can see login option for Strava
- [x] Clear path between login and signup

---

## Requirements

### What it needs to do
- **REQ-001:** Login form
  - **Priority:** High
  - **Acceptance:** 
    - [x] Route for login page
    - [x] OAuth login options
    - [x] OAuth signup options

- **REQ-002:** Sign up option
  - **Priority:** High
  - **Acceptance:** 
    - [x] Toggle between login and signup modes
    - [x] Signup includes OAuth (Strava only)

- **REQ-003:** Navigation
  - **Priority:** Medium
  - **Acceptance:** 
    - [x] Link back to landing page
    - [x] Hero "Get Started" button goes to login page

### How it should work
- Works on all screen sizes
- Accessible (labels, keyboard navigation)

---

## Plan

### Approach
Build a clean login/signup page with routing from the hero component.

### Steps

#### 1. Routing Setup
**Tasks:**
- [x] Install React Router
- [x] Set up basic routing (/ and /login)
- [x] Update Hero button to navigate to /login (Use React Router Link)

#### 2. Login Page Component
**Tasks:**
- [x] Create Login.tsx component
- [x] Build login form with OAuth (Strava only)
- [x] Style with Tailwind to match hero design

#### 3. Signup Functionality
**Tasks:**
- [x] Add toggle between login/signup modes
- [x] Polish design and add back button

---

## References

### Related Documents
- **PRP_global:** Global project requirements and constraints
- **PRP 001:** Landing page hero (for design consistency)
- **Runbooks:** Deployment and operational procedures

### Implementation Notes
- Follow PRP_global guidelines for component architecture
- Maintain design consistency with hero component
- Use same color scheme (purple/pink gradients, dark background)