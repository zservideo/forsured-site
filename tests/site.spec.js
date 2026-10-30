// Functionality of the forsured.ai home page: loading, navigation, the event banner and both forms.
// Runs on the desktop and mobile projects. Form backends are stubbed (see helpers.js).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, open, read } = require('./helpers');

const HTML = read('index.html');

test('loads without JavaScript errors', async ({ page }) => {
  const { errors } = await open(page);
  await page.waitForLoadState('load');
  expect(errors).toEqual([]);
  await expect(page).toHaveTitle(/Forsured/);
});

test('has no horizontal scroll', async ({ page }) => {
  await open(page);
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
});

test('hero carries the current headline and CTA', async ({ page }) => {
  await open(page);
  await expect(page.locator('h1')).toHaveText('Catch the gap before it’s a jobsite problem.');
  await expect(page.locator('.hero .cta-p')).toHaveText(/Free COI Risk Check/);
  await expect(page.locator('.hero .cta-p')).toHaveAttribute('href', '#demo');
});

test('JSON-LD blocks are valid JSON', async () => {
  const blocks = [...HTML.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  expect(blocks.length).toBeGreaterThan(0);
  for (const [, json] of blocks) expect(() => JSON.parse(json)).not.toThrow();
});

test('every in-page link points at an element that exists', async ({ page }) => {
  await open(page);
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h.length > 1 && !document.getElementById(h.slice(1)))
  );
  expect(missing).toEqual([]);
});

