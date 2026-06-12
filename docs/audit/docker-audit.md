# TripCompare Docker & Deploy Audit

> Audited: 2026-06-12 @ commit `9a9c643`. Scope: `docker/` (Dockerfiles, nginx config), `docker-compose.yml`, `docker-compose.prod.yml`, `scripts/deploy-prod.sh`. Follow-up to the main audit (see [synthesis.md](./synthesis.md)), which had only touched `docker-compose.prod.yml` incidentally.

---

## P0

### P0-1. Build-time ISR prerender runs against a dead API URL — the root cause of the "empty SSR snapshot" bug
**Evidence:** `docker-compose.prod.yml:131` passes the web build arg `API_URL_INTERNAL: http://127.0.0.1:4001/api/v1` (commented "Build-time placeholder"). Inside the build container, 127.0.0.1 is the container itself — the API is never reachable during `next build` (`web.prod.Dockerfile:65`). The deploy script's comment (`deploy-prod.sh:438`) claims "Pages fetch data at runtime (SSR), so API does not need to be running during build" — but home, `/trips`, `/trips/[slug]`, and destination pages are ISR (`revalidate: 300`), so Next **does** prerender them at build time.

**Failure:** Every ISR page prerenders with failed fetches → empty snapshot baked into the image. First visitors after each deploy see empty pages until revalidation succeeds at runtime. Commit `fd7a742` ("self-heal destinations page from stale/empty SSR snapshot") patched the symptom client-side; this is the cause. Compounded by nginx caching that empty 200 for 60s for all visitors (`default.conf.template:134`, `proxy_cache_valid 200 60s`).

**Fix:** Make build-time fetch failures fail the build loudly (throw in the page fetch when `NEXT_PHASE === 'phase-production-build'` and the API is unreachable), or build the web image on the compose network with the API container up so prerendering gets real data.

---

## P1

### P1-1. Every deploy takes the whole site down for the full build duration
**Evidence:** `deploy-prod.sh:354` — `$DC down --remove-orphans` runs **before** building the API image (`:358`), running migrations (`:423`), optionally seeding (`:430`), and building the web image (`:441`). On the 4GB host the script targets (it creates a 2GB swapfile specifically because "next build needs ~2GB RAM", `:63-76`), the Next build alone takes minutes.

**Failure:** Total outage (API + web + nginx all down) for the entire build + migrate + seed window on every deploy.

**Fix:** Build both images first, then `down`/`up` (seconds of downtime), or use `up -d --no-deps` per service after building. Migrations that are backward-compatible can run against the live DB before the swap.

### P1-2. The prod image cannot run its own migrations — `npx` downloads an unpinned Prisma CLI at deploy time
**Evidence:** `api.prod.Dockerfile:30-32` prunes devDependencies, with the comment explicitly noting it removes "prisma CLI ~160MB". `prisma` is in devDependencies (`apps/api/package.json`), `@prisma/client` in dependencies. But the `migrate` compose service (`docker-compose.prod.yml:229-237`) runs `npx prisma migrate deploy` **from that pruned image**.

**Failure:** With no local binary, npx fetches the **latest** `prisma` from the npm registry at deploy time: unpinned major version (schema/migrations written for Prisma 5, CLI could be 6/7+), requires registry network access mid-deploy, non-reproducible deploys.

**Fix:** Move `prisma` to `dependencies` (accept the image size), or add a separate `migrate` build stage that keeps the CLI, or pin `npx prisma@5 migrate deploy`.

### P1-3. The committed nginx template predates the Socket.IO route fix — stale artifact footgun
**Evidence:** `docker/nginx/ssl.conf.template:92` and `templates/default.conf.template.http-only:59` both have the `location /socket.io/` block (added in commit `c5b4055`). But the committed `templates/default.conf.template` (145 lines, read in full) has **no** `/socket.io/` location — it is a stale pre-fix artifact. The deploy script happens to overwrite it at deploy time (`deploy-prod.sh:467,470`), masking the problem. A `default.conf.template.ssl-backup` junk file also sits in the templates dir.

**Failure:** Anyone running `docker compose -f docker-compose.prod.yml up` without the deploy script gets nginx routing `/socket.io/` through `location /` to the **web** upstream → 404 → chat, presence, and live notifications dead.

**Fix:** Delete the stale `default.conf.template` and `.ssl-backup` from git; have the deploy script generate the active template into a gitignored path (or a named volume), so the repo never carries a wrong-but-plausible config.

---

## P2

### P2-1. The authenticated-user SSR cache bypass never fires (dead code, future data-leak vector)
**Evidence:** nginx skips the SSR proxy cache when the `refreshToken` cookie is present (`default.conf.template:128-137`, `$cookie_refreshToken`). But the API sets that cookie with `path: '/api/v1/auth'` (`auth.controller.ts:16,52`) — browsers never send it on page navigations, so `$skip_cache` is always 0 and logged-in users are served the shared anonymous cache.

