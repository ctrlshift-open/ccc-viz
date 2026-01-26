# Kanban Story Detail Slide-Over Panel

## Summary

Add a slide-over detail panel on the right side of the kanban board. Clicking a card selects it and opens the panel with full story details, vertical scrolling, and text wrapping. Cards remain compact.

## Design Decisions

- **Toggle behavior**: Keep panel open when clicking same card (only backdrop/Escape/X closes)
- **Editing location**: Panel only - cards become read-only, simplifies drag-and-drop
- **Panel width**: 400px (full width on mobile)

## Files to Modify

| File | Change |
|------|--------|
| `app/components/StoryDetailPanel.tsx` | **New** - Panel component |
| `app/components/KanbanBoard.tsx` | Add selection state, render panel |
| `app/components/StoryCard.tsx` | Add click handler, selection styling |
| `app/components/KanbanColumn.tsx` | Pass selection props through |

## Implementation Steps

### 1. Create StoryDetailPanel.tsx

New component with:
- Fixed position right side: `fixed top-0 right-0 h-full w-full sm:w-[400px]`
- Backdrop overlay with click-to-close
- Escape key closes panel
- Body scroll lock when open
- Transform animation (slide in from right)

**Panel sections:**
- Header: Close button (X), "Story Details" title
- Title: Full text, editable (click to edit, Enter/Escape handlers)
- Project: Full path (not abbreviated like card)
- Branch: Name with visual indicator
- PR Link: Display/edit with GitHub icon
- Sessions: Full list with names, timestamps, clickable links
- Metadata: Created/updated dates
- Footer: Archive button

### 2. Add Selection State to KanbanBoard.tsx

```typescript
const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

const selectedStory = selectedStoryId
  ? state.stories.find(s => s.id === selectedStoryId)
  : null;

const handleStorySelect = (storyId: string) => setSelectedStoryId(storyId);
const handlePanelClose = () => setSelectedStoryId(null);
```

Render panel at end of component.

### 3. Update KanbanColumn.tsx

Pass through props:
- `selectedStoryId?: string | null`
- `onStorySelect?: (storyId: string) => void`

### 4. Update StoryCard.tsx

Changes:
- Add `isSelected?: boolean` prop for ring highlight
- Add `onSelect?: () => void` prop
- Add click handler on card container
- Keep drag-and-drop (differentiate click vs drag)
- Remove inline editing (move to panel only)
- Keep menu for quick archive

Selection styling: `ring-2 ring-blue-500` when `isSelected`

## UI Patterns (from codebase)

Following existing patterns:
- **MobileNav.tsx**: Slide-over animation with transform + transition
- **FileViewer.tsx**: Escape key, body scroll lock, backdrop click-to-close
- **StoryCard.tsx**: Click-outside detection, inline editing with Enter/Escape

## Verification

1. Click card → panel opens with story details
2. Click different card → panel updates
3. Click backdrop → panel closes
4. Press Escape → panel closes
5. Edit title/PR in panel → saves correctly
6. Archive from panel → story archives, panel closes
7. Drag card → still works, doesn't trigger selection
8. Panel scrolls when content overflows
9. Mobile: panel takes full width
