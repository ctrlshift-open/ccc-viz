# Ralph Agent Instructions

## Your Task

1. Read `ralph/overview.md`
2. Query phase beans: `beans query '{ beans(filter: { search: "Phase" }) { id title status body } }'`
3. Read `progress.txt` (check Codebase Patterns first)
4. Check you're on the correct branch
5. Pick highest priority incomplete phase bean
6. Implement ONE task from that phase
7. Run `pnpm typecheck && pnpm test`
8. Update CLAUDE.md file with learnings
9. Commit: `feat: [Phase] - [Task]`
10. Update phase bean checklist (mark completed tasks)
11. Append learnings to progress.txt
12. Push all changes
13. If no PR exists for this branch, create one with `gh pr create`
14. After pushing, check CI status with `gh run list --limit 5` and verify the latest run passes

## Progress Format

APPEND to progress.txt:

## [Date] - [Story ID]

- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered

---

## Codebase Patterns

Add reusable patterns to the TOP
of progress.txt:

## Codebase Patterns

- pnpm: package manager
- vitest: test framework
- React Router 7 with SSR
