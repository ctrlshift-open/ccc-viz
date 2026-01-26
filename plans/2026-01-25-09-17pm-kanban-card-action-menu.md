# Kanban Card Action Menu with Archive

## Context
- Archive status exists in type system (`KanbanStatus` includes "archive")
- Archive storage works (separate `kanban-archive.json` file)
- `updateCardStatus()` utility already supports any status
- Cards currently have: title editing, regenerate button, drag-and-drop
- No UI to archive cards - need action menu

## Plan

### 1. Add Action Menu to KanbanCard
**File:** `app/components/KanbanCard.tsx`

Add three-dot menu button in card header:
- Position: top-right corner of card
- Click opens dropdown menu
- Menu items: Archive (first), more actions can be added later
- Click outside closes menu

### 2. Add onArchive Callback
**File:** `app/components/KanbanCard.tsx`

Props interface update:
```tsx
onArchive?: (cardId: string) => void;
```

### 3. Wire Up Archive Handler in Route
**File:** `app/routes/kanban.tsx`

Add handler + form submission:
```tsx
const handleArchive = (cardId: string) => {
  fetcher.submit(
    { intent: "archive", cardId },
    { method: "post" }
  );
};
```

### 4. Add Archive Action to Route Action
**File:** `app/routes/kanban.tsx`

Add intent handler:
```tsx
if (intent === "archive") {
  const updatedState = updateCardStatus(state, cardId, "archive");
  await saveKanbanState(updatedState);
  return { success: true };
}
```

## Files to Modify
1. `app/components/KanbanCard.tsx` - add menu UI + onArchive prop
2. `app/routes/kanban.tsx` - add handler + action intent

## Verification
1. `pnpm dev`
2. Open kanban board
3. Click three-dot menu on any card
4. Click "Archive"
5. Card should disappear from board (archived cards filtered out)
6. Verify card exists in `~/.claude/cc-viz/kanban-archive.json`
