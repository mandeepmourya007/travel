# Local Intel — R&D & Product Plan

Crowd-sourced, category-organized destination tips ("Local Intel") from verified travelers, with Quora-style upvotes, 1-level threaded comments, and report-based moderation — designed for SEO dominance, viral sharing, and a community flywheel that keeps users coming back between bookings.

---

## 1. What Is This Feature?

Travelers who **completed a trip** to a destination can post short, actionable tips ("hacks") for future travelers — like a **community wiki per destination**, but curated by real travelers, not bloggers.

**Examples of tips:**
- "Raju (driver) — reliable, speaks English, ₹2500/day for full Goa sightseeing" → **Local Transport**
- "Skip Baga Beach, go to Butterfly Beach instead — no crowd, stunning" → **Hidden Gems**
- "Ravi's Kitchen near Anjuna — best fish thali ₹180, closes by 8pm" → **Places to Eat**
- "ATMs in South Goa run out of cash by evening, carry enough" → **Money Hack**
- "Don't book water sports on the beach — 3x overpriced vs online" → **Money Hack**

---

## 2. Feature Naming — Options

The name should be: **memorable, action-oriented, hint at insider knowledge, Indian-friendly, and globally scalable.**

| # | Name | Vibe | Pros | Cons |
|---|------|------|------|------|
| 1 | **Trail Notes** | Leaving notes on a trail for the next hiker | Evocative, unique, feels community-driven. "Leave a Trail Note" is a great CTA. | Slightly outdoorsy — might not fit beach/cultural trips |
| 2 | **Local Intel** | Insider intelligence from the ground | Short, punchy, sounds exclusive. "Get the Local Intel on Goa" | Slightly corporate feel |
| 3 | **Trip Hacks** | Life hacks but for travel | Already recognized term (r/TravelHacks = 1M+ users). SEO-friendly. | Generic, not unique to your platform |
| 4 | **Safar Notes** | Safar (सफ़र) = Journey in Hindi | Very Indian, emotional, relatable for Pune/Hindi-speaking audience | Non-Hindi speakers won't connect |
| 5 | **Insider Tips** | Straightforward | Clear, no explanation needed | Boring, every travel site uses "tips" |
| 6 | **Ground Truth** | What you learn only by being there | Techy, unique, implies verified knowledge | Too abstract for casual users |

**Decision: "Local Intel"** — short, punchy, sounds exclusive. "Get the Local Intel on Goa" is a compelling CTA. Works as noun ("read the Local Intel") and adjective ("Local Intel for Goa"). Modern feel that scales globally.

---

## 3. Platform Inspiration — What Works Elsewhere

### A. Tripoto (India) — Community Stories
- **What they do:** 90% UGC — travelers write full travel blogs/itineraries. Forum for Q&A.
- **What works:** SEO goldmine — ranks for "Goa itinerary 3 days", "Manali trip plan". Drove massive organic traffic.
- **What doesn't:** Stories are long-form (30-min write) → low contribution rate. Most users read, few write.
- **Steal this:** SEO-optimized destination pages from UGC. But make contributions **short** (2-min tip vs 30-min blog).

### B. TripAdvisor Forums — Destination Q&A
- **What they do:** Free-form forums per destination. Anyone can ask/answer.
- **What works:** Incredibly useful for niche questions ("Is Goa safe in monsoon?"). High Google ranking.
- **What doesn't:** Zero structure, old-school forum UX, no categorization, buried gold among noise.
- **Steal this:** Community knowledge per destination. But **add structure** (categories, upvotes).

### C. Wikivoyage — Structured Destination Guides
- **What they do:** Wiki-style guides with fixed sections: See, Do, Eat, Drink, Get Around, Stay Safe, Buy.
- **What works:** Best structure for destination information. Easy to scan. Consistent across destinations.
- **What doesn't:** Wiki editing is intimidating. No gamification. Looks like Wikipedia (boring).
- **Steal this:** Fixed category structure. It's the backbone.

