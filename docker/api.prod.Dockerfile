# syntax=docker/dockerfile:1
# ── Production API Dockerfile (Multi-Stage) ───────────
# Stage 1: Install dependencies (cached layer)
# Stage 2: Copy source, generate Prisma client, prune devDeps
# Stage 3: Minimal runner (~150MB vs ~400MB single-stage)
# Uses tsx runtime (avoids rootDir tsc path issue in monorepo)

# ── Stage 1: Dependencies ────────────────────────────
FROM node:20-alpine3.20 AS deps

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN mkdir -p apps/web && echo '{"name":"@travel/web","private":true}' > apps/web/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=@travel/api --workspace=@travel/shared --include-workspace-root \
 && rm -rf /tmp/*

# ── Stage 2: Build ───────────────────────────────────
FROM deps AS builder

COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

RUN npx --workspace=@travel/api prisma generate

# Prune dev dependencies (vitest, @types, typescript, prisma CLI ~160MB)
# tsx must be in dependencies (not devDependencies) for this to work
RUN npm prune --omit=dev && rm -rf /tmp/*

# ── Stage 3: Production runner ───────────────────────
FROM node:20-alpine3.20 AS runner

# dumb-init: proper PID 1 signal handling
# openssl: required by Prisma Client for database connections
RUN apk add --no-cache dumb-init openssl

WORKDIR /app

# Copy only production artifacts from builder
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/tsconfig.base.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/shared ./packages/shared
COPY --from=builder --chown=node:node /app/apps/api ./apps/api

WORKDIR /app/apps/api

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"
EXPOSE 4000

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--import=tsx", "src/index.ts"]
