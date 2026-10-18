const { defineConfig } = require('@playwright/test');
const systemChromePath = process.env.PW_CHROME_PATH;
// Porta própria dos testes, para não reaproveitar outro projeto servido na 8000.
const testPort = Number(process.env.TEST_PORT || 8123);

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || `http://localhost:${testPort}`,
    launchOptions: systemChromePath ? { executablePath: systemChromePath } : {},
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run serve',
    env: { PORT: String(testPort) },
    url: `http://localhost:${testPort}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
