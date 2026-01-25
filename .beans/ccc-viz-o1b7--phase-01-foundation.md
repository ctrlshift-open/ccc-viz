---
# ccc-viz-o1b7
title: 'Phase 01: Foundation'
status: todo
type: task
created_at: 2026-01-25T17:11:55Z
updated_at: 2026-01-25T17:11:55Z
---

**Depends on:** None

## Tasks

- [ ] Create `app/types/kanban.ts` with types
- [ ] Create `app/utils/kanban.server.ts`:
  - `getKanbanState()` - read from `~/.claude/cc-viz/kanban.json`
  - `saveKanbanState()` - write state
  - `syncSessionsToCards()` - detect new sessions:
    - If kanban.json doesn't exist (initial import): all sessions → `archive`
    - If kanban.json exists: new sessions → `in-progress`
  - `generateTitle()` - auto-generate title from session data

## Verification

- [ ] Tests pass: `pnpm test`
- [ ] No type errors: `pnpm typecheck`