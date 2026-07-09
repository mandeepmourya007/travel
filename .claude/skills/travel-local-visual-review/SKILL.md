---
name: travel-local-visual-review
description: >-
  Capture and review screenshots of Safarnama/TripCompare UI changes on the local
  Next.js dev server (apps/web). Use when validating apps/web/src changes locally,
  before merge, or when the user asks for browser screenshots, visual QA, or local
  UI review. Covers Puppeteer MCP first, npx Playwright fallback second, viewport
  targets, and an inconsistency checklist.
paths:
  - apps/web/src/**
---

# Travel Local Visual Review

Use after UI changes in `apps/web/src/` — **before** opening or merging a PR.

**Related:** [travel-ui-stack](../travel-ui-stack/SKILL.md) (tokens/primitives) · [travel-ui-audit](../travel-ui-audit/SKILL.md) (scored audit) · [debug-runtime](../debug-runtime/SKILL.md) (headless Chrome recipe reused below)

**Single-surface app:** unlike some other repos, there is **no separate marketing/landing site** here — all public marketing pages (`/`, `/trips`, `/destinations`, legal, etc.) live inside the same Next.js app under `apps/web/src/app/(public)/`, served by the same dev server as the dashboards. One dev server, one base URL — don't invent a second surface.

---

## Quick start

1. Start the dev server (one terminal):

```bash
cd apps/web && npm run dev
# Next.js defaults to http://localhost:3000 — but READ the terminal output,
# it will print "-  Local: http://localhost:XXXX" if 3000 is occupied. Never hardcode blindly.
```

2. **Preferred:** Puppeteer MCP (`mcp__puppeteer__*` tools) — this repo has Puppeteer configured as an MCP server (see `~/.claude.json` → `mcpServers.puppeteer`), **not** Playwright MCP. Use it for interactive screenshots + review.
3. **Fallback:** raw `npx playwright` — `@playwright/test` is already a devDependency in `apps/web/package.json`, but there is **no `playwright.config.ts`, no npm script, and no `*.spec.ts` files yet** in this repo. Don't claim a `test:screenshots` script exists — it doesn't. Either drive Playwright ad hoc (see Phase 2) or, if the user wants this repeatable, propose adding `apps/web/playwright.config.ts` + an `apps/web/e2e/` folder + a `test:visual` script as a follow-up — don't fabricate that it's already there.
4. Read screenshots; file findings using the report template below.

---

## Phase 1 — Puppeteer MCP (preferred)

### Tools available

`mcp__puppeteer__puppeteer_navigate`, `puppeteer_screenshot`, `puppeteer_click`, `puppeteer_fill`, `puppeteer_hover`, `puppeteer_select`, `puppeteer_evaluate`, `puppeteer_connect_active_tab`. Load their schemas via `ToolSearch` (e.g. `select:mcp__puppeteer__puppeteer_navigate,mcp__puppeteer__puppeteer_screenshot`) before first use — do not guess parameter names.

### Known gotcha — default browser wedges

Per [debug-runtime](../debug-runtime/SKILL.md): the Puppeteer MCP's default browser session frequently wedges (`Attempted to use detached Frame`, `ERR_EMPTY_RESPONSE`, navigation timeouts). If `puppeteer_navigate` hangs or errors oddly, launch a clean headless Chrome yourself and attach:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
rm -rf /tmp/chrome-debug
"$CHROME" --remote-debugging-port=9222 --headless=new --no-first-run \
  --no-default-browser-check --user-data-dir=/tmp/chrome-debug about:blank &
sleep 2; curl -s http://127.0.0.1:9222/json/version   # confirm it's up
```

Then `puppeteer_connect_active_tab` (debugPort 9222) → `puppeteer_navigate` → `puppeteer_screenshot`. Kill it after: `lsof -ti:9222 | xargs kill`.

### Review flow

1. Navigate to each target route (see viewport/route table below), wait for content (don't screenshot mid-hydration — check for the page's real heading/content, not a spinner)
2. Screenshot at each required viewport
3. Read the images for inconsistencies (this is a **visual read**, not just "did navigation succeed")
4. Report using the template below; redact any real credentials

### Viewport targets

| Viewport | Width | Routes to cover |
| -------- | ----- | ---------------- |
| Desktop  | 1440  | Home `/`, a trip detail page (`/trips/[slug]`), the changed page, traveler/organizer/admin dashboard shell if touched |
| Mobile   | 390   | Same routes — check `mobile-bottom-nav` on traveler routes, hamburger/drawer nav on public pages |

### Routes to check by what changed

| Changed | Also screenshot |
| ------- | ---------------- |
| `app/(public)/**` | Home `/`, footer, header nav at both viewports |
| `app/trips/**`, `app/destinations/**` | A real trip/destination detail page (needs seeded data — check `docker:seed` ran) |
| `app/(dashboard)/**`, `app/dashboard/**` | `dashboard-sidebar.tsx` expanded state; the specific page changed |
| `app/admin/**` | `AdminSidebar`, since `admin/layout.tsx` always wraps pages in `Header` + `AdminSidebar` |
| Any `components/shared/data-states.tsx` consumer | Trigger the empty/error state deliberately (e.g. filter to no results, or throttle network) — don't just screenshot the happy path |

If the page needs auth, use the app's real login flow, or — if credentials aren't available — note "not tested, no test account" in the report rather than skipping silently.

---

## Phase 2 — npx Playwright fallback (no MCP)

No npm script exists for this yet. Drive Playwright directly:

```bash
cd apps/web
# one-off screenshot script — write a throwaway script under a scratch path, don't commit it
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000/trips /tmp/trips-desktop.png
npx playwright screenshot --viewport-size=390,844 http://localhost:3000/trips /tmp/trips-mobile.png
```

For anything needing login/interaction (not just a static screenshot), write a throwaway script using `@playwright/test`'s `chromium.launch()` API, run it with `node`, and delete it when done — do not leave stray scripts under `apps/web/` after the review.

If this workflow gets used often, suggest to the user (don't do unasked): add `apps/web/playwright.config.ts`, an `apps/web/e2e/visual/` folder, and a `"test:visual": "playwright test -c playwright.config.ts"` script to `apps/web/package.json`.

Output: write screenshots to a temp/gitignored location (e.g. `/tmp/` or `apps/web/.visual-review/` if you add that path to `.gitignore` first) — never commit screenshots.

---

## Phase 3 — Visual review (read screenshots)

Open every image. Check the inconsistency checklist below.

**Always compare:**

- Header/nav wordmark ("Safarnama") consistent in case/font between public header and dashboard/admin header
- Primary/accent token usage consistent (`primary` teal `#0FBAB5`, `accent` coral `#FF4F33`) — no page introducing its own blue/green CTA color
- Empty/error states actually render `EmptyState`/`ErrorState` from `data-states.tsx`, not a blank area
- Sidebar (dashboard or admin) width/collapsed behavior looks intentional, not clipped
- Mobile bottom nav (traveler routes) doesn't overlap page content or get hidden behind a sticky footer

Cross-reference changed files from `git diff master -- apps/web/src` (branch base may differ — check `git status`/`git log` if unsure of the base branch).

---

## Inconsistency checklist

Mark each item Pass / Fail / N/A while reviewing screenshots.

### Brand & typography

- [ ] "Safarnama" casing/font consistent across public header, dashboard sidebar, admin sidebar, footer
- [ ] `font-display` (Plus Jakarta Sans) used for headings, `font-sans` (Inter) for body — not swapped or mixed within one component
- [ ] Primary/accent/highlight tokens (`#0FBAB5` teal / `#FF4F33` coral / `#7C4DFF` violet) used consistently for CTA vs destructive vs highlight — no stray hex

### Public pages

- [ ] Home hero shows real content above the fold at 1440 and 390 widths — not a blank/loading flash
- [ ] Trip/destination cards show consistent skeleton→content transition (compare `trip-card-skeleton.tsx` render vs loaded state)
- [ ] Mobile (390px): header nav collapses to a usable menu; primary CTA still reachable without horizontal scroll

### Dashboards (traveler / organizer / admin)

- [ ] `AuthGuard`/`RoleGuard` gate renders its loading spinner briefly, then either content or a real "Access Denied" — never a flash of unauthorized content
- [ ] Dashboard/admin sidebar active-route highlight matches the current page
- [ ] `EmptyState` shown (not blank) for zero-result lists (bookings, trips, reviews, wallet transactions)
- [ ] `ErrorState` with working retry shown when a query errors (simulate via network throttling/offline if needed)
- [ ] Mobile: traveler bottom nav visible and not overlapped by page content; no desktop sidebar bleeding into mobile view

### Motion & a11y

- [ ] No content stuck at `opacity-0` (a stalled `animate-fade-in`/`animate-slide-up`)
- [ ] Focus ring visible when tabbing through interactive elements (spot-check one form, one dashboard table)
- [ ] `prefers-reduced-motion` — page still usable (manual spot check optional)

### Cross-page consistency

- [ ] Public pages and dashboard pages feel like one product (shared header/footer treatment, not visually disjoint)
- [ ] No arbitrary hex colors anywhere in the reviewed screenshots — tokens only (cross-check with [travel-ui-stack](../travel-ui-stack/SKILL.md))

---

## Report template

```markdown
## Local visual review — [branch or task]

**Server:** apps/web dev server on http://localhost:[PORT]
**Method:** Puppeteer MCP | npx Playwright fallback
**Screenshots:** [where they were written — /tmp/... — note they were not committed]

### Pass

- [what looks correct]

### Inconsistencies

| Severity | Route              | Issue                              | Screenshot        |
| -------- | ------------------ | ----------------------------------- | ------------------ |
| Critical | /my-bookings       | Blank div instead of EmptyState     | 01-my-bookings.png |
| High     | /dashboard vs /admin | Sidebar accent color differs        | 04-admin-side.png  |

### Recommended fixes (Tier 1 only)

1. ...

### Not tested

- [e.g. no organizer test account — organizer dashboard skipped]
```

Classify: **Critical** (broken UX) · **High** (brand/trust) · **Medium** (polish) · **Low** (nice-to-have).

---

## When to run

| Trigger                                     | Run                                    |
| -------------------------------------------- | --------------------------------------- |
| Changed `apps/web/src/app/**` or `components/**` | Screenshot the changed route + review   |
| Changed `components/shared/data-states.tsx` or any skeleton | Screenshot loading/empty/error states specifically |
| Before merging a UI PR                       | Required                                |
| After fixing a visual bug                    | Re-run same route/viewport, compare      |

Do **not** commit screenshots — write them to `/tmp/` or a gitignored path.

---

## Agent mistakes to avoid

- Screenshotting a page before hydration/data fetch settles → false "empty state" report; wait for real content or an explicit loading indicator, not a fixed sleep
- Assuming port 3000 when Turbopack picked a different port — read the actual terminal output
- Calling Puppeteer MCP against a wedged default session — use the headless-Chrome-plus-`connect_active_tab` recipe instead of retrying blindly
- Claiming a `test:screenshots`/`test:visual` npm script exists in `apps/web/package.json` — it does not; say so and use the raw `npx playwright`/MCP path, or propose adding the script rather than assuming it
- Skipping the mobile (390px) viewport on public-page changes
- Treating this as a two-surface app (landing + dashboard) — it's one Next.js app; don't invent a second dev server or base URL
- Leaving throwaway screenshot scripts or PNGs behind in `apps/web/` after the review
