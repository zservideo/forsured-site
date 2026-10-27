// Visual regression: section-by-section screenshots compared with the approved baselines in
// tests/__screenshots__/<desktop|mobile>/. Any unexpected change to layout, color, type or imagery
// fails here with a side-by-side diff in the HTML report.
//
// After an intended design change, refresh the baselines:
//   npm run test:update-visual            (locally), or
//   run the "Update visual baselines" workflow on the branch in GitHub Actions
// and review the new images in the pull request before merging.
const { test, expect } = require('@playwright/test');
const { open, loadImages } = require('./helpers');

// Hide the fixed banner and nav in section shots so they do not float over the section.
const HIDE_FIXED = '#irmi-bar, #nav { visibility: hidden !important; }';

async function ready(page, url) {
  await open(page, url, { reveal: true, freeze: true });
  await loadImages(page);
  // A missing web font would make every shot differ; fail with a clear message instead.
  const fonts = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))]);
  expect(fonts, 'brand web fonts loaded from Google Fonts').toEqual(expect.arrayContaining(['Inter', 'Chakra Petch']));
  // The "how it works" steps animate on a timer; pin them to their first state.
  await page.evaluate(() => {
    document.querySelectorAll('.sg-item').forEach((s, i) => {
      s.classList.remove('step-active', 'step-done');
      if (i === 0) s.classList.add('step-active');
    });
  });
}

test.describe('home', () => {
  test('first screen', async ({ page }) => {
    await ready(page, '/');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot('home-first-screen.png');
  });

  const SECTIONS = [
    ['product-showcase', '#product'],
    ['problem', '.prob-sec'],
    ['platform', '#platform'],
    ['solutions', '#solutions'],
    ['why', '#why'],
    ['built-in-the-field', '.next-sec'],
    ['risk-check-form', '#demo'],
    ['footer', 'footer'],
  ];
  for (const [name, selector] of SECTIONS) {
    test(name, async ({ page }) => {
      await ready(page, '/');
      await page.addStyleTag({ content: HIDE_FIXED });
      await expect(page.locator(selector)).toHaveScreenshot(`home-${name}.png`);
    });
  }

  test('mobile menu open', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'hamburger menu only on phones');
    await ready(page, '/');
    await page.locator('#menu-btn').click();
    await expect(page).toHaveScreenshot('home-mobile-menu.png');
  });

  test('risk check form after a successful submit', async ({ page }) => {
    await ready(page, '/');
    await page.fill('#wl-name', 'Test Person');
    await page.fill('#wl-email', 'test@example.com');
    await page.selectOption('#wl-role', 'Insurance Broker');
    await page.locator('#wl-btn').click();
    await expect(page.locator('#ss')).toBeVisible();
    await page.addStyleTag({ content: HIDE_FIXED });
    await expect(page.locator('#demo .wl-form')).toHaveScreenshot('home-risk-check-success.png');
  });
});

test.describe('field guide', () => {
  test('first screen', async ({ page }) => {
    await ready(page, '/irmi-field-guide/');
    await expect(page).toHaveScreenshot('field-guide-first-screen.png');
  });

  test('closing call to action and footer', async ({ page }) => {
    await ready(page, '/irmi-field-guide/');
    await page.addStyleTag({ content: 'nav { visibility: hidden !important; }' });
    await expect(page.locator('.band')).toHaveScreenshot('field-guide-cta.png');
  });
});
