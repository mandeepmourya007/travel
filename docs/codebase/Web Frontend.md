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
| `shared/` (38) | `auth-guard`, `role-guard`, toasts, modals, pagination, date/phone/email inputs, star ratings, `blur-image`, lightbox, loaders/overlays, `route-progress`, `server-down-banner`, `socket-connector`, `chunk-error-reload` (mounted in `Providers`; reloads once on a stale post-deploy webpack chunk error — `unhandledrejection` for "reading 'call'"/`ChunkLoadError`, session-guarded against reload loops), `login-required-dialog`, `data-states`, `price-range-slider`, … |
| `layout/` | `app-shell`, `header`, `footer`, `mobile-bottom-nav` |
| `trips/` (24) | incl. `trip-form/` — 10-file multi-tab trip builder |
| `booking/` (5) vs `bookings/` (7) | ==singular = booking flow, plural = my-bookings views== |
| `chat/` (11), `vehicle/` (8) | both with `index.ts` barrels; vehicle = seat-map builder |
| `admin/` (7) | recharts dashboards |
| `dashboard/` (7 + `trip-users/` 6) | organizer views + participant management |
| `home/`, `destinations/`, `payments/`, `wallet/`, `profile/`, `reviews/`, `notifications/` | per-feature |

## Styling

- Tailwind `darkMode: 'class'`; design tokens imported from ==`packages/shared/src/theme/tokens.json`==.
- Palette: `primary` teal (500 = `#0FBAB5`), `accent` coral `#FF4F33`, `highlight` violet `#7C4DFF`, full neutral scale + success/warning/error/info.
- Fonts via `next/font/google` as CSS vars: Inter (`sans`), Plus Jakarta Sans (`display`), JetBrains Mono (`mono`).
- `globals.css` defines RGB CSS vars (`--color-primary: 15 186 181`) and component classes (`.btn-outline`, `.spinner`) in Tailwind layers.
- Custom animations: shimmer, pop, slide-up/down, page-enter, shake, toast-exit, accordion.

## `src/lib/` Utilities

| File | Purpose |
| :--- | :--- |
| `constants.ts` | `APP_NAME` (Safarnama), `SITE_URL`, legal contacts, `API_TIMEOUT_MS`, `STALE_TIME_*`, `REFETCH_INTERVAL_*`, ==`getHomeRoute(role)`== (ADMIN→`/admin`, ORGANIZER→`/dashboard`, else `/trips`) |
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
| `admin-utils.ts`, `organizer-utils.ts`, `trip-utils.ts`, `booking-errors.ts`, `overlay-stack.ts` | Domain helpers |

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
