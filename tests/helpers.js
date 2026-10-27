// Shared helpers for the forsured.ai test suite.
// Pages are served by tests/server.js (see playwright.config.js), so links and
// redirects behave like GitHub Pages. Google Fonts load for real (each file once per
// test worker, see fontResponse); every other outside request is blocked, and the form
// backends are stubbed so tests never send real submissions to Web3Forms or the Make webhook.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Every public HTML page. Add new pages here so copy, brand, SEO, a11y and
// layout checks cover them automatically.
// Blog posts are added automatically from content/blog (see tools/blog/build.js).
const POSTS = fs
  .readdirSync(path.join(ROOT, 'content', 'blog'))
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => f.replace(/\.md$/, ''))
  .filter((slug) => fs.existsSync(path.join(ROOT, 'blog', slug, 'index.html')));
const PAGES = [
  { name: 'home', url: '/', file: 'index.html' },
  { name: 'field guide', url: '/irmi-field-guide/', file: 'irmi-field-guide/index.html' },
  { name: 'blog', url: '/blog/', file: 'blog/index.html' },
  ...POSTS.map((slug) => ({ name: `post ${slug}`, url: `/blog/${slug}/`, file: `blog/${slug}/index.html`, post: true })),
];

const BRAND = require('./brand.json');

const FONT_HOST = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const FORM_HOST = /^https:\/\/(api\.web3forms\.com|hook\.us2\.make\.com)\//;
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)[:/]/;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// Google Fonts responses, kept for the life of a test worker. Every test still renders with
// the real brand fonts, but each file is downloaded once per worker instead of once per test,
// and a failed download is retried instead of leaving a page drawn in fallback fonts.
const fontCache = new Map();
function fontResponse(route) {
  const req = route.request();
  const key = `${req.url()} ${req.headers()['user-agent'] || ''}`;
  if (!fontCache.has(key)) {
    const download = (async () => {
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await route.fetch({ timeout: 15000 });
          if (res.ok()) {
            const headers = { ...res.headers() };
            delete headers['content-encoding']; // the body below is already decoded
            delete headers['content-length'];
            return { status: res.status(), headers, body: await res.body() };
          }
          lastError = new Error(`HTTP ${res.status()}`);
        } catch (e) {
          lastError = e;
        }
      }
      throw new Error(`Google Fonts download failed 3 times: ${req.url()} (${lastError.message})`);
    })();
    download.catch(() => fontCache.delete(key)); // let a later test try again
    fontCache.set(key, download);
  }
  return fontCache.get(key);
}

/**
 * Open a page with outside requests controlled.
 * @param {import('@playwright/test').Page} page
 * @param {string} url  path on the test server, e.g. '/' or '/irmi-field-guide/'
 * @param {{formOk?: boolean, fonts?: boolean, reveal?: boolean, freeze?: boolean}} opts
 *   formOk  what the stubbed form backends answer
 *   fonts   load Google Fonts (default true) and wait for them
 *   reveal  show every scroll-reveal block and turn off transitions, for layout checks
 *   freeze  pause timers (step animation, clocks) so screenshots are repeatable
 */
async function open(page, url = '/', { formOk = true, fonts = true, reveal = false, freeze = false } = {}) {
  const errors = [];
  const posts = [];
  const blocked = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(
    (u) => !LOCAL.test(u.href),
    (route) => {
      const req = route.request();
      const u = req.url();
      if (FORM_HOST.test(u)) {
        posts.push({ url: u, body: req.postData() });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: formOk }) });
      }
      // A font that can't be downloaded is aborted, so checks see it as failed rather than waiting.
      if (fonts && FONT_HOST.test(u)) return fontResponse(route).then((r) => route.fulfill(r), () => route.abort());
      if (!FONT_HOST.test(u)) blocked.push(u);
      return route.abort();
    }
  );
  if (freeze) await page.clock.install({ time: new Date('2026-10-27T12:00:00Z') });
  await page.goto(url);
  if (freeze) await page.clock.pauseAt(new Date('2026-10-27T13:00:00Z'));
  if (fonts) await page.evaluate(() => document.fonts.ready);
  if (reveal) await settle(page);
  return { errors, posts, blocked };
}

// Load every lazy image now, so screenshots and size checks see them.
async function loadImages(page) {
  await page.evaluate(() =>
    Promise.all([...document.images].map((img) => { img.loading = 'eager'; return img.decode().catch(() => {}); }))
  );
}

// Show every .reveal block and stop transitions/animations so boxes sit at their final positions.
async function settle(page) {
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation-play-state:paused!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible')));
}

// The words a visitor or a link preview can read: text on the page (including copy that shows
// later, like form success messages), alt text, aria-labels, titles, and the page's
// title/description/social tags. Form placeholders are left out (they hold sample input), and so is
// the customer quote (blockquote), which is kept word for word.
// Returns { text: one string for phrase checks, segments: each text node / attribute on its own }.
async function pageCopy(page) {
  return page.evaluate(() => {
    const skip = (el) => el.closest('script,style,noscript,blockquote');
    const head = [document.title];
    for (const m of document.querySelectorAll('meta[name="description"],meta[property^="og:"],meta[name^="twitter:"]')) {
      const c = m.getAttribute('content');
      if (c && !/^(https?:\/\/|@|\d+$)/.test(c) && !/^(og|twitter):(type|card|locale)/.test(m.getAttribute('property') || m.getAttribute('name'))) head.push(c);
    }
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (t && !skip(n.parentElement)) nodes.push(t);
    }
    const attrs = [...document.body.querySelectorAll('[alt],[aria-label],[title]')]
      .filter((el) => !skip(el))
      .flatMap((el) => ['alt', 'aria-label', 'title'].map((a) => el.getAttribute(a)).filter(Boolean));
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,blockquote').forEach((n) => n.remove());
    const body = clone.textContent.replace(/\s+/g, ' ');
    return { text: [...head, body, ...attrs].join(' | '), segments: [...head, ...nodes, ...attrs] };
  });
}

// Parse "rgb(1, 2, 3)" / "rgba(1, 2, 3, .5)" / "#abc" / "#aabbcc" into [r, g, b, a].
function parseColor(c) {
  c = String(c).trim().toLowerCase();
  let m = c.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split('').map((x) => x + x).join('');
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  }
  m = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3]), a];
  }
  return null;
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();

// A color is on-brand when it is a near-neutral gray or sits within the tolerance of a palette color.
function onBrand(rgb) {
  const [r, g, b] = rgb;
  if (Math.max(r, g, b) - Math.min(r, g, b) <= BRAND.neutralChroma) return true;
  return Object.values(BRAND.palette).some((group) =>
    Object.values(group).filter((h) => h.startsWith('#')).some((h) => {
      const [pr, pg, pb] = parseColor(h);
      return Math.hypot(r - pr, g - pg, b - pb) <= BRAND.tolerance;
    })
  );
}

module.exports = { ROOT, PAGES, POSTS, BRAND, open, settle, loadImages, pageCopy, parseColor, onBrand, hex, read };