test('email links use the forsured.ai domain', async ({ page }) => {
  await open(page);
  const mailtos = await page.locator('a[href^="mailto:"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(mailtos.length).toBeGreaterThan(0);
  for (const m of mailtos) expect(m).toMatch(/@forsured\.ai$/);
});

test('local images referenced by the page exist', async () => {
  const srcs = [...HTML.matchAll(/(?:src|href)="([^"#:]+\.(?:png|jpe?g|svg|webp))"/g)].map((m) => m[1]);
  const srcset = [...HTML.matchAll(/srcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(' ')[0]));
  for (const src of [...srcs, ...srcset]) expect(fs.existsSync(path.join(ROOT, src)), src).toBe(true);
});

test.describe('navigation', () => {
  // Clicking a section link must land the section heading below the fixed banner + nav, not under it.
  for (const target of ['platform', 'how', 'gc', 'brokers', 'why', 'demo']) {
    test(`#${target} link scrolls the section into view below the nav`, async ({ page, isMobile }) => {
      await open(page, '/', { reveal: true });
      if (isMobile) {
        await page.locator('#menu-btn').click();
        await expect(page.locator('#mm')).toBeVisible();
        await page.locator(`#mm a[href="#${target}"]`).first().click();
        await expect(page.locator('#mm')).toBeHidden();
      } else if (await page.locator(`#nav .nlinks a[href="#${target}"]`).count()) {
        await page.locator(`#nav .nlinks a[href="#${target}"]`).click();
      } else {
        await page.locator(`#nav a[href="#${target}"]`).first().click();
      }
      // Wait for the smooth scroll to finish: two reads 250ms apart that match.
      let last = -1;
      await expect
        .poll(async () => { const y = await page.evaluate(() => window.scrollY); const done = y === last && y > 200; last = y; return done; }, { intervals: [250] })
        .toBe(true);
      const navBottom = (await page.locator('#nav').boundingBox()).y + (await page.locator('#nav').boundingBox()).height;
      const top = await page.locator(`#${target}`).evaluate((el) => el.getBoundingClientRect().top);
      expect(top, 'section top sits below the fixed nav').toBeGreaterThanOrEqual(navBottom - 1);
      expect(top, 'section top is near the top of the screen').toBeLessThan(navBottom + 120);
    });
  }

  test('logo links to the home page', async ({ page }) => {
    await open(page);
    await expect(page.locator('#nav .nlogo')).toHaveAttribute('href', '/');
  });

  test('mobile menu opens, locks scrolling and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'hamburger menu only shows on small screens');
    await open(page);
    const btn = page.locator('#menu-btn');
    await expect(btn).toBeVisible();
    await expect(page.locator('#nav .nlinks')).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mm a')).toHaveCount(7);
    for (const link of await page.locator('#mm a').all()) await expect(link).toBeInViewport();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#mm')).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('desktop nav shows every section link', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop only');
    await open(page);
    await expect(page.locator('#menu-btn')).toBeHidden();
    for (const link of await page.locator('#nav .nlinks a').all()) await expect(link).toBeVisible();
    await expect(page.locator('#nav .nr .cta-p')).toHaveText(/Free COI Risk Check/);
  });
});

for (const form of [
  { name: 'free COI risk check', prefix: 'wl', button: '#wl-btn', success: '#ss', err: '#form-err' },
  { name: 'waitlist', prefix: 'oh', button: '#oh-btn', success: '#oh-success', err: '#oh-err' },
]) {
  test.describe(`${form.name} form`, () => {
    test('blocks empty submissions', async ({ page }) => {
      const { posts } = await open(page);
      await page.locator(form.button).scrollIntoViewIfNeeded();
      await page.locator(form.button).click();
      await expect(page.locator(form.err)).toBeVisible();
      expect(posts).toEqual([]);
    });

    test('rejects a malformed email', async ({ page }) => {
      const { posts } = await open(page);
      await page.fill(`#${form.prefix}-name`, 'Test Person');
      await page.fill(`#${form.prefix}-email`, 'test.example.com');
      await page.selectOption(`#${form.prefix}-role`, 'Insurance Broker');
      await page.locator(form.button).scrollIntoViewIfNeeded();
      await page.locator(form.button).click();
      await expect(page.locator(form.err)).toBeVisible();
      await expect(page.locator(`#${form.prefix}-email`)).toBeFocused();
      expect(posts).toEqual([]);
    });

    test('submits and shows success', async ({ page }) => {
      const { posts } = await open(page);
      await page.fill(`#${form.prefix}-name`, 'Test Person');
      await page.fill(`#${form.prefix}-email`, 'test@example.com');
      await page.fill(`#${form.prefix}-company`, 'Test Co');
      // Form routing in Web3Forms and the Make scenario keys on these option values; keep them stable.
      await page.selectOption(`#${form.prefix}-role`, 'Subcontractor');
      await page.locator(form.button).scrollIntoViewIfNeeded();
      await page.locator(form.button).click();
      await expect(page.locator(form.success)).toBeVisible();
      expect(posts.map((p) => new URL(p.url).host).sort()).toEqual(['api.web3forms.com', 'hook.us2.make.com']);
      const make = JSON.parse(posts.find((p) => p.url.includes('make.com')).body);
      expect(make).toMatchObject({ name: 'Test Person', email: 'test@example.com', role: 'Subcontractor' });
    });

    test('keeps the role values the backends route on', async ({ page }) => {
      await open(page);
      const values = await page.locator(`#${form.prefix}-role option`).evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
      expect(values).toEqual(expect.arrayContaining(['General Contractor / Construction Manager', 'Insurance Broker', 'Subcontractor']));
    });
  });
}

test('risk check form recovers when the backend fails', async ({ page }) => {
  await open(page, '/', { formOk: false });
  await page.fill('#wl-name', 'Test Person');
  await page.fill('#wl-email', 'test@example.com');
  await page.selectOption('#wl-role', 'Insurance Broker');
  await page.locator('#wl-btn').scrollIntoViewIfNeeded();
  await page.locator('#wl-btn').click();
  await expect(page.locator('#form-err')).toHaveText(/Something went wrong/);
  await expect(page.locator('#wl-btn')).toBeEnabled();
  await expect(page.locator('#wl-btn')).toHaveText(/Free Risk Check/);
});

test('trade contractor CTA preselects the role in the risk check form', async ({ page }) => {
  await open(page, '/', { reveal: true });
  await page.locator('a[data-preselect-role]').first().click();
  await expect(page.locator('#wl-role')).toHaveValue('Subcontractor');
});

test.describe('Event banner', () => {
  test('shows the announcement above the nav without covering it', async ({ page }) => {
    await open(page);
    const bar = page.locator('#irmi-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveText(/We're a BuiltWorlds Demo Day finalist/);
    const cta = bar.getByRole('link', { name: /Get the Boston field guide/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', 'builtworlds-field-guide/');
    const barBox = await bar.boundingBox();
    const navBox = await page.locator('#nav').boundingBox();
    expect(barBox.y).toBe(0);
    expect(navBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
    // Content fits inside the bar at every viewport.
    expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });

  test('keeps the nav and hero clear after scrolling', async ({ page }) => {
    await open(page);
    const h1 = await page.locator('h1').boundingBox();
    const navBox = await page.locator('#nav').boundingBox();
    expect(h1.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);
    await page.mouse.wheel(0, 1500);
    await expect(page.locator('#irmi-bar')).toBeInViewport();
    expect((await page.locator('#nav').boundingBox()).y).toBeGreaterThan(0);
  });

  test('field guide CTA opens the guide', async ({ page }) => {
    await open(page);
    await page.locator('#irmi-bar .ib-cta').click();
    await expect(page).toHaveURL(/\/builtworlds-field-guide\/$/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('can be dismissed and stays dismissed on reload', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Dismiss announcement' }).click();
    await expect(page.locator('#irmi-bar')).toBeHidden();
    expect((await page.locator('#nav').boundingBox()).y).toBe(0);
    await page.reload();
    await expect(page.locator('#irmi-bar')).toBeHidden();
  });
});
