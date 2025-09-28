# Send Prompt to Claude Code Session via Web UI

## Overview

Add functionality to send new prompts to existing Claude Code sessions directly from the web UI. This leverages the Claude CLI's `--resume` flag to continue conversations programmatically.

## Architecture

### 1. UI Component (Session Detail Page)

**Location:** `app/routes/$project.sessions.$sessionId.tsx`

Add a collapsible prompt input form at the top or bottom of the session detail page:

```tsx
<PromptForm>
  - Textarea for prompt input (expandable, markdown preview optional)
  - Submit button ("Send to Claude")
  - Loading state indicator
  - Success/error feedback display
  - Optional: Model selector (--model flag)
  - Optional: Print mode checkbox (for non-interactive output)
</PromptForm>
```

**Key Features:**
- Auto-expand textarea as user types
- Keyboard shortcuts (Cmd+Enter to submit)
- Disable form while request is in progress
- Clear input after successful submission
- Show live output as it streams from Claude

### 2. React Router Action

**Location:** `app/routes/$project.sessions.$sessionId.tsx`

```tsx
export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData()
  const prompt = formData.get("prompt")
  const project = params.project!
  const sessionId = params.sessionId!
  const model = formData.get("model") // optional

  // Validate inputs
  // Execute CLI command
  // Return result
}
```

**Responsibilities:**
1. Parse and validate form data
2. Construct safe CLI command
3. Execute command using Node.js child_process
4. Handle stdout/stderr streaming
5. Return structured response

### 3. Server-Side CLI Execution

**Location:** New file `app/claude-cli.server.ts`

```typescript
export async function sendPromptToSession(
  sessionId: string,
  prompt: string,
  options?: {
    model?: string
    printMode?: boolean
    workingDirectory?: string
  }
): Promise<CLIResult>
```

**Implementation:**
- Use `spawn` from `child_process` for streaming output
- Construct command: `claude -r ${sessionId} --print "${prompt}"`
- Escape prompt properly to prevent command injection
- Set proper working directory (project root)
- Stream stdout/stderr in real-time
- Handle timeouts (optional)
- Return structured result with exit code

### 4. Security Considerations

**Critical:**
1. **Command Injection Prevention:**
   - NEVER use string interpolation directly in shell commands
   - Pass prompt as an argument array to `spawn`, not as shell string
   - Sanitize session ID (validate UUID format)
   - Use `execFile` or `spawn` with argument array, NOT `exec`

2. **Permission Validation:**
   - Validate session belongs to the project
   - Use existing `resolveSessionFile()` for path safety
   - Ensure user has access to the project directory

3. **Rate Limiting:**
   - Consider adding rate limits to prevent abuse
   - Track concurrent requests per user/session

**Example Safe Execution:**
```typescript
import { spawn } from 'child_process'

const args = [
  '--resume', sessionId,
  '--print',
  prompt // passed as separate argument, not concatenated
]

const process = spawn('claude', args, {
  cwd: projectDirectory,
  env: process.env
})
```

### 5. User Experience Flow

**Successful Submission:**
1. User enters prompt and clicks "Send to Claude"
2. Form shows loading state (spinner + "Sending...")
3. Output streams in real-time (like terminal output)
4. On completion, show success message
5. Session detail page auto-refreshes to show new messages
6. Form clears and re-enables for next prompt

**Error Handling:**
1. Network/timeout errors: Show retry button
2. CLI errors: Display stderr output
3. Invalid session: Show helpful error message
4. Rate limit: Show cooldown timer

### 6. Live Updates Integration

The existing live update system via SSE will automatically show new messages as they're added to the session file. After sending a prompt:
- New assistant responses appear automatically
- Tool executions show up in real-time
- Cost totals update dynamically

### 7. Optional Enhancements

**Phase 1 (MVP):**
- Basic prompt input form
- Print mode execution (--print flag)
- Simple success/error feedback
- Manual page refresh to see new messages

**Phase 2:**
- Stream output in real-time to UI
- Auto-scroll to new messages
- Model selector dropdown
- Prompt templates/history

**Phase 3:**
- Interactive mode (websocket connection)
- Syntax highlighting for code in prompts
- Markdown preview for prompts
- Save common prompts

## Implementation Steps

### Step 1: Create CLI Server Module
- Create `app/claude-cli.server.ts`
- Implement `sendPromptToSession()` function
- Add proper TypeScript types
- Include error handling and validation

### Step 2: Add Action to Route
- Add `action` export to `$project.sessions.$sessionId.tsx`
- Parse form data
- Call CLI server module
- Return JSON response

### Step 3: Build UI Component
- Create `PromptForm` component
- Use React Router Form component
- Add loading states
- Add error/success feedback

### Step 4: Integrate with Existing UI
- Add form to session detail page
- Position appropriately (top/bottom/floating)
- Style consistently with existing design
- Wire up to action

### Step 5: Test Thoroughly
- Test with various prompt types
- Test error conditions
- Test security (injection attempts)
- Test concurrent requests
- Test with long-running prompts

### Step 6: Documentation
- Add usage docs to CLAUDE.md
- Update README if needed
- Add inline code comments

## Technical Decisions

### Why `--print` Flag?
- Non-interactive mode is simpler to implement
- Output is deterministic and easier to parse
- No need for terminal emulation
- Can be captured and stored easily

### Why React Router Actions?
- Progressive enhancement (works without JS)
- Built-in loading states (navigation.state)
- Automatic error boundaries
- Type-safe with Route.ActionArgs

### Why Server-Side Execution?
- Security: Never expose CLI to client
- Access to filesystem for session validation
- Can set proper working directory
- Can manage environment variables

### Why Real-Time Streaming?
- Better UX: Users see progress
- Matches CLI experience
- Allows cancellation
- Shows thinking/tool execution live

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Command injection | Use spawn with argument array, validate inputs |
| Long-running requests | Add timeout, allow cancellation |
| Concurrent requests | Rate limiting, queue management |
| Session file corruption | Validate session file before/after |
| API key exposure | Never log full commands, sanitize output |

## Example CLI Commands

```bash
# Basic usage
claude --resume abc123-def456 --print "Explain the authentication flow"

# With model selection
claude --resume abc123-def456 --print --model opus "Review this PR"

# With print mode for deterministic output
claude -r abc123-def456 -p "Run the tests"
```

## Success Criteria

1. ✅ Users can send prompts to sessions from web UI
2. ✅ Output appears in session detail view automatically
3. ✅ No security vulnerabilities (command injection, etc.)
4. ✅ Error handling covers common failure cases
5. ✅ Performance is acceptable (<2s initial response)
6. ✅ UI is intuitive and responsive