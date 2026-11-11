import { defineConfig, devices } from '@playwright/test';
import { apiEnv } from './e2e/env.ts';

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'caddy-smoke.spec.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter api start',
      url: 'http://localhost:3333/api/health',
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter site dev',
      url: 'http://localhost:4321/app/login',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
