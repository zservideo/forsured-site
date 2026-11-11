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

Body Markdown supports `##` and `###` headings (add ` {#id}` to set the anchor by hand), paragraphs, `-` and `1.` lists, `>` quotes
(`> quote -- Name, Title`), tables, `**bold**`, `*italic*` and `[links](https://...)`.

## Writing rules

- Plain voice, short sentences, specific numbers. The copy tests block stock marketing phrases and em-dash asides.
- Say "contractor COIs" and "project requirements". Never "subcontractor", "subs", "sub COIs" or "GC requirements". Exception: a `Buyer's guide` post may say "subcontractor" where it mirrors how buyers phrase the question.
- No founder names. Posts are by "the Forsured team".
- Every number and claim from someone else links to the original in `sources`. Never invent a quote. Never put words from a private conversation in a named person's mouth.
- Never name customers, prospects or partners as customers, prospects or partners without written approval. Never name competitors, except in a `Buyer's guide`: there, every fact about another vendor comes from its own public pages, is linked under Sources, and carries the date it was checked. Re-check those facts every quarter.
- Never imply IRMI or any publication endorses Forsured (the footer says we're independent).
- Lead with the answer. The first paragraph and the takeaways should answer the headline's question.
- Every post gets share buttons, the newsletter signup, the hero, a Markdown copy and full structured data automatically. Don't add your own.
- Tie each post back to contractor COI compliance lightly. At most one soft line about Forsured near the end.
