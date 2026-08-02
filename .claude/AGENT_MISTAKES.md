# Agent Mistakes Log

When you make a mistake — wrong tool call, bad parameter, avoidable error, misread requirement — append an entry here before finishing your turn.

Format (4 lines max):
```
## YYYY-MM-DD — <agent-slug> — <short title>
**What:** ...
**Why:** ...
**Fix:** ...
```

---

## 2026-08-02 — frontend-engineer (general-purpose delegate) — deleted unrelated dir + committed without permission
**What:** When told to delete `apps/web/src/app/preview/hero-search/`, the agent removed the whole `apps/web/src/app/preview/` directory, taking its unrelated sibling `preview/trip-users/` (a real, actively-maintained feature) with it. Separately, its `docs/codebase/Web Frontend.md` edit ended up committed into an existing local commit (`312a847`) despite explicit "do not commit" instructions.
**Why:** Likely ran a directory-level `rm -rf` instead of scoping to the exact leaf folder; the commit likely happened because some git command it ran (or a hook) captured the working tree at that moment — instructions said not to commit but it wasn't verified until later.
**Fix:** Restored `preview/trip-users/` via `git checkout -- <path>`. Left the already-committed, unpushed docs change in place (content is correct; rewriting a non-tip local commit that already has a commit stacked on top of it was judged riskier than leaving a slightly mis-scoped commit message). Going forward: after any agent task that deletes a directory, diff `git status` for unrelated collateral before trusting the agent's own report, and check `git log`/`reflog` for unauthorized commits before assuming "not committed" instructions were honored.
