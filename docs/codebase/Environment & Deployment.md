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
| Email | `SMTP_HOST/PORT/USER/PASS/FROM` (all-or-nothing), `RESEND_API_KEY`, `RESEND_FROM`, `SUPPORT_EMAIL` (optional, defaults `support@safarnama.store`; used as Reply-To + `List-Unsubscribe` mailto) |
| SMS OTP | `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` |
| WhatsApp (optional) | `MSG91_WA_BUSINESS_NUMBER` (exact value from MSG91 dashboard — already includes its own country code, never re-prefixed by provider code), `MSG91_WA_OTP_TEMPLATE`, `MSG91_WA_OTP_PREFER` (`"true"` to prefer WA over SMS OTP), `MSG91_WA_TPL_<TYPE>` × 12 notification template names — all optional; system silently skips WhatsApp channel when unset |
| Payments | `PAYMENT_GATEWAY` (razorpay\|cashfree), `RAZORPAY_KEY_ID` (must start `rzp_`) / `KEY_SECRET` / `WEBHOOK_SECRET`, `CASHFREE_APP_ID` / `SECRET_KEY` / `WEBHOOK_SECRET` / `CASHFREE_ENV`, `NEXT_PUBLIC_CASHFREE_ENV` |
| Organizer payouts | `PAYOUT_STRATEGY` (route\|razorpayx_payouts, ==default `razorpayx_payouts`==), `RAZORPAYX_KEY_ID` / `KEY_SECRET` / `ACCOUNT_NUMBER` / `WEBHOOK_SECRET` (separate signup/key-pair from `RAZORPAY_KEY_ID`; sandbox/test-mode credentials configured, verified end-to-end with a real payout — see [[Payments & Webhooks]]) |
| Media | `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` |
| Monitoring | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_*`, `SENTRY_AUTH_TOKEN` (source maps) |
| Legal (FE) | `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_GRIEVANCE_EMAIL`, `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` |
| SEO | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION` |

> [!warning] Production superRefine Rules
> In prod: Razorpay webhook secret required when key set; Cashfree creds + webhook secret required when it's the active gateway; `REDIS_URL` required; SMTP and Firebase are each all-or-nothing. The four `RAZORPAYX_*` vars, however, are required whenever `PAYOUT_STRATEGY=razorpayx_payouts` (the default) **in every environment, not just production** — dev/CI/staging fail to boot too unless either all four are set or `PAYOUT_STRATEGY=route` is set explicitly.

> [!warning] OTP provider fails loudly in production
> `dependencies.ts` picks `Msg91WhatsappOtpProvider` → `Msg91OtpProvider` → `MockOtpProvider`, in that order, based on which MSG91 vars are set. In `NODE_ENV=production`, if neither is configured the app now **throws at boot** instead of silently falling back to `MockOtpProvider` (which used to log `[MOCK] OTP sent (dev mode)` + a generic `OTP sent` success line while sending no real SMS). Set `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` (SMS) or the WhatsApp trio to fix.
>
> `MSG91_WA_OTP_PREFER` is the only WhatsApp-OTP var that also needs an *explicit* `"true"` — having the other three WhatsApp vars set is not enough, since `waOtpConfigured && preferWhatsappOtp` is an AND. `render.yaml` now declares it `sync: false` (an operator-set dashboard secret, not a baked-in `value`) so it can be flipped per environment without editing/redeploying the blueprint. `dependencies.ts` also `logger.warn`s at boot if WhatsApp OTP is fully configured but not preferred (or preferred but not fully configured) — check for that line if OTPs are arriving via the wrong channel.

> [!note] env.ts Bypasses
> A few values read `process.env` directly: `WALLET_AUTO_CASHBACK_PERCENT/CAP`, `WALLET_CREDIT_EXPIRY_DAYS` (`utils/constants.ts`), `RENDER_EXTERNAL_URL` (cron keepalive).

> [!warning] Email Deliverability — DNS, Not Code
> Reply-To / `List-Unsubscribe` headers and footer contact info (wired in `config/dependencies.ts`, `providers/resend-email.provider.ts` / `nodemailer-email.provider.ts`) are secondary hygiene only. The actual fix for emails landing in spam is **SPF, DKIM, and DMARC DNS records** for the sending domain (`safarnama.store`) — configured in the Resend dashboard (domain verification) + the domain registrar's DNS zone. This is outside the codebase; the app cannot self-remediate spam placement without it.

## Docker — Dev (docker-compose.yml, Compose ≥ 2.24)

