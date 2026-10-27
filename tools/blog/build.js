#!/usr/bin/env node
// Builds the Forsured blog from content/blog/*.md into static pages GitHub Pages can serve:
//   blog/index.html             the blog index (knowledge center)
//   blog/<slug>/index.html      one page per post, with BlogPosting, FAQPage and breadcrumb JSON-LD
//   blog/feed.xml               RSS 2.0 feed with the full text of every post
//   sitemap.xml, robots.txt, llms.txt   search and answer-engine discovery files
//
//   node tools/blog/build.js           write everything
//   node tools/blog/build.js --check   exit 1 if any generated file is out of date (tests run this)
//
// A post is a Markdown file whose first lines are a JSON front-matter block between `---` lines.
// See content/blog/README.md for the fields and the writing rules.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'content', 'blog');
const SITE = 'https://forsured.ai';
const CHECK = process.argv.includes('--check');

// ---------- reading posts ----------

function readPosts() {
  return fs
    .readdirSync(SRC)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => {
      const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!m) throw new Error(`${f}: missing the --- JSON front matter block`);
      let meta;
      try {
        meta = JSON.parse(m[1]);
      } catch (e) {
        throw new Error(`${f}: front matter is not valid JSON (${e.message})`);
      }
      const slug = f.replace(/\.md$/, '');
      for (const k of ['title', 'description', 'dek', 'date', 'category', 'takeaways', 'sources']) {
        if (!meta[k] || (Array.isArray(meta[k]) && !meta[k].length)) throw new Error(`${f}: front matter needs "${k}"`);
      }
      // The same limits seo.spec.js holds every page to, caught here before a page is built.
      const seoTitle = meta.seoTitle || `${meta.title} | Forsured`;
      if (seoTitle.length < 30 || seoTitle.length > 70) throw new Error(`${f}: page title is ${seoTitle.length} characters, keep it 30 to 70 (set "seoTitle")`);
      if (meta.description.length < 70 || meta.description.length > 170) throw new Error(`${f}: description is ${meta.description.length} characters, keep it 70 to 170`);
      if (meta.draft) return null;
      const body = m[2].trim();
      const words = (body + ' ' + meta.takeaways.join(' ')).split(/\s+/).length;
      return { ...meta, slug, body, url: `/blog/${slug}/`, minutes: Math.max(2, Math.round(words / 230)), updated: meta.updated || meta.date };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
}

// ---------- a small Markdown subset ----------
// Blocks: ## and ### headings, paragraphs, - and 1. lists, > quotes, | tables |.
// Inline: **bold**, *italic*, [text](url), `code`.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
}

