// Takes a screenshot of each vendor page listed in a post's brief, for buyer's guides and
// rankings (Warren's R2 rule: show each vendor's own page). Run by the "Vendor screenshots"
// workflow, because vendor sites are not reachable from every sandbox.
//
//   node tools/blog/vendor-shots.js <slug>
//
// The brief (content/blog/briefs/<slug>.json) lists the pages:
//   "screenshots": [{ "file": "shot-pins-advantage.png", "url": "https://www.pinsadvantage.com/pricing" }]
// A post from before the AEO gate that has no brief yet lists them in content/blog/shots/<slug>.json
// instead, in the same shape, so adding screenshots doesn't pull it into the gate early.
// Each one is saved to blog/<slug>/<file> at 1440x900, the first screen a visitor sees.
// The workflow then shrinks them with pngquant. Add them to the post with
//   ![What the page shows](shot-pins-advantage.png "Vendor page, checked <date>")
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..', '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: node tools/blog/vendor-shots.js <slug>'); process.exit(1); }
const read = (dir) => {
  const file = path.join(ROOT, 'content/blog', dir, `${slug}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).screenshots || [] : [];
};
const shots = read('briefs').length ? read('briefs') : read('shots');
if (!shots.length) { console.error(`${slug}: no "screenshots" list in content/blog/briefs/ or content/blog/shots/`); process.exit(1); }

// Cookie and consent banners cover the page; try the usual accept buttons before the shot.
const ACCEPT = /^(accept|accept all|accept cookies|allow all|i agree|agree|got it|ok)$/i;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-US' });
  const dir = path.join(ROOT, 'blog', slug);
  fs.mkdirSync(dir, { recursive: true });
  let failed = 0;
  for (const { file, url } of shots) {
    if (!/^shot-[a-z0-9-]+\.png$/.test(file)) { console.error(`${file}: name it shot-<vendor>.png`); failed++; continue; }
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.waitForLoadState('load'));
      for (const b of await page.getByRole('button', { name: ACCEPT }).all()) {
        if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => {}); break; }
      }
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(dir, file) });
      console.log(`${file}: ${url}`);
    } catch (e) {
      console.error(`${file}: ${url} failed: ${e.message}`);
      failed++;
    }
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
