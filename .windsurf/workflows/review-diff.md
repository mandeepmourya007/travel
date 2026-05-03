---
description: Review git diff changes as a senior architect — checks tech-stack compliance, design system alignment, design patterns, test coverage, and documentation quality
---

# Code Review Workflow — Senior Architect Diff Review

This workflow reviews staged or committed git diff changes against the project's architecture standards. Run this workflow when the user says "review", "review diff", "review changes", or uses `/review-diff`.

---

## Pre-Requisites

Before starting the review, **read these files** (use `read_file` tool — do NOT skip):

1. `docs/engineering/tech-stack.md` — Architecture, design patterns, folder structure, naming, testing strategy
2. `docs/engineering/fe/design-system.md` — Colors, typography, components, spacing, loading/error/empty states
3. `docs/engineering/db-design.md` — Database schema, indexes, soft-delete, constraints (only if diff touches BE/DB)

---

## Step 1: Gather the Diff

Run one of these commands to get the changes to review:

```bash
# If reviewing uncommitted changes:
// turbo
git diff --stat && git diff

# If reviewing last N commits (ask user how many, default 1):
// turbo
git log --oneline -5
# Then:
// turbo
git diff HEAD~N..HEAD --stat && git diff HEAD~N..HEAD
```

If the diff is large (>500 lines), use `--stat` first to understand scope, then review file-by-file:
```bash
// turbo
git diff HEAD~N..HEAD -- <specific-file-path>
```

---

## Step 2: Classify Changed Files

Group every changed file into one of these categories:

| Category | File patterns | Review focus |
|----------|--------------|--------------|
| **Shared Types** | `packages/shared/src/types/*.ts` | Type correctness, JSDoc, DTO shape matches API |
| **Shared Validators** | `packages/shared/src/validators/*.ts` | Zod schema completeness, error messages, cross-field rules |
| **BE — Repository** | `apps/api/src/repositories/*.ts` | No business logic, soft-delete filter, pagination, query builder |
| **BE — Service** | `apps/api/src/services/*.ts` | All business logic here, typed errors, DI via constructor, logging |
| **BE — Controller** | `apps/api/src/controllers/*.ts` | Thin (≤15 lines/method), uses asyncHandler, standardized response |
| **BE — Routes** | `apps/api/src/routes/*.ts` | Middleware order: auth → role → validate → controller |
| **BE — Middleware** | `apps/api/src/middleware/*.ts` | Single responsibility, passes to next() or throws |
| **BE — Tests** | `apps/api/tests/**/*.test.ts` | Arrange/Act/Assert, mocked repos, factory functions |
| **FE — Pages** | `apps/web/src/app/**/*.tsx` | Route files (page/loading/error/layout/not-found) |
| **FE — Components** | `apps/web/src/components/**/*.tsx` | Props interface, named exports, 4-state rendering |
| **FE — Hooks** | `apps/web/src/hooks/*.ts` | Query key factory, staleTime, error handling |
| **FE — Styles** | `apps/web/src/app/globals.css` | Design system tokens, @layer components, no hardcoded colors |
| **FE — Tests** | `apps/web/src/**/*.test.tsx` | MSW mocks, React Testing Library, no implementation details |
| **Config** | `*.config.*`, `*.json`, `.env*` | Security (no secrets), correct versions |
| **Docs** | `docs/**/*.md` | Accuracy, consistency with code |

---

## Step 3: Run the Review Checklist

For EACH changed file, evaluate against ALL applicable checks below. Use severity levels:
- 🔴 **CRITICAL** — Must fix before merge (security, data loss, broken patterns)
- 🟠 **HIGH** — Should fix (architecture violation, missing tests, inconsistency)
- 🟡 **MEDIUM** — Recommended fix (DRY, naming, minor design system deviation)
- 🔵 **LOW** — Nitpick (style preference, documentation gap)

### 3a. Architecture & Design Patterns (tech-stack.md)

```
CHECK: Layer separation
  - Controllers contain ONLY request parsing + service call + response formatting
  - Services contain ALL business logic, receive dependencies via constructor
  - Repositories contain ONLY database queries (Prisma), no business logic
  - No layer skipping: Controller → Service → Repository (never Controller → Repository)
  🔴 CRITICAL if violated

CHECK: Design patterns applied correctly
  - Singleton: Prisma/Redis/Logger — one instance, not created per-request
  - Factory: Query keys use factory (tripKeys.list(filters)), not inline arrays
  - Repository: All DB access through repository classes, never raw Prisma in services
  - Strategy: Behavior varying by type/enum handled in service, not in controller if-else chains
  - Facade: Orchestrating 3+ subsystems uses a single service method
  - Observer: Side effects (notifications, cache invalidation) use observer pattern
  - Template Method: 4-state rendering (loading/error/empty/data) followed in FE components
  🟠 HIGH if pattern is wrong or missing

CHECK: Dependency Injection
  - Services receive repos and external services via constructor params
  - No `new Repository()` calls inside service methods
  - All wiring happens in config/dependencies.ts
  🟠 HIGH if violated

CHECK: Error handling
  - Typed errors used (NotFoundError, ValidationError, etc.), not generic Error
  - asyncHandler wraps all controller methods (no manual try-catch)
  - Error handler middleware catches everything
  - API errors follow standard format: { success: false, error: { code, message } }
  🟠 HIGH if violated
```

