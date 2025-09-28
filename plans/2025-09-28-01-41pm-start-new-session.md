# Start New Claude Code Session from Web UI

## Research Summary

### How Claude CLI Creates Sessions

When you run `claude` or `claude "prompt"`, it automatically:
1. Creates a new session with a UUID
2. Determines the project from current working directory (`cwd`)
3. Saves session to `~/.claude/projects/{encoded-path}/{session-id}.jsonl`
4. Starts interactive REPL or executes in print mode

**Key CLI Commands:**
- `claude "initial prompt"` - Start new session with prompt
- `claude -p "prompt"` - Non-interactive (print mode)
- `claude --permission-mode bypassPermissions` - Skip permission prompts
- `claude --model opus` - Specify model
- `claude --add-dir /path` - Add additional directories

**Session Storage:**
- Project path encoded: `/Users/bryan/code/myapp` → `-Users-bryan-code-myapp`
- Session files: `{project-dir}/{uuid}.jsonl`
- First line contains `cwd` field with actual project path

## Where to Add "New Session" Button

### Option 1: Projects List Page (Recommended)
**Location:** `app/routes/_index.tsx`

**Placement:** Add button next to each project name

**Why:**
- Natural place to start a new session for a project
- User can see all projects and choose which to start
- Clear context (which project directory to use)

**UI Mockup:**
```
Projects
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ccc-viz                    [+ New Session]
dynasty-nerds-monorepo     [+ New Session]
ftn-proto                  [+ New Session]
```

### Option 2: Project Sessions List
**Location:** `app/routes/$project.sessions._index.tsx`

**Placement:** Add button at top of sessions list

**Why:**
- User is already in project context
- Can see existing sessions and start a new one
- More prominent for active projects

**UI Mockup:**
```
ccc-viz - Sessions                    [+ New Session]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session abc123...  2 hours ago
Session def456...  1 day ago
```

### Option 3: Floating Action Button (Advanced)
**Location:** Both pages

**Placement:** Floating button in bottom-right corner

**Why:**
- Always accessible
- Doesn't clutter UI
- Modern UX pattern

## Implementation Plan

### Recommended Approach: Option 1 + Option 2

Add "New Session" buttons on both:
1. **Projects list** - For browsing and starting
2. **Sessions list** - For quick access when in project

### Architecture

#### 1. CLI Server Function
**File:** `app/claude-cli.server.ts` (extend existing)

```typescript
export async function startNewSession(
  workingDirectory: string,
  initialPrompt?: string,
  options?: {
    model?: string;
    permissionMode?: string;
  }
): Promise<{ success: boolean; sessionId?: string; error?: string }>
```

**Implementation:**
- Run `claude -p "{initialPrompt}"` in `workingDirectory`
- Capture output
- Parse new session file to extract session ID
- Return session ID for redirect

**Challenge:** How to get session ID?
- Option A: Parse stdout for session info (unreliable)
- Option B: List directory before/after to find new .jsonl file
- Option C: Use `--session-id` flag with pre-generated UUID ✅ (Best!)

#### 2. React Router Action
**File:** `app/routes/_index.tsx` and `$project.sessions._index.tsx`

```typescript
export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const project = params.project || formData.get("project");
  const initialPrompt = formData.get("prompt") || "Hello";

  // Decode project path
  const workingDirectory = decodeProjectPath(project);

  // Start new session
  const result = await startNewSession(workingDirectory, initialPrompt);

  if (result.success && result.sessionId) {
    // Redirect to new session detail page
    return redirect(`/${project}/sessions/${result.sessionId}`);
  }

  return { error: result.error };
}
```

#### 3. UI Components

**Quick Start Button (No Prompt):**
```tsx
<Form method="post">
  <input type="hidden" name="project" value={projectName} />
  <button type="submit" className="...">
    + New Session
  </button>
</Form>
```

