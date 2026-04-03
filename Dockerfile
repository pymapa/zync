# Stage 1: Install dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files for layer caching
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

RUN cd client && npm ci
RUN cd server && npm ci

# Stage 2: Build client + server
FROM node:20-alpine AS build

WORKDIR /app

# Copy deps from stage 1
COPY --from=deps /app/client/node_modules ./client/node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules

# Copy source
COPY client/ ./client/
COPY server/ ./server/

# Build client (Vite → client/dist/)
RUN cd client && npm run build

# Build server (tsc → server/dist/)
RUN cd server && npm run build

# Stage 3: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy built artifacts
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/src/services/database/pg-migrations ./server/dist/services/database/pg-migrations
COPY --from=build /app/client/dist ./client/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/dist/index.js"]
