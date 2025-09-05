import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

test('session details supports asc sort without errors', async ({ page }) => {
  const base = path.join(homedir(), '.claude', 'projects');
  const project = 'ccviz-e2e Asc Project';
  const session = 'asc sort test #1';
  const projDir = path.join(base, project);
  const file = path.join(projDir, `${session}.jsonl`);

  // Arrange: seed minimal chronological data
  mkdirSync(projDir, { recursive: true });
  writeFileSync(
    file,
    [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'one' }, timestamp: '2025-01-01T00:00:00Z' }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'two' }] }, timestamp: '2025-01-01T00:00:05Z' }),
      JSON.stringify({ type: 'summary', summary: 'done', timestamp: '2025-01-01T00:00:10Z' }),
      ''
    ].join('\n')
  );

  // Navigate to project → session
  await page.goto('/');
  await page.getByRole('link', { name: project }).click();
  await page.getByRole('link', { name: session }).click();

  // Click Asc and verify it is selected, page intact
  await page.getByRole('link', { name: 'Asc' }).click();
  await expect(page.getByRole('heading', { name: 'Session Details' })).toBeVisible();
  const ascLink = page.getByRole('link', { name: 'Asc' });
  await expect(ascLink).toHaveClass(/font-semibold/);

  // Cleanup
  rmSync(file, { force: true });
});

