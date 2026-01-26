# Architecture

**Analysis Date:** 2026-01-25

## Pattern Overview

**Overall:** React Router 7 full-stack SSR (Server-Side Rendering) with file-based routing

**Key Characteristics:**
- Server-driven data loading via loaders & actions
- Dynamic imports for Node.js modules (critical SSR pattern)
- Multi-route system with API endpoints + UI routes
- File system as primary data source (no database)
- Kanban-based session organization overlay

## Layers

**Presentation Layer (UI):**
- Purpose: Render interactive components for browsing and organizing Claude Code sessions
- Location: `app/routes/*.tsx` (page components), `app/components/*.tsx` (reusable UI)
- Contains: React components with hooks, forms using React Router, markdown rendering
- Depends on: React Router (navigation, fetchers), utils (formatting), types
- Used by: Browser clients via React Router SSR

**API Layer (Routes):**
- Purpose: Handle HTTP requests for data operations and state mutations
- Location: `app/routes/api.*.ts` (loaders & actions)
- Contains: Loader functions (GET), action functions (POST/PATCH), response formatting
- Depends on: Server utilities, file system access, path safety validation
- Used by: Frontend components via Form/useFetcher, direct HTTP requests

**Data Access Layer (Server Utilities):**
- Purpose: Encapsulate file system operations and business logic
- Location: `app/*.server.ts`, `app/utils/*.server.ts`
- Contains: Functions for reading sessions, projects, kanban state; parsing JSONL files
- Depends on: Node.js file system APIs, path resolution, data types
- Used by: Route loaders/actions

**Type System:**
- Purpose: Define data structures for sessions, projects, kanban stories
- Location: `app/types/kanban.ts` (primary), inline types in route files
- Contains: TypeScript interfaces for KanbanState, KanbanStory, SessionPreview
- Depends on: None (standalone type definitions)
- Used by: All layers for type safety

**Utility Layer:**
- Purpose: Shared formatting, path safety, file tailing, CLI integration
- Location: `app/utils/` (format.ts, path-safety.server.ts, file-tail.server.ts, kanban.ts)
- Contains: Cost formatting, color gradients, path validation, file tail monitoring
- Depends on: Standard library, third-party libs (ccusage)
- Used by: All layers

## Data Flow

**Session Listing Flow:**

1. User navigates to `/project/:project/sessions`
2. Route loader (`$project.sessions._index.tsx`) imports `path-safety.server` & `fs/promises`
3. Loader reads `.jsonl` files from `~/.claude/projects/:project/`
4. Files are sorted by mtime, formatted with `sessions.server.ts` preview extraction
5. Component receives `sessions` data, renders sorted list with filtering
6. User clicks session → navigates to `/project/:project/sessions/:sessionId`

**Session Detail View Flow:**

1. Route loader (`$project.sessions.$sessionId.tsx`) reads full session file
2. File parsed line-by-line as JSONL (one JSON object per line)
3. Component maintains client state: search query, sort direction, selected message type
4. User can filter messages, view file contents (action: readFile), cancel session
5. Real-time updates via poll to `/api/sessions/:project/:sessionId/active`

**Kanban Board Flow:**

1. `/kanban` loader calls `getKanbanState()` (reads `~/.claude/cc-viz/kanban.json`)
2. State contains stories (project+branch combinations) across 5 statuses
3. Component renders 4 visible columns (excludes archive)
4. Drag/drop UI sends intent to action (move, updateTitle, updatePRLink, archive)
5. Action calls server util functions (updateStoryStatus, updateStoryTitle, etc.)
6. Updated state persisted back to disk

**State Management:**
- Client-side: React hooks (useState) for UI state (search, filters, editing)
- Server-side: JSON files on disk (`~/.claude/cc-viz/kanban.json`, `~/.claude/cc-viz/kanban-archive.json`)
- No in-memory cache; fresh reads from disk on every load
- Optimistic UI updates via useFetcher + Form

## Key Abstractions

