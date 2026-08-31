# Dockerfile for Ancore Relayer Service
FROM node:20-slim as builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/relayer/package.json ./services/relayer/

# Install pnpm
RUN npm install -g pnpm@9

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY services/relayer ./services/relayer
COPY packages ./packages
COPY tsconfig.base.json ./

# Build the service
WORKDIR /app/services/relayer
RUN pnpm build

# Runtime stage
FROM node:20-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/relayer/package.json ./services/relayer/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/services/relayer/dist ./services/relayer/dist

WORKDIR /app/services/relayer

# Expose port
EXPOSE 3000

# Run the relayer.
#
# `dist/server.js`, not `dist/index.js` (#1345): there is no `src/index.ts` in
# this service. `src/server.ts` is the entrypoint — it guards `app.listen` with
# `require.main === module` — and `tsc` mirrors the source tree, so it compiles
# to `dist/server.js`. The old path made the container exit immediately with
# "Cannot find module '/app/services/relayer/dist/index.js'", which took
# `docker compose -f docker-compose.dev.yml up` down with it.
#
# Node receives SIGTERM directly as PID 1 here, which is what the graceful
# shutdown handler in server.ts needs (#1346). Do not wrap this in a shell.
CMD ["node", "dist/server.js"]
