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
| Phone OTP (backend) | `POST /auth/otp/send` + `/verify` | MSG91 (SMS or WhatsApp, see `MSG91_WA_OTP_PREFER`) or mock; 4-digit, 10m expiry, 5 attempts. Fixed dev code `0000` shortcut currently disabled (commented out in `otp.service.ts`'s `generateOtp()`) — a random 4-digit OTP is generated in every environment |
| Phone OTP (Firebase) | `POST /auth/firebase/verify` | Strategy chosen by `PHONE_AUTH_STRATEGY`; conditional route mount |
| Email OTP | `POST /auth/otp/email/send` + `/verify` | Resend/SMTP/mock providers |
| Organizer invite | `GET/POST /auth/signup/:token` | Admin-generated 7-day JWT invite token |

> [!important] Explicit consent capture at signup
> `POST /auth/signup` (traveler, `signupSchema`) requires `acceptedTerms: true` (Zod `z.literal(true)`, custom error if unchecked) via an explicit checkbox on the signup page — server stamps `User.tncAcceptedAt = new Date()` on success (never client-supplied). `POST /auth/signup/:token` (organizer invite completion, `organizerSignupSchema`) requires `acceptedOrganizerAgreement: true` via a second checkbox — server stamps `OrganizerProfile.organizerTncAcceptedAt` at the moment that profile is created (not on `User` — only organizers ever have a profile row). These are legally distinct documents (Terms of Service + Privacy Policy vs. Organizer Agreement, see `apps/web/src/lib/legal-content.ts`) and are initial-acceptance timestamps only — no version field or re-consent flow.
>
> `POST /auth/google` (`googleAuthSchema`) also stamps `User.tncAcceptedAt` when it creates a brand-new user — `acceptedTerms` is an optional boolean at the Zod layer (the same endpoint also re-authenticates existing users, who shouldn't be re-prompted), but `AuthService.googleAuth`'s new-user branch throws a `ValidationError` if it's not `true`. The web signup page's Google button is disabled until its `acceptedTerms` checkbox is checked; login pages send `acceptedTerms: true` unconditionally alongside a permanent "by continuing you agree to..." disclaimer under the button, since a new account can also be created from a login page's Google button. OTP-based signup is unaffected (not in scope).
>
> Two more call sites can create an `OrganizerProfile` and are gated the same way: `POST /auth/signup` (password signup, `signupSchema`) with `role: 'ORGANIZER'`, and `PATCH /auth/profile` (self-serve role switch, `updateProfileSchema`) with `role: 'ORGANIZER'`. Both schemas add a `.superRefine()` (`requireOrganizerAgreementForOrganizerRole` in `packages/shared/src/validators/auth.schema.ts`) that requires `acceptedOrganizerAgreement: true` whenever `role === 'ORGANIZER'` is submitted, reusing the same `ORGANIZER_AGREEMENT_ERROR` message as the invite flow. `AuthService.signup` and `AuthService.updateProfile` both now pass `new Date()` as the `organizerTncAcceptedAt` argument to the shared `createOrganizerProfileWithSlug` helper whenever they create an `OrganizerProfile` for these paths — the same mechanism `organizerSignup` (invite flow) already used, closing what was previously a gap where a direct API call could self-serve into ORGANIZER without ever accepting the Organizer Agreement. There is currently no role-picker UI in `apps/web` that reaches either of these two ORGANIZER branches (checked as of this note) — the backend gate holds regardless.

## Mandatory Phone Verification (All Roles)

**Policy:** every authenticated user — TRAVELER, ORGANIZER, ADMIN, existing or brand-new — is expected to eventually have `User.phoneVerified === true`. No role exemptions, no grandfathering. Users who signed up/logged in via phone OTP (`POST /auth/otp/verify`) or Firebase phone auth already satisfy this by construction (those flows set `phoneVerified: true` on creation). Users who signed up via email+password, email OTP, Google OAuth, or organizer-invite do **not** get a phone collected at signup and must attach one separately.

**Attach flow — session-preserving, distinct from the public login OTP:**

| Method | Path | Guard | Notes |
| :--- | :--- | :--- | :--- |
| Send attach OTP | `POST /auth/otp/attach/send` | auth + `otpRateLimit` | `OtpService.sendPhoneOtpForAttach(userId, phone)` — reuses `sendOtpSchema` |
| Verify + attach | `POST /auth/otp/attach/verify` | auth + `otpRateLimit` | `OtpService.verifyPhoneOtpForAttach(userId, phone, otp)` — reuses `verifyOtpSchema` |

- These are **not** the same as `POST /auth/otp/send` + `/verify` — those are public, look a user up *by phone*, and auto-signup/login as that phone's owner (replacing the session). The attach pair is authenticated, operates on `req.user!.userId` (never a body-supplied user id), and **never calls `issueTokens`, never sets the refresh cookie, never returns tokens** — the caller's existing session is untouched.
- **Duplicate phone rejection:** if the phone is already linked to a different account, both `sendPhoneOtpForAttach` (pre-check via `UserRepository.findByPhone`) and `verifyPhoneOtpForAttach` (race-safety re-check + a P2002 unique-constraint catch on `UserRepository.setPhone`) reject with `ConflictError` (`code: CONFLICT`, `subCode: PHONE_TAKEN` — see `AUTH_ERROR_CODE` in `apps/api/src/utils/constants.ts`). `phone` stays `@unique` — no merge/hijack of another account.
- `AuthService.issueTokens` and `AuthService.getMe` both include `phone`/`phoneVerified` on `AuthResponse['user']`, so every login path (signup, login, Google, phone/email OTP verify) surfaces the current verification state to the client without an extra round-trip.
- **Client-side gate:** `apps/web`'s `AuthGuard` + `getPostAuthRoute` helper redirect an unverified user to `/verify-phone`.
- **Server-side enforcement:** `requirePhoneVerified` middleware (`apps/api/src/middleware/require-phone-verified.middleware.ts`, factory `createRequirePhoneVerified(userRepo)`) does a fresh `UserRepository.findById` lookup (never trusts a `phoneVerified` JWT claim, since the 15-min access token isn't refreshed on phone attach) and throws `ForbiddenError` with `subCode: 'PHONE_NOT_VERIFIED'` when `phoneVerified !== true`, so the client can distinguish this from a generic 403 and route to `/verify-phone`. Wired (after `authMiddleware`, before `validate`) on the highest-risk mutation endpoints: `POST /bookings` (booking creation + payment-order initiation — the same endpoint), `POST /chat/conversations/:id/messages` (REST message send), and `POST /reviews` (review creation). Organizer-side mutations (trip/vehicle creation) are **not yet guarded** — lower priority per the audit, left as a follow-up since wiring them requires the same signature change across `trip.routes.ts`/`vehicle.routes.ts`.

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
- Post-login routing: `getHomeRoute(role)` — ADMIN → `/admin`, ORGANIZER → `/dashboard`, else `/trips`. Every login/signup success handler (password, Google, phone OTP, email OTP, onboarding completion, organizer-invite signup) routes through `getPostAuthRoute({ isNewUser, user, returnTo })` (`apps/web/src/lib/constants.ts`) instead of calling `getHomeRoute` directly — it checks `user.phoneVerified` first (unverified → `VERIFY_PHONE_ROUTE = '/verify-phone'`, wins over everything else), then `isNewUser` (→ `ONBOARDING_ROUTE`), then falls back to `returnTo ?? getHomeRoute(role)`.

### Frontend Guards

| Guard | Behavior |
| :--- | :--- |
| `components/shared/auth-guard.tsx` | Spinner until `_hasHydrated`; unauth → `/login/email`; ==`phoneVerified === false` (explicit, not falsy) → `/verify-phone`, no role exemption==; optional `allowedRoles` (mismatch → `/`) |
| `components/shared/role-guard.tsx` | Renders "Access Denied" for wrong role |

The phone gate is a single choke point in `AuthGuard` — since `admin/layout.tsx` and `dashboard/layout.tsx` both wrap `AuthGuard`, and every other private page guards page-level with the same component, one change covers every role. `apps/web/src/app/(auth)/verify-phone/page.tsx` (the redirect target) lives in `(auth)`, which has **no** layout-level `AuthGuard`, avoiding a redirect loop. It re-derives truth from `useProfile()` to self-correct a stale-rehydrated session that thinks it's unverified when the server disagrees. The reusable `components/auth/phone-verification-flow.tsx` (phone → OTP step machine, wired to `use-attach-phone.ts`, never the public login OTP hooks) is shared by this route and the profile "Verify phone" CTA (`components/profile/verify-phone-cta.tsx`, shown in `edit-user-profile-form.tsx` whenever `!profile.phoneVerified`) — one implementation, two call sites.

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
