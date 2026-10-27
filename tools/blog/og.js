#!/usr/bin/env node
// Renders the images for the blog index and every post that doesn't have them yet:
//   blog/og.png, blog/<slug>/og.png   1200x630 share cards (title on charcoal). Link previews on
//                                     LinkedIn, Slack, iMessage and X use these.
//   blog/<slug>/hero.png              1600x800 visual at the top of the post, from the post's `hero`
//                                     front matter: a key number ("stat"), a short list ("list") or a
//                                     certificate with the gap flagged ("coi"). Social posts reuse it.
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

const HERO_FONTS = '<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&family=Roboto+Serif:opsz,wght@36,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>';
const HERO_BASE = `*{margin:0;padding:0;box-sizing:border-box}
body{width:1600px;height:800px;background:#FDFAF7;color:#141C25;font-family:Inter,sans-serif;position:relative;overflow:hidden}
.mark{position:absolute;left:96px;bottom:64px;font-family:'Chakra Petch',sans-serif;font-weight:800;font-size:30px;letter-spacing:-.02em}
.src{position:absolute;right:96px;bottom:68px;font-size:20px;color:#637083}
.gap{position:absolute;left:96px;top:96px;width:300px;height:5px}
.gap::before,.gap::after{content:'';position:absolute;top:0;height:5px;background:#FB612A}
.gap::before{left:0;width:126px}.gap::after{right:0;width:126px}
.badge{display:inline-flex;align-items:center;gap:10px;padding:4px 14px;border:1px solid #E4E7EC;border-radius:8px;background:#fff;font-size:22px;font-weight:500;color:#344051}
.badge i{width:10px;height:10px;border-radius:50%;background:#FB612A}
.badge.ok i{background:#16864E}`;

// A key number, set large, with what it means and where it comes from.
function heroStat(h) {
  return `<!DOCTYPE html><html><head>${HERO_FONTS}<style>${HERO_BASE}
.v{position:absolute;left:96px;top:170px;font-family:'Roboto Serif',serif;font-weight:400;font-size:200px;line-height:1;letter-spacing:-.04em;color:#141C25}
.l{position:absolute;left:100px;right:200px;top:420px;font-family:'Roboto Serif',serif;font-size:48px;line-height:1.2;letter-spacing:-.01em;color:#344051}
</style></head><body><div class="gap"></div><div class="v">${esc(h.value)}</div><div class="l">${esc(h.label)}</div><div class="mark">Forsured</div><div class="src">${esc(h.source || '')}</div></body></html>`;
}

// A short numbered list: the shape of the post at a glance.
function heroList(h) {
  const items = h.items.slice(0, 5);
  const size = items.length > 3 ? 38 : 46;
  return `<!DOCTYPE html><html><head>${HERO_FONTS}<style>${HERO_BASE}
h1{position:absolute;left:96px;top:140px;width:520px;font-family:'Roboto Serif',serif;font-weight:400;font-size:64px;line-height:1.1;letter-spacing:-.02em}
ol{position:absolute;left:720px;right:96px;top:96px;bottom:150px;list-style:none;display:flex;flex-direction:column;justify-content:center;gap:${items.length > 3 ? 18 : 28}px}
li{display:flex;align-items:center;gap:28px;padding:${items.length > 3 ? 16 : 24}px 28px;background:#fff;border:1px solid #E4E7EC;border-radius:16px;font-size:${size}px;line-height:1.2;letter-spacing:-.01em;font-family:'Roboto Serif',serif}
li b{flex:none;width:56px;height:56px;border-radius:12px;background:#FFF3EC;color:#B03B15;font:600 26px/56px Inter,sans-serif;text-align:center}
</style></head><body><div class="gap"></div><h1>${esc(h.title)}</h1><ol>${items.map((t, i) => `<li><b>${String(i + 1).padStart(2, '0')}</b>${esc(t)}</li>`).join('')}</ol><div class="mark">Forsured</div><div class="src">${esc(h.source || '')}</div></body></html>`;
}

// A stylized certificate of insurance with the gap flagged, the way a Forsured review shows it.
function heroCoi(h) {
  const rows = h.rows || [];
  return `<!DOCTYPE html><html><head>${HERO_FONTS}<style>${HERO_BASE}
h1{position:absolute;left:96px;top:140px;width:500px;font-family:'Roboto Serif',serif;font-weight:400;font-size:62px;line-height:1.1;letter-spacing:-.02em}
.doc{position:absolute;left:680px;right:96px;top:80px;background:#fff;border:1px solid #E4E7EC;border-radius:16px;box-shadow:0 1px 2px rgba(20,28,37,.04);overflow:hidden}
.dh{display:flex;justify-content:space-between;align-items:center;padding:26px 32px;border-bottom:1px solid #E4E7EC;font-size:20px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#344051}
.dh span:last-child{letter-spacing:0;text-transform:none;font-weight:500;color:#637083}
.r{display:grid;grid-template-columns:minmax(0,1fr) 190px 280px;align-items:center;gap:20px;padding:22px 32px;border-bottom:1px solid #E4E7EC;font-size:25px}
.r:last-child{border-bottom:0}
.r .badge{justify-self:end;white-space:nowrap}.r .c{font-weight:500}.r .lim{color:#637083;font-variant-numeric:tabular-nums}
.r.flag{background:#FFF3EC;box-shadow:inset 5px 0 0 #FB612A}
.note{padding:20px 32px 24px;background:#FFF3EC;border-top:1px solid #FFE3D4;font-size:23px;line-height:1.35;color:#6A260F}
</style></head><body><div class="gap"></div><h1>${esc(h.title)}</h1>
<div class="doc"><div class="dh"><span>Certificate of insurance</span><span>Contractor COI · sample</span></div>
${rows.map(([c, lim, st]) => `<div class="r${st === 'ok' ? '' : ' flag'}"><span class="c">${esc(c)}</span><span class="lim">${esc(lim)}</span><span class="badge${st === 'ok' ? ' ok' : ''}"><i></i>${st === 'ok' ? 'Meets' : esc(st)}</span></div>`).join('')}
${h.note ? `<div class="note">${esc(h.note)}</div>` : ''}</div>
<div class="mark">Forsured</div><div class="src">${esc(h.source || 'Sample data')}</div></body></html>`;
}

const HERO = { stat: heroStat, list: heroList, coi: heroCoi };

(async () => {
  const posts = readPosts(true);
  const jobs = [{ file: 'blog/og.png', kicker: 'Forsured Blog', title: 'Notes on construction insurance compliance.' }];
  for (const p of posts) {
    jobs.push({ file: `blog/${p.slug}/og.png`, kicker: p.category, title: p.title, slug: p.slug });
    const h = p.hero || { type: 'list', title: p.title, items: [] };
    if (!HERO[h.type]) throw new Error(`${p.slug}: hero type must be one of ${Object.keys(HERO).join(', ')}`);
    jobs.push({ file: `blog/${p.slug}/hero.png`, slug: p.slug, html: HERO[h.type](h), size: { width: 1600, height: 800 } });
  }
  const todo = jobs.filter((j) =>
    args.includes('--all') ? true : args.length ? args.includes(j.slug) : !fs.existsSync(path.join(ROOT, j.file))
  );
  if (!todo.length) return console.log('all share images exist');
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, ignoreHTTPSErrors: !!proxy });
  for (const j of todo) {
    await page.setViewportSize(j.size || { width: 1200, height: 630 });
    await page.setContent(j.html || card(j), { waitUntil: 'networkidle' });
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
