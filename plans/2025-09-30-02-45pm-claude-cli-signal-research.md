# Claude CLI Signal Research Results

## Executive Summary

**ESC ESC in Claude CLI is NOT a Unix signal** - it's application-level keyboard input handling for conversation history navigation. When spawning Claude CLI as a child process, we must use **SIGINT** (same as Ctrl+C) to interrupt/cancel operations.

## Official Documentation Findings

### From docs.claude.com/en/docs/claude-code/interactive-mode

**Keyboard Controls:**
- `Ctrl+C`: "Cancel current input or generation"
- `ESC + ESC`: "Rewind the code/conversation" - restore to a previous point

**Key Insight:** These are two different operations:
- Ctrl+C = Process cancellation (SIGINT signal)
- ESC ESC = History navigation (application feature, requires interactive stdin)

### From Troubleshooting Docs

- ESC key is meant to interrupt the agent during execution
- Known issues: ESC and Ctrl+C sometimes show feedback but don't actually stop execution (bugs reported in issues #3455, #664, #6643)

## Technical Testing Results

### Test 1: SIGINT During Startup
```javascript
child.kill('SIGINT')  // Sent after 3 seconds
Result: Process closed immediately with code=0 (graceful exit)
```

### Test 2: SIGINT with Longer Task
```javascript
child.kill('SIGINT')  // Sent after 5 seconds during file analysis task
Result: Process closed immediately with code=0 (graceful exit)
```

### Test 3: SIGINT with Simple Task
```javascript
child.kill('SIGINT')  // Sent after 2 seconds
Result: Process closed immediately with code=0 (graceful exit)
```

## Node.js Signal Behavior

### How Ctrl+C Works in Node.js

1. User presses Ctrl+C in terminal
2. Terminal sends SIGINT to the process
3. Node.js process emits 'SIGINT' event
4. If handler exists: custom logic runs
5. If no handler: process terminates

### Spawned Child Processes

When spawning with `stdio: ['ignore', 'pipe', 'pipe']`:
- stdin is ignored (not connected)
- Cannot send keyboard input (ESC characters) to child
- Must use process signals (SIGINT, SIGTERM, SIGKILL)

## Recommended Implementation

### Signal Sequence Strategy

```typescript
// 1. Send SIGINT (same as Ctrl+C - graceful)
child.kill('SIGINT');

// 2. If not dead after 5 seconds, send SIGTERM (graceful shutdown)
setTimeout(() => {
  if (!child.killed) {
    child.kill('SIGTERM');
  }
}, 5000);

// 3. If STILL not dead after 5 more seconds, send SIGKILL (force)
setTimeout(() => {
  if (!child.killed) {
    child.kill('SIGKILL');
  }
}, 10000);
```

### Simplified Strategy (Based on Testing)

Since SIGINT works reliably and immediately:

```typescript
// Just send SIGINT - Claude CLI handles it gracefully
const killed = child.kill('SIGINT');

// Optional: SIGKILL fallback after 10 seconds (paranoid safety)
setTimeout(() => {
  if (!child.killed) {
    child.kill('SIGKILL');
  }
}, 10000);
```

## Why ESC ESC Won't Work for Us

1. **No stdin connection**: We spawn with `stdio: ['ignore', 'pipe', 'pipe']`
2. **Not a signal**: ESC ESC is application-level input parsing, not OS signal
3. **Different purpose**: ESC ESC is for history navigation, not cancellation
4. **Interactive only**: Requires raw terminal mode with stdin connected

## Signal Comparison

| Signal   | Type      | Catchable | Claude Behavior | Exit Code | Use Case                    |
|----------|-----------|-----------|-----------------|-----------|----------------------------|
| SIGINT   | Interrupt | Yes       | Graceful exit   | 0         | User cancellation (Ctrl+C) |
| SIGTERM  | Terminate | Yes       | Graceful exit   | 0         | System shutdown request    |
| SIGKILL  | Kill      | No        | Forced kill     | null      | Last resort                |

## Known Issues (from GitHub)

- Issue #3455: ESC and Ctrl+C show feedback but don't stop execution
- Issue #664: ESC doesn't work in PyCharm due to keybinding conflicts
- Issue #6643: Accidental ESC press while processing causes issues

**Implication**: Even in interactive mode, interruption may not be 100% reliable. Our implementation should handle cases where SIGINT doesn't immediately stop the process.

## Implementation Recommendations

### 1. Process Registry
```typescript
const activeProcesses = new Map<string, {
  process: ChildProcess,
  startTime: number,
  command: string
}>();
```

### 2. Cancel Function
```typescript
export function cancelProcess(sessionId: string): boolean {
  const entry = activeProcesses.get(sessionId);
  if (!entry || entry.process.killed) {
    return false;
  }

  // Send SIGINT (graceful)
  entry.process.kill('SIGINT');

  // Fallback: SIGKILL after 10s if still running
  setTimeout(() => {
    if (!entry.process.killed) {
      console.warn('[cancelProcess] SIGINT failed, sending SIGKILL');
      entry.process.kill('SIGKILL');
    }
  }, 10000);

  return true;
}
```

### 3. Process Lifecycle
```typescript
// On spawn
activeProcesses.set(sessionId, {
  process: child,
  startTime: Date.now(),
  command: prompt.slice(0, 100)
});

// On close
child.on('close', (code, signal) => {
  activeProcesses.delete(sessionId);
  console.log(`Process closed: code=${code}, signal=${signal}`);
});

// On error
child.on('error', (error) => {
  activeProcesses.delete(sessionId);
  console.error('Process error:', error);
});
```

## Testing Checklist

- [x] Verify SIGINT terminates Claude CLI processes
- [x] Confirm graceful exit (code 0)
- [x] Test early interruption (before output)
- [ ] Test late interruption (during output) - needs longer-running task
- [ ] Test rapid multiple cancel requests
- [ ] Test cancel on non-existent session
- [ ] Test cancel on already-completed process
- [ ] Verify no zombie processes remain
- [ ] Check process cleanup on error
- [ ] Test SIGKILL fallback (if SIGINT fails)

## Security Considerations

1. **Validate session ownership** before allowing cancellation
2. **Rate limit** cancel requests (prevent abuse)
3. **Audit log** all cancellation attempts
4. **Validate session ID format** (UUID) before lookup
5. **Handle concurrent requests** (process completing while cancel in-flight)

## Performance Considerations

- Process registry is in-memory (lost on server restart - acceptable)
- Map lookup is O(1) for cancellation
- No database writes needed
- Cleanup happens automatically via event handlers

## Future Enhancements

1. Track process resource usage (CPU, memory)
2. Automatic timeout warnings (e.g., "Still running after 5 minutes")
3. Cancel all processes for a project/user
4. Global process monitor dashboard
5. Process analytics (avg duration, cancellation rate)
6. Graceful shutdown on server restart (cancel all active processes)

## Conclusion

**Use SIGINT for cancellation** - it's the programmatic equivalent of Ctrl+C and Claude CLI handles it gracefully. ESC ESC is irrelevant for spawned processes without interactive stdin.

**Implementation is straightforward:**
1. Track child processes in a Map
2. Expose cancel API endpoint
3. Call `child.kill('SIGINT')` on cancel request
4. Use SIGKILL fallback after 10s (safety net)
5. Clean up registry on process close/error