// The blog and the discovery files built from it (tools/blog/build.js): the generated pages are
// current, every post carries the structured data, sources, hero image, share buttons and share card
// that search engines, AI answer engines and social networks read, the home page nav, phone menu and
// footer links, the newsletter signup, and the feed, sitemap, robots.txt,
// llms.txt, llms-full.txt and Markdown copies list everything. IndexNow's key file matches its workflow.
// Copy, brand, SEO, accessibility, layout and performance checks cover each post through PAGES.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
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
      expect(post.image.map((i) => i.url), 'hero and share card').toEqual([`https://forsured.ai/blog/${slug}/hero.png`, `https://forsured.ai/blog/${slug}/og.png`]);
      expect(post.publisher.sameAs.length, 'publisher is tied to its other official profiles').toBeGreaterThan(0);
      expect(post.encoding.contentUrl).toBe(`https://forsured.ai/blog/${slug}/index.md`);
      expect(items.find((i) => i['@type'] === 'WebSite'), 'WebSite entity').toBeTruthy();
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

    test('has a hero image and a full share card', async ({ page }) => {
      await open(page, `/blog/${slug}/`, { fonts: false });
      const hero = page.locator('figure.hero img');
      await expect(hero).toHaveAttribute('src', 'hero.png');
      expect((await hero.getAttribute('alt')).length, 'hero alt text says what the image shows').toBeGreaterThan(30);
      await expect.poll(() => hero.evaluate((img) => img.complete && [img.naturalWidth, img.naturalHeight].join('x'))).toBe('1600x800');
      const meta = (sel) => page.locator(sel).getAttribute('content');
      expect(await meta('meta[property="og:image"]')).toBe(`https://forsured.ai/blog/${slug}/og.png`);
      expect(await meta('meta[property="og:image:type"]')).toBe('image/png');
      expect(await meta('meta[name="twitter:image:alt"]')).toBeTruthy();
      expect(await meta('meta[property="article:section"]')).toBeTruthy();
      expect(fs.statSync(path.join(ROOT, `blog/${slug}/og.png`)).size, 'share card under 5 MB (LinkedIn limit)').toBeLessThan(5e6);
    });

    test('share buttons link to every network with this post\'s URL', async ({ page }) => {
      await open(page, `/blog/${slug}/`, { fonts: false });
      const url = `https://forsured.ai/blog/${slug}/`;
      for (const bar of [page.locator('.post-head .share'), page.locator('.share-end .share')]) {
        const href = (net) => bar.locator(`a[data-net="${net}"]`).getAttribute('href');
        const shared = (h, param) => new URL(h).searchParams.get(param);
        expect(shared(await href('linkedin'), 'url')).toBe(`${url}?utm_source=linkedin&utm_medium=social&utm_campaign=blog_share`);
        expect(await href('linkedin')).toMatch(/^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?/);
        expect(shared(await href('x'), 'url')).toContain(url);
        expect(shared(await href('x'), 'text')).toBe(await page.locator('h1').innerText());
        expect(shared(await href('facebook'), 'u')).toContain(url);
        expect(await href('email')).toMatch(/^mailto:\?subject=/);
        expect(decodeURIComponent(await href('email'))).toContain(url);
        await expect(bar.locator('button[data-copy]')).toBeVisible();
      }
    });
  });
}

// The signup box is paused until there's budget to send a newsletter (NEWSLETTER in tools/blog/build.js).
// While it's off, no page may show it; once it's back on, every page must, and the form tests below run.
const { NEWSLETTER } = require('../tools/blog/build.js');

test('no blog page shows the newsletter signup while it is paused', async ({ page }) => {
  test.skip(NEWSLETTER, 'the newsletter signup is on');
  for (const p of PAGES.filter((x) => x.post || x.url === '/blog/')) {
    await open(page, p.url, { fonts: false });
    await expect(page.locator('[data-sub]'), p.url).toHaveCount(0);
  }
});

