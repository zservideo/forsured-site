// Search and link-preview health, and link integrity, for every page.
// These read the page source or the served pages, so they run once (desktop project).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, open, read } = require('./helpers');

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'source checks run once');
});

const pngSize = (file) => {
  const b = fs.readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

for (const p of PAGES) {
  test.describe(`${p.name} SEO`, () => {
    test('title, description and canonical are in shape', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      const title = await page.title();
      expect(title.length, `title "${title}"`).toBeGreaterThanOrEqual(30);
      expect(title.length, `title "${title}" gets cut off in search results`).toBeLessThanOrEqual(70);
      expect(title).toContain('Forsured');
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(desc.length, 'meta description length').toBeGreaterThanOrEqual(70);
      expect(desc.length, 'meta description gets cut off in search results').toBeLessThanOrEqual(170);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe('https://forsured.ai' + p.url);
      expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('width=device-width');
      expect(await page.locator('meta[name="robots"][content*="noindex"]').count(), 'page is not hidden from search').toBe(0);
    });

    test('link previews (Open Graph and X) are complete', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      const meta = async (sel) => page.locator(sel).first().getAttribute('content');
      for (const sel of ['meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:image"]', 'meta[property="og:url"]', 'meta[name="twitter:card"]']) {
        expect(await meta(sel), sel).toBeTruthy();
      }
      expect(await meta('meta[property="og:url"]')).toBe('https://forsured.ai' + p.url);
      const image = await meta('meta[property="og:image"]');
      expect(image, 'preview image is an absolute https URL on forsured.ai').toMatch(/^https:\/\/forsured\.ai\//);
      const local = path.join(ROOT, new URL(image).pathname);
      expect(fs.existsSync(local), `${image} exists in the repo`).toBe(true);
      if (local.endsWith('.png')) {
        const { width, height } = pngSize(local);
        expect(width / height, 'preview image is about 1.91:1').toBeCloseTo(1.91, 1);
        expect(width).toBeGreaterThanOrEqual(1200);
      }
    });

    test('has one h1 and headings that do not skip levels', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      await expect(page.locator('h1')).toHaveCount(1);
      const levels = await page.locator('main h1, main h2, main h3, main h4, main h5, main h6').evaluateAll((hs) =>
        hs.filter((h) => !h.closest('[role="img"], [aria-hidden="true"]')).map((h) => ({ level: +h.tagName[1], text: h.textContent.trim().slice(0, 40) }))
      );
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i].level - levels[i - 1].level, `"${levels[i].text}" (h${levels[i].level}) follows h${levels[i - 1].level}`).toBeLessThanOrEqual(1);
      }
    });

    test('images are described, sized and lazy below the fold', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      const imgs = await page.locator('img').evaluateAll((els) =>
        els.map((img) => ({
          src: img.getAttribute('src'),
          alt: img.getAttribute('alt'),
          width: img.getAttribute('width'),
          height: img.getAttribute('height'),
          loading: img.getAttribute('loading'),
          top: img.getBoundingClientRect().top + scrollY,
        }))
      );
      const fold = page.viewportSize().height * 1.5;
      for (const img of imgs) {
        expect(img.alt, `${img.src} alt text`).not.toBeNull();
        expect(img.width && img.height, `${img.src} has width and height (prevents layout jumps)`).toBeTruthy();
        if (img.top > fold) expect(img.loading, `${img.src} is below the fold`).toBe('lazy');
      }
    });

    test('links are safe and every local link resolves', async ({ page, request }) => {
      await open(page, p.url, { fonts: false });
      const links = await page.locator('a[href], link[href], img[src], img[srcset], source[srcset], script[src]').evaluateAll((els) =>
        els.flatMap((el) => {
          const out = [];
          if (el.getAttribute('href') !== null) out.push({ url: el.href, raw: el.getAttribute('href'), blank: el.target === '_blank', rel: el.rel || '' });
          if (el.getAttribute('src')) out.push({ url: el.src, raw: el.getAttribute('src') });
          for (const part of (el.getAttribute('srcset') || '').split(',').filter(Boolean)) out.push({ url: new URL(part.trim().split(' ')[0], document.baseURI).href, raw: part.trim() });
          return out;
        })
      );
      for (const l of links) {
        expect(l.raw, 'no empty or javascript: links').not.toMatch(/^(javascript:|#?$)/);
        if (l.url.startsWith('http://') && !/^http:\/\/localhost/.test(l.url)) throw new Error(`insecure http:// link: ${l.raw}`);
        if (l.blank) expect(l.rel, `${l.raw} opens a new tab without rel="noopener"`).toMatch(/noopener|noreferrer/);
      }
      const local = [...new Set(links.map((l) => l.url.split('#')[0]).filter((u) => /^http:\/\/localhost/.test(u)))];
      for (const u of local) {
        const res = await request.get(u);
        expect(res.status(), `${u} resolves`).toBe(200);
      }
    });

    test('structured data is valid JSON-LD', async () => {
      const blocks = [...read(p.file).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      for (const [, json] of blocks) {
        const data = JSON.parse(json);
        expect(data['@context']).toMatch(/schema\.org/);
        expect(data['@type'] || data['@graph']).toBeTruthy();
      }
    });
  });
}

for (const [short, dir] of [['irmifieldguide', 'irmi-field-guide'], ['builtworldsfieldguide', 'builtworlds-field-guide']]) {
  test(`the ${short} short link stays out of search results`, async () => {
    const html = read(`${short}/index.html`);
    expect(html).toMatch(/<meta name="robots" content="noindex"/);
    expect(html).toContain(`<link rel="canonical" href="https://forsured.ai/${dir}/"`);
  });
}

test('custom domain is set for GitHub Pages', async () => {
  expect(read('CNAME').trim()).toBe('forsured.ai');
});

// The test suite names things that must never appear on the site, so it must not be published.
test('the test suite and tooling are not published on the site', async ({ request }) => {
  for (const url of ['/tests/copy.spec.js', '/tests/brand.json', '/tests/README.md', '/package.json', '/package-lock.json', '/playwright.config.js', '/_config.yml']) {
    expect((await request.get(url)).status(), `${url} should not be served`).toBe(404);
  }
  expect((await request.get('/')).status()).toBe(200);
});
