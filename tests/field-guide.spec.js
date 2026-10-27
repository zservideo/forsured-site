// Tests for the IRMI field guide page (/irmi-field-guide/) and its short-URL redirect.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const GUIDE = 'file://' + path.join(ROOT, 'irmi-field-guide', 'index.html');
const PAGES = 7;

async function open(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:\/\//, (route) => route.abort());
  await page.goto(GUIDE);
  return { errors };
}

test('loads without JavaScript errors or horizontal scroll', async ({ page }) => {
  const { errors } = await open(page);
  expect(errors).toEqual([]);
  await expect(page).toHaveTitle(/IRMI CRC 2026 Field Guide/);
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
});

test('offers the PDF for download', async ({ page }) => {
  await open(page);
  const dl = page.locator('#dl');
  await expect(dl).toBeVisible();
  const href = await dl.getAttribute('href');
  expect(await dl.getAttribute('download')).not.toBeNull();
  const file = path.join(ROOT, 'irmi-field-guide', href);
  expect(fs.existsSync(file)).toBe(true);
  expect(fs.readFileSync(file).subarray(0, 5).toString()).toBe('%PDF-');
});

test('shows every page of the guide as a loaded, readable image', async ({ page }) => {
  await open(page);
  const imgs = page.locator('.pg img');
  await expect(imgs).toHaveCount(PAGES);
  for (let i = 0; i < PAGES; i++) {
    const img = imgs.nth(i);
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute('alt', new RegExp(`^Page ${i + 1}: `));
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    const box = await img.boundingBox();
    const vw = page.viewportSize().width;
    // Pages fill the column: nearly full width on phones, capped at 860px on desktop.
    expect(box.width).toBeGreaterThanOrEqual(Math.min(840, vw - 40));
    expect(box.width).toBeLessThanOrEqual(vw);
  }
});

test('page index links resolve and every referenced file exists', async ({ page }) => {
  await open(page);
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => !document.getElementById(h.slice(1)))
  );
  expect(missing).toEqual([]);
  const html = fs.readFileSync(path.join(ROOT, 'irmi-field-guide', 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(pages\/[^"]+|[^"/:#]+\.pdf)"/g)].map((m) => m[1]);
  const srcset = [...html.matchAll(/srcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(' ')[0]));
  for (const ref of [...refs, ...srcset]) expect(fs.existsSync(path.join(ROOT, 'irmi-field-guide', ref)), ref).toBe(true);
});

test('links back to the site and the free COI risk check', async ({ page }) => {
  await open(page);
  await expect(page.locator('nav .nlogo')).toHaveAttribute('href', '../');
  await expect(page.getByRole('link', { name: /Free COI Risk Check/ }).first()).toHaveAttribute('href', '../#demo');
  await expect(page.locator('a[href="mailto:hello@forsured.ai"]')).toHaveCount(1);
  await expect(page.locator('footer')).toContainText('Not affiliated with or endorsed by IRMI');
});

test('copy follows the contractor / project requirements wording', async ({ page }) => {
  await open(page);
  const text = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  expect(text).not.toMatch(/\bsubcontractors?\b|\bsubs\b|\bsub COIs?\b|\bGC requirements\b/i);
});

test('the no-hyphen URL redirects to the field guide', async ({ page }) => {
  await page.route(/^https?:\/\//, (route) => route.abort());
  await page.goto('file://' + path.join(ROOT, 'irmifieldguide', 'index.html'));
  await page.waitForURL(/irmi-field-guide\/$/);
});
