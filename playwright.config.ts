import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    port: 5174,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

