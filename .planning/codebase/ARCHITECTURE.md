# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** React Router 7 full-stack application with server-side rendering (SSR), file-based routing, and server modules for Node.js operations.

**Key Characteristics:**
- Full-stack React with TypeScript
- Server-side rendering via React Router 7 with SSR enabled
- File-based routing using `@react-router/fs-routes`
- Server modules (`.server.ts`) for Node.js-only code
- Dynamic imports in loaders/actions to prevent Node modules in client bundle
- Vite 6 for build tooling with TailwindCSS v4
- Filesystem-based data source (Claude Code sessions from `~/.claude/projects`)

## Layers

**Presentation Layer (UI Components):**
- Purpose: Render user interface, handle client-side interactions
- Location: `app/components/`, `app/welcome/`, route files (`app/routes/`)
- Contains: React components, hooks, layout components
- Depends on: Type definitions, utilities for formatting/logic
- Used by: Browser clients via SSR-rendered HTML

**Route Layer (Router & Actions/Loaders):**
- Purpose: Define application routing, handle form submissions, fetch data server-side
- Location: `app/routes/` with file-based naming (e.g., `_index.tsx`, `$project.sessions._index.tsx`)
- Contains: Route components, loader/action functions, meta exports
- Depends on: Server modules for data access, React Router APIs
- Used by: React Router for navigation and data loading

**Server Module Layer (Node.js Operations):**
- Purpose: Encapsulate server-only logic for filesystem, process, and external CLI access
- Location: `app/*.server.ts` files (e.g., `projects.server.ts`, `sessions.server.ts`)
- Contains: Functions for reading projects/sessions, calling external CLIs, kanban state management
- Depends on: Node.js stdlib (fs, path, os, child_process, util)
- Used by: Loaders, actions, and other server modules

**API Routes:**
- Purpose: Provide JSON endpoints for client-side data fetching and operations
- Location: `app/routes/api.*` files (REST-style routing)
- Contains: Loaders that return `Response.json()`, server-side calculations
- Depends on: Server modules, utilities
- Used by: Client-side code via `fetch()`

**Utilities Layer:**
- Purpose: Reusable functions and formatters used across layers
- Location: `app/utils/` and `app/types/`
- Contains: Formatting (USD, colors), path safety validation, kanban logic, file utilities
- Depends on: None
- Used by: Components, routes, server modules

## Data Flow

**Project List View:**
1. User navigates to `/` home page
2. Router loader (`app/routes/_index.tsx`) calls `getProjects()` from `app/projects.server.ts`
3. `getProjects()` reads `~/.claude/projects` directory, scans `.jsonl` files, extracts metadata
4. Loader returns project list to component
5. Component renders project table with links
6. Client-side effect fetches project costs via `/api/sessions/costs` endpoint
7. Costs are displayed with dynamic color scaling based on distribution

**Session Detail View:**
1. User clicks project, navigates to `/$project/sessions`
2. Loader (`app/routes/$project.sessions._index.tsx`) reads session files from project directory
3. Returns session list with file metadata (id, modified time)
4. Component renders sessions, loads previews client-side
5. User clicks session, navigates to `/$project/sessions/$sessionId`
6. Detail loader (`app/routes/$project.sessions.$sessionId.tsx`) streams session file
7. Component displays messages with filtering and rendering

**Kanban Board State Management:**
1. User navigates to `/kanban`
2. Loader reads kanban state from `~/.claude/cc-viz/kanban.json`
3. Component renders Kanban columns with stories (project + branch combinations)
4. User actions (move, edit, archive) submit forms to route action
5. Action updates state via kanban utilities, saves to disk
6. Revalidator refreshes loader data, UI updates

**Session-to-Story Sync:**
1. User clicks "Sync" on Kanban board
2. Route action calls `syncSessionsToStories()` from `app/utils/kanban.server.ts`
3. Sync reads all sessions across all projects
4. Groups sessions by project + git branch
5. Creates story per unique project+branch combination
6. Generates AI names for sessions using Claude CLI
7. Detects PR links using `gh` CLI
8. Saves state split across two files: `kanban.json` (active) and `kanban-archive.json` (archived)

