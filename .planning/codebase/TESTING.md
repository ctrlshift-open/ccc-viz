# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**
- Vitest 2.1.1
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in expect API

**E2E Testing:**
- Playwright 1.48.2
- Config: `playwright.config.ts`

**Run Commands:**
```bash
pnpm test              # Run unit tests with Vitest
pnpm e2e               # Run E2E tests with Playwright (headless)
pnpm e2e:headed        # Run E2E tests with visible browser
```

## Test File Organization

**Location:**
- Unit/integration tests: `app/__tests__/` directory
- E2E tests: `e2e/` directory at project root

**Naming:**
- Unit tests: `{name}.test.ts` or `{name}.test.tsx`
- E2E tests: `{name}.spec.ts`

**Structure:**
```
app/__tests__/
├── format.test.ts          # Utility function tests
└── routes-no-node-imports.test.ts  # Linting/validation tests
e2e/
├── smoke.spec.ts
└── sort-asc.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from "vitest";

describe("formatUSD", () => {
  it("formats positive numbers with two decimals and separators", () => {
    expect(formatUSD(1234.567)).toBe("$1,234.57");
  });

  it("handles large numbers", () => {
    expect(formatUSD(9876543.21)).toBe("$9,876,543.21");
  });

  it("returns em dash for null/undefined/non-finite", () => {
    expect(formatUSD(undefined)).toBe("—");
    expect(formatUSD(NaN)).toBe("—");
  });
});
```

**Patterns:**
- `describe()` for grouping related tests
- `it()` for individual test cases (not `test()`)
- Descriptive test names in English sentences
- Single assertion or related set per test is preferred
- Setup/teardown: Playwright fixtures handle setup, Vitest uses inline setup

## E2E Testing Patterns

**E2E Test Structure:**
```typescript
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

test('session details supports asc sort without errors', async ({ page }) => {
  const base = path.join(homedir(), '.claude', 'projects');
  const project = 'ccviz-e2e Test Project';
  const session = 'test session #1';
  const projDir = path.join(base, project);
  const file = path.join(projDir, `${session}.jsonl`);

  // Arrange: seed minimal data
  mkdirSync(projDir, { recursive: true });
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'test' }, timestamp: '2025-01-01T00:00:00Z' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'response' }] }, timestamp: '2025-01-01T00:00:05Z' }),
    ''
  ].join('\n'));

  // Act: navigate
  await page.goto('/');
  await page.getByRole('link', { name: project }).click();
  await page.getByRole('link', { name: session }).click();

  // Assert: verify state
  await expect(page.getByRole('heading', { name: 'Session Details' })).toBeVisible();

  // Cleanup
  rmSync(file, { force: true });
});
```

**Test Organization:**
- Arrange-Act-Assert pattern (comments included)
- File system setup/teardown within test (temp data in `~/.claude/projects`)
- Navigation testing through actual page clicks
- Assertions use Playwright's getByRole for accessibility-first selection

## Playwright Configuration

**Config Location:** `playwright.config.ts`

**Settings:**
- Test directory: `./e2e`
- Timeout: 30 seconds per test
- Base URL: `http://localhost:5174`
- Trace: `on-first-retry` (capture trace for failed tests)
- Web server: automatically starts `pnpm dev` on port 5174
- Reuse existing server if available

## Unit Testing Patterns

**Format Utility Tests (app/__tests__/format.test.ts):**
- Test edge cases: `null`, `undefined`, `NaN`, `Infinity`
- Test positive numbers with thousands separator
- Test large numbers
- Emoji rendering for message types

**Validation Tests (app/__tests__/routes-no-node-imports.test.ts):**
- Scan all `.tsx` route files for violations
- Enforce no top-level `node:*` imports in route files
- Enforce no bare `fs`, `path`, `os` imports in route files
- Report offenders with full file paths
- Use file system operations to validate build constraints

