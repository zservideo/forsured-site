# Blog posts

Each post is one Markdown file here. The file name is the URL: `compliance-isnt-coverage.md` is
published at `https://forsured.ai/blog/compliance-isnt-coverage/`. This folder is not published itself.

## Publishing a post

```bash
# 1. write content/blog/<slug>.md (front matter below)
node tools/blog/og.js        # renders the share image for new posts (blog/<slug>/og.png)
node tools/blog/build.js     # builds the post, the blog index, RSS, sitemap.xml, robots.txt, llms.txt
npx playwright test tests/blog.spec.js tests/copy.spec.js tests/seo.spec.js   # quick check
```

Commit the Markdown and everything the build wrote. `tests/blog.spec.js` fails if the built files are
out of date with the Markdown.

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
| `category` | yes | Reuse one: COI basics, How-to, Market outlook, Industry news, Event takeaways. |
| `tags` | no | Search phrases the post answers. |
| `takeaways` | yes | 2 to 4 bullets that answer the question on their own. AI answer engines quote these. |
| `faq` | no | `{ "q", "a" }` pairs. Real questions, answers that stand alone. Becomes FAQPage markup. |
| `sources` | yes | `{ "title", "publisher", "date", "url" }` for every fact we didn't produce ourselves. |
| `draft` | no | `true` keeps a post out of the build. |

Body Markdown supports `##` and `###` headings, paragraphs, `-` and `1.` lists, `>` quotes
(`> quote -- Name, Title`), tables, `**bold**`, `*italic*` and `[links](https://...)`.

## Writing rules

- Plain voice, short sentences, specific numbers. The copy tests block stock marketing phrases and em-dash asides.
- Say "contractor COIs" and "project requirements". Never "subcontractor", "subs", "sub COIs" or "GC requirements".
- No founder names. Posts are by "the Forsured team".
- Every number and claim from someone else links to the original in `sources`. Never invent a quote. Never put words from a private conversation in a named person's mouth.
- Never name customers, prospects or partners as customers, prospects or partners without written approval. Never name competitors.
- Never imply IRMI or any publication endorses Forsured (the footer says we're independent).
- Lead with the answer. The first paragraph and the takeaways should answer the headline's question.
- Tie each post back to contractor COI compliance lightly. At most one soft line about Forsured near the end.
