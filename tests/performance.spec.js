// Page weight and loading stability. Budgets leave headroom over today's numbers and exist to
// catch a heavy image or a layout jump slipping in, not to chase every kilobyte.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, BROWSER_PAGES, open, read } = require('./helpers');

// Bytes served from forsured.ai on first load, before any scrolling (fonts not counted).
// Blog posts share one budget: text, one share image on the index, no other images.
const LOAD_BUDGET = { home: 650 * 1024, 'field guide': 2.6 * 1024 * 1024, 'builtworlds field guide': 2.6 * 1024 * 1024, blog: 250 * 1024, post: 150 * 1024, 'coi requirements': 150 * 1024, state: 150 * 1024 };
const HTML_BUDGET = 200 * 1024;
const IMAGE_BUDGET = 450 * 1024;
const PDF_BUDGET = 3 * 1024 * 1024;

for (const p of BROWSER_PAGES) {
  test.describe(`${p.name} performance`, () => {
    test('first load stays within the page-weight budget', async ({ page }) => {
      const bytes = [];
      page.on('response', async (r) => {
        if (!r.url().startsWith('http://localhost')) return;
        try { bytes.push([r.url(), (await r.body()).length]); } catch (e) { /* redirects have no body */ }
      });
      await open(page, p.url);
      await page.waitForLoadState('load');
      await page.waitForTimeout(1000);
      const total = bytes.reduce((sum, [, b]) => sum + b, 0);
      const detail = bytes.sort((a, b) => b[1] - a[1]).map(([u, b]) => `${Math.round(b / 1024)}KB ${new URL(u).pathname}`).join(', ');
      expect(total, `loaded ${Math.round(total / 1024)}KB: ${detail}`).toBeLessThanOrEqual(LOAD_BUDGET[p.post ? 'post' : p.state ? 'state' : p.name]);
    });

    test('layout does not jump while the page loads', async ({ page }) => {
      await page.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await open(page, p.url);
      await page.waitForLoadState('load');
      await page.waitForTimeout(1000);
      // Google's "good" Cumulative Layout Shift threshold is 0.1.
      expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
    });
  });
}

test('files stay small', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'source check runs once');
  const kb = (n) => `${Math.round(n / 1024)}KB`;
  for (const p of PAGES) {
    const file = path.join(ROOT, p.file);
    const size = fs.statSync(file).size;
    expect(size, `${p.file} is ${kb(size)}`).toBeLessThanOrEqual(HTML_BUDGET);
    const html = read(p.file);
    const dir = path.dirname(file);
    const refs = [
      ...[...html.matchAll(/(?:src|href)="([^"#:?]+\.(?:png|jpe?g|webp|svg|gif|pdf))"/g)].map((m) => m[1]),
      ...[...html.matchAll(/srcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(' ')[0])),
    ];
    for (const ref of new Set(refs)) {
      const f = path.join(ref.startsWith('/') ? ROOT : dir, ref);
      const s = fs.statSync(f).size;
      expect(s, `${ref} is ${kb(s)}`).toBeLessThanOrEqual(ref.endsWith('.pdf') ? PDF_BUDGET : IMAGE_BUDGET);
    }
  }
});
