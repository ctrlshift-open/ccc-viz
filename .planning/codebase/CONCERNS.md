# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Silent error handling in JSON parsing:**
- Issue: Throughout the codebase, JSON parsing wrapped in try-catch blocks silently swallow errors. If a JSON line is malformed, the system returns nothing instead of logging/alerting.
- Files: `app/sessions.server.ts` (lines 27-31, 54-56, 91-110), `app/utils/kanban.server.ts` (lines 50-56, 80-82, 211), `app/utils/file-tail.server.ts` (line 168), `app/routes/api.sessions.costs.ts`
- Impact: Makes debugging difficult. Corrupt session files or unexpected data formats silently fail, leaving data missing from UI with no indication of the problem.
- Fix approach: Add debug logging or error counters before silent returns; consider a monitoring/alerting layer for recurring failures.

**Large component file coupling:**
- Issue: `app/routes/$project.sessions.$sessionId.tsx` is 2086 lines - a monolithic component mixing data loading, filtering, formatting, rendering, and event handling.
- Files: `app/routes/$project.sessions.$sessionId.tsx`
- Impact: Hard to test, maintain, and reuse components. Changes to one concern affect the whole file. Performance issues (re-renders) are harder to isolate.
- Fix approach: Extract into smaller components: MessageRenderer (rendering logic), FilterPanel (filtering UI), CostCalculator (cost aggregation), HeaderNav (header layout). Consider custom hooks for state management.

**Inefficient session preview collection:**
- Issue: `getSessionPreviews()` reads session files and scans up to 50-100 lines per file to extract previews. When listing 20+ sessions, this reads MBs of disk unnecessarily.
- Files: `app/sessions.server.ts` (lines 132-148), `app/routes/$project.sessions._index.tsx` (lines 100-150)
- Impact: Slow page loads on projects with many sessions. Each preview fetch reads partial file content sequentially.
- Fix approach: Cache previews in `.claude/cc-viz/previews.json` with mtime-based invalidation. Only re-scan files that changed since last cache update.

**Unsafe working directory detection:**
- Issue: Working directory inferred by scanning first 20-30 lines of a session file for `cwd` field. If not found, defaults to "/" or fails silently.
- Files: `app/routes/_index.tsx` (lines 52-75), `app/routes/$project.sessions.$sessionId.tsx` (lines 62-81)
- Impact: File operations in wrong directory when cwd not present. Security check in path-safety.server.ts may block legitimate reads if working directory is misdetected.
- Fix approach: Require explicit cwd in session metadata. Add validation that first line must contain cwd or fail loudly.

## Known Bugs

**File tailer memory leak under rapid reconnects:**
- Symptoms: Memory grows when browser repeatedly reconnects to SSE stream (network flaps, tab switch)
- Files: `app/utils/file-tail.server.ts` (lines 216-222, 249-260)
- Trigger: Open session view, rapidly toggle tab focus or refresh connection repeatedly
- Current state: Disposal timer (60s TTL) should clean up unused tailers, but if reconnect happens within TTL, new subscriber added while old one still pending cleanup
- Workaround: Manual server restart clears registry

**JSON parsing for PR detection can throw uncaught:**
- Symptoms: Route errors when gh PR output is not valid JSON
- Files: `app/utils/kanban.server.ts` (line 211)
- Trigger: `gh pr list` command succeeds but outputs non-JSON (e.g., warning text), or network error mid-response
- Current state: Wrapped in catch but doesn't validate `stdout` is JSON before parsing
- Workaround: None - just returns null on any error

**UTF-8 decoding errors in file-tail:**
- Symptoms: Malformed characters appear in session view, or stream stops updating
- Files: `app/utils/file-tail.server.ts` (line 150) - `.toString("utf8")` on buffer chunk without validation
- Trigger: Session file written by process with encoding issues; byte buffer split mid-multibyte UTF-8 sequence
- Current state: Leftover handling (line 159) only tracks text after split, not mid-byte sequences
- Workaround: Restart stream from last complete line

## Security Considerations

