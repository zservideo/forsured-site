// Copy rules for every public page. "Copy" means what a visitor or a link preview can read:
// visible text, alt text, labels, the page title and the description/social tags (see pageCopy).
// The customer quote is excluded because it is kept word for word.
const { test, expect } = require('@playwright/test');
const { PAGES, open, pageCopy, read } = require('./helpers');

// Wording rules. Each entry: the pattern that must not appear, why, and optional settings.
const BANNED = [
  // Neutral wording lands with GCs and trade contractors alike (Oct 26 IRMI learnings).
  [/\bsub-?contractors?\b/i, 'say "contractor" or "trade contractor", not "subcontractor"'],
  [/\bsubs\b/i, 'say "contractors", not "subs"'],
  [/\bsub COIs?\b/i, 'say "contractor COIs", not "sub COIs"'],
  [/\bGC requirements\b/i, 'say "project requirements", not "GC requirements"'],
  // Brand name: always "Forsured" (domain forsured.ai).
  [/\bForSure/, 'the brand is spelled "Forsured", not "ForSure"/"ForSured"'],
  [/\bforsure\b/i, 'the brand is "Forsured" (with the d)'],
  [/\bfor ?sure\.ai\b/i, 'the domain is forsured.ai'],
  [/\b(fore ?sured?|forsurred|for sured)\b/i, 'misspelled brand name'],
  [/forsured\.com/i, 'the domain is forsured.ai, not forsured.com'],
  // Unfinished or broken copy.
  [/lorem|ipsum/i, 'placeholder text'],
  [/\b(TODO|TBD|FIXME|XXX)\b/, 'unfinished copy marker'],
  [/\[(insert|placeholder|name|company|link)\b[^\]]*\]/i, 'unfilled placeholder'],
  [/\{\{[^}]*\}\}/, 'unrendered template tag'],
  [/\bundefined\b|\bNaN\b|\[object Object\]/, 'a script printed a broken value'],
  // Reads as machine-written. Keep the copy plain and specific, the way we talk to customers.
  [/\b(seamless(ly)?|leverag(e|es|ed|ing)|unlock(s|ing)?|elevat(e|es|ing)|game[- ]chang(er|ing)|revolutioni[sz]\w*|cutting[- ]edge|delve|supercharg\w*|empower\w*|next[- ]level|effortless(ly)?|robust|streamlin\w*|transformative|unparalleled|best[- ]in[- ]class|world[- ]class|state[- ]of[- ]the[- ]art|ever[- ]evolving|synerg\w*|holistic)\b/i, 'generic marketing cliché, say it plainly'],
  [/\bin today's\b|\bharness(ing)? the power\b|\bnavigat(e|ing) the complexit/i, 'boilerplate phrasing'],
  [/\w ?— ?\w/, 'em-dash aside, use a comma, period or colon', { perSegment: true }],
  // IRMI: we can be there, but never imply we are part of, sponsored or approved by IRMI.
  [/official (IRMI|CRC)|IRMI[- ]?(approved|endorsed|partner|sponsor)|(?<!(not|or|never) )(sponsored|endorsed|approved) by IRMI|in partnership with IRMI/i, 'implies an IRMI affiliation'],
];

// Founders are not public yet. Checked against the raw HTML, so comments, metadata and URLs count too.
const FOUNDERS = [/\bzach(ary)?\b/i, /servideo/i, /\bmarc\b/i];

for (const p of PAGES) {
  test.describe(`${p.name} copy`, () => {
    test('follows the wording rules', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      const { text, segments } = await pageCopy(page);
      // Most rules read the page as one string so phrases split across tags still match;
      // per-segment rules look at each text node alone (a lone "—" in a table cell is fine).
      const hits = BANNED.flatMap(([re, why, opts = {}]) =>
        (opts.perSegment ? segments : [text]).flatMap((t) => {
          const m = t.match(re);
          return m ? [`"${m[0]}" (${why}) in: …${t.slice(Math.max(0, m.index - 50), m.index + 50).trim()}…`] : [];
        })
      );
      expect(hits).toEqual([]);
    });

    test('never names the founders', async ({}, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'source check runs once');
      const html = read(p.file).replace(/data:[a-z/+]+;base64,[A-Za-z0-9+/=]+/g, '');
      for (const re of FOUNDERS) expect(html, `${re} found in ${p.file}`).not.toMatch(re);
    });

    test('has no doubled words or stray punctuation', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      const { segments } = await pageCopy(page);
      const doubled = segments.flatMap((s) => [...s.matchAll(/\b([a-z]{2,})\s+\1\b/gi)].map((m) => `"${m[0]}" in: ${s}`));
      expect(doubled, 'repeated word').toEqual([]);
      const punct = segments.flatMap((s) => [...s.matchAll(/\s[,.;:!?](?=\s|$)|[,;:]{2,}|!!|\?\?|(?<![.\w])\.\.(?!\.)|\w\.\.(?!\.)/g)].map((m) => `"${m[0]}" in: ${s}`));
      expect(punct, 'stray punctuation').toEqual([]);
    });

    test('email addresses use @forsured.ai', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      const { text } = await pageCopy(page);
      const mailtos = await page.locator('a[href^="mailto:"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      const emails = [...new Set([...(text + ' ' + mailtos.join(' ')).matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => m[0]))]
        .filter((e) => !/\.(png|jpe?g|webp|svg)$/i.test(e));
      for (const e of emails) expect(e, 'public email').toMatch(/@forsured\.ai$/);
    });

    test('footer shows the current year', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      await expect(page.locator('footer')).toContainText(`© ${new Date().getFullYear()}`);
    });

    test('pages about IRMI say we are not affiliated', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      // The temporary announcement bar can mention IRMI on its own; anything more needs the disclaimer.
      const mentions = await page.evaluate(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('#irmi-bar,script,style').forEach((n) => n.remove());
        return /\bIRMI\b/.test(clone.textContent);
      });
      test.skip(!mentions, 'page does not mention IRMI');
      await expect(page.locator('footer')).toContainText(/Not affiliated with or endorsed by IRMI/);
    });
  });
}

test('primary calls to action use the free COI risk check offer', async ({ page }) => {
  await open(page, '/', { fonts: false });
  await expect(page.locator('.hero .cta-p')).toContainText('Free COI Risk Check');
  await expect(page.locator('#demo .label')).toHaveText(/Free COI Risk Check/i);
  await expect(page.locator('#demo')).toContainText('hello@forsured.ai');
  await expect(page.locator('#demo')).toContainText(/project's requirements/);
});

test('product screens are labeled as sample data', async ({ page }) => {
  await open(page, '/', { fonts: false });
  for (const fig of ['.hero figcaption', '#product figcaption']) {
    await expect(page.locator(fig), fig).toHaveText(/Sample data\. Companies, people and projects shown are fictional\./);
  }
});
