---
title: Shared Package
created: 2026-07-10
type: reference
tags:
  - codebase/shared
  - constants
---

# Shared Package

**`@travel/shared`** at `packages/shared` — private workspace package consumed as ==raw TS source== (`main`/`types` → `./src/index.ts`, no build step, only dependency `zod`). Imported by both apps as `@shared/*`. Barrel `src/index.ts` re-exports `./types`, `./constants`, `./validators`, `./utils/refund`.

> [!tip] The No-Magic-Strings Rule
> Every domain value (role, status, sort field) lives here. Before adding a string: `grep -r "your-string" packages/shared/src/constants/` — import if found, add here if not. Pattern: readonly tuple (for `z.enum()`) + dot-access object + derived type. See root `CLAUDE.md`.

## Structure

| Folder            | Contents                                                                          |
| :------------------| :----------------------------------------------------------------------------------|
| `src/constants/`  | 15 files + barrel                                                                 |
| `src/types/`      | 19 files + barrel                                                                 |
| `src/validators/` | 16 Zod schema files                                                               |
| `src/utils/`      | `refund.ts` (root-exported), `slug.ts`, `organizer-docs.ts` (direct-path imports) |
| `src/theme/`      | `tokens.json` — design tokens consumed by Tailwind → [[Web Frontend#Styling]]     |

## Constants

| File | Exports |
| :--- | :--- |
| `roles.ts` | `USER_ROLES` (TRAVELER/ORGANIZER/ADMIN), `USER_ROLE`, `SIGNUP_ROLES`, ==`TRAVELER_ROLES` = [TRAVELER, ADMIN]== (admin impersonation), `DEFAULT_USER_NAME`, `DEFAULT_CUSTOMER_NAME` |
| `booking-status.ts` | `BOOKING_STATUSES` (PENDING_PAYMENT/CONFIRMED/CANCELLED/COMPLETED/REFUNDED/EXPIRED), `TRIP_REQUEST_STATUSES` (PENDING/APPROVED/REJECTED/EXPIRED/CONVERTED) + objects |
| `review.ts` | `REVIEW_MAX_PHOTOS=5`, `REVIEW_MAX_COMMENT_LENGTH=2000`, `REVIEW_MAX_REPLY_LENGTH=1000`, `REVIEW_EDIT_WINDOW_DAYS=30`, `REVIEW_SORT` (newest/oldest/rating_high/rating_low) + `REVIEW_SORTS`, `REVIEW_RATING_VALUES` |
| `trip-types.ts` | ~~`DEFAULT_TRIP_TYPES`~~ *(deprecated — DB-driven via TripCategory)*, `BOOKING_MODES` (INSTANT/REQUEST_BASED), `CANCELLATION_POLICIES` (FLEXIBLE/MODERATE/STRICT), `TRANSFER_POINT_TYPE` (PICKUP/DROP), `TRIP_STATUSES` (DRAFT/ACTIVE/FULL/COMPLETED/CANCELLED), ==`REQUEST_BASED_BOOKING_ENABLED` = `false`== *(temporary feature flag — gates `REQUEST_BASED` mode off in `createTripSchema` refine, web trip-form radio, and `trip.service.ts#updateTrip` mode-switch guard; flip back to `true` to fully restore, no other code changes needed)* |
| `verification-status.ts` | `VERIFICATION_STATUSES` (PENDING/APPROVED/REJECTED/REVISION_REQUIRED), `APPROVE_REJECT_ACTIONS` |
| `wallet.ts` | `WALLET_REFERENCE_MODELS` (Booking/AdminAction/WalletTransaction), `WALLET_TX` (CASHBACK/REFUND/BOOKING_DEDUCTION/ADMIN_CREDIT/ADMIN_DEBIT/PROMOTIONAL_CREDIT/EXPIRY) — canonical array lives in `types/wallet.types.ts` |
| `notification.ts` | `NOTIFICATION_TYPE` (==18 keys==), `NOTIFICATION_CHANNEL` (IN_APP/EMAIL/SMS/PUSH) |
| `vehicle.ts` | `SEAT_CELL_TYPE` (SEAT/DRIVER/EMPTY/BLOCKED), `SEAT_STATUS` (AVAILABLE/HELD/BOOKED/BLOCKED), `VEHICLE_TYPES` (sedan…bus/custom), `VEHICLE_ICONS`, `MAX_VEHICLE_PHOTOS=4`, `VEHICLE_GRID` (2–15 rows, 1–8 cols) |
| `upload.ts` | `MAX_UPLOAD_SIZE_BYTES` (5MB), `REQUIRED_DOC_COUNT=3`, `ALLOWED_UPLOAD_FOLDERS` (trips/itinerary-docs/vehicles/verification-docs), `DOC_TYPES` (aadhaarFront/aadhaarBack/panCard), `DOC_LABELS` |
| `payment.ts` | `PAYMENT_PROVIDERS` (razorpay/cashfree), `PAYMENT_TYPES` (PAYMENT/REFUND/ESCROW_RELEASE), `PAYMENT_STATUSES` (INITIATED/AUTHORIZED/CAPTURED/REFUNDED/FAILED) |
| `chat.ts` | `CHAT_SENDER_ROLES` (traveler/organizer/admin) |
| `sort.ts` | `SORT_ORDER` (asc/desc), `SORT_FIELD` (createdAt/status/amount) |
| `admin.ts` | `ADMIN_REVIEW_SORT_BY` (createdAt/overallRating/organizerName), `ADMIN_BOOKING_SORT_BY`, `ADMIN_TRIP_SORT_BY`, `ADMIN_TRAVELLER_SORT` (name/bookingsCount/joinedAt), `ADMIN_ORGANIZER_SORT` (name/tripsCount/joinedAt), `ADMIN_TRAVELLER_STATUS` (active/inactive, maps to `User.isActive`) — each with a `*_SORTS`/`*_BYS`/`*_STATUSES` tuple for `z.enum()` |
| `reseller.ts` | `RESELLER_LEAD_SORTS` (newest/oldest/bookings_desc/markup_desc) + `RESELLER_LEAD_SORT`, `RESELLER_MAX_MARKUP_AMOUNT` (100,000 rupees) |

## Types

19 files: `api-response.types` (==`ApiResponse<T>` envelope==, `ApiError` code/subCode, `PaginationMeta`), `auth.types` (DTOs, `JwtPayload`), `user.types` (profiles, `OrganizerDocuments`, bank DTOs), `trip.types` (`TripSummary`/`TripDetail`, itinerary, transfer points, filters, DTOs, `OrganizerStats`), `booking.types`, `trip-request.types` (derives `TripRequestTraveler` from a validator — ==types↔validators cross-wired==), `destination.types`, `notification.types`, `review.types` (5 rating dimensions), `payment.types`, `wallet.types` (canonical `WALLET_TRANSACTION_TYPES`, `CREDIT_TYPES`/`DEBIT_TYPES`), `chat.types` (incl. full `ChatSocketEvents` map + runtime consts `CONVERSATION_TYPE`, `MESSAGE_TYPE`, `CONVERSATION_STATUS`), `admin.types` (doc review, approvals, platform stats, cashback, invites, traveller/organizer directory list + detail), `organizer.types` (public profile — ==not in the barrel==), `vehicle.types` (layout/seat-map/templates), `trip-category.types`, `upload.types` (`CloudinarySignature`), `reseller.types` (`ResellerMainLinkDto`/`ResellerSublinkDto`/`ResellerLeadRow`, filter types, `ResolvedSublinkDto`, combobox search result types, generic `PaginatedResult<T>`, `ResellerMainLinkWithEarningsDto` — a reseller's own main link + `tripPhoto` + sum-of-sums `totalMarkupAmount` + `organizerName` (organizer's `businessName`, for the `/reseller` trip-card landing page), for `GET /reseller/main-links/mine` — and its `MyMainLinksFilters`). `ResellerLeadRow` carries both `organizerId` and `organizerName: string` (the organizer's `OrganizerProfile.businessName`, joined through `ResellerSublink.mainLink.organizer` in `ResellerRepository.getLeads()`) — the latter feeds the "Organizer" identity column on the reseller-facing leads table.

## Validators (Zod)

| File | Highlights |
| :--- | :--- |
| `common.schema.ts` | ==`idSchema` accepts cuid AND UUIDv7== (never `z.string().uuid()`), param schemas (incl. `travellerIdParamSchema`, `organizerIdParamSchema`, `mainLinkIdParamSchema`, `sublinkIdParamSchema`), `paginationSchema` (page ≥1, limit 1–50 default 20) |
| `auth.schema.ts` | `INDIAN_PHONE_REGEX`, signup (password complexity), login, OTP (4-digit), Firebase verify, Google, organizer docs/profile, `connectBankAccountSchema` (IFSC + PAN regex), invites |
| `booking.schema.ts` | `travelerDetailSchema`, create booking/trip-request (both carry an optional `sublinkToken` for reseller attribution — never a price field), filters, cancel, `verifyPaymentSchema` |
| `reseller.schema.ts` | Main link create/patch/filters, **`myMainLinksFiltersSchema`** (reseller's own `GET /reseller/main-links/mine` filters — `tripId` only; `resellerId` is always the caller, never a query param), sublink create/patch/filters (`markupAmount` capped at `RESELLER_MAX_MARKUP_AMOUNT`), leads filters (`sort` enum), public `sublinkTokenParamSchema`, `recordAttributionSchema`, reseller/organizer combobox search query schemas |
| `trip.schema.ts` | create/update trip with ==cross-field refines== (end>start, max≥min group, early-bird price/deadline), itinerary/activity/transfer-point nesting, `datetimeString`, visibility/toggle schemas, filters |
| `trip-category.schema.ts` | UPPER_SNAKE_CASE category value, trip-type request workflows |
| `destination.schema.ts` | CRUD + `DESTINATION_TRIP_SORTS` |
| `review.schema.ts` | 5 rating fields, photo/comment caps, reply, filters |
| `payment.schema.ts` | History filters with date-range refines, `ORGANIZER_PAYMENT_SORT_FIELDS` |
| `wallet.schema.ts` | Filters, `adminWalletActionSchema` (positive integer rupees) |
| `chat.schema.ts` | `CHAT_MAX_MESSAGE_LENGTH=2000`, `CHAT_MAX_FILE_SIZE=10MB`, `sendMessageSchema` (==`clientMsgId` idempotency==), cursor-paginated message filters |
| `notification.schema.ts` | Filters (`unreadOnly` preprocess), mark-read params |
| `vehicle.schema.ts` | Layout refines: ==exactly 1 driver + ≥1 seat==, grid-dimension consistency, driver-position bounds; `selectSeatsSchema` |
| `admin.schema.ts` | Approval/booking/trip/cashback/review filters, doc review, invites, `adminTravellerFiltersSchema`, `adminOrganizerDirectoryFiltersSchema` (search/sort/status, defaults `sortBy=joinedAt` `sortOrder=desc`) |
| `upload.schema.ts` | `uploadSignatureSchema` (folder enum) |

## Utils

- **`refund.ts`** *(root-exported)* — `calculateRefundPercent(policy, hoursUntilTrip)`, `estimateRefund` → [[Product Domain#Refund Policy Matrix]]. Tested in `refund.test.ts`.
- **`slug.ts`** — `generateSlug`, `slugify`, `generateTripSlug(title, startDate)`, `deslugify`.
- **`organizer-docs.ts`** — `getDocCount`, `areDocsComplete` (vs `REQUIRED_DOC_COUNT=3`).

## Known Inconsistencies

> [!warning] Drift to Fix
> 1. `NotificationType` union in `notification.types.ts` has ==16 members== — missing `DOCUMENT_REUPLOAD_REQUIRED` and `WALLET_CREDIT_EXPIRING` present in the constant (18) and Prisma enum (20).
> 2. `organizer.types.ts` is **not exported** from the `types/index.types.ts` barrel (direct-path imports only).
> 3. `docs/PROJECT_REFERENCE.md` §3 undercounts shared files (9/14/17 vs actual 14 constants / 15 validators / 18 types) — stale.
> 4. `index.schema.ts` in validators is an empty file.

Related: [[Codebase Overview]] · [[API Backend]] · [[Web Frontend]] · [[Database Schema]]
