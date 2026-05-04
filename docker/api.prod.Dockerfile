# syntax=docker/dockerfile:1
# ── Production API Dockerfile ─────────────────────────
# Uses tsx runtime (avoids rootDir tsc path issue in monorepo)
# Non-root user, dumb-init for PID 1 signal handling

FROM node:20-alpine3.20

# dumb-init: proper PID 1 signal handling
# openssl: required by Prisma Client for database connections
RUN apk add --no-cache dumb-init openssl

WORKDIR /app

# ── Dependency layer (cached unless package.json changes)
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN mkdir -p apps/web && echo '{"name":"@travel/web","private":true}' > apps/web/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=@travel/api --workspace=@travel/shared --include-workspace-root \
 && rm -rf /tmp/*

# ── Source layer ──────────────────────────────────────
COPY --chown=node:node packages/shared/ packages/shared/
COPY --chown=node:node apps/api/ apps/api/
RUN npx --workspace=@travel/api prisma generate

# Prune dev dependencies (vitest, @types, typescript, prisma CLI ~160MB)
# tsx must be in dependencies (not devDependencies) for this to work
RUN npm prune --omit=dev 2>/dev/null || true

WORKDIR /app/apps/api

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"
EXPOSE 4000

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--import=tsx", "src/index.ts"]
