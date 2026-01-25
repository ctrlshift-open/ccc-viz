---
# ccc-viz-fzve
title: 'Phase 03: Single Card Regeneration'
status: completed
type: task
priority: normal
created_at: 2026-01-25T20:24:34Z
updated_at: 2026-01-25T21:02:01Z
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
- [x] Click regenerate on a card - title updates (code verified via Playwright inspection)