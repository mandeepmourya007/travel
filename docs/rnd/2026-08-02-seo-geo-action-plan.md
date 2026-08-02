# Tripeeeh (formerly Safarnama) SEO + GEO Action Plan (2026-08-02)

**Domain/infra correction (superseding the first pass of this audit):** the app has two live environments — **staging** at `safarnama.store` on Render, and **production** at `https://tripeeeh.com` on AWS EC2 (nginx). The brand shown live on prod is **"Tripeeeh"** (`APP_NAME=Tripeeeh` set on EC2), not "Safarnama" — the codebase's default (`constants.ts`) is still `Safarnama`, which is what staging shows. All findings below have been re-verified directly against `https://tripeeeh.com` (prod) after the correction. Note the contact email domain (`tripeeeh.com`, seen in the Organization schema/llms.txt) matches the real prod domain — that mismatch flagged in the first pass is resolved; it's actually the correct domain, and "Safarnama"/`safarnama.store` is the one that's now the outlier (staging only).

Synthesizes: (1) a live technical/on-page/GEO audit run directly against `https://tripeeeh.com` production, and (2) [`2026-08-02-seo-geo-research.md`](./2026-08-02-seo-geo-research.md) — cited keyword/competitor/GEO research by the market-researcher agent (written under the "Safarnama" framing before this correction; the underlying product, competitors, and keyword strategy are unaffected by the brand-name change — read "Tripeeeh" wherever it says "Safarnama"). Read that file for full sourcing; this file is the prioritized "what to do" synthesis.

**Positioning reality check (from research):** Tripeeeh's SEO lane is *not* MakeMyTrip/EasyMyTrip/Goibibo — those win via 100M+/mo programmatic scale (MakeMyTrip: 2.6M ranking keywords) or brand marketing budgets neither we nor most competitors can match. Our real SEO competitive set is the **group-trip / trip-organizer marketplace niche**: Thrillophilia, Indiahikes, Bikat Adventures, Pickyourtrail, JoinMyTrip. That's a winnable fight — Thrillophilia and Indiahikes win with *fewer, deeper* pages (geography × activity taxonomy + authority content), not brute force. JoinMyTrip, the closest direct P2P-marketplace comp, is losing traffic (-18.35% MoM) — evidence that a thin marketplace with no content layer doesn't win organically. That's the gap we build into.

---

## Critical — fix before anything else matters

### 1. Staging (`safarnama.store` on Render) canonicalizes to `localhost:3000` — production is NOT affected

**Re-verified directly against prod (`https://tripeeeh.com`, EC2): canonical tags, sitemap, `og:url`, and `llms.txt` links are all correct** — `https://tripeeeh.com/...` throughout, confirmed via curl. The `localhost:3000` canonicalization bug found in the first pass of this audit is real, but it only affects the **staging** deployment on Render (`safarnama.store`), where `NEXT_PUBLIC_SITE_URL` is unset/wrong. Root cause is unchanged: `apps/web/src/lib/constants.ts` falls back to `http://localhost:3000` when the env var is missing, and `render.yaml` has `NEXT_PUBLIC_SITE_URL: sync: false` (manually set in Render's dashboard) with a comment suggesting `https://safarnama-web.onrender.com` rather than the actual custom domain.

**Downgraded from Critical (prod) to Medium (staging hygiene).** Still worth fixing so staging reflects real crawlable behavior and QA doesn't miss regressions — but it is **not** blocking indexing or GEO on the live site.

**Action:** set `NEXT_PUBLIC_SITE_URL=https://safarnama.store` on the Render `apps/web` service, trigger a full rebuild (`NEXT_PUBLIC_*` vars are inlined at build time). Verify: `curl -s https://safarnama.store/sitemap.xml | grep -c localhost` → `0`.

### 2. Duplicate site name in `<title>` tags — fixed in code, confirmed live on prod too

Confirmed via curl against **prod** (`tripeeeh.com`): `/trips`, `/destinations`, `/how-it-works` and others render `"X | Tripeeeh | Tripeeeh"` — the root layout's `title.template` (`%s | ${APP_NAME}`) was appending the brand name on top of child pages that *also* hardcoded `| ${APP_NAME}`. This is a code bug, not an env issue, so it's live on both staging and prod. Wastes ~12 characters of Google's ~60-char title budget and looks broken in SERPs.

**Fixed in this session** — stripped the redundant `| ${APP_NAME}` suffix from 16 files' top-level `metadata.title` (left `openGraph.title`/`twitter.title` untouched since those aren't templated). `npm run type-check --workspace=apps/web` passes clean. **Not yet deployed** — this needs a commit + your EC2 deploy path (`deploy-prod.sh`) to reach production, not a Render redeploy.

