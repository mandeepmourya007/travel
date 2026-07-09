# Typography & Spacing

**Base:** Inter 14–16px (`font-sans`) body, Plus Jakarta Sans (`font-display`) for headings. `h1`/`h2`/`h3` get `font-display` automatically via `globals.css` (`h1, h2, h3 { @apply font-display; }`) — don't add `font-display` redundantly to those tags, but do add it explicitly on `<p>`/`<span>` elements styled as a heading-weight stat or title.

There is currently **no shared page-title utility class** (no `.text-page-title` equivalent) — pages use `<h1 className="font-display text-xl md:text-2xl font-bold text-neutral-900">` directly (see `apps/web/src/app/admin/*/page.tsx`, `apps/web/src/app/dashboard/*/page.tsx`). Match this pattern for new pages; one `<h1>` per page.

## Type scale (from `packages/shared/src/theme/tokens.json`, exposed via default Tailwind size scale)

| Role                 | Class / pattern                                                     | Size    | Weight | Notes                                                                                                 |
| ----------------------| ---------------------------------------------------------------------| ---------| --------| -------------------------------------------------------------------------------------------------------|
| Page title           | `font-display text-xl md:text-2xl font-bold text-neutral-900`       | 20–24px | 700    | One `<h1>` per page, top of `<main>`                                                                  |
| Marketing hero title | `font-display text-2xl sm:text-3xl font-bold text-neutral-900`      | 24–30px | 700    | Public/marketing pages only                                                                           |
| Section title        | `font-display text-lg font-semibold text-neutral-900`               | 18px    | 600    | Inside `.card`/`.card-static` sections                                                                |
| Body                 | `text-sm text-neutral-800` (default via `body`)                     | 14px    | 400    | `leading-relaxed` for longer copy                                                                     |
| Secondary            | `text-sm text-neutral-500`                                          | 14px    | 400    | Descriptions, helper labels                                                                           |
| Metadata             | `text-xs text-neutral-400`/`text-neutral-500`                       | 12px    | 400    | Timestamps, counts — never below 12px                                                                 |
| Stat value           | `font-display text-2xl md:text-3xl font-extrabold text-neutral-900` | 24–30px | 800    | See `StatCard` in `@/components/dashboard/stat-card`; use `tabular-nums` for money/counts that update |

**Rules:**

- Semantic heading order (`h1` → `h2` → `h3`); visual size must match semantic level.
- Body minimum 16px (`text-base`) on public/marketing pages; dashboard/admin density may use 14px (`text-sm`) but keep `leading-relaxed`/`leading-6` for readability.
- Max ~65–75 characters per line for prose blocks (FAQ, legal, about pages).
- Use `text-balance` on short hero headings where already supported by the Tailwind/browser version in use.

## Spacing rhythm (8px grid — from `tokens.json` `spacing` scale, mirrors default Tailwind)

| px | Tailwind | Use |
| -- | -------- | --- |
| 4 | `p-1`, `gap-1` | Icon padding, tight badge innards |
| 8 | `p-2`, `gap-2` | Inline clusters, compact toolbar items, label-to-input gap |
| 12 | `p-3`, `gap-3` | Form field groups, compact card padding (`StatCard compact`) |
| 16 | `p-4`, `gap-4` | Standard card body (`.card`/`.card-static` default), list item padding |
| 24 | `p-6`, `gap-6` | Section gaps inside larger cards, `StatCard` default padding |
| 32 | `p-8`, `gap-8` | Page section separation on dashboard/admin `<main>` |
| 48 | `p-12`, `gap-12` | Hero/marketing breathing room, `EmptyState` vertical padding (`p-12`) |

**Consistency rules:**

- Card interior: pick `p-4` (compact/list contexts) or `p-6` (stat/summary contexts) per page — don't mix within the same grid.
- Stack related fields: `space-y-4`; stack unrelated sections: `space-y-8`.
- Align label and input with `gap-2`/`space-y-2` (see `.label` + `.input` pairing).
- Never use arbitrary spacing (`p-[13px]`, `mt-[22px]`) — pick the nearest grid value.
- Border radius: `rounded-lg` (12px, inputs/buttons — badge pills use `rounded-full`), `rounded-xl` (16px, cards) — from `tokens.json` `borderRadius` scale (`sm` 4px, `md` 8px, `lg` 12px, `xl` 16px, `2xl` 20px, `full`). Don't introduce `rounded-3xl` ad hoc; `2xl` (20px) exists in tokens for rare large hero surfaces only.
