# TripCompare Product Audit — Planned vs Built vs Proposed

> Audited: 2026-06-12 @ commit `9a9c643`. Proposals are filtered against `docs/mvp/mvp-plan.md` and `docs/rnd/` so nothing already planned is re-proposed.

## Step 1 — What the planning docs already cover (do NOT re-propose)

**`docs/rnd/viral-features-rnd.md`** covers 10 features with a priority matrix: (1) Price Drop Engine (tiered group pricing + auto-refund), (2) TripShield platform guarantee, (3) Solo→Squad buddy matching (vibe quiz, "Who's Going", pre-trip group chat), (4) Transparent Price Breakdown, (5) Safety Beacon (SOS, emergency contacts, live tracking), (6) Trip Replay (post-trip photo wall), (7) Referral Chain (3-level cascading squad discount), (8) Organizer Trust Score (multi-dimensional 0-100), (9) "Last 3 Seats" FOMO notifications + push for saved/viewed trips, (10) Trip Expense Tracker (built-in Splitwise).

**`docs/mvp/mvp-plan.md`** — besides the shipped tracker, its "⬜ Not Started — Viral & Differentiator" section (lines 1317-1598) plans: Destination Pages, Organizer Public Profile (marked done), **Wishlist/Save Trips** (incl. "price dropped / 2 seats left" notifications on saved trips), Transparent Price Breakdown, Local Intel, Solo→Squad, Trip Replay, Trust Score. Tech-stack table also names "PostgreSQL full-text search (MVP)… Algolia later" and the Page 4 wireframe includes a "Similar Trips" section — both **planned but never built**. "Organizer analytics dashboard" is explicitly deferred ("Not needed until 50+ organizers", line 29).

**`docs/rnd/local-intel-rnd.md`** — full design for community destination tips (categories, upvotes, comments, moderation, leaderboard, SEO pages). **`docs/rnd/group-travel-market-research.md`** — market/leakage strategy, escrow, portable reputation, trip protection.

**Doc-staleness finding:** mvp-plan lists Destination Pages as "Not Started", but they're shipped — SSR + JSON-LD + OG at `apps/web/src/app/destinations/[slug]/page.tsx` (confirms `fetchApi('/destinations/slug/:slug')`, `generateMetadata`, `buildDestinationJsonLd`).

## Step 2 — Ground truth: built vs stubbed (file-verified)

