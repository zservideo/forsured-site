# State COI requirement pages

`states.js` holds the rules behind `https://forsured.ai/coi-requirements/` and the 51 state pages under
it (50 states and DC): when workers' comp is required, what insurance a contractor license needs, and
what the state's anti-indemnity statute voids. This folder is not published itself.

The pages are kept out of the main nav. They are linked from the footer of the blog and of these pages ("COI
Requirements by State") and listed in `sitemap.xml`, `llms.txt` and `llms-full.txt`.

## Changing a state

```bash
# 1. edit content/coi-requirements/states.js (and REVIEWED, if you rechecked the whole set)
node tools/states/og.js      # share cards for any new page (--all after a title or design change)
node tools/blog/build.js     # rebuilds the hub, every state page and its Markdown copy, sitemap, llms.txt
npx playwright test tests/states.spec.js tests/copy.spec.js tests/seo.spec.js   # quick check
```

Commit the data and everything the build wrote. When the change reaches `main`, GitHub Pages
publishes it and the IndexNow workflow pings the search engines.

## Rules for the content

- Every fact has a source in that state's `sources`, linked on the page. Prefer the state agency,
  statute or administrative rule. Name a secondary source only when the primary one can't be reached.
- General information, not legal advice. Say what the law says; never tell a reader what their
  contract should say. Each page ends with a note to confirm with the agency, a broker or an attorney.
- Copy rules match the rest of the site: "contractor COIs" and "project requirements", no em-dash
  asides, no stock clichés. `tests/copy.spec.js` checks every page.
- Recheck the whole set at least twice a year and when a legislative session ends, then update
  `REVIEWED`. Laws in motion when this was written: Utah's contractor liability minimum (a 2026 rule
  change reportedly raises it to $1M/$2M) and California's workers' comp rule for all licensees
  (delayed to January 1, 2028).
