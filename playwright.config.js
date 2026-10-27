const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // Visual baselines live in tests/__screenshots__/<project>/ and are shared by every OS.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.2, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: 'node tests/server.js',
    url: `http://localhost:${PORT}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // Everything except the viewport sweep runs on a desktop and a phone.
    { name: 'desktop', testIgnore: /responsive\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testIgnore: /responsive\.spec/, use: { ...devices['Pixel 7'] } },
    // The viewport sweep sets its own sizes, from a 320px phone to a 1920px monitor.
    { name: 'responsive', testMatch: /responsive\.spec/, use: { ...devices['Desktop Chrome'] } },
  ],
});