```typescript
describe("route modules avoid Node built-ins at top-level (tsx)", () => {
  const routesDir = path.join(process.cwd(), "app", "routes");
  const files = walk(routesDir).filter((f) => /\.tsx$/.test(f));

  it("no top-level node: protocol imports in .tsx routes", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/^import\s+[^;]+from\s+["']node:[^"']+["']/m.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
```

## Mocking

**Framework:** Vitest's `vi` (imported from "vitest")

**What to Mock:**
- File system operations are NOT mocked - actual temp files used in E2E
- External APIs/services would be mocked if present
- Third-party library calls (not observed in codebase yet)

**What NOT to Mock:**
- File system operations in E2E tests (use real temp files)
- HTTP requests in E2E tests (real localhost server)
- React Router's loading/action mechanisms

## Fixtures and Factories

**Test Data:**
- E2E tests create real JSONL files with seed data
- Session format: newline-delimited JSON objects with `type`, `message`, `timestamp`
- Example seed data:
```typescript
JSON.stringify({
  type: 'assistant',
  message: {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello' }],
    usage: { input_tokens: 1, output_tokens: 2 },
    model: 'test-model'
  },
  timestamp: '2025-01-01T00:00:00Z'
})
```

**Location:**
- Inline in test files - no shared fixture files
- Each test creates its own temporary data in `~/.claude/projects/`

## Coverage

**Requirements:** Not enforced

**View Coverage:** Not configured

**Observed coverage:**
- Unit tests cover utility functions (formatting, validation)
- E2E tests cover critical navigation flows (projects → sessions → details)
- Server-side parsers (JSONL reading, file operations) tested through E2E

## Test Types

**Unit Tests:**
- Scope: Utility functions (`formatUSD`, `costColorHex`)
- Approach: Pure function testing with known inputs/outputs
- Located in: `app/__tests__/`
- Examples: `format.test.ts` (10+ test cases)

**Validation Tests:**
- Scope: Compile-time constraints (no Node imports in client bundles)
- Approach: Static analysis of source files
- Located in: `app/__tests__/`
- Examples: `routes-no-node-imports.test.ts`

**E2E Tests:**
- Scope: Full application workflows
- Approach: Real browser navigation, file system setup/teardown
- Located in: `e2e/`
- Examples: `smoke.spec.ts`, `sort-asc.spec.ts`
- Coverage: Project listing → Session listing → Session detail view

## Common Patterns

**Async Testing (E2E):**
```typescript
test('navigate projects → sessions → session details', async ({ page }) => {
  // All interactions awaited
  await page.goto('/');
  await page.getByRole('link', { name: project }).click();
  await expect(page.getByRole('heading', { name: 'Session Details' })).toBeVisible();
});
```

**Edge Case Testing:**
```typescript
it("returns em dash for null/undefined/non-finite", () => {
  expect(formatUSD(undefined)).toBe("—");
  expect(formatUSD(null as unknown as number)).toBe("—");
  expect(formatUSD(NaN)).toBe("—");
  expect(formatUSD(Infinity)).toBe("—");
});
```

**Cleanup Pattern:**
```typescript
// At end of E2E test
rmSync(file, { force: true });
// Leave parent dir to avoid removing other user data
```

**Accessibility-First Selection:**
- Use `getByRole()` instead of selectors
- Example: `page.getByRole('link', { name: 'Back to sessions' })`
- Example: `page.getByRole('heading', { name: 'Session Details' })`

## Test Data Seeding

**E2E File Format:**
Files are JSONL (newline-delimited JSON) stored in `~/.claude/projects/{project-name}/{session-name}.jsonl`

**Minimal Valid Session:**
```jsonl
{"type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2025-01-01T00:00:00Z"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi"}]},"timestamp":"2025-01-01T00:00:05Z"}
```

**Message Types in Tests:**
- `user`: Human messages with `role: 'user'`, `content: string | array`
- `assistant`: Claude responses with `role: 'assistant'`, `content: array`, `usage: {input_tokens, output_tokens}`
- `summary`: Session summary entries
- Can include `model` field for tracking which model was used

---

*Testing analysis: 2026-01-26*