### D. Google Local Guides — Gamification Engine
- **What they do:** Points → Levels (1-10) → Badges. Earn points for reviews, photos, answers, edits.
- **What works:** 120M+ contributors globally. Gamification drives massive free content. "Level 7 Local Guide" badge creates status.
- **What doesn't:** Quality varies wildly. Points incentivize quantity over quality.
- **Steal this:** Points + levels + badges system. But gate contributions to **verified travelers only** (quality > quantity).

### E. Foursquare/Swarm — Short-Form Tips
- **What they do:** 200-char tips tied to specific venues. Upvotes. Categories.
- **What works:** Quick to write, quick to read. Perfect for mobile.
- **What doesn't:** Died because no booking conversion — tips existed in isolation.
- **Steal this:** Short-form format (title + 500 char max). Tips should be snackable.

### F. Reddit r/TravelHacks — Community Virality
- **What they do:** Community-posted travel tips. Upvote/downvote. 1M+ members.
- **What works:** Upvote system surfaces best content. "X people found this helpful" drives trust.
- **What doesn't:** No structure, no destination pages, no booking flow.
- **Steal this:** Upvote system + "X travelers tried this" counter.

---

## 4. Categories (Fixed)

Based on Wikivoyage's proven structure, adapted for Indian group travel:

| # | Category | Icon | Example Tip |
|---|----------|------|-------------|
| 1 | **Places to Visit** | 📍 | "Butterfly Beach — no crowd, stunning sunset" |
| 2 | **Places to Eat** | 🍽️ | "Ravi's Kitchen near Anjuna — best fish thali ₹180" |
| 3 | **Local Transport** | 🚗 | "Raju driver — reliable, ₹2500/day, speaks English" |
| 4 | **Hidden Gems** | 💎 | "Abandoned church near Chapora Fort — incredible photos" |
| 5 | **Safety Tips** | 🛡️ | "Avoid Calangute Beach road after 11pm — no streetlights" |
| 6 | **Money Hacks** | 💰 | "Book water sports online — 3x cheaper than beach vendors" |
| 7 | **Accommodation** | 🏨 | "Zostel Goa Anjuna — best budget hostel, ₹600/night" |
| 8 | **Pro Tips** | ⚡ | "Carry mosquito repellent — South Goa gets bad in evenings" |

**Why fixed categories, not free-form tags:**
- Consistent UX across all destinations
- Easier to filter and scan
- Better SEO (each category becomes an indexed page: `/destinations/goa/tips/places-to-eat`)
- Prevents tag chaos ("food" vs "eating" vs "restaurant" vs "dhaba")

---

## 5. UX — How It Looks

### 5A. Entry Points (Where Users Discover Tips)

1. **Destination Page** → New "Local Intel" tab (alongside Trips, Reviews)
2. **Trip Detail Page** → "Local Intel for Goa" section at bottom
3. **Post-Trip Notification** → "You visited Goa! Share your intel for others 🎉"
4. **Homepage** → "Trending Local Intel" carousel
5. **User Profile** → "My Intel" tab showing all contributions

### 5B. Destination Tips Page (`/destinations/goa/tips`)

