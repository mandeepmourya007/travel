---
title: Web Frontend
created: 2026-07-10
type: permanent
tags:
  - codebase/web
  - frontend
---

# Web Frontend

Package **`@travel/web`** at `apps/web`. ==Next.js 15.5 App Router== (RSC on, `output: 'standalone'`, `reactStrictMode`), **React 19.2**, TypeScript ~5.5. Dev runs with `--turbopack`.

## Key Dependencies

| Concern       | Library                                                                                                        |
| :--------------| :---------------------------------------------------------------------------------------------------------------|
| Data          | `@tanstack/react-query` ^5.50, `axios` ^1.7 → [[Data Fetching & State]]                                        |
| State         | `zustand` ^4.5                                                                                                 |
| UI            | Radix primitives via shadcn/ui, `lucide-react`, `cmdk`, `embla-carousel-react`, `recharts`, `react-day-picker` |
| Forms         | `react-hook-form` ^7.75 + `@hookform/resolvers` + `zod` (schemas from [[Shared Package]])                      |
| Styling       | Tailwind 3.4, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`                      |
| Auth/Realtime | `@react-oauth/google`, `firebase` ^12 (phone auth), `socket.io-client` ^4.8                                    |
| Observability | `@sentry/nextjs` ^10 (tunnel `/monitoring`)                                                                    |

## next.config.js Behaviors

- **Custom image loader** `src/lib/image-loader.ts` — Cloudinary/Unsplash CDN transforms, bypasses `sharp`. Allowed hosts in `src/config/image-hosts.js`.
- **API reverse proxy** — when `BACKEND_API_URL` is set, rewrites `/api/:path*` → backend (keeps the refresh cookie same-site; used on Render, not Docker/local).
- Global security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy.
- Sentry webpack plugin only when `SENTRY_AUTH_TOKEN` present (OOM mitigation).

## Component Organization (`src/components/`)

Feature folders, kebab-case filenames, PascalCase exports, tests co-located in `__tests__/`.

| Folder | Contents |
| :--- | :--- |
| `ui/` (28) | shadcn/ui, style **new-york**, base color neutral, `cssVariables: false` |
| `shared/` (38) | `auth-guard`, `role-guard`, toasts, modals, pagination (`pagination.tsx`'s `Pagination` supports an **opt-in page-size selector** — pass `limit`/`onLimitChange` (optionally `limitOptions`, default `[10, 25, 50, 100]`) to render a "X per page" native `<select>` next to the page controls; omitting them renders exactly as before for every existing caller. Only wired for the `onPageChange` callback variant — passing `limit`/`onLimitChange` alongside `buildHref` logs a dev-only warning and is otherwise ignored, since URL-based pagination would need each caller's own URL-param plumbing. `Pagination` does not own page state — the caller's `onLimitChange` handler must reset the page back to 1 itself. Wired into `ResellerLeadsTable`'s pass-through `onLimitChange` prop and used by all three reseller leads pages (`/admin/reseller-links`, `/dashboard/reseller-links`, `/reseller`), each with a local `leadsLimit` state, default 50), date/phone/email inputs, star ratings, `blur-image`, lightbox, loaders/overlays, `route-progress`, `server-down-banner`, `socket-connector`, `chunk-error-reload` (mounted in `Providers`; reloads once on a stale post-deploy webpack chunk error — `unhandledrejection` for "reading 'call'"/`ChunkLoadError`, session-guarded against reload loops; defers the reload while `queryClient.isMutating() > 0` so it never cancels an in-flight user-initiated mutation like Request to Book), `login-required-dialog`, `data-states`, `price-range-slider`, `search-combobox` (`SearchCombobox` — generic search dropdown, purely presentational: renders `options`/`isLoading` and an **infinite-scroll** results list — no pagination footer. Takes `hasMore`/`onLoadMore`/`isLoadingMore`; the results `<ul>`'s `onScroll` fires `onLoadMore()` once scrolled within 40px of the bottom, guarded so it never double-fires while a fetch is in flight. `allOptionLabel` row always renders at the top when provided — there's no more "page 1 only" gating since the list is a single accumulated feed, not discrete pages), `trip-search-combobox` (`TripSearchCombobox`/`TravelerTripSearchCombobox`/`AdminTripSearchCombobox`), `reseller-search-combobox` (`ResellerSearchCombobox`/`OrganizerSearchCombobox` — same thin-wrapper-over-`search-combobox` pattern). All five wrappers share ONE accumulation implementation — `accumulate()` returned by `useSearchCombobox()` (`src/hooks/use-search-combobox.ts`): `page` means "highest page fetched so far" (starts at 1), `loadMore()` increments it, `accumulate(items, pagination, isFetching)` concatenates each newly-fetched page onto the running list (tracked via a ref keyed on the last-appended page number, so a query-change refetch of page 1 replaces rather than double-appends) and derives `hasMore`/`isLoadingMore` (`isLoadingMore` is only true once `page > 1`, so the first-page fetch still uses the input-level `isLoading` spinner, not the bottom-of-list one). Do not reimplement this per wrapper — extend `useSearchCombobox`/`accumulate` instead. **Convention: combobox `meta` (the secondary text next to a row's label) must never render PII (e.g. email) — `reseller-search-combobox.tsx` intentionally shows reseller/organizer name only, no email; `trip-search-combobox.tsx`'s `meta: destination.name` is fine since it isn't PII.** … |
| `layout/` | `app-shell`, `header` (conditional "Reseller" nav link when `useProfile().data?.isReseller`), `footer`, `mobile-bottom-nav` (same conditional Reseller item appended to `TRAVELER_NAV`) |
| `trips/` (24) | incl. `trip-form/` — 10-file multi-tab trip builder. `trip-booking-card`/`trip-sticky-book-bar` accept an optional `markupAmount` prop (reseller sublink markup) folded invisibly into the displayed `pricePerPerson`/`earlyBirdPrice` — **no visible "reseller fee"/markup UI is ever rendered to the traveler**; the markup must look like an ordinary price. |
| `booking/` (5) vs `bookings/` (7) | ==singular = booking flow, plural = my-bookings views==. `bookings/my-booking-card.tsx` handles both Razorpay (modal) and Cashfree (redirect) checkout from the "Pay Now" button on existing pending bookings. `booking/price-summary.tsx` and `booking/traveler-form.tsx` both accept `markupAmount` and fold it into the single "Base price" row/total — deliberately no separate "Reseller fee" line, since travelers must never see the markup broken out (organizer/reseller/admin views like `reseller-booking-list.tsx` still show the full breakdown). |
| `chat/` (11), `vehicle/` (8) | both with `index.ts` barrels; vehicle = seat-map builder |
| `admin/` (7) | recharts dashboards |
| `dashboard/` (7 + `trip-users/` 6) | organizer views + participant management |
| `reseller/` (4) | `reseller-booking-list.tsx` — the "bookings via this link" table shared across the organizer/reseller/admin reseller pages. **Not** `PaymentTransactionList`: `GET /reseller/{main-links,sublinks}/:id/bookings` return raw `Booking` rows (`bookingRef`/`numTravelers`/`totalAmount`/`markupAmount`/`bookingStatus`/`user`), not `PaymentHistoryItem` rows, so the existing payment-list component's prop shape doesn't fit. Each row also carries a server-derived `refundStatus: ResellerBookingRefundStatus \| null` (values `'PENDING'`/`'REFUNDED'`, from `RESELLER_BOOKING_REFUND_STATUS` in `packages/shared/src/constants/reseller.ts`; `BookingRow` in `use-reseller.ts`, matching `ResellerBookingRowDto`) — the component never re-derives refund state itself, just renders a second badge next to the existing `bookingStatus` badge (both the mobile card and desktop table status cells): `badge-success` "Refunded" when `'REFUNDED'`, `badge-warning` "Refund Pending" when `'PENDING'`, no second badge otherwise (including a CANCELLED booking with nothing owed). `reseller-leads-table.tsx` (`ResellerLeadsTable`) — the shared flat leads table, one row per sublink, reused verbatim by `/admin/reseller-links` and `/dashboard/reseller-links` (organizer/admin views deliberately keep this flat-table UI; **`/reseller` no longer uses it** — see below). Props: `leads: ResellerLeadRow[]`, `identityColumn?: 'reseller' \| 'organizer' \| null`, `isLoading`/`error`/`onRetry`, `onViewBookings: (sublinkId: string) => void`. Purely read-only — the markup-rate edit affordance (`canEditMarkup` prop + "Edit Markup Rate" modal) was removed since it was unreachable from either caller. Columns: identity (if any) → Trip Name → Booking Count → Earnings → Link (copy) → Views (`useSublinkBookings` + `Modal` + `ResellerBookingList` drill-down). `reseller-trip-card.tsx` (`ResellerTripCard`/`ResellerTripCardSkeleton`) — **new**, `/reseller`-page-only: one card per `ResellerMainLinkWithEarningsDto` row (trip photo/title, `organizerName`, sublink/booking counts, `totalMarkupAmount`, "View Links"/"Generate Link" actions), visually mirroring `dashboard/trip-list-card.tsx`'s thumbnail+info card convention. `reseller-sublinks-drilldown.tsx` — **new**, `/reseller`-page-only: exports `GenerateLinkModal` (simplified sublink-creation modal, no trip picker — the main link is always known from context; reused by both `/reseller/page.tsx`'s card-triggered flow and this file's own drill-in trigger) and `ResellerSublinksDrilldown` (the "Links for [Trip Name]" `Modal` — one main link's sublinks via `useMySublinks({ mainLinkId })`, with its own edit-rate modal, and its own per-sublink bookings-view modal via `useSublinkBookings` + `ResellerBookingList`). Both modals' ₹ markup-amount fields use the shared `NumberInput` component (`@/components/shared/number-input`) instead of a native `<input type="number">`. |
| `home/` | `hero-search-form.tsx` (`HeroSearchForm`) — the standalone "Where do you want to go?" input + Search button, rendered directly at the top of `app/page.tsx` (no headline/badges above it) inside a thin section wrapper; pushes to `/trips?q=…`. `welcome-modal.tsx` (`WelcomeModal`, client component) — renders the old hero marketing copy (`HERO_COPY`/`HERO_TRUST_BADGES` from `home-content.ts`) inside the shared `Modal`, gated by a `sessionStorage` flag (`home_welcome_seen`) so it opens once per session, auto-closes after 3s via `setTimeout`, and can be dismissed early via the Modal's ✕/backdrop/Escape (all wired through one `onClose` that also clears the timer). `hero-section.tsx` was retired — its whole-block header/paragraph/badges no longer render inline on the page. `how-it-works.tsx` now renders last (bottom of the page) instead of near the top. |
| `auth/` | Login/signup form building blocks — `phone-input-form.tsx` (`PhoneInputForm`, accepts an `onSubmit` override that replaces its default public `useSendOtp` call), `otp-verify-form.tsx` (`OtpVerifyForm`, 4/6-digit boxes + resend countdown), `google-auth-section.tsx`, `onboarding-form.tsx`. `phone-verification-flow.tsx` (`PhoneVerificationFlow`) — the reusable "attach + verify phone" wiring for the optional, account-level profile CTA (**not** the mandatory gate — that has been retired): owns the `'phone'\|'otp'` step state, composes `PhoneInputForm`/`OtpVerifyForm` against the *attach* hooks (`use-attach-phone.ts`, never the public login OTP hooks), used by `profile/verify-phone-cta.tsx`'s modal (`onCancel` closes it). |
| `booking/` | `booking-contact-verification-flow.tsx` (`BookingContactVerificationFlow({ bookingId, onComplete })`) — the mandatory, booking-scoped, non-dismissible (no `onCancel`) contact-verification step shown after a booking payment succeeds → [[Auth & Security#Booking Contact Verification (Frontend)]]. `booking-success.tsx` gained a `showActions?: boolean` prop (default `true`) that gates its "View My Bookings"/"Chat with Organizer" CTAs. |
| `destinations/`, `payments/`, `wallet/`, `profile/`, `reviews/`, `notifications/` | per-feature. `profile/verify-phone-cta.tsx` (`VerifyPhoneCta`) — button + `Modal` wrapping `PhoneVerificationFlow`, rendered from `edit-user-profile-form.tsx`'s read-only phone block only when `!profile.phoneVerified`; on success invalidates `profileKeys.me()` so `profile-header.tsx`'s "Phone Verified" badge flips without a refresh. This is an optional, account-level convenience, unrelated to the mandatory booking-contact flow above. |

## Styling

- Tailwind `darkMode: 'class'`; design tokens imported from ==`packages/shared/src/theme/tokens.json`==.
- Palette: `primary` teal (500 = `#0FBAB5`), `accent` coral `#FF4F33`, `highlight` violet `#7C4DFF`, full neutral scale + success/warning/error/info.
- Fonts via `next/font/google` as CSS vars: Inter (`sans`), Plus Jakarta Sans (`display`), JetBrains Mono (`mono`).
- `globals.css` defines RGB CSS vars (`--color-primary: 15 186 181`) and component classes (`.btn-outline`, `.spinner`) in Tailwind layers.
- Custom animations: shimmer, pop, slide-up/down, page-enter, shake, toast-exit, accordion.