### 3b. Design System Compliance (design-system.md)

```
CHECK: Color tokens
  - Uses design system tokens (primary-500, neutral-200, etc.), NOT raw Tailwind colors (blue-500, gray-200)
  - Exception: red-200 is acceptable ONLY if error-200 token doesn't exist in Tailwind config
  - WCAG: primary-500 never used for body text on white (fails contrast); use primary-600 or primary-700
  - Semantic colors used correctly: success for confirmed, warning for limited, error for failed
  🟡 MEDIUM if violated

CHECK: Typography
  - Headings use font-display (Plus Jakarta Sans)
  - Body text uses default font-sans (Inter)
  - Font sizes from the type scale (text-xs through text-5xl), no arbitrary sizes
  - Font weights match design system (font-medium, font-semibold, font-bold, font-extrabold)
  🟡 MEDIUM if violated

CHECK: Component classes
  - Buttons use .btn-primary, .btn-secondary, .btn-accent, .btn-ghost, .btn-outline, .btn-disabled
  - Cards use .card (interactive) or .card-static (non-interactive, no hover shadow)
  - Inputs use .input class
  - Badges use .badge + variant (.badge-primary, .badge-success, etc.)
  - No long inline Tailwind strings that duplicate an existing component class
  🟡 MEDIUM if violated

CHECK: Loading/Error/Empty states (Section 9 of design-system.md)
  - Loading: Uses .skeleton class (shimmer effect), NOT animate-pulse
  - Error: Uses error-50 bg, emoji, title, message, retry button with .btn-outline
  - Empty: Uses .card-static container, icon/emoji, message, optional action
  - Every data-fetching component follows: if(loading)→skeleton, if(error)→ErrorState, if(!data)→EmptyState, else→Component
  🟠 HIGH if 4-state pattern not followed

CHECK: Spacing
  - Uses 4px grid system (spacing tokens: 1=4px, 2=8px, 3=12px, 4=16px, etc.)
  - No arbitrary spacing values (p-[13px], mt-[7px])
  - Section padding: py-8 to py-16
  - Card padding: p-4 to p-6
  - Container: max-w-7xl mx-auto px-4 sm:px-6
  🔵 LOW if violated

CHECK: Responsive
  - Mobile-first approach (base styles for mobile, sm/md/lg/xl for larger)
  - Grid columns: 1 mobile → 2 tablet → 3 desktop for card grids
  🔵 LOW if violated
```

### 3c. Test Coverage

```
CHECK: Backend tests present
  - Every new service method has at least: 1 happy path + 1 error case unit test
  - Test file naming: <service-name>.service.test.ts
  - Tests use Arrange/Act/Assert pattern
  - Repositories are mocked in unit tests (never hit real DB)
  - Factory functions used for test data (tests/helpers/factories.ts)
  - Integration tests present for new routes (status codes, response shape, auth guards)
  🟠 HIGH if no tests for new business logic

CHECK: Frontend tests present
  - New hooks have tests with MSW mocks
  - Complex components have React Testing Library tests
  - Tests verify behavior, not implementation details
  - No snapshot tests (fragile, low value)
  🟡 MEDIUM if missing for complex components/hooks

CHECK: Existing tests not broken
  - No test deletions without explicit justification
  - No test weakening (removing assertions, changing expected values to match bugs)
  - Run: `npm run test` passes
  🔴 CRITICAL if tests deleted or weakened
```

### 3d. Documentation & Comments

```
CHECK: JSDoc on public interfaces
  - Exported functions/methods have JSDoc with @param and @returns
  - Complex business logic has inline comments explaining WHY (not WHAT)
  - Non-obvious fields in types/interfaces have JSDoc comments
  - No commented-out code (delete it, git has history)
  🟡 MEDIUM if missing on public APIs

CHECK: README / docs updated
  - New features reflected in relevant docs (if applicable)
  - API endpoint changes reflected in tech-stack.md API Design section
  - New env variables added to .env.example
  🟡 MEDIUM if docs out of sync
```

