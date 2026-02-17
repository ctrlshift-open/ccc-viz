# Claude CLI Prompt Flow

## Core Module: `app/claude-cli.server.ts`

### `sendPromptToSession(sessionId, prompt, options)`
Resumes an existing session:
```
claude --resume <sessionId> --print --permission-mode bypassPermissions "<prompt>"
```

### `startNewSession(workingDirectory, initialPrompt, options)`
Creates a new session:
```
claude --session-id <uuid> --print --permission-mode bypassPermissions "<prompt>"
```

### Process Management
- `activeProcesses` Map tracks spawned CLI processes
- `isProcessActive(sessionId)` — check if a prompt is running
- `cancelProcess(sessionId)` — sends SIGINT (SIGKILL after 10s fallback)

## Route Integration

| Route | Function | Purpose |
|-------|----------|---------|
| `$project.sessions.$sessionId.tsx:166` | `sendPromptToSession()` | Follow-up prompt to existing session |
| `_index.tsx:93` | `startNewSession()` | Kick off a new session from home page |
| `api.sessions.$project.$sessionId.cancel.ts` | `cancelProcess()` | Cancel in-flight prompt |
| `api.sessions.$project.$sessionId.active.ts` | `isProcessActive()` | Check if prompt is running |
