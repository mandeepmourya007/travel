# Payment History — Feature Documentation

## 1. Overview

**What:** Paginated payment history with filters, summary stats, and role-based views.
**Who:** Traveler (own payments), Organizer (per-trip payments + commission), Admin (global view).
**Why:** Transparency — every user can see exactly what they paid/earned/refunded.

---

## 2. Data Flow

```
URL → Page (page.tsx)
  → Hook (use-payments.ts) → apiClient.get('/payments/...') → Query Key (paymentKeys.*)
    → PaymentHistoryController → PaymentHistoryService → PaymentTransactionRepository → DB
```

- **Filters** flow: PaymentFilters component → parent state → hook params → API query string → Zod validation → Prisma WHERE
- **Summary** flow: separate hook call → summary endpoint → aggregation queries

---

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/payments/my` | Any authenticated | Traveler's paginated payment list |
| GET | `/payments/my/summary` | Any authenticated | Traveler summary (totalPaid, totalRefunded, pending, count) |
| GET | `/payments/trip/:tripId` | ORGANIZER, ADMIN | Per-trip payments with traveler info |
| GET | `/payments/trip/:tripId/summary` | ORGANIZER, ADMIN | Trip summary with commission breakdown |
| GET | `/payments/admin` | ADMIN | Global payments with admin filters (userId, tripId, bookingRef) |
| GET | `/payments/admin/summary` | ADMIN | Global summary with commission totals |

All list endpoints accept: `type`, `status`, `fromDate`, `toDate`, `page`, `limit` as query params.

---

## 4. Business Rules

- Filters validated by Zod: `paymentHistoryFiltersSchema` / `adminPaymentFiltersSchema`
- Filter enums (`PAYMENT_TYPES`, `PAYMENT_STATUSES`) shared between FE dropdowns and BE validation
- `INITIATED` status displayed as "Pending" in UI (filter dropdown + status badge)
- Commission calculation: `netRevenue = totalRevenue - totalRefunded`, `platformCommission = netRevenue × (commissionRate / 100)`
- Default commission rate: 10% (from `OrganizerProfile.commissionRate`, fallback `DEFAULT_COMMISSION_RATE`)
- Organizer can only view their own trip payments (`verifyTripOrganizer` check)
- Pagination defaults: page=1, limit=20, max limit=50
- Refund amounts prefixed with `+` in green; payments shown in accent color
- All currency formatted with `formatCurrency()` helper (₹ + en-IN locale)

---

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User has zero payments | Empty state: "No payment transactions found." |
| Summary API fails | ErrorState with retry button (not raw `<p>`) |
| Organizer views another org's trip | ForbiddenError: "You can only manage your own trips" |
| Trip doesn't exist | NotFoundError: "Trip not found" |
| Zero revenue with commission calc | All financial fields return 0 (no NaN/negative) |
| Unknown status value | Badge shows raw string with neutral styling |
| Pagination on single page | Pagination controls hidden |
| All filters cleared | Resets to page 1, shows unfiltered data |

---

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| Unauthenticated | 401 | No Bearer token |
| Forbidden (wrong organizer) | 403 | Organizer accessing another org's trip |
| Not Found (trip) | 404 | Invalid tripId for organizer route |
| Validation (bad filter) | 400 | Invalid type/status/date in query params |
| Forbidden (wrong role) | 403 | Non-admin accessing /payments/admin |

---

## 7. Test Coverage

### Backend — `tests/unit/services/payment-history.service.test.ts` (18 tests)

| describe | Coverage |
|----------|----------|
| `getMyPayments` | Happy path, empty list, type filter passthrough, pagination offset |
| `getMyPaymentSummary` | Happy path, zero transactions |
| `getTripPayments` | Happy path (organizer), ForbiddenError (wrong org), NotFoundError (trip), ForbiddenError (no profile) |
| `getTripPaymentSummary` | Commission calculation, ForbiddenError, zero transactions |
| `getAllPayments` | Happy path, admin filters passthrough, empty list |
| `getGlobalSummary` | Summary with commission, zero transactions |

### Frontend — `components/payments/__tests__/` (42 tests)

| File | Coverage |
|------|----------|
| `payment-filters.test.tsx` (10) | Renders 4 controls, shows schema types/statuses, callbacks, clear button show/hide, clear resets all, reflects active values |
| `payment-transaction-list.test.tsx` (14) | 4-state (loading/error/empty/data), columns, showUser toggle, refund prefix, pagination show/hide/disabled/click |
| `payment-summary-cards.test.tsx` (8) | Traveler/Trip/Admin cards render labels, currency format, zero values, skeleton |
| `payment-badges.test.tsx` (10) | All 5 statuses with labels, all 3 types with labels, unknown value fallback |
