---
title: Auth & Security
created: 2026-07-10
type: permanent
tags:
  - codebase/security
  - auth
---

# Auth & Security

## Token Model

- **Access token** — JWT HS256 (`JWT_SECRET`, min 32 chars), ==15-minute expiry==, carried as `Authorization: Bearer`, verified by `auth.middleware.ts` → sets `req.user = { userId, role }`.
- **Refresh token** — ==7 days==, stored hashed in [[Database Schema#Auth & Audit|RefreshToken]] with `familyId`, device info, IP; delivered as an **HttpOnly cookie**.

### Refresh Token Rotation
`POST /auth/refresh` rotates the token within its family; reuse of a revoked token can burn the family. `POST /auth/logout` revokes the current token, `/logout-all` revokes all sessions. Stale tokens purged hourly by [[Background Jobs & Realtime#Cron Jobs|cron]].

## Login Methods

| Method | Backend Path | Notes |
| :--- | :--- | :--- |
| Email + password | `POST /auth/login` | bcrypt (saltRounds 12); lockout via `LoginAttemptTracker` |
| Google OAuth | `POST /auth/google` | `@react-oauth/google` on FE |
| Phone OTP (backend) | `POST /auth/otp/send` + `/verify` | MSG91 or mock; 4-digit, 10m expiry, 5 attempts, dev code `0000` |
| Phone OTP (Firebase) | `POST /auth/firebase/verify` | Strategy chosen by `PHONE_AUTH_STRATEGY`; conditional route mount |
| Email OTP | `POST /auth/otp/email/send` + `/verify` | Resend/SMTP/mock providers |
| Organizer invite | `GET/POST /auth/signup/:token` | Admin-generated 7-day JWT invite token |

## Roles & Guards (Backend)

`requireRole(...roles)` middleware — roles from [[Shared Package#Constants]] (`USER_ROLE`): TRAVELER, ORGANIZER, ADMIN. `TRAVELER_ROLES = [TRAVELER, ADMIN]` lets admins hit traveler endpoints. Full per-endpoint guard map: [[API Routes Reference]].

## Frontend Session Model

`apps/web/src/store/auth.store.ts` (zustand + `persist`, key `travel-auth`):

> [!important] Access Token Never Persisted
> Only `user`, `isAuthenticated`, `completedOnboarding` are persisted. The ==access token lives in memory only== (XSS mitigation); the durable credential is the HttpOnly refresh cookie.

- **Hydration** (`onRehydrateStorage`): if previously authenticated, silently `POST /auth/refresh` (50s timeout for cold starts) *before* flipping `_hasHydrated`. Confirmed 401 → clear session; transient errors → stay logged in.
- **401 flow** in the axios interceptor: mutex-guarded refresh, then session-expired overlay + redirect with sanitized `returnTo` → [[Data Fetching & State#API Client]].
- Post-login routing: `getHomeRoute(role)` — ADMIN → `/admin`, ORGANIZER → `/dashboard`, else `/trips`.

### Frontend Guards

| Guard | Behavior |
| :--- | :--- |
| `components/shared/auth-guard.tsx` | Spinner until `_hasHydrated`; unauth → `/login/email`; optional `allowedRoles` (mismatch → `/`) |
| `components/shared/role-guard.tsx` | Renders "Access Denied" for wrong role |

Layout-level: `admin/layout.tsx` (`AuthGuard allowedRoles={['ADMIN']}`), `dashboard/layout.tsx` (`AuthGuard` + `RoleGuard ORGANIZER`). All other private pages guard page-level. ==No `middleware.ts`== — protection is client-side only; SSR still returns 200 for private routes.

## Other Security Measures

- **Rate limiting** — Redis sliding window, per-IP tiers → [[API Backend#Middleware]].
- **Helmet** + HSTS + custom Permissions-Policy; `trust proxy 1` behind Nginx.
- **CORS** — `CLIENT_URL` + `ALLOWED_ORIGINS` allowlist (`config/cors.ts`).
- **Webhook HMAC verification** (timing-safe) inside gateways → [[Payments & Webhooks#Webhook Handling]].
- **Chat anti-leakage filter** (`utils/chat-filter.ts`) — blocks phone/UPI/email/URLs; flagged messages surface at `/admin/chat`.
- **Zod validation** on body/query/params for every mutating route → [[Shared Package#Validators (Zod)]].
- **Sentry** on both apps; API errors logged with request-scoped Pino context.
- Next.js security headers (`X-Frame-Options: DENY`, nosniff, referrer/permissions policies) → [[Web Frontend#next.config.js Behaviors]].
- Open-redirect-safe `returnTo` handling on login pages.

Related: [[API Backend]] · [[Web Frontend]] · [[Database Schema]]
