---
title: Data Fetching & State
created: 2026-07-10
type: permanent
tags:
  - codebase/web
  - state
  - react-query
---

# Data Fetching & State

## React Query

Configured in `apps/web/src/app/providers.tsx`: `staleTime: 60s`, `refetchOnWindowFocus: false`, query retry 2 (==no retry on 404==), mutations `retry: false`. Devtools dynamically imported in dev.

Server-side fetching via `src/lib/api-server.ts` — `fetchApi`, `fetchApiWithPagination`, `getPopularTripsForStaticParams`; native `fetch` with Next ISR (`revalidate`, `tags`), React `cache()` wrapping, slow-fetch logging. Used by SSR pages, `sitemap.ts`, `generateStaticParams`.

## Query Keys

`src/lib/query-keys.ts` — central ==`QK` const== of string segments (LIST, DETAIL, MY, ALL, ME, SEARCH, SUMMARY, HISTORY, TRIP, ORGANIZER, MINE, BOOKING, TRIP_STATUS, ADMIN, ORGANIZERS, BOOKINGS, CASHBACK, REVIEWS, TRANSACTIONS, INVITES, TRIPS, REQUESTS, ACTIVE, POPULAR, PUBLIC, DOC_REVIEW, BY_USER, BY_TRIP, CONVERSATIONS, MESSAGES, UNREAD, UNREAD_COUNT, FLAGGED, SEAT_MAP, ORGANIZER_SEAT_MAP, SIGNATURE, ALL_PENDING, MY_REQUESTS, ==RESELLER, MAIN_LINKS, SUBLINKS, LEADS, RESOLVE, RESELLERS==) plus typed `as const` factories:

| Factory | Keys |
| :--- | :--- |
| `tripKeys` | all / lists / list / details / detail / myTrips / searches / editHistory |
| `bookingKeys` | myBookings / mySummary / detail / myTripStatus / forTrip / tripSummary |
| `tripRequestKeys` | forTrip / myRequests / allPending |
| `destinationKeys` | list / popular / details / detail |
| `reviewKeys` | forTrip / myForBooking / organizerMine / myReviews |
| `paymentKeys` | myPayments / mySummary / tripPayments / tripSummary / adminPayments / adminSummary / organizerPayments / organizerSummary |
| `walletKeys` | balance / transactions / cashback |
| `chatKeys` | conversations / conversationList / messages / messageSearch / unreadCount / flagged |
| `vehicleKeys` | seatMap / organizerSeatMap / vehicle / vehicleList |
| `tripCategoryKeys` | active / admin / requests / myRequests |
| `adminKeys` | stats / organizers* / bookings* / cashback* / invites / trips / reviews / docReviewDetail / travellers* / organizerDirectory* |
| `notificationKeys`, `profileKeys`, `organizerKeys`, `uploadKeys`, `docReviewKeys` | list/unreadCount · me · stats/publicProfile · signature · comments |
| `resellerKeys` | organizerMainLinks / adminMainLinks / **myMainLinks** / mainLinkBookings / mySublinks / sublinkBookings / resolve / resellerSearch / organizerSearch |
| `leadKeys` | organizer / reseller / admin (each keyed by `ResellerLeadFilters`) |

> [!tip] Project Rule
> New query-key segments go in the `QK` object — ==never inline string literals== (root `CLAUDE.md` no-magic-strings rule; see [[Shared Package]]).

## Custom Hooks (`src/hooks/`, 60+ files, `use-*.ts`)

