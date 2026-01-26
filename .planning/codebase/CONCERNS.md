# Codebase Concerns

**Analysis Date:** 2026-01-25

## Tech Debt

### Large Monolithic Route Components
- **Issue:** `app/routes/$project.sessions.$sessionId.tsx` is 2086 lines with mixed concerns (UI, data loading, file I/O, cost calculations, streaming). This makes it difficult to test, refactor, and maintain. Contains multiple loader, action, and component logic intertwined.
- **Files:** `app/routes/$project.sessions.$sessionId.tsx`
- **Impact:** Refactoring any single feature requires understanding the entire file. Bug fixes risk unintended side effects. Component testing is impractical at current scale.
- **Fix approach:** Extract loaders into separate server files (.server.ts), break component into smaller sub-components. Consider splitting data loading and UI rendering logic.

### Type Casting with `any`
- **Issue:** Widespread use of `as any` casts throughout the codebase, particularly in session parsing and message classification logic. Examples: `as any` in `$project.sessions.$sessionId.tsx` lines 107, 239, 340, 353, 376, 383, etc.
- **Files:** `app/routes/$project.sessions.$sessionId.tsx`, `app/routes/api.sessions.$project.$sessionId.totals.ts`, `app/routes/api.sessions.$project.active-status.ts`, `app/utils/file-tail.server.ts`
- **Impact:** Type safety bypassed, missed errors at compile time, difficult debugging. Potential runtime errors from unexpected data structures.
- **Fix approach:** Create discriminated unions for message types, define strict interfaces for all JSON-parsed data structures. Replace casting with proper type guards and validation.

### Silent Error Swallowing
- **Issue:** Multiple `catch` blocks with empty handlers or generic logging (`catch {}`, `catch { /* ignore subscriber errors */ }`). Examples in `app/utils/file-tail.server.ts` lines 176, 203, 230, 236, 237.
- **Files:** `app/utils/file-tail.server.ts`, `app/routes/$project.sessions.$sessionId.tsx`, `app/utils/kanban.server.ts`, `app/routes/api.sessions.$project.$sessionId.stream.ts`
- **Impact:** Silent failures make debugging difficult. Resource leaks when subscriptions fail to clean up. File handles left open, memory not released.
- **Fix approach:** Log error details before swallowing. Implement structured error tracking. For critical resources (file handles, subscriptions), fail loudly if cleanup fails.

### Temporal File-Based Coupling
- **Issue:** Session name generation creates temp files in `tmpdir()` and relies on cleanup in `finally` block. Path safety checks use string manipulation instead of proper path validation. `app/utils/kanban.server.ts` line 151 uses shell command injection risk.
- **Files:** `app/utils/kanban.server.ts` lines 151, 181-182, `app/utils/path-safety.server.ts`
- **Impact:** Temp files may accumulate if process crashes. Race conditions if multiple instances run simultaneously. Potential path traversal if path manipulation is incorrect.
- **Fix approach:** Use temp file library with guaranteed cleanup. Validate all paths with OS-level APIs (not string parsing). Escape all shell arguments properly.

## Known Bugs

### File Handle Leak Risk in FileTailer
- **Symptoms:** Long-running streams consume file handles. When browser tab closes without proper unsubscription, handles may not release immediately.
- **Files:** `app/utils/file-tail.server.ts`
- **Trigger:** Open session detail view, navigate away without waiting for unsubscribe cleanup. Under high load with many concurrent streams.
- **Workaround:** Browser refresh forces cleanup. Can manually dispose via tailer registry.
- **Root cause:** TTL-based cleanup (60s) may not trigger if tailer held in memory. File watcher may not detect all rename/rotation events on certain filesystems.

### JSON Parsing Errors Unhandled
- **Symptoms:** Malformed JSONL lines silently skipped. User sees gaps in message count without explanation.
- **Files:** `app/routes/$project.sessions.$sessionId.tsx` lines 139, 209-213, `app/utils/file-tail.server.ts` lines 168-170
- **Trigger:** Corrupted session file, partial writes during concurrent access, file rotation mid-line
- **Workaround:** Restart app to re-read file
- **Root cause:** JSONL format is fragile. No validation that lines are properly closed before parsing. No recovery mechanism for partial data.

### Race Condition in Kanban State Sync
- **Symptoms:** Multiple sync operations can overwrite each other. If two requests call `syncWithProjects()` simultaneously, later writes may lose earlier updates.
- **Files:** `app/utils/kanban.server.ts` lines 223-257, 263-286
- **Trigger:** Rapid API calls from concurrent browser tabs/users, or manual sync while background import in progress
- **Workaround:** Refresh page to load latest state
- **Root cause:** File I/O operations are not atomic. No locking mechanism prevents concurrent writes.

## Security Considerations

