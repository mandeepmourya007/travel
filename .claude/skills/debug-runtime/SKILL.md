---
name: debug-runtime
description: Debug runtime/client-side bugs in this Next.js + Express + Prisma app that DON'T show up in logs or curl — stuck loaders/spinners, login or redirect loops ("logged in but bounced to login"), pages that hydrate but stay blank, "works in curl but not the browser", auth/session weirdness. Use when SSR returns 200 and the API works but the UI is broken in the browser.
---

# Debugging runtime / client-side bugs

This app: **Next.js 14 (App Router) web** + **Express/Prisma API** + **Docker dev stack** (`npm run docker:up`). The hardest bugs here are **client-side**: SSR returns 200, the API is fine, but the browser UI is broken. Logs and `curl` will lie to you — you must drive a real browser.

## Core principle
**Server-side healthy ≠ the page works.** If `curl` of the page is 200, all JS chunks are 200, and the API endpoints return fast — and the UI is still broken — the bug is in **client hydration / client state**, which only a real browser reveals. Stop theorizing; get into the browser and add targeted logs.

## Step 1 — Triage: server vs client (fast, no browser)
```bash
# Page SSR ok?
curl -s -m 90 -o /tmp/p.html -w "HTTP %{http_code} %{time_total}s\n" http://localhost:3000/<route>
# JS chunks load? (NOTE: turbopack chunk names contain [ ] — curl needs -g or it 000s on the glob)
grep -oE '/_next/[^"]+\.js' /tmp/p.html | sort -u | while read s; do
  echo "$(curl -g -s -m 20 -o /dev/null -w '%{http_code}' "http://localhost:3000$s")  $s"; done
# Backing API fast?
curl -s -m 15 -o /dev/null -w "%{http_code} %{time_total}s\n" http://localhost:4001/api/v1/<endpoint>
# Web container errors?
docker logs travel-web --since 3m 2>&1 | grep -iE "error|unhandled|failed to pipe|hydrat" | tail
```
If all green but UI broken → it's client-side. Go to Step 2.

## Step 2 — Drive a real browser (the part that actually finds bugs)
The Puppeteer MCP's **default browser frequently wedges** ("Attempted to use detached Frame", "ERR_EMPTY_RESPONSE", navigation timeouts). When it does, **launch your own headless Chrome with remote debugging and connect to it** — it's a fresh, reliable session (and a clean profile = like incognito):
```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
rm -rf /tmp/chrome-debug
"$CHROME" --remote-debugging-port=9222 --headless=new --no-first-run \
  --no-default-browser-check --user-data-dir=/tmp/chrome-debug about:blank &  # run in background
sleep 2; curl -s http://127.0.0.1:9222/json/version   # confirm it's up
```
Then in the Puppeteer MCP: `puppeteer_connect_active_tab` (debugPort 9222) → `puppeteer_navigate` → `puppeteer_evaluate`. Kill it after: `lsof -ti:9222 | xargs kill`.

**`puppeteer_evaluate` gotchas:**
- It returns `undefined` for return values and **does NOT await promises** — capture results with `console.log(...)`; the MCP shows them under "Console output".
- Errors during initial hydration happen *before* you can attach a listener via evaluate → use the on-page banner (Step 3).
- `localhost` may resolve to IPv6; if navigation fails, the headless-chrome+connect path avoids this.

Read the live state synchronously:
```js
console.log(JSON.stringify({
  url: location.href,
  spinner: !!document.querySelector('.spinner'),
  form: !!document.querySelector('input#email'),
  authLS: localStorage.getItem('travel-auth'),
  reactHydrated: !!(function(){var s=document.querySelector('.spinner');return s&&Object.keys(s).find(k=>k.startsWith('__reactFiber'))})(),
  text: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,150)
}))
```

## Step 3 — Inject diagnostics that survive the failure
- **On-page error banner** (catches errors that happen *before* React hydrates — runs at HTML parse): add a raw `<script dangerouslySetInnerHTML>` as the first child of `<body>` in `apps/web/src/app/layout.tsx`:
  ```js
  window.addEventListener('error', e => paintBanner('JS ERROR: ' + (e.error?.stack||e.message)))
  window.addEventListener('unhandledrejection', e => paintBanner('REJECT: ' + (e.reason?.stack||e.reason)))
  setTimeout(() => { if (document.querySelector('.spinner')) paintBanner('STILL SPINNING, no error. authLS='+localStorage.getItem('travel-auth')) }, 5000)
  ```
