# Claude Process Cancellation Implementation Plan

## Problem
Long-running Claude CLI commands can't be interrupted. In the CLI UI, users press ESC twice to cancel. We need equivalent functionality in the web app.

## Current State
- `sendPromptToSession()` and `startNewSession()` spawn child processes
- Processes run indefinitely (timeouts removed)
- No reference to child processes after promise resolves
- No way to cancel from UI

## Solution Architecture

### 1. Process Registry System
**File: `app/claude-cli.server.ts`**

Create a registry to track active Claude processes:
```typescript
// Track running processes globally
const activeProcesses = new Map<string, ChildProcess>();

export function getActiveProcess(sessionId: string): ChildProcess | undefined {
  return activeProcesses.get(sessionId);
}

export function cancelProcess(sessionId: string): boolean {
  const process = activeProcesses.get(sessionId);
  if (process && !process.killed) {
    // Send SIGINT (graceful, like Ctrl+C) then SIGKILL if needed
    process.kill('SIGINT');
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGKILL');
      }
    }, 10000);
    return true;
  }
  return false;
}
```

**Modifications:**
- Register process immediately after `spawn()` in both functions
- Remove from registry on process close
- Add cleanup on error

### 2. Cancel API Endpoint
**File: `app/routes/api.sessions.$project.$sessionId.cancel.ts`**

```typescript
export async function action({ params }: Route.ActionArgs) {
  const { sessionId } = params;

  const cancelled = cancelProcess(sessionId);

  return json({
    success: cancelled,
    message: cancelled
      ? 'Process cancellation requested'
      : 'No active process found'
  });
}
```

### 3. Active Process Status Check
**File: `app/routes/api.sessions.$project.$sessionId.active.ts`** (already exists)

Enhance existing endpoint or create new one:
```typescript
export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;
  const isActive = getActiveProcess(sessionId) !== undefined;

  return json({ isActive });
}
```

### 4. UI Components

#### A. Cancel Button Component
**File: `app/components/CancelButton.tsx`**

- Fetcher to check if process is active (poll every 2 seconds)
- Button only visible when process is active
- Red/warning styling
- Confirmation dialog: "Cancel running process?"
- Submit to cancel endpoint
- Show "Cancelling..." state

#### B. Session Detail Page Enhancement
**File: `app/routes/$project.sessions.$sessionId.tsx`**

Add CancelButton near the prompt input form:
```tsx
{isProcessActive && (
  <CancelButton
    sessionId={sessionId}
    onCancel={() => revalidate()}
  />
)}
```

#### C. Prompt Form Enhancement
**File: Form in session detail page**

- Disable submit button while process is active
- Show "Processing..." state
- Auto-enable when process completes

### 5. Signal Handling (VERIFIED ✅)

**Research completed - see `2025-09-30-02-45pm-claude-cli-signal-research.md` for full details**

**Key Findings:**
- **ESC ESC is NOT a signal** - it's application-level keyboard input for history navigation
- **Use SIGINT** - this is the programmatic equivalent of Ctrl+C
- **Claude CLI responds immediately** to SIGINT with graceful exit (code 0)
- **SIGKILL fallback** - use after 10s if SIGINT doesn't work (safety net)

**Verified behavior:**
```typescript
child.kill('SIGINT')  // ✅ Works immediately, exits gracefully
child.kill('SIGTERM') // Should work but SIGINT is preferred
child.kill('SIGKILL') // Last resort, forces termination
```

**Updated cancelProcess implementation:**
```typescript
export function cancelProcess(sessionId: string): boolean {
  const process = activeProcesses.get(sessionId);
  if (process && !process.killed) {
    // Send SIGINT (graceful, like Ctrl+C)
    process.kill('SIGINT');

    // Safety: SIGKILL after 10s if still running
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGKILL');
      }
    }, 10000);
    return true;
  }
  return false;
}
```

### 6. Edge Cases & Considerations

#### Race Conditions
- Process completes naturally while cancel request in-flight
- Multiple cancel requests
- Process already killed but registry not updated

**Solution:** Always check `process.killed` before operations

#### Cleanup
- Process crashes/errors → remove from registry
- Server restart → all registry entries lost (acceptable)
- Zombie processes → use `SIGKILL` fallback

#### User Feedback
- Toast notification: "Process cancelled"
- Update session view to show cancellation in history
- Clear any optimistic UI updates

#### Security
- Validate user owns the project/session before allowing cancel
- Rate limit cancel requests
- Log cancellation attempts

### 7. Testing Strategy

**Manual Tests:**
1. Start long task (e.g., "analyze entire codebase")
2. Verify cancel button appears
3. Click cancel while task running
4. Verify process terminates
5. Verify UI updates correctly
6. Verify no zombie processes remain

**Edge Case Tests:**
1. Cancel immediately after submission
2. Cancel when process is completing
3. Multiple rapid cancel clicks
4. Cancel non-existent process
5. Process completes before cancel request processed

### 8. Future Enhancements

**Phase 2 considerations:**
- Cancel all processes for a project
- View all active processes globally
- Process timeout warnings (before killing)
- Process resource monitoring
- Cancel history/audit log
- Keyboard shortcut (ESC ESC) in web UI

## Implementation Order

1. **Process registry** - Core infrastructure
2. **Cancel API endpoint** - Server capability
3. **Active status check** - Detection mechanism
4. ~~**Signal testing**~~ - ✅ **COMPLETED** - SIGINT verified working
5. **UI components** - User interface
6. **Integration testing** - End-to-end validation
7. **Edge case handling** - Robustness

## Success Criteria

- ✅ Can cancel long-running Claude CLI processes from UI
- ✅ UI shows real-time process status
- ✅ No zombie processes left after cancellation
- ✅ Graceful handling of race conditions
- ✅ Clear user feedback on cancellation
- ✅ Submit button disabled during processing
- ✅ Cancel button only visible when needed

## Questions to Resolve

1. Should we track process start time and show elapsed duration?
2. Should we warn if process exceeds expected time (e.g., 5 minutes)?
3. Should we persist cancellation events in session history?
4. Should we allow cancelling from the projects list view?
5. Do we need admin view of all active processes?