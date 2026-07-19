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

> [!warning] Flag-on-role gating (isReseller) is NOT expressible by requireRole
> Reseller is not a role — it's `User.isReseller=true` on a TRAVELER. All `/api/v1/reseller/sublinks*` routes use `requireRole('TRAVELER','ADMIN')` at the route layer, then `ResellerService` explicitly checks `caller.isReseller === true` **and** that the caller is the reseller named on the specific main link/sublink (`mainLink.resellerId === callerId || mainLink.resellerEmail === caller.email`), throwing `ForbiddenError` otherwise. Never assume `requireRole` alone is sufficient when a permission is a flag rather than a role — check the service layer.
>
> Same principle applies to admin bypass on ownership-scoped reads: `requireRole('TRAVELER','ADMIN')` makes an admin a valid *caller* but not the resource *owner*. `ResellerService.getMainLinkBookings` and `getSublinkBookings` both take an explicit `isAdmin: boolean` param (computed in `ResellerController` from `req.user!.role === USER_ROLE.ADMIN`) and skip the ownership check (`mainLink.organizerId`/`sublink.resellerId` match) only when `isAdmin` is true — the `NotFoundError` check for a missing entity still runs unconditionally, even for admins. Each service method needs its own explicit bypass; there is no blanket admin-skips-ownership mechanism.
>
> `getSublinkBookings` additionally takes an `isOrganizer: boolean` (also computed in the controller from `req.user!.role`), since its route guard is `requireRole('TRAVELER','ORGANIZER','ADMIN')` — the shared "Views" UI calls this sublink-level endpoint for the reseller, the trip's organizer, and admin alike. When `isOrganizer` is true (and `isAdmin` is false), the service resolves the caller's `OrganizerProfile` and checks it against the sublink's `mainLink.organizerId` (same shape as `getMainLinkBookings`'s organizer-ownership check) instead of the reseller-ownership check — a route guard covering multiple roles is not itself an ownership check, the service still has to branch on which role is calling and apply the matching ownership rule.

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
