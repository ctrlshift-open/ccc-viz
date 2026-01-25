---
# ccc-viz-0qde
title: 'Phase 03: UI Components'
status: completed
type: task
priority: normal
created_at: 2026-01-25T17:11:57Z
updated_at: 2026-01-25T19:00:38Z
---

**Depends on:** Phase 02: API Routes

## Tasks

- [x] Create `KanbanCard.tsx`:
  - Show: title, project badge, git branch (🌿 icon), timestamp, message count
  - Editable title - click to edit inline
  - Draggable with HTML5 DnD
  - Link to session detail
  - Badge for merged cards "[3 sessions]"
- [x] Create `KanbanColumn.tsx`:
  - Column header with status + count
  - Drop zone
  - Card list
- [x] Create `KanbanBoard.tsx`:
  - 5 columns layout (horizontal scroll mobile)
  - Search input - filter cards by title text
  - Project filter dropdown
  - Drag-and-drop coordination

## Verification

- [x] Tests pass: `pnpm test`
- [x] No type errors: `pnpm typecheck`
