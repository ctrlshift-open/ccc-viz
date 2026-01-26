# Limit Kanban Session Sync to Recent Sessions

## Problem
`syncSessionsToStories()` scans ALL sessions from ALL projects with no limit. With 1000s of sessions, it hangs because each new session triggers:
- File read (`isHaikuSession`)
- AI call (`generateSessionName` - Claude haiku)
- GitHub CLI call (`detectPRLink`)

## Solution
Limit `getAllSessions()` to return only the N most recent sessions (default: 20).

## Changes

### `app/utils/kanban.server.ts`

1. **Modify `getAllSessions(limit?: number)`** (line 291)
   - Add optional `limit` param (default 20)
   - Sort all sessions by timestamp descending BEFORE returning
   - Slice to limit
   - Return only the most recent sessions

```typescript
async function getAllSessions(limit: number = 20): Promise<...> {
  // ... existing scan logic ...

  // Sort by timestamp descending (most recent first)
  sessions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Return only most recent
  return sessions.slice(0, limit);
}
```

2. **Update `syncSessionsToStories()`** call (line 341)
   - Pass limit to getAllSessions
   - Consider adding limit param to sync function for future configurability

## Verification
1. Start dev server: `pnpm bg:start`
2. Open kanban board: http://localhost:5174/kanban
3. Click "Sync Sessions"
4. Should complete quickly (few seconds, not minutes)
5. Should show only recent sessions synced

## Files to Modify
- `app/utils/kanban.server.ts` (lines 291-323, 341)
