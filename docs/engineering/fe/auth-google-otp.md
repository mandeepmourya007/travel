# Auth: Google OAuth + Phone OTP + Unified Onboarding

## 1. Overview
**What:** Multi-method authentication — phone OTP (primary), Google OAuth (alternative), email/password (legacy).
**Who:** All users — travelers and organizers.
**Why:** Reduce signup friction, enable one-tap Google login, collect name + role via unified onboarding.

## 2. Data Flow
- **Signup:** SignupPage → `POST /auth/signup` (email+password) → `/onboarding` → `PATCH /auth/profile` → `/dashboard`
- **Phone OTP:** PhoneLoginPage → `POST /auth/otp/send` → `POST /auth/otp/verify` → `/onboarding` (if new) → `/dashboard`
- **Google:** GoogleAuthSection → `POST /auth/google` → `/onboarding` (if new) → `/dashboard`
- **Onboarding:** OnboardingForm → `PATCH /auth/profile` (name + role) → `/dashboard`

## 3. API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | No | Email+password signup (name/role optional, defaults applied) |
| POST | `/auth/login` | No | Email+password login |
| POST | `/auth/google` | No | Google OAuth — idToken → verify → login/link/create |
| POST | `/auth/otp/send` | No | Send OTP to Indian phone number |
| POST | `/auth/otp/verify` | No | Verify OTP → login/create user |
| PATCH | `/auth/profile` | Bearer | Update name and optionally role |
| GET | `/auth/me` | Bearer | Get current user |

## 4. Business Rules
- Signup defaults: `name = 'User'`, `role = 'TRAVELER'` when not provided
- Google login: finds user by googleId first, then by email (links googleId), else creates new
- Google new users: always TRAVELER, onboarding handles role selection
- Role change to ORGANIZER auto-creates OrganizerProfile if not exists
- Google-only accounts (no password) show specific error message on email login attempt
- Deactivated accounts blocked at login, Google, and OTP verify
- P2002 race condition on Google signup retries as login
- Onboarding tracked via `completedOnboarding` flag in Zustand (persisted to localStorage)
- Existing-user logins (email, OTP, Google) set `completedOnboarding = true`; new signups leave it `false`
- `GoogleAuthSection` renders nothing when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is absent

## 5. Edge Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| Google email matches existing password user | Links googleId, logs in |
| Google-only user tries email login | "This account uses Google sign-in" error |
| Signup with only email+password | Defaults name='User', role='TRAVELER' |
| Role switch to ORGANIZER (already has profile) | Updates role, skips profile creation |
| Concurrent Google signup (race) | P2002 caught, retries as login |
| Google email not verified | AuthError thrown |
| Missing GOOGLE_CLIENT_ID env var | GoogleAuthSection returns null, BE throws AuthError |
| Google new user lands on /onboarding | Sees form (completedOnboarding=false), selects name+role |
| Existing user navigates to /onboarding | Redirected to /dashboard (completedOnboarding=true) |

## 6. Error Handling
| Error | HTTP | When |
|-------|------|------|
| Invalid Google token | 401 | Google token verification fails |
| Google email not verified | 401 | Google account email unverified |
| Account deactivated | 401 | Any login method, deactivated user |
| Email conflict | 409 | Signup with existing email |
| Invalid credentials | 401 | Wrong email/password |
| User not found | 404 | updateProfile with invalid userId |

## 7. Test Coverage
**Backend** (`apps/api/tests/unit/services/auth.service.test.ts`):
- `signup` — simplified defaults, organizer auto-profile
- `login` — Google-only user error message
- `updateProfile` — role update, ORGANIZER profile auto-creation, skip if already ORGANIZER
- `googleAuth` — existing by googleId, link by email, new user, token errors, deactivated (by googleId & email), race condition (P2002), isNewUser flag, Google name used

**Backend Validators** (`apps/api/tests/unit/validators/auth.schema.test.ts`):
- `signupSchema` — email+password only, role undefined when omitted
- `updateProfileSchema` — valid role, no role, invalid role
- `googleAuthSchema` — valid token, empty token, missing token

**Backend Integration** (`apps/api/tests/integration/auth.routes.test.ts`):
- `POST /google` — validation (400), new user (201), existing user (200)

**Frontend** (`apps/web/src/components/auth/__tests__/onboarding-form.test.tsx`):
- Render name input + role selector, disabled submit, validation, role toggle, success callback, API error

**Frontend** (`apps/web/src/components/auth/__tests__/name-input-form.test.tsx`):
- Render, disabled/enabled button, spinner, success callback, validation, API error
