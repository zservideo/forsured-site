// The test setup itself: CI must run the same Playwright version the suite was written for,
// or screenshots and browser behavior drift without anyone changing the site.
const { test, expect } = require('@playwright/test');
const { read } = require('./helpers');

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'source checks run once');
});

test('CI uses the Playwright image that matches the installed Playwright', async () => {
  const installed = require('@playwright/test/package.json').version;
  for (const workflow of ['test.yml', 'update-visual-baselines.yml']) {
    const images = [...read(`.github/workflows/${workflow}`).matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]);
    expect(images.length, `${workflow} runs in the Playwright image`).toBeGreaterThan(0);
    for (const v of images) expect(v, `${workflow} image tag`).toBe(installed);
  }
});
