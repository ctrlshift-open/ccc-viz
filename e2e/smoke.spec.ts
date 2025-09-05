import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

test('navigate projects → sessions → session details', async ({ page }) => {
  const base = path.join(homedir(), '.claude', 'projects');
  const project = 'ccviz-e2e Project';
  const session = 'smoke (alpha+beta) #1';
  const projDir = path.join(base, project);
  const file = path.join(projDir, `${session}.jsonl`);

  // Arrange: seed minimal data
  mkdirSync(projDir, { recursive: true });
  writeFileSync(file, [
    JSON.stringify({ type: 'assistant', message: { type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Hello' }], usage: { input_tokens: 1, output_tokens: 2 }, model: 'test-model' }, timestamp: '2025-01-01T00:00:00Z' }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'Hi' }, timestamp: '2025-01-01T00:01:00Z' }),
    ''
  ].join('\n'));

  // Act: navigate
  await page.goto('/');
  await page.getByRole('link', { name: project }).click();
  await page.getByRole('link', { name: session }).click();

  // Assert: session details visible
  await expect(page.getByRole('heading', { name: 'Session Details' })).toBeVisible();
  await expect(page.getByRole('link', { name: '← Back to sessions' })).toBeVisible();

  // Cleanup
  rmSync(file, { force: true });
  // leave project dir in place to avoid removing other user data
});

