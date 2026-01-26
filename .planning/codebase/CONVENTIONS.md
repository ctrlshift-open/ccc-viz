# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `KanbanBoard.tsx`, `MessageTypeIcon.tsx`)
- Server modules: camelCase with `.server` suffix (e.g., `sessions.server.ts`, `kanban.server.ts`)
- Utilities: camelCase (e.g., `format.ts`, `file-tail.server.ts`)
- Route files: kebab-case with dynamic segment prefixes using `$` (e.g., `$project.sessions._index.tsx`)

**Functions:**
- Exported functions: camelCase (e.g., `getProjects()`, `formatUSD()`, `getSessionPreview()`)
- React components: PascalCase (e.g., `KanbanBoard()`, `MessageTypeIcon()`)
- Internal/private helpers: camelCase with descriptive names

**Variables:**
- Constants with INTENT: CONSTANT_CASE (e.g., `KANBAN_COLUMNS`, `KANBAN_LABELS`, `COST_GRADIENT`)
- Local variables: camelCase (e.g., `mostRecentTime`, `filteredStories`, `isDragOver`)
- Booleans: prefix with `is` or `has` (e.g., `isDragOver`, `isSyncing`, `isHaikuSession`)
- Loop indices: short names like `i`, `index` acceptable in iteration

**Types:**
- Type aliases: PascalCase with `Type` suffix or descriptive noun (e.g., `SessionPreview`, `KanbanStory`, `KanbanStatus`, `CostScope`)
- Record/map objects: describe the key-value relationship (e.g., `Record<string, SessionPreview | null>`)
- Type discriminated unions used for error handling (e.g., `{ ok: true; value } | { ok: false; value }`)

## Code Style

**Formatting:**
- No ESLint or Prettier config detected
- Manual formatting observed with 2-space indentation
- Double quotes for strings (e.g., `"utf8"`, `"project"`)
- Arrow functions preferred (e.g., `const formatUSD = (amount) => { ... }`)
- JSDoc comments used for public functions and types

**Linting:**
- TypeScript strict mode enabled (`"strict": true` in tsconfig.json)
- Type checking enforced via React Router's `tsc` command
- No TypeScript suppressions (`@ts-ignore`) found in codebase

## Import Organization

**Order:**
1. Node.js imports (`node:fs`, `node:path`, `node:os`)
2. Third-party packages (`react`, `react-router`, `lucide-react`, `nanoid`)
3. Type imports (`import type { ... }`)
4. Local app imports using path aliases (`~/utils/`, `~/components/`, `~/types/`)
5. `.server` module imports within server contexts only

**Path Aliases:**
- `~/` maps to `./app/` directory
- Used consistently across all files for relative imports within app

**Server Module Imports (Critical):**
- Node.js modules (`node:*`) MUST be dynamically imported inside `loader()` or `action()` functions
- Top-level imports of Node.js modules in `.tsx` route files cause "externalized for browser compatibility" errors
- Server-only modules (`.server.ts`) can be top-level imported in other server files
- Example: `const { getKanbanState } = await import("~/utils/kanban.server");` inside loader

## Error Handling

**Patterns:**
- Try-catch blocks with silent failure when parsing JSON lines (common in JSONL file reading)
- Catch handlers usually skip invalid entries with `// Skip invalid JSON lines` comments
- Console.error() for logging failures (e.g., `console.error('Failed to get preview for session:', error)`)
- Graceful degradation: return fallback values or defaults instead of throwing
- For file operations: return empty arrays or null values on error
- For network/parsing errors: return `null` or empty record `{}`

**Specific patterns observed:**
```typescript
try {
  // risky operation
} catch (error) {
  // Skip silently or log and continue
  console.error(`Failed to read ${item}:`, error);
}
```

- Type guards for error handling: `(error as Error).message`
- Optional chaining used to avoid null errors: `message?.content?.text`
- Default values with nullish coalescing: `scale?.greenMax ?? 0.5`

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- `console.error()` for errors with context (e.g., `console.error('Failed to get preview for session', sessionId, error)`)
- Used sparingly - mostly in error paths
- Messages include context about what failed

## Comments

**When to Comment:**
- Above complex logic blocks explaining intent (e.g., "// Replace newlines with spaces")
- At top of `.server.ts` files explaining purpose
- Type comments for Record objects explaining key-value meaning
- Inline comments for non-obvious transformations

**JSDoc/TSDoc:**
- Used for exported functions in `.server.ts` modules
- Describe parameters and return types
- Mark async functions clearly
- Example:
```typescript
/**
 * Check if a session was started with haiku model
 * Returns true if the first assistant message used haiku
 */
export async function isHaikuSession(project: string, sessionId: string): Promise<boolean> {
```

## Function Design

**Size:**
- Most functions 10-40 lines
- Larger functions (50+ lines) used for complex file parsing logic with multiple try-catch blocks
- Preference for smaller utility functions that compose together

**Parameters:**
- Destructured object parameters for components (Props type interface)
- Positional parameters for pure utility functions
- Named exports for all public functions
- Rest parameters not commonly used

**Return Values:**
- Explicit return types on all exported functions
- Union types for error states: `SessionPreview | null`
- Promises explicitly typed: `Promise<KanbanState>`
- Component functions return JSX elements

## Module Design

**Exports:**
- Named exports for functions and types (not default exports)
- Type exports use `export type` syntax
- Barrel files not used - direct imports from source files

**File Scope:**
- Functions prefixed with module purpose (e.g., `getSessionPreview`, `getProjects`)
- State factory functions: `createEmptyKanbanState()`
- Each file focuses on a single responsibility

---

*Convention analysis: 2026-01-26*