**Session (Core Domain Model):**
- Purpose: Represents one Claude Code session conversation
- Examples: `app/sessions.server.ts`, `app/routes/$project.sessions.$sessionId.tsx`
- Pattern: JSONL file format (one entry = one message), parsed on-demand, immutable source
- Entry types: human, assistant, text, command, environment_details, tool_response, summary

**Project (Container):**
- Purpose: Groups related sessions by project name
- Examples: `app/projects.server.ts`, route param `:project`
- Pattern: Directory in `~/.claude/projects/:project/`, scanned for `.jsonl` files
- Isolated sessions; no cross-project references

**KanbanStory (Organization Model):**
- Purpose: Groups sessions by project + git branch, organizes with status workflow
- Examples: `app/types/kanban.ts`, `app/utils/kanban.server.ts`
- Pattern: Immutable records in JSON state file, updated atomically
- Statuses: back-log, in-progress, discard, complete, archive

**FileReadRequest (Security Boundary):**
- Purpose: Safely resolve relative file paths within session's working directory
- Examples: `app/utils/path-safety.server.ts`, action in `$project.sessions.$sessionId.tsx`
- Pattern: Validate path segments, prevent directory traversal, enforce 1MB size limit
- Used for: File viewer feature, reading project files referenced in session

## Entry Points

**Web Application Root:**
- Location: `app/root.tsx`
- Triggers: App startup, page load
- Responsibilities: Layout wrapper, font links, navigation shell (mobile/desktop nav), error boundary

**Home Page:**
- Location: `app/routes/_index.tsx`
- Triggers: GET `/`, user navigates to home
- Responsibilities: List all projects, show last activity + cost, form to create new session

**Project Sessions List:**
- Location: `app/routes/$project.sessions._index.tsx`
- Triggers: GET `/:project/sessions`
- Responsibilities: List sessions for a project, filter by git branch, sort by mtime

**Session Detail View:**
- Location: `app/routes/$project.sessions.$sessionId.tsx`
- Triggers: GET `/:project/sessions/:sessionId`
- Responsibilities: Parse and render full session, support filtering + searching, file viewing

**Kanban Board:**
- Location: `app/routes/kanban.tsx`
- Triggers: GET `/kanban`
- Responsibilities: Load kanban state, render columns, handle drag/drop + CRUD operations

**API Routes (Data Operations):**
- `app/routes/api.kanban.state.ts` - GET/POST full kanban state
- `app/routes/api.kanban.stories.$storyId.ts` - PATCH story fields
- `app/routes/api.sessions.costs.ts` - GET aggregated session costs
- `app/routes/api.sessions.$project.$sessionId.active.ts` - Check if session is actively running
- `app/routes/api.sessions.$project.$sessionId.stream.ts` - SSE stream for real-time updates

## Error Handling

**Strategy:** Server-side try/catch, return JSON error responses or React Router error boundaries

**Patterns:**
- **Loader errors:** Caught in route loader, render via `ErrorBoundary` or meta function
- **Action errors:** POST/PATCH handlers catch exceptions, return `{ error: message }` in JSON
- **File access:** Non-critical errors (stat, read) caught and handled gracefully (return empty, return false)
- **Path validation:** Pre-flight checks in `path-safety.server` throw errors with clear messages
- **Type safety:** TypeScript enforces correct loader/action argument types via React Router code generation

## Cross-Cutting Concerns

**Logging:** `console.log` used for debugging in actions/loaders (see `_index.tsx` action for examples)

**Validation:**
- Route params: Validated by React Router type generation
- File paths: `path-safety.server` validates segments before filesystem access
- State updates: Type-safe via TypeScript; no runtime validators

**Authentication:** None (local file system only, assumes trusted user environment)

**Authorization:** N/A (single-user app reading local files)

**Performance Optimization:**
- File reading: Only when needed (lazy in loaders), cached in component state
- Rendering: useMemo for filtered story lists, prevents unnecessary re-renders
- Kanban: Stories excluded from archive in display (filtered out via useMemo)

---

*Architecture analysis: 2026-01-25*