const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function markdown(md) {
  const out = [];
  for (const block of md.split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    const first = lines[0];
    let h;
    if ((h = first.match(/^(#{2,3}) (.+)$/))) {
      const level = h[1].length;
      out.push(`<h${level} id="${slugify(h[2])}">${inline(h[2])}</h${level}>`);
    } else if (lines.every((l) => /^- /.test(l) || /^ {2,}\S/.test(l))) {
      out.push('<ul>' + joinItems(lines, /^- /).map((i) => `<li>${inline(i)}</li>`).join('') + '</ul>');
    } else if (lines.every((l) => /^\d+\. /.test(l) || /^ {2,}\S/.test(l))) {
      out.push('<ol>' + joinItems(lines, /^\d+\. /).map((i) => `<li>${inline(i)}</li>`).join('') + '</ol>');
    } else if (lines.every((l) => /^>/.test(l))) {
      const text = lines.map((l) => l.replace(/^> ?/, '')).join(' ');
      const [quote, cite] = text.split(/\s+--\s+/);
      out.push(`<blockquote><p>${inline(quote)}</p>${cite ? `<cite>${inline(cite)}</cite>` : ''}</blockquote>`);
    } else if (lines.every((l) => /^\|.*\|$/.test(l))) {
      const rows = lines.filter((l) => !/^\|[\s:|-]+\|$/.test(l)).map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
      const [head, ...rest] = rows;
      out.push(
        '<div class="table"><table><thead><tr>' + head.map((c) => `<th scope="col">${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          rest.map((r) => '<tr>' + r.map((c, i) => (i ? `<td>${inline(c)}</td>` : `<th scope="row">${inline(c)}</th>`)).join('') + '</tr>').join('') +
          '</tbody></table></div>'
      );
    } else {
      out.push(`<p>${inline(lines.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

function joinItems(lines, marker) {
  const items = [];
  for (const l of lines) {
    if (marker.test(l)) items.push(l.replace(marker, ''));
    else items[items.length - 1] += ' ' + l.trim();
  }
  return items;
}

const plain = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '');

// ---------- shared page parts ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso) => iso.slice(0, 10);
const human = (iso) => {
  const [y, m, d] = day(iso).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
const rfc822 = (iso) => new Date(iso).toUTCString();
const year = () => new Date().getFullYear();

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23FB612A'/%3E%3Ctext x='4' y='24' font-family='Arial' font-weight='900' font-size='22' fill='white'%3EF%3C/text%3E%3C/svg%3E";
const FONTS = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&family=Roboto+Serif:opsz,wght@36,400&family=Inter:wght@400;500;600&display=swap';

const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'Forsured',
  url: SITE,
  logo: { '@type': 'ImageObject', url: `${SITE}/logo-orange.png` },
};

const CSS = `
/* Fallback faces sized to match the web fonts, so text doesn't reflow (a layout shift) when Inter and
   Roboto Serif arrive. Each local font is tried in turn: Arial/Times on Mac and Windows, Liberation and
   DejaVu on Linux. size-adjust is the width ratio measured on body copy. */
@font-face{font-family:'Inter Fallback';src:local('Arial'),local('Liberation Sans');size-adjust:106.7%}
@font-face{font-family:'Inter Fallback 2';src:local('DejaVu Sans');size-adjust:94.4%}
@font-face{font-family:'Roboto Serif Fallback';src:local('Times New Roman'),local('Liberation Serif');size-adjust:119.3%}
@font-face{font-family:'Roboto Serif Fallback 2';src:local('DejaVu Serif');size-adjust:93.6%}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--sans:'Inter','Inter Fallback','Inter Fallback 2',sans-serif;--serif:'Roboto Serif','Roboto Serif Fallback','Roboto Serif Fallback 2',serif;--f:#FB612A;--fl:#F07040;--bg:#FAFBFA;--wh:#fff;--bdr:rgba(0,0,0,.07);--bdr2:rgba(0,0,0,.12);--tx:#0A0A0E;--mt:#555;--ch:#2C2D29}
html{scroll-behavior:smooth;scroll-padding-top:76px}
body{font-family:var(--sans);background:var(--bg);color:var(--tx);-webkit-font-smoothing:antialiased;line-height:1.6;overflow-x:hidden}
a{color:inherit}
a:focus-visible,button:focus-visible{outline:2px solid var(--f);outline-offset:2px;border-radius:4px}
.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:16px;z-index:10;background:#fff;padding:8px 12px}
nav{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16px;height:60px;padding:0 40px;background:rgba(250,251,250,.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--bdr)}
.nlogo{font-family:'Chakra Petch',sans-serif;font-size:24px;font-weight:800;letter-spacing:-.02em;color:var(--tx);text-decoration:none}
.nlinks{display:flex;gap:28px;margin-left:auto;margin-right:12px}
.nlinks a{font-size:14px;font-weight:500;color:var(--mt);text-decoration:none;line-height:24px}
.nlinks a:hover,.nlinks a[aria-current]{color:var(--tx)}
/* Buttons: Forsured Flows Button, primary (filled) and outline. Radius 8, Inter Medium 14/20, button shadow */
.cta-p,.cta-g{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:8px;border:1px solid #FB612A;font-family:inherit;font-size:14px;font-weight:500;line-height:20px;white-space:nowrap;text-decoration:none;box-shadow:0 1px 2px rgba(20,28,37,.04);cursor:pointer;transition:background .15s,border-color .15s}
.cta-p{background:#FB612A;color:#fff}
.cta-p:hover{background:#D54E21;border-color:#D54E21}
.cta-g{background:#fff;color:#FB612A}
.cta-g:hover{background:#FFF3EC}
nav .cta-p{height:36px;padding:0 14px}
/* Label: Forsured Flows Badge with status dot. Radius 6, Inter Medium 12/16 */
.label{display:inline-flex;align-items:center;gap:6px;padding:1px 8px;border:1px solid #E4E7EC;border-radius:6px;background:#fff;font-size:12px;font-weight:500;line-height:16px;color:#344051}
.label::before{content:'';width:6px;height:6px;border-radius:50%;background:#FB612A;flex:none}
.edge{max-width:1080px;margin:0 auto;padding:0 40px}
.col{max-width:700px;margin:0 auto}
h1{font-family:var(--serif);font-weight:400;font-size:clamp(34px,4.4vw,52px);letter-spacing:-.02em;line-height:1.1;text-wrap:balance}
.dek{font-size:18px;line-height:1.6;color:var(--mt);margin-top:16px;max-width:640px}
.meta{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:20px;font-size:13px;color:var(--mt)}
.crumbs{font-size:13px;color:var(--mt);margin-bottom:20px}
.crumbs a{text-decoration:none;display:inline-block;line-height:24px}
.crumbs a:hover{color:var(--tx)}
.post-head{padding:48px 0 8px}
.tldr{margin:32px 0 8px;padding:20px 24px;background:#fff;border:1px solid #E4E7EC;border-left:3px solid #FB612A;border-radius:10px}
.tldr h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#344051;margin-bottom:8px}
.tldr ul{padding-left:18px}
.tldr li{font-size:15px;line-height:1.55;margin:6px 0}
.prose{font-size:17px;line-height:1.75;padding-bottom:16px}
.prose>*+*{margin-top:20px}
.prose h2,.extra h2{font-family:var(--serif);font-weight:400;font-size:28px;letter-spacing:-.015em;line-height:1.25;margin-top:44px}
.prose h3,.extra h3{font-size:18px;font-weight:600;line-height:1.4;margin-top:32px}
.prose a,.extra p a,.sources a{text-decoration:underline;text-decoration-color:#FB612A;text-decoration-thickness:1px;text-underline-offset:3px}
.prose a:hover,.extra p a:hover,.sources a:hover{text-decoration-thickness:2px}
.prose ul,.prose ol{padding-left:22px}
.prose li+li{margin-top:8px}
.prose blockquote{border-left:3px solid #E4E7EC;padding:4px 0 4px 20px;color:#344051}
.prose blockquote cite{display:block;font-style:normal;font-size:14px;color:var(--mt);margin-top:6px}
.prose code{font-family:inherit;background:#F2F4F7;border-radius:4px;padding:1px 5px;font-size:.92em}
.table{overflow-x:auto;border:1px solid #E4E7EC;border-radius:10px;background:#fff}
.prose table{border-collapse:collapse;width:100%;font-size:15px;line-height:1.5}
.prose th,.prose td{text-align:left;padding:10px 14px;border-bottom:1px solid #E4E7EC;vertical-align:top}
.prose thead th{font-size:13px;font-weight:600;color:#344051;background:#F9FAFB}
.prose tbody th{font-weight:500}
.prose tr:last-child>*{border-bottom:0}
.extra{border-top:1px solid var(--bdr);margin-top:40px;padding-top:4px}
.extra p{font-size:16px;line-height:1.7;margin-top:8px}
.sources ol{padding-left:22px;font-size:14px;line-height:1.6;color:var(--mt);margin-top:12px}
.sources li+li{margin-top:8px}
.sources a{color:var(--tx)}
.note{font-size:13px;color:var(--mt);margin-top:16px}
.more{padding:56px 0 72px}
.more h2{font-family:var(--serif);font-weight:400;font-size:26px;letter-spacing:-.015em}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-top:20px;list-style:none}
.card{display:flex;flex-direction:column;height:100%;padding:20px 22px;background:#fff;border:1px solid #E4E7EC;border-radius:12px;text-decoration:none;transition:border-color .15s}
.card:hover{border-color:#FB612A}
.card .label{align-self:flex-start}
.card h3{font-family:var(--serif);font-weight:400;font-size:20px;line-height:1.3;letter-spacing:-.01em;margin-top:14px}
.card p{font-size:14px;line-height:1.6;color:var(--mt);margin-top:8px;flex:1}
.card time{font-size:12px;color:var(--mt);margin-top:14px}
.index-head{padding:56px 0 8px}
.index-head .dek{max-width:620px}
.topics{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px;list-style:none}
.lead{display:grid;grid-template-columns:1.1fr 1fr;gap:32px;align-items:center;margin-top:40px;padding:28px;background:#fff;border:1px solid #E4E7EC;border-radius:16px;text-decoration:none;transition:border-color .15s}
.lead:hover{border-color:#FB612A}
.lead img{width:100%;height:auto;border-radius:10px;border:1px solid var(--bdr)}
.lead h2{font-family:var(--serif);font-weight:400;font-size:clamp(24px,2.6vw,32px);line-height:1.2;letter-spacing:-.015em;margin-top:14px}
.lead p{color:var(--mt);margin-top:10px;font-size:16px}
.lead time{display:block;font-size:13px;color:var(--mt);margin-top:14px}
.all{padding:48px 0 72px}
.all>h2{font-family:var(--serif);font-weight:400;font-size:26px;letter-spacing:-.015em}
.band{background:var(--ch);color:#fff;border-top:3px solid var(--f)}
.band .edge{padding-top:56px;padding-bottom:56px;display:grid;grid-template-columns:1.3fr 1fr;gap:32px;align-items:center}
.band h2{font-family:var(--serif);font-weight:400;font-size:clamp(26px,3vw,36px);letter-spacing:-.02em;line-height:1.15}
.band p{color:rgba(255,255,255,.75);margin-top:12px;font-size:15px;max-width:520px}
.band p a{color:#fff}
.band .btns{display:flex;flex-wrap:wrap;gap:12px;justify-content:flex-end}
.band .cta-g{background:transparent;color:#fff;border-color:rgba(255,255,255,.3)}
.band .cta-g:hover{background:rgba(255,255,255,.08)}
footer{padding:28px 0 40px;font-size:12px;color:var(--mt)}
footer .edge{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}
footer a{display:inline-block;line-height:24px}
@media(max-width:860px){.nlinks{display:none}.lead{grid-template-columns:1fr;padding:20px}.lead img{order:-1}}
@media(max-width:768px){
  nav{padding:0 16px;height:56px}
  nav .cta-p{padding:0 12px;font-size:13px}
  .cta-p,.cta-g{min-height:44px}
  .edge{padding:0 16px}
  .post-head,.index-head{padding-top:32px}
  .dek{font-size:16px}
  .prose{font-size:16px}
  .prose h2,.extra h2{font-size:24px}
  .tldr{padding:16px 18px}
  .band .edge{grid-template-columns:1fr;padding-top:40px;padding-bottom:40px}
  .band .btns{justify-content:stretch}
  .band .btns a{flex:1 1 100%}
}
@media print{nav,.band,.more{display:none}}
`.trim();

function head({ title, description, url, image, imageAlt, type, jsonld, published, modified }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"/>
<link rel="canonical" href="${SITE}${url}"/>
<link rel="alternate" type="application/rss+xml" title="Forsured Blog" href="${SITE}/blog/feed.xml"/>
<meta name="theme-color" content="#FB612A"/>
<link rel="icon" type="image/svg+xml" href="${FAVICON}"/>
<meta property="og:type" content="${type}"/>
<meta property="og:url" content="${SITE}${url}"/>
<meta property="og:site_name" content="forsured.ai"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:image" content="${SITE}${image}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="${esc(imageAlt)}"/>
${published ? `<meta property="article:published_time" content="${published}"/>\n<meta property="article:modified_time" content="${modified}"/>\n` : ''}<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:site" content="@forsured"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${SITE}${image}"/>
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${FONTS}" rel="stylesheet"/>
<style>
${CSS}
</style>
</head>
<body>`;
}

function nav(current) {
  return `<a class="skip" href="#main">Skip to the content</a>
<nav aria-label="Main navigation">
  <a href="/" class="nlogo" aria-label="Forsured, go to homepage">Forsured</a>
  <div class="nlinks">
    <a href="/#platform">Platform</a>
    <a href="/#how">How It Works</a>
    <a href="/blog/"${current === 'blog' ? ' aria-current="page"' : ''}>Blog</a>
  </div>
  <a href="/#demo" class="cta-p">Free COI Risk Check →</a>
</nav>`;
}

const BAND = `<section class="band" aria-label="Free COI risk check"><div class="edge">
  <div>
    <h2>See what's in your own contractor COIs.</h2>
    <p>Free COI risk check, no strings attached. Send one project's requirements and a contractor COI or two to <a href="mailto:hello@forsured.ai">hello@forsured.ai</a>, and we'll walk you through every gap we find.</p>
  </div>
  <div class="btns">
    <a class="cta-p" href="/#demo">Get a Free COI Risk Check →</a>
    <a class="cta-g" href="/#how">How Forsured works</a>
  </div>
</div></section>`;

const FOOTER = () => `<footer><div class="edge">
  <span>Independent commentary from Forsured. Not affiliated with or endorsed by IRMI or the publications we cite.</span>
  <span>© ${year()} Forsured · <a href="/blog/feed.xml">RSS</a> · <a href="/">forsured.ai</a></span>
</div></footer>
</body>
</html>
`;

function card(p, level = 'h3') {
  return `<li><a class="card" href="${p.url}"><span class="label">${esc(p.category)}</span><${level}>${esc(p.title)}</${level}><p>${esc(p.description)}</p><time datetime="${day(p.date)}">${human(p.date)} · ${p.minutes} min read</time></a></li>`;
}

// ---------- pages ----------

function postPage(p, posts) {
  const image = `/blog/${p.slug}/og.png`;
  const others = posts.filter((o) => o !== p);
  const related = [...others.filter((o) => o.category === p.category), ...others.filter((o) => o.category !== p.category)].slice(0, 3);
  const graph = [
    {
      '@type': 'BlogPosting',
      '@id': `${SITE}${p.url}#article`,
      headline: p.title,
      description: p.description,
      image: `${SITE}${image}`,
      datePublished: p.date,
      dateModified: p.updated,
      author: { '@id': ORG['@id'] },
      publisher: ORG,
      mainEntityOfPage: `${SITE}${p.url}`,
      articleSection: p.category,
      keywords: (p.tags || []).join(', '),
      wordCount: p.body.split(/\s+/).length,
      inLanguage: 'en-US',
      isPartOf: { '@type': 'Blog', '@id': `${SITE}/blog/#blog`, name: 'Forsured Blog' },
      about: (p.tags || []).slice(0, 4).map((t) => ({ '@type': 'Thing', name: t })),
      citation: p.sources.map((s) => ({ '@type': 'CreativeWork', name: s.title, url: s.url, publisher: s.publisher ? { '@type': 'Organization', name: s.publisher } : undefined })),
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.dek', '.tldr'] },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Forsured', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog/` },
        { '@type': 'ListItem', position: 3, name: p.title, item: `${SITE}${p.url}` },
      ],
    },
  ];
  if (p.faq && p.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })),
    });
  }
  return `${head({
    title: p.seoTitle || `${p.title} | Forsured`,
    description: p.description,
    url: p.url,
    image,
    imageAlt: p.title,
    type: 'article',
    published: p.date,
    modified: p.updated,
    jsonld: { '@context': 'https://schema.org', '@graph': graph },
  })}
${nav('blog')}

<main id="main">
<article class="edge">
  <div class="col">
    <header class="post-head">
      <p class="crumbs"><a href="/blog/">Blog</a> / ${esc(p.category)}</p>
      <span class="label">${esc(p.category)}</span>
      <h1 style="margin-top:16px">${esc(p.title)}</h1>
      <p class="dek">${inline(p.dek)}</p>
      <p class="meta"><span>By the Forsured team</span><time datetime="${day(p.date)}">${human(p.date)}</time><span>${p.minutes} min read</span></p>
    </header>
    <aside class="tldr" aria-labelledby="tldr">
      <h2 id="tldr">The short version</h2>
      <ul>${p.takeaways.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>
    </aside>
    <div class="prose">
${markdown(p.body)}
    </div>
${p.faq && p.faq.length ? `    <section class="extra" aria-labelledby="faq">
      <h2 id="faq">Common questions</h2>
${p.faq.map((f) => `      <h3>${inline(f.q)}</h3>\n      <p>${inline(f.a)}</p>`).join('\n')}
    </section>
` : ''}    <section class="extra sources" aria-labelledby="sources">
      <h2 id="sources">Sources</h2>
      <ol>${p.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.title)}</a>${s.publisher ? `, ${esc(s.publisher)}` : ''}${s.date ? `, ${esc(s.date)}` : ''}</li>`).join('')}</ol>
      <p class="note">We link to the original reporting and research behind every post. Spotted something we got wrong? Write to <a href="mailto:hello@forsured.ai">hello@forsured.ai</a> and we'll fix it.</p>
    </section>
  </div>
</article>
${related.length ? `<section class="more edge" aria-labelledby="more"><h2 id="more">Keep reading</h2><ul class="cards">${related.map((r) => card(r)).join('')}</ul></section>` : ''}
</main>

${BAND}

${FOOTER()}`;
}

function indexPage(posts) {
  const [lead, ...rest] = posts;
  const categories = [...new Set(posts.map((p) => p.category))];
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${SITE}/blog/#blog`,
        name: 'Forsured Blog',
        url: `${SITE}/blog/`,
        description: INDEX.description,
        publisher: ORG,
        inLanguage: 'en-US',
        blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}${p.url}`, datePublished: p.date })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Forsured', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog/` },
        ],
      },
    ],
  };
  return `${head({ ...INDEX, url: '/blog/', image: '/blog/og.png', imageAlt: 'The Forsured Blog', type: 'website', jsonld })}
${nav('blog')}

<main id="main" class="edge">
  <header class="index-head">
    <span class="label">Forsured Blog</span>
    <h1 style="margin-top:16px">Notes on construction insurance compliance.</h1>
    <p class="dek">What we're reading, hearing and learning about contractor COIs, project requirements and the risk that slips between them. Plain answers, with the sources linked.</p>
    <ul class="topics" aria-label="Topics">${categories.map((c) => `<li><span class="label">${esc(c)}</span></li>`).join('')}</ul>
  </header>
  <a class="lead" href="${lead.url}">
    <div>
      <span class="label">Latest · ${esc(lead.category)}</span>
      <h2>${esc(lead.title)}</h2>
      <p>${esc(lead.description)}</p>
      <time datetime="${day(lead.date)}">${human(lead.date)} · ${lead.minutes} min read</time>
    </div>
    <img src="${lead.slug}/og.png" width="1200" height="630" alt=""/>
  </a>
  ${rest.length ? `<section class="all" aria-labelledby="all"><h2 id="all">All posts</h2><ul class="cards">${rest.map((p) => card(p)).join('')}</ul></section>` : ''}
</main>

${BAND}

${FOOTER()}`;
}

const INDEX = {
  title: 'Forsured Blog | Construction Insurance Compliance Insights',
  description: 'Plain answers on contractor COIs, project requirements, additional insured endorsements and construction risk, with the sources linked.',
};

function feed(posts) {
  const items = posts
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${SITE}${p.url}</link>
    <guid isPermaLink="true">${SITE}${p.url}</guid>
    <pubDate>${rfc822(p.date)}</pubDate>
    <category>${esc(p.category)}</category>
    <description>${esc(p.description)}</description>
    <content:encoded><![CDATA[<ul>${p.takeaways.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>${markdown(p.body)}]]></content:encoded>
  </item>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Forsured Blog</title>
  <link>${SITE}/blog/</link>
  <atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
  <description>${esc(INDEX.description)}</description>
  <language>en-us</language>
  <lastBuildDate>${rfc822(posts[0].updated)}</lastBuildDate>
${items}
</channel>
</rss>
`;
}

// Every public page goes in the sitemap. Pages outside the blog keep their own list here.
const STATIC_PAGES = [
  { url: '/', priority: '1.0' },
  { url: '/irmi-field-guide/', priority: '0.5' },
];

function sitemap(posts) {
  const latest = day(posts[0].updated);
  const urls = [
    ...STATIC_PAGES.map((p) => ({ ...p, lastmod: null })),
    { url: '/blog/', priority: '0.8', lastmod: latest },
    ...posts.map((p) => ({ url: p.url, priority: '0.7', lastmod: day(p.updated) })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u.url}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
}

const ROBOTS = `# forsured.ai is open to search engines and AI answer engines alike.
User-agent: *
Allow: /

# Named so the intent is explicit: these crawlers power AI search and answers.
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: Google-Extended
User-agent: Applebot-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

function llms(posts) {
  return `# Forsured

> Forsured is construction insurance compliance software. It checks every contractor certificate of insurance (COI) against a project's insurance requirements, flags coverage and endorsement gaps, brings the contractor's broker into the fix, and keeps checking for the life of the project. Built for general contractors, trade contractors and insurance brokers in the United States.

Key facts:
- Website: ${SITE}
- Contact: hello@forsured.ai
- Offer: a free COI risk check. Send one project's requirements and a contractor COI or two, and Forsured shows every gap it finds.
- Integrations: Procore (available for early access customers).

## Product

- [Forsured home](${SITE}/): what Forsured does, how the review works, and who it's for (general contractors, brokers, trade contractors)
- [Free COI risk check](${SITE}/#demo): send one project's requirements and a contractor COI

## Blog

${posts.map((p) => `- [${p.title}](${SITE}${p.url}): ${p.description}`).join('\n')}

## Optional

- [Blog RSS feed](${SITE}/blog/feed.xml)
- [IRMI CRC 2026 field guide](${SITE}/irmi-field-guide/): an independent guide to the 2026 Construction Risk Conference
`;
}

// ---------- write or check ----------

function build() {
  const posts = readPosts();
  if (!posts.length) throw new Error('no posts in content/blog');
  const files = new Map();
  files.set('blog/index.html', indexPage(posts));
  for (const p of posts) files.set(`blog/${p.slug}/index.html`, postPage(p, posts));
  files.set('blog/feed.xml', feed(posts));
  files.set('sitemap.xml', sitemap(posts));
  files.set('robots.txt', ROBOTS);
  files.set('llms.txt', llms(posts));

  // Posts without a share image fail the build, so every link preview has one (tools/blog/og.js makes them).
  const missing = ['blog/og.png', ...posts.map((p) => `blog/${p.slug}/og.png`)].filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) throw new Error(`missing share images (run node tools/blog/og.js): ${missing.join(', ')}`);

  const stale = [];
  for (const [rel, content] of files) {
    const file = path.join(ROOT, rel);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current === content) continue;
    if (CHECK) stale.push(rel);
    else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      console.log(`wrote ${rel}`);
    }
  }
  if (CHECK && stale.length) {
    console.error(`out of date, run node tools/blog/build.js: ${stale.join(', ')}`);
    process.exit(1);
  }
  return posts;
}

module.exports = { readPosts, markdown };
if (require.main === module) build();
