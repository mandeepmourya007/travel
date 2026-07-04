# Reviews Management — Feature Documentation

## 1. Overview

**What:** Three dashboard pages for managing reviews across roles — organizer review inbox, traveler review history, and admin review table.
**Who:** Organizers (`/dashboard/reviews`), Travelers (`/my-reviews`), Admins (`/admin/reviews`).
**Why:** Closes the review lifecycle loop — organizers can reply inline, travelers can edit within the 30-day window, admins have full visibility for moderation.

## 2. Data Flow

```
/dashboard/reviews (organizer)
  → useOrganizerReviews(filters)   → GET /api/v1/reviews/organizer/mine  → ReviewController.getOrganizerReviews → ReviewService.getOrganizerDashboardReviews → ReviewRepository.findByOrganizerIdWithFilters → DB

/my-reviews (traveler)
  → useMyReviews(filters)          → GET /api/v1/reviews/my              → ReviewController.getMyReviews → ReviewService.getMyReviews → ReviewRepository.findAllByUserId → DB

/admin/reviews (admin)
  → useAdminReviews(filters)       → GET /api/v1/admin/reviews           → AdminController.getAdminReviews → AdminService.getAdminReviews → ReviewRepository.findAllAdmin → DB
```

## 3. API Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/reviews/organizer/mine` | Required | ORGANIZER | Paginated reviews across all organizer's trips |
| GET | `/api/v1/reviews/my` | Required | Any | Paginated reviews written by the authenticated user |
| GET | `/api/v1/admin/reviews` | Required | ADMIN | All platform reviews with search/filter/sort |

### Query Parameters — Organizer endpoint
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `tripId` | string | — | Filter by specific trip (idSchema) |
| `rating` | number | — | Filter by exact rating (1–5) |
| `sort` | `newest\|oldest\|rating_high\|rating_low` | `newest` | Sort order |
| `page` | number | 1 | Pagination |
| `limit` | number | 10 | Max 50 |

### Query Parameters — Admin endpoint
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `organizerSearch` | string | — | Debounced partial match on `displayName` |
| `tripSearch` | string | — | Debounced partial match on `title` |
| `rating` | number | — | Filter by exact rating (1–5) |
| `sortBy` | `createdAt\|overallRating\|organizerName` | — | Column to sort |
| `sortOrder` | `asc\|desc` | `desc` | Sort direction |
| `page` / `limit` | number | 1 / 10 | Pagination |

## 4. Business Rules

- **Organizer isolation:** `findByOrganizerIdWithFilters` always includes `trip: { organizerId }` in the WHERE clause — an organizer cannot see reviews for another organizer's trips even if they pass an arbitrary tripId.
- **Edit window:** Travelers can edit a review only within `REVIEW_EDIT_WINDOW_DAYS` (30 days) of `createdAt`. The Edit button is hidden after the window.
- **Admin sort — organizerName:** Sorted via Prisma nested relation `{ trip: { organizer: { displayName: sortOrder } } }` — no client-side sort.
- **TravelerReviewFilters alias:** `travelerReviewFiltersSchema` is an alias for `reviewFiltersSchema` — no duplicate schema needed since travelers filter only by date/rating sort.

## 5. Edge Cases

- **No organizer profile:** `getOrganizerDashboardReviews` throws `ForbiddenError` when the user has no organizer profile row (e.g., role assigned but profile not created yet).
- **Empty filter results:** All three pages show a context-aware `EmptyState` (e.g., "No reviews match your filters" vs. "You haven't written any reviews yet").
- **Simultaneous searches (admin):** `organizerSearch` and `tripSearch` both filter on the `trip` relation. The repo builds a single `tripWhere` object combining both conditions to avoid Prisma duplicate-key errors.
- **Review edit after modal close:** `useMyReviews` uses `staleTime: STALE_TIME_REALTIME` so the list refreshes after the `ReviewFormModal` invalidates the query on submit.

## 6. Error States

| Scenario | HTTP | UI |
|----------|------|----|
| No organizer profile | 403 | Redirect to dashboard (ForbiddenError) |
| Invalid tripId format | 400 | Zod validation rejects before DB hit |
| Rating out of range | 400 | Zod coerce + min/max |
| Unauthenticated | 401 | Auth middleware redirects to login |
| DB error | 500 | ErrorState with Retry button |

## 7. Tests

### Backend — `review.service.test.ts`
- `getOrganizerDashboardReviews` — happy path, tripId+rating filter forwarded, ForbiddenError when no organizer profile, empty result set
- `getMyReviews` — happy path, empty list, sort filter forwarded to repo

### Backend — `admin.service.test.ts`
- `getAdminReviews` — default filters, search filters passed to repo, empty result set

### Key assertions
- Organizer service resolves organizer profile before calling repo (ForbiddenError path tested)
- `paginate()` skip/take passed correctly (verified via repo mock call args)
- `pagination` meta included in service return value