```
┌─────────────────────────────────────────────────────────┐
│  ← Goa                                  [Share Intel] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  LOCAL INTEL FOR GOA                                     │
│  287 tips from 142 verified travelers                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ [All] [📍Visit] [🍽️Eat] [🚗Transport] [💎Gems]  │    │
│  │ [🛡️Safety] [💰Money] [🏨Stay] [⚡Pro Tips]       │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  Sort: [Most Helpful ▼]  [Newest]  [Most Tried]         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 💎 HIDDEN GEM                                    │    │
│  │                                                   │    │
│  │ "Butterfly Beach — Skip Baga, Come Here"          │    │
│  │                                                   │    │
│  │ No crowd, stunning sunset view, best photos.      │    │
│  │ Take a boat from Palolem (₹300 return). Go        │    │
│  │ before 4pm for best light.                        │    │
│  │                                                   │    │
│  │ [📸 Photo] [📸 Photo]                             │    │
│  │                                                   │    │
│  │ 👤 Priya S. • Traveled Dec 2025                   │    │
│  │    via "Goa Beach Getaway" by TripVibes           │    │
│  │                                                   │    │
│  │ 👍 47 helpful  •  💬 5 comments  •  [Share] [⚑]   │    │
│  │                                                   │    │
│  │ 💬 COMMENTS (5)                                   │    │
│  │ ┌─ Sneha R. • Dec 2025                            │    │
│  │ │  "Went here! Boat costs ₹400 now, not 300"     │    │
│  │ │  👍 8  •  Reply                                 │    │
│  │ │                                                 │    │
│  │ │  └─ Priya S. (author) • Reply                   │    │
│  │ │     "Thanks for the update! Prices change fast" │    │
│  │ │     👍 3                                        │    │
│  │ └─ Rahul M. • Jan 2026                            │    │
│  │    "Also try the cliff jumping nearby — amazing" │    │
│  │    👍 4  •  Reply                                 │    │
│  │                                                   │    │
│  │ [Write a comment...]                              │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 🚗 LOCAL TRANSPORT                               │    │
│  │                                                   │    │
│  │ "Raju — Best Driver in South Goa"                 │    │
│  │                                                   │    │
│  │ Reliable, punctual, speaks English. Knows all     │    │
│  │ the hidden spots. ₹2500/day for full day.         │    │
│  │ Book 2 days in advance.                           │    │
│  │                                                   │    │
│  │ 👤 Amit K. • Traveled Nov 2025                    │    │
│  │    via "South Goa Explorer" by GoWander           │    │
│  │                                                   │    │
│  │ 👍 31 helpful  •  💬 2 comments  •  [Share] [⚑]   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [Load More]                                             │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  🔥 TOP CONTRIBUTORS FOR GOA                             │
│  1. Priya S. (12 tips) — 🏅 Goa Expert                  │
│  2. Amit K. (8 tips) — 🥈                                │
│  3. Sneha R. (6 tips) — 🥉                               │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  TRIPS TO GOA →                                          │
│  [Trip Card] [Trip Card] [Trip Card]                     │
└─────────────────────────────────────────────────────────┘
```

### 5C. Write a Tip (Modal/Page)

```
┌─────────────────────────────────────────────────────────┐
│  SHARE YOUR LOCAL INTEL                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Destination: Goa (auto-filled from your trip)           │
│  Your Trip: "Goa Beach Getaway" — Dec 6-8, 2025         │
│                                                          │
│  Category: [💎 Hidden Gems ▼]                            │
│                                                          │
│  Title: [Butterfly Beach — Skip Baga, Come Here    ]     │
│          (max 80 chars)                                  │
│                                                          │
│  Your Tip:                                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │ No crowd, stunning sunset view, best photos.     │    │
│  │ Take a boat from Palolem (₹300 return). Go       │    │
│  │ before 4pm for best light.                        │    │
│  └──────────────────────────────────────────────────┘    │
│  (50-500 characters)                                     │
│                                                          │
│  Photos (optional):                                      │
│  [📷] [📷] [+ Add] (up to 3)                             │
│                                                          │
│  [Post Intel]                                            │
│                                                          │
│  ℹ️ Only visible after moderation check (~1 hour)         │
└─────────────────────────────────────────────────────────┘
```

### 5D. Tip Card for Social Sharing (Auto-Generated OG Image)

```
┌──────────────────────────────────────┐
│  💎 HIDDEN GEM — GOA                 │
│                                      │
│  "Butterfly Beach —                  │
│   Skip Baga, Come Here"             │
│                                      │
│  — Priya S., verified traveler       │
│                                      │
│  [YourPlatform Logo]                 │
│  yourplatform.com/destinations/goa   │
└──────────────────────────────────────┘
```
This card auto-generates when someone shares a tip link on WhatsApp/Instagram/Twitter — free marketing.

---

## 6. Virality & Growth Mechanics

### 6A. SEO Moat (Organic Traffic Engine)

