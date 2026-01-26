---
# ccc-viz-8r2o
title: 'Phase 04: Update StoryCard Selection'
status: completed
type: task
priority: normal
created_at: 2026-01-26T12:10:41Z
updated_at: 2026-01-26T12:20:11Z
---

**Depends on:** Phase 03

## Tasks

- [x] Add isSelected prop to StoryCard.tsx
- [x] Add onSelect callback prop
- [x] Add click handler on card container
- [x] Selection styling: `ring-2 ring-blue-500` when isSelected
- [x] Differentiate click vs drag (preserve drag-and-drop)
- [x] Remove inline editing (move to panel only)
- [x] Keep menu for quick archive

## Verification

- [x] Tests pass: `pnpm test`
- [x] No type errors: `pnpm typecheck`
- [x] Click card → panel opens with story details
- [x] Click different card → panel updates
- [x] Click backdrop → panel closes
- [x] Press Escape → panel closes
- [x] Edit title/PR in panel → saves correctly
- [x] Archive from panel → story archives, panel closes
- [x] Drag card → still works, doesn't trigger selection
- [x] Panel scrolls when content overflows
- [x] Mobile: panel takes full width