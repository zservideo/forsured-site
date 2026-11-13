# Blog posts

Each post is one Markdown file here. The file name is the URL: `compliance-isnt-coverage.md` is
published at `https://forsured.ai/blog/compliance-isnt-coverage/`. This folder is not published itself.

## Publishing a post

```bash
# 1. write content/blog/<slug>.md (front matter below)
node tools/blog/og.js        # renders the share card (blog/<slug>/og.png) and hero (blog/<slug>/hero.png) for new posts
node tools/blog/build.js     # builds the post, its Markdown copy, the index, RSS, sitemap.xml, robots.txt, llms.txt, llms-full.txt
npx playwright test tests/blog.spec.js tests/copy.spec.js tests/seo.spec.js   # quick check
```

Commit the Markdown, the images and everything the build wrote. Look at `hero.png` before you commit:
it is the first thing on the page and the image the social posts reuse. After a title or hero change,
re-render that post with `node tools/blog/og.js <slug>`. `tests/blog.spec.js` fails if the built files
are out of date with the Markdown.

When the change reaches `main`, GitHub Pages publishes it and the IndexNow workflow tells Bing and the
other IndexNow search engines to crawl the changed pages.

## Front matter

The file starts with a JSON block between `---` lines:

| Field | Required | What it is |
| --- | --- | --- |
| `title` | yes | The headline. Plain, specific, the way a person would search for it. |
| `seoTitle` | no | The browser and search title when the title plus " \| Forsured" is outside 30 to 70 characters. |
| `description` | yes | 70 to 170 characters. Search snippet, link preview and RSS summary. |
| `dek` | yes | One or two sentences under the headline. |
| `date` | yes | ISO time with offset, e.g. `2026-10-27T09:00:00-04:00`. Never in the future. |
| `updated` | no | Set when a post changes in substance. |
| `hero` | yes | The picture at the top of the post. See below. |
| `heroAlt` | no | Alt text for the hero when the generated one (from the hero fields) doesn't read well. |
| `category` | yes | Reuse one: COI basics, How-to, Market outlook, Industry news, Event takeaways, Forsured news, Buyer's guide. |
| `tags` | no | Search phrases the post answers. |
| `takeaways` | yes | 2 to 4 bullets that answer the question on their own. AI answer engines quote these. |
| `faq` | no | `{ "q", "a" }` pairs. Real questions, answers that stand alone. Becomes FAQPage markup. |
| `sources` | yes | `{ "title", "publisher", "date", "url" }` for every fact we didn't produce ourselves. |
| `schema` | no | Extra schema.org nodes for the page's `@graph`, such as the `ItemList` and `SoftwareApplication` entries on a buyer's guide. Each `@id` must start with the post's URL plus `#`. |
| `library` | no | `true` makes it a library post: built at `/blog/<slug>/` and listed on `/guides/`, the sitemap and llms.txt, but kept off the blog index, the RSS feed and subscriber emails. Use it for reference and ranking guides that other posts link to. Link every library post from at least one live post or state page. |
| `draft` | no | `true` keeps a post out of the build (og.js still renders its images, so they can be reviewed). |

### Hero

A 1600x800 image drawn by `tools/blog/og.js` in the brand style, from data rather than stock art. Pick
the type that carries the post's point:

- `{ "type": "stat", "value": "+5% to 15%", "label": "what the number is", "source": "Source: WTW, ..." }`
  for a post built on one number. Cite the number in `sources` too.
- `{ "type": "list", "title": "Five checks for every contractor COI", "items": ["...", "..."] }` for
  steps, takeaways or a checklist. Up to 5 short items.
- `{ "type": "coi", "title": "...", "rows": [["General liability", "$1M / $2M", "ok"], ["Umbrella", "$5M", "Below $10M required"]], "note": "..." }`
  for a sample certificate with the gap flagged. `"ok"` shows Meets; any other text is the flag. Sample data only, never a real contractor.

### In-post images

A line on its own like `![Alt text that says what it shows](chart.png "Optional caption")` puts
`blog/<slug>/chart.png` in the post with its size set. Use it for a chart or diagram that makes a
point faster than text. PNG only, at least 1400px wide, in the brand style.

### Videos

A line on its own like `::video ZfDXobNtztQ` embeds an Ask the Construction Guy video from
`content/videos.json`: a click-to-play player (only the poster image loads until a reader presses
play), the ownership disclosure, the transcript as a quote, and a `VideoObject` in the post's
structured data. The RSS feed and the Markdown copy get a link and the transcript instead. Put the
line after a section's first paragraph, never above the answer. At most two per post. These videos
promote Forsured, so they never go on COI Journal or `/research/`.

Body Markdown supports `##` and `###` headings (add ` {#id}` to set the anchor by hand), paragraphs, `-` and `1.` lists, `>` quotes
(`> quote -- Name, Title`), tables, `**bold**`, `*italic*` and `[links](https://...)`.

## Writing rules

