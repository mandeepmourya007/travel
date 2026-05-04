# syntax=docker/dockerfile:1
# ── Production Web Dockerfile (Multi-Stage) ───────────
# Stage 1: Install dependencies
# Stage 2: Build Next.js with standalone output
# Stage 3: Minimal runner (~180MB)
# NEXT_PUBLIC_* vars are baked at build time via ARG

# ── Stage 1: Dependencies ────────────────────────────
FROM node:20-alpine3.20 AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN mkdir -p apps/api && echo '{"name":"@travel/api","private":true}' > apps/api/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=@travel/web --workspace=@travel/shared --include-workspace-root \
 && rm -rf /tmp/*

# ── Stage 2: Builder ─────────────────────────────────
FROM node:20-alpine3.20 AS builder

WORKDIR /app

# Copy dependency tree from deps stage
COPY --from=deps /app ./

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

# NEXT_PUBLIC_* vars must be available at build time (baked into JS bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=TripCompare
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=1024"

RUN npx --workspace=@travel/web next build

# ── Stage 3: Runner ──────────────────────────────────
FROM node:20-alpine3.20 AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes minimal node_modules + server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets (CSS, JS chunks)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy public assets if they exist (favicon, images, etc.)
# NOTE: If apps/web/public/ doesn't exist yet, remove or comment this line
# COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