## `src/lib/` Utilities

| File | Purpose |
| :--- | :--- |
| `constants.ts` | `APP_NAME` (Safarnama), `SITE_URL`, legal contacts, `API_TIMEOUT_MS`, `STALE_TIME_*`, `REFETCH_INTERVAL_*`, ==`getHomeRoute(role)`== (ADMIN→`/admin`, ORGANIZER→`/dashboard`, else `/trips`), `ONBOARDING_ROUTE`, and `getPostAuthRoute({ isNewUser, user, returnTo })` — the single choke point every login/signup success handler routes through → [[Auth & Security#Frontend Guards]]. ==`VERIFY_PHONE_ROUTE` has been removed== along with the mandatory login-time phone gate. |
| `api-client.ts` / `api-server.ts` | Client axios + server fetch → [[Data Fetching & State#API Client]] |
| `query-keys.ts` | `QK` segments + typed key factories → [[Data Fetching & State#Query Keys]] |
| `structured-data.ts` | JSON-LD builders (below) |
| `home-content.ts` / `legal-content.ts` | Single source of truth for home & legal copy |
| `utils.ts` | `cn` (clsx + tailwind-merge) |
| `format.ts`, `logger.ts` (`feLogger`) | Formatting, FE logging |
| `socket.ts`, `firebase.ts` | Socket.IO client, Firebase phone auth init |
| `cashfree.ts`, `razorpay.ts` | Payment SDK loaders → [[Payments & Webhooks#Frontend Side]] |
| `app-router.ts` | Module-level router ref so the axios interceptor can navigate |
| `notification-icons.ts` / `notification-redirect.ts` | Notification type → icon / redirect URL |
| `admin-utils.ts`, `organizer-utils.ts`, `trip-utils.ts`, `booking-errors.ts`, `overlay-stack.ts` | Domain helpers. `trip-utils.ts` adds `getEffectivePriceWithMarkup(trip, markupAmountPerPerson)` = `getEffectivePrice(trip) + markup`, display-only (server always recomputes authoritatively). |
| `reseller-cookie.ts` | `getResellerRefCookie()`/`setResellerRefCookie(token)` — plain `document.cookie` read/write (no cookie library in this repo) for the non-HttpOnly `reseller_ref` cookie (~30d, `SameSite=Lax`), the fallback token source when `?ref` is absent (refresh, nav, post-login redirect). Carries only an opaque sublink token, never a price. |

## SEO

- Root `layout.tsx`: `metadataBase`, title template `%s | Safarnama`, keywords, Twitter card, robots directives, Google site verification.
- Private layouts set ==`robots: { index: false, follow: false }`== — all `(auth)`, `admin`, `dashboard`, `messages`, `my-*`, `profile`, `wallet`, `payment-complete`.
- `robots.ts` — disallows private paths; ==explicitly allows AI crawlers== (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …).
- `sitemap.ts` — static pages + dynamic trips/destinations/organizers from `GET /api/v1/sitemap-data` (revalidate 3600).
- `manifest.ts` — PWA manifest (theme `#0FBAB5`, `en-IN`).
- **JSON-LD builders** (`structured-data.ts`): `buildTripJsonLd` (TouristTrip + AggregateOffer + reviews), `buildDestinationJsonLd` (TouristDestination), `buildOrganizerProfileJsonLd` / `buildOrganizationJsonLd` (Organization), `buildWebsiteJsonLd` (WebSite + SearchAction), `buildBreadcrumbJsonLd`, `buildItemListJsonLd`, `buildFaqJsonLd`.

> [!note] Auth Is Client-Side
> There is **no `middleware.ts`** — private routes render a spinner then redirect via guard components. See [[Auth & Security#Frontend Guards]].

Related: [[Frontend Routes Reference]] · [[Data Fetching & State]] · [[Auth & Security]] · [[Shared Package]]
