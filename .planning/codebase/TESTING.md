# Testing Patterns

**Analysis Date:** 2026-01-25

## Test Framework

**Runner:**
- Vitest 2.1.1 - configured in `vitest.config.ts`
- Config: `/Users/bryanarendt/code2/ccc-viz/vitest.config.ts`

**Assertion Library:**
- Vitest built-in expect (compatible with Jest)

**E2E Testing:**
- Playwright 1.48.2 - configured for browser testing
- E2E tests in `e2e/` directory
- Run commands: `pnpm e2e` (headless), `pnpm e2e:headed` (visible)

**Run Commands:**
```bash
pnpm test                  # Run all tests (vitest run)
pnpm e2e                   # Run Playwright E2E tests headless
pnpm e2e:headed           # Run E2E tests with visible browser
pnpm typecheck            # Generate route types and run TypeScript checks
```

## Test File Organization

**Location:**
- Unit tests: Co-located in `app/__tests__/` directory
- E2E tests: Dedicated `e2e/` directory at project root

**Naming:**
- Unit tests: `[module].test.ts` or `[module].test.tsx` pattern
- E2E tests: `[feature].spec.ts` pattern

**Current Test Files:**
- `app/__tests__/format.test.ts` - Format utility tests
- `app/__tests__/routes-no-node-imports.test.ts` - Route module validation
- `e2e/smoke.spec.ts` - Basic navigation flow
- `e2e/sort-asc.spec.ts` - Sorting functionality

## Test Structure

**Unit Test Suite Organization:**
```typescript
import { describe, it, expect } from "vitest";
import { formatUSD } from "../utils/format";

describe("formatUSD", () => {
  it("formats positive numbers with two decimals and separators", () => {
    expect(formatUSD(1234.567)).toBe("$1,234.57");
  });

  it("returns em dash for null/undefined/non-finite", () => {
    expect(formatUSD(undefined)).toBe("—");
  });
});
```

**Patterns:**
- `describe()` for test suites - one per function/feature
- `it()` for individual test cases
- Descriptive test names: "should [expected behavior]" or "[behavior] when [condition]"
- Arrange-Act-Assert pattern shown in E2E tests with comments

## E2E Test Structure

**Playwright Pattern (with Arrange-Act-Assert):**
```typescript
import { test, expect } from '@playwright/test';

test('navigate projects → sessions → session details', async ({ page }) => {
  // Arrange: seed minimal data
  mkdirSync(projDir, { recursive: true });
  writeFileSync(file, ...);

  // Act: navigate
  await page.goto('/');
  await page.getByRole('link', { name: project }).click();

  // Assert: verify state
  await expect(page.getByRole('heading', { name: 'Session Details' })).toBeVisible();

  // Cleanup
  rmSync(file, { force: true });
});
```

**Key Playwright APIs used:**
- `page.goto()` - navigate to URL
- `page.getByRole()` - accessibility-based element selection
- `expect().toBeVisible()` - assertion for element visibility
- `async ({ page })` - Playwright test context injection

## Unit Test Patterns

**Test Data - Value Objects:**
```typescript
// tests check formatUSD with various inputs
const testCases = [
  { input: 1234.567, expected: "$1,234.57" },
  { input: 0, expected: "$0.00" },
  { input: null, expected: "—" },
  { input: NaN, expected: "—" },
];

testCases.forEach(({ input, expected }) => {
  it(`formats ${input} as ${expected}`, () => {
    expect(formatUSD(input)).toBe(expected);
  });
});
```

**Import Validation Pattern:**
```typescript
// Validates routes don't have top-level Node.js imports
describe("route modules avoid Node built-ins at top-level", () => {
  const routesDir = path.join(process.cwd(), "app", "routes");
  const files = walk(routesDir).filter((f) => /\.tsx$/.test(f));

  it("no top-level node: protocol imports in .tsx routes", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/^import\s+[^;]+from\s+["']node:[^"']+["']/m.test(file))
        offenders.push(file);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
```

## Mocking

**Framework:** Vitest built-in vi module

**Not yet observed in test suite** - current tests use:
- Real file system operations (for route validation tests)
- Real Playwright browser operations (for E2E)

**What to Mock (guidance):**
- File system operations when testing business logic (use `vi.mock('node:fs')`)
- API calls when testing React components or data handling
- External services (APIs, databases)

**What NOT to Mock:**
- File system operations in E2E tests (test with real files, clean up after)
- Browser navigation and DOM in E2E tests
- Pure utility functions (format helpers, type guards)

## Test Data

**Fixtures:**
- E2E tests create minimal session data with hardcoded JSONL format
- Session fixture: JSONL lines with `type`, `message`, `timestamp` fields
- Example:
  ```javascript
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
- No shared fixtures directory yet
- Data created inline in tests and cleaned up after

## Coverage

**Requirements:** Not enforced via config

**View Coverage:**
```bash
# Not currently available - would need vitest --coverage with @vitest/coverage-v8
```

## Test Types

**Unit Tests:**
- Scope: Pure functions and utilities
- Approach: Test inputs/outputs, edge cases
- Examples: `formatUSD()`, format validation
- Location: `app/__tests__/`

**Integration Tests:**
- Scope: Not yet implemented
- Would test: Component + context, feature flows, data layers

**E2E Tests:**
- Scope: Full user workflows across pages
- Approach: Navigate UI, assert on page state
- Examples: Project → Sessions → Session details flow
- Location: `e2e/`
- Tools: Playwright with real browser

**Validation Tests:**
- Scope: Code organization rules (not functional)
- Approach: Regex scan of source files
- Examples: Route module Node.js import validation
- Location: `app/__tests__/routes-no-node-imports.test.ts`

## Common Patterns

**Edge Case Testing:**
```typescript
// Defensive programming tested
it("returns em dash for null/undefined/non-finite", () => {
  expect(formatUSD(undefined)).toBe("—");
  expect(formatUSD(null as unknown as number)).toBe("—");
  expect(formatUSD(NaN)).toBe("—");
  expect(formatUSD(Infinity)).toBe("—");
});
```

**Large Number Testing:**
```typescript
// Ensures formatting works at scale
it("handles large numbers", () => {
  expect(formatUSD(9876543.21)).toBe("$9,876,543.21");
});
```

**Accessibility Testing in E2E:**
```typescript
// Uses semantic selectors for robustness
await page.getByRole('link', { name: project }).click();
await expect(page.getByRole('heading', { name: 'Session Details' })).toBeVisible();
```

## Test Execution Context

**Vitest Config Exclusions:**
- `node_modules/**`
- `dist/**`
- `cypress/**`
- `e2e/**` (excluded from vitest, runs separately with Playwright)
- Config files themselves

**File Cleanup Strategy (E2E):**
- Tests create temporary data in `~/.claude/projects/` (user's local Claude data)
- After each test: `rmSync(file, { force: true })` removes test files
- Parent directories left in place to avoid removing user's real data

## Test Gaps & Opportunities

**Currently Not Tested:**
- React component rendering and interactions (unit)
- State management and context (unit)
- API routes and loaders/actions (integration)
- Kanban board drag-and-drop (unit/integration)
- Error scenarios in server modules (edge cases)

**Recommended Additions:**
- Component snapshot tests for Kanban board UI
- Mock-based tests for file I/O without side effects
- Integration tests for form submissions (state updates)

---

*Testing analysis: 2026-01-25*
