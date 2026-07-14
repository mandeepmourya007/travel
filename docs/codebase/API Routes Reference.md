---
title: API Routes Reference
created: 2026-07-10
type: reference
tags:
  - codebase/api
  - reference/endpoints
---

# API Routes Reference

All routes mounted in `apps/api/src/server.ts` under `/api/v1/*`. Guards shown as *(auth)* = JWT required, *(ROLE)* = `requireRole` — see [[API Backend#Middleware]].

> [!info] Mount Map
> `/auth` (+ conditional firebase) · `/destinations` · `/trips` (trip **and** vehicle routers) · `/uploads` · `/bookings` · `/payments` · `/wallet` · `/reviews` · `/chat` · `/notifications` · `/admin` (admin + trip-category admin) · `/trip-categories` · `/trip-type-requests` · `/webhooks` · `GET /api/v1/sitemap-data` (inline, public) · `GET /health` (DB + Redis check, no auth)

## Auth — `/api/v1/auth` *(authRateLimit)*

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/signup/:token` | Organizer-invite info by token | — |
| POST | `/signup/:token` | Organizer signup via invite | — |
| POST | `/signup` | Traveler signup | — |
| POST | `/login` | Email/password login | — |
| POST | `/refresh` | Rotate refresh token → new access token | cookie |
| POST | `/logout` | Revoke current refresh token | — |
| POST | `/logout-all` | Revoke all sessions | auth |
| GET | `/me` | Current user | auth |
| GET | `/profile` | Full profile | auth |
| PATCH | `/profile` | Update profile | auth |
| PATCH | `/profile/organizer` | Update organizer profile | ORGANIZER |
| POST | `/profile/organizer/bank` | Connect bank/payout account | ORGANIZER |
| POST | `/profile/organizer/doc-comments` | Add document comment | ORGANIZER |
| GET | `/profile/organizer/doc-comments` | List document comments | ORGANIZER |
| POST | `/organizer-invite` | Generate organizer invite | ADMIN |
| POST | `/google` | Google OAuth login/signup | — |
| POST | `/otp/send` | Send phone OTP *(otpRateLimit)* | — |
| POST | `/otp/verify` | Verify phone OTP | — |
| POST | `/otp/email/send` | Send email OTP | — |
| POST | `/otp/email/verify` | Verify email OTP | — |
| POST | `/firebase/verify` | Verify Firebase phone ID token *(conditional mount)* | — |

## Destinations — `/api/v1/destinations`

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/` | List *(cache 120s)* | — |
| GET | `/slug/:slug` | By slug *(cache 300s)* | — |
| GET | `/:id` | By id | — |
| POST | `/` | Create | ADMIN |
| PUT | `/:id` | Update | ADMIN |
| DELETE | `/:id` | Soft-delete | ADMIN |

## Trips — `/api/v1/trips`

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/my/list` | Organizer's trips | ORGANIZER |
| GET | `/my/search` | Search organizer's trips | ORGANIZER |
| GET | `/my/booked-search` | Search own booked trips | TRAVELER, ADMIN |
| GET | `/admin/search` | Admin search all trips | ADMIN |
| GET | `/organizer/stats` | Organizer dashboard stats | ORGANIZER |
| GET | `/organizer/pending-requests` | All pending trip requests | ORGANIZER |
| GET | `/` | Public trip search *(cache 60s)* | — |
| GET | `/slug/:slug` | Trip by slug *(cache 300s)* | — |
| GET | `/organizers/slug/:slug` | Public organizer profile by slug | — |
| GET | `/organizers/:organizerId` | Public organizer profile by id | — |
| GET | `/:id` | Trip by id | — |
| POST | `/` | Create trip | ORGANIZER |
| PUT | `/:id` | Update trip | ORGANIZER |
| POST | `/:id/publish` | Publish trip | ORGANIZER |
| POST | `/:id/duplicate` | Duplicate trip | ORGANIZER |
| DELETE | `/:id` | Delete trip | ORGANIZER |
| PATCH | `/:id/toggle-bookings` | Pause/resume bookings | ORGANIZER |
| PATCH | `/:id/visibility` | Hide/show trip | ORGANIZER |
| GET | `/:id/history` | Edit history | ORGANIZER |
| POST | `/:tripId/request` | Create trip request | TRAVELER |
| GET | `/:tripId/bookings` | Participant/booking list | ORGANIZER |
| GET | `/:tripId/requests` | Trip requests list | ORGANIZER |
| GET | `/:tripId/summary` | Booking summary | ORGANIZER |
| PATCH | `/:tripId/requests/:requestId` | Approve/reject request | ORGANIZER |

### Vehicles (nested under `/api/v1/trips`)

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| POST | `/:tripId/vehicle` | Create vehicle/seat layout | ORGANIZER |
| PUT | `/:tripId/vehicle/:vehicleId` | Update vehicle | ORGANIZER |
| DELETE | `/:tripId/vehicle/:vehicleId` | Delete vehicle | ORGANIZER |
| GET | `/:tripId/vehicle` | Organizer seat map | ORGANIZER |
| GET | `/:tripId/vehicles` | All vehicles | ORGANIZER |
| GET | `/:tripId/seats` | Public seat map | — |
| POST | `/:tripId/seats/hold` | Hold seats *(10 min)* | auth |

## Bookings — `/api/v1/bookings` *(bookingRateLimit on writes)*

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| POST | `/` | Create booking | auth |
| GET | `/my` | My bookings | auth |
| GET | `/my/summary` | My booking summary | auth |
| GET | `/my/pending-requests` | My pending trip requests | auth |
| GET | `/my/trip-status/:tripId` | My booking status for a trip | auth |
| POST | `/:id/cancel` | Cancel booking | auth |
| POST | `/:id/verify-payment` | Verify client payment callback | auth |
| POST | `/:id/sync-payment` | Reconcile payment status from gateway | auth |

## Payments (history) — `/api/v1/payments`

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/my` | My payment history | auth |
| GET | `/my/summary` | My payment summary | auth |
| GET | `/trip/:tripId` | Trip payments | ORGANIZER, ADMIN |
| GET | `/trip/:tripId/summary` | Trip payment summary | ORGANIZER, ADMIN |
| GET | `/organizer` | Organizer global payments | ORGANIZER, ADMIN |
| GET | `/organizer/summary` | Organizer payment summary | ORGANIZER, ADMIN |
| GET | `/payouts` | Organizer payout statement | ORGANIZER, ADMIN |
| GET | `/trip/:tripId/payouts` | Trip payout statement | ORGANIZER, ADMIN |
| GET | `/admin` | All payments | ADMIN |
| GET | `/admin/summary` | Global payment summary | ADMIN |

## Wallet — `/api/v1/wallet`

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/` | Balance | auth |
| GET | `/transactions` | Transaction history | auth |
| GET | `/cashback` | Cashback history | auth |
| POST | `/admin/:userId/credit` | Admin credit | ADMIN |
| POST | `/admin/:userId/debit` | Admin debit | ADMIN |

## Reviews — `/api/v1/reviews`

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/trip/:tripId` | Public trip reviews | — |
| POST | `/` | Create review | auth |
| GET | `/my/booking/:bookingId` | Own review for a booking | auth |
| PUT | `/:id` | Update own review | auth |
| POST | `/:id/reply` | Organizer reply | ORGANIZER |
| GET | `/organizer/mine` | Reviews received | ORGANIZER |
| GET | `/my` | Reviews I wrote | auth |

## Chat — `/api/v1/chat` *(router-wide auth)*

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/unread-count` | Total unread badge count | auth |
| POST | `/conversations/trip/:tripId` | Get/create trip conversation | auth |
| POST | `/conversations/support` | Get/create admin-support conversation | auth |
| GET | `/conversations` | List my conversations | auth |
| GET | `/conversations/:id/messages/search` | Search messages | auth |
| GET | `/conversations/:id/messages` | Paginated messages | auth |
| POST | `/conversations/:id/messages` | Send message (REST fallback) | auth |
| POST | `/conversations/:id/messages/:msgId/reactions` | Add reaction | auth |
| DELETE | `/conversations/:id/messages/:msgId/reactions/:emoji` | Remove reaction | auth |
| PATCH | `/conversations/:id/close` | Close conversation | ADMIN |
| GET | `/flagged` | Flagged messages | ADMIN |

## Notifications — `/api/v1/notifications`

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/` | List | auth |
| GET | `/unread-count` | Unread count | auth |
| PATCH | `/read-all` | Mark all read | auth |
| PATCH | `/:id/read` | Mark one read | auth |

## Admin — `/api/v1/admin` *(all auth + ADMIN)*

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/organizers` | Approval queue |
| GET | `/organizers/:id` | Organizer detail |
| PATCH | `/organizers/:id/status` | Approve/reject organizer |
| GET | `/organizers/:id/documents` | Document review detail |
| PATCH | `/organizers/:id/documents/:docType/review` | Review a document |
| POST | `/organizers/:id/comments` | Add doc comment |
| GET | `/organizer-invites` | List invites |
| GET | `/stats` | Platform stats |
| GET | `/bookings` | All bookings |
| GET | `/bookings/:id` | Booking detail |
| GET | `/cashback/trips` | Trips eligible for cashback |
| GET | `/cashback/trips/:tripId` | Trip cashback detail |
| POST | `/cashback/issue` | Issue cashback |
| GET | `/cashback/by-user` | Cashback history by user |
| GET | `/cashback/by-user/:userId` | User cashback detail |
| GET | `/cashback/by-trip` | Cashback history by trip |
| GET | `/trips` | Admin trip list |
| PATCH | `/trips/:id/bookings` | Admin pause/resume bookings |
| PATCH | `/trips/:id/visibility` | Admin hide/show trip |
| GET | `/reviews` | Review list *(adminRateLimit)* |
| GET | `/users/travellers` | Paginated traveller directory (search/sort by name, bookingsCount, joinedAt; optional status filter — active/inactive, maps to `User.isActive`) |
| GET | `/users/travellers/:travellerId` | Traveller detail — profile + booked trips (optional bookingStatus filter) + reviews written |
| GET | `/users/organizers` | Paginated organizer directory (search/sort by name, tripsCount, joinedAt; optional verificationStatus filter) |
| GET | `/users/organizers/:organizerId` | Organizer directory detail — profile summary (tripsCount = unfiltered total) + paginated trips created (optional trip status filter) |
| GET | `/trip-categories` | List categories |
| POST | `/trip-categories` | Create category |
| PUT | `/trip-categories/:id` | Update category |
| DELETE | `/trip-categories/:id` | Delete category |
| GET | `/trip-type-requests` | List trip-type requests |
| PATCH | `/trip-type-requests/:id` | Review trip-type request |

## Trip Categories (public + organizer)

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| GET | `/api/v1/trip-categories` | Active categories | — |
| POST | `/api/v1/trip-type-requests` | Submit trip-type request | ORGANIZER |
| GET | `/api/v1/trip-type-requests/my` | My requests | ORGANIZER |

## Uploads — `/api/v1/uploads`

| Method | Path | Purpose | Guard |
| :--- | :--- | :--- | :--- |
| POST | `/signature` | Cloudinary signed-upload params | ORGANIZER, TRAVELER |

## Webhooks — `/api/v1/webhooks` *(raw body, webhookRateLimit)*

| Method | Path | Purpose | Condition |
| :--- | :--- | :--- | :--- |
| POST | `/razorpay` | Razorpay webhook | only if `RAZORPAY_WEBHOOK_SECRET` set |
| POST | `/cashfree` | Cashfree webhook | only if `CASHFREE_WEBHOOK_SECRET` set |

> [!warning] Signature Verification
> Verification happens inside each gateway's `verifyAndParseWebhook()` — not the standalone `webhook-verify.middleware.ts`. See [[Payments & Webhooks#Webhook Handling]].

Related: [[API Backend]] · [[Payments & Webhooks]] · [[Auth & Security]]
