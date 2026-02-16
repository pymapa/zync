# Zync

Strava activity dashboard. Connects to Strava via OAuth 2.0 with PKCE, displays activities and athlete stats.

## Architecture

```
+------------------+         +------------------+         +------------------+
|                  |         |                  |         |                  |
|     Browser      |         |   Express API    |         |   Strava API     |
|   (React SPA)    |         |    (Node.js)     |         |                  |
|                  |         |                  |         |                  |
+--------+---------+         +--------+---------+         +--------+---------+
         |                            |                            |
         |  1. POST /auth/strava/url  |                            |
         +--------------------------->|                            |
         |     { url, state }         |                            |
         |<---------------------------+                            |
         |                            |                            |
         |  2. Redirect to Strava     |                            |
         +-------------------------------------------------------->|
         |                            |                            |
         |  3. Callback with code     |                            |
         |<--------------------------------------------------------+
         |                            |                            |
         |  4. GET /callback?code=... |                            |
         +--------------------------->|  5. Exchange code+PKCE     |
         |                            +--------------------------->|
         |                            |     { access_token, ... }  |
         |                            |<---------------------------+
         |                            |                            |
         |  6. Set httpOnly cookie    |                            |
         |     Redirect to /dashboard |                            |
         |<---------------------------+                            |
         |                            |                            |
         |  7. GET /api/activities    |                            |
         |     Cookie: session=xxx    |  8. Proxy with token       |
         +--------------------------->+--------------------------->|
         |                            |                            |
         |  9. Activities data        |                            |
         |<---------------------------+<---------------------------+
         |                            |                            |

Auth flow:
- Tokens stored server-side in session store
- Session ID sent to browser as httpOnly cookie
- Frontend never sees access/refresh tokens
```

## Tech Stack

### Frontend
- React 19
- TypeScript 5.9
- Vite (rolldown-vite)
- React Query (TanStack Query v5)
- React Router v7
- Axios
- Tailwind CSS v4

### Backend
- Node.js
- Express 4
- TypeScript 5.3
- Zod (validation)
- Helmet (security headers)
- cookie-parser

### Auth
- OAuth 2.0 with PKCE (S256)
- httpOnly cookies for session
- In-memory session store
- Rate limiting on auth endpoints

## Project Structure

```
zync/
├── src/                          # Frontend source
│   ├── components/               # React components
│   ├── contexts/                 # React contexts (AuthContext)
│   ├── hooks/                    # Custom hooks (useAuth, useActivities)
│   ├── lib/
│   │   ├── api/                  # API client and endpoint functions
│   │   └── utils/                # Utilities (formatting, dates, constants)
│   ├── pages/                    # Page components
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── Callback.tsx
│   │   └── Dashboard.tsx
│   ├── providers/                # Provider components
│   ├── router/
│   │   └── guards/               # Route guards (AuthGuard, GuestGuard)
│   ├── types/                    # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── server/                       # Backend source
│   └── src/
│       ├── config/               # Configuration
│       ├── controllers/          # Request handlers
│       ├── middleware/           # Express middleware
│       │   ├── auth.ts           # Session validation
│       │   ├── cors.ts
│       │   ├── errorHandler.ts
│       │   └── rateLimiter.ts
│       ├── routes/               # Route definitions
│       ├── services/
│       │   ├── cache/            # LRU cache
│       │   ├── session/          # Session store
│       │   └── strava/           # Strava API client
│       ├── utils/                # Utilities
│       ├── app.ts
│       └── index.ts
├── package.json
└── server/package.json
```

## Scripts

### Frontend (root directory)

```bash
npm run dev              # Start Vite dev server (port 5173)
npm run build            # TypeScript check + Vite build
npm run preview          # Preview production build
npm run typecheck        # TypeScript check only
npm run lint             # ESLint
npm run test             # Run tests (vitest)
npm run test:watch       # Run tests in watch mode
```

### Backend (server directory)

```bash
npm run dev              # Start dev server with hot reload (port 3001)
npm run build            # Compile TypeScript
npm run start            # Run compiled JS
npm run typecheck        # TypeScript check only
```

### From root (convenience)

```bash
npm run dev:server       # Start backend dev server
npm run build:server     # Build backend
npm run typecheck:server # Typecheck backend
```

## Environment Variables

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:3001/api
```

### Backend (server/.env)

```bash
PORT=3001
NODE_ENV=development
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
FRONTEND_URL=http://localhost:5173
COOKIE_SECRET=random_secure_string_here
```

Get Strava API credentials at: https://www.strava.com/settings/api

## Getting Started

```bash
# Clone and install
git clone <repo>
cd zync
npm install
cd server && npm install && cd ..

# Configure environment
cp .env.example .env
cp server/.env.example server/.env
# Edit server/.env with your Strava credentials

# Start both servers (two terminals)
npm run dev          # Frontend: http://localhost:5173
npm run dev:server   # Backend:  http://localhost:3001
```

## API Endpoints

### Auth
- `POST /api/auth/strava/url` - Generate OAuth URL with PKCE
- `GET /api/auth/strava/callback` - OAuth callback handler
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Data (requires auth)
- `GET /api/athlete` - Get athlete profile
- `GET /api/athlete/stats` - Get athlete stats
- `GET /api/activities` - Get activities (paginated)

### Health
- `GET /api/health` - Health check

## Current Limitations

- **In-memory sessions**: Sessions are stored in memory. Server restart = all users logged out. Single server only.
- **No Redis**: No distributed session store. Cannot scale horizontally.
- **No tests**: Test infrastructure exists (vitest) but no tests written yet.
- **No CI/CD**: No automated pipelines.
- **Strava rate limits**: 100 requests/15 min, 1000/day per application. No request coalescing implemented.
