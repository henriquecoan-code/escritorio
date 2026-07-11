const { defineConfig } = require('@playwright/test');
const systemChromePath = process.env.PW_CHROME_PATH;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    launchOptions: systemChromePath ? { executablePath: systemChromePath } : {},
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:8000/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
