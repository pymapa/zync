# Zync Server

Backend service for Zync - Strava activity synchronization platform.

## Features

- **Secure OAuth Flow**: PKCE-enhanced OAuth 2.0 with Strava
- **Session Management**: In-memory session store with automatic cleanup
- **LRU Cache**: Bounded cache with TTL to prevent memory leaks
- **Rate Limiting**: Per-user and per-endpoint rate limits
- **Type Safety**: Full TypeScript with strict mode
- **Security Headers**: Helmet.js with CSP, HSTS, and more
- **Error Handling**: Centralized error handling with proper logging

## Prerequisites

- Node.js 20+
- Strava API credentials (client ID and secret)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
COOKIE_SECRET=generate_a_secure_random_string_here
FRONTEND_URL=http://localhost:5173
```

## Running

Development mode with auto-reload:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

Type checking:
```bash
npm run typecheck
```

## API Endpoints

### Authentication
- `POST /api/auth/strava/url` - Generate OAuth URL
- `GET /api/auth/strava/callback` - OAuth callback
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Activities
- `GET /api/activities` - List activities (paginated)
- `GET /api/activities/:id` - Get activity details

### Athlete
- `GET /api/athlete` - Get athlete profile
- `GET /api/athlete/stats` - Get athlete statistics

### Health
- `GET /api/health` - Health check

## Security Features

### PKCE OAuth Flow
Uses Proof Key for Code Exchange to prevent authorization code interception attacks.

### httpOnly Cookies
Session IDs stored in signed, httpOnly cookies to prevent XSS attacks.

### Rate Limiting
- 80 requests per 15 minutes per authenticated user
- 5 requests per minute for authentication endpoints

### Input Validation
All inputs validated with Zod schemas before processing.

### Token Security
Access and refresh tokens never sent to client - kept server-side only.

## Architecture

```
server/
├── src/
│   ├── config/          # Configuration with validation
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── routes/          # Route definitions
│   ├── services/        # Business logic
│   │   ├── cache/      # LRU cache
│   │   ├── session/    # Session store
│   │   └── strava/     # Strava API client
│   └── utils/          # Utilities
```

## Development Notes

- Uses in-memory stores (Phase 1-3)
- Redis integration planned for Phase 4
- Monitoring/observability planned for Phase 4
- All sensitive data sanitized from logs
- Strict TypeScript configuration enforced