test.describe('newsletter signup', () => {
test.beforeEach(() => test.skip(!NEWSLETTER, 'paused: NEWSLETTER is false in tools/blog/build.js'));

test('the blog index and every post have the newsletter signup', async ({ page }) => {
  for (const p of PAGES.filter((x) => x.post || x.url === '/blog/')) {
    await open(page, p.url, { fonts: false });
    const box = page.locator('[data-sub]');
    await expect(box, p.url).toHaveCount(1);
    await expect(box.getByLabel('Work email')).toBeVisible();
    await expect(box.getByRole('button', { name: 'Subscribe' })).toBeVisible();
  }
});

test('newsletter signup sends the email to both form backends and confirms', async ({ page }) => {
  const { posts } = await open(page, `/blog/${POSTS[0]}/`, { fonts: false });
  const box = page.locator('[data-sub]');
  await box.getByLabel('Work email').fill('reader@example.com');
  await box.getByRole('button', { name: 'Subscribe' }).click();
  await expect(box.locator('.ok')).toBeVisible();
  await expect(box.locator('form')).toBeHidden();
  expect(posts.map((p) => new URL(p.url).host).sort()).toEqual(['api.web3forms.com', 'hook.us2.make.com']);
  const make = JSON.parse(posts.find((p) => p.url.includes('make.com')).body);
  expect(make).toMatchObject({ email: 'reader@example.com', form_source: 'Newsletter', placement: 'post', page: `/blog/${POSTS[0]}/` });
  const w3 = posts.find((p) => p.url.includes('web3forms')).body;
  expect(w3).toContain('reader@example.com');
  expect(w3).toContain('Forsured Blog Subscriber');
});

test('newsletter signup rejects a bad email and sends nothing', async ({ page }) => {
  const { posts } = await open(page, '/blog/', { fonts: false });
  const box = page.locator('[data-sub]');
  await box.getByRole('button', { name: 'Subscribe' }).click();
  await expect(box.locator('.err')).toHaveText('Please enter a valid email.');
  await box.getByLabel('Work email').fill('reader.example.com');
  await box.getByRole('button', { name: 'Subscribe' }).click();
  await expect(box.getByLabel('Work email')).toBeFocused();
  expect(posts).toEqual([]);
});

test('newsletter signup recovers when the backend fails', async ({ page }) => {
  await open(page, '/blog/', { fonts: false, formOk: false });
  const box = page.locator('[data-sub]');
  await box.getByLabel('Work email').fill('reader@example.com');
  await box.getByRole('button', { name: 'Subscribe' }).click();
  await expect(box.locator('.err')).toHaveText(/Something went wrong/);
  await expect(box.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
  await expect(box.locator('.ok')).toBeHidden();
});
});

test('copy link copies the clean URL and says so', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const slug = POSTS[0];
  await open(page, `/blog/${slug}/`, { fonts: false });
  await page.locator('.post-head button[data-copy]').click();
  await expect(page.locator('.post-head .share-s')).toHaveText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`https://forsured.ai/blog/${slug}/`);
});

test('the native share button shows only where the device has a share sheet', async ({ page }) => {
  await page.addInitScript(() => { delete Navigator.prototype.share; });
  await open(page, `/blog/${POSTS[0]}/`, { fonts: false });
  await expect(page.locator('button[data-share]').first()).toBeHidden();
  await page.addInitScript(() => {
    window.__shared = null;
    Navigator.prototype.share = function (data) { window.__shared = data; return Promise.resolve(); };
  });
  await page.reload();
  await page.locator('.post-head button[data-share]').click();
  expect(await page.evaluate(() => window.__shared.url)).toBe(`https://forsured.ai/blog/${POSTS[0]}/`);
});