### 3e. Code Quality & Security

```
CHECK: TypeScript strictness
  - No `any` type (use `unknown` + type guards)
  - No type assertions (`as Type`) unless documented with a comment explaining why
  - Strict mode enabled (checked by tsconfig)
  - No `@ts-ignore` or `@ts-expect-error` without comment
  🟠 HIGH if `any` is used

CHECK: Security
  - No hardcoded secrets, API keys, or tokens
  - No console.log with PII (passwords, tokens, Aadhaar)
  - Env variables accessed via validated env config, not process.env directly
  - User input sanitized (Zod .trim(), .toLowerCase() for emails)
  - SQL injection: No raw string concatenation in queries (Prisma parameterized or $executeRaw with template literals)
  🔴 CRITICAL if security issue found

CHECK: DRY & Code Smell
  - No duplicated logic (>5 lines repeated in 2+ places → extract to utility/component)
  - No magic numbers/strings (use constants)
  - Functions < 30 lines (split if longer)
  - No deeply nested callbacks or conditionals (>3 levels → refactor)
  🟡 MEDIUM if violated

CHECK: Naming conventions (tech-stack.md Section 13)
  - Files: kebab-case (trip-card.tsx, booking.service.ts)
  - Components: PascalCase (TripCard, BookingForm)
  - Functions: camelCase (createBooking, handlePayment)
  - Constants: SCREAMING_SNAKE (MAX_GROUP_SIZE)
  - Types/Interfaces: PascalCase (TripSummary, CreateBookingDto)
  🔵 LOW if violated
```

---

## Step 4: Compile the Review Report

Output the review as a structured report with this format:

```markdown
# Code Review — [scope description]

## Summary
- **Files changed:** N
- **Lines added/removed:** +X / -Y
- **Test files changed:** N (list them)
- **Overall verdict:** ✅ Approve / ⚠️ Approve with comments / ❌ Request changes

## Issues Found

### 🔴 CRITICAL (N)
| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|
| C1 | path/to/file.ts | 42-50 | Description | Suggested fix |

### 🟠 HIGH (N)
| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|
| H1 | ... | ... | ... | ... |

### 🟡 MEDIUM (N)
| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|

### 🔵 LOW (N)
| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|

## ✅ What's Good
- List things done well (patterns followed, clean code, good tests)

## Missing Tests
- List any new code paths that lack test coverage

## Missing Documentation
- List any public APIs/types missing JSDoc
```

---

## Step 5: Plan Completion Check

If a plan file exists for the current feature, verify every planned item is implemented in the diff.

1. **Find the plan** — Look in `.windsurf/plans/` for a file matching the current feature or branch name. If multiple candidates exist or none are obvious, ask the user which plan applies. If no plan exists, skip this step entirely.
2. **Read the plan** — Use `read_file` to load the plan and extract every action item / step / checklist entry.
3. **Cross-check against the diff** — For each planned item, determine whether the diff contains a corresponding change. Mark each as:
   - ✅ **Done** — Change is present in the diff
   - ❌ **Missing** — No matching change found
4. **Add to the review report** — Append a **Plan Compliance** section to the Step 4 report:

```markdown
## Plan Compliance
- **Plan file:** `.windsurf/plans/<filename>.md`
- **Items completed:** X / Y

| # | Planned Item | Status | Notes |
|---|-------------|--------|-------|
| 1 | Description of item | ✅ Done | — |
| 2 | Description of item | ❌ Missing | What's missing |
```

5. **Flag gaps** — If any planned items are missing, add a 🟠 **HIGH** issue per missing item in the review report's Issues Found section.

---

## Step 6: Ask User for Action

After presenting the report, ask:

1. **Fix all issues?** — Implement fixes for CRITICAL and HIGH issues automatically
2. **Fix specific issues?** — Let user pick which ones to fix
3. **Just the report** — No code changes, user will fix manually

If fixing, apply changes in order: CRITICAL → HIGH → MEDIUM. Skip LOW unless user asks.

---

## Rules for the Reviewer

1. **Be specific** — Always cite the exact file, line number, and the problematic code
2. **Explain WHY** — Don't just say "wrong pattern"; explain the consequence
3. **Suggest the fix** — Provide the corrected code or approach
4. **Check consistency** — If a pattern is used in 5 places and broken in 1, flag the 1
5. **Don't nitpick formatting** — Prettier handles that. Focus on architecture, correctness, and maintainability
6. **Praise good work** — Acknowledge well-structured code, good test coverage, and pattern adherence
7. **Check both FE and BE** — A feature is incomplete if only one side is tested
8. **Verify compilation** — Run `npx tsc --noEmit` to confirm type safety after any fixes