| Area | Status | Evidence |
|---|---|---|
| **Reviews** | **Fully built** — multi-dim ratings (overall + organization/value/safety/accuracy), photos, organizer replies | `Review` model has 5 ratings, `photos String[]`, `organizerReply/organizerReplyAt` (`apps/api/prisma/schema.prisma:541-569`); `review.service.ts` has `createReview` (photos at :57), `updateReview`, `addOrganizerReply` (:128), `recalculateOrganizerRating`. Photo upload **is wired**: `apps/web/src/components/bookings/review-form-modal.tsx` uses `useCloudinaryUpload`, `REVIEW_MAX_PHOTOS`, lightbox |
| **Organizer verification** | **Built and surfaced** | `VerificationStatus` (PENDING/APPROVED/REJECTED/REVISION_REQUIRED) + per-document `DocumentReview` workflow (schema:19-30, 249-280). Verified badge shown on trip cards (`apps/web/src/components/trips/trip-card.tsx:120`), `trip-organizer-card.tsx:36`, `trip-detail-header.tsx:198`, `trip-comparison-table.tsx:94`, `organizer-profile-header.tsx:24` |
| **Notifications** | **IN_APP + EMAIL real; SMS + PUSH are stubs; 2 notification types are dead** | In-app: DB + Socket.IO provider; Email: Nodemailer + 7 templates. `apps/api/src/providers/push-notification.provider.ts` and `sms-notification.provider.ts` log a warning and return `success: false` ("Replace with FCM/Twilio when ready"). `TRIP_REMINDER` and `REVIEW_REQUEST` exist in the `DEFAULT_CHANNELS` map (`notification.service.ts:16-17`) but **nothing ever sends them** (grep: zero trigger sites). No service worker, no `public/` dir, no manifest in `apps/web` — zero web-push/PWA footing |
| **Wallet** | **Refunds + admin cashback real; `PROMOTIONAL_CREDIT` & `EXPIRY` are dead enum values** | `WalletTransactionType` (schema:168-176); zero references to `PROMOTIONAL_CREDIT`/`EXPIRY` in `apps/api/src` outside the enum. Cashback is 100% manual admin issuance: `admin.service.ts:241 issueCashback` (+ duplicate prevention via `@@unique([type, referenceModel, referenceId])`, cap at booking total). No automation in `trip-lifecycle.service.ts` |
| **Referrals** | **Nothing.** `grep -ri referral apps/api/src` → zero hits. No model, no route | — |
| **Organizer analytics** | **4 scalar counters only** | `trip.service.ts:400 getOrganizerStats` → `{activeTrips, totalBookings, revenue, pendingRequests}` (Redis-cached). The rich stuff exists **admin-only**: `BookingRepository.getRevenueTrend` (raw SQL), booking-status/trip-type distributions in `admin.service.ts` + Recharts components under `apps/web/src/components/admin/` |
| **Trip templates/duplication** | **None** — no duplicate/clone/copy-from anywhere. But `TripEditHistory.snapshot Json` (schema:806-820) already snapshots full trip state | — |
| **Payouts** | **ESCROW_RELEASE records are created but never shown to organizers as payouts** | `trip-lifecycle.service.ts:215` creates `ESCROW_RELEASE` PaymentTransaction with computed organizer share (`totalAmount × (1 − commissionRate/100)`). Organizer per-trip payments page exists (`payment-history.service.ts:53-98`, `/dashboard/trips/[id]/payments`) but `getTripPaymentSummary` aggregates only PAYMENT/REFUND; no cross-trip settlement statement, no "paid out on date X" view |
| **Price mechanics** | Early-bird built (`Trip.earlyBirdPrice/earlyBirdDeadline`, `getEffectivePrice` in `apps/web/src/lib/trip-utils.ts`). **No price alerts, no watchlist** (wishlist planned in mvp-plan, unbuilt) | — |
| **Group booking** | Multi-traveler per booking (`Booking.numTravelers`, `TravelerDetail[]`, seat selection across `TripVehicle/VehicleSeat`). **No invite link, no reserve-together, no split pay** | schema:359-514 |
| **Search** | **Filter-only.** Destination `contains` match, type/price/date filters (`trip.repository.ts:238 buildWhere`). No traveler-facing free-text search, no autocomplete, no Postgres FTS (despite tech-stack table claiming it) | — |
| **Urgency/social proof** | "X seats left" badge when ≤5 (`trip-card.tsx:93-95`). Nothing else (no views counter, no recent-bookings signal) | — |
| **SEO/shareability** | Strong: `sitemap.ts`, `robots.ts`, JSON-LD, SSR trip + destination pages, OG image = raw trip photo (`app/trips/[slug]/page.tsx:45-50`). **No branded/dynamic OG image generation**, no `opengraph-image` routes. **No PWA manifest** | — |
| **Chat** | 1:1 traveler↔organizer + admin support only (`Conversation @@unique([type, tripId, travelerId])`, `ConversationType` = TRIP_CHAT/ADMIN_SUPPORT). **No group chat, no organizer broadcast** | schema:130-133, 571-601 |

> Note: the backend audit (see `backend-audit.md` P0-1) found that the refund *execution* path is actually missing — "refunds real" in the wallet row above refers to the wallet ledger machinery, not end-to-end refund issuance.

---

## Step 3 — Feature proposals (already-planned items marked and skipped/delta-only)

### Bucket 1: Traveler trust & conversion (ranked)

**1.1 Post-trip review prompts + "Verified booking" badge — S, quick-win** *(not in any doc)*
(a) Builds on: `NotificationType.REVIEW_REQUEST` already enum'd and channel-mapped (`notification.service.ts:17`) but never fired; `trip-lifecycle.service.ts:completeEndedTrips()` is the exact hook point (it already updates bookings → COMPLETED); reviews are already booking-gated (`Review.bookingId @unique`), so the badge is pure FE on `ReviewCard`. (b) **S** — one notification trigger in the cron + email template (template infra at `apps/api/src/templates/index.ts`) + a badge chip. (c) Quick-win. (d) Docs target 30+ reviews in months 1-3; review volume is the trust moat per the market-research doc, and today nobody is ever asked to review. Single highest ROI-per-line-of-code in the codebase.

**1.2 Trip free-text search + destination autocomplete — M, quick-win** *(named in mvp-plan tech-stack table ("PostgreSQL full-text MVP") but never built — propose as the delta)*
(a) Builds on: `trip.repository.ts:buildWhere` (:238) just needs a `q` branch (`title`/`description`/`destination.name` OR-match, or a `tsvector` column); `GET /destinations` already returns the lookup list for typeahead; home hero already has a search bar (`components/home`). (b) **M**. (c) Quick-win. (d) The landing-page promise is "Where do you want to go?" — typing "Gokarna" today only works via exact filter selection; search is the top of the entire conversion funnel.

