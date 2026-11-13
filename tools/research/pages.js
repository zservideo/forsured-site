// Builds forsured.ai/research/: a summary of every released COI Journal report, each linking to the full
// report on coijournal.com. COI Journal is Forsured's editorial site. The reports live there only, so
// this page is a landing page with summaries, never a copy (one home per report keeps search and AI
// answer engines pointed at a single URL).
//   research/index.html   the hub
//   research/index.md     the hub as plain Markdown, for AI answer engines
//
// Data: content/research/coi-journal.json. Reports dated after its "through" date are held, and the
// Release COI Journal research workflow moves that date each weekday, the same schedule COI Journal
// uses. Not run on its own: node tools/blog/build.js writes these files, and --check covers them.
const fs = require('fs');
const path = require('path');
const { esc, head, nav, FOOTER, BAND, ORG, WEBSITE, SITE, ROOT, human } = require('../blog/build');

const URL = '/research/';
const TITLE = 'Research from COI Journal';
const DESC = 'White papers and analyst briefs on contractor COIs, endorsements and project requirements from COI Journal, the editorial site published by Forsured.';
const JOURNAL = 'https://coijournal.com';
const JOURNAL_ORG = { '@type': 'NewsMediaOrganization', '@id': `${JOURNAL}/#publication`, name: 'COI Journal', url: `${JOURNAL}/`, parentOrganization: { '@id': ORG['@id'] } };

const data = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'research', 'coi-journal.json'), 'utf8'));
const released = () => {
  const d = data();
  for (const r of d.reports) for (const k of ['number', 'kind', 'title', 'summary', 'url', 'date']) if (!r[k]) throw new Error(`content/research/coi-journal.json: ${r.number || '?'} needs "${k}"`);
  return d.reports.filter((r) => r.date <= d.through).sort((a, b) => (a.number < b.number ? 1 : -1));
};
const kinds = (list) => [['White paper', 'White papers'], ['Analyst brief', 'Analyst briefs']].map(([k, label]) => [label, list.filter((r) => r.kind === k)]).filter(([, l]) => l.length);

const CSS = `
.r-intro{max-width:700px;margin-top:28px}
.r-intro p{font-size:17px;line-height:1.75;margin-top:16px}
.r-intro a,.r-list a{text-decoration:underline;text-decoration-color:#FB612A;text-underline-offset:3px}
.r-group{margin-top:44px}
.r-group h2{font-family:var(--serif);font-weight:400;font-size:26px;letter-spacing:-.015em}
.r-list{list-style:none;margin-top:16px;display:grid;gap:10px}
.r-list li{padding:16px 18px;background:#fff;border:1px solid #E4E7EC;border-radius:10px}
.r-list .r-no{display:block;font-size:13px;font-weight:600;color:#344051}
.r-list a{display:inline-block;font-family:var(--serif);font-size:19px;line-height:1.35;margin-top:6px}
.r-list p{font-size:15px;line-height:1.6;color:var(--mt);margin-top:6px}
.r-more{margin:40px 0 72px;font-size:15px}
.r-more a{text-decoration:underline;text-decoration-color:#FB612A;text-underline-offset:3px}
`.trim();

function page(list) {
  const graph = [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE}${URL}#collection`,
      name: TITLE,
      url: `${SITE}${URL}`,
      description: DESC,
      publisher: ORG,
      isPartOf: { '@id': WEBSITE['@id'] },
      inLanguage: 'en-US',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: list.length,
        itemListElement: list.map((r, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Report', '@id': `${r.url}#report`, name: r.title, url: r.url, reportNumber: r.number, datePublished: r.date, publisher: { '@id': JOURNAL_ORG['@id'] } } })),
      },
    },
    JOURNAL_ORG,
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Forsured', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'Research', item: `${SITE}${URL}` }] },
    WEBSITE,
  ];
  return `${head({ title: 'Research: COI white papers and analyst briefs | Forsured', description: DESC, url: URL, image: '/og-image.png', imageAlt: TITLE, type: 'website', md: true, css: CSS, jsonld: { '@context': 'https://schema.org', '@graph': graph } })}
${nav('research')}

<main id="main" class="edge">
  <header class="index-head">
    <span class="label">Research</span>
    <h1 style="margin-top:16px">${TITLE}</h1>
    <p class="dek">${list.length} white papers and analyst briefs on where contractor COIs break and the checks that catch it. Each one is written and sourced by the editors of <a href="${JOURNAL}/">COI Journal</a>, the editorial site Forsured publishes.</p>
  </header>
  <div class="r-intro">
    <p>COI Journal is vendor neutral. It doesn't rank or review software, ours included. Our product pages are here on forsured.ai. Its reports are general information, not legal or insurance advice.</p>
  </div>
${kinds(list).map(([label, l], i) => `  <section class="r-group" aria-labelledby="rg-${i}">
    <h2 id="rg-${i}">${label}</h2>
    <ul class="r-list">${l.map((r) => `<li><span class="r-no">${esc(r.number)} · ${human(r.date)}</span><a href="${esc(r.url)}">${esc(r.title)}</a><p>${esc(r.summary)}</p></li>`).join('')}</ul>
  </section>`).join('\n')}
  <p class="r-more">New reports go out every weekday. Read them all at <a href="${JOURNAL}/reports/">coijournal.com/reports</a>, or get them weekly in <a href="${JOURNAL}/digest/">The COI Digest</a>.</p>
</main>

${BAND}

${FOOTER()}`;
}

function markdown(list) {
  return `# ${TITLE}

> ${DESC}

COI Journal (${JOURNAL}) is the editorial site published by Forsured. It is vendor neutral and does not rank software. Each report below lives on coijournal.com. General information, not legal or insurance advice.

${kinds(list).map(([label, l]) => `## ${label}\n\n${l.map((r) => `- [${r.number}: ${r.title}](${r.url}): ${r.summary} Markdown: ${r.url}index.md`).join('\n')}`).join('\n\n')}

---
Forsured: construction insurance compliance software. ${SITE} · hello@forsured.ai
`;
}

function build() {
  const list = released();
  const files = new Map([['research/index.html', page(list)], ['research/index.md', markdown(list)]]);
  const llms = [`COI Journal (${JOURNAL}) is the vendor-neutral editorial site published by Forsured. Reports live there; this is the index.\n`, `- [${TITLE}](${SITE}${URL}): ${DESC} Markdown: ${SITE}${URL}index.md`, ...list.map((r) => `- [${r.number}: ${r.title}](${r.url}): ${r.summary}`)].join('\n');
  return { files, url: URL, llms, updated: list.length ? list[0].date : null };
}

module.exports = { build, URL };
