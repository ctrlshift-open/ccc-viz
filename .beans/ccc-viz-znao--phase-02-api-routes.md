---
# ccc-viz-znao
title: 'Phase 02: API Routes'
status: completed
type: task
priority: normal
created_at: 2026-01-25T17:11:56Z
updated_at: 2026-01-25T18:58:22Z
---

**Depends on:** Phase 01: Foundation

## Tasks

- [x] Create `api.kanban.state.ts` - GET state, POST update
- [x] Create `api.kanban.cards.$cardId.ts` - PATCH status/order
- [x] Create `api.kanban.merge.ts` - POST merge sourceId + targetId

## Verification

- [x] Tests pass: `pnpm test`
- [x] No type errors: `pnpm typecheck`