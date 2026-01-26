# Coding Conventions

**Analysis Date:** 2026-01-25

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `KanbanBoard.tsx`, `StoryCard.tsx`)
- Utilities: camelCase (e.g., `format.ts`, `path-safety.server.ts`)
- Server utilities: `.server.ts` suffix for Node.js-only modules (e.g., `kanban.server.ts`, `projects.server.ts`)
- Routes: Kebab-case with dot notation (e.g., `api.kanban.state.ts`, `$project.sessions.$sessionId.tsx`)
- Types: PascalCase in files prefixed with `type/` (e.g., `kanban.ts` for Kanban types)

**Functions:**
- Exported functions: camelCase (e.g., `formatUSD()`, `getProjects()`, `getKanbanState()`)
- Handlers: `handle[Action]` pattern (e.g., `handleDragStart()`, `handleTitleSave()`)
- Async operations: `[verb][Noun]` pattern (e.g., `syncSessionsToStories()`, `isHaikuSession()`)
- Utility helpers: Simple verbs (e.g., `walk()`, `formatDate()`)

**Variables:**
- State hooks: camelCase (e.g., `searchQuery`, `draggedStory`, `projectFilter`)
- Boolean flags: `is[State]` or `[action]Open` patterns (e.g., `isEditingTitle`, `menuOpen`, `isDragOver`)
- Refs: camelCase + `Ref` suffix (e.g., `titleInputRef`, `menuRef`)
- Object records: `[noun]ByKey` pattern (e.g., `storiesByStatus`, grouped by key)
- Constants: UPPER_SNAKE_CASE (e.g., `KANBAN_COLUMNS`, `KANBAN_DISPLAY_COLUMNS`, `KANBAN_LABELS`)

**Types:**
- Exported types: PascalCase (e.g., `KanbanStatus`, `KanbanStory`, `KanbanState`)
- Props types: `Props` (e.g., `type Props = { story: KanbanStory }`)
- Type imports: `type` keyword used (e.g., `import type { KanbanStatus } from "~/types/kanban"`)
- Union types: Used for specific domains (e.g., `"archive" | "back-log" | "in-progress"`)
- Record types: `Record<Key, Value>` pattern (e.g., `Record<KanbanStatus, KanbanStory[]>`)

## Code Style

**Formatting:**
- No explicit eslint/prettier config detected (follows React Router 7 defaults)
- Consistent 2-space indentation (observed throughout)
- No semicolons at end of JSX elements
- Trailing commas in objects/arrays
- String quotes: Double quotes for strings

**Line length:**
- JSX attributes wrap at readable boundaries (~120-130 char estimation)
- Long className strings stay inline with component

**React Patterns:**
- Functional components exclusively
- Inline event handlers use arrow functions (e.g., `onClick={(e) => handleClick(e)}`)
- Type Props interface declared before component
- Component signature shows destructured props with trailing comma

## Import Organization

**Order:**
1. Node.js runtime modules (`node:fs`, `node:path`, etc.)
2. Third-party modules (`react`, `react-router`, `lucide-react`, etc.)
3. Type imports with explicit `type` keyword
4. Relative imports using `~/` alias (`~/components/`, `~/utils/`, `~/types/`)
5. Local relative paths (rare; prefer `~/` alias)

**Path Aliases:**
- `~/` maps to `app/` directory per `tsconfig.json`
- Used consistently for imports across all routes and components

**Example Order:**
```typescript
// Node.js
import { promisify } from "node:util";
import { execFile } from "node:child_process";

// Third-party
import { useState, useRef } from "react";
import { Link } from "react-router";

// Types
import type { Route } from "./+types/kanban";
import type { KanbanStory, KanbanStatus } from "~/types/kanban";

// Relative (~/alias)
import { KanbanColumn } from "~/components/KanbanColumn";
import { KANBAN_DISPLAY_COLUMNS } from "~/types/kanban";
```

## React Router 7 SSR Rules

**CRITICAL: Dynamic imports for server modules:**
- Node.js modules MUST be dynamically imported inside loader/action functions
- Top-level imports of `node:*` modules in `.tsx` routes cause "externalized for browser compatibility" errors
- All server-side file I/O, child processes, and `.server.ts` imports must use `await import()`

**Example (CORRECT):**
```typescript
export async function loader() {
  const { getKanbanState } = await import("~/utils/kanban.server");
  const state = await getKanbanState();
  return { state };
}
```

