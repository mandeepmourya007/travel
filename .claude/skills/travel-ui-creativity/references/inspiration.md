# Inspiration, Trust Signals & Anti-patterns

Premium marketplace UI is **interaction-dense, visually sparse** — the craft discipline of Linear/Stripe/Vercel applied to a warm, trustworthy travel-booking product, not a cold enterprise console.

## Premium signals (do)

- Complete microstates on every control (hover, focus, active, disabled, loading) using the primitives in [travel-ui-stack](../travel-ui-stack/SKILL.md)
- Tabular numbers and aligned columns in payment/wallet/cashback tables (admin and traveler)
- Specific, human copy ("You haven't booked any trips yet — explore trips near you" not "No data")
- Consistent token usage from `packages/shared/src/theme/tokens.json` — no one-off grays or ad-hoc hex
- Trust/safety copy near payments, refunds, and organizer verification — calm neutrals (`bg-neutral-50`, `text-neutral-700`), not alarm colors, unless genuinely an error/warning state
- Skeleton loaders (`TripCardSkeleton`, `StatCardSkeleton`, `ProfileSkeleton`) that match the final layout — no layout shift when data lands
- Clear booking/payment status feedback loops (pending → confirmed → paid, escrow states) with badges (`badge-success`/`badge-warning`/`badge-error`)

## Cheap signals (avoid)

- Default browser styling, ad-hoc border radii not in the `borderRadius` token scale
- Walls of same-weight `text-sm text-neutral-800` text with no hierarchy
- A raw spinner centered in an otherwise-blank page for every fetch — use `loading.tsx`/feature skeletons instead
- Missing hover on clickable trip/booking cards or table rows
- Generic `"Something went wrong"` with no retry — always pair with `onRetry` where the underlying query supports refetch
- Decorative gradients, glass panels, or neumorphic shadows on dashboard/admin cards
- Five competing primary-colored buttons on one screen — one `primary` CTA, secondary actions as `outline`/`ghost`
- Animation on every element (motion fatigue) — see [motion.md](motion.md) frequency rule

## Common agent mistakes

| Mistake | Fix |
| ------- | --- |
| Flat hierarchy — everything `text-sm text-neutral-800` | Differentiate title (`font-display font-bold`) / body / meta (`text-neutral-500`/`text-neutral-400`) |
| Missing hover on clickable rows/cards | Add `.card` (built-in hover) or `hover:bg-neutral-50 transition-colors` |
| Inconsistent spacing | Stick to the 4/8/12/16/24/32/48 scale in [typography.md](typography.md) |
| Walls of text | Break into `.card`/`.card-static` sections, bullets, max 2 sentences per block |
| Raw `<div className="spinner">` scattered in pages | Use `Spinner`, route `loading.tsx`, or a feature skeleton |
| Generic empty states | Context-specific message + single CTA via `EmptyState` |
| Label swap on pending buttons ("Saving...") with no visual disabled cue | Pending `Button` state (disabled + spinner icon), not text-only |
| Arbitrary colors (`bg-[#0fbab5]`, `text-[#333]`) | Tokens from [travel-ui-stack](../travel-ui-stack/SKILL.md#design-tokens-tailwind-never-use-arbitrary-hex-values) only |
| Ad-hoc page headers that don't match the app's `<h1 className="font-display text-xl md:text-2xl font-bold text-neutral-900">` convention | Match the existing pattern (there is no shared header component — see the "Known gap" note in travel-ui-stack) |
| Glassmorphism / neumorphism / brutalist cards | Solid `.card`/`.card-static` — `bg-white` + `border-neutral-100` + `shadow-card` |
| Over-animation | One motion purpose per view max |
| Icon buttons without labels | `aria-label` (+ `title` where helpful) |
| Skipping disabled state | Show why disabled (helper text or tooltip), not a silently-clickable dead button |
| Role-gating with `if (user.role === ...)` scattered in JSX | Wrap with `RoleGuard`/`AuthGuard` |

## Inspiration sources (patterns to emulate, not colors to copy)

### Linear ([linear.app](https://linear.app))

- Discipline: tight type, subtle borders, keyboard-first navigation on dense admin/organizer tables (bookings, cashback, payments)
- Motion only on state transitions — almost no decorative animation
- **Emulate:** complete microstates, empty states that feel designed (not placeholder)

### Stripe ([stripe.com/docs](https://stripe.com/docs))

- Restrained accent on a neutral base — maps to this app's `primary`/`accent` used sparingly against `neutral` surfaces
- Tabular numbers, approachable density for financial data (payments, wallet, cashback screens)
- **Emulate:** form focus rings, table alignment, trust-through-clarity in payment/refund copy

### Vercel ([vercel.com/dashboard](https://vercel.com/dashboard))

- Monochrome + surgical accent, high contrast
- Clear status feedback loops — booking/payment status badges, deploy-like progress patterns
- **Emulate:** status badges (`badge-success`/`badge-warning`/`badge-error`), stepped progress for multi-stage flows (booking → payment → confirmation)

### Airbnb ([airbnb.com](https://airbnb.com)) — closer domain analog than oprag's SaaS references

- Warm imagery-forward cards, trust signals (reviews, verified badges) placed near the decision point
- **Emulate:** trip-card visual hierarchy (image → title/location → price/rating → CTA), organizer verification badges, review star display (`star-rating.tsx`)

### Notion ([notion.so](https://notion.so))

- Progressive empty states that teach the product
- Block/card grouping with generous whitespace
- **Emulate:** first-run empty states with a hint of what success looks like (e.g. traveler dashboard before any bookings exist)

## What NOT to copy

- **Glassmorphism as layout** — solid surfaces for readability, accent only
- **Neumorphism** — fails WCAG contrast; wrong for a booking/payments product where clarity matters most
- **Brutalism / neobrutalism** — wrong brand; this is a warm, trust-first travel marketplace, not an edgy dev tool
- **oprag's indigo/warm-paper SaaS palette wholesale** — this app's brand is teal `primary` + coral `accent`; don't default to indigo just because the reference skill used it