**State Management:**
- Project/session metadata: Read-only from filesystem, cached in loader
- Kanban state: Read/written to JSON files in `~/.claude/cc-viz/`
- Client state: React hooks for search, filters, modal state (not persisted)
- Cost calculations: Computed on-demand via ccusage library

## Key Abstractions

**KanbanStory:**
- Purpose: Represents a project + branch combination as a single work item
- Examples: `app/types/kanban.ts` defines `KanbanStory` type
- Pattern: Immutable update functions (`updateStoryStatus`, `updateStoryTitle`) in `app/utils/kanban.server.ts`

**SessionPreview:**
- Purpose: Lightweight summary of session content (last message, branch, timestamp)
- Examples: `app/sessions.server.ts` exports `getSessionPreview()`
- Pattern: Lazy-loaded client-side or fetched via API

**Path Safety:**
- Purpose: Validate and resolve project/session paths to prevent directory traversal
- Examples: `app/utils/path-safety.server.ts` exports `resolveSessionFile()`, `resolveProjectDir()`
- Pattern: URL-encoded project names, validated base directory checks

**Cost Calculation:**
- Purpose: Compute USD cost per session using Claude API pricing
- Examples: `app/routes/api.sessions.costs.ts` uses `ccusage` library
- Pattern: Dynamic scaling based on percentiles (p50=green, p90=yellow, p99=red)

## Entry Points

**Home Route:**
- Location: `app/routes/_index.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Load projects from filesystem, render project list, handle new session creation

**Kanban Board Route:**
- Location: `app/routes/kanban.tsx`
- Triggers: Navigation to `/kanban`
- Responsibilities: Load kanban state, render board, handle story operations, sync sessions

**Session Detail Route:**
- Location: `app/routes/$project.sessions.$sessionId.tsx`
- Triggers: Navigation to `/:project/sessions/:sessionId`
- Responsibilities: Stream session file, render messages with filtering and markdown

**API Routes (Server-only):**
- `app/routes/api.sessions.costs.ts` - Fetch project/session costs
- `app/routes/api.sessions.previews.ts` - Fetch session previews
- `app/routes/api.kanban.state.ts` - Kanban state operations
- Other API routes handle specific session operations

**Server Modules (Utilities):**
- `app/projects.server.ts` - List projects from filesystem
- `app/sessions.server.ts` - Read session previews
- `app/utils/kanban.server.ts` - All kanban logic (sync, state management)
- `app/claude-cli.server.ts` - Claude CLI integration

## Error Handling

**Strategy:** Graceful degradation with fallbacks

**Patterns:**
- Loaders return partial data on error (e.g., empty array + error message)
- API routes return 400/500 JSON with error field
- Components display error messages or skeleton loaders
- File read failures (sessions) don't crash; skip invalid entries
- JSON parse failures on JSONL files are caught and ignored per-line
- Missing directories default to empty lists rather than throwing

## Cross-Cutting Concerns

**Logging:**
- Console.log for development (visible in server logs)
- No structured logging; minimal production logging
- Kanban sync operations log counts and progress

**Validation:**
- Path safety: `resolveSessionFile()` and `resolveProjectDir()` validate inputs
- Form submissions: TypeScript type guards on form data
- Session files: JSONL lines parsed individually; invalid entries skipped

**Authentication:**
- None; reads from local filesystem only
- No user accounts or permissions
- Desktop application model (local data access)

**Markdown Rendering:**
- `react-markdown` component in session detail view
- Supports code blocks with syntax highlighting via `react-syntax-highlighter` (implicit dependency)
- Sanitization via `react-markdown` defaults

**State Persistence:**
- Kanban state: Explicitly saved to `~/.claude/cc-viz/kanban.json`
- Session metadata: Read from project session files only
- No local storage except browser localStorage for UI preferences (e.g., adaptive colors)

---

*Architecture analysis: 2026-01-26*