**1.3 "Book together" invite link (reserve-together, each pays own seat) — L, big-bet** *(adjacent to planned Solo→Squad and Referral Chain, but neither covers co-booking/split payment — propose only this delta)*
(a) Builds on: `Booking.numTravelers` + `TravelerDetail` + per-seat `VehicleSeat` holds (`heldUntil`, `SeatStatus.HELD` — schema:482-514) give you everything for "I'm holding 4 seats, friends claim+pay theirs via link before hold expiry"; booking expiry cron (`utils/cron-jobs.ts`) already releases stale holds. (b) **L** — new GroupBooking/invite model, claim flow, partial-payment states. (c) Big-bet. (d) This is *group* travel — today one person fronts the full amount for friends. Splitting payment removes the single biggest cash-flow objection and the share link is organic acquisition. Should be sequenced with (not duplicated by) the planned Referral Chain.

**1.4 Branded share/OG cards for trips — S, quick-win** *(viral doc mentions auto-OG only for Trip Replay and Local Intel tips; trip-level cards are unplanned)*
(a) Builds on: SSR `generateMetadata` already passes a raw photo (`app/trips/[slug]/page.tsx:45-50`); Next 14 `ImageResponse`/`opengraph-image.tsx` can compose photo + price + dates + "X seats left" + verified badge. Share button already exists in `trip-detail-header.tsx`. (b) **S**. (c) Quick-win. (d) WhatsApp is the discovery channel for Pune group trips; a card carrying price + urgency converts a forward into a landing.