test('on phones, network buttons open the share sheet instead of a web login page', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__shared = [];
    Navigator.prototype.share = function (data) { window.__shared.push(data); return Promise.resolve(); };
  });
  const slug = POSTS[0];
  await open(page, `/blog/${slug}/`, { fonts: false });
  for (const net of ['linkedin', 'x', 'facebook']) await page.locator(`.post-head a[data-net="${net}"]`).click();
  expect(page.url(), 'stays on the post').toContain(`/blog/${slug}/`);
  expect(context.pages().length, 'no new tab').toBe(1);
  expect(await page.evaluate(() => window.__shared.map((d) => d.url))).toEqual(
    ['linkedin', 'x', 'facebook'].map((n) => `https://forsured.ai/blog/${slug}/?utm_source=${n}&utm_medium=social&utm_campaign=blog_share`)
  );
  await context.close();
});

test('every post has a Markdown copy for AI answer engines', async ({ page, request }) => {
  for (const slug of POSTS) {
    await open(page, `/blog/${slug}/`, { fonts: false });
    await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute('href', `https://forsured.ai/blog/${slug}/index.md`);
    const res = await request.get(`/blog/${slug}/index.md`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const md = await res.text();
    expect(md.startsWith(`# ${await page.locator('h1').innerText()}\n`)).toBe(true);
    expect(md).toContain('## Sources');
  }
  // GitHub Pages would otherwise turn .md files into HTML pages and stop serving the Markdown.
  expect(read('_config.yml')).toMatch(/^markdown_ext: markdown$/m);
});

test('llms-full.txt carries every post in full', async ({ request }) => {
  const txt = await (await request.get('/llms-full.txt')).text();
  expect(txt).toMatch(/^# Forsured\n/);
  for (const slug of POSTS) expect(txt).toContain(`Source: https://forsured.ai/blog/${slug}/`);
});

test('the IndexNow key file is served and matches the workflow', async ({ request }) => {
  const key = read('.github/workflows/indexnow.yml').match(/^  KEY: ([0-9a-f]{32})$/m)[1];
  const res = await request.get(`/${key}.txt`);
  expect(res.status()).toBe(200);
  expect((await res.text()).trim()).toBe(key);
});

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

// Readers who land on a post from search or social need the whole site, not just the logo.
const siteHref = (h) => (h.startsWith('#') ? `/${h}` : h === 'blog/' ? '/blog/' : h);

test('blog pages carry the home page navigation and footer links', async ({ page }) => {
  await open(page, '/', { fonts: false });
  const homeNav = (await page.locator('#nav .nlinks a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).map(siteHref);
  const homeMenu = (await page.locator('#mm a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).map(siteHref);
  const homeFooter = (await page.locator('footer .fc a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).map(siteHref);
  for (const url of ['/blog/', `/blog/${POSTS[0]}/`]) {
    await open(page, url, { fonts: false });
    expect(await page.locator('nav .nlinks a').evaluateAll((as) => as.map((a) => a.getAttribute('href'))), `${url} nav`).toEqual(homeNav);
    expect(await page.locator('#mm a').evaluateAll((as) => as.map((a) => a.getAttribute('href'))), `${url} menu`).toEqual(homeMenu);
    const footer = await page.locator('footer .fc a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const href of homeFooter) expect(footer, `${url} footer`).toContain(href);
    await expect(page.locator('footer .fl')).toHaveAttribute('href', '/');
  }
});

test('on phones, the blog menu button opens the site menu and closes it again', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await open(page, `/blog/${POSTS[0]}/`, { fonts: false });
  const btn = page.locator('nav .mtog');
  const menu = page.locator('#mm');
  await expect(page.locator('nav .nlinks')).toBeHidden();
  await expect(btn).toBeVisible();
  await expect(menu).toBeHidden();
  await btn.click();
  await expect(menu).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('link', { name: 'How It Works' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Free COI Risk Check →' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn).toBeFocused();
  await btn.click();
  await menu.getByRole('link', { name: 'Platform' }).click();
  await page.waitForURL(/\/#platform$/);
  await context.close();
});

test('the blog source and tooling are not published', async ({ request }) => {
  for (const url of ['/content/blog/compliance-isnt-coverage.md', '/tools/blog/build.js']) {
    expect((await request.get(url)).status(), `${url} should not be served`).toBe(404);
  }
});