- Plain voice, short sentences, specific numbers. The copy tests block stock marketing phrases and em-dash asides.
- Say "contractor COIs" and "project requirements". Never "subcontractor", "subs", "sub COIs" or "GC requirements". Exception: a `Buyer's guide` post may say "subcontractor" where it mirrors how buyers phrase the question.
- Posts are by "the Forsured team" unless the front matter names an `author` from `content/authors.json`.
- Every number and claim from someone else links to the original in `sources`. Never invent a quote. Never put words from a private conversation in a named person's mouth.
- Never name customers, prospects or partners as customers, prospects or partners without written approval. Never name competitors, except in a `Buyer's guide`: there, every fact about another vendor comes from its own public pages, is linked under Sources, and carries the date it was checked. Re-check those facts every quarter.
- Never imply IRMI or any publication endorses Forsured (the footer says we're independent).
- Lead with the answer. The first paragraph and the takeaways should answer the headline's question.
- Every post gets share buttons, the newsletter signup, the hero, a Markdown copy and full structured data automatically. Don't add your own.
- Tie each post back to contractor COI compliance lightly. At most one soft line about Forsured near the end.

## AEO checklist (build gate, from Nov 16 2026)

Warren Brown's AEO recommendations (Get AI Authority, Nov 13 2026; the full file is in project files at
`content/aeo/warren-2026-11-13/AEO-RECOMMENDATIONS.md`). `tools/blog/aeo.js` runs the Section 9
checklist on every **gated** post, and `build.js` refuses to build if anything misses. A post is gated
when it has a brief, or when its `date` is on or after 2026-11-16. Older posts join the gate when
they're rewritten (write their brief first), in this order: how-to-check-a-contractor-coi,
compliance-isnt-coverage, the additional insured cluster, notice-of-cancellation-coi, then T3 links on
news posts.

**1. Brief first.** `content/blog/briefs/<slug>.json`, written before the draft:

```json
{
  "slug": "what-is-a-certificate-of-insurance",
  "type": "pillar",
  "reader": "GC risk/compliance manager",
  "pillar": "/blog/what-is-a-certificate-of-insurance/",
  "questions": ["What is a certificate of insurance and why do general contractors require one?"],
  "target_keywords": [{ "kw": "certificate of insurance", "vol": 2400, "kd": null }],
  "competing_sources": [{ "url": "", "title": "", "h2s": [], "faqs": [], "what_they_cover_that_we_dont": "", "what_we_cover_that_they_dont": "" }],
  "plan": { "h2s": [], "faqs": [], "table": "", "internal_links": [], "external_links": [], "forsured_paragraph": "" }
}
```

- `type`: pillar (2,000 to 3,000 body words), evergreen (1,000 to 1,600), buyer (1,200 to 2,000; rankings too), news (600 to 900).
- 1 to 3 `questions`, in the buyer's words. 5 to 10 `target_keywords`; the first is the primary.
- `competing_sources`: the top pages ChatGPT, Perplexity and Google actually cite for the questions, read for real (B2). The post covers everything the best one covers and adds one thing none has.
- `pillar`: the cluster's pillar URL, which the post must link up to. `plan.internal_links` and `plan.external_links` must all appear in the body.
- Monthly mix: about 50% evergreen, 30% buyer, 20% or less news. A news post links to at least two evergreen posts and ends its "why it matters" section on the evergreen question.

**2. What the gate checks.**

- **S1** the `dek` is the answer: one 40 to 60 word paragraph that names the term and stands alone.
- **S2** every `##` in the body is a question ending in "?". **S3** open each section with a sentence that answers its heading and repeats the noun (not "It" or "This").
- **S4** body word count for the type. **S5** at least one table (not news) with a `Table: <caption>` line directly above its rows.
- **S6** 5 to 8 FAQs, each answer 40 to 80 words, starting with a yes/no or a definition.
- **S7** one plain body paragraph on what Forsured does for this exact item, only from the homepage feature list. No adjectives.
- **S8 / J1** `"author"` (and optional `"reviewer"`) names a person in `content/authors.json`. Until one is approved, the gate warns instead of failing. Never invent a name or a title: titles come from the Forsured site or an approved release.
- **S9** each target keyword in at least one heading and at least 5 times in the body; the primary keyword in the title tag, H1, dek, description and slug. Drop a keyword rather than force it. A rewrite of an existing post keeps its URL: set `"slug_locked": true` in its brief, which skips only the slug check.
- **L1** 3 to 8 internal body links (pillar, the `/coi-requirements/<state>/` page when state law matters, the next sibling post). **L2** 3 to 8 external links to primary sources (IRMI, ISO/Verisk, NCCI, state insurance departments, ACORD, courts); link the first mention of each outside organization. COI Journal links count as neither. **L3** descriptive anchors, never a visible URL; emails as `mailto:`.
- **J2** publisher is the homepage Organization by `@id`. **J3** mentions carry a `url`. **J5** `updated` is the visible Updated date; bump it only when the content changes. **J6** no HTML comments, minified JSON-LD.
- **W1 to W6** no em dash, US spelling ("canceled"), no marketing vocabulary (call to action, funnel, keyword, use case, pain point, leverage...), no meta-commentary ("it's worth noting", "deliberately"), never mention AI visibility research or prompts. Write with contractions, for the PM reviewing COIs on a Tuesday. Companies are "they", products and forms are "it".
- **W9** the not-advice line (the Sources note carries it) and the structure checks (balanced tags, ends with `</html>`).

**Rankings and comparisons (R2, Buyer's guide category only):** every vendor fact linked to the vendor's own page and checked the month of publishing; publish criteria and weights with every score, or use a "best for" format when Forsured wouldn't honestly rank first; a four-paragraph intro (problem, who it's for, method, where Forsured fits including its limits); a screenshot of each vendor's own page; no section defending the list's independence; an "About this ranking" credit at the foot.