**Directory traversal protection is solid but assumes safe parameters:**
- Risk: If project/sessionId parameters bypassed, path validation could fail
- Files: `app/utils/path-safety.server.ts` (lines 27-54)
- Current mitigation: `isSafeSegment()` blocks `..`, `.`, path separators, null bytes. Relative path validation checks both directions (inside base dir check).
- Recommendations: Add logging when assertion fails; consider rate-limiting by IP if parameter tampering detected.

**No validation of session file content structure:**
- Risk: Malicious or corrupted session file could cause DOS via resource exhaustion (huge messages, nested objects)
- Files: `app/sessions.server.ts`, `app/routes/$project.sessions.$sessionId.tsx`
- Current mitigation: File size checked (1MB max for file read in action), but no per-entry size limit or nesting depth check
- Recommendations: Add schema validation for session entries; limit JSON parse depth; add timeouts to expensive operations.

**File path resolution from user input (readFile action):**
- Risk: Attacker supplies filepath that resolves outside project working directory despite checks
- Files: `app/routes/$project.sessions.$sessionId.tsx` (lines 84-90)
- Current mitigation: `relative()` comparison and prefix check for directory traversal
- Recommendations: Add test cases for edge cases (symlinks, case sensitivity on Windows). Consider using `fs.realpath()` to resolve symlinks before comparison.

## Performance Bottlenecks

**Kanban sync operation scans entire file system:**
- Problem: `syncSessionsToStories()` reads all projects, all session files, and all sessions to find new stories
- Files: `app/utils/kanban.server.ts` (lines 289-360+)
- Cause: Called from kanban.tsx action handler; no incremental tracking
- Impact: Slow with 50+ projects and 1000+ sessions; blocks UI during sync
- Improvement path: Store last sync timestamp; only scan files modified after that. Use filesystem watcher instead of full scan on each action.

**Session list filtering done client-side after loading all previews:**
- Problem: Preview API loads all sessions, client filters after fetching previews
- Files: `app/routes/$project.sessions._index.tsx` (lines 100+), component state uses loaded previews to filter
- Cause: No server-side filtering support
- Impact: With 100+ sessions per project, fetches unnecessary data, UI freezes while filtering
- Improvement path: Add query params to preview API for filtering (branch, date range). Server-side pre-filter before building response.

**File-tail reads up to 8MB per poll cycle:**
- Problem: Single read can buffer 8MB into memory
- Files: `app/utils/file-tail.server.ts` (line 142)
- Cause: No backpressure or chunking to subscribers
- Impact: Memory spike if session file grows rapidly; slower subscribers lag behind
- Improvement path: Implement backpressure - if broadcast is slow, delay next read. Add subscriber-specific cursors to avoid replay.

**Project directory stat called for each file:**
- Problem: In `getProjects()`, stat() called once per .jsonl file to get mtime
- Files: `app/projects.server.ts` (lines 31-56)
- Cause: Inefficient file listing pattern
- Impact: 50 files = 50 syscalls per load
- Improvement path: Use `fs.readdir({ withFileTypes: true })` with `dirent.mtime` if available; cache project list with TTL.

## Fragile Areas

**Session message rendering with dynamic types:**
- Files: `app/routes/$project.sessions.$sessionId.tsx` (lines 1400-1900+)
- Why fragile: Assumes message structure (`parsed.type`, `parsed.message`, nested content arrays). Any new message type or renamed field breaks rendering silently.
- Safe modification: Add strict type guards for message types; validate structure before rendering. Use discriminated unions for message type checking.
- Test coverage: No unit tests for message rendering; only manual testing

**File tailer watcher state machine:**
- Files: `app/utils/file-tail.server.ts` (entire FileTailer class)
- Why fragile: Complex state: `reading`, `pendingRead`, `disposed`, `disposeTimer`, watcher lifecycle. Race conditions between readNew() cycles, subscription changes, and disposal.
- Safe modification: Add state enum to make transitions explicit. Add invariant checks (e.g., reading=false implies no pending promises). Add integration test for rapid subscribe/unsubscribe.
- Test coverage: No tests for subscription lifecycle or disposal under load

