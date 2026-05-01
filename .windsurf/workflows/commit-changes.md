---
description: Commit staged/unstaged changes with small, feature-wise commit messages following conventional commit format
---

# Commit Changes Workflow

This workflow commits all pending changes as small, logically grouped commits. Run when the user says "commit", "commit changes", or uses `/commit-changes`.

---

## Step 1: Check Git Status

```bash
// turbo
git status --short
```

If working tree is clean, inform the user — nothing to commit.

---

## Step 2: Understand the Diff

```bash
// turbo
git diff --stat HEAD
```

For untracked files:
```bash
// turbo
git ls-files --others --exclude-standard
```

---

## Step 3: Group Files by Feature

Classify every changed/new file into logical commit groups using this priority order:

| Priority | Group | File patterns | Commit prefix |
|----------|-------|--------------|---------------|
| 1 | **Shared types & validators** | `packages/shared/src/**` | `feat(shared):` |
| 2 | **Database / Prisma** | `apps/api/prisma/**` | `feat(db):` |
| 3 | **BE config & setup** | `apps/api/src/config/**`, `apps/api/src/middleware/**`, `apps/api/src/errors/**`, `apps/api/src/utils/**` | `feat(api):` or `chore(api):` |
| 4 | **BE feature (per domain)** | `apps/api/src/repositories/<domain>*`, `apps/api/src/services/<domain>*`, `apps/api/src/controllers/<domain>*`, `apps/api/src/routes/<domain>*`, `apps/api/src/validators/<domain>*` | `feat(api):` |
| 5 | **BE tests** | `apps/api/tests/**` | `test(api):` |
| 6 | **FE lib & hooks** | `apps/web/src/lib/**`, `apps/web/src/hooks/**` | `feat(web):` |
| 7 | **FE shared components** | `apps/web/src/components/shared/**`, `apps/web/src/components/layout/**` | `feat(web):` |
| 8 | **FE feature components** | `apps/web/src/components/<feature>/**` | `feat(web):` |
| 9 | **FE pages (per route)** | `apps/web/src/app/<route>/**` | `feat(web):` |
| 10 | **FE styles** | `apps/web/src/app/globals.css`, `tailwind.config.*` | `style(web):` |
| 11 | **FE tests** | `apps/web/src/**/*.test.*` | `test(web):` |
| 12 | **Docs** | `docs/**` | `docs:` |
| 13 | **Workflows & config** | `.windsurf/**`, `*.config.*`, `package.json`, `turbo.json`, `docker*` | `chore:` |

### Grouping Rules

1. **Same domain files go together** — e.g., `trip.repository.ts` + `trip.service.ts` + `trip.controller.ts` + `trip.routes.ts` + `trip.schema.ts` = one commit
2. **Page + its loading/error files go together** — e.g., `trips/page.tsx` + `trips/loading.tsx` + `trips/error.tsx` = one commit
3. **A component and its skeleton go together** — e.g., `trip-card.tsx` + `trip-card-skeleton.tsx` = one commit
4. **Tests commit separately from implementation** — unless it's a small change where test + impl together makes more sense
5. **Max 10-15 files per commit** — split further if a group is too large
6. **Modified files and new files in the same feature go together**

---

## Step 4: Write Commit Messages

Follow **Conventional Commits** format:

```
<type>(<scope>): <short description>
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `style` | CSS, design system, formatting (no logic change) |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Config, dependencies, tooling, workflows |
| `perf` | Performance improvement |

### Scopes

| Scope | When |
|-------|------|
| `shared` | `packages/shared/` changes |
| `api` | `apps/api/` changes |
| `web` | `apps/web/` changes |
| `db` | Prisma schema, migrations, seed |
| *(none)* | Root-level config, multi-package changes |

### Message Rules

1. **Lowercase** — no capital first letter after colon
2. **No period** at end
3. **Imperative mood** — "add trip search" not "added trip search"
4. **≤72 characters** total
5. **Specific** — "add trip card skeleton with shimmer" not "update components"
6. **Group what changed** — "add header, footer, and layout components" for multiple related files

### Good Examples

```
feat(shared): add TripSummary and TripFilters types
feat(api): add trip search with filters and pagination
feat(web): add trip card, skeleton, and grid components
feat(web): add trip detail page with booking sidebar
feat(web): add trips list page with search and filters
style(web): add shimmer animation and skeleton CSS class
fix(web): use skeleton class instead of animate-pulse
test(api): add booking service unit tests
chore: add /review-diff workflow
docs: update API endpoints in tech-stack.md
refactor(api): extract buildWhereClause to private method
```

### Bad Examples

```
❌ Updated files                    → too vague
❌ feat: changes                    → meaningless
❌ Fix stuff                        → no type, no scope, no detail
❌ feat(web): Added the trip card.  → past tense, has period
❌ feat(api): Add trip repository, service, controller, routes, schema, tests, and update dependencies  → too long
```

---

## Step 5: Execute Commits

For each group identified in Step 3, run:

```bash
git add <file1> <file2> ... && git commit -m "<type>(<scope>): <message>"
```

### Important

- **Stage files explicitly** — never use `git add .` (may include unintended files)
- **Escape special characters** in file paths — e.g., `\[slug\]` for Next.js dynamic routes
- **Commit in dependency order** — shared types first, then BE, then FE, then tests, then docs, then config
- **Verify after all commits**:

```bash
// turbo
git status --short
// turbo
git log --oneline -N  # where N = number of commits just made
```

---

## Step 6: Single Summary (Optional)

If the user asks for "one commit" or "squash", use a single commit instead:

```bash
git add -A && git commit -m "feat: <high-level summary of all changes>"
```

Only do this if explicitly requested. Default is always small, feature-wise commits.

---

## Quick Reference: Commit Decision Tree

```
Is it a new feature?
  → feat(<scope>): <what was added>

Is it a bug fix?
  → fix(<scope>): <what was fixed>

Is it CSS/design only?
  → style(<scope>): <what changed>

Is it tests only?
  → test(<scope>): <what was tested>

Is it refactoring (no behavior change)?
  → refactor(<scope>): <what was restructured>

Is it docs?
  → docs: <what was documented>

Is it config/tooling?
  → chore: <what was configured>
```
