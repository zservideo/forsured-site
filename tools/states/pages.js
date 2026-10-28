// Builds the contractor insurance guides from content/coi-requirements/states.js:
//   coi-requirements/index.html           hub: every state in one table, linked from the site footer
//   coi-requirements/<slug>/index.html    one page per state (50 states and DC)
//   coi-requirements/<slug>/index.md      the page as plain Markdown, for AI answer engines
//
// Not run on its own: node tools/blog/build.js writes these files along with the sitemap and
// llms.txt entries, and --check covers them. Share cards come from node tools/states/og.js.
const fs = require('fs');
const path = require('path');
const { esc, human, head, nav, FOOTER, BAND, ORG, WEBSITE, SITE, ROOT } = require('../blog/build');
const { REVIEWED, SHARED, STATES } = require('../../content/coi-requirements/states');

const HUB = '/coi-requirements/';
const HUB_TITLE = 'Contractor insurance requirements by state';
const url = (s) => `${HUB}${s.slug}/`;

// Extra styles for these pages. Everything else (nav, prose, tables, cards, band, footer) is the blog's.
const CSS = `
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:28px;list-style:none}
.fact{padding:16px 18px;background:#fff;border:1px solid #E4E7EC;border-radius:10px}
.fact h2{font-family:var(--sans);font-size:13px;font-weight:600;line-height:1.4;color:#344051}
.fact p{font-family:var(--serif);font-size:19px;line-height:1.3;letter-spacing:-.01em;margin-top:8px}
.prose .fine{font-size:15px;color:var(--mt)}
.hub-intro{max-width:700px;margin-top:28px}
.hub-intro p{font-size:17px;line-height:1.75;margin-top:16px}
.hub-intro a,.states-all p a{text-decoration:underline;text-decoration-color:#FB612A;text-underline-offset:3px}
.hub-table{margin-top:40px}
.hub-table h2,.states-all h2{font-family:var(--serif);font-weight:400;font-size:26px;letter-spacing:-.015em}
.hub-table .table{margin-top:16px}
.hub-table table{border-collapse:collapse;width:100%;min-width:760px;font-size:14px;line-height:1.5}
.hub-table th,.hub-table td{text-align:left;padding:10px 14px;border-bottom:1px solid #E4E7EC;vertical-align:top}
.hub-table thead th{font-size:13px;font-weight:600;color:#344051;background:#F9FAFB}
.hub-table tbody th{font-weight:500}
.hub-table tbody th a{display:inline-block;line-height:24px;text-decoration:underline;text-decoration-color:#FB612A;text-underline-offset:3px}
.hub-table tr:last-child>*{border-bottom:0}
.states-all{padding:48px 0 72px}
.states-all p{color:var(--mt);margin-top:8px;font-size:15px}
.states{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-top:20px;list-style:none}
.states a{display:block;padding:10px 14px;background:#fff;border:1px solid #E4E7EC;border-radius:8px;font-size:14px;line-height:24px;text-decoration:none;transition:border-color .15s}
.states a:hover{border-color:#FB612A}
@media(max-width:768px){.facts{grid-template-columns:1fr}.hub-intro p{font-size:16px}}
`.trim();

// ---------- wording ----------

const caseCite = (cite) => cite.replace(/^no (general )?statute; /, '');

function aiText(s) {
  const { kind, cite, text } = s.ai;
  if (kind === 'custom') return text;
  if (kind === 'sole') return `${s.name}'s anti-indemnity statute (${cite}) voids construction contract clauses that make a contractor indemnify another party for that party's sole negligence. Clauses that cover shared fault are generally allowed.`;
  if (kind === 'broad') return `${s.name}'s anti-indemnity statute (${cite}) voids construction contract clauses that make a contractor indemnify another party for that party's own negligence, even in part. Clauses limited to the contractor's own share of fault generally hold up.`;
  return `${s.name} has no general construction anti-indemnity statute. Courts there generally enforce a clause that covers a party's own negligence only when the clause says so clearly (${caseCite(cite)}).`;
}

function aiInsure(s) {
  if (s.ai.insure === 'yes' && !/additional insured/.test(s.ai.text || '')) {
    return 'The statute also reaches insurance: a contract can\'t use an additional insured requirement to get coverage for the other party\'s negligence that the indemnity rule forbids.';
  }
  if (s.ai.insure === 'maybe') return 'Some commentators read the statute as also voiding additional insured coverage for the other party\'s sole negligence.';
  return '';
}

