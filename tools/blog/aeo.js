// The pre-publish checklist from Warren Brown's AEO recommendations (Get AI Authority, Nov 13 2026,
// content/aeo in project files, Section 9). build.js runs it on every gated post and refuses to build
// when anything misses, so a post that skips the brief or the structure can't ship.
//
// A post is gated when it has a brief (content/blog/briefs/<slug>.json) or is dated on or after
// GATE_FROM. Older posts are lifted into the gate one at a time, in the order Section 11 gives,
// by writing their brief. See content/blog/README.md ("AEO checklist").
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BRIEFS = path.join(ROOT, 'content', 'blog', 'briefs');
const AUTHORS = path.join(ROOT, 'content', 'authors.json');
const SITE = 'https://forsured.ai';
const GATE_FROM = '2026-11-16';

// Body word targets per post type (S4).
const WORDS = { pillar: [2000, 3000], evergreen: [1000, 1600], buyer: [1200, 2000], news: [600, 900] };
// H2s that keep their label instead of a question (S2). The first three are page furniture, not body.
const LABEL_H2 = /^(the short version|common questions|sources)$/i;
// Owned sites: not counted as outside sources (L2) or as forsured.ai pages (L1).
const OWNED = /^https?:\/\/(www\.)?(coijournal\.com|forsured\.com)/i;