**With Prompt Dialog (Enhanced):**
```tsx
<Dialog>
  <Form method="post">
    <input type="hidden" name="project" value={projectName} />
    <textarea name="prompt" placeholder="Initial prompt (optional)" />
    <button type="submit">Start Session</button>
  </Form>
</Dialog>
```

### Session ID Strategy (Recommended)

Use `--session-id` flag to pre-generate UUID:

```typescript
import { randomUUID } from "crypto";

const sessionId = randomUUID();
const args = [
  "--session-id", sessionId,
  "--print",
  "--permission-mode", "bypassPermissions",
  initialPrompt || "Hello"
];

// Execute CLI
await spawn("claude", args, { cwd: workingDirectory });

// Session will be created at:
// ~/.claude/projects/{encoded-project}/{sessionId}.jsonl
```

**Advantages:**
- Know session ID before execution
- No need to scan directory
- Can redirect immediately
- Clean and predictable

### Project Path Encoding

Need to encode/decode project paths:

```typescript
// Encode: /Users/bryan/code/myapp → -Users-bryan-code-myapp
function encodeProjectPath(absPath: string): string {
  return absPath.split(path.sep).filter(Boolean).join('-');
}

// Decode: -Users-bryan-code-myapp → /Users/bryan/code/myapp
function decodeProjectPath(encoded: string): string {
  return path.sep + encoded.split('-').filter(Boolean).join(path.sep);
}
```

## Implementation Steps

### Phase 1: Basic New Session (Quick Win)
1. ✅ Add `startNewSession()` to `app/claude-cli.server.ts`
2. ✅ Add action to projects list route
3. ✅ Add "+ New Session" button next to each project
4. ✅ Test: Click button → Session created → Redirect to detail page

### Phase 2: Custom Initial Prompt
1. Add dialog/modal for initial prompt input
2. Optional prompt textarea
3. Model selector (optional)
4. Enhanced UX with loading states

### Phase 3: Sessions List Integration
1. Add "+ New Session" to sessions list page
2. Reuse existing action logic
3. Button at top of sessions list

### Phase 4: Polish
1. Loading indicators during session creation
2. Error handling and retry
3. Confirmation on success
4. Recent sessions cache

## UX Flow

**Quick Start (No Prompt):**
1. User clicks "+ New Session" button
2. Form submits immediately (POST)
3. Server creates session with default "Hello" prompt
4. Redirect to new session detail page
5. See messages streaming in real-time

**With Custom Prompt:**
1. User clicks "+ New Session" button
2. Dialog opens with prompt textarea
3. User types initial prompt
4. Click "Start Session"
5. Server creates session with custom prompt
6. Redirect to session detail page

## Security Considerations

1. **Path Validation:**
   - Validate decoded paths are within allowed directories
   - Prevent path traversal attacks
   - Reuse existing `resolveSessionFile` safety checks

2. **Command Injection:**
   - Use spawn with argument arrays (already doing this)
   - Validate session IDs are valid UUIDs
   - Never pass user input directly to shell

3. **Rate Limiting:**
   - Limit new sessions per project per time period
   - Track creation timestamps
   - Prevent abuse

## Testing Plan

1. **Unit Tests:**
   - Path encoding/decoding
   - Session ID generation
   - Error handling

2. **Integration Tests:**
   - Create session from projects list
   - Create session from sessions list
   - Verify session file exists
   - Verify redirect works

3. **Manual Testing:**
   - Click button, verify session created
   - Check session appears in list
   - Verify messages stream correctly
   - Test with different projects

## Success Criteria

1. ✅ User can start new session from projects list
2. ✅ User can start new session from sessions list
3. ✅ Session is created in correct project directory
4. ✅ User is redirected to session detail page
5. ✅ Messages stream in real-time
6. ✅ No security vulnerabilities
7. ✅ Works across all project types

## Future Enhancements

- **Session Templates:** Pre-configured prompts for common tasks
- **Quick Actions:** "Debug this", "Review code", "Write tests"
- **Model Selection:** Choose model before starting
- **Clone Session:** Start new session based on existing one
- **Session Tags:** Categorize sessions by type