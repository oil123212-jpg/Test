import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests', testIgnore: process.env.WEB_SERVER_TARGET === 'realtime' ? [] : ['**/realtime.spec.ts'], testMatch: '**/*.spec.ts', timeout: 25000, fullyParallel: true, workers: 2,
  use: {
    baseURL: `http://127.0.0.1:4173${process.env.PLAYWRIGHT_BASE_PATH || '/'}`, trace: 'retain-on-failure',
    launchOptions: {
      ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
      args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1440, height: 1100 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: process.env.WEB_SERVER_TARGET === 'realtime' ? 'npm run build && node scripts/e2e-realtime-server.mjs' : process.env.WEB_SERVER_TARGET === 'railway' ? 'npm run build && npm start' : 'npm run build && npm run preview', env: { PORT: '4173' }, port: 4173, reuseExistingServer: false, timeout: 30000 },
});
