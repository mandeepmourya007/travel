# TripCompare Docker & Deploy Audit — Pending Findings

> Audited: 2026-06-12 @ commit `9a9c643`. Scope: `docker/` (Dockerfiles, nginx config), `docker-compose.prod.yml`, `scripts/deploy-prod.sh`.
> **All P0 and P1 findings are resolved** (ISR build URL, deploy downtime, Prisma pin, stale nginx template). This file tracks what remains open.

---

## P1 — Pending (was P2)

### P1-1. The authenticated-user SSR cache bypass never fires (dead code, future data-leak vector)
**Evidence:** nginx skips the SSR proxy cache when the `refreshToken` cookie is present (`templates/default.conf.template` `$cookie_refreshToken`). But the API sets that cookie with `path: '/api/v1/auth'` (`auth.controller.ts:16,52`) — browsers never send it on page navigations, so `$skip_cache` is always 0 and logged-in users are served the shared anonymous cache.

**Impact:** Harmless today — pages aren't personalized server-side (auth renders client-side from localStorage). But the bypass is dead code, and the moment any SSR personalization lands, this becomes a cross-user data leak via the shared 60s cache.

**Fix:** Either fix the bypass signal (e.g., a dedicated `path=/` marker cookie set at login) or delete the bypass entirely and document that SSR output must stay anonymous.

---

## P2 — Polish

### P2-1. Prod API runs TypeScript via tsx at runtime, not compiled JS *(optional)*
**Evidence:** `api.prod.Dockerfile:58` — `CMD ["node", "--import=tsx", "src/index.ts"]`. tsx is in `dependencies` so this works, but type errors surface only at runtime, startup pays the transpile cost, and the 256MB heap (`NODE_OPTIONS=--max-old-space-size=256`) carries tsx overhead. `docs/PROJECT_REFERENCE.md` claims "Production API (compiled JS)".

**Fix (optional):** Compile with tsc in the builder stage and run plain `node dist/index.js`; or accept tsx and update the doc.

---

## What's genuinely good (keep it)

- Multi-stage builds with `--mount=type=cache` npm caching; dummy workspace package.json trick keeps each app's image free of the other's deps.
- Non-root users in both prod images (`USER node` / `USER nextjs`), `dumb-init` as PID 1 for signal handling.
- Resource limits (memory + CPU) and json-file log rotation on every service.
- API/web host ports bound to `127.0.0.1` only — nothing but nginx is internet-facing.
- Healthcheck-gated startup ordering (`depends_on: condition: service_healthy`).
- API built before containers go down → near-zero build-time downtime; API started before web build so ISR prerenders get real data.
- Pre-migration `pg_dump` backup to `/var/backups/travel` with 5-backup rotation; `backup_*.sql.gz` gitignored.
- `prisma@5` pinned in the migrate service command — reproducible deployments.
- Certbot auto-renew cron (1st & 15th, with graceful `nginx -s reload`); modern TLS (1.2/1.3, HSTS, session tickets off).
- `client_max_body_size 1m` deliberately matches the Express JSON limit and the Cloudinary-direct-upload design.
- `.env.prod` is gitignored; secrets auto-generated with `openssl rand`; `RAZORPAY_WEBHOOK_SECRET` validated at deploy time when `RAZORPAY_KEY_ID` is set.
- Immutable caching for `/_next/static/`, 24h proxy cache for `/_next/image`, gzip tuned.
- Redis `volatile-lru` eviction; nginx healthcheck via live HTTP probe.