### 3. `llms.txt` failed Lighthouse's "agentic browsing" check — fixed in code

Confirmed via Lighthouse against **prod**: `llms-txt` audit scored 0 with the reason *"File does not appear to contain any links"* — the "Key Pages" section used plain-text bullets (`- Homepage: https://tripeeeh.com/`) instead of Markdown link syntax. Not related to the staging localhost bug — prod's URLs were already correct, just not formatted as links.

**Fixed in this session** — converted all 10 "Key Pages" entries in `apps/web/src/app/llms.txt/route.ts` to `[Label](url)` Markdown link syntax. `type-check` passes. Not yet deployed.

---

## High priority

### 3. No content/blog layer — the single biggest structural gap vs. every SEO-winning competitor in this niche

Confirmed: `apps/web/src/app` has zero `/blog`, `/guide`, or definitional content routes — only transactional pages (`/trips`, `/destinations`, legal pages) and their dynamic detail routes. Per the research, this is exactly the layer Thrillophilia and Indiahikes use to win: geography × activity-tag taxonomy plus authority content (blogs, itinerary guides, safety/prep content) layered on top of listings. MakeMyTrip wins by brute-force programmatic scale instead — not a model we can or should copy at current size.

**Action:** stand up a content section (`/guides` or similar) and start filling it using the content gap list below, prioritized by how directly each ties to a real Tripeeeh differentiator (escrow refunds, KYC verification) rather than generic travel content that any blog could write.

### 4. GEO schema/citability gaps

Lighthouse's "Agentic Browsing" audit against prod (33/100) flagged, after re-verification:
- **`llms.txt` link-format issue — fixed in code** (see §3 above). Not a `localhost`/env issue; prod's URLs were correct, just not Markdown links. Re-run Lighthouse post-deploy to confirm the score moves.
- **Accessibility tree not well-formed — still open.** Matters for GEO specifically because AI agentic browsers (and increasingly ChatGPT/Claude "browse" modes) parse the accessibility tree, not just visible HTML, to understand page structure.

Per the research (§3 of the research doc): AI engines cite **brand/YouTube mentions ~3x more reliably than backlinks** (0.664–0.737 vs. 0.218 correlation, Ahrefs 75k-brand study), fresh/dated content earns ~3.2x more Perplexity citations, and only 12% of AI-cited URLs also rank in Google's top 10 — GEO is a genuinely separate channel, not a byproduct of classic SEO.

**Action:**
- Fix the accessibility tree issues flagged by Lighthouse (`aria-prohibited-attr`, `color-contrast`, `link-name`, `label-content-name-mismatch` — all failed in the same audit run) — dual benefit for accessibility score (currently 89) and AI-agent parseability.
- Actively pursue *mentions* — Reddit threads (r/india, r/IndiaTravel, r/backpacking), YouTube trip vlogs mentioning Tripeeeh by name, press — over pure backlink building.
- Keep `llms.txt` current as new trip/organizer FAQ content ships; the link-format fix means it now matches spec.

---

## Medium priority — keyword & content strategy

**Reality on keyword volume (from research §1):** no tool (Ahrefs/SEMrush/Ubersuggest/Google Trends) publishes India-specific volume for our actual target phrases — "group trip," "trip organizer," "Manali group trip package," etc. This is a genuine data gap, not a research shortcut — treat zero tool-volume as **"untracked," not "no demand."** The proof: "trekking groups India" shows a dozen+ real operators crowding page 1 with no disclosed volume number anywhere — real demand keyword tools simply don't surface for this niche. Validate actual volume later via Google Search Console once pages are indexed, or Keyword Planner with an India geo-filter.

