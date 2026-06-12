---
description: End-to-end feature development — collaborative planning meetings, architecture review, user approval, then DB schema, BE (TDD), FE (hooks + components), integration tests. Orchestrates /build-backend and /build-frontend into a single workflow.
---

# Full-Stack Feature Development Workflow

This is the **master workflow** for building any feature end-to-end. It starts with **collaborative planning meetings** between cross-functional roles, produces a reviewed plan document, gets user approval, THEN orchestrates the DB → BE → Shared → FE → Integration pipeline.

**Think like a senior architect:** Plan collaboratively. Validate the plan. Get approval. THEN code.

---

## When to Use This Workflow

Use `/build-feature` when building a **complete feature** that spans both BE and FE, e.g.:
- "Build trip search with filters"
- "Build booking flow with Razorpay"
- "Build review system"

Use `/build-backend` or `/build-frontend` individually only when working on isolated layers.

---

## Pre-Requisites

Before starting, you MUST read these files:
1. `docs/engineering/tech-stack.md` — Architecture, patterns, DB schema, error handling
2. `docs/engineering/tech-stack.md` **Section 1 — Design Patterns (GoF Classification)** — 30+ patterns mapped to exact file locations + 6 usage rules
3. `docs/mvp/mvp-plan.md` — Feature scope, wireframes, user flows
4. `docs/engineering/fe/design-system.md` — Colors, tokens, component styles, data states
5. `docs/engineering/fe/preview.html` — FE design reference for UI consistency
6. `docs/PROJECT_MINDMAP.md` — System architecture overview, feature domains
7. `docs/PROJECT_REFERENCE.md` — Full API surface, DB schema, component map

---