Each destination + category combo becomes a Google-indexed page:
- `/destinations/goa/tips` → "Goa travel tips"
- `/destinations/goa/tips/places-to-eat` → "best places to eat in Goa"
- `/destinations/goa/tips/local-transport` → "best driver in Goa"
- `/destinations/manali/tips/hidden-gems` → "hidden places in Manali"

**This is how Tripoto grew.** 90% UGC → massive long-tail SEO → organic traffic → bookings. With 50 destinations × 8 categories = **400 indexed pages** from day one, growing with every contribution.

### 6B. Post-Trip Contribution Nudge

```
Trigger: Booking status → COMPLETED + 24h delay
Channel: Push notification + Email + In-app

"Hey Priya! 🎉 You just came back from Goa!
Got any intel for fellow travelers?
Share your Local Intel and help the next traveler."

[Share Local Intel →]
```

**Why 24h delay:** Gives time to settle, but catches them while memories are fresh. Tripoto found that post-trip is the highest-intent moment for UGC.

### 6C. Interaction Model — Upvotes, Comments, Reports

**Upvotes (Quora-style, no downvote):**
- One upvote per user per tip (toggle on/off)
- Upvote count displayed as "X helpful"
- Sort by "Most Helpful" uses upvote count
- No downvote — prevents negativity in a community feature

**Comments (1-level threading, like YouTube):**
- Top-level comments + replies (max 1 level deep)
- **Who can comment:** Verified travelers (completed trip to that destination) + the tip author (can reply to any comment on their tip)
- Comments are upvotable too (same mechanism)
- Author replies are highlighted with "Author" badge
- Comments sorted by upvotes within each tip
- Show top 2 comments by default, "View all X comments" to expand

**Why comments matter for virality:**
- Comments add **freshness** — "Prices went up to ₹400 now" keeps tips current
- Comments add **depth** — follow-up questions get answered by the community
- Comments **increase time-on-page** — SEO signal (Google ranks pages with engagement higher)
- Comments create **notifications** — brings users back to the platform

**Report (instead of downvote):**
- Report reasons: Incorrect/Outdated, Spam, Offensive, Contains personal contact info
- 3+ reports → auto-hide tip, send to admin moderation queue
- Admin can: Approve (restore), Edit, or Remove
- Reporter gets notified of outcome

### 6D. Gamification System (Google Local Guides Inspired)

| Action | Points |
|--------|--------|
| Post a tip | +10 |
| Post a comment | +3 |
| Tip gets 10+ upvotes | +5 bonus |
| Tip gets 25+ upvotes | +10 bonus |
| Comment gets 5+ upvotes | +3 bonus |
| Add photo to tip | +3 per photo |

| Level | Points | Title | Badge |
|-------|--------|-------|-------|
| 1 | 0 | Newbie | — |
| 2 | 15 | Explorer | 🌱 |
| 3 | 50 | Pathfinder | 🧭 |
| 4 | 100 | Trail Blazer | 🔥 |
| 5 | 250 | Local Legend | 🏆 |

**Destination-specific badges:**
- "Goa Guru" — 5+ tips for Goa with 10+ total upvotes
- "Food Scout" — 5+ tips in "Places to Eat" category
- "Safety First" — 3+ safety tips

**Where badges show:**
- Next to username on all tips
- On user profile page
- On booking confirmations ("Booked by Priya 🏆 Local Legend")

### 6E. Share Mechanics

