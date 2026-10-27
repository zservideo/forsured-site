#!/usr/bin/env node
// Renders the 1200x630 share image for the blog index and every post that doesn't have one yet:
//   blog/og.png, blog/<slug>/og.png
// Link previews on LinkedIn, Slack, iMessage and X use these, and the social posts can reuse them.
//
//   node tools/blog/og.js            only missing images
//   node tools/blog/og.js --all      re-render every image (after a title or design change)
//   node tools/blog/og.js <slug>     re-render one post
//
// Uses the Playwright Chromium the test suite installs. In a sandbox behind a proxy, HTTPS_PROXY
// is picked up so the brand fonts load from Google Fonts.
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { readPosts } = require('./build');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function card({ kicker, title }) {
  const size = title.length > 70 ? 58 : title.length > 48 ? 64 : 72;
  return `<!DOCTYPE html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&family=Roboto+Serif:opsz,wght@36,400&family=Inter:wght@500&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#2C2D29;color:#fff;font-family:Inter,sans-serif;position:relative;overflow:hidden}
.top{position:absolute;left:0;top:0;right:0;height:6px;background:#FB612A}
.mark{position:absolute;left:80px;top:64px;font-family:'Chakra Petch',sans-serif;font-weight:800;font-size:34px;letter-spacing:-.02em}
.kicker{position:absolute;left:80px;top:150px;display:flex;align-items:center;gap:12px;font-size:22px;font-weight:500;color:rgba(255,255,255,.72)}
.kicker i{width:10px;height:10px;border-radius:50%;background:#FB612A}
h1{position:absolute;left:80px;right:110px;top:200px;font-family:'Roboto Serif',serif;font-weight:400;font-size:${size}px;line-height:1.12;letter-spacing:-.02em}
.foot{position:absolute;left:80px;right:80px;bottom:56px;display:flex;justify-content:space-between;font-size:20px;font-weight:500;color:rgba(255,255,255,.6)}
/* The gap: an orange line that breaks, the same motif as the social banners */
.gap{position:absolute;right:80px;bottom:110px;width:260px;height:4px}
.gap::before,.gap::after{content:'';position:absolute;top:0;height:4px;background:#FB612A}
.gap::before{left:0;width:110px}.gap::after{right:0;width:110px}
</style></head><body>
<div class="top"></div>
<div class="mark">Forsured</div>
<div class="kicker"><i></i>${esc(kicker)}</div>
<h1>${esc(title)}</h1>
<div class="gap"></div>
<div class="foot"><span>forsured.ai/blog</span><span>Catch the gap before it's a jobsite problem.</span></div>
</body></html>`;
}

(async () => {
  const posts = readPosts();
  const jobs = [{ file: 'blog/og.png', kicker: 'Forsured Blog', title: 'Notes on construction insurance compliance.' }];
  for (const p of posts) jobs.push({ file: `blog/${p.slug}/og.png`, kicker: p.category, title: p.title, slug: p.slug });
  const todo = jobs.filter((j) =>
    args.includes('--all') ? true : args.length ? args.includes(j.slug) : !fs.existsSync(path.join(ROOT, j.file))
  );
  if (!todo.length) return console.log('all share images exist');
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, ignoreHTTPSErrors: !!proxy });
  for (const j of todo) {
    await page.setContent(card(j), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // Each family must have at least one face loaded (unused unicode-range subsets stay unloaded).
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')));
    const missing = ['Chakra Petch', 'Roboto Serif', 'Inter'].filter((f) => !loaded.includes(f));
    if (missing.length) throw new Error(`fonts did not load: ${missing.join(', ')}`);
    const out = path.join(ROOT, j.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    console.log(`wrote ${j.file}`);
  }
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
