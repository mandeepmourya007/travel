# Findings from Agent-Tooling Port Session — 2026-07-10

Surfaced while porting/fact-checking `.claude/agents`, `.claude/skills`, hooks, and rules (oprag → travel). Not a full repo audit — just what came up verifying claims against real code and running `npm run type-check`/`test`. See [synthesis.md](./synthesis.md) for the last full audit.

## Critical

1. ~~**Escrow release has no delay.** `apps/api/src/services/trip-lifecycle.service.ts` releases SafePay funds immediately on trip `COMPLETED`. `docs/codebase/Product Domain.md` documents a "90-day safety buffer" that does not exist anywhere in code.~~ — **Verified 2026-08-02: the 90-day buffer now exists in code.** `apps/api/src/utils/constants.ts:72` defines `ESCROW_SAFETY_BUFFER_DAYS = 90`, used in `apps/api/src/services/booking.service.ts:858` to compute `holdUntilEpochSec = trip.endDate + 90 days` for the Cashfree Easy Split vendor payout hold. (Not in `trip-lifecycle.service.ts` as originally described — it lives in `booking.service.ts`, applied at booking-creation time to the payout split, not at trip-completion time.)
2. **Frontend test suite is broken.** ~~346/441 `apps/web` tests fail (`ReferenceError: React is not defined` in JSX...)~~ — **Verified 2026-08-02: re-ran `npm run test` in `apps/web`.** Current result: 607/612 tests passing, 5 failing, across 72/74 test files (2 files failing). No `React is not defined` errors present — that failure mode appears to have been resolved along with the React 19 upgrade. The stale 346/441 figure should not be reused; a small residual regression (5 tests) remains but the suite is not "broken" in the previously-reported sense.

## Medium

3. ~~**No CI/CD.** Confirmed no `.github/workflows` directory exists.~~ — **Verified 2026-08-02: partially true.** `.github/workflows/deploy-ec2.yml` now exists, but it is a **deploy trigger only** — it fires on push to `master` and SSHes into EC2 to run `scripts/deploy-prod.sh --ci`, it does not run `type-check`/`test` as a PR merge gate. So a CD path exists now, but the original concern (nothing blocks a bad PR from merging) is still accurate — there is still no CI check gating pull requests.
4. **`packages/shared` had zero test infra** (no `vitest` devDependency, no `test` script) despite containing real logic (`src/utils/refund.test.ts`) — `turbo test` silently skipped it at the root. Fixed this session (added `vitest` + `test` script, now 20/20 passing) — but worth checking whether other `packages/shared/src/**` logic is similarly untested.
5. **`apps/api/tsconfig.json` bulk-includes `packages/shared/src/**/*`** with legacy `moduleResolution: node`. Fragile: any future modern-exports-only dependency used in a shared test file will break `apps/api`'s typecheck the same way `vitest` just did. Currently patched by excluding `*.test.ts`, not by fixing the underlying resolution mode.

## Low

6. **`next lint` is deprecated**, removed in Next.js 16 — migration to ESLint CLI (`next-lint-to-eslint-cli`) not done yet.
7. **Duplicate lockfiles** — Next.js warns it found `/Users/mandeep/package-lock.json` outside the repo and infers the wrong workspace root. Remove the stray lockfile or set `outputFileTracingRoot`.
8. **No shared page-header/layout primitive** in `apps/web` — every page hand-rolls its own `<h1>` styling (see `travel-ui-stack` skill's "Known gap"). Visual consistency is convention-only, not enforced by a shared component.
9. **`npm warn allow-scripts`** — 15+ packages with install scripts pending approval, unreviewed (`npm approve-scripts --allow-scripts-pending`).

## Design pattern issues

10. **No Authorization Policy pattern.** Ownership checks (`if (booking.userId !== userId) throw ForbiddenError`) are hand-written ad-hoc in every service method instead of a centralized policy/guard layer. Easy to forget on a new method; each dev re-derives the same check.
11. **Temporal coupling in webhook middleware, unenforced.** Correctness depends on exact registration order (`express.raw()` → rate-limit → HMAC-verify → controller). Nothing prevents a new webhook route from being wired out of order and silently becoming unsigned/insecure.
12. **DIP violation in DI wiring.** Services depend on concrete repository *classes*, not interfaces (`XService(private xRepository: XRepository)`). Fine for now, but it's why unit tests need hand-written fakes instead of interface-based mocks — testability cost compounds as the repo grows.
13. **No Template/Layout component for page headers.** Every `apps/web` page hand-rolls its own `<h1 className="font-display...">` instead of a shared `PageHeader` primitive. Classic DRY violation at the component layer; already causes className drift across pages. (Same root cause as #8 above.)
14. **Manual composition root will not scale linearly.** `apps/api/src/config/dependencies.ts` wires every repository→service→controller by hand. Fine at current size; becomes a maintenance bottleneck as more domains are added, since there's no container/module boundary.
15. **Cron jobs have no leader-election/lock.** `index.ts` boots cron on every process with no Redis lock (already flagged in `docs/audit/synthesis.md`, still open). A Singleton-job pattern is assumed but not enforced — first horizontal scale-out double-runs escrow release.