**20 content opportunities identified (full list with rationale in the research doc, §4) — top 8 by directness to a real Safarnama differentiator:**

| # | Topic | Why it's ours to win |
|---|---|---|
| 5 | "What happens if a trip organizer cancels?" / cancellation policy trust content | Directly showcases Safarnama's 100%-automatic-refund escrow model — no competitor content found addressing this |
| 14 | "Is UPI payment to a trip organizer safe or a scam?" | Targets the WhatsApp+UPI informal-organizer risk head-on — zero competitor content found on this |
| 19 | "Refund policy: platform vs. WhatsApp organizer" comparison | Comparison-table format no competitor runs, tied to a real feature |
| 3 | "Is [organizer] legit?" / organizer reputation pages | Only an aggregator with verified, booking-gated reviews can credibly produce this |
| 4 | "[Organizer A] vs [Organizer B] [destination] trip" comparisons | Only an aggregator can produce head-to-head comparisons; zero competitors do |
| 9 | Seasonal programmatic pages ("Manali group trips December 2026") | Mirrors MakeMyTrip's programmatic model but powered by live listing data — stays fresher than any static competitor blog post (fresh content → Perplexity citation advantage) |
| 15 | "Best time to book [destination] for lowest price" | Buildable from Safarnama's own historical pricing/booking data — a moat competitors without transaction data cannot replicate |
| 20 | "What is a trip organizer platform?" glossary/definitional page | ChatGPT sources ~48% from Wikipedia — encyclopedic, definitional framing is the content type it favors most |

Remaining 12 opportunities (city+organizer directories, solo-traveler-joins-group angle, corporate offsite pages, women-only segment, etc.) are in the research doc §4 — sequence them after the above 8 land and start generating indexed pages/traffic signal.

**Explicitly not pursuing:** generic head terms ("best travel packages," "cheap flights") — confirmed as MakeMyTrip/Goibibo's dominated territory (2.6M ranking keywords), not a fight worth entering.

---

## Prioritized action list

| Priority | Action | Owner | Unblocks |
|---|---|---|---|
| P0 | Deploy the two code fixes already made (title-tag dedup, `llms.txt` Markdown links) to **prod** via `deploy-prod.sh` on EC2 | You | Cleaner SERP snippets + passing agentic-browsing llms.txt check, live |
| P1 | Fix Lighthouse-flagged accessibility issues (aria-prohibited-attr, color-contrast, link-name, label-content-name-mismatch) | frontend-engineer / ui-ux-engineer | Accessibility score + AI-agent page comprehension |
| P1 | Stand up `/guides` content section; publish first 3 pieces from the top-8 list above | product-manager (brief) → frontend/fullstack-engineer | Long-tail organic entry + GEO citation surface |
| P2 | Fix `NEXT_PUBLIC_SITE_URL` on Render so staging matches prod's correct canonicalization (staging-only, not blocking) | infra-engineer | Staging parity / avoids masking future regressions in QA |
| P2 | Re-run Lighthouse against `https://tripeeeh.com` post-deploy to confirm agentic-browsing score moved | You | Confirms the llms.txt fix landed |
| P2 | Build seasonal programmatic destination×month pages from live trip data | fullstack-engineer | Freshness-driven Perplexity/GEO citation advantage, MakeMyTrip-style scale without static content debt |
| P3 | Pursue brand/YouTube/Reddit mentions (not just backlinks) | Growth/marketing | AI-citation correlates 3x stronger with mentions than backlinks per Ahrefs study |
| P3 | Validate real India search volume via GSC/Keyword Planner once pages are indexed | Growth/marketing | Replaces "unverified" keyword volume with real click data |
| P3 | Reconcile brand naming — decide whether "Tripeeeh" (live prod) or "Safarnama" (code default, staging) is the go-forward name, and update `APP_NAME` default + any stale references accordingly | You | Avoids the two-brand confusion this audit ran into |

**Leading indicators to monitor without re-running a full audit:** `site:tripeeeh.com` indexed page count in Google Search Console, `llms.txt` Lighthouse agentic-browsing sub-score on prod, and organic sessions to any new `/guides` page in the first 30 days post-publish.
