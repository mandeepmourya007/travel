# Repository Audit — 2026-06-12

Full repository audit of TripCompare, run as three parallel evidence-based reviews plus a synthesis. Every finding cites `file:line` from the actual code at commit `9a9c643`.

| Doc | Scope |
|-----|-------|
| [synthesis.md](./synthesis.md) | Combined report: remaining reliability risks, perf fixes, UX improvements, ranked product ideas, suggested order of attack |
| [backend-audit.md](./backend-audit.md) | `apps/api/src` — open items: cron lock, Socket.IO adapter, rate-limit tiers, unpaginated queries, misc perf |
| [frontend-audit.md](./frontend-audit.md) | `apps/web/src` — open items: chat UX, modal accessibility, filter double-fetch, img/polling polish |
| [product-audit.md](./product-audit.md) | Built vs stubbed ground truth, plus new feature proposals filtered against `docs/mvp/mvp-plan.md` and `docs/rnd/` |
| [docker-audit.md](./docker-audit.md) | Deploy & infra — open items: nginx SSR cache bypass dead code, optional tsx→tsc compilation |
| [2026-07-10-agent-tooling-session-findings.md](./2026-07-10-agent-tooling-session-findings.md) | Findings surfaced while porting `.claude/` agent tooling — escrow buffer discrepancy, broken frontend test suite, no CI/CD, tooling config gaps |

## Original headline findings — resolution status

| # | Finding | Status |
|---|---------|--------|
| 1 | **The refund path did not exist** — cancellations notified "Refund: ₹X" but never moved money | ✅ Fixed |
| 2 | **SafePay released to organizers for CANCELLED bookings** — no bookingStatus filter | ✅ Fixed |
| 3 | **Webhook HMAC verified against empty string** when `RAZORPAY_WEBHOOK_SECRET` unset | ✅ Fixed |
| 4 | **`confirmBooking` resurrected expired/cancelled bookings**, swallowed seat-confirmation failure | ✅ Fixed |
| 5 | **Pre-hydration full-screen overlay** hid all SSR content until React hydrated | ✅ Fixed |
| 6 | **Seat-race losers saw "You've Already Booked This Trip"** — broken dead-end on highest-intent flow | ✅ Fixed |
| 7 | **Web image built ISR pages against a dead API URL** (`127.0.0.1:4001` inside build container) | ✅ Fixed |

All critical money-loss and high-intent-path issues are resolved. Remaining open work is in the individual audit files above.