function aiAt(s) {
  const base = s.ai.at || { sole: 'Sole negligence', broad: 'Own negligence, even in part', none: 'No general statute' }[s.ai.kind];
  return s.ai.insure === 'yes' ? `${base}; reaches additional insured` : base;
}

// How the state's workers' comp rule changes what a COI reviewer should look for.
function wcKind(s) {
  if (s.wc.mono) return 'mono';
  if (/^(Not required|Optional)/.test(s.wc.at)) return 'optional';
  if (/^(1 employee|All employers)/.test(s.wc.at)) return 'all';
  return 'threshold';
}

function checks(s) {
  const wc = {
    mono: `**Workers' comp.** ${s.name} workers' comp comes only from the state fund, so a private carrier's workers' comp line on the COI doesn't cover work there. Ask for the state fund certificate, and look for stop gap employers liability, which is usually added to the general liability policy.`,
    optional: `**Workers' comp.** ${s.name} doesn't make most private contractors carry it on private work, so your project requirements decide. If you require it, check that the COI shows workers' comp and employers liability limits.`,
    threshold: `**Workers' comp.** A contractor below ${s.name}'s threshold can legally go without it, but your project requirements can still require it. Decide what you'll accept, and get an exemption or a policy in writing.`,
    all: `**Workers' comp.** Nearly every contractor with employees needs it in ${s.name}. A contractor with a crew and no workers' comp on its COI is a gap.`,
  }[wcKind(s)];
  const where = wcKind(s) === 'mono' ? '' : ` For an out-of-state contractor, confirm ${s.name} is listed on the workers' comp policy.`;
  const gl = s.lic.at === 'No statewide minimum'
    ? `**General liability.** ${s.name} doesn't set a statewide floor for a general contractor license, so your project requirements set the bar. Compare each limit on the COI with what the contract asks for.`
    : `**General liability.** A ${s.name} license only shows the contractor met the state's floor. Compare each limit on the COI with your project requirements, which are usually higher.`;
  const ai = s.ai.insure === 'yes'
    ? `**Additional insured.** In ${s.name}, the anti-indemnity statute also limits what an additional insured requirement can do. Ask your broker or attorney which wording holds up, then check that the endorsement on file matches it.`
    : `**Additional insured.** The endorsement is a separate promise from the indemnity clause, so check both. Ask for the endorsement itself, not just a box ticked on the certificate.`;
  return [
    wc + where,
    gl,
    ai,
    '**Dates.** Every policy should run through the end of the job. A COI only shows coverage on the day it was issued, so check again at each renewal.',
  ];
}

const md = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const plain = (t) => t.replace(/\*\*/g, '');

function sourcesFor(s) {
  const list = [...s.sources, SHARED.grsm];
  if (s.ai.insure === 'yes') list.push(SHARED.dm);
  if (s.ai.insure === 'maybe') list.push(SHARED.irmi);
  list.push(SHARED.dol);
  return list.filter((x, i) => list.findIndex((y) => y.url === x.url) === i);
}

function faq(s) {
  return [
    { q: `Do contractors need workers' comp in ${s.name}?`, a: [s.wc.short, s.wc.detail].filter(Boolean).join(' ') },
    { q: `Does ${s.name} require contractors to carry general liability insurance?`, a: [s.lic.short, s.lic.detail].filter(Boolean).join(' ') },
    { q: `Can a ${s.name} construction contract make a contractor cover another party's negligence?`, a: [aiText(s), aiInsure(s)].filter(Boolean).join(' ') },
  ];
}

const meta = (s) => ({
  title: `${s.name} Contractor Insurance Requirements | Forsured`,
  h1: `${s.name} contractor insurance requirements`,
  description: `${s.name} workers' comp rules, contractor license insurance minimums and anti-indemnity limits, plus what to check on a contractor COI. Sources linked.`,
  dek: `What ${s.name} law says about workers' comp, contractor license insurance and indemnity clauses, and what to check on a contractor COI for a project there.`,
});

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ORG_REF = { '@id': ORG['@id'] };

// ---------- state page ----------

