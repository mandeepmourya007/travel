# syntax=docker/dockerfile:1
FROM node:20-alpine3.20

RUN apk add --no-cache dumb-init

WORKDIR /app

# ── Dependency layer (cached unless package.json changes)
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN mkdir -p apps/api && echo '{"name":"@travel/api","private":true}' > apps/api/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=@travel/web --workspace=@travel/shared --include-workspace-root \
 && rm -rf /tmp/*

# ── Source layer ──────────────────────────────────────
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

WORKDIR /app/apps/web

ENV NODE_OPTIONS="--max-old-space-size=1536" \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
EXPOSE ${PORT}

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "/app/node_modules/.bin/next dev --turbopack -p ${PORT}"]