**Impact:** Harmless today — pages aren't personalized server-side (auth renders client-side from localStorage). But the bypass is dead code, and the moment any SSR personalization lands, this becomes a cross-user data leak via the shared 60s cache. Either fix the bypass signal (e.g., a dedicated path=/ marker cookie set at login) or delete the bypass and document that SSR output must stay anonymous.

### P2-2. DB backups are written to the repo root, not gitignored, no rotation
**Evidence:** `deploy-prod.sh:410-417` writes `backup_YYYYMMDD_HHMMSS.sql.gz` (full pg_dump with user PII) into the repo root. `.gitignore` covers `.env.prod` (line 22) but has no `backup_*` pattern. No rotation, no offsite copy — and the backups live on the same disk that `down -v` (suggested in the script's own help text, `:586`) would wipe pgdata from.

**Fix:** gitignore `backup_*.sql.gz`, write to `/var/backups/travel/` (outside the repo), keep last N, and push to object storage.

### P2-3. `RAZORPAY_WEBHOOK_SECRET=` is scaffolded blank with no go-live validation
**Evidence:** the generated `.env.prod` template leaves it empty (`deploy-prod.sh:148`); the script validates only `REDIS_PASSWORD`, `JWT_SECRET`, `POSTGRES_PASSWORD` (`:279-283`). This is the deploy-side half of backend **P0-3** (empty-string HMAC — see [backend-audit.md](./backend-audit.md)): nothing stops a deploy with Razorpay keys set but webhook secret blank.

**Fix:** `validate_secret`-style check: if `RAZORPAY_KEY_ID` is non-empty, require `RAZORPAY_WEBHOOK_SECRET` non-empty, else abort.

### P2-4. Prod API runs TypeScript via tsx at runtime, not compiled JS
**Evidence:** `api.prod.Dockerfile:58` — `CMD ["node", "--import=tsx", "src/index.ts"]`. `docs/PROJECT_REFERENCE.md` claims "Production API (compiled JS)"; an unused `npm run build` (tsc) script exists. tsx is correctly in `dependencies` so this works, but type errors surface only at runtime, startup pays the transpile cost, and the 256MB heap (`NODE_OPTIONS=--max-old-space-size=256`) carries tsx overhead.

**Fix (optional):** compile with tsc in the builder stage and run plain `node dist/index.js`; or accept tsx and fix the doc.

### P2-5. Misc
- **Redis `--maxmemory-policy allkeys-lru`** (`docker-compose.prod.yml:53-54`) can evict rate-limit and login-lockout keys under memory pressure — already flagged as backend P1-6; use `volatile-lru` or a dedicated logical DB for limiter keys.
- **HTTP-only mode prints wrong URLs:** the script's summary advertises `http://IP:3001` / `http://IP:4001` (`deploy-prod.sh:576-578`) but those ports are bound to `127.0.0.1` only (`docker-compose.prod.yml:89,147`) — cosmetic, but misleading during IP-only bring-up.
- **nginx healthcheck is weak:** `kill -0 $(cat nginx.pid)` (`docker-compose.prod.yml:204`) checks process existence, not serving; `wget -qO /dev/null http://127.0.0.1/health` would catch config-level failures.

---

## What's genuinely good (keep it)

- Multi-stage builds with `--mount=type=cache` npm caching; dummy workspace package.json trick keeps each app's image free of the other's deps.
- Non-root users in both prod images (`USER node` / `USER nextjs`), `dumb-init` as PID 1 for signal handling.
- Resource limits (memory + CPU) and json-file log rotation on **every** service.
- API/web host ports bound to `127.0.0.1` only — nothing but nginx is internet-facing.
- Healthcheck-gated startup ordering (`depends_on: condition: service_healthy`), with `required: false` for the optional Postgres profile.
- Pre-migration `pg_dump` backup; git-SHA image tagging with a documented one-line rollback.
- Certbot auto-renew cron (1st & 15th, with graceful `nginx -s reload`); modern TLS (1.2/1.3, HSTS, session tickets off).
- `client_max_body_size 1m` deliberately matches the Express JSON limit and the Cloudinary-direct-upload design (images never transit nginx/Express).
- `.env.prod` is gitignored; secrets auto-generated with `openssl rand`; the script deliberately avoids `source .env.prod` (PEM newline footgun documented inline).
- Immutable caching for `/_next/static/`, 24h proxy cache for `/_next/image`, gzip tuned.

**Top 3 to fix first:** P0-1 (build-time API URL — root cause of the stale-snapshot class of bugs), P1-1 (deploy downtime), P1-3 (stale nginx template in git).