**Example (WRONG - will break client nav):**
```typescript
import { getKanbanState } from "~/utils/kanban.server"; // ❌ Top-level import

export async function loader() {
  const state = await getKanbanState();
  return { state };
}
```

## Error Handling

**Patterns:**
- Try/catch blocks used for async file operations
- Fallback returns on error (e.g., `return false` for optional checks, `return []` for lists)
- Error messages attach context: `Failed to read directory: ${(error as Error).message}`
- Custom error responses in actions: `{ error: "descriptive message" }`
- Console.error for non-critical issues (e.g., failed project reads)

**Example:**
```typescript
try {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  // process
} catch (error) {
  return {
    dir,
    projects: [],
    error: `Failed to read directory: ${(error as Error).message}`,
  };
}
```

**Route error boundary:**
- Uses `isRouteErrorResponse()` to distinguish HTTP errors from JS errors
- Shows 404-specific message for missing pages
- Dev mode shows full stack trace; production shows generic message

## Logging

**Framework:** `console` (standard Node.js + browser console)

**Patterns:**
- `console.error()` for runtime errors with context
- Used sparingly; logs only failures, not success paths
- Error messages include operation context (e.g., "Failed to read project X")

**When to log:**
- File system operation failures
- Async errors that don't throw
- Skipped/skippable processing (not errors)

## Comments

**When to Comment:**
- Section markers for major JSX sections (e.g., `{/* Toolbar */}`, `{/* Column header */}`)
- Inline logic explanation for complex filtering/calculations
- Type definitions have JSDoc-style comments explaining domain concepts

**JSDoc/TSDoc:**
- Used for type definitions to explain business domain
- Comments describe "what" for types, not "how"

**Example:**
```typescript
/**
 * Kanban column statuses
 */
export type KanbanStatus = "archive" | "back-log" | "in-progress" | "discard" | "complete";

/** Kanban story = project + branch combination */
export type KanbanStory = {
  /** Title - defaults to branch name, user-editable */
  title: string;
};
```

## Function Design

**Size:** Typically 30-80 lines; larger functions decomposed into helper functions

**Parameters:**
- Props passed as object with destructuring in function signature
- Optional handlers use optional chaining: `onStoryMove?.(storyId, status)`
- Event parameters typed with React types: `React.DragEvent`, `React.MouseEvent`, `React.KeyboardEvent`

**Return Values:**
- Component functions return JSX
- Utility functions return typed objects or primitive values
- Async functions explicitly typed as `Promise<T>`

**Example:**
```typescript
export function KanbanBoard({ state, projects, onStoryMove, isSyncing }: Props) {
  // ~50 lines of implementation
}

async function getProjects(): Promise<{ dir: string; projects: Project[] }> {
  // implementation
}
```

## Module Design

**Exports:**
- Single default export for React components: `export default function App()`
- Named exports for utilities and types: `export function formatUSD()`, `export type KanbanStory = ...`
- All types use named exports

**Server-only modules:**
- Files ending in `.server.ts` contain only server code
- No top-level Node.js imports in `.tsx` files

**Type organization:**
- Type definitions live in `app/types/` directory
- Constants (like `KANBAN_COLUMNS`) exported from type files
- Factory functions (like `createEmptyKanbanState()`) in type files for complex setup

## Conditional Rendering

**Pattern:** Ternary for binary choices, logical && for optional rendering

**Examples:**
```typescript
// Binary - use ternary
{isDragOver ? "border-blue-500" : "border-gray-700"}

// Optional - use logical &&
{searchQuery && (
  <button onClick={() => setSearchQuery("")}>✕</button>
)}
```

## Array/Object Operations

**Patterns:**
- `.map()` for iteration with keys in lists
- `.filter()` for filtering with memoization via `useMemo()`
- Spread operator for immutable updates: `[...stories].sort()`
- Destructuring for object access in handler parameters

**Example (immutable update):**
```typescript
const sortedStories = [...stories].sort((a, b) => a.order - b.order);
```

## Accessibility

**Patterns:**
- `title` attributes on buttons and links for hover tooltips
- `role` attributes used with testing tools (e.g., `getByRole('link')`)
- `onClick` handlers include `e.stopPropagation()` to prevent bubbling
- Semantic HTML (buttons vs divs, links for navigation)

---

*Convention analysis: 2026-01-25*
