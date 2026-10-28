// The state COI requirement pages (content/coi-requirements, built by tools/blog/build.js): one page
// per state and DC, each with its sources, structured data, share card and Markdown copy, a hub that
// links them all, and the sitemap and llms.txt entries. The pages stay out of the main nav.
// Copy, brand, SEO, accessibility, layout and performance checks cover every page through PAGES.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, STATE_SLUGS, open, read } = require('./helpers');
const { STATES, url } = require('../tools/states/pages');

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'source checks run once');
});

const jsonld = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(([, j]) => {
    const d = JSON.parse(j);
    return d['@graph'] || [d];
  });

test('covers all 50 states and DC, each built once', () => {
  expect(STATES.length).toBe(51);
  expect(new Set(STATES.map((s) => s.code)).size).toBe(51);
  expect(STATES.map((s) => url(s).split('/')[2]).sort()).toEqual(STATE_SLUGS);
  expect(PAGES.filter((p) => p.state).length).toBe(51);
});

test('every state cites sources over https and names its workers\' comp agency', () => {
  for (const s of STATES) {
    expect(s.sources.length, s.name).toBeGreaterThan(0);
    for (const src of s.sources) {
      expect(src.url, `${s.name}: ${src.title}`).toMatch(/^https:\/\//);
      expect(src.publisher, `${s.name}: ${src.title}`).toBeTruthy();
    }
    expect(s.wc.agency[1], s.name).toMatch(/^https:\/\//);
    for (const k of ['at', 'short']) {
      expect(s.wc[k], `${s.name} wc.${k}`).toBeTruthy();
      expect(s.lic[k], `${s.name} lic.${k}`).toBeTruthy();
    }
    expect(['sole', 'broad', 'none', 'custom'], `${s.name} ai.kind`).toContain(s.ai.kind);
    if (s.ai.kind === 'custom') expect(s.ai.at, `${s.name} ai.at`).toBeTruthy();
  }
});

for (const s of STATES) {
  test(`${s.name}: structured data, sources, FAQ, share card and Markdown copy`, async ({ request }) => {
    const u = url(s);
    const html = read(`${u.slice(1)}index.html`);
    const items = jsonld(html);
    const article = items.find((i) => i['@type'] === 'Article');
    expect(article, 'Article').toBeTruthy();
    for (const k of ['headline', 'description', 'image', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage']) expect(article[k], k).toBeTruthy();
    expect(article.mainEntityOfPage).toBe(`https://forsured.ai${u}`);
    expect(article.citation.length, 'cites its sources').toBe(new Set(article.citation.map((c) => c.url)).size);
    expect(article.citation.length).toBeGreaterThanOrEqual(s.sources.length);
    expect(article.encoding.contentUrl).toBe(`https://forsured.ai${u}index.md`);
    expect(items.find((i) => i['@type'] === 'BreadcrumbList'), 'breadcrumb').toBeTruthy();
    const faq = items.find((i) => i['@type'] === 'FAQPage');
    expect(faq, 'FAQPage').toBeTruthy();
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text.length, q.name).toBeGreaterThan(40);

    // Every source is linked in the Sources box, with the not-legal-advice note.
    const box = html.slice(html.indexOf('class="extra sources"'));
    for (const src of s.sources) expect(box, src.url).toContain(`href="${src.url.replace(/&/g, '&amp;')}"`);
    expect(box).toContain('not legal advice');
    expect(html, 'free COI risk check').toContain('href="/#demo"');

    expect(fs.statSync(path.join(ROOT, `${u.slice(1)}og.png`)).size, 'share card under 5 MB').toBeLessThan(5e6);

    const res = await request.get(`${u}index.md`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const md = await res.text();
    expect(md.startsWith(`# ${s.name} contractor insurance requirements\n`)).toBe(true);
    expect(md).toContain('## Sources');
  });
}

test('the hub links every state from its table and its grid', async ({ page }) => {
  await open(page, '/coi-requirements/', { fonts: false });
  const want = STATES.map(url).sort();
  const table = await page.locator('.hub-table a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(table.sort()).toEqual(want);
  const grid = await page.locator('.states a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(grid.sort()).toEqual(want);
  const list = jsonld(read('coi-requirements/index.html')).find((i) => i['@type'] === 'CollectionPage');
  expect(list.mainEntity.itemListElement.map((i) => i.url).sort()).toEqual(want.map((u) => `https://forsured.ai${u}`));
});

test('each state page links back to the hub and to every other state', async ({ page }) => {
  const s = STATES[0];
  await open(page, url(s), { fonts: false });
  await expect(page.locator('.crumbs a[href="/coi-requirements/"]')).toBeVisible();
  const others = await page.locator('.states a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(others.sort()).toEqual(STATES.filter((o) => o !== s).map(url).sort());
});

test('the pages stay out of the main nav and are linked from the footer', async ({ page }) => {
  for (const u of ['/', '/blog/', '/coi-requirements/']) {
    await open(page, u, { fonts: false });
    expect(await page.locator('nav a[href^="/coi-requirements/"]').count(), `${u} nav`).toBe(0);
  }
  for (const u of ['/blog/', '/coi-requirements/', url(STATES[0])]) {
    await open(page, u, { fonts: false });
    await expect(page.locator('footer a[href="/coi-requirements/"]'), `${u} footer`).toHaveText('COI Requirements by State');
  }
});

test('llms.txt lists the hub and every state page with its Markdown copy', async ({ request }) => {
  const txt = await (await request.get('/llms.txt')).text();
  expect(txt).toContain('## Contractor insurance requirements by state');
  for (const u of ['/coi-requirements/', ...STATES.map(url)]) expect(txt).toContain(`https://forsured.ai${u}index.md`);
});

test('the state data and page tools are not published', async ({ request }) => {
  for (const u of ['/content/coi-requirements/states.js', '/tools/states/pages.js']) {
    expect((await request.get(u)).status(), `${u} should not be served`).toBe(404);
  }
});
