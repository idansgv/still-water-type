// Site checks. Needs @playwright/test (installed globally) and Google Chrome; the dev server is started for you.
//   NODE_PATH=$(npm root -g) npx playwright test -c tools/tests
// Point at another build with BASE_URL=https://... (the server is then not started).
const { defineConfig } = require('@playwright/test');
const base = process.env.BASE_URL || 'http://127.0.0.1:8910';
module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.cjs',
  timeout: 90000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: base, channel: 'chrome', headless: true, launchOptions: { args: ['--enable-unsafe-swiftshader', '--js-flags=--expose-gc'] } },
  webServer: process.env.BASE_URL ? undefined : { command: 'python3 tools/dev.py 8910', url: base, reuseExistingServer: true, cwd: '../..' },
});
