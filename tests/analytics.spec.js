// Google Analytics through the Google tag for GTM container GTM-P6PXX2JM. Google asks for the tag
// immediately after <head> on every page, exactly once. The generated pages get it from GTAG in
// tools/blog/build.js; the hand-written pages carry the same block. The two short-link redirect pages
// leave before anything renders, so they stay untagged: tagging them would count each visit twice.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, BROWSER_PAGES, open, read } = require('./helpers');
const { GTAG } = require('../tools/blog/build');

const ID = 'GTM-P6PXX2JM';
const SRC = `https://www.googletagmanager.com/gtm.js?id=${ID}`;
const REDIRECTS = ['irmifieldguide/index.html', 'builtworldsfieldguide/index.html'];

// Every HTML file that GitHub Pages publishes (see _config.yml), so a new page can't slip past.
const SKIP = new Set(['node_modules', 'tests', 'tools', 'content', 'test-results', 'playwright-report', '.git', '.github']);
const published = (dir = ROOT) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name.startsWith('.') || SKIP.has(d.name)) return [];
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return published(full);
    return d.name.endsWith('.html') ? [path.relative(ROOT, full).split(path.sep).join('/')] : [];
  });
// The subscriber emails under blog/email are sent by Gmail, not browsed, and email clients don't run scripts.
const WEB_PAGES = published().filter((f) => !f.startsWith('blog/email/') && !REDIRECTS.includes(f));

test('the shared tag is the Google snippet for this container', () => {
  expect(GTAG).toContain(`<script async src="${SRC}"></script>`);
  expect(GTAG).toContain('window.dataLayer = window.dataLayer || [];');
  expect(GTAG).toContain('function gtag(){dataLayer.push(arguments);}');
  expect(GTAG).toContain("gtag('js', new Date());");
});

test('every published page carries the Google tag once, right after <head>', () => {
  expect(WEB_PAGES.length).toBeGreaterThanOrEqual(PAGES.length);
  for (const p of PAGES) expect(WEB_PAGES, `${p.file} is checked`).toContain(p.file);
  for (const f of WEB_PAGES) {
    const html = read(f);
    expect(html.split('googletagmanager.com/').length - 1, `${f}: one Google tag`).toBe(1);
    expect(html.indexOf(`<head>\n${GTAG}`), `${f}: the tag comes immediately after <head>`).toBeGreaterThan(-1);
    // The charset must still sit in the first 1024 bytes for the browser to pick it up.
    expect(html.indexOf('<meta charset="UTF-8"/>'), `${f}: charset stays near the top`).toBeLessThan(1024);
  }
});

test('the redirect short links stay untagged', () => {
  for (const f of REDIRECTS) expect(read(f), f).not.toContain('googletagmanager');
});

test.describe('in the browser', () => {
  for (const p of BROWSER_PAGES.filter((x) => !x.post && !x.state)) {
    test(`${p.name} requests the Google tag and sets up the data layer`, async ({ page }) => {
      // Outside requests are blocked in tests (helpers.js), so nothing is sent to Google from a test run.
      const { errors, blocked } = await open(page, p.url, { fonts: false });
      await page.waitForLoadState('load');
      await expect.poll(() => blocked.filter((u) => u === SRC).length, 'gtm.js requested once').toBe(1);
      const layer = await page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a)[0]));
      expect(layer[0]).toBe('js');
      expect(errors).toEqual([]);
    });
  }
});
