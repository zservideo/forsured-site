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

// Headlines in Roboto Serif and everything else in Inter, as in the app; Chakra Petch is the wordmark.
const FONTS = ['Inter', 'Roboto Serif', 'Chakra Petch'];

async function ready(page, url, fonts = FONTS) {
  await open(page, url, { reveal: true, freeze: true });
  await loadImages(page);
  // A missing web font would make the shots differ; fail with a clear message instead.
  const faces = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts];
    return {
      loaded: [...new Set(faces.filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))],
      failed: faces.filter((f) => f.status === 'error').map((f) => `${f.family} ${f.weight}`),
    };
  });
  expect(faces.failed, 'no brand font failed to download').toEqual([]);
  expect(faces.loaded, 'brand web fonts loaded from Google Fonts').toEqual(expect.arrayContaining(fonts));
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
    ['hero', '.hero'],
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

// One fixed post stands in for the shared post template. The blog index is left out on purpose:
// it changes with every new post, which would mean new baselines every day.
test.describe('blog post', () => {
  test('first screen', async ({ page }) => {
    await ready(page, '/blog/compliance-isnt-coverage/');
    await expect(page).toHaveScreenshot('blog-post-first-screen.png');
  });

  test('sources, call to action and footer', async ({ page }) => {
    await ready(page, '/blog/compliance-isnt-coverage/');
    await page.addStyleTag({ content: 'nav, .more { visibility: hidden !important; }' });
    await expect(page.locator('.band')).toHaveScreenshot('blog-post-cta.png');
  });

  test('newsletter signup', async ({ page }) => {
    test.skip(!require('../tools/blog/build.js').NEWSLETTER, 'paused: NEWSLETTER is false in tools/blog/build.js');
    await ready(page, '/blog/compliance-isnt-coverage/');
    await page.addStyleTag({ content: 'nav { visibility: hidden !important; }' });
    await expect(page.locator('[data-sub]')).toHaveScreenshot('blog-post-newsletter.png');
  });
});
