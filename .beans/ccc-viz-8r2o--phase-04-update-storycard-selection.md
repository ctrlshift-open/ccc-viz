---
# ccc-viz-8r2o
title: 'Phase 04: Update StoryCard Selection'
status: in-progress
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
- [ ] Click card → panel opens with story details
- [ ] Click different card → panel updates
- [ ] Click backdrop → panel closes
- [ ] Press Escape → panel closes
- [ ] Edit title/PR in panel → saves correctly
- [ ] Archive from panel → story archives, panel closes
- [ ] Drag card → still works, doesn't trigger selection
- [ ] Panel scrolls when content overflows
- [ ] Mobile: panel takes full width