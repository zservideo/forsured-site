// The blog and the discovery files built from it (tools/blog/build.js): the generated pages are
// current, every post carries the structured data, sources and share image search engines and AI
// answer engines read, and the feed, sitemap, robots.txt and llms.txt list everything.
// Copy, brand, SEO, accessibility, layout and performance checks cover each post through PAGES.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT, PAGES, POSTS, open, read } = require('./helpers');

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'source checks run once');
});

const jsonld = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(([, j]) => {
    const d = JSON.parse(j);
    return d['@graph'] || [d];
  });

test('generated blog files match content/blog (run node tools/blog/build.js)', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools/blog/build.js'), '--check'], { stdio: 'pipe' });
});

test('every post in content/blog was built', () => {
  expect(POSTS.length, 'posts').toBeGreaterThan(0);
  const sources = require('fs').readdirSync(path.join(ROOT, 'content/blog')).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const drafts = sources.filter((f) => /"draft":\s*true/.test(read(`content/blog/${f}`)));
  expect(POSTS.length).toBe(sources.length - drafts.length);
});

test('the blog index links to every post, newest first', async ({ page }) => {
  await open(page, '/blog/', { fonts: false });
  const hrefs = await page.locator('main a[href^="/blog/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  expect(hrefs.sort()).toEqual(POSTS.map((s) => `/blog/${s}/`).sort());
  const dates = await page.locator('main time').evaluateAll((ts) => ts.map((t) => t.getAttribute('datetime')));
  expect(dates).toEqual([...dates].sort().reverse());
});

for (const slug of POSTS) {
  test.describe(`post ${slug}`, () => {
    const html = () => read(`blog/${slug}/index.html`);

    test('has complete BlogPosting, breadcrumb and FAQ structured data', () => {
      const items = jsonld(html());
      const post = items.find((i) => i['@type'] === 'BlogPosting');
      expect(post, 'BlogPosting').toBeTruthy();
      for (const k of ['headline', 'description', 'image', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage']) expect(post[k], k).toBeTruthy();
      expect(post.headline.length, 'headline fits Google\'s 110-character limit').toBeLessThanOrEqual(110);
      expect(new Date(post.datePublished).getTime(), 'published date is not in the future').toBeLessThanOrEqual(Date.now() + 36e5);
      expect(post.mainEntityOfPage).toBe(`https://forsured.ai/blog/${slug}/`);
      expect(post.citation.length, 'cites its sources').toBeGreaterThan(0);
      expect(items.find((i) => i['@type'] === 'BreadcrumbList')).toBeTruthy();
      const faq = items.find((i) => i['@type'] === 'FAQPage');
      if (faq) for (const q of faq.mainEntity) expect(q.acceptedAnswer.text.length, q.name).toBeGreaterThan(40);
    });

    test('opens with a short answer and ends with linked sources', async ({ page }) => {
      await open(page, `/blog/${slug}/`, { fonts: false });
      expect(await page.locator('.tldr li').count(), 'takeaways').toBeGreaterThanOrEqual(2);
      const sources = await page.locator('.sources ol a').evaluateAll((as) => as.map((a) => a.href));
      expect(sources.length).toBeGreaterThan(0);
      for (const s of sources) expect(s, 'sources link to the original over https').toMatch(/^https:\/\/(?!forsured\.ai)/);
      expect(await page.locator('.prose').innerText().then((t) => t.split(/\s+/).length), 'post length').toBeGreaterThan(250);
    });
  });
}

test('RSS feed lists every post with full text', async ({ request }) => {
  const res = await request.get('/blog/feed.xml');
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toMatch(/^<\?xml/);
  for (const slug of POSTS) expect(xml).toContain(`<guid isPermaLink="true">https://forsured.ai/blog/${slug}/</guid>`);
  expect((xml.match(/<content:encoded>/g) || []).length).toBe(POSTS.length);
});

test('sitemap lists every public page', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.sort()).toEqual(PAGES.map((p) => `https://forsured.ai${p.url}`).sort());
});

test('robots.txt allows search and AI crawlers and points at the sitemap', async ({ request }) => {
  const txt = await (await request.get('/robots.txt')).text();
  expect(txt).toContain('Sitemap: https://forsured.ai/sitemap.xml');
  expect(txt).not.toMatch(/^Disallow:\s*\/\s*$/m);
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) expect(txt).toContain(`User-agent: ${bot}`);
});

test('llms.txt describes Forsured and lists every post', async ({ request }) => {
  const txt = await (await request.get('/llms.txt')).text();
  expect(txt).toMatch(/^# Forsured\n\n> /);
  for (const slug of POSTS) expect(txt).toContain(`https://forsured.ai/blog/${slug}/`);
});

test('the home page links to the blog and its feed', async ({ page }) => {
  await open(page, '/', { fonts: false });
  await expect(page.locator('#nav .nlinks a[href="blog/"]')).toHaveText('Blog');
  await expect(page.locator('footer a[href="blog/"]')).toHaveCount(1);
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', 'https://forsured.ai/blog/feed.xml');
});

test('the blog source and tooling are not published', async ({ request }) => {
  for (const url of ['/content/blog/compliance-isnt-coverage.md', '/tools/blog/build.js']) {
    expect((await request.get(url)).status(), `${url} should not be served`).toBe(404);
  }
});
