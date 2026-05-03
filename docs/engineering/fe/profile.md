# Profile Page

## 1. Overview

- **What**: Profile page for viewing and editing user + organizer profile data
- **Who**: Any authenticated user (TRAVELER or ORGANIZER)
- **Why**: Users need to update name, avatar, and organizer business details

## 2. Data Flow

```
/profile → useProfile() → GET /auth/profile → AuthService.getFullProfile → UserRepo.findWithOrganizer → DB
Edit name → useUpdateProfile() → PATCH /auth/profile → AuthService.updateProfile → UserRepo.updateProfile → DB
Edit org  → useUpdateOrganizerProfile() → PATCH /auth/profile/organizer → AuthService.updateOrganizerProfile → OrganizerProfileRepo.update → DB
```

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/profile | Bearer (any) | Full profile with organizer data |
| PATCH | /auth/profile | Bearer (any) | Update name, role, avatarUrl |
| PATCH | /auth/profile/organizer | Bearer (ORGANIZER) | Update businessName, description |

## 4. Business Rules

- Name must be 2–100 characters
- Avatar URL must be valid URL or empty string
- Organizer business name must be 2–100 characters
- Description max 500 characters
- Soft-deleted organizer profiles are excluded from response
- Auto-creates OrganizerProfile when role switches to ORGANIZER
- Email and phone are read-only on profile page
- PATCH /profile/organizer requires ORGANIZER role (403 otherwise)
- Profile query key invalidated on successful mutation

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User not found | NotFoundError (404) |
| Organizer profile soft-deleted | organizerProfile: null in response |
| TRAVELER hits /profile/organizer | ForbiddenError (403) |
| Name < 2 chars | Zod validation error (400) |
| Empty avatarUrl string | Allowed (clears avatar) |
| No changes made | Save button disabled |

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| NotFoundError | 404 | User or OrganizerProfile not found |
| ForbiddenError | 403 | Non-ORGANIZER hits /profile/organizer |
| ValidationError | 400 | Invalid name, URL, or business name |
| AuthError | 401 | Missing or invalid Bearer token |

## 7. Test Coverage

### Backend: `apps/api/tests/unit/services/auth.service.test.ts`

- **getFullProfile** (4 tests): traveler profile, organizer profile with fields, soft-delete exclusion, not-found
- **updateOrganizerProfile** (3 tests): happy path, not-found, logging
- **updateProfile** (7 tests): existing 6 + avatarUrl update

### Frontend: `apps/web/src/components/profile/__tests__/profile-page.test.tsx`

- **ProfilePage** (9 tests): skeleton loading, error state, traveler data, organizer data, save disabled, save enabled, successful save, save error, read-only fields
