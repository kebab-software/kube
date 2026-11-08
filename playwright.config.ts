import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:5173', channel: process.env.CI ? undefined : 'chrome', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