- **Trips**: `use-trips`, `use-trip-detail`, `use-trip-summary`, `use-create-trip`, `use-update-trip`, `use-delete-trip`, `use-publish-trip`, `use-my-trips`, `use-trip-categories`, `use-set-trip-visibility`, `use-toggle-bookings`, `use-compare-trips`, `use-compare-queue.tsx` *(context provider)*, `use-trip-bookings`, `use-trip-requests`, `use-create-trip-request`, `use-respond-request`
- **Bookings**: `use-create-booking`, `use-cancel-booking`, `use-my-bookings`, `use-my-booking-summary`, `use-my-trip-booking-status`, `use-my-pending-requests`, `use-all-pending-requests`
- **Payments/Wallet**: `use-payments`, `use-sync-payment`, `use-verify-payment`, `use-wallet`
- **Auth**: `use-google-auth`, `use-firebase-phone-auth`, `use-email-otp`, `use-otp`, `use-logout`
- **Admin**: `use-admin-bookings`, `use-admin-cashback`, `use-admin-chat`, `use-admin-invites`, `use-admin-organizers`, `use-admin-reviews`, `use-admin-stats`, `use-admin-trips`, `use-admin-set-trip-visibility`, `use-admin-toggle-trip-bookings`, `use-admin-travellers` (traveller directory + detail), `use-admin-organizer-directory` (organizer directory + trips-created detail)
- **Misc domain**: `use-destinations`, `use-destination-detail`, `use-organizer-public-profile`, `use-organizer-stats`, `use-reviews`, `use-profile`, `use-doc-review`, `use-chat`, `use-notifications`, `use-vehicle`, `use-sync-vehicles`, `use-cloudinary-upload`, `use-upload-signature`
- **Utilities**: `use-debounce`, `use-is-mobile`, `use-blocking-mutation`, `use-log-error`, `use-search-combobox`
- **Reseller**: `use-reseller.ts` — `useGenerateMainLink`/`useMainLinkBookings`/`useOrganizerLeads` (organizer), `useMyMainLinksAsReseller` (reseller's own active main links + earnings, `GET /reseller/main-links/mine`, powers the `/reseller` trip-card landing page), `useCreateSublink`/`useMySublinks`/`usePatchSublink`/`useSublinkBookings`/`useMyLeads` (reseller — `usePatchSublink` is wired into `ResellerLeadsTable`'s inline "Rate" pencil-edit, enabled only via that table's `canEditMarkup` prop on `/reseller`), `useAdminLeads` (admin), `useSublinkResolve(token)` (public, `enabled: !!token`, `retry: false`), `useRecordAttribution()` (authed, fire-and-forget). `useOrganizerMainLinks` (`GET /main-links`), `usePatchMainLink` (`PATCH /main-links/:mainLinkId`), and `useAdminMainLinks` (`GET /admin/main-links`) were removed as dead FE code — no page ever called them once the leads-table consolidation shipped; the `useOrganizerMainLinks` backend endpoint itself is untouched (still a legitimate, tested organizer read), but `patchMainLink`/`listMainLinksAdmin` were deleted from the service/controller/routes too since nothing called them anywhere. `use-resellers.ts` — `useResellerSearch`/`useOrganizerSearch` for the combobox pair, modeled on `use-my-trips.ts`'s search hooks.

## API Client

`src/lib/api-client.ts` — axios instance:
- `baseURL = NEXT_PUBLIC_API_URL || http://localhost:4001/api/v1`, timeout `API_TIMEOUT_MS` (15s), `withCredentials: true`.
- **Request interceptor** — adds `X-Request-Id`; attaches `Authorization: Bearer <accessToken>` from the auth store.
- **Response interceptor** — 401 refresh flow with a ==mutex (`refreshPromise`)== → `POST /auth/refresh` (skipped for auth endpoints). Confirmed 401: "Session expired" overlay, `clearAuth()`, redirect to `/login/email?returnTo=…` via `getAppRouter()`. Transient 5xx/network errors do **not** clear the session. Errors normalized to `AppApiError` (`code`, `subCode`, `status`, `details`); detects `SERVER_DOWN` / `REQUEST_TIMEOUT` / `REQUEST_CANCELLED` and updates the connection store.
- Helpers: `isAppApiError`, `getErrorMessage`.

Server-side uses `API_URL_INTERNAL || NEXT_PUBLIC_API_URL` (Docker-internal URL) — see [[Environment & Deployment#Environment Variables]].

## Zustand Stores (`src/store/`)

| Store | State |
| :--- | :--- |
| `auth.store.ts` | Session/user/token — persisted (`travel-auth`), ==accessToken NOT persisted== → [[Auth & Security#Frontend Session Model]] |
| `chat.store.ts` | Active conversation, online users (Set), typing users (Map), optimistic messages (Map), unread count |
| `connection.store.ts` | `isServerDown`, `lastFailedAt`, `markDown/markUp` |
| `loading.store.ts` | Global blocking loader (`isLoading`, `message`, `_pinned`, `epoch`) |
| `notification.store.ts` | Unread count + recent notifications |

**React Context**: `CompareQueueProvider` (`use-compare-queue.tsx`) for trip comparison, plus `ToastProvider` and `GoogleOAuthProvider` in `providers.tsx`.

Related: [[Web Frontend]] · [[Auth & Security]] · [[API Routes Reference]]
