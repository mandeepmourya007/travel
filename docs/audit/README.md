# Repository Audit — 2026-06-12

Full repository audit of TripCompare, run as three parallel evidence-based reviews plus a synthesis. Every finding cites `file:line` from the actual code at commit `9a9c643`.

| Doc | Scope |
|-----|-------|
| [synthesis.md](./synthesis.md) | Combined report: critical money bugs, ranked perf fixes, UX improvements, ranked product ideas, suggested order of attack |
| [backend-audit.md](./backend-audit.md) | `apps/api/src` — bottlenecks, money-path correctness (escrow/refunds/wallet/seat holds), webhooks, crons, rate limiting, prod config |
| [frontend-audit.md](./frontend-audit.md) | `apps/web/src` — perceived performance (SSR/hydration, bundles, waterfalls, caching) and UX across all key flows |
| [product-audit.md](./product-audit.md) | Built vs stubbed ground truth, plus new feature proposals filtered against `docs/mvp/mvp-plan.md` and `docs/rnd/` |
| [docker-audit.md](./docker-audit.md) | `docker/`, compose files, nginx config, `deploy-prod.sh` — build wiring, deploy downtime, stale templates, backup hygiene |

## Headline findings

1. **The refund path does not exist** — cancellations notify the user "Refund: ₹X" but never move money (`initiateRefund` has zero call sites).
2. **Escrow releases pay organizers for CANCELLED bookings** — release queries have no `bookingStatus` filter.
3. **Webhook HMAC can verify against an empty secret** — `RAZORPAY_WEBHOOK_SECRET` is optional in prod env validation.
4. **`confirmBooking` resurrects expired/cancelled bookings** and swallows seat-confirmation failure → charged traveler with no seat.
5. **A pre-hydration full-screen overlay hides all SSR content** until React hydrates — the single biggest "feels slow" item.
6. **Seat-race losers see "You've Already Booked This Trip"** — a broken dead-end on the highest-intent flow.
7. **Web image builds prerender ISR pages against a dead API URL** (`127.0.0.1:4001` inside the build container) — the root cause of the "empty SSR snapshot" bug patched client-side in `fd7a742`.
