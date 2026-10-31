import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests', timeout: 25000, fullyParallel: true, workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure',
    launchOptions: {
      ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
      args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1440, height: 1100 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: false, timeout: 30000 },
});
