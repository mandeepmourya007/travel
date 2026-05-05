# syntax=docker/dockerfile:1
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
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN npx --workspace=@travel/api prisma generate

# ── Entrypoint: migrate + generate before start ──────
COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

WORKDIR /app/apps/api

ENV NODE_OPTIONS="--max-old-space-size=256"
EXPOSE 4000

ENTRYPOINT ["dumb-init", "--", "api-entrypoint.sh"]
CMD ["node", "--env-file=.env", "--import=tsx", "--watch", "src/index.ts"]
