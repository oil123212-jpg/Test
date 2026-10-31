import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const result = spawnSync(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE_PATH: '/Test/', PLAYWRIGHT_BASE_PATH: '/Test/' },
});
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