| Service | Image | Ports | Notes |
| :--- | :--- | :--- | :--- |
| postgres | postgres:15-alpine3.20 | 127.0.0.1:5432 | `fsync=off` (==dev only==), 192M |
| redis | redis:7-alpine3.20 | `127.0.0.1:${REDIS_PORT:-6379}` | pass `dev-redis-pass`, tmpfs, 32MB — host port overridable to avoid clashing with another project's local Redis; internal container-to-container traffic (`REDIS_URL=redis://:pass@redis:6379`) is unaffected, always 6379 |
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
| web | `docker/web.prod.Dockerfile` — ==`NEXT_PUBLIC_*` baked at build== via args; standalone `server.js`, non-root; runner stage copies `apps/web/public` (favicon, manifest icons, screenshots) alongside `.next/standalone`/`.next/static` — omitting it 404s all static assets referenced by `manifest.ts`. Every `NEXT_PUBLIC_*` var the app reads must have a matching `ARG`/`ENV` pair in this Dockerfile's builder stage **and** a corresponding entry in `docker-compose.prod.yml`'s `web.build.args` block — missing either one means the value silently never reaches `next build`, even if it's correctly set in `.env.prod`. `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (GSC HTML-tag verification, rendered by `apps/web/src/app/layout.tsx`) follows this pattern; changing it on a self-hosted box requires a full image rebuild (`docker compose --env-file .env.prod -f docker-compose.prod.yml build web && ... up -d web` — same as any other `NEXT_PUBLIC_*` var), not just a container restart. |
| nginx | 80/443 reverse proxy, template config |
| certbot | profile `certbot` — manual TLS |
| migrate / seed | profiles for one-off `prisma migrate deploy` / prod seed |

`scripts/deploy-prod.sh` (~24KB) orchestrates: seed prompt → DB choice (Docker vs Neon, persisted `DB_MODE`) → swap check → generate `.env.prod` on first run → validation → ==git-SHA image versioning for rollback== → build API while old containers stay up → **DB backup** → migrations → optional seed → start API → build web (API live for ISR) → Nginx → health checks → certbot HTTPS if `DOMAIN` set.

## Render (`render.yaml`)

Blueprint "Safarnama", region oregon, free plan:

- **safarnama-api** — Docker web service (`api.prod.Dockerfile`), healthcheck `/health`, buildFilter on `apps/api/**` + `packages/shared/**`. Secrets `sync:false`; `DATABASE_URL`/`DIRECT_URL` from **safarnama-db**, `REDIS_URL` from **safarnama-redis** (keyvalue, allkeys-lru).
- **safarnama-web** — Docker web service (`web.prod.Dockerfile`). ==`NEXT_PUBLIC_API_URL` must be the frontend domain== (proxied via Next rewrites for same-site cookies), `BACKEND_API_URL` is the server-side proxy target. `NEXT_PUBLIC_*` changes require a manual redeploy (build-time baking). `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is declared in the web service's `envVars` block as `sync: false` (Google Search Console HTML-tag verification code) — set it in the Render dashboard, then trigger a manual redeploy; the meta tag in `apps/web/src/app/layout.tsx` only renders when this var is set.
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

## Seeding the local Docker DB

`apps/api/prisma/seed.prod.ts` is a fully **idempotent** production-style seed — every insert is guarded by `upsert` on unique keys or `findFirst` guards, so re-runs never delete or duplicate rows. Adds new entries only for records appended to the file.

### Preferred path — run inside the `travel-api` container

Bypasses host-side Docker port-forwarding quirks entirely.

```bash
# 1. Deploy any pending migrations
docker exec travel-api npx prisma migrate deploy

# 2. Regenerate Prisma client if the schema changed since the container was built
docker exec travel-api npx prisma generate

# 3. Copy the latest seed file into the container (only needed if no volume mount)
docker cp apps/api/prisma/seed.prod.ts travel-api:/app/apps/api/prisma/seed.prod.ts

# 4. Run the seed
docker exec travel-api npm run db:seed:prod
```

### From the host

Only works if nothing else is holding port 5432 (see troubleshooting below).

```bash
cd apps/api
npx prisma migrate deploy
npm run db:seed:prod
```

### Troubleshooting

- **`P1010: User was denied access` at `localhost:5432`** — a native Postgres (usually Homebrew's `postgresql@14`) is shadowing the Docker container on the same port. Stop it: `brew services stop postgresql@14`. Confirm with `lsof -nP -iTCP:5432 -sTCP:LISTEN`.
- **`P1001: Can't reach database server at 127.0.0.1:5432`** after stopping the shadow — Docker Desktop's port-publisher on macOS can get stuck. Either **restart Docker Desktop**, or just use the container-exec path above.
- **Migration fails with `enum label ... already exists`** — DB state drifted ahead of `_prisma_migrations`. Mark the offending migration as applied:
  ```bash
  docker exec travel-api npx prisma migrate resolve --applied <migration_name>
  ```
- **Seed fails with `Cannot read properties of undefined (reading 'findUnique')`** — the container's generated Prisma client is stale. Run `docker exec travel-api npx prisma generate` and re-seed.

Related: [[Monorepo & Tooling]] · [[Database Schema#Migrations & Seeds]] · [[Payments & Webhooks]]