### Path Traversal in File Reading
- **Risk:** Despite path safety checks, complex path manipulation in `$project.sessions.$sessionId.tsx` action handler (lines 84-90) has multiple validation points that could be bypassed if any check is incorrect.
- **Files:** `app/routes/$project.sessions.$sessionId.tsx` lines 84-90, `app/utils/path-safety.server.ts`
- **Current mitigation:** Path validation using `relative()` and string prefix check. 256-char segment limit. Null byte check.
- **Recommendations:** Use OS symlink resolution (`fs.realpath`) to verify final target is within allowed directory. Consider allowlist of readable paths instead of blocklist approach. Add integration tests with symlink attacks.

### Shell Injection in PR Detection
- **Risk:** `gh` command in kanban.server.ts line 207 uses template literals with branch name. If branch name contains backticks or command separators, arbitrary commands could execute.
- **Files:** `app/utils/kanban.server.ts` lines 206-208
- **Current mitigation:** Branch name from filesystem (git output), not user input. `gh` CLI may reject malicious input.
- **Recommendations:** Use `execAsync` with explicit `args` parameter (not shell=true). Shell-escape branch name if not using args array. Add validation that branch names match git identifier rules.

### AI Model Prompt Injection
- **Risk:** User message content fed directly to Claude CLI for session name generation without sanitization (`app/utils/kanban.server.ts` lines 146-152).
- **Files:** `app/utils/kanban.server.ts` lines 145-172
- **Current mitigation:** Truncation to 500 chars per message. Timeout of 30s. Output validation (length <60, no newlines).
- **Recommendations:** Add explicit escaping of special characters before passing to CLI. Validate output matches expected format (alphanumeric, hyphens, spaces only). Consider using API instead of CLI to avoid shell injection entirely.

### Exposed Session File Path in Stream Handlers
- **Risk:** File tail streaming exposes file paths in error messages. Errors propagated to client contain full filesystem paths.
- **Files:** `app/routes/api.sessions.$project.$sessionId.stream.ts`, `app/utils/file-tail.server.ts`
- **Current mitigation:** Error details not explicitly leaked in stream protocol
- **Recommendations:** Never include full paths in client-facing error messages. Use session IDs only.

## Performance Bottlenecks

### Entire File Parsing for Category Collection
- **Problem:** `$project.sessions.$sessionId.tsx` loader iterates entire file to collect message categories (lines 270-277). On 100k+ line sessions, this is O(n) scan.
- **Files:** `app/routes/$project.sessions.$sessionId.tsx` lines 218-290
- **Cause:** Categories needed upfront for filter UI, but only current page loaded. No incremental category discovery.
- **Improvement path:** Cache category map on disk alongside session file. Update incrementally as new lines appended. Precompute statistics server-side.

### Synchronous File Stat in Loop
- **Problem:** `getProjects()` in `app/projects.server.ts` calls `stat()` for each session file sequentially, not in parallel.
- **Files:** `app/utils/kanban.server.ts` lines 296-310
- **Cause:** Sequential I/O in `getAllSessions()` loop. Could be `Promise.all()`.
- **Improvement path:** Batch file operations using `Promise.all()` for directories with many files.

### FileTailer Memory Accumulation
- **Problem:** `leftover` buffer in FileTailer can grow if file contains very long lines without newlines (e.g., binary data, base64). No bounds checking.
- **Files:** `app/utils/file-tail.server.ts` lines 22, 159, 173-174
- **Cause:** Partial lines accumulated in string without size limit.
- **Improvement path:** Implement max line length (e.g., 1MB). Truncate or reject excessively long lines.

### Session Preview Fetching Not Batched
- **Problem:** `$project.sessions._index.tsx` client-side fetches session preview and costs one-by-one in effects. If 50 sessions, 50+ HTTP requests.
- **Files:** `app/routes/$project.sessions._index.tsx` lines 90-150
- **Cause:** No batch fetch endpoint. Individual fetchers per session.
- **Improvement path:** Create `/api/sessions/:project/batch-preview` endpoint accepting multiple session IDs, return all previews in one request.

## Fragile Areas

### Session Message Classification Logic
- **Files:** `app/routes/$project.sessions.$sessionId.tsx` lines 239-277, `app/routes/api.sessions.$project.$sessionId.totals.ts` lines 36-120
- **Why fragile:** Complex nested logic for detecting message types from nested arrays. Uses duck-typing (checking `.type` property) instead of discriminated unions. Duplicated across multiple files.
- **Safe modification:** Create shared `classifyMessage()` function in utilities. Write unit tests covering all edge cases. Use type guards instead of casting.
- **Test coverage:** No tests for classification logic. Edge cases like empty content arrays, missing type fields untested.

