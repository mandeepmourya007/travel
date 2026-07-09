---
title: Frontend Routes Reference
created: 2026-07-10
type: reference
tags:
  - codebase/web
  - reference/routes
---

# Frontend Routes Reference

App Router tree under `apps/web/src/app/`. Protection is component-level (`<AuthGuard>` / `<RoleGuard>`) — see [[Auth & Security#Frontend Guards]]. *noindex* = layout sets `robots: { index: false, follow: false }`. Most segments have co-located `error.tsx` / `loading.tsx`.

## Root & Special Files

| File | Purpose |
| :--- | :--- |
| `layout.tsx` | Root layout — fonts, global metadata, `<Providers>` |
| `page.tsx` | **Home `/`** — SSR popular destinations + trending trips; WebSite + Organization JSON-LD |
| `providers.tsx` | React Query, Google OAuth, toasts, socket, loaders, compare-queue |
| `robots.ts` / `sitemap.ts` / `manifest.ts` / `apple-icon.tsx` | SEO/PWA → [[Web Frontend#SEO]] |
| `not-found.tsx` / `global-error.tsx` / `loading.tsx` | Error/loading boundaries |

## `(auth)` Group — *noindex*, Header only

| Route | Purpose |
| :--- | :--- |
| `/login` | Server redirect → `/login/email` |
| `/login/email` | Email/password + Google; `returnTo` (open-redirect-safe); post-login role routing |
| `/login/email-otp` | Email OTP login |
| `/login/phone` | Firebase phone OTP login |
| `/signup` | Traveler signup |
| `/signup/organizer/[token]` | Organizer signup via invite token |
| `/onboarding` · `/onboarding/profile` | Post-signup onboarding |

## `(public)` Group — indexable legal/marketing

`/about` · `/cancellation-policy` · `/contact` · `/cookies` · `/disclaimer` · `/faq` · `/how-it-works` · `/legal` · `/lost-item` · `/organizer-agreement` · `/privacy` · `/rules` · `/safety` · `/terms` — copy from `src/lib/legal-content.ts`.

## `(dashboard)` Group

| Route | Purpose |
| :--- | :--- |
| `/notifications` | Notifications list — ==page-level `<AuthGuard>`== (group layout is not protective) |

## `/trips` — indexable, `AppShell`, rich SEO metadata

| Route | Purpose |
| :--- | :--- |
| `/trips` | Listing/search/filters |
| `/trips/[slug]` | Trip detail — SSR + `generateStaticParams`, TouristTrip JSON-LD |
| `/trips/[slug]/book` | Booking flow (seats, travelers, payment) |
| `/trips/compare` | Side-by-side comparison (max 3) |
| `/trips/organizers/[slug]` | Public organizer profile, Organization JSON-LD |

## `/destinations` — indexable

| Route | Purpose |
| :--- | :--- |
| `/destinations` | Destination listing |
| `/destinations/[slug]` | Destination detail, TouristDestination JSON-LD |

## `/admin` — layout `<AuthGuard allowedRoles={['ADMIN']}>`, *noindex*, `AdminSidebar`

| Route | Purpose |
| :--- | :--- |
| `/admin` | Dashboard/stats |
| `/admin/bookings` · `/admin/bookings/[id]` | Booking oversight |
| `/admin/cashback` · `/admin/cashback/[tripId]` · `/admin/cashback/user/[userId]` | Cashback issuance & history |
| `/admin/chat` | Flagged conversations |
| `/admin/invites` | Organizer invites |
| `/admin/organizers` · `/admin/organizers/[id]` | Approval queue & doc review |
| `/admin/payments` | Platform payments |
| `/admin/reviews` | Review moderation |
| `/admin/trip-types` | Category management |
| `/admin/trips` | Trip visibility/booking toggles |

## `/dashboard` — layout `<AuthGuard>` + `<RoleGuard roles={['ORGANIZER']}>`, *noindex*, sidebar + mobile nav

| Route | Purpose |
| :--- | :--- |
| `/dashboard` | Organizer home |
| `/dashboard/payments` | Payouts/earnings |
| `/dashboard/requests` | Pending trip-join requests |
| `/dashboard/reviews` | Reviews received |
| `/dashboard/settings/bank` · `/dashboard/settings/verification` | Bank setup, KYC |
| `/dashboard/trips` · `/dashboard/trips/create` | Trips list, multi-tab creation form |
| `/dashboard/trips/[id]/edit` · `.../history` · `.../payments` · `.../reviews` · `.../users` · `.../vehicle` | Per-trip management (edit, edit-history, payments, reviews, participants, seat-map builder) |

## Traveler Account Routes — `AppShell` + *noindex*, ==auth enforced page-level==

| Route | Purpose |
| :--- | :--- |
| `/my-bookings` | Traveler bookings |
| `/my-payments` | Payment history |
| `/my-reviews` | Reviews written |
| `/profile` | User profile |
| `/wallet` | Balance, transactions, cashback |
| `/messages` | Chat inbox |

## Utility / Dev Routes

| Route | Purpose |
| :--- | :--- |
| `/payment-complete` | Gateway return handler — *noindex*, no shell |
| `/preview/trip-users` | Mock-data preview harness (robots-blocked) |
| `/demo-css` | **Route Handler** (GET) — dev-only, serves `docs/engineering/fe/preview.html`, 404 in prod |
| `/demo-css/components` | Component showcase |

> [!tip] Guard Placement Cheat-Sheet
> Only `admin/` and `dashboard/` layouts enforce auth. Everything else private (`my-*`, `profile`, `wallet`, `messages`, `(dashboard)/notifications`) guards ==inside the page component==.

Related: [[Web Frontend]] · [[Auth & Security]] · [[API Routes Reference]]
