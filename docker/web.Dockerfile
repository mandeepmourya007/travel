FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

# ── Dependency layer (cached unless package.json changes)
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN mkdir -p apps/api && echo '{"name":"@travel/api","private":true}' > apps/api/package.json

RUN npm install --workspace=@travel/web --workspace=@travel/shared --include-workspace-root \
 && npm cache clean --force \
 && rm -rf /tmp/*

# ── Source layer ──────────────────────────────────────
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

WORKDIR /app/apps/web

ENV NODE_OPTIONS="--max-old-space-size=512" \
    NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/node_modules/.bin/next", "dev"]