### Kanban Story Ordering Logic
- **Files:** `app/utils/kanban.server.ts` lines 443-496
- **Why fragile:** Complex reordering algorithm when moving stories between columns. Multiple index manipulations with potential off-by-one errors.
- **Safe modification:** Add comprehensive unit tests for all move scenarios (within column, between columns, edge positions). Use immutable update patterns.
- **Test coverage:** No tests. Bugs could silently corrupt story order.

### Path Safety Validation
- **Files:** `app/utils/path-safety.server.ts`
- **Why fragile:** String-based path validation prone to edge cases. Windows path handling not tested (code uses forward slash assumptions).
- **Safe modification:** Add tests for symlinks, relative paths with ../, unicode in paths, Windows UNC paths. Consider using `path.resolve()` + `fs.realpath()` comparison instead.
- **Test coverage:** Only basic validation tested in `routes-no-node-imports.test.ts`. No path traversal attack tests.

## Scaling Limits

### Kanban State File Size
- **Current capacity:** Likely 10k-50k stories before JSON parsing becomes slow
- **Limit:** File size approaches 10MB, startup and read/write operations stall. JSON parse in Node becomes noticeably slow.
- **Scaling path:** Split archive into multiple files by year. Implement lazy loading (load only recent stories initially). Use JSON streaming parser.

### FileTailer Registry
- **Current capacity:** Default 60s TTL means 1 active tailer per unique session, cleared on last unsubscribe
- **Limit:** High concurrency (100+ simultaneous viewers) could exhaust file handles. No explicit limit on registry size.
- **Scaling path:** Add configurable registry size limit. Implement LRU eviction. Monitor handle count.

### Session Detail View Page Size
- **Current capacity:** Default 25 lines per page, max 100 lines
- **Limit:** 100-line page loads fast, but pagination UI becomes unwieldy with 1000+ pages
- **Scaling path:** Implement cursor-based infinite scroll instead. Cache parsed lines in memory.

## Dependencies at Risk

### `ccusage` Library for Cost Calculation
- **Risk:** Cost data hardcoded in dependency. If model pricing changes, must wait for package update. No offline pricing updates.
- **Impact:** Displayed costs become stale if pricing changes before update released.
- **Migration plan:** Consider fetching pricing from official source or storing locally with manual updates.

### Nanoid for ID Generation
- **Risk:** No risk detected. Standard library, well-maintained, collision risk negligible.
- **Impact:** N/A
- **Migration plan:** N/A

## Missing Critical Features

### Concurrent Edit Conflict Resolution
- **Problem:** If two users modify kanban state simultaneously (drag story, change title), last write wins. No merge strategy.
- **Blocks:** Multi-user collaboration, CI/CD integration to auto-update kanban

### JSONL Corruption Recovery
- **Problem:** No mechanism to repair or recover from truncated/corrupted session files. Files are not validated on startup.
- **Blocks:** Reliable file handling after crashes or power loss

### Audit Trail for Kanban Changes
- **Problem:** No history of who moved what story when. Changes overwrite previous state.
- **Blocks:** Understanding edit history, reverting accidental changes

## Test Coverage Gaps

### Core Kanban Logic
- **What's not tested:** Story reordering across columns, archive/unarchive logic, PR link detection, session name generation
- **Files:** `app/utils/kanban.server.ts` (538 lines, ~0% test coverage)
- **Risk:** Silent order corruption, data loss on column move, broken PR detection
- **Priority:** High - core feature logic

### Path Safety Validation
- **What's not tested:** Symlink resolution, Windows paths, unicode filenames, attempted path traversal attacks
- **Files:** `app/utils/path-safety.server.ts` (55 lines, ~20% coverage via routes-no-node-imports test)
- **Risk:** Security bypass, file access outside project directory
- **Priority:** High - security-critical

### Message Classification
- **What's not tested:** Edge cases in message type detection (empty arrays, missing fields, nested content)
- **Files:** `app/routes/$project.sessions.$sessionId.tsx` lines 239-277
- **Risk:** Incorrect message filtering, missing messages in UI
- **Priority:** Medium - affects UI accuracy

### FileTailer Cleanup
- **What's not tested:** Subscription cleanup, TTL disposal, file rotation handling, race conditions
- **Files:** `app/utils/file-tail.server.ts` (275 lines, ~0% test coverage)
- **Risk:** File handle leaks, memory accumulation, missed updates
- **Priority:** Medium - affects stability

### Streaming Endpoint Error Handling
- **What's not tested:** Network interruption recovery, subscription timeout, controller errors
- **Files:** `app/routes/api.sessions.$project.$sessionId.stream.ts` (60 lines, ~0% test coverage)
- **Risk:** Stuck client streams, missed updates
- **Priority:** Low - graceful degradation via browser fallback

---

*Concerns audit: 2026-01-25*
