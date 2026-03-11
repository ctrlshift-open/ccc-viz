# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
ccc-viz/
├── app/                              # Application source code
│   ├── routes/                       # File-based routes
│   ├── components/                   # React UI components
│   ├── types/                        # TypeScript type definitions
│   ├── utils/                        # Utility functions
│   ├── welcome/                      # Reusable UI components (legacy name)
│   ├── __tests__/                    # Unit tests
│   ├── *.server.ts                   # Server-only modules
│   ├── root.tsx                      # Root layout component
│   ├── routes.ts                     # Route configuration
│   └── app.css                       # Global styles (TailwindCSS)
├── build/                            # Compiled output (generated)
│   ├── client/                       # Client bundle
│   └── server/                       # Server bundle
├── public/                           # Static assets
├── bin/                              # CLI entry point
├── scripts/                          # Development/utility scripts
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
├── vite.config.ts                    # Vite build configuration
└── .env*                             # Environment variables (local only)
```

## Directory Purposes

**`app/routes/`:**
- Purpose: File-based routing using `@react-router/fs-routes` convention
- Contains: Route components, loaders, actions, metadata
- Key files:
  - `_index.tsx` - Home page (project list)
  - `kanban.tsx` - Kanban board view
  - `$project.sessions._index.tsx` - Sessions list per project
  - `$project.sessions.$sessionId.tsx` - Session detail view
  - `api.*` - API endpoints returning JSON

**`app/components/`:**
- Purpose: Reusable React components
- Contains: UI components, hooks
- Key files:
  - `KanbanBoard.tsx` - Main kanban board container
  - `KanbanColumn.tsx` - Column within board
  - `KanbanCard.tsx` - Card/story item
  - `StoryCard.tsx` - Story card (kanban item)
  - Navigation components (DesktopNav, MobileNav)

**`app/types/`:**
- Purpose: TypeScript type definitions
- Contains: Shared types across components and routes
- Key files:
  - `kanban.ts` - Kanban types (KanbanState, KanbanStory, KanbanStatus, StorySession)

**`app/utils/`:**
- Purpose: Reusable utility functions
- Contains: Formatting, calculations, file handling, path validation
- Key files:
  - `format.ts` - USD formatting, cost color calculation
  - `kanban.server.ts` - Kanban state management (server-only, 539 lines)
  - `path-safety.server.ts` - Path validation and resolution
  - `file-tail.server.ts` - File streaming utilities
  - `session-name-generation.server.ts` - AI-based naming

**`app/welcome/`:**
- Purpose: Legacy component directory (UI components)
- Contains: FileViewer, welcome layout
- Key files:
  - `welcome.tsx` - Main wrapper component
  - `FileViewer.tsx` - Displays file content

**`app/__tests__/`:**
- Purpose: Unit tests
- Contains: Test files matching source structure
- Key files:
  - `format.test.ts` - Tests for formatting functions
  - `routes-no-node-imports.test.ts` - Validates routes don't import Node modules at top level

**Server Modules (`app/*.server.ts`):**
- `projects.server.ts` (83 lines) - Read projects from `~/.claude/projects`
- `sessions.server.ts` (149 lines) - Extract session previews and metadata
- `claude-cli.server.ts` - Start new Claude Code sessions
- Purpose: Node.js-only operations; never imported in client code
- Rule: Dynamic imports only (use `await import()` inside loaders/actions)

**`app/root.tsx`:**
- Purpose: Root layout component, shared across all routes
- Contains: HTML shell, navigation, error boundary
- Exports: `Layout` component, `ErrorBoundary`, `links` (fonts), default export

**`app/routes.ts`:**
- Purpose: Route configuration using `flatRoutes()` from `@react-router/fs-routes`
- Contains: Single line - `flatRoutes() satisfies RouteConfig`
- Automatically discovers routes from file structure

**`app/app.css`:**
- Purpose: Global styles and TailwindCSS configuration
- Contains: CSS variables, TailwindCSS directives

**`build/`:**
- Purpose: Compiled application (generated during build)
- Generated: Yes, by `pnpm build` (React Router build)
- Committed: No

**`public/`:**
- Purpose: Static assets served directly
- Contains: Favicon, images, etc.

**`bin/`:**
- Purpose: CLI entry point
- Key files: `cc-viz.js` - Executable wrapper

**`scripts/`:**
- Purpose: Utility and development scripts
- Key files: `migrate-titles.ts` - Data migration scripts

## Key File Locations

**Entry Points:**
- `app/root.tsx` - Root layout and error boundary
- `app/routes/_index.tsx` - Home page (project list)
- `app/routes/kanban.tsx` - Kanban board
- `build/server/index.js` - Server bundle entry (after build)

**Configuration:**
- `package.json` - Dependencies, scripts, bin configuration
- `tsconfig.json` - TypeScript compiler options, path aliases
- `vite.config.ts` - Vite build tool configuration
- `.env`, `.env.local` - Environment variables (not checked in)

**Core Logic:**
- `app/utils/kanban.server.ts` - Kanban state sync and management (largest utility, 539 lines)
- `app/projects.server.ts` - Project discovery from filesystem
- `app/sessions.server.ts` - Session preview extraction
- `app/routes/api.sessions.costs.ts` - Cost calculation using ccusage

**Testing:**
- `app/__tests__/format.test.ts` - Formatting function tests
- `app/__tests__/routes-no-node-imports.test.ts` - Build validation test

## Naming Conventions

**Files:**
- Routes: Use React Router flat routes convention
  - Index routes: `_index.tsx`
  - Dynamic segments: `$paramName.tsx`
  - Nested routes: `parent.child.tsx`
  - API routes: `api.*` (e.g., `api.sessions.costs.ts`)
- Server modules: `.server.ts` suffix (e.g., `projects.server.ts`)
- Components: PascalCase (e.g., `KanbanBoard.tsx`, `DesktopNav.tsx`)
- Utilities: camelCase (e.g., `format.ts`, `file-tail.server.ts`)
- Types: camelCase file, PascalCase exported type (e.g., `kanban.ts` exports `KanbanStory`)

**Directories:**
- Feature areas: `routes/`, `components/`, `utils/`, `types/`
- Lowercase, descriptive names
- Group related items (e.g., all kanban logic in `utils/kanban.server.ts`)

**TypeScript**
- Route types: Auto-generated in `.react-router/types/` from file structure
- Import route types: `import type { Route } from "./+types/fileName"`
- Path alias: `~/` maps to `app/` directory (configured in `tsconfig.json`)

## Where to Add New Code

**New Feature:**
- Primary code: `app/routes/` (if route-based) or `app/utils/` (if shared logic)
- Components: `app/components/`
- Types: `app/types/` (if shared) or co-locate with route
- Tests: `app/__tests__/` (parallel structure)

**New Component/Module:**
- Implementation: `app/components/YourComponent.tsx`
- Styles: Use TailwindCSS classes (no separate CSS files)
- Exports: Default export component, named exports for hooks if standalone

**Utilities:**
- Shared helpers: `app/utils/yourUtil.ts`
- Server-only logic: `app/utils/yourUtil.server.ts` or new `app/yourService.server.ts`
- Types: `app/types/yourTypes.ts` if shared across multiple files

**New API Route:**
- Location: `app/routes/api.feature.ts` or `api.resource.$id.action.ts`
- Export: `loader` function for GET, `action` function for POST/PATCH/DELETE
- Return: `Response.json()` for JSON, or `{ field: value }` for form actions

**Tests:**
- Unit tests: `app/__tests__/filename.test.ts` (parallel to source)
- Framework: Vitest (`pnpm test` to run)
- Server tests: Use dynamic imports to handle `.server.ts` modules

## Special Directories

**`.react-router/`:**
- Purpose: Auto-generated type definitions for routes
- Generated: Yes, by `pnpm typecheck`
- Committed: No

**`.react-router/types/`:**
- Purpose: Type definitions for loaders/actions, imported via `./+types/routeName`
- Generated: Yes, by TypeScript build process
- Pattern: Import as `import type { Route } from "./+types/_index"`

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes, by `pnpm install`
- Committed: No

**`tmp/`:**
- Purpose: Temporary files for background processes, logs, PID files
- Generated: Yes, by `pnpm bg:*` scripts
- Committed: No (.gitignore)

## Rules for Server Module Imports

**CRITICAL: Prevent "Module has been externalized for browser compatibility" errors**

Rule: All Node.js imports must be dynamic (use `await import()`) inside loaders/actions.

❌ **WRONG** (top-level import):
```typescript
import { readFile } from "node:fs/promises";

export async function loader() {
  const data = await readFile("file.txt");
  return data;
}
```

✅ **CORRECT** (dynamic import in loader):
```typescript
export async function loader() {
  const { readFile } = await import("node:fs/promises");
  const data = await readFile("file.txt");
  return data;
}
```

Applies to:
- `node:*` modules (fs, path, os, etc.)
- `.server.ts` modules (imported from routes)
- Database clients, external services used server-side

Non-Node.js imports (React, libraries) are safe to import at top level.

---

*Structure analysis: 2026-01-26*
