---
# ccc-viz-68ge
title: 'Kanban refactor: stories per branch'
status: completed
type: feature
priority: normal
created_at: 2026-01-26T03:28:22Z
updated_at: 2026-01-26T03:36:37Z
---

Change kanban from 1 card per session to 1 story per project+branch.

## Checklist

- [x] Update `app/types/kanban.ts` - new Story types, version bump
- [x] Refactor `app/utils/kanban.server.ts` - sync algorithm, PR detection
- [x] Update `app/routes/kanban.tsx` - actions for stories, sync intent
- [x] Create `app/components/StoryCard.tsx` - new card component
- [x] Update `app/components/KanbanBoard.tsx` - sync button, remove merge
- [x] Update `app/components/KanbanColumn.tsx` - stories props
- [x] Rename `api.kanban.cards.$cardId.ts` to `api.kanban.stories.$storyId.ts`
- [x] Delete `app/routes/api.kanban.merge.ts`
- [x] Update `api.kanban.state.ts` for stories
- [x] Test all flows