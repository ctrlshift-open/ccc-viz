---
# ccc-viz-3m6p
title: 'Phase 04: Main Route'
status: completed
type: task
priority: normal
created_at: 2026-01-25T17:11:58Z
updated_at: 2026-01-25T19:04:41Z
---

**Depends on:** Phase 03: UI Components

## Tasks

- [x] Create `app/routes/kanban.tsx`:
  - Loader: fetch all projects, sessions, kanban state
  - Sync new sessions to cards
  - Action: handle card moves, status changes

## Verification

- [x] Tests pass: `pnpm test`
- [x] No type errors: `pnpm typecheck`