// Visible-copy rules W1 to W5 (Section 8). copy.spec.js holds every page to the same list.
const WRITING = [
  [/—/, 'W1: no em dash'],
  [/\bcall to action\b|\bCTA\b|\bconversions?\b|\bfunnel\b|\bmessaging\b|positions? itself|\bvalue prop|\bICP\b|target audience|landing page|\bSERP\b|\bkeywords?\b|share of voice|\bimpressions\b|click-through|brand awareness|go-to-market|pain points?|use cases?|differentiators?|\bleverag(e|es|ed|ing)\b/i, 'W4: marketing vocabulary'],
  [/worth noting|worth stating|and that's the point|\bdeliberately\b/i, 'W5: meta-commentary'],
  [/\bcancell(ed|ing)\b(?! before the expiration date thereof)|\blicence\b|\bcatalogue\b|\bbehaviour\b|\brecognis(e|ed|es|ing)\b|\borganis(e|ed|es|ing|ation)\b/i, 'W2: US spelling'],
  [/\bAI visibility\b|\bPeec\b|\bprompt (tracking|research)\b/i, 'W6: never mention AI visibility research'],
];

const words = (s) => (String(s).trim().match(/\S+/g) || []).length;
const plain = (md) => String(md).replace(/^::video .*$/gm, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\{#[a-z0-9-]+\}/g, '').replace(/[*`|>#]/g, ' ').replace(/^-{3,}$/gm, ' ');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const count = (hay, needle) => (hay.toLowerCase().match(new RegExp(needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

function readBrief(slug) {
  const file = path.join(BRIEFS, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`content/blog/briefs/${slug}.json is not valid JSON (${e.message})`);
  }
}

// Real people who write or review posts (S8, J1). Never add a name or a title that isn't on the
// Forsured site or in an approved release (W8).
function readAuthors() {
  if (!fs.existsSync(AUTHORS)) return [];
  return JSON.parse(fs.readFileSync(AUTHORS, 'utf8')).people || [];
}

const gated = (p, brief) => Boolean(brief) || p.date >= GATE_FROM;

// Returns { fails, warns } for one post. html is the built page.
function check(p, brief, html, authors = readAuthors()) {
  const fails = [];
  const warns = [];
  const miss = (rule, msg) => fails.push(`${rule}: ${msg}`);

  // B1: the brief.
  if (!brief) {
    miss('B1', `no brief at content/blog/briefs/${p.slug}.json`);
    return { fails, warns };
  }
  const type = brief.type;
  if (!WORDS[type]) miss('B1', `brief "type" must be one of ${Object.keys(WORDS).join(', ')}`);
  const qs = brief.questions || [];
  if (qs.length < 1 || qs.length > 3) miss('B1', `brief needs 1 to 3 questions (has ${qs.length})`);
  const kws = (brief.target_keywords || []).map((k) => (typeof k === 'string' ? k : k.kw)).filter(Boolean);
  if (kws.length < 5 || kws.length > 10) miss('B1', `brief needs 5 to 10 target_keywords (has ${kws.length})`);
  if (!(brief.competing_sources || []).length) miss('B2', 'brief needs competing_sources from real research');

  const body = plain(p.body);
  const bodyLines = p.body.split('\n');
  const h2s = bodyLines.filter((l) => /^## /.test(l)).map((l) => l.replace(/^## /, '').replace(/\s*\{#[a-z0-9-]+\}$/, '').trim());
  const headings = [p.title, ...bodyLines.filter((l) => /^#{2,3} /.test(l)).map((l) => l.replace(/^#{2,3} /, '')), ...(p.faq || []).map((f) => f.q)].map(plain);

  // S1: the paragraph under the H1 (the dek) is a 40 to 60 word answer.
  const dekWords = words(plain(p.dek));
  if (dekWords < 40 || dekWords > 60) miss('S1', `the answer paragraph under the H1 (dek) is ${dekWords} words, keep it 40 to 60`);

  // S2: question-shaped H2s.
  for (const h of h2s) if (!LABEL_H2.test(h) && !/\?$/.test(h)) miss('S2', `H2 "${h}" should be a question a reader would ask`);

  // S4: depth.
  if (WORDS[type]) {
    const [lo, hi] = WORDS[type];
    const n = words(body);
    if (n < lo || n > hi) miss('S4', `body is ${n} words, a ${type} post runs ${lo} to ${hi}`);
  }

  // S5: a real table with a caption and header cells (not news).
  if (type !== 'news') {
    const prose = (html.match(/<div class="prose">([\s\S]*?)\n    <\/div>/) || [, ''])[1];
    if (!/<table>[\s\S]*?<caption>[\s\S]*?<th /.test(prose)) miss('S5', 'needs at least one table with a caption ("Table: <caption>" line above it) and header cells');
  }

  // S6: 5 to 8 FAQs of 40 to 80 words; visible text matches FAQPage.
  const faq = p.faq || [];
  if (faq.length < 5 || faq.length > 8) miss('S6', `needs 5 to 8 FAQs (has ${faq.length})`);
  for (const f of faq) {
    const n = words(plain(f.a));
    if (n < 40 || n > 80) miss('S6', `FAQ "${f.q}" answer is ${n} words, keep it 40 to 80`);
  }
  const ld = [...html.matchAll(/<script type="application\/ld\+json">\n?([\s\S]*?)\n?<\/script>/g)].map((m) => m[1]);
  const graph = ld.flatMap((j) => JSON.parse(j)['@graph'] || []);
  const faqLd = graph.find((n) => n['@type'] === 'FAQPage');
  if (faq.length && (!faqLd || faqLd.mainEntity.map((q) => q.name).join('|') !== faq.map((f) => f.q).join('|'))) miss('S6', 'FAQPage JSON-LD does not match the visible FAQ');

  // S7: one plain paragraph in the body says what Forsured does for this exact item.
  const paras = p.body.split(/\n{2,}/).filter((b) => !/^(#|\||-|\d+\.|>|!\[)/.test(b.trim()));
  if (!paras.some((b) => /\bForsured\b/.test(b))) miss('S7', 'the body needs one factual paragraph on what Forsured does for this item');

  // S8 / J1: dates-only byline at the top, a real Person at the foot.
  if (/<p class="meta">[^\n]*(By the Forsured team|min read)/.test(html)) miss('S8', 'top byline must be dates only');
  if (!/id="about-article"/.test(html)) miss('S8', 'needs the "About this article" block');
  const ids = new Set(authors.map((a) => a.id));
  if (p.author && !ids.has(p.author)) miss('S8', `author "${p.author}" is not in content/authors.json`);
  if (p.reviewer && !ids.has(p.reviewer)) miss('S8', `reviewer "${p.reviewer}" is not in content/authors.json`);
  if (!p.author) (authors.length ? fails : warns).push(`S8: no "author" yet${authors.length ? '' : ' (content/authors.json has no approved person; required once it does)'}`);

  // S9: keyword placement.
  const lowerHeadings = headings.join('\n').toLowerCase();
  for (const kw of kws) {
    if (!lowerHeadings.includes(kw.toLowerCase())) miss('S9', `"${kw}" is in no heading`);
    const n = count(body, kw);
    if (n < 5) miss('S9', `"${kw}" appears ${n} times in the body, needs 5 (or drop it from the brief)`);
  }
  const primary = kws[0];
  if (primary) {
    const seoTitle = p.seoTitle || `${p.title} | Forsured`;
    for (const [where, text] of [['title tag', seoTitle], ['H1', p.title], ['first paragraph', plain(p.dek)], ['meta description', p.description]]) {
      if (!text.toLowerCase().includes(primary.toLowerCase())) miss('S9', `primary keyword "${primary}" missing from the ${where}`);
    }
    // An existing post keeps its URL (links and citations point at it): its brief sets "slug_locked": true.
    if (!brief.slug_locked && !p.slug.includes(slugify(primary))) miss('S9', `primary keyword "${primary}" missing from the URL slug`);
  }

  // L1, L2, L3: links.
  const links = [...p.body.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({ text: m[1], href: m[2] }));
  const internal = links.filter((l) => /^\/(?!\/)/.test(l.href) || l.href.startsWith(SITE));
  const external = links.filter((l) => /^https?:\/\//.test(l.href) && !l.href.startsWith(SITE) && !OWNED.test(l.href));
  if (internal.length < 3 || internal.length > 8) miss('L1', `${internal.length} internal body links, needs 3 to 8`);
  if (external.length < 3 || external.length > 8) miss('L2', `${external.length} external body links, needs 3 to 8`);
  const hrefs = internal.map((l) => l.href.replace(SITE, '').replace(/#.*$/, ''));
  for (const want of (brief.plan && brief.plan.internal_links) || []) {
    const w = String(want).replace(SITE, '').replace(/#.*$/, '');
    if (!hrefs.some((h) => h === w || h.startsWith(w))) miss('L1', `planned internal link ${want} is missing from the body`);
  }
  if (brief.pillar && type !== 'pillar' && !hrefs.some((h) => h.startsWith(brief.pillar))) miss('L1', `link up to the pillar ${brief.pillar}`);
  const extHrefs = external.map((l) => l.href);
  for (const want of (brief.plan && brief.plan.external_links) || []) {
    const w = typeof want === 'string' ? want : want.url;
    if (w && !extHrefs.some((h) => h.startsWith(w))) miss('L2', `planned external link ${w} is missing from the body`);
  }
  for (const l of links) if (/^(https?:\/\/|www\.)/i.test(l.text)) miss('L3', `link text "${l.text}" is a bare URL, use descriptive words`);
  const bare = p.body.replace(/\[[^\]]*\]\([^)]*\)/g, '');
  if (/\bhttps?:\/\/|\bwww\.\w/.test(bare)) miss('L3', 'visible URL in the body');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(bare)) miss('L3', 'email address not in a mailto: link');

  // J1, J2, J3, J5, J6.
  const article = graph.find((n) => n['@type'] === 'BlogPosting') || {};
  if (!article.publisher || article.publisher['@id'] !== `${SITE}/#organization` || Object.keys(article.publisher).length !== 1) miss('J2', 'publisher must be {"@id": "https://forsured.ai/#organization"} only');
  if (p.author && (!article.author || article.author['@id'] !== `${SITE}/#${p.author}`)) miss('J1', 'author must be the Person @id');
  for (const m of [...(article.mentions || []), ...(article.about || []).filter((a) => a['@type'] !== 'Thing')]) if (!m.url) miss('J3', `mention "${m.name}" needs a url`);
  if (article.dateModified !== p.updated) miss('J5', 'dateModified must equal the updated date');
  if (p.updated && p.updated.slice(0, 10) !== p.date.slice(0, 10) && !html.includes(`Updated <time datetime="${p.updated.slice(0, 10)}"`)) miss('J5', 'visible "Updated" date missing from the byline');
  if (/<!--/.test(html)) miss('J6', 'HTML comment in the published page');
  if (ld.some((j) => /\n/.test(j.trim()))) miss('J6', 'JSON-LD must be minified');

  // W1 to W6 on the post's own copy.
  const copy = [p.title, p.dek, p.description, ...p.takeaways, body, ...faq.flatMap((f) => [f.q, plain(f.a)])].join('\n');
  for (const [re, why] of WRITING) {
    const m = copy.match(re);
    if (m) miss(why.slice(0, 2), `${why}: "${m[0]}" in …${copy.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\n/g, ' ')}…`);
  }
  // W9: the not-advice line (the Sources note carries it).
  if (!/general information, not legal or insurance advice/i.test(html)) miss('W9', 'needs the "general information, not legal or insurance advice" line');

  // HTML structure.
  const opens = (t) => (html.match(new RegExp(`<${t}[\\s>]`, 'g')) || []).length;
  const closes = (t) => (html.match(new RegExp(`</${t}>`, 'g')) || []).length;
  if (!html.trimEnd().endsWith('</html>') || !html.includes('</body>')) miss('HTML', 'page must end with </body></html>');
  for (const t of ['script', 'div', 'section']) if (opens(t) !== closes(t)) miss('HTML', `<${t}> opened ${opens(t)} times, closed ${closes(t)}`);

  return { fails, warns };
}

module.exports = { check, readBrief, readAuthors, gated, GATE_FROM, WRITING, WORDS };
