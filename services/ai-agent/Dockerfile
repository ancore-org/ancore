# ── Stage 1: build ────────────────────────────────────────────────────────────
# Full Node image with dev tools; compiles TypeScript to dist/.
FROM node:20-alpine AS build

WORKDIR /app

# Copy manifests first so Docker layer-caches the install step
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for tsc)
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: prune dev dependencies ───────────────────────────────────────────
# Re-install only production dependencies to keep the final image lean.
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --omit=dev --frozen-lockfile 2>/dev/null || npm install --omit=dev

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
# Minimal Node 20 Alpine image; runs as a non-root user.
FROM node:20-alpine AS runtime

# Install curl for the HEALTHCHECK probe (Alpine ships without it)
RUN apk add --no-cache curl

WORKDIR /app

# Create a non-root user and group
RUN addgroup -S ancore && adduser -S ancore -G ancore

# Copy compiled output and production node_modules from earlier stages
COPY --from=build  /app/dist ./dist
COPY --from=deps   /app/node_modules ./node_modules
COPY package.json ./

# Switch to non-root user before the process starts
USER ancore

# ── Environment ───────────────────────────────────────────────────────────────
# PORT is the only required env var; all others are optional.
# Override at runtime with -e or via your orchestrator's env config.
ENV PORT=3001 \
    NODE_ENV=production \
    SERVICE_VERSION=0.1.0

EXPOSE 3001

# ── Health check ──────────────────────────────────────────────────────────────
# Docker / Kubernetes will mark the container unhealthy if /health returns
# a non-2xx status or does not respond within the timeout.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# ── Entrypoint ────────────────────────────────────────────────────────────────
CMD ["node", "dist/index.js"]
