# Form Patterns

Forms in this app follow **single-column, low-cognitive-load** patterns, built with **React Hook Form + Zod** (`@hookform/resolvers`), with the Zod schema imported from `packages/shared/src/validators/` — the same schema the API validates against. Never redeclare a parallel client-side shape.

## Layout

- **Single column** — one field per row on desktop and mobile; side-by-side fields only for tightly related pairs (e.g. city/state, from-date/to-date via `date-range-picker.tsx`) and never more than two columns.
- **Label above input** — `space-y-2`/`gap-2` between label and control; use `.label` (`text-sm font-medium text-neutral-700`) or the shadcn `Label` (`@/components/ui/label`) for form-managed inputs.
- **Group related fields** in `.card`/`.card-static` sections; separate unrelated groups with `space-y-8`.
- **Primary submit** at the bottom of the form or a sticky footer on long forms (e.g. `bank-account-form.tsx`, trip create flow) — one primary action per form.

## Validation

- **Inline validation** — show field-level errors on blur or after first submit attempt (React Hook Form default `mode`), not on every keystroke.
- Use `<Alert variant="error">` (`@/components/shared/alert`) or `<ErrorState>` for form-level/submission errors; field errors render below the input in `text-sm text-error-500`.
- Preserve user input on server error — never clear the form on a failed mutation.
- Disable submit via the shadcn `<Button disabled={!isValid || isPending}>` and show a pending state on the button itself (spinner icon or `Spinner size="sm"` inline) rather than swapping the label text — explain *why* disabled via helper text when non-obvious (e.g. "Complete bank details to continue").

```tsx
<div className="space-y-2">
  <Label htmlFor="name">Trip title</Label>
  <Input
    id="name"
    aria-invalid={!!errors.name}
    aria-describedby={errors.name ? 'name-error' : undefined}
    {...register('name')}
  />
  {errors.name && (
    <p id="name-error" className="text-sm text-error-500" role="alert">
      {errors.name.message}
    </p>
  )}
</div>
```

## Undo over confirm

- Prefer an **undo toast** (`@/components/shared/toast`) for reversible actions (remove a filter, unsave a trip) over a blocking confirm dialog.
- Reserve shadcn `AlertDialog` (`@/components/ui/alert-dialog`) for **destructive, irreversible** actions (cancel a booking, delete a bank account, reject an organizer application).
- After a destructive confirm, show success feedback inline or via toast — the user must know the action completed.

## Autocomplete & assistive hints

- Set `autoComplete` appropriately (`email`, `name`, `tel` for `phone-input.tsx`, `off` for OTP fields using `.otp-input`).
- Use `placeholder` sparingly — never as a substitute for a visible label.
- Helper text (`text-sm text-neutral-500`) below fields for format hints (e.g. phone format hint under `phone-input.tsx`).
- Composite/searchable inputs — `search-combobox.tsx`, `trip-search-combobox.tsx` — already wire keyboard navigation and ARIA attributes; reuse them rather than building a new combobox.
- Date/time inputs — reuse `date-picker.tsx`, `date-range-picker.tsx`, `date-time-picker.tsx`, `time-picker.tsx` rather than a raw `<input type="date">`.

## Form states (all five)

| State | Pattern |
| ----- | ------- |
| Empty | Default/blank values from RHF `defaultValues`; primary CTA enabled once minimum-valid |
| Loading | Submit button shows pending state (`disabled` + spinner) while `isPending`/`isSubmitting`; disable fields only if concurrent edit is genuinely unsafe |
| Error | Field-level errors (`text-error-500` below input) + form-level `Alert`/`ErrorState`; focus the first invalid field |
| Success | Toast, inline confirmation banner, or redirect (e.g. after booking payment) |
| Disabled | Read-only view for unauthorized roles, gated by `RoleGuard`/`AuthGuard` — explain with helper text, not silent omission |

## Accessibility checklist

- Every input has a `<Label htmlFor="…">`/`<label>` or `aria-label` when visually hidden.
- Error messages linked via `aria-describedby`.
- Required fields marked with visible text (e.g. `*`) or `aria-required="true"` — not color alone.
- Tab order follows visual order; no keyboard traps in `Dialog`/`Sheet` (Radix handles this by default — don't override focus trapping).
- Submit on Enter from single-line inputs; `Textarea` uses Enter for newline.