## Overview: The 6-Step Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│              STEP 1: PLANNING MEETING (Collaborative)            │
│  FE Dev + BE Dev + Senior Architect + Product Manager            │
│  Each role presents points with VALID REASONS (no bluff)         │
│  Debate trade-offs → Select best approach                        │
├─────────────────────────────────────────────────────────────────┤
│              STEP 2: CREATE PLAN DOCUMENT                        │
│  Consolidate meeting output into a structured feature plan       │
├─────────────────────────────────────────────────────────────────┤
│              STEP 3: REVIEW MEETING (Senior Review)              │
│  Senior Devs + Senior Architect + Stakeholder review the plan    │
│  Identify gaps, risks, missing edge cases                        │
├─────────────────────────────────────────────────────────────────┤
│              STEP 4: REFINE PLAN                                 │
│  Incorporate review feedback, fix gaps, finalize plan            │
├─────────────────────────────────────────────────────────────────┤
│              STEP 5: USER APPROVAL                               │
│  Present final plan to user → WAIT for explicit approval         │
│  Do NOT proceed to code until user says "approved"               │
├─────────────────────────────────────────────────────────────────┤
│              STEP 6: IMPLEMENTATION                              │
│  Use /build-backend + /build-frontend workflows                  │
│  Reference: preview.html, PROJECT_MINDMAP, PROJECT_REFERENCE     │
│  After commit: update docs/mvp/mvp-plan.md                      │
└─────────────────────────────────────────────────────────────────┘
```

---

# STEP 1: PLANNING MEETING (Collaborative)

## Goal

Simulate a cross-functional planning meeting where **4 roles** discuss how to build the feature. Each role contributes their expertise. **Every point must have a valid reason** — no filler, no bluff, no "we should do X because it's best practice" without explaining WHY it's the right choice for THIS feature.

## Meeting Participants

| Role | Focus Area | Brings to the Table |
|------|-----------|---------------------|
| **Product Manager (PM)** | User value, UX flows, business rules | What the user sees, feels, does. Acceptance criteria. Edge cases from user perspective. |
| **FE Developer** | Component design, state management, UI/UX | Component hierarchy, data flow, loading/error/empty states, mobile-first layout, animation, accessibility. References `preview.html` for design consistency. |
| **BE Developer** | API design, DB schema, validation, performance | Endpoint design, request/response shapes, validation rules, DB queries, caching, error codes. |
| **Senior Architect** | System design, trade-offs, patterns, scalability | Architecture decisions, pattern selection (from tech-stack.md), cross-cutting concerns, security, performance trade-offs. Challenges weak proposals. |

## Meeting Format

Run the meeting as a structured discussion. Output it as a readable conversation transcript.

### Round 1: Feature Understanding (PM leads)
- PM defines: **What** is the feature, **Who** uses it, **Why** it matters (business value)
- PM lists: User stories, acceptance criteria, happy path flow, edge cases from user POV
- PM identifies: What makes the UX feel great vs. just functional
- Others ask clarifying questions

### Round 2: FE Perspective (FE Dev leads)
- Propose component hierarchy and data flow
- Identify which components are client vs. server
- Propose state management approach (URL state? Local state? Zustand?)
- Define all 4 states: loading skeleton shape, error message, empty state CTA, happy path layout
- Mobile-first layout decisions (stack order, breakpoints)
- Reference `preview.html` for design system consistency
- Identify accessibility requirements (ARIA, focus, keyboard nav)
- **Every proposal must include WHY** — e.g., "URL state for filters because users share filtered links"

### Round 3: BE Perspective (BE Dev leads)
- Propose API endpoints (method, path, auth, request/response shape)
- Propose DB schema changes (new tables, columns, indexes, enums)
- Define validation rules (Zod schemas) and error codes
- Identify side effects (notifications, cron jobs, webhook triggers)
- Identify performance concerns (N+1 queries, large payloads, pagination)
- **Every proposal must include WHY** — e.g., "Composite index on (tripId, status) because the seat map query filters both"

### Round 4: Architecture Review (Senior Architect leads)
- Challenge proposals from Round 2 and Round 3
- Identify trade-offs and pick the best approach with reasoning
- Flag security concerns (auth, input sanitization, rate limiting)
- Flag scalability concerns (query performance, caching needs)
- Ensure patterns match existing codebase (check `docs/PROJECT_REFERENCE.md`)
- Ensure no layer violations (Controller → Repository is forbidden)
- **Final decision on each contested point with explicit trade-off reasoning**

### Round 5: Consensus & Action Items
- Summarize agreed approach for each major decision
- List any open questions that need more investigation
- Identify risks and mitigation strategies
- Agree on implementation order (DB → Shared → BE → FE)

## Meeting Rules

```
HARD RULES FOR THE MEETING:
1. Every point MUST have a valid reason — "because best practice" is NOT a reason
2. Trade-offs must be explicit: "Option A gives us X but costs Y. Option B gives us Z but costs W."
3. No bluffing — if something is uncertain, say "I'm not sure about X, we should investigate"
4. Challenge weak proposals — the Senior Architect's job is to poke holes
5. Reference existing code — "We already do X in booking.service.ts, we should be consistent"
6. Reference docs — back up claims with PROJECT_REFERENCE.md, tech-stack.md, preview.html
7. Keep it practical — this is an MVP, not a PhD thesis. Ship value.
8. Security and performance concerns are blockers, not nice-to-haves
```

---

# STEP 2: CREATE PLAN DOCUMENT

## Goal

After the Step 1 meeting concludes, consolidate ALL decisions into a structured **Feature Plan Document**. This is the single source of truth for what will be built.

## Plan Document Structure

Output the plan as a well-formatted markdown document with these sections:

### Section 1: Feature Overview
```
Feature Name: [Name]
Requested By: [User's original request]
Target Users: [Traveler / Organizer / Admin]
Business Value: [Why this matters — from PM's input]
```

### Section 2: User Stories & Acceptance Criteria
- List every user story from the PM round
- Each story has testable acceptance criteria
- Include edge cases the PM identified

### Section 3: API Design
| Method | Path | Auth | Request Body | Response | Notes |
|--------|------|------|-------------|----------|-------|
- Include request/response shapes (TypeScript interfaces)
- Include error codes and when they trigger
- Include rate limiting requirements if any

### Section 4: DB Schema Changes
- New models, columns, enums, indexes
- Migration strategy (nullable first, backfill later)
- Relationships and constraints

### Section 5: Shared Types & Validators
- New types in `packages/shared/src/types/`
- New Zod schemas in `packages/shared/src/validators/`
- New constants in `packages/shared/src/constants/`

### Section 6: FE Component Plan
```
Component Tree:
└── Page (server/client)
    ├── ComponentA (client) — [purpose]
    │   ├── SubComponentA1 — [purpose]
    │   └── SubComponentA2 — [purpose]
    └── ComponentB (client) — [purpose]

State Management:
- URL state: [what and why]
- Local state: [what and why]
- Server state: [TanStack Query keys]

Data Flow:
[User action] → [Hook] → [API endpoint] → [Service] → [Repository] → [DB]
```

### Section 7: 4-State Rendering Plan
For each data-fetching component:
| Component | Loading (Skeleton) | Error | Empty | Happy Path |
|-----------|-------------------|-------|-------|------------|

### Section 8: Mobile-First Layout
- Default (mobile) layout description
- `sm:` / `md:` / `lg:` breakpoint enhancements
- Stack → side-by-side transitions

### Section 9: Implementation Order
Ordered list of implementation steps, grouped by layer:
1. DB migration
2. Shared types + validators + constants
3. BE: Repository → Service → Controller → Routes (TDD)
4. FE: Hook → Components → Page
5. Integration verification

### Section 10: Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|

### Section 11: Test Plan
- BE unit tests: list of describe blocks and key test cases
- FE component tests: what each test covers
- Integration: smoke test scenarios

---

# STEP 3: REVIEW MEETING (Senior Review)

## Goal

Simulate a **senior review meeting** where the plan from Step 2 is presented and critiqued by senior engineers and stakeholders. The goal is to catch gaps, risks, and improvements BEFORE any code is written.

## Review Participants

| Role | Focus Area |
|------|-----------|
| **Senior FE Developer** | Component reuse, performance, bundle size, accessibility, design system compliance |
| **Senior BE Developer** | Query performance, security, error handling completeness, API design consistency |
| **Senior Architect** | Cross-cutting concerns, pattern consistency, scalability, tech debt risk |
| **Stakeholder (Product Owner)** | Does this plan deliver the user value? Missing user scenarios? Priority alignment? |

## Review Format

### Part 1: Plan Presentation
- Present the plan document from Step 2
- Walk through each section with the reasoning behind key decisions
- Highlight trade-offs that were made and why

### Part 2: Critical Review (each reviewer)
Each reviewer examines the plan through their lens and raises issues categorized as:

```
🔴 BLOCKER    — Must fix before implementation (security hole, data loss risk, wrong architecture)
🟡 IMPORTANT  — Should fix, significant quality impact if ignored
🟢 SUGGESTION — Nice to have, would improve quality but not blocking
```

**Review Checklist (each reviewer applies their domain expertise):**

```
SENIOR FE DEV:
- Does the component hierarchy avoid unnecessary re-renders?
- Are we reusing existing components from PROJECT_REFERENCE.md or duplicating?
- Does the skeleton match the actual component shape?
- Is the empty state actionable (has a CTA)?
- Mobile-first: tested at 375px mental model?
- Design system: colors from tokens.json? Spacing multiples of 4px?
- Accessibility: keyboard nav, screen reader, focus management?
- Performance: lazy loading images? Pagination vs infinite scroll decision?

SENIOR BE DEV:
- Are all queries covered by indexes?
- Is there an N+1 query risk? Does the include/select pattern prevent it?
- Are all error paths returning proper HTTP status codes?
- Is the validation schema complete (min/max/trim/lowercase)?
- Are side effects (notifications, cache invalidation) accounted for?
- Does this follow existing patterns in the codebase? (check PROJECT_REFERENCE.md)
- Is the atomic operation pattern correct? (transactions where needed)

SENIOR ARCHITECT:
- Does this introduce any architectural inconsistency?
- Layer violations? (Controller calling Repository directly?)
- Security: auth on every mutation endpoint? Rate limiting on public endpoints?
- Performance: will this scale with 10x data? 100x users?
- Is the error handling strategy consistent with the rest of the API?
- Are there any cross-feature impacts? (e.g., does this affect booking flow?)
- Is the test plan sufficient? Missing edge cases?

STAKEHOLDER:
- Does the UX flow match what users actually need?
- Are there user scenarios we haven't considered?
- Is this the right scope for MVP? Too much? Too little?
- Priority: should this be split into phases?
```

### Part 3: Consolidated Feedback
- List all 🔴 BLOCKER items (must fix)
- List all 🟡 IMPORTANT items (should fix)
- List all 🟢 SUGGESTION items (nice to have)
- Note any disagreements and the resolution

---

# STEP 4: REFINE PLAN

## Goal

Take the feedback from Step 3 and produce the **final plan**. This is the version the user will approve.

## Process

1. Address every 🔴 BLOCKER — these are mandatory fixes
2. Address every 🟡 IMPORTANT — incorporate unless there's a strong reason not to (document why if skipping)
3. Consider 🟢 SUGGESTION items — incorporate easy wins, defer complex ones to Phase 2
4. Update ALL affected sections of the plan document
5. Mark what changed with `[UPDATED]` tags so the user can see diffs

## Output

Rewrite the complete plan document from Step 2 with all improvements incorporated. Add a **Changes Summary** section at the top listing:

```
CHANGES FROM REVIEW:
🔴 Fixed: [description of each blocker fix]
🟡 Fixed: [description of each important fix]
🟢 Added: [description of each suggestion incorporated]
🟢 Deferred: [description of suggestions pushed to Phase 2, with reason]
```

---

# STEP 5: USER APPROVAL

## Goal

Present the final plan to the user and **WAIT for their explicit approval** before writing any code.

## What to Present

1. **Changes Summary** — what changed from the review
2. **Full final plan** — the complete document from Step 4
3. **Implementation estimate** — rough breakdown of what will be built
4. **Ask explicitly:** "Do you approve this plan for implementation? Any changes needed?"

## Rules

```
CRITICAL RULES:
1. Do NOT write any code until the user says "approved" or equivalent
2. If the user requests changes, go back to Step 4 and update the plan
3. If the user asks questions, answer them before requesting approval again
4. The user may approve partially — "approve BE but I want to discuss FE" is valid
5. Respect the user's judgment — they know their product better than the plan does
```

---

# STEP 6: IMPLEMENTATION

## Goal

Build the approved feature using the established `/build-backend` and `/build-frontend` workflows, referencing all project documentation for consistency.

## Pre-Implementation: Read Reference Files

Before writing ANY code, read these files for context:

```
MANDATORY READS:
1. docs/engineering/fe/preview.html     — UI design reference
2. docs/PROJECT_MINDMAP.md              — System architecture overview
3. docs/PROJECT_REFERENCE.md            — Full API surface, DB schema, component map
4. docs/engineering/tech-stack.md       — Architecture patterns, design patterns
5. docs/engineering/fe/design-system.md — Colors, tokens, component styles
6. docs/mvp/mvp-plan.md                — Current MVP status and scope
7. The approved plan from Step 5        — THE source of truth for this feature
```

## Implementation Pipeline

Follow this exact sequence. Each phase uses the corresponding workflow.

### Phase A: DB Schema (if needed)

```
1. Update apps/api/prisma/schema.prisma per the approved plan
2. Run migration:
   // turbo
   npx prisma migrate dev --name <feature-name>
   // turbo
   npx prisma generate
3. Schema change checklist:
   [ ] Model has mixin fields (isActive, isDeleted, createdAt, updatedAt, deletedAt)
   [ ] New columns are nullable or have defaults
   [ ] Relations use @relation with explicit names
   [ ] Indexes match query patterns from the plan
   [ ] Price fields are Int (whole rupees)
   [ ] @@index([isDeleted]) on every model
```

### Phase B: Shared Types + Validators + Constants

```
1. Create/update packages/shared/src/types/<domain>.types.ts
2. Create/update packages/shared/src/validators/<domain>.schema.ts
3. Create/update packages/shared/src/constants/<domain>.ts (if new constants needed)
4. Export from barrel files (index.ts)
```

### Phase C: Backend (follow /build-backend workflow)

Execute the `/build-backend` workflow with TDD:

```
1. Write failing tests FIRST (Red Phase)
   - Unit tests: apps/api/tests/unit/services/<domain>.service.test.ts
   - Test data factories if needed

2. Implement in order:
   - Repository (DB queries only)
   - Service (business logic, DI)
   - Controller (thin, asyncHandler)
   - Routes (middleware pipeline)

3. Run tests — they should PASS (Green Phase):
   // turbo
   npm run test -- --run

4. Refactor Phase:
   [ ] Service methods < 30 lines
   [ ] Controller methods < 15 lines
   [ ] No console.log, no any
   [ ] Constants from constants.ts
   [ ] All queries filter isDeleted: false

5. Wire in config/dependencies.ts
6. Mount routes in server.ts

7. Verify BE in isolation:
   // turbo
   npm run test -- --run
   // turbo
   npx tsc --noEmit
```

### Phase D: Frontend (follow /build-frontend workflow)

Execute the `/build-frontend` workflow:

```
1. Add query key factory to lib/query-keys.ts
2. Build custom hook: hooks/use-<domain>.ts
3. Build components (4-state pattern mandatory):
   - Skeleton component
   - Main component with loading/error/empty/data states
   - Error boundary per item
4. Wire up page + route files (error.tsx, loading.tsx)
5. Ensure mobile-first (test at 375px mental model)
6. Match design system from preview.html + design-system.md

7. Verify FE:
   // turbo
   npx tsc --noEmit -p apps/web/tsconfig.json
```

### Phase E: Integration & Verification

```
1. Run full test suite:
   // turbo
   npm run test -- --run

2. Type check both apps:
   // turbo
   npx tsc --noEmit -p apps/api/tsconfig.json
   // turbo
   npx tsc --noEmit -p apps/web/tsconfig.json

3. Feature completeness checklist (from approved plan):
   [ ] All API endpoints implemented
   [ ] All components render 4 states
   [ ] All business rules enforced
   [ ] All edge cases handled
   [ ] All tests pass
   [ ] 0 TypeScript errors
```

### Phase F: Post-Implementation

```
1. Create feature documentation: docs/engineering/fe/<feature>.md
   (7 sections: Overview, Data Flow, API, Business Rules, Edge Cases, Errors, Tests)

2. Update docs/mvp/mvp-plan.md:
   - Mark the feature as COMPLETED
   - Add completion date
   - Note any Phase 2 items deferred

3. Commit with conventional commit format via /commit-changes workflow
```

## Implementation Rules

```
HARD RULES DURING IMPLEMENTATION:
1. Follow the APPROVED PLAN — don't deviate without user consent
2. If you discover something the plan missed, TELL the user before implementing
3. Reference preview.html for ALL UI decisions
4. Reference PROJECT_REFERENCE.md to ensure consistency with existing code
5. Use existing patterns — don't invent new ones unless the plan calls for it
6. Every new public method gets JSDoc
7. Every new component handles 4 states
8. Every mutation invalidates related query keys
9. Mobile-first: write mobile styles as default, enhance with breakpoints
10. No any, no console.log, no @ts-ignore in production code
```

---

# MANDATORY STANDARDS (Apply During Step 6)

The following standards are enforced during implementation. They are carried over from the `/build-backend` and `/build-frontend` workflows.

---

## MANDATORY: Feature Documentation

Every feature MUST have a documentation file in `docs/engineering/fe/` that describes its flow, edge cases, and test coverage. This is **not optional** — treat it as a deliverable alongside code.

### Documentation File Location

```
docs/engineering/fe/<feature-name>.md
```

Examples:
- `docs/engineering/fe/revenue-and-bookings.md`
- `docs/engineering/fe/trip-requests.md`
- `docs/engineering/fe/auth-flow.md`

### Required Sections in Every Feature Doc

```markdown
# <Feature Name> — Feature Documentation

## Overview
One paragraph: what the feature does, who uses it, why it exists.

## 1. Data Flow
Describe the end-to-end flow with a diagram or step list:
  URL/Action → FE Hook → API Endpoint → Service → Repository → DB

## 2. API Endpoints
Table of all endpoints this feature uses:
| Method | Path | Auth | Description |
|--------|------|------|-------------|

## 3. Business Rules
- Bullet list of every business rule enforced in the service layer.
- Include formulas (e.g., revenue = CAPTURED payments − refunds).
- Include enum states and transitions (e.g., PENDING → CONFIRMED → COMPLETED).

## 4. Edge Cases
Table format:
| Scenario | Expected Behavior |
|----------|-------------------|

## 5. Error Handling
| Error | HTTP Status | When |
|-------|-------------|------|

## 6. Test Coverage
Reference test file paths and list what each `describe` block covers:
- ✅ Happy path
- ✅ Edge case X
- ✅ Error case Y

## 7. Seed Data (if applicable)
Table of relevant seed scenarios and credentials.
```

### Documentation Rules

```
Rules:
- Create the doc AFTER tests pass, not before (doc reflects reality, not wishes)
- Every business rule in the service layer MUST appear in the doc
- Every edge case tested MUST be listed in the Edge Cases table
- Include test credentials if the feature has seed data
- Keep the doc under 200 lines — concise, not verbose
- Update the doc when the feature changes (doc rot = tech debt)
- Link related docs if the feature depends on another (e.g., "See auth-flow.md")
```

### Documentation File Map

| Feature | Doc Location |
|---------|-------------|
| Revenue, Bookings, Refunds | `docs/engineering/fe/revenue-and-bookings.md` |
| Trip Requests (Accept/Reject) | `docs/engineering/fe/trip-requests.md` |
| Auth (Login/Signup/Refresh) | `docs/engineering/fe/auth-flow.md` |
| Trip CRUD + Upload | `docs/engineering/fe/trip-management.md` |
| Notifications | `docs/engineering/fe/notifications.md` |
| Chat | `docs/engineering/fe/chat.md` |
| Reviews | `docs/engineering/fe/reviews.md` |
| Organizer Dashboard | `docs/engineering/fe/organizer-dashboard.md` |

---

## MANDATORY: Code Comments Standards

Every method in services, repositories, and hooks MUST have a JSDoc comment. This is a **hard rule** — no exceptions.

### Service Layer Comments (`apps/api/src/services/`)

```typescript
/**
 * Short description of what the method does.
 *
 * Business rules:
 * - Rule 1 (e.g., "Only ACTIVE trips can toggle bookings")
 * - Rule 2 (e.g., "Revenue = CAPTURED payments − CAPTURED refunds")
 *
 * Edge cases:
 * - Edge case 1 (e.g., "Returns 0 if no payments exist")
 * - Edge case 2 (e.g., "Deleted trips excluded from calculation")
 *
 * @throws NotFoundError — when <entity> not found
 * @throws ForbiddenError — when user doesn't own the resource
 * @throws ValidationError — when business rule violated
 */
async methodName(param: Type): Promise<ReturnType> {
```

### Repository Layer Comments (`apps/api/src/repositories/`)

```typescript
/**
 * Short description of the query and its purpose.
 *
 * Filters: list key WHERE conditions (e.g., isDeleted: false, status: CAPTURED)
 * Used by: which service method calls this
 *
 * Edge cases:
 * - What happens with null/empty results
 * - Any aggregation nuances (e.g., _sum returns null if no rows)
 */
async methodName(param: Type): Promise<ReturnType> {
```

### Hook Comments (`apps/web/src/hooks/`)

```typescript
/**
 * Short description — what data it fetches or what action it performs.
 *
 * Query key: tripKeys.list(filters) — for cache identification
 * Invalidates: list which caches are invalidated on success (for mutations)
 * Error handling: describe onError behavior (toast, redirect, etc.)
 */
export function useHookName() {
```

### Controller Comments (`apps/api/src/controllers/`)

Controllers are thin — a single-line JSDoc is sufficient:

```typescript
/** POST /trips — Create a new trip (organizer only) */
createTrip = asyncHandler(async (req, res) => {
```

### Comment Rules

```
Rules:
- EVERY public method in service, repository, and hook files MUST have a JSDoc comment
- Private/helper methods: single-line comment above is sufficient
- Do NOT comment obvious code (e.g., `// return the result` above `return result`)
- DO comment business logic, formulas, and non-obvious decisions
- Include @throws tags for service methods that throw typed errors
- Include "Edge cases:" section for methods with tricky behavior
- Keep comments up-to-date — stale comments are worse than no comments
- Use "Why" comments for non-obvious decisions, not "What" comments for obvious code
```

---

## MANDATORY: Test Case Standards

Every feature MUST have comprehensive unit tests following these rules. Tests are a **first-class deliverable**, not an afterthought.

### Test File Structure

```typescript
// tests/unit/services/<domain>.service.test.ts

describe('<ServiceName>', () => {

  // ─── Test data & mocks (top of file) ────────────────
  // Define mock repos, mock data, and service instance

  beforeEach(() => {
    vi.clearAllMocks()
    // Re-instantiate service with fresh mocks
  })

  // ─── One describe per public method ─────────────────

  describe('methodName', () => {

    // 1. Happy path FIRST — always the first test
    it('should <expected behavior> when <valid input>', async () => {
      // Arrange → Act → Assert
    })

    // 2. Edge cases — boundary conditions, zero/null/empty
    it('should <edge behavior> when <edge condition>', async () => {
    })

    // 3. Error cases — one test per error type
    it('should throw <ErrorType> when <condition>', async () => {
      await expect(service.method(badInput)).rejects.toThrow('<error message>')
    })

    // 4. Authorization — wrong owner, wrong role
    it('should throw ForbiddenError when <unauthorized condition>', async () => {
    })
  })
})
```

### Test Naming Convention

```
Pattern: "should <expected outcome> when <condition>"

✅ Good:
  "should return stats with revenue from CAPTURED payments minus refunds"
  "should throw ForbiddenError when toggling another organizer's trip"
  "should return zero revenue when organizer has no payments"
  "should throw ValidationError for COMPLETED trip"

❌ Bad:
  "test getOrganizerStats"
  "works correctly"
  "error case"
  "should work"
```

### Minimum Test Coverage Per Method

```
Every public service method MUST have at minimum:

1. ✅ Happy path test (valid input → expected output)
2. ✅ Not-found test (entity doesn't exist → NotFoundError)
3. ✅ Authorization test (wrong owner → ForbiddenError)
4. ✅ Validation test (invalid state → ValidationError)
5. ✅ Edge case tests (zero values, empty arrays, boundary conditions)

For mutations (create/update/delete), also test:
6. ✅ Side effects verified (logger called, cache invalidated, related records updated)
7. ✅ Idempotency where applicable

For aggregation methods (stats, revenue), also test:
8. ✅ Zero/empty result
9. ✅ Negative values (e.g., refunds exceed payments)
10. ✅ Large dataset behavior
```

### Test Data Rules

```
Rules:
- Use factory functions for test data (tests/helpers/factories.ts)
- Override only the fields relevant to the test — use spread: { ...mockTrip, status: 'COMPLETED' }
- Use descriptive variable names: mockActiveTrip, mockCompletedTrip, not trip1, trip2
- Mock return values should match real Prisma shapes
- Never use real API keys, passwords, or PII in test data
- Use deterministic dates (new Date('2025-06-01')), not Date.now()
```

### Arrange-Act-Assert Pattern

```typescript
it('should return stats with revenue from CAPTURED payments minus refunds', async () => {
  // Arrange — set up mocks and input
  mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
  mockTripRepo.findByOrganizerId.mockResolvedValue([
    { ...mockTrip, status: 'ACTIVE', currentBookings: 5 },
  ])
  mockTripRepo.calculateOrganizerRevenue.mockResolvedValue(45000)
  mockTripRepo.countPendingRequests.mockResolvedValue(2)

  // Act — call the method under test
  const result = await service.getOrganizerStats('user-1')

  // Assert — verify outcomes
  expect(result.activeTrips).toBe(1)
  expect(result.revenue).toBe(45000)
  expect(result.pendingRequests).toBe(2)
  expect(mockTripRepo.calculateOrganizerRevenue).toHaveBeenCalledWith('org-1')
})
```

### Test Verification Checklist (run after writing tests)

```
[ ] Every public method has a describe block
[ ] Happy path is the FIRST test in each describe
[ ] Error cases test the exact error message (not just error type)
[ ] Mock assertions verify the method was called with correct args
[ ] No tests depend on execution order (each test is independent)
[ ] Tests run in < 5 seconds total (no real DB, no real HTTP)
[ ] No console.log in tests — use expect() assertions
[ ] Test file follows naming convention: <service>.service.test.ts
```

---

## Quick Reference: Full-Stack File Map

| Layer | "I need to..." | Location |
|-------|----------------|----------|
| **DB** | Add/change a table | `apps/api/prisma/schema.prisma` |
| **DB** | Run migration | `npx prisma migrate dev --name <name>` |
| **Shared** | Add a type both FE+BE use | `packages/shared/src/types/<domain>.types.ts` |
| **Shared** | Add a validator both FE+BE use | `packages/shared/src/validators/<domain>.schema.ts` |
| **BE** | Write a DB query | `apps/api/src/repositories/<domain>.repository.ts` |
| **BE** | Write business logic | `apps/api/src/services/<domain>.service.ts` |
| **BE** | Parse request + send response | `apps/api/src/controllers/<domain>.controller.ts` |
| **BE** | Wire route + middleware | `apps/api/src/routes/<domain>.routes.ts` |
| **BE** | Unit test | `apps/api/tests/unit/services/<domain>.service.test.ts` |
| **BE** | Integration test | `apps/api/tests/integration/routes/<domain>.routes.test.ts` |
| **BE** | Test data | `apps/api/tests/helpers/factories.ts` |
| **FE** | Fetch data from API | `apps/web/src/hooks/use-<domain>.ts` |
| **FE** | Build feature component | `apps/web/src/components/<feature>/<name>.tsx` |
| **FE** | Build skeleton | `apps/web/src/components/<feature>/<name>-skeleton.tsx` |
| **FE** | Add a page | `apps/web/src/app/(group)/<route>/page.tsx` |
| **FE** | Handle page error | `apps/web/src/app/(group)/<route>/error.tsx` |
| **FE** | Component test | `apps/web/src/components/<feature>/__tests__/<name>.test.tsx` |
| **FE** | Form with validation | React Hook Form + Zod from `@shared/validators/` |
