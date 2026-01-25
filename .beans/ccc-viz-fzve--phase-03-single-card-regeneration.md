---
# ccc-viz-fzve
title: 'Phase 03: Single Card Regeneration'
status: in-progress
type: task
priority: normal
created_at: 2026-01-25T20:24:34Z
updated_at: 2026-01-25T20:39:59Z
---

**Depends on:** Phase 01

## Tasks

- [x] Add POST endpoint to api.kanban.cards.$cardId.ts for single card title regeneration
- [x] Add regenerate button (sparkle icon) to KanbanCard.tsx next to title
- [x] Show loading spinner during generation
- [x] Update card title on success

## Verification

- [x] Tests pass: `pnpm test`
- [x] No type errors: `pnpm typecheck`
- [ ] Click regenerate on a card - title updates