- **WhatsApp share button** on every tip (India's #1 sharing channel)
- **Auto-generated OG image** for link previews (Section 5D above)
- **"Share your tip on Instagram Stories"** → template overlay with platform branding
- **Weekly email digest:** "Top 5 Local Intel this week" → drives re-engagement

### 6F. Content → Booking Flywheel

```
User reads tip about Goa → Sees "TRIPS TO GOA →" section below
→ Books a trip → Completes trip → Posts their own tips
→ Their friends see shared tip → Visit platform → Book trip → ∞
```

This is the **network effect loop**:
More tips → More useful → More visitors → More bookings → More completed trips → More tips

---

## 7. How This Helps the Platform

| Benefit | Impact | How |
|---------|--------|-----|
| **SEO** | 🔥🔥🔥 | 400+ indexed pages, long-tail keywords, organic Google traffic |
| **Retention** | 🔥🔥🔥 | Users come back to read tips even when not booking |
| **Trust** | 🔥🔥 | "287 verified travelers shared tips" → booking confidence |
| **Content for free** | 🔥🔥🔥 | Users create content — no content team needed |
| **Differentiation** | 🔥🔥🔥 | No group travel aggregator has this. Unique moat. |
| **Social sharing** | 🔥🔥 | Auto-generated share cards → free marketing |
| **Anti-leakage** | 🔥 | Users stay on platform for tips, not just booking |
| **Upsell** | 🔥🔥 | Every tips page has "Trips to [Destination]" CTA |

---

## 8. MVP vs Phase 2 Scope

### MVP (Build Now)

- [ ] Tips tied to Destination (existing model)
- [ ] 8 fixed categories (enum)
- [ ] Title + content + photos (up to 3)
- [ ] Only verified travelers can post tips (COMPLETED booking to that destination)
- [ ] Upvote ("helpful") — no downvote, one per user per tip
- [ ] 1-level threaded comments (verified travelers + tip author)
- [ ] Comment upvotes
- [ ] Report tip (Incorrect, Spam, Offensive, Contact info) → 3 reports = auto-hide
- [ ] Destination tips page with category filter tabs
- [ ] Sort by: Most Helpful, Newest, Most Discussed
- [ ] Post-trip nudge notification
- [ ] Basic moderation (admin approve/reject queue for reported tips)
- [ ] Tip author shows verified trip name + date
- [ ] Author badge on comment replies
- [ ] WhatsApp share button
- [ ] SEO: destination/tips pages with meta tags

### Phase 2 (After Launch)

- [ ] Points + Levels + Badges (gamification system)
- [ ] Destination-specific badges ("Goa Guru")
- [ ] Auto-generated OG share cards
- [ ] Map view — pinned tips on a map
- [ ] Contact directory (verified drivers/guides — separate from tips)
- [ ] Weekly email digest ("Top Local Intel this week")
- [ ] AI-summarized "Quick Guide" per destination (aggregate top tips)
- [ ] "Follow a destination" → get notified on new tips
- [ ] Comment notifications (someone replied to your comment)
- [ ] Edit tip within 48h window

---

## 9. Decisions Made

| # | Decision | Choice |
|---|----------|--------|
| 1 | **Feature name** | Local Intel |
| 2 | **Upvote model** | Upvote + Report (no downvote) |
| 3 | **Who can comment** | Verified travelers + tip author |
| 4 | **Comment threading** | 1-level deep (YouTube style) |
| 5 | **Who can post tips** | Only verified travelers (COMPLETED booking) |

### Still Open

1. **Contact info in tips** — Should users be allowed to share driver phone numbers? Risk: platform leakage. Option: "Contact via platform" or masked contacts.
2. **Moderation** — Auto-publish with report flag (MVP) or manual admin queue first?
3. **Tip editing** — Allow edit within 48h? (Recommend: yes)
4. **Anonymous tips** — Allow? (Recommend: no — verified identity builds trust)

---

## 10. Technical Fit with Existing Architecture

This feature fits cleanly into the existing system:

- **Destination model already exists** — tips link via `destinationId` FK
- **User model** — tips link via `userId` FK  
- **Booking model** — verification query: "Does user have a COMPLETED booking for this destination?"
- **Cloudinary** — already set up for photo uploads
- **Notification system** — already exists for post-trip nudge
- **Soft-delete mixin** — applies to tips table
- **Repository + Service pattern** — standard CRUD + authorization logic

New tables needed:
- `DestinationTip` — the tip itself (title, content, category, photos, destinationId, userId, bookingId)
- `TipVote` — upvote tracking (tipId, userId) — also used for comment upvotes
- `TipComment` — comments on tips (tipId, userId, parentCommentId for threading)
- `TipReport` — report tracking (tipId, userId, reason, status)

---

*This document is for product planning only. Implementation will follow the `/build-feature` workflow once decisions are finalized.*
