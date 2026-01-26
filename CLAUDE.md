# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-viz is a React Router 7 full-stack application for visualizing Claude Code sessions. It reads from `~/.claude/projects` to display project sessions with filtering and markdown rendering capabilities.

## Essential Commands

```bash
# Development
pnpm dev          # Start dev server at http://localhost:5174
pnpm typecheck    # Generate route types and run TypeScript checks

# Build & Production
pnpm build        # Build client/server bundles to build/
pnpm start        # Run production server

# Background process management (custom scripts)
pnpm bg:start     # Start dev server in background
pnpm bg:logs      # Watch logs in real-time
pnpm bg:stop      # Stop background server
```

## Architecture

### Technology Stack
- **React Router 7** with SSR enabled and file-based routing
- **React 19** with TypeScript
- **TailwindCSS v4** for styling
- **Vite 6** as build tool
- **pnpm** as package manager
- **SQLite** (better-sqlite3) with Drizzle ORM for kanban persistence

### Key Directories
- `app/routes/` - File-based routes using flatRoutes configuration
- `app/welcome/` - Reusable UI components
- `app/db/` - Drizzle schema and database utilities (`index.server.ts` = singleton, `schema.ts` = tables)
- `build/` - Compiled output (client and server bundles)

### Database
- SQLite database at `~/.claude/cc-viz/kanban.db`
- Uses WAL mode for concurrent access
- Import via `getDb()` from `~/db/index.server.ts`
- Drizzle Kit scripts: `pnpm db:generate`, `pnpm db:push`, `pnpm db:studio`
- **Query helpers**: `app/db/queries.server.ts` has all CRUD operations (getAllStories, createStory, etc.)
- **Kanban utils**: `app/utils/kanban.server.ts` wraps DB queries with business logic (sync, session detection)
- **Migration**: Run `pnpm migrate:json-to-sqlite` to migrate from JSON files (one-time)

### File Watcher (Real-time Session Detection)
- **Watcher**: `app/utils/session-watcher.server.ts` - Singleton chokidar watcher on `~/.claude/projects/**/*.jsonl`
- **SSE endpoint**: `app/routes/api.kanban.watch.ts` - Streams watcher events to clients
- **Client hook**: `app/hooks/useSessionWatcher.ts` - Subscribe to session:added/changed/removed events
- **Integration**: Kanban board auto-syncs new sessions via `syncOneSession()` action
- Chokidar imported via `require()` to avoid ESM/CJS type conflicts

### Native Module Builds (better-sqlite3)
pnpm v10 requires explicit approval for native module build scripts. If better-sqlite3 bindings are missing:
```bash
# Navigate to the module and build manually
bash -c 'cd /path/to/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release'
```
The `.npmrc` file has `only-built-dependencies=better-sqlite3` but pnpm may still ignore it.

### Routing Structure
Routes are defined in `app/routes.ts` using `@react-router/fs-routes`:
- `_index.tsx` - Home page listing Claude projects
- `$project.sessions._index.tsx` - Project sessions list
- `$project.sessions.$sessionId.tsx` - Session detail view with filtering
- `kanban.tsx` - Kanban board for organizing sessions across projects

### Data Flow
1. Application reads Claude Code sessions from local filesystem (`~/.claude/projects`)
2. Sessions are parsed and displayed with routing parameters
3. Session details include message type filtering and markdown rendering

## Development Guidelines

### Hot Module Replacement (HMR)

React Router 7 with Vite provides HMR for both client and server code:
- **No restart needed** for changes to routes, components, loaders, actions, or `.server.ts` files
- Vite's HMR handles server-side code in dev mode automatically
- Only restart if you encounter module resolution issues or environment variable changes

### React Router 7 SSR Module Boundaries (CRITICAL)

**NEVER import Node.js modules at the top level of route files.** This causes "Module has been externalized for browser compatibility" errors during client-side navigation.

❌ **WRONG:**
```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function loader() {
  const data = await readFile(join(...));
  return data;
}
```

✅ **CORRECT:**
```typescript
export async function loader() {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const data = await readFile(join(...));
  return data;
}
```

**Rule:** All Node.js imports (`node:*`, `fs`, `path`, etc.) must be dynamically imported inside loader/action functions using `await import()`. Top-level imports are included in both server AND client bundles, causing runtime errors in the browser.

**Applies to:**
- `node:fs`, `node:path`, `node:os`, `node:child_process`, etc.
- Any server-only modules ending in `.server.ts`
- Database clients, file system operations, subprocess spawning

### Debugging Navigation Issues

When users report navigation or UI problems:

1. **ALWAYS use Playwright first** to capture browser console errors - don't ask the user for screenshots
2. **Check both server logs AND browser console** - many errors only appear client-side
3. **Test client-side navigation specifically** - page reloads can mask SSR issues
4. **Look for "externalized for browser compatibility" errors** - indicates server modules in client bundle

Example Playwright debugging command:
```typescript
Task: "Navigate to [URL] and check for console errors. Take screenshots before and after navigation."
```

### Adding New Routes
Create files in `app/routes/` following the naming convention:
- Use `$` prefix for dynamic segments (e.g., `$project.tsx`)
- Use `.` for nested routes (e.g., `$project.sessions.tsx`)
- Use `_index.tsx` for index routes

### TypeScript Path Alias
Use `~/` to import from the app directory:
```typescript
import { Component } from "~/welcome/component"
```

### Server Configuration
The Vite dev server is configured to:
- Run on port 5174
- Accept connections from Tailscale network hosts
- Bind to 0.0.0.0 for network accessibility

### Styling
TailwindCSS v4 is configured in `app/app.css`. The app uses:
- Inter font family from Google Fonts
- Dark mode support via CSS variables
- Mobile-responsive design patterns

## Session Data Structure

Sessions contain messages with various types documented in `docs/session-message-types.md`:
- `human` - User messages
- `assistant` - Claude responses
- `text` - Tool outputs
- `command` - Commands like /start, /init
- `environment_details` - System information
- `tool_response` - Tool execution results

## Important Notes

- Test framework: Vitest (`pnpm test`)
- Docker support available via multi-stage Dockerfile
- tmux-urls.cfg contains URL shortcuts for quick browser access
- The app specifically visualizes Claude Code session data from the local filesystem