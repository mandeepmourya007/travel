---
description: Review git diff changes in 3 phases — plan compliance, senior dev low-level code review, senior architect high-level review. Handles large diffs by reviewing file-by-file.
---

# Code Review Workflow — 3-Phase Diff Review

This workflow reviews staged or committed git diff changes in **3 sequential phases**. Run when the user says "review", "review diff", "review changes", or uses `/review-diff`.

**Phases:**
1. **Plan Compliance** — Verify everything in the plan docs is completed
2. **Low-Level Review** (Senior Dev) — Code quality, design patterns, DRY/KISS, UI ↔ BE linkage
3. **High-Level Review** (Senior Architect) — Scalability, edge cases, race conditions

---

## Pre-Requisites

Before starting the review, **read these files** (use `read_file` tool — do NOT skip):

1. `docs/engineering/tech-stack.md` — Architecture, design patterns, folder structure, naming, testing strategy
2. `docs/engineering/fe/design-system.md` — Colors, typography, components, spacing, loading/error/empty states
3. `docs/engineering/db-design.md` — Database schema, indexes, soft-delete, constraints (only if diff touches BE/DB)

---

## Step 1: Gather the Diff (Phased Reading)

Diffs can be large. **Always read in phases** — never try to consume the entire diff at once.

### 1a. Get the scope first

```bash
# If reviewing uncommitted changes:
// turbo
git diff --stat

# If reviewing last N commits (ask user how many, default 1):
// turbo
git log --oneline -5
# Then:
// turbo
git diff HEAD~N..HEAD --stat
```

### 1b. Classify files from --stat output

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
| **DB — Schema/Migration** | `apps/api/prisma/**` | Indexes, constraints, relations, migration safety |

### 1c. Read diffs file-by-file

**NEVER run `git diff` without `--` file filter on large changesets.** Read each file's diff individually:

```bash
// turbo
git diff HEAD~N..HEAD -- <specific-file-path>
```

Review order: Shared Types → Shared Validators → DB Schema → BE (Repo → Service → Controller → Routes) → FE (Hooks → Components → Pages) → Tests → Config → Docs.

**After reading each file's diff, take notes** on issues found. Do NOT wait until the end to start noting problems.

---

## Phase 1: Plan Compliance Check

**Goal:** Verify that every planned item from the feature plan has a corresponding change in the diff. This runs FIRST — if the feature is incomplete, the other phases are reviewing incomplete work.

### Steps:

1. **Find the plan** — Look in `.windsurf/plans/` for a file matching the current feature or branch name. If multiple candidates exist or none are obvious, ask the user which plan applies. If no plan exists, **ask the user** if there's a plan elsewhere, then skip this phase if none.
2. **Read the plan** — Use `read_file` to load the plan and extract every action item / step / checklist entry.
3. **Cross-check against the diff** — For each planned item, determine whether the diff contains a corresponding change:
   - ✅ **Done** — Change is present in the diff
   - ⚠️ **Partial** — Partially implemented (explain what's missing)
   - ❌ **Missing** — No matching change found
4. **Check BE ↔ FE completeness** — For every BE endpoint in the plan, verify a corresponding FE hook + component exists in the diff (and vice versa). Flag any orphaned BE endpoints with no FE consumer, or FE hooks calling endpoints that don't exist.
5. **Check test completeness** — For every service method in the plan, verify at least 1 test exists.

### Output for Phase 1:

```markdown
## Phase 1: Plan Compliance
- **Plan file:** `.windsurf/plans/<filename>.md`
- **Items completed:** X / Y
- **BE ↔ FE coverage:** All linked / N orphans

| # | Planned Item | Status | Notes |
|---|-------------|--------|-------|
| 1 | Description of item | ✅ Done | — |
| 2 | Description of item | ⚠️ Partial | Missing FE hook |
| 3 | Description of item | ❌ Missing | Not in diff at all |
```

**Present Phase 1 results to the user before continuing.** If there are ❌ Missing items, ask whether to proceed with the remaining phases or stop here.

---

## Phase 2: Low-Level Review (Senior Dev)

**Role:** You are a senior developer reviewing code quality, correctness, and adherence to project standards. You care about clean code, proper patterns, DRY/KISS, and that every UI component actually works end-to-end with the backend.

### Severity Levels:
- 🔴 **CRITICAL** — Must fix before merge (security, data loss, broken functionality)
- 🟠 **HIGH** — Should fix (architecture violation, missing tests, broken pattern)
- 🟡 **MEDIUM** — Recommended fix (DRY, naming, minor design system deviation)
- 🔵 **LOW** — Nitpick (style preference, documentation gap)

### 2a. Code Quality & DRY/KISS

```
CHECK: DRY — No duplicated logic
  - No duplicated logic (>5 lines repeated in 2+ places → extract to utility/component)
  - Similar API calls/transforms in multiple hooks → extract shared helper
  - Repeated JSX patterns → extract reusable component
  🟡 MEDIUM if violated

CHECK: KISS — No over-engineering
  - Simple problems have simple solutions (no abstraction layers for one-off logic)
  - No premature optimization (memoization without measured need)
  - Straightforward conditionals preferred over clever ternary chains
  - If a utility function is used only once, inline it unless it improves readability
  🟡 MEDIUM if violated

CHECK: Functions are focused
  - Service methods ≤ 30 lines (split if longer)
  - Controller methods ≤ 15 lines
  - No deeply nested callbacks or conditionals (>3 levels → refactor)
  - Single Responsibility: each function does one thing
  🟡 MEDIUM if violated

CHECK: No magic numbers/strings
  - All constants in constants.ts or config
  - No inline "CONFIRMED", 90, 50, etc. — use named constants
  🟡 MEDIUM if violated
```

### 2b. Design Patterns

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

### 2c. UI ↔ BE Linkage Verification

**This is critical.** For every feature in the diff, verify the full chain works:

```
CHECK: Every BE endpoint has a FE consumer
  - New route in routes/*.ts → corresponding hook in hooks/*.ts → used in a component/page
  - Hook calls the correct endpoint path and HTTP method
  - Request DTO shape in hook matches Zod validation schema on the route
  - Response type in hook matches what the service actually returns
  🟠 HIGH if endpoint exists but no FE consumer

CHECK: Every FE component has real BE backing
  - Component renders data from a hook → hook calls an API → API route exists and is wired
  - No FE components showing mock/hardcoded data that should come from BE
  - Mutations (create/update/delete) invalidate the correct query keys in onSuccess
  🟠 HIGH if component shows data with no BE source

CHECK: Shared types are the single source of truth
  - FE hook return types use shared types (not local re-definitions)
  - BE service return shapes match the shared DTO/Response types
  - Zod validators in shared/ match the DTO interfaces
  🟡 MEDIUM if types diverge
```

### 2d. Design System Compliance (design-system.md)

```
CHECK: Color tokens
  - Uses design system tokens (primary-500, neutral-200, etc.), NOT raw Tailwind colors (blue-500, gray-200)
  - WCAG: primary-500 never used for body text on white (fails contrast); use primary-600 or primary-700
  - Semantic colors used correctly: success for confirmed, warning for limited, error for failed
  🟡 MEDIUM if violated

CHECK: Typography
  - Headings use font-display (Plus Jakarta Sans)
  - Body text uses default font-sans (Inter)
  - Font sizes from the type scale (text-xs through text-5xl), no arbitrary sizes
  🟡 MEDIUM if violated

CHECK: Component classes
  - Buttons use .btn-primary, .btn-secondary, .btn-accent, .btn-ghost, .btn-outline, .btn-disabled
  - Cards use .card (interactive) or .card-static (non-interactive, no hover shadow)
  - Inputs use .input class
  - Badges use .badge + variant (.badge-primary, .badge-success, etc.)
  - No long inline Tailwind strings that duplicate an existing component class
  🟡 MEDIUM if violated

CHECK: 4-State Rendering (mandatory for data-fetching components)
  - Loading: Uses .skeleton class (shimmer effect), NOT animate-pulse
  - Error: Uses error-50 bg, emoji, title, message, retry button with .btn-outline
  - Empty: Uses .card-static container, icon/emoji, message, optional action
  - Pattern: if(loading)→skeleton, if(error)→ErrorState, if(!data)→EmptyState, else→Component
  🟠 HIGH if 4-state pattern not followed

CHECK: Spacing & Responsive
  - Uses 4px grid (no arbitrary spacing like p-[13px])
  - Mobile-first: base styles for mobile, sm/md/lg/xl for larger
  - Grid columns: 1 mobile → 2 tablet → 3 desktop for card grids
  🔵 LOW if violated
```

### 2e. TypeScript & Security

```
CHECK: TypeScript strictness
  - No `any` type (use `unknown` + type guards)
  - No type assertions (`as Type`) unless documented with a comment explaining why
  - No `@ts-ignore` or `@ts-expect-error` without comment
  🟠 HIGH if `any` is used

CHECK: Security
  - No hardcoded secrets, API keys, or tokens
  - No console.log with PII (passwords, tokens, Aadhaar)
  - Env variables accessed via validated env config, not process.env directly
  - User input sanitized (Zod .trim(), .toLowerCase() for emails)
  - SQL injection: No raw string concatenation in queries
  🔴 CRITICAL if security issue found
```

### 2f. Test Coverage

```
CHECK: Backend tests present
  - Every new service method has at least: 1 happy path + 1 error case unit test
  - Tests use Arrange/Act/Assert pattern
  - Repositories are mocked in unit tests (never hit real DB)
  - Factory functions used for test data (tests/helpers/factories.ts)
  🟠 HIGH if no tests for new business logic

CHECK: Frontend tests present
  - New hooks have tests with MSW mocks
  - Complex components have React Testing Library tests
  - Tests verify behavior, not implementation details
  🟡 MEDIUM if missing for complex components/hooks

CHECK: Existing tests not broken
  - No test deletions without explicit justification
  - No test weakening (removing assertions, changing expected values to match bugs)
  🔴 CRITICAL if tests deleted or weakened
```

### 2g. Documentation

```
CHECK: JSDoc on public interfaces
  - Exported functions/methods have JSDoc with @param and @returns
  - Complex business logic has inline comments explaining WHY (not WHAT)
  - No commented-out code (delete it, git has history)
  🟡 MEDIUM if missing on public APIs

CHECK: Docs updated
  - New features reflected in relevant docs
  - API endpoint changes reflected in tech-stack.md API Design section
  - New env variables added to .env.example
  🟡 MEDIUM if docs out of sync

CHECK: Naming conventions
  - Files: kebab-case (trip-card.tsx, booking.service.ts)
  - Components: PascalCase (TripCard, BookingForm)
  - Functions: camelCase (createBooking, handlePayment)
  - Constants: SCREAMING_SNAKE (MAX_GROUP_SIZE)
  - Types/Interfaces: PascalCase (TripSummary, CreateBookingDto)
  🔵 LOW if violated
```

### Output for Phase 2:

```markdown
## Phase 2: Low-Level Review (Senior Dev)

### Issues Found

#### 🔴 CRITICAL (N)
| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|
| C1 | path/to/file.ts | 42-50 | Description | Suggested fix |

#### 🟠 HIGH (N)
| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|

#### 🟡 MEDIUM (N)
| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|

#### 🔵 LOW (N)
| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|

### ✅ What's Good
- List things done well (patterns followed, clean code, good tests)

### BE ↔ FE Linkage
| BE Endpoint | FE Hook | FE Component | Status |
|-------------|---------|-------------|--------|
| POST /api/v1/trips | useCreateTrip | create-trip-form.tsx | ✅ Linked |
| GET /api/v1/stats | — | — | ⚠️ No FE consumer |

### Missing Tests
- List any new code paths that lack test coverage
```

**Present Phase 2 results to the user before continuing to Phase 3.**

---

## Phase 3: High-Level Review (Senior Architect)

**Role:** You are a senior architect reviewing the diff for scalability, correctness under load, edge cases, and race conditions. You think about what happens at scale, under concurrent requests, and in failure scenarios.

### 3a. Race Conditions & Concurrency

```
CHECK: Database race conditions
  - Concurrent booking creates: Does seat count use atomic increment (UPDATE ... SET x = x + 1 WHERE ...) or read-then-write?
  - Concurrent seat holds: Are seats locked atomically or can two users hold the same seat?
  - Status transitions: Are state machines enforced at DB level (WHERE status = 'EXPECTED_STATE') or only in application code?
  - Counter caches: Are counts derived from atomic operations or stale reads?
  🔴 CRITICAL if race condition exists

CHECK: Distributed operation safety
  - External API calls (Razorpay, Cloudinary) + DB writes: What happens if API succeeds but DB write fails?
  - Webhook idempotency: Can the same webhook be processed twice safely? (Check for upsert or duplicate detection)
  - Cron job overlap: Can two cron executions run concurrently? Is there a lock/guard?
  - Fire-and-forget operations: Are failures logged? Can they be retried?
  🟠 HIGH if not handled

CHECK: Transaction boundaries
  - Multi-table writes wrapped in $transaction
  - Transaction scope is minimal (no API calls inside transactions)
  - Rollback behavior is correct (partial state not left behind)
  🔴 CRITICAL if transactions missing for multi-table writes
```

### 3b. Edge Cases & Failure Modes

```
CHECK: Boundary conditions
  - What happens at exactly maxGroupSize? (off-by-one)
  - What happens with 0 items? (empty arrays, no travelers, no seats)
  - What happens with the maximum allowed? (max photos, max seats, max travelers)
  - Null/undefined handling: Are optional fields handled gracefully?
  🟠 HIGH if edge case causes crash or data corruption

CHECK: Failure recovery
  - If payment succeeds but booking creation fails, is money refunded or order expired?
  - If seat hold succeeds but booking fails, are seats released?
  - If file upload succeeds but DB save fails, is the orphan cleaned up?
  - Network timeout handling: Are there retries with backoff? Circuit breakers?
  🟠 HIGH if failure leaves inconsistent state

CHECK: Data integrity
  - Foreign key constraints: Can orphan records be created?
  - Unique constraints: Are duplicates prevented at DB level (not just application)?
  - Soft-delete cascading: Do related queries filter by deletedAt?
  - Pagination: Is it cursor-based or offset-based? Does it handle concurrent inserts/deletes?
  🟠 HIGH if data integrity gap found
```

### 3c. Scalability & Performance

```
CHECK: N+1 query patterns
  - Listing endpoints: Are related records fetched with includes/joins, not in loops?
  - Nested data: Is Prisma `include` used instead of separate queries per item?
  🟠 HIGH if N+1 detected

CHECK: Database query efficiency
  - New queries have appropriate indexes (check schema.prisma @@index)
  - Large result sets are paginated (never SELECT * unbounded)
  - Aggregation queries use DB-level GROUP BY, not application-level reduce
  - Raw SQL queries are parameterized (no string concatenation)
  🟠 HIGH if missing index on filtered/sorted column

CHECK: Memory & payload size
  - API responses don't return entire DB records (select only needed fields)
  - File uploads have size limits enforced
  - Batch operations have LIMIT caps (not unbounded loops)
  - WebSocket/SSE connections have cleanup on disconnect
  🟡 MEDIUM if oversized payloads

CHECK: Caching strategy
  - Frequently accessed, rarely changing data has appropriate caching
  - Cache invalidation happens on writes
  - No stale reads in critical paths (booking, payment)
  🟡 MEDIUM if obvious caching opportunity missed
```

### 3d. API Design & Contract Safety

```
CHECK: Breaking changes
  - Existing API response shapes not changed without versioning
  - New required fields on existing DTOs break existing clients
  - Enum additions are safe; enum removals are breaking
  🔴 CRITICAL if breaking change without migration path

CHECK: Authorization & access control
  - Every endpoint has appropriate auth middleware (authMiddleware, requireRole, requireOrganizer)
  - Users can only access their own data (no IDOR vulnerabilities)
  - Admin endpoints are behind requireRole('ADMIN')
  - Public endpoints are intentionally public (documented why)
  🔴 CRITICAL if auth missing or IDOR found

CHECK: Input validation completeness
  - Every endpoint has Zod validation middleware
  - Zod schemas validate: required fields, string lengths, enum values, array bounds
  - File upload endpoints validate: file type, file size, count limits
  🟠 HIGH if validation missing
```

### Output for Phase 3:

```markdown
## Phase 3: High-Level Review (Senior Architect)

### Race Conditions & Concurrency
| # | Scenario | Risk | Severity | Recommendation |
|---|----------|------|----------|---------------|
| R1 | Concurrent seat holds | Two users could hold same seat | 🔴 CRITICAL | Use SELECT ... FOR UPDATE |

### Edge Cases
| # | Edge Case | Current Behavior | Expected Behavior | Severity |
|---|-----------|-----------------|-------------------|----------|
| E1 | 0 travelers in booking | Crashes | Return validation error | 🟠 HIGH |

### Scalability Concerns
| # | Issue | Impact | Recommendation |
|---|-------|--------|---------------|
| S1 | N+1 in trip listing | Slow at 100+ trips | Add Prisma include |

### Architecture Issues
| # | File | Issue | Fix |
|---|------|-------|-----|
| A1 | ... | ... | ... |
```

---

## Step 4: Final Combined Report

After all 3 phases, compile a **combined summary**:

```markdown
# Code Review — [scope description]

## Summary
- **Files changed:** N
- **Lines added/removed:** +X / -Y
- **Test files changed:** N (list them)
- **Overall verdict:** ✅ Approve / ⚠️ Approve with comments / ❌ Request changes

## Phase Results
| Phase | Status | Critical | High | Medium | Low |
|-------|--------|----------|------|--------|-----|
| 1. Plan Compliance | ✅ X/Y done | — | — | — | — |
| 2. Low-Level (Senior Dev) | ⚠️ N issues | N | N | N | N |
| 3. High-Level (Architect) | ❌ N issues | N | N | N | N |

## All Issues (sorted by severity)
[Combine all issues from Phase 2 + Phase 3 into one sorted table]

## ✅ What's Good
[Combined praise from all phases]
```

---

## Step 5: Ask User for Action

After presenting the final report, ask:

1. **Fix all issues?** — Implement fixes for CRITICAL and HIGH issues automatically
2. **Fix specific issues?** — Let user pick which ones to fix (by issue ID: C1, H2, etc.)
3. **Just the report** — No code changes, user will fix manually

If fixing, apply changes in order: CRITICAL → HIGH → MEDIUM. Skip LOW unless user asks.

After fixes, run:
```bash
// turbo
npx tsc --noEmit
```
to confirm type safety.

---

## Rules for the Reviewer

1. **Be specific** — Always cite the exact file, line number, and the problematic code
2. **Explain WHY** — Don't just say "wrong pattern"; explain the consequence (e.g., "race condition under concurrent requests because read-then-write is not atomic")
3. **Suggest the fix** — Provide the corrected code or approach
4. **Check consistency** — If a pattern is used in 5 places and broken in 1, flag the 1
5. **Don't nitpick formatting** — Prettier handles that. Focus on architecture, correctness, and maintainability
6. **Praise good work** — Acknowledge well-structured code, good test coverage, and pattern adherence
7. **Check both FE and BE** — A feature is incomplete if only one side is implemented/tested
8. **Think adversarially** — What would a malicious user do? What happens under load? What if the network fails mid-operation?
9. **Read diffs carefully** — Don't skim. Read every changed line. Bugs hide in the details.
10. **Phase gate** — Present each phase's results before moving to the next. User can stop early if Phase 1 shows the feature is incomplete.
