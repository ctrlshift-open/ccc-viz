# Fix Kanban Page Timeout - Non-Blocking Title Generation

**Date**: 2026-01-25
**Issue**: Kanban page times out after 60s because `syncSessionsToCards()` blocks the loader while generating AI titles for thousands of sessions sequentially.

## Problem Summary

The kanban route loader calls `syncSessionsToCards()` which:
1. Scans all 3,047+ session files to detect new sessions
2. For each new session (1,773+ pending):
   - Reads entire file via `isHaikuSession()` to check model
   - Reads entire file AGAIN via `getSessionPreview()` to get git branch
   - **2 full file reads per session = 3,546+ I/O operations**
3. AI title generation is **already disabled** (`useAI = false`) but still times out
4. **Root cause**: Sequential file I/O for 1,773 sessions takes 60+ seconds

This makes the kanban page completely inaccessible.

## Solution: Optimize File I/O + Optional Background Title Generation

### Core Strategy

**Phase 1 (Critical)**: Fix the immediate timeout by optimizing file I/O
1. Combine duplicate file reads into single `getSessionMetadata()` call
2. Process files in parallel batches instead of sequentially
3. **Result**: Sync completes in ~2.7 seconds instead of 106 seconds

**Phase 2 & 3 (Optional)**: Enable background AI title generation
1. Add API endpoints for async title generation
2. Frontend polls for progress and shows banner
3. **Benefit**: Cards get AI titles without manual `pnpm migrate:titles`

**Note**: Phase 1 alone fixes the timeout. Phases 2-3 are enhancements.

### Implementation Plan

#### Phase 1: Optimize File I/O (Immediate Fix)

**File**: `app/utils/kanban.server.ts`

1. **Combine file reads** - Create new function `getSessionMetadata()`:
   ```typescript
   // Replaces isHaikuSession() + getSessionPreview() - single file read
   async function getSessionMetadata(project: string, sessionId: string) {
     const { file } = resolveSessionFile(project, sessionId);
     const content = await fs.readFile(file, "utf8");
     const lines = content.split(/\r?\n/).filter((l) => l.length > 0);

     let isHaiku = false;
     let gitBranch: string | undefined;
     let timestamp = "";

     // Parse first 50 lines only
     for (let i = 0; i < Math.min(50, lines.length); i++) {
       const parsed = JSON.parse(lines[i]);

       // Check for haiku model
       if (parsed.type === "assistant" && parsed.message?.model?.toLowerCase().includes("haiku")) {
         isHaiku = true;
       }

       // Extract git branch and timestamp (same logic as getSessionPreview)
       if (parsed.gitBranch) gitBranch = parsed.gitBranch;
       if (!timestamp && parsed.timestamp) timestamp = parsed.timestamp;
     }

     return { isHaiku, gitBranch, timestamp };
   }
   ```

2. **Parallelize processing** - Use batched Promise.all():
   ```typescript
   const BATCH_SIZE = 20; // Process 20 files at a time
   for (let i = 0; i < newSessions.length; i += BATCH_SIZE) {
     const batch = newSessions.slice(i, i + BATCH_SIZE);
     const metadataResults = await Promise.all(
       batch.map(s => getSessionMetadata(s.project, s.sessionId))
     );

     // Create cards for non-haiku sessions
     batch.forEach((session, idx) => {
       if (!metadataResults[idx].isHaiku) {
         newCards.push({
           // ... use metadataResults[idx].gitBranch and .timestamp
         });
       }
     });
   }
   ```

3. **Expected performance**:
   - Before: 1,773 sessions × 2 reads × ~30ms = **106 seconds**
   - After: 1,773 sessions ÷ 20 batches × 1 read × ~30ms = **~2.7 seconds**
   - **40x improvement**

**File**: `app/routes/kanban.tsx`

4. **No changes needed to loader** - sync will now be fast enough

#### Phase 2: Add Background Title Generation API

**File**: `app/routes/api.kanban.generate-titles.ts` (new file)

Create POST endpoint for batch title generation:

```typescript
export async function action({ request }: Route.ActionArgs) {
  const { cardIds } = await request.json();

  // Spawn async title generation (don't await)
  generateCardTitlesInBackground(cardIds);

  return { status: "started", total: cardIds.length };
}
```

**File**: `app/routes/api.kanban.title-status.ts` (new file)

Create GET endpoint for checking progress:

```typescript
export async function loader({}: Route.LoaderArgs) {
  const state = await getKanbanState();
  const pending = state.cards.filter(c => !c.version).length;
  const total = state.cards.length;

  return {
    pending,
    total,
    complete: total - pending,
    percentage: Math.round((total - pending) / total * 100)
  };
}
```

**File**: `app/utils/kanban.server.ts`

Add background generation function:

```typescript
export async function generateCardTitlesInBackground(cardIds?: string[]): Promise<void> {
  const state = await getKanbanState();
  let cardsToProcess = cardIds
    ? state.cards.filter(c => cardIds.includes(c.id))
    : state.cards.filter(c => !c.version);

  for (const card of cardsToProcess) {
    try {
      const { title } = await generateTitle(card.project, card.sessionIds[0], true);

      // Update and save after each card (resume-safe)
      const currentState = await getKanbanState();
      const cardIndex = currentState.cards.findIndex(c => c.id === card.id);
      if (cardIndex !== -1) {
        currentState.cards[cardIndex] = {
          ...currentState.cards[cardIndex],
          title,
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await saveKanbanState(currentState);
      }
    } catch (error) {
      console.error(`Failed to generate title for card ${card.id}:`, error);
    }
  }
}
```

#### Phase 3: Client-Side Polling for Updates

**File**: `app/routes/kanban.tsx`

Add polling mechanism on component mount:

```typescript
export default function Kanban() {
  const { state, projects } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<{ pending: number; total: number } | null>(null);

  // On mount: check if titles need generation and start background job
  useEffect(() => {
    const cardsNeedingTitles = state.cards.filter(c => !c.version);

    if (cardsNeedingTitles.length > 0 && !isSyncing) {
      setIsSyncing(true);

      // Start background generation
      fetch('/api/kanban/generate-titles', {
        method: 'POST',
        body: JSON.stringify({ cardIds: cardsNeedingTitles.map(c => c.id) })
      });

      // Poll for progress every 30 seconds
      const interval = setInterval(async () => {
        const res = await fetch('/api/kanban/title-status');
        const data = await res.json();
        setProgress(data);

        if (data.pending === 0) {
          clearInterval(interval);
          setIsSyncing(false);
          revalidator.revalidate();
        } else {
          // Revalidate every 30s to show new titles
          revalidator.revalidate();
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [state.cards, isSyncing, revalidator]);

  // Show progress banner if syncing
  return (
    <main>
      {isSyncing && progress && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
          Generating AI titles in background: {progress.complete}/{progress.total} ({progress.percentage}%)
        </div>
      )}
      {/* existing kanban board */}
    </main>
  );
}
```

#### Phase 4: Optional - Server-Sent Events (Future Enhancement)

Instead of polling, could use SSE for real-time updates:

**File**: `app/routes/api.kanban.title-stream.ts` (new file)

```typescript
export async function loader({}: Route.LoaderArgs) {
  const stream = new ReadableStream({
    async start(controller) {
      // Stream progress updates as titles generate
      // Send { type: 'progress', pending: X, total: Y }
      // Send { type: 'complete', cardId: X, title: Y }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

## Critical Files

**Modified**:
- `app/utils/kanban.server.ts` - Lines 354-375:
  - Add `getSessionMetadata()` function (combines isHaikuSession + getSessionPreview)
  - Refactor `syncSessionsToCards()` to use batched parallel processing
  - Add `generateCardTitlesInBackground()` function
- `app/routes/kanban.tsx` - Lines 94-144:
  - Add polling logic with useEffect
  - Add progress banner UI

**New**:
- `app/routes/api.kanban.generate-titles.ts` - Start background title generation job
- `app/routes/api.kanban.title-status.ts` - Return progress status for polling

## Testing & Verification

### 1. Fast Sync Test
```bash
# Measure sync time without AI
pnpm dev
# Navigate to http://localhost:5174/kanban
# Page should load within 5 seconds (not timeout)
```

### 2. Background Generation Test
```bash
# Check server logs for background processing
# Should see: "[kanban] Background title generation: X/Y complete"
```

### 3. Progress Updates Test
- Load kanban page
- Verify progress banner appears if titles are pending
- Wait 30 seconds, check if new titles appear
- Verify banner disappears when complete

### 4. Resume Safety Test
```bash
# Start background generation
# Kill server mid-process
# Restart server
# Verify: already-generated titles are preserved
# Verify: remaining titles continue generating
```

## Trade-offs Considered

### Approach 1: Polling (Recommended)
**Pros**: Simple, works with existing infrastructure, no new dependencies
**Cons**: 30s delay in updates, unnecessary requests when idle

### Approach 2: Server-Sent Events
**Pros**: Real-time updates, efficient
**Cons**: More complex, requires maintaining open connections

### Approach 3: Background Worker Thread
**Pros**: True async, doesn't block event loop
**Cons**: Requires worker thread setup, complicates deployment

**Decision**: Start with Approach 1 (polling), consider Approach 2 later if needed.

## Success Criteria

1. ✅ Kanban page loads in < 5 seconds (no timeout)
2. ✅ All cards display with titles (fallback or AI)
3. ✅ Background title generation completes without blocking UI
4. ✅ Progress indicator shows generation status
5. ✅ Process is resume-safe (survives server restarts)

## Rollback Plan

If issues arise:
1. Revert loader changes - return to original `syncSessionsToCards()`
2. Disable background generation by commenting out API routes
3. Users can manually run `pnpm migrate:titles` as before