**Already planned — skip:** urgency/social-proof signals beyond the existing seats-left badge (viral Feature 9), price alerts/watchlist (mvp-plan Wishlist #3 explicitly includes FOMO/price notifications), Trust Score, TripShield, Transparent Pricing, Solo→Squad demographics, Safety Beacon. **Also note:** "Similar Trips" on trip detail is in the mvp-plan Page 4 wireframe but unbuilt — trivially served by the existing `tripRepo.search` with destinationId filter (S, quick-win) if claimed as plan-completion rather than a new feature.

### Bucket 2: Retention (ranked)

**2.1 Auto-cashback on trip completion — S, quick-win** *(docs only have admin-manual cashback; automation unplanned)*
(a) Builds on: `WalletService.credit` with `CASHBACK` type + idempotency via `@@unique([type, referenceModel, referenceId])` (schema:771) already make double-issue impossible; `trip-lifecycle.service.ts:completeEndedTrips()` already iterates completed bookings in a transaction; admin cashback cap logic in `admin.service.ts:241-277` is reusable. Needs only a platform config (flat ₹ or % with cap). (b) **S**. (c) Quick-win. (d) Converts wallet from a refund parking lot into a repeat-booking incentive; booking flow already spends wallet balance (`Booking.walletAmount`, FEATURES.md "Apply wallet balance"). Directly feeds the 10%+ repeat-user target.

**2.2 Wallet credit expiry — S, quick-win** *(`EXPIRY` enum is dead code today; unplanned)*
(a) Builds on: dead `WalletTransactionType.EXPIRY` (schema:175); cron registry in `utils/cron-jobs.ts`; needs `expiresAt` on promotional/cashback `WalletTransaction` rows + a sweep job + "₹300 expiring in 7 days" notification (notification infra fully built). (b) **S/M**. (c) Quick-win. (d) Expiring credit is the proven re-engagement trigger that gives cashback urgency — without it 2.1 is a pure cost line.

**2.3 Web push + PWA shell — M, big-bet foundation** *(PushNotificationProvider stub literally says "Replace with Firebase Cloud Messaging when ready"; not in any plan doc)*
(a) Builds on: pluggable `INotificationChannelProvider` architecture (`providers/notification-channel.interface.ts`) — implement FCM in `push-notification.provider.ts`, flip `DEFAULT_CHANNELS`; Firebase Admin SDK is **already configured** (`config/firebase.ts` for Google auth); web needs `public/manifest.json` + service worker + token registration (currently absent). (b) **M**. (c) Big-bet foundation — every planned FOMO/price-drop/saved-trip notification in viral Feature 9 and Wishlist depends on this channel existing. (d) Email open rates won't carry urgency notifications; push is the retention rail everything else plugs into.

**2.4 Trip reminder lifecycle messages — S, quick-win** *(TRIP_REMINDER enum'd + email template slot exists, never sent; unplanned)*
(a) Builds on: `NotificationType.TRIP_REMINDER` already routed IN_APP+EMAIL (`notification.service.ts:16`); trips have `startDate`, bookings have pickup point + time (`TripTransferPoint.time`); one cron query: confirmed bookings with startDate in 48h/24h. (b) **S**. (c) Quick-win. (d) Reduces no-shows/support load and creates a guaranteed pre-trip touchpoint that can carry "invite a friend — seats left" upsell.

**Already planned — skip:** Referral program (viral Feature 7, full 3-level design), wishlist re-engagement + saved-trip price/seat alerts (mvp-plan #3), Trip Replay post-trip engagement, Local Intel between-booking retention.

### Bucket 3: Organizer stickiness (ranked)

**3.1 Organizer analytics dashboard (funnel + revenue trend) — M, quick-win** *(mvp-plan defers this to Phase 2 "until 50+ organizers" with no design — proposing the concrete delta since the data layer already exists)*
(a) Builds on: `BookingRepository.getRevenueTrend` raw SQL already written for admin — re-scope by `organizerId`; `getTripBookingSummary` (`trip.service.ts:547`), `getTripPaymentSummary` with `organizerEarnings` (`payment-history.service.ts:77-91`); FE Recharts components already exist (`components/admin/revenue-chart.tsx`, `bookings-chart.tsx`) and can be lifted into `/dashboard`. Funnel = TripRequest counts → bookings → cancellations, all indexed. (b) **M** (mostly re-scoping queries + reusing charts). (c) Quick-win. (d) Stickiness = organizers checking the dashboard weekly; "your Goa trips earn 2× your Lonavala trips" is the insight Instagram can never give them.

**3.2 Payout statements / settlement visibility — M, quick-win** *(unplanned anywhere; data already recorded)*
(a) Builds on: `ESCROW_RELEASE` transactions with exact organizer-share amounts + `razorpayTransferId` + release timestamp in metadata (`trip-lifecycle.service.ts:211-226`); `payment.routes.ts` organizer routes pattern; needs a `GET /payments/payouts` (organizer-scoped ESCROW_RELEASE list grouped by trip/month) + a "Payouts" tab in `/dashboard`. (b) **M**. (c) Quick-win. (d) "Where's my money?" is the #1 organizer-trust question with a 90-day escrow hold; showing released vs pending amounts per trip removes the biggest reason organizers push travelers off-platform (the leakage threat the market-research doc calls the #1 risk).

**3.3 Trip duplication ("Repeat this trip") — S, quick-win** *(unplanned)*
(a) Builds on: `TripEditHistory.snapshot Json` proves full-trip serialization already exists (`trip-edit-history.repository.ts`); `TripService.createTrip` + slug generation + `TripTransferPoint`/`TripVehicle` create paths all exist — duplicate = load trip → strip dates/bookings → create as DRAFT (transfer points and vehicle layouts copied). (b) **S/M**. (c) Quick-win. (d) Pune weekend organizers run the same Goa/Gokarna trip every 2-4 weeks; recreating a 9-section form (itinerary, inclusions, pickup points, seat layouts, photos) each time is the biggest listing friction. More listings = more supply = more SEO pages.

**3.4 Organizer announcements (broadcast to confirmed travelers) — M, quick-win** *(distinct from planned Solo→Squad traveler group chat — that's traveler-to-traveler; this is organizer→all, one-way)*
(a) Builds on: chat infra (`ChatService`, Socket.IO rooms, `MessageType.SYSTEM` already enum'd schema:135-140); `BookingRepository.findByTripId` gives the confirmed-traveler audience; anti-leakage filter (`chat-filter.ts`) applies as-is; in-app+email notification fan-out via `NotificationService.sendBulk` (already built). (b) **M**. (c) Quick-win. (d) Today an organizer announcing "pickup moved to 6:30" must message N travelers individually in N conversations — broadcast makes the platform the operational tool they can't leave, and keeps logistics on-platform (anti-leakage).

**Already planned — skip:** organizer reputation page (shipped — `/trips/organizers/[slug]` + `getOrganizerPublicProfileBySlug` in `trip.service.ts:100`; only the SEO/SSR checkbox in mvp-plan line 1380 remains open), Trust Score (viral Feature 8), response-time metric (Trust Score component).

### Top cross-bucket recommendation order
1. **Review prompts + auto-cashback + trip reminders** (all S, all ride the existing `trip-lifecycle` cron + notification infra — one sprint, hits trust *and* retention)
2. **Payout statements + trip duplication** (organizer retention before scaling supply)
3. **Free-text search** (conversion top-of-funnel)
4. **Web push/PWA** (foundation the already-planned FOMO/wishlist features will need)
5. **Book-together split pay** (big-bet; sequence against planned Referral Chain to avoid mechanic collision)

### Doc maintenance flags
- Update `docs/mvp/mvp-plan.md` — Destination Pages (#1 in "Not Started") is actually shipped.
- The tech-stack table's "PostgreSQL full-text search" claim is unimplemented.
