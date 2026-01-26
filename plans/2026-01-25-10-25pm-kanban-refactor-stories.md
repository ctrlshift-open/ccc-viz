# Kanban Refactor: Stories per Branch

## Summary

Change kanban from 1 card per session to 1 story per project+branch. Stories contain multiple sessions as hyperlinks.

## New Data Model

```typescript
type StorySession = {
  id: string;           // Session ID
  name: string;         // AI-generated name
  timestamp: string;    // Creation time
  link: string;         // URL to session browser
};

type KanbanStory = {
  id: string;
  title: string;        // Default=branch, editable
  project: string;
  branch: string | null; // null = "No Branch" story
  prLink: string | null; // Auto-detect + manual override
  status: KanbanStatus;
  order: number;
  sessions: StorySession[];
  createdAt: string;
  updatedAt: string;
};

type KanbanState = {
  version: 2;           // Bump to clear old data
  stories: KanbanStory[];
  lastSyncedAt: string;
};
```

## Key Decisions

| Aspect | Decision |
|--------|----------|
| No branch sessions | One "No Branch" story per project |
| PR link | Auto-detect via `gh pr list --head <branch>`, manual override |
| Story status | Independent (drag between columns) |
| Story title | Editable, defaults to branch name |
| Sync timing | Manual button only (not on page load) |
| Archive | Entire story with all sessions |
| Merge | Removed (auto-group by branch) |

## Files to Modify

### 1. `app/types/kanban.ts` - Rewrite
- Replace `KanbanCard` with `KanbanStory`
- Add `StorySession` type
- Bump version to 2
- Remove merge-related types

### 2. `app/utils/kanban.server.ts` - Major refactor
- Add version check (if !== 2, return empty state)
- Remove `mergeCards()`, `createCard()`
- Replace `syncSessionsToCards()` with `syncSessionsToStories()`:
  - Build lookup: `project:branch` -> story
  - For each new session: find/create story, generate AI name
  - Sort sessions by timestamp (newest first)
- Add `detectPRLink()` using `gh pr list --head <branch>`
- Add `generateSessionName()` for AI naming

### 3. `app/routes/kanban.tsx` - Update actions
- Loader: NO auto-sync, just read state
- Remove `merge` intent
- Add `sync` intent for manual sync button
- Add `updatePRLink` intent
- Update other intents for storyId

### 4. `app/components/KanbanCard.tsx` → `StoryCard.tsx` - Rewrite
New layout:
```
┌────────────────────────────────┐
│ [project-name]     🔗 PR #123  │
│ ─────────────────────────────  │
│ feature/add-login [edit]       │
│ ─────────────────────────────  │
│ Sessions (3):                  │
│ • Fix auth validation (Jan 25) │
│ • Add form component (Jan 24)  │
│ • Initial setup (Jan 23)       │
│ ─────────────────────────────  │
│ Created: Jan 23, 2026          │
└────────────────────────────────┘
```

### 5. `app/components/KanbanBoard.tsx` - Update
- Add sync button with loading state
- Remove merge confirmation modal
- Update filtering for stories

### 6. `app/components/KanbanColumn.tsx` - Update
- Props: `cards` → `stories`
- Remove merge drop handling

### 7. `app/routes/api.kanban.stories.$storyId.ts` - Rename from cards
- PATCH: title, status, order, prLink

### 8. `app/routes/api.kanban.sync.ts` - New
- POST: triggers `syncSessionsToStories()`

### 9. DELETE `app/routes/api.kanban.merge.ts`

## Sync Algorithm

```
1. Load current state
2. Build lookup: "project:branch" -> story
3. Build set of existing session IDs
4. For each session on disk:
   - Skip if already tracked
   - Skip if haiku session
   - Find story by project+branch (or "NO_BRANCH")
   - If no story: create one, auto-detect PR link
   - Generate AI name for session
   - Add session to story
5. Sort sessions within each story (newest first)
6. Save state
```

## PR Detection

```bash
gh pr list --head "<branch>" --json url --limit 1
```
Returns PR URL or null on failure.

## Data Clearing

Version bump (1 → 2) automatically clears old data:
- `getKanbanState()` checks version
- If version !== 2, returns empty state
- First sync creates all stories fresh

## Verification

1. First load: empty board (data cleared)
2. Click Sync: sessions grouped by project+branch
3. "No Branch" story for branchless sessions
4. PR links auto-detected
5. Session names AI-generated
6. Drag stories between columns
7. Edit story title
8. Archive story archives all sessions
9. Session links work
10. PR link clickable/editable
11. No merge UI present
