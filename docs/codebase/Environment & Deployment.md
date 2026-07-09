---
title: Environment & Deployment
created: 2026-07-10
type: reference
tags:
  - codebase/infra
  - deployment
---

# Environment & Deployment

## Environment Variables

Canonical example: root ==`.env.example`== (also `.env.docker.example`, `.env.prod.example`; `apps/api/.env` is a symlink to root `.env`). The API validates all env at startup via Zod in `apps/api/src/config/env.ts` — invalid config ==throws at boot==.

| Group | Variables |
| :--- | :--- |
| Core | `NODE_ENV`, `PORT` (4001 dev / 4000 container), `LOG_LEVEL`, `NEXT_PUBLIC_LOG_LEVEL` |
| Domain/Network | `CLIENT_URL`, `ALLOWED_ORIGINS` (CSV), `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_SITE_URL`, ==`API_URL_INTERNAL`== (server-side only, Docker-internal SSR calls) |
| Database | `DATABASE_URL` (pooled), `DIRECT_URL` (Prisma CLI) |
| Auth | `JWT_SECRET` (min 32 chars), `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
| Firebase phone auth | `PHONE_AUTH_STRATEGY` (backend\|firebase), `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`, `NEXT_PUBLIC_FIREBASE_*` (API_KEY, AUTH_DOMAIN, PROJECT_ID, APP_ID), `NEXT_PUBLIC_PHONE_AUTH_STRATEGY` |
| Redis | `REDIS_URL` (required in prod) |
| Email | `SMTP_HOST/PORT/USER/PASS/FROM` (all-or-nothing), `RESEND_API_KEY`, `RESEND_FROM` |
| SMS OTP | `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` |
| Payments | `PAYMENT_GATEWAY` (razorpay\|cashfree), `RAZORPAY_KEY_ID` (must start `rzp_`) / `KEY_SECRET` / `WEBHOOK_SECRET`, `CASHFREE_APP_ID` / `SECRET_KEY` / `WEBHOOK_SECRET` / `CASHFREE_ENV`, `NEXT_PUBLIC_CASHFREE_ENV` |
| Media | `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` |
| Monitoring | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_*`, `SENTRY_AUTH_TOKEN` (source maps) |
| Legal (FE) | `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_GRIEVANCE_EMAIL`, `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` |
| SEO | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION` |

> [!warning] Production superRefine Rules
> In prod: Razorpay webhook secret required when key set; Cashfree creds + webhook secret required when it's the active gateway; `REDIS_URL` required; SMTP and Firebase are each all-or-nothing.

> [!note] env.ts Bypasses
> A few values read `process.env` directly: `WALLET_AUTO_CASHBACK_PERCENT/CAP`, `WALLET_CREDIT_EXPIRY_DAYS` (`utils/constants.ts`), `RENDER_EXTERNAL_URL` (cron keepalive).

## Docker — Dev (docker-compose.yml, Compose ≥ 2.24)

| Service | Image | Ports | Notes |
| :--- | :--- | :--- | :--- |
| postgres | postgres:15-alpine3.20 | 127.0.0.1:5432 | `fsync=off` (==dev only==), 192M |
| redis | redis:7-alpine3.20 | 127.0.0.1:6379 | pass `dev-redis-pass`, tmpfs, 32MB |
| api | `docker/api.Dockerfile` | 4001→4000 | binds src/prisma/tests/shared; entrypoint runs `migrate deploy` + `generate` then `node --watch` |
| web | `docker/web.Dockerfile` | `${WEB_PORT:-3000}` | `next dev --turbo`, 3GB mem |
| seed / seed-prod | travel-api:dev | — | profiles `seed`/`seed-prod`, run `tsx prisma/seed[.prod].ts` |

Bring-up: `npm run docker:up` → `scripts/docker-up.sh` (Colima socket detection, HOST_IP, port freeing, builds, ordered start, parallel health checks).

## Docker — Prod (`docker-compose.prod.yml`)

Standalone file, run with `docker compose --env-file .env.prod -f docker-compose.prod.yml`.

| Service | Notes |
| :--- | :--- |
| postgres | profile ==`db`== — optional, skip when using Neon/external |
| redis | appendonly, 128MB, requires `REDIS_PASSWORD` |
| api | `docker/api.prod.Dockerfile` (3-stage, non-root); CMD: `prisma migrate deploy` → start; reads `/etc/secrets/.env.prod` if present (Render pattern) |
| web | `docker/web.prod.Dockerfile` — ==`NEXT_PUBLIC_*` baked at build== via args; standalone `server.js`, non-root |
| nginx | 80/443 reverse proxy, template config |
| certbot | profile `certbot` — manual TLS |
| migrate / seed | profiles for one-off `prisma migrate deploy` / prod seed |

`scripts/deploy-prod.sh` (~24KB) orchestrates: seed prompt → DB choice (Docker vs Neon, persisted `DB_MODE`) → swap check → generate `.env.prod` on first run → validation → ==git-SHA image versioning for rollback== → build API while old containers stay up → **DB backup** → migrations → optional seed → start API → build web (API live for ISR) → Nginx → health checks → certbot HTTPS if `DOMAIN` set.

## Render (`render.yaml`)

Blueprint "Safarnama", region oregon, free plan:

- **safarnama-api** — Docker web service (`api.prod.Dockerfile`), healthcheck `/health`, buildFilter on `apps/api/**` + `packages/shared/**`. Secrets `sync:false`; `DATABASE_URL`/`DIRECT_URL` from **safarnama-db**, `REDIS_URL` from **safarnama-redis** (keyvalue, allkeys-lru).
- **safarnama-web** — Docker web service (`web.prod.Dockerfile`). ==`NEXT_PUBLIC_API_URL` must be the frontend domain== (proxied via Next rewrites for same-site cookies), `BACKEND_API_URL` is the server-side proxy target. `NEXT_PUBLIC_*` changes require a manual redeploy (build-time baking).
- **safarnama-db** — free Postgres, ==expires after 90 days== → plan migration to Neon.
- Migrations run automatically on every deploy (prod Dockerfile CMD).
- Cron `keepAlive` pings `/health` every 14m to dodge free-tier idling → [[Background Jobs & Realtime#Cron Jobs]].

> [!info] No CI
> There is **no `.github/` directory** — no GitHub Actions. CI/CD = Render auto-deploy on push + manual `deploy-prod.sh` for self-hosted.

## Scripts (`scripts/`)

| Script | Purpose |
| :--- | :--- |
| `docker-up.sh` / `docker-down.sh` | Dev compose lifecycle with Colima/daemon detection and health checks |
| `deploy-prod.sh` | Full self-hosted production deploy (above) |

Related: [[Monorepo & Tooling]] · [[Database Schema#Migrations & Seeds]] · [[Payments & Webhooks]]
