# Pending Requests Page

## 1. Overview

- **What:** Cross-trip pending requests dashboard at `/dashboard/requests`
- **Who:** Organizers (ORGANIZER role only, behind AuthGuard + RoleGuard)
- **Why:** Allows organizers to view and act on all pending trip requests in one place instead of navigating into each trip individually

## 2. Data Flow

```
/dashboard/requests
  → useAllPendingRequests (queryKey: tripRequestKeys.allPending)
    → GET /trips/organizer/pending-requests
      → TripController.getAllPendingRequests
        → TripService.getAllPendingRequests(userId)
          → OrganizerProfileRepo.findByUserId → verify organizer
          → TripRequestRepo.findAllPendingForOrganizer(organizerId)
            → Prisma: tripRequest.findMany(status=PENDING, trip.organizerId)
  → FE groups flat array by trip.id → renders per-trip sections

Approve/Reject:
  → useRespondToRequest (existing mutation)
    → PATCH /trips/:tripId/requests/:requestId
    → Invalidates: tripRequestKeys.all, bookingKeys.tripSummary, organizerKeys.stats
```

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/organizer/pending-requests` | ORGANIZER | All pending requests across organizer's trips |
| PATCH | `/trips/:tripId/requests/:requestId` | ORGANIZER | Approve/reject a request (existing) |

## 4. Business Rules

- Only PENDING requests are returned (no pagination — low volume by nature)
- Organizer profile must exist or ForbiddenError is thrown
- Deleted trips and deleted requests are excluded (`isDeleted: false`)
- Results ordered by `createdAt desc` (newest first)
- Approve sets `approvalExpiresAt` = now + 48h (handled by existing `respondToTripRequest`)
- Reject requires a rejection reason (enforced by `RequestActionModal`)
- Capacity check on approve is handled by existing service logic

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Organizer has no pending requests | EmptyState: "No pending requests. You're all caught up!" |
| Organizer profile doesn't exist | 403 ForbiddenError |
| All trips deleted | Empty array returned (soft-delete filter) |
| Request approved from this page | Request disappears from list, stats count decrements |
| Concurrent approve from another tab | TanStack Query refetch on window focus shows updated state |

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| ForbiddenError | 403 | Organizer profile not found |
| NotFoundError | 404 | Trip or request not found (on respond) |
| ValidationError | 400 | Request not PENDING, or not enough seats (on approve) |
| AuthError | 401 | Not authenticated |

## 7. Test Coverage

**BE:** `apps/api/tests/unit/services/trip-users.service.test.ts`
- `describe('getAllPendingRequests')` — 3 tests:
  - Happy path: returns requests with trip context
  - Empty: returns `[]` when no pending requests
  - Auth: throws ForbiddenError when profile not found

**FE Components reused (tested in their own files):**
- `RequestCard` — participant-card tests
- `RequestActionModal` — request-action-modal tests
- `ErrorState`, `EmptyState` — data-states tests
