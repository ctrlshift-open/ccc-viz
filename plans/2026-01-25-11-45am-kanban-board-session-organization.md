# Kanban Board for Session Organization

## Overview

Add kanban board view to organize Claude Code sessions with 5 columns: archive, back-log, in-progress, discard, complete. Auto-create cards from sessions with ability to merge multiple sessions into one card.

## Data Model

```typescript
// app/types/kanban.ts
type KanbanStatus = "archive" | "back-log" | "in-progress" | "discard" | "complete";

interface KanbanCard {
  id: string;                  // UUID
  sessionIds: string[];        // Supports merged sessions
  project: string;             // Project name (encoded)
  status: KanbanStatus;
  title?: string;              // Custom title (optional)
  createdAt: string;
  updatedAt: string;
  order: number;               // Sort within column
}
```

## Design Choices

- **Scope**: Cross-project (single board shows all sessions from all projects)
- **Default status**:
  - Initial import: all existing sessions → `archive`
  - New sessions after initial import → `in-progress`
- **Drag-and-drop**: Native HTML5 DnD (no external library)
- **Search**: Filter cards by title, project, or branch text

## Title Generation

Auto-generated from session data, can be edited:
1. Extract last assistant message summary (first 50-80 chars)
2. If no assistant message, use git branch name
3. If neither, use session ID prefix + timestamp
4. User can edit title by clicking on card

Example titles:
- "Fix auth bug in login flow"
- "Add kanban board feature"
- "🌿 feature/user-profile"
- "Session abc123 - Jan 25"

## Persistence

Store in `~/.claude/cc-viz/kanban.json`:
- Matches existing filesystem pattern
- Works across browsers on same machine
- Survives browser cache clears

## Files to Create

| File | Purpose |
|------|---------|
| `app/types/kanban.ts` | TypeScript types |
| `app/utils/kanban.server.ts` | Read/write kanban.json, sync sessions |
| `app/routes/kanban.tsx` | Main kanban route |
| `app/routes/api.kanban.state.ts` | GET/POST full state |
| `app/routes/api.kanban.cards.$cardId.ts` | PATCH/DELETE card |
| `app/routes/api.kanban.merge.ts` | Merge two cards |
| `app/components/KanbanBoard.tsx` | Board container |
| `app/components/KanbanColumn.tsx` | Column component |
| `app/components/KanbanCard.tsx` | Card component |

## Implementation Steps

### Phase 1: Foundation
1. Create `app/types/kanban.ts` with types
2. Create `app/utils/kanban.server.ts`:
   - `getKanbanState()` - read from `~/.claude/cc-viz/kanban.json`
   - `saveKanbanState()` - write state
   - `syncSessionsToCards()` - detect new sessions:
     - If kanban.json doesn't exist (initial import): all sessions → `archive`
     - If kanban.json exists: new sessions → `in-progress`
   - `generateTitle()` - auto-generate title from session data

### Phase 2: API Routes
3. Create `api.kanban.state.ts` - GET state, POST update
4. Create `api.kanban.cards.$cardId.ts` - PATCH status/order
5. Create `api.kanban.merge.ts` - POST merge sourceId + targetId

### Phase 3: UI Components
6. Create `KanbanCard.tsx`:
   - Show: title, project badge, **git branch** (🌿 icon), timestamp, message count
   - **Editable title** - click to edit inline
   - Draggable with HTML5 DnD
   - Link to session detail
   - Badge for merged cards "[3 sessions]"

7. Create `KanbanColumn.tsx`:
   - Column header with status + count
   - Drop zone
   - Card list

8. Create `KanbanBoard.tsx`:
   - 5 columns layout (horizontal scroll mobile)
   - **Search input** - filter cards by title text
   - Project filter dropdown
   - Drag-and-drop coordination

### Phase 4: Main Route
9. Create `app/routes/kanban.tsx`:
   - Loader: fetch all projects, sessions, kanban state
   - Sync new sessions to cards
   - Action: handle card moves, status changes

### Phase 5: Merging
10. Implement merge UX:
    - Drag card onto another → merge confirmation
    - Combined sessionIds, delete source card

### Phase 6: Navigation
11. Add kanban link to existing navigation

## Card Display

```
┌────────────────────────────────┐
│ [project-name]  🌿 main        │
│ Fix auth bug in login flow...  │
│ ────────────────────────────── │
│ 145 msgs · Jan 25 14:30        │
│ [2 sessions]                   │
└────────────────────────────────┘
```

## Verification

1. `pnpm dev` and navigate to `/kanban`
2. First load: all existing sessions appear in `archive` column
3. Drag card between columns → status persists on reload
4. Drag card onto another → merge, check combined sessions
5. Click card → navigates to session detail
6. Click title → edit inline, save on blur
7. Type in search → filters cards by title
8. Create new session in Claude Code → appears in `in-progress` on refresh
