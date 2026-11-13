// Warren Brown's AEO pre-publish checklist (tools/blog/aeo.js, content/blog/README.md "AEO checklist").
// build.js already refuses to build a gated post that misses an item; these tests say which item, and
// hold every published page to the rules that apply site-wide (J2, J6, J7).
const { test, expect } = require('@playwright/test');
const { PAGES, read } = require('./helpers');
const { readPosts } = require('../tools/blog/build');
const aeo = require('../tools/blog/aeo');

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'source checks run once'));

for (const p of readPosts()) {
  const brief = aeo.readBrief(p.slug);
  if (!aeo.gated(p, brief)) continue;
  test(`${p.slug} passes the AEO checklist`, () => {
    const { fails } = aeo.check(p, brief, read(`blog/${p.slug}/index.html`));
    expect(fails).toEqual([]);
  });
}

test('every post on or after the gate date has a brief', () => {
  const missing = readPosts().filter((p) => p.date >= aeo.GATE_FROM && !aeo.readBrief(p.slug)).map((p) => p.slug);
  expect(missing).toEqual([]);
});

test('no published page carries an HTML comment, and JSON-LD is minified (J6)', () => {
  for (const p of PAGES) {
    const html = read(p.file);
    expect(html.includes('<!--'), `${p.file} has an HTML comment`).toBe(false);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) expect(m[1].trim().includes('\n'), `${p.file} JSON-LD is pretty-printed`).toBe(false);
  }
});

test('homepage defines the canonical Organization and SoftwareApplication by @id (J2, J7)', () => {
  const html = read('index.html');
  const nodes = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const j = JSON.parse(m[1]);
    return j['@graph'] || [j];
  });
  const org = nodes.find((n) => n['@type'] === 'Organization');
  expect(org['@id']).toBe('https://forsured.ai/#organization');
  expect(org.logo.url).toBe('https://forsured.ai/logo-orange.png');
  expect(org.sameAs.length).toBeGreaterThan(0);
  const app = nodes.find((n) => n['@type'] === 'SoftwareApplication');
  expect(app['@id']).toBe('https://forsured.ai/#software');
});

test('authors are real, complete people (S8, J1, W8)', () => {
  const ids = new Set();
  for (const a of aeo.readAuthors()) {
    for (const k of ['id', 'name', 'jobTitle', 'linkedin', 'source']) expect(a[k], `${a.id || a.name}: ${k}`).toBeTruthy();
    expect(ids.has(a.id), `duplicate ${a.id}`).toBe(false);
    ids.add(a.id);
  }
});
