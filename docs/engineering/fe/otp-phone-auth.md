# OTP Phone Authentication

## 1. Overview

OTP-first phone authentication using MSG91 Flow API. Users log in by entering their Indian phone number and verifying a 4-digit OTP. New users are auto-created and redirected to an onboarding page to set their name.

**Who:** All users (TRAVELER, ORGANIZER)
**Why:** Phone-first auth is standard for Indian travel apps (Swiggy, Zomato pattern). Lower friction than email+password.

## 2. Data Flow

```
/login/phone → PhoneInputForm → useSendOtp() → POST /auth/otp/send → OtpService.sendOtp()
  → VerificationCodeRepo.create() → MockOtpProvider/Msg91OtpProvider → DB

/login/phone → OtpVerifyForm → useVerifyOtp() → POST /auth/otp/verify → OtpService.verifyOtp()
  → VerificationCodeRepo.findLatest() → UserRepo.findByPhone()/create() → AuthService.issueTokens() → DB

/onboarding/profile → NameInputForm → useUpdateProfile() → PATCH /auth/profile → AuthService.updateProfile()
  → UserRepo.updateProfile() → DB
```

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/otp/send` | No | Send OTP to phone |
| POST | `/api/v1/auth/otp/verify` | No | Verify OTP, return tokens + isNewUser |
| PATCH | `/api/v1/auth/profile` | Bearer | Update user name (onboarding) |

## 4. Business Rules

- **Phone format:** 10-digit Indian number starting with 6-9. `normalizePhone()` strips +91/91/0 prefix.
- **OTP length:** 4 digits. Dev environment always uses `0000`.
- **OTP hashing:** SHA-256 with random 16-byte hex salt, stored as `salt:hash`.
- **OTP expiry:** 10 minutes from creation.
- **Max verify attempts:** 5 per OTP code. Incremented on wrong guess.
- **Resend cooldown:** 30 seconds between sends (server-enforced).
- **Rate limit:** Max 3 OTP sends per phone per 10 minutes.
- **Auto-create user:** On first successful verify, create user with `role: TRAVELER`, `phoneVerified: true`, `name: 'User'`.
- **isNewUser flag:** `true` if user was just created → redirect to `/onboarding/profile`. `false` → redirect to `/dashboard`.
- **Invalidation:** All existing unused codes for a phone are invalidated before sending a new one.
- **Provider:** MSG91 in production (env: `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`), MockOtpProvider in dev.

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Resend within 30s | 429 TooManyRequestsError with remaining seconds |
| >3 sends in 10 min | 429 TooManyRequestsError |
| Wrong OTP | 401 AuthError, attempts incremented, shake animation |
| 5th wrong attempt | 401 AuthError "Too many failed attempts" |
| Expired OTP (>10 min) | 401 AuthError "OTP has expired" |
| No OTP found for phone | 401 AuthError "No OTP found" |
| Invalid phone format | 400 ValidationError |
| Paste 4-digit OTP | Distributes digits across boxes, auto-submits |
| Backspace on empty box | Focus moves to previous box |
| Already authenticated user visits /login/phone | Redirect to /dashboard |
| Unauthenticated user visits /onboarding/profile | Redirect to /login/phone |

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| ValidationError | 400 | Invalid phone format or OTP format |
| AuthError | 401 | Wrong OTP, expired OTP, max attempts exceeded |
| TooManyRequestsError | 429 | Resend cooldown or rate limit exceeded |
| NotFoundError | 404 | User not found (updateProfile) |

## 7. Test Coverage

### Backend

| File | Covers |
|------|--------|
| `tests/unit/services/otp.service.test.ts` (16 tests) | sendOtp: happy path, dev OTP, invalidation, normalization, cooldown, rate limit, validation. verifyOtp: existing user, new user, phoneVerified, isNewUser, no OTP, expired, max attempts, wrong OTP, validation |
| `tests/unit/services/auth.service.test.ts` (24 tests) | Existing auth tests + updateProfile happy path + NotFoundError |
| `tests/unit/utils/phone.test.ts` (6 tests) | normalizePhone: valid, +91, 91, 0 prefix, too short, invalid start digit |
| `tests/unit/validators/auth.schema.test.ts` (29 tests) | Existing schemas + sendOtpSchema, verifyOtpSchema, updateProfileSchema |
| `tests/integration/auth.routes.test.ts` (12 tests) | Existing route tests (updated for OTP controller DI) |

### Frontend Components

| Component | Key behaviors |
|-----------|--------------|
| `PhoneInputForm` | +91 prefix, numeric-only input, validation, loading spinner, error display |
| `OtpVerifyForm` | 4-box input, auto-focus, backspace nav, paste support, auto-submit, 30s countdown, shake on error, resend |
| `NameInputForm` | Auto-focus, 2-char minimum, loading spinner, error display |