function statePage(s) {
  const m = meta(s);
  const sources = sourcesFor(s);
  const qa = faq(s);
  const image = `${url(s)}og.png`;
  const [agencyName, agencyUrl] = s.wc.agency;
  const graph = [
    {
      '@type': 'Article',
      '@id': `${SITE}${url(s)}#article`,
      headline: m.h1,
      description: m.description,
      image: { '@type': 'ImageObject', url: `${SITE}${image}`, width: 1200, height: 630 },
      datePublished: REVIEWED,
      dateModified: REVIEWED,
      author: ORG_REF,
      publisher: ORG,
      mainEntityOfPage: `${SITE}${url(s)}`,
      inLanguage: 'en-US',
      about: [{ '@type': 'Thing', name: 'Contractor insurance requirements' }, { '@type': 'Thing', name: 'Certificates of insurance' }],
      spatialCoverage: { '@type': 'AdministrativeArea', name: s.name, address: { '@type': 'PostalAddress', addressRegion: s.code, addressCountry: 'US' } },
      isPartOf: { '@id': `${SITE}${HUB}#collection` },
      encoding: { '@type': 'MediaObject', encodingFormat: 'text/markdown', contentUrl: `${SITE}${url(s)}index.md` },
      citation: sources.map((c) => ({ '@type': 'CreativeWork', name: c.title, url: c.url, publisher: { '@type': 'Organization', name: c.publisher } })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Forsured', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'COI requirements by state', item: `${SITE}${HUB}` },
        { '@type': 'ListItem', position: 3, name: s.name, item: `${SITE}${url(s)}` },
      ],
    },
    { '@type': 'FAQPage', mainEntity: qa.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    WEBSITE,
  ];
  const others = STATES.filter((o) => o !== s);
  return `${head({
    title: m.title,
    description: m.description,
    url: url(s),
    image,
    imageAlt: m.h1,
    type: 'article',
    published: REVIEWED,
    modified: REVIEWED,
    section: 'COI requirements by state',
    md: true,
    css: CSS,
    jsonld: { '@context': 'https://schema.org', '@graph': graph },
  })}
${nav('states')}

<main id="main">
<article class="edge">
  <div class="col">
    <header class="post-head">
      <p class="crumbs"><a href="${HUB}">COI requirements by state</a> / ${esc(s.name)}</p>
      <span class="label">State guide</span>
      <h1 style="margin-top:16px">${esc(m.h1)}</h1>
      <p class="dek">${esc(m.dek)}</p>
      <p class="meta"><span>By the Forsured team</span><span>Reviewed <time datetime="${REVIEWED}">${human(REVIEWED)}</time></span></p>
    </header>
    <ul class="facts">
      <li class="fact"><h2>Workers' comp required at</h2><p>${esc(s.wc.at)}</p></li>
      <li class="fact"><h2>License insurance minimum</h2><p>${esc(s.lic.at)}</p></li>
      <li class="fact"><h2>Anti-indemnity statute voids</h2><p>${esc(aiAt(s))}</p></li>
    </ul>
    <aside class="tldr" aria-labelledby="tldr">
      <h2 id="tldr">The short version</h2>
      <ul><li>${esc(s.wc.short)}</li><li>${esc(s.lic.short)}</li><li>${esc(aiText(s))}</li></ul>
    </aside>
    <div class="prose">
<h2 id="workers-comp">Workers' comp in ${esc(s.name)}</h2>
<p>${esc(s.wc.short)}${s.wc.detail ? ` ${esc(s.wc.detail)}` : ''}</p>
<p>The agency in charge is the <a href="${esc(agencyUrl)}">${esc(agencyName)}</a>. It can tell you whether a specific business needs coverage, and most states let you look up an employer's policy online.</p>
<h2 id="licensing">Contractor licensing and insurance</h2>
<p>${esc(s.lic.short)}${s.lic.detail ? ` ${esc(s.lic.detail)}` : ''}</p>
<h2 id="indemnity">Indemnity and additional insured clauses</h2>
<p>${esc(aiText(s))}${aiInsure(s) ? ` ${esc(aiInsure(s))}` : ''}</p>
${(s.notes || []).map((n) => `<h2 id="${slugify(n.h)}">${esc(n.h)}</h2>\n<p>${esc(n.p)}</p>`).join('\n')}
<h2 id="checklist">What to check on a contractor COI for a ${esc(s.name)} project</h2>
<ol>${checks(s).map((c) => `<li>${md(c)}</li>`).join('')}</ol>
<p>Forsured checks every contractor COI against your project requirements, then keeps checking for the life of the project. Send us one project's requirements and a contractor COI or two for a <a href="/#demo">free COI risk check</a>.</p>
    </div>
    <section class="extra" aria-labelledby="faq">
      <h2 id="faq">Common questions</h2>
${qa.map((f) => `      <h3>${esc(f.q)}</h3>\n      <p>${esc(f.a)}</p>`).join('\n')}
    </section>
    <section class="extra sources" aria-labelledby="sources">
      <h2 id="sources">Sources</h2>
      <ol>${sources.map((c) => `<li><a href="${esc(c.url)}">${esc(c.title)}</a>, ${esc(c.publisher)}${c.date ? `, ${esc(c.date)}` : ''}</li>`).join('')}</ol>
      <p class="note">This guide is general information, not legal advice. Laws change and every contract is different, so confirm with the state agency, your broker or your attorney before you rely on it. Last reviewed ${human(REVIEWED)}. Spotted something out of date? Write to <a href="mailto:hello@forsured.ai">hello@forsured.ai</a> and we'll fix it.</p>
    </section>
  </div>
</article>
<section class="more" aria-labelledby="more"><div class="edge">
  <h2 id="more">Other states</h2>
  <ul class="states">${others.map((o) => `<li><a href="${url(o)}">${esc(o.name)}</a></li>`).join('')}</ul>
</div></section>
</main>

${BAND}

${FOOTER()}`;
}

function stateMarkdown(s) {
  const m = meta(s);
  const sources = sourcesFor(s);
  return `# ${m.h1}

> ${m.dek}

Reviewed ${human(REVIEWED)} by Forsured. Source: ${SITE}${url(s)}

## The short version

- Workers' comp required at: ${s.wc.at}
- License insurance minimum: ${s.lic.at}
- Anti-indemnity statute voids: ${aiAt(s)}

## Workers' comp in ${s.name}

${[s.wc.short, s.wc.detail].filter(Boolean).join(' ')}

Agency: [${s.wc.agency[0]}](${s.wc.agency[1]})

## Contractor licensing and insurance

${[s.lic.short, s.lic.detail].filter(Boolean).join(' ')}

## Indemnity and additional insured clauses

${[aiText(s), aiInsure(s)].filter(Boolean).join(' ')}
${(s.notes || []).map((n) => `\n## ${n.h}\n\n${n.p}\n`).join('')}
## What to check on a contractor COI for a ${s.name} project

${checks(s).map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Common questions

${faq(s).map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Sources

${sources.map((c, i) => `${i + 1}. [${c.title}](${c.url}), ${c.publisher}${c.date ? `, ${c.date}` : ''}`).join('\n')}

General information, not legal advice. Confirm with the state agency, your broker or your attorney.

---
Forsured: construction insurance compliance software. ${SITE} · hello@forsured.ai
`;
}

// ---------- hub ----------

const HUB_DESC = 'Contractor insurance requirements for all 50 states and DC: workers\' comp thresholds, license insurance minimums and anti-indemnity rules, with sources.';

function hubPage() {
  const graph = [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE}${HUB}#collection`,
      name: HUB_TITLE,
      url: `${SITE}${HUB}`,
      description: HUB_DESC,
      dateModified: REVIEWED,
      publisher: ORG,
      isPartOf: { '@id': WEBSITE['@id'] },
      inLanguage: 'en-US',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: STATES.length,
        itemListElement: STATES.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: meta(s).h1, url: `${SITE}${url(s)}` })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Forsured', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'COI requirements by state', item: `${SITE}${HUB}` },
      ],
    },
    WEBSITE,
  ];
  return `${head({
    title: 'Contractor Insurance Requirements by State | Forsured',
    description: HUB_DESC,
    url: HUB,
    image: `${HUB}og.png`,
    imageAlt: HUB_TITLE,
    type: 'website',
    md: true,
    css: CSS,
    jsonld: { '@context': 'https://schema.org', '@graph': graph },
  })}
${nav('states')}

<main id="main" class="edge">
  <header class="index-head">
    <span class="label">COI requirements by state</span>
    <h1 style="margin-top:16px">${HUB_TITLE}</h1>
    <p class="dek">Every state sets its own rules for workers' comp, contractor licensing and indemnity clauses. Here's what each one says, with the sources linked, and what it means for the contractor COIs on your projects.</p>
    <p class="meta"><span>By the Forsured team</span><span>Reviewed <time datetime="${REVIEWED}">${human(REVIEWED)}</time></span></p>
  </header>
  <div class="hub-intro">
    <p><strong>Workers' comp</strong> is where states differ most. Most require it from the first employee, some start at three, four or five, construction often has its own lower line, and four states only allow coverage from a state fund.</p>
    <p><strong>License insurance minimums</strong> are a floor for getting licensed, not a standard for your project. Many states set none, and the ones that do set them well below what most project requirements ask for.</p>
    <p><strong>Anti-indemnity statutes</strong> limit how much of another party's negligence a contract can push onto a contractor. In a handful of states they also limit additional insured requirements.</p>
    <p>These guides are general information, not legal advice. Confirm with the state agency, your broker or your attorney before you rely on them.</p>
  </div>
  <section class="hub-table" aria-labelledby="all-states">
    <h2 id="all-states">All 50 states and DC at a glance</h2>
    <div class="table" role="region" aria-label="State requirements table, scrolls sideways on small screens" tabindex="0"><table>
      <thead><tr><th scope="col">State</th><th scope="col">Workers' comp required at</th><th scope="col">License insurance minimum</th><th scope="col">Anti-indemnity statute voids</th></tr></thead>
      <tbody>
${STATES.map((s) => `        <tr><th scope="row"><a href="${url(s)}">${esc(s.name)}</a></th><td>${esc(s.wc.at)}</td><td>${esc(s.lic.at)}</td><td>${esc(aiAt(s))}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
  </section>
  <section class="states-all" aria-labelledby="guides">
    <h2 id="guides">State guides</h2>
    <p>Each guide covers workers' comp, licensing insurance and indemnity in that state, plus a checklist for the contractor COIs on a project there.</p>
    <ul class="states">${STATES.map((s) => `<li><a href="${url(s)}">${esc(s.name)}</a></li>`).join('')}</ul>
  </section>