**Kanban state persistence across multiple endpoints:**
- Files: `app/routes/kanban.tsx` (action handler), `app/utils/kanban.server.ts` (saveKanbanState), both write to kanban.json
- Why fragile: Multiple routes can call saveKanbanState simultaneously. No locking mechanism - concurrent writes can corrupt JSON or lose updates.
- Safe modification: Implement file-based locking using flock or temp file atomic swap. Or switch to database with transactions.
- Test coverage: No concurrent write tests

## Scaling Limits

**File-tail registry unbounded memory:**
- Current capacity: Limited by number of unique (project, sessionId) pairs with active subscribers
- Limit: With 60s TTL, if users have 100 sessions open simultaneously, registry holds 100 FileTailer instances = several MB
- Scaling path: Implement LRU eviction for tailers with no subscribers; add memory limit + emergency flush. Monitor registry size metrics.

**Kanban state file growth unbounded:**
- Current capacity: kanban.json and kanban-archive.json grow with each new story (no cleanup/archival of old archived stories)
- Limit: After running for months with 1000+ stories, files exceed reasonable size (100MB+ possible)
- Scaling path: Implement file rotation - move very old archived stories to time-stamped archive files. Add cleanup policy (delete archived > 1 year old).

**Session file disk usage:**
- Current capacity: No cleanup of old session files; they accumulate in ~/.claude/projects/*/
- Limit: With heavy usage (50+ sessions per day), disk fills quickly; no rotation/cleanup
- Scaling path: Implement session file expiration policy (e.g., keep last 30 days, archive older). Add disk usage monitoring and admin cleanup UI.

## Dependencies at Risk

**No type checking for ccusage library:**
- Risk: `app/utils/file-tail.server.ts` (line 104) dynamically imports `ccusage/pricing-fetcher` and `ccusage/data-loader`. If ccusage package version changes API, no error until runtime.
- Impact: File tailer silently loses cost calculation ability if import fails
- Migration plan: Add type definitions or move ccusage to peerDependency with clear version constraints. Test cost calculation on CI.

**External command execution (gh CLI):**
- Risk: `app/utils/kanban.server.ts` (line 206) runs `gh pr list` via execAsync. Depends on gh CLI being installed and github.com accessible.
- Impact: PR detection fails silently in environments without gh; kanban features degrade
- Migration plan: Add fallback to GitHub GraphQL API using token. Fall back gracefully if gh not available. Test in disconnected environments.

## Missing Critical Features

**No conflict resolution for concurrent kanban edits:**
- Problem: If two browser windows edit same story simultaneously, last write wins (lost update)
- Blocks: Multi-user collaboration on kanban board
- Scope: Would require adding versioning/CRDT or optimistic locking to KanbanState

**No pagination in session lists:**
- Problem: Projects with 500+ sessions load all previews at once (slow, memory intensive)
- Blocks: Smooth browsing of projects with long session histories
- Scope: Add cursor-based pagination to preview API; implement infinite scroll UI

**No retry logic for failed file operations:**
- Problem: Single transient IO error (file locked, permission) fails entire request
- Blocks: Robustness in environments with unstable filesystems or concurrent access
- Scope: Add exponential backoff retry wrapper around fs operations

## Test Coverage Gaps

**File tailer subscription lifecycle:**
- What's not tested: Race conditions between subscribe/unsubscribe, file watcher events, and dispose timer
- Files: `app/utils/file-tail.server.ts`
- Risk: Memory leaks or crashes under rapid connection cycling
- Priority: High

**Kanban state mutations:**
- What's not tested: Concurrent updates to kanban.json; validation of state transitions (e.g., can status move from "archive" to "in-progress"?)
- Files: `app/utils/kanban.server.ts` (updateStoryStatus, updateStoryTitle, etc.)
- Risk: Corrupted state or invalid transitions silently allowed
- Priority: High

**Session message rendering with malformed data:**
- What's not tested: Rendering with missing fields, unexpected types, deeply nested arrays
- Files: `app/routes/$project.sessions.$sessionId.tsx` (MessageRenderer component)
- Risk: UI crashes or hangs on edge case data
- Priority: Medium

**Error boundaries and error states:**
- What's not tested: Routes with missing projects/sessions; loader errors; network failures
- Files: All route loaders, actions
- Risk: Unhandled errors crash app or show blank screen
- Priority: Medium

---

*Concerns audit: 2026-01-26*
