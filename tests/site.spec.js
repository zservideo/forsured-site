// Smoke and copy tests for the forsured.ai single-page site.
// The page is loaded from disk and every outside request is stubbed, so tests
// never hit Web3Forms or the Make webhook with real submissions.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

async function open(page, { formOk = true } = {}) {
  const errors = [];
  const posts = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    if (url.includes('api.web3forms.com') || url.includes('hook.us2.make.com')) {
      posts.push({ url, body: route.request().postData() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: formOk }) });
    }
    return route.abort();
  });
  await page.goto(PAGE);
  return { errors, posts };
}

// Visible copy only: strips scripts/styles and the customer quote, which is left verbatim.
async function visibleCopy(page) {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,blockquote').forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, ' ');
  });
}

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
  await expect(page.locator('h1')).toHaveText("Catch the gap before it's a jobsite problem.");
  await expect(page.locator('.hero .cta-p')).toHaveText(/Free COI Risk Check/);
  await expect(page.locator('.hero .cta-p')).toHaveAttribute('href', '#demo');
});

test('copy follows the contractor / project requirements wording', async ({ page }) => {
  await open(page);
  const text = await visibleCopy(page);
  for (const banned of [/\bsubcontractors?\b/i, /\bsubs\b/i, /\bsub COIs?\b/i, /\bGC requirements\b/i]) {
    expect(text, `visible copy should not contain ${banned}`).not.toMatch(banned);
  }
  for (const attr of ['description', 'og:description', 'twitter:description']) {
    const content = await page.locator(`meta[name="${attr}"], meta[property="${attr}"]`).first().getAttribute('content');
    expect(content).not.toMatch(/subcontractor/i);
  }
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
  for (const src of srcs) expect(fs.existsSync(path.resolve(__dirname, '..', src)), src).toBe(true);
});

for (const form of [
  { name: 'free COI risk check', prefix: 'wl', button: '#wl-btn', success: '#ss' },
  { name: 'waitlist', prefix: 'oh', button: '#oh-btn', success: '#oh-success' },
]) {
  test(`${form.name} form blocks empty submissions`, async ({ page }) => {
    const { posts } = await open(page);
    await page.locator(form.button).scrollIntoViewIfNeeded();
    await page.locator(form.button).click();
    await expect(page.locator(`#${form.prefix === 'wl' ? 'form-err' : 'oh-err'}`)).toBeVisible();
    expect(posts).toEqual([]);
  });

  test(`${form.name} form submits and shows success`, async ({ page }) => {
    const { posts } = await open(page);
    await page.fill(`#${form.prefix}-name`, 'Test Person');
    await page.fill(`#${form.prefix}-email`, 'test@example.com');
    await page.fill(`#${form.prefix}-company`, 'Test Co');
    await page.selectOption(`#${form.prefix}-role`, 'Subcontractor');
    await page.locator(form.button).scrollIntoViewIfNeeded();
    await page.locator(form.button).click();
    await expect(page.locator(form.success)).toBeVisible();
    expect(posts.map((p) => new URL(p.url).host).sort()).toEqual(['api.web3forms.com', 'hook.us2.make.com']);
    const make = JSON.parse(posts.find((p) => p.url.includes('make.com')).body);
    expect(make).toMatchObject({ name: 'Test Person', email: 'test@example.com', role: 'Subcontractor' });
  });
}

test('risk check form recovers when the backend fails', async ({ page }) => {
  await open(page, { formOk: false });
  await page.fill('#wl-name', 'Test Person');
  await page.fill('#wl-email', 'test@example.com');
  await page.selectOption('#wl-role', 'Insurance Broker');
  await page.locator('#wl-btn').scrollIntoViewIfNeeded();
  await page.locator('#wl-btn').click();
  await expect(page.locator('#form-err')).toHaveText(/Something went wrong/);
  await expect(page.locator('#wl-btn')).toBeEnabled();
  await expect(page.locator('#wl-btn')).toHaveText(/Free Risk Check/);
});
