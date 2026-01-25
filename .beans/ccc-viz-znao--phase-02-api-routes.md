---
# ccc-viz-znao
title: 'Phase 02: API Routes'
status: todo
type: task
created_at: 2026-01-25T17:11:56Z
updated_at: 2026-01-25T17:11:56Z
---

**Depends on:** Phase 01: Foundation

## Tasks

- [ ] Create `api.kanban.state.ts` - GET state, POST update
- [ ] Create `api.kanban.cards.$cardId.ts` - PATCH status/order
- [ ] Create `api.kanban.merge.ts` - POST merge sourceId + targetId

## Verification

- [ ] Tests pass: `pnpm test`
- [ ] No type errors: `pnpm typecheck`