</main>

${BAND}

${FOOTER()}`;
}

function hubMarkdown() {
  return `# ${HUB_TITLE}

> ${HUB_DESC}

Reviewed ${human(REVIEWED)} by Forsured. Source: ${SITE}${HUB}

| State | Workers' comp required at | License insurance minimum | Anti-indemnity statute voids |
| --- | --- | --- | --- |
${STATES.map((s) => `| [${s.name}](${SITE}${url(s)}) | ${s.wc.at} | ${s.lic.at} | ${aiAt(s)} |`).join('\n')}

General information, not legal advice. Each state guide lists its sources.

---
Forsured: construction insurance compliance software. ${SITE} · hello@forsured.ai
`;
}

// ---------- output ----------

function build() {
  for (const s of STATES) {
    const m = meta(s);
    if (m.title.length > 70) throw new Error(`${s.name}: page title is ${m.title.length} characters`);
    if (m.description.length < 70 || m.description.length > 170) throw new Error(`${s.name}: description is ${m.description.length} characters`);
  }
  const missing = [`${HUB}og.png`, ...STATES.map((s) => `${url(s)}og.png`)].filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) throw new Error(`missing share cards (run node tools/states/og.js): ${missing.join(', ')}`);

  const files = new Map();
  files.set('coi-requirements/index.html', hubPage());
  files.set('coi-requirements/index.md', hubMarkdown());
  for (const s of STATES) {
    files.set(`coi-requirements/${s.slug}/index.html`, statePage(s));
    files.set(`coi-requirements/${s.slug}/index.md`, stateMarkdown(s));
  }
  const llms = [
    `- [${HUB_TITLE}](${SITE}${HUB}): ${HUB_DESC} Markdown: ${SITE}${HUB}index.md`,
    ...STATES.map((s) => `- [${meta(s).h1}](${SITE}${url(s)}): workers' comp required at ${s.wc.at}; license insurance minimum: ${s.lic.at}; anti-indemnity statute voids: ${aiAt(s)}. Markdown: ${SITE}${url(s)}index.md`),
  ].join('\n');
  return { files, urls: [HUB, ...STATES.map(url)], reviewed: REVIEWED, llms };
}

module.exports = { build, STATES, HUB, HUB_TITLE, url, meta };