- **`window.__flag` markers** in the suspect module (e.g. did `onRehydrateStorage` fire? which branch?) — read via `puppeteer_evaluate`. zustand `onRehydrateStorage: () => (state, error) => {...}` — the **`error` arg surfaced the TDZ ReferenceError** in this codebase.
- **Survives-redirect** (when the page redirects away before you can read console): write the reason to `sessionStorage` and read it after the redirect.
- Always **remove all diagnostics** when done: `grep -rn "__flag\|\[DIAG\]" apps/web/src` should return 0.

## Step 4 — Docker dev-stack mechanics (critical — don't get fooled)
- Compose mounts **only** `apps/web/src` and `packages/shared/src`. So:
  - **`.ts/.tsx` under `src/`** → hot-reload, no rebuild.
  - **`next.config.js`, `package.json`, deps, Prisma schema** → **must rebuild the image**: `docker compose build web && docker compose up -d web` (a `restart` reuses the old baked file — this wasted real time).
- **Metadata/route-convention changes** (icon files, layout edits) sometimes need a `docker compose restart web` (HMR doesn't always recompile the root layout).
- **Fast Refresh contaminates live testing**: editing files while the user has the page open triggers `[Fast Refresh] rebuilding`, which **resets zustand stores → false "logged out" bounces**. When verifying a fix with the user, STOP editing/restarting and have them test once cleanly.
- Health/logs: `docker inspect travel-web --format '{{.State.Health.Status}}'`, `docker logs travel-web --tail 40`.

## Known gotchas in THIS codebase (check these first)
- **zustand `persist` + TDZ**: `onRehydrateStorage` runs *synchronously during `create()`* with localStorage. Calling `useStore.setState(...)` there throws `ReferenceError: Cannot access 'useStore' before initialization` → `_hasHydrated` never flips → **stuck spinner**. Fix: `queueMicrotask(() => useStore.setState(...))`. (`apps/web/src/store/auth.store.ts`)
- **react-query per-call callbacks dropped on unmount**: `mutate(vars, { onSuccess })` does NOT fire if the calling component unmounts before the mutation resolves; **mutation-level** `useMutation({ onSuccess })` does. Symptom: login succeeds (`setAuth` ran, navbar shows name) but **redirect never happens** because the page swapped to a spinner and unmounted the button. Put success/redirect logic at the mutation level. (`apps/web/src/hooks/use-google-auth.ts`)
- **"logged in but bounced to login"**: `api-client.ts` does `clearAuth()` + redirect when a 401 → `/auth/refresh` also fails. Usually means a **dead refresh-token cookie** — almost always **stale browser state after a DB reset**. Fix: clear site data / incognito. If there's **no `/auth/refresh` in the Network tab**, it's NOT this path — look at the redirect/unmount logic instead.
- **`zod .uuid()` rejects UUIDv7** (only allows v1–5). IDs use UUIDv7 — validate with the shared `idSchema` (accepts cuid + uuid), never `z.string().uuid()`. (See [[project_id_strategy]].)
- **Benign console noise** (don't chase): `Cross-Origin-Opener-Policy ... postMessage` (from Google's GSI page), `message channel closed before a response` (a Chrome extension). A 403 on `accounts.google.com/gsi/button` is an **Authorized JavaScript origins** config issue (add `http://localhost:3000` in Google Cloud Console), not app code.

## Workflow summary
1. `curl` triage → confirm server-side is fine.
2. Launch headless Chrome + `connect_active_tab` → reproduce, read DOM/state.
3. Inject on-page banner + `window`/`sessionStorage` flags in the suspect module.
4. Restart/rebuild correctly (mount vs rebuild), navigate fresh, read the flag.
5. Identify the exact failing line → fix → verify in-browser → **remove all diagnostics** → typecheck.
6. When confirming with the user, stop touching the server so Fast Refresh can't cause false bounces.
