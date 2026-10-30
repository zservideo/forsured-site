# forsured.ai test suite

Every pull request runs these checks in GitHub Actions (`.github/workflows/test.yml`), and a pull
request should merge only once they pass. They run in Chromium against a local copy of the site served
like GitHub Pages (`tests/server.js`). Google Fonts load for real, downloaded once per test worker
with retries, and the screenshot tests fail with a clear message if any brand font is missing. The
form backends (Web3Forms and the Make webhook) are stubbed, so no test ever sends a real submission.

CI runs inside Playwright's own Docker image (`mcr.microsoft.com/playwright`), which already has
Chromium and its system libraries. That skips a browser install that took 2 to 11 minutes per run,
so a full run takes about 2 to 3 minutes, and every run renders screenshots on the same fixed setup.
A new push to a pull request cancels the run for the push before it.

## What gets checked

| File | What it catches |
| --- | --- |
| `site.spec.js` | Broken functionality: JavaScript errors, nav links that land under the fixed nav, the mobile menu, both forms (empty, malformed email, success, backend failure), the role values the form backends route on, the IRMI banner and its dismiss. |
| `field-guide.spec.js` | The IRMI and BuiltWorlds field guide pages: every page image loads at a readable size, the PDF downloads, links back to the site, the `/irmifieldguide` and `/builtworldsfieldguide` redirects. |
| `copy.spec.js` | Copy rules on every page: "contractor COIs" and "project requirements" (never "sub COIs", "subcontractor" or "GC requirements"), the brand spelled "Forsured" and the domain forsured.ai, no founder names anywhere in the source, no placeholder text, stock marketing clichés, em-dash asides, doubled words or stray punctuation, no IRMI affiliation implied, the current year in the footer, sample-data labels on the hero and showcase screens. |
| `brand.spec.js` | Brand drift: every color in the source and on screen must be in `brand.json`, CSS color tokens, only Inter, Roboto Serif and the Chakra Petch wordmark (and they actually load), the wordmark, orange primary buttons with white text, theme color and favicon. |
| `responsive.spec.js` | Eleven screen sizes from a 320px phone to a 1920px monitor: no sideways scrolling or content past the edge, no text cut off or overflowing its box, no text under 10px, no stretched images, the header fits, the headline and main button show on the first screen, the showcase switches between the desktop composite and the phone cards, forms stay usable, and buttons and links are big enough to tap. |
| `visual.spec.js` | Visual regression: screenshots of every home page section, the field guide and the phone menu, compared with the approved images in `__screenshots__/`. |
| `a11y.spec.js` | Accessibility: axe-core WCAG 2.1/2.2 AA rules, visible keyboard focus, alt text, landmarks. |
| `seo.spec.js` | Title and description length, canonical URLs, link-preview tags and image, one h1 and no skipped heading levels, image sizes and lazy loading, every local link resolves, structured data, the CNAME. |
| `blog.spec.js` | The blog (built from `content/blog` by `tools/blog/build.js`): the built pages are current, every post has BlogPosting, breadcrumb and FAQ structured data, a short answer up top and linked sources, a 1600x800 hero image, a share card and working share buttons (LinkedIn, X, Facebook, email, copy link, native share), the same nav, phone menu and footer links as the home page, a Markdown copy, and the RSS feed, `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt` list every page. The IndexNow key file matches `.github/workflows/indexnow.yml`. Every post is also in `PAGES`, so all the checks above cover it. See `content/blog/README.md` to publish a post. |
| `states.spec.js` | The state COI requirement pages (built from `content/coi-requirements` by `tools/blog/build.js`): all 50 states and DC, every fact sourced over https, each page's Article, breadcrumb and FAQ structured data, linked sources with the not-legal-advice note, share card and Markdown copy, a hub that links every state, footer links but no main-nav link, and the `llms.txt` entries. See `content/coi-requirements/README.md` to change a state. |
| `setup.spec.js` | The CI image matches the installed Playwright version, so browser behavior and screenshots don't drift. |
| `performance.spec.js` | Page-weight budgets on first load, file-size limits for HTML, images and the PDF, and no layout jumps while the page loads. |

## State pages and run time

The 51 state pages share one template and differ only in their text. Copy, SEO, structured data,
source-color and file-size checks read every one of them. The checks that render a page in a browser
(`responsive`, `a11y`, the rendered `brand` checks and page weight in `performance`) run on every
other page and on a sample of state pages: the longest and shortest page, the longest state name and
the longest fact-card answers, picked from the built files on every run (`BROWSER_PAGES` in
`tests/helpers.js`). Running all of them on every state took the suite from about 3 minutes to over
an hour without finding anything the sample misses. If a state page ever gets its own layout, add it
to the sample.

## Design system

The source of truth for colors, type and components is the Figma file
[Forsured Flows](https://www.figma.com/design/xE0hktIvp6MZHMukhFP1RD/Forsured-Flows?node-id=1000-6184),
which keeps evolving. Before any design change, re-pull its variables and update `tests/brand.json`
(the `designSystem.lastSynced` date says when that last happened). The brand checks then hold the
site to the current system rather than to a stale copy.

The site should read as crafted, not generated: restrained color, real product detail, plain copy.
`copy.spec.js` blocks the usual machine-written tells (stock marketing clichés and em-dash asides).

## Running locally

```bash
npm ci
npx playwright install chromium   # first time only
npm test                          # everything
npx playwright test tests/copy.spec.js   # one file
npm run report                    # open the HTML report after a failure
npm run serve                     # browse the site at http://localhost:4173
```

While working on a change, run the spec files it touches; run everything once before pushing.

## When a test fails on purpose

Most failures are real problems to fix in the page. A few are guardrails you update deliberately:

- **A design change made the screenshots differ.** Look at the diff in the report (or the
  `playwright-report` artifact on the CI run, which is kept for every run so a test that only
  passed on retry can be looked into too). If the change is intended, add the
  `update-baselines` label to the pull request (or run **Update visual baselines** from the
  Actions tab on your branch). It re-takes the screenshots in the same Playwright image CI uses,
  commits them to the branch and runs **Site tests** again. Review the new images in the pull
  request diff. The baselines always come from that image: font rendering differs slightly
  between machines, so screenshots taken on a laptop (`npm run test:update-visual`) are for local
  checks only and should not be committed.
- **Upgrading Playwright.** Change the image tag in both workflows to the new version
  (`setup.spec.js` fails until they match), then re-take the baselines as above.
- **A new color.** Add it to `tests/brand.json` under the right group, so the change is visible in review.
- **A new page.** Add it to `PAGES` in `tests/helpers.js` and to `STATIC_PAGES` in `tools/blog/build.js` (the sitemap); blog posts and state pages are added to both automatically; copy, brand, SEO, accessibility and
  layout checks then cover it automatically.
- **A new copy rule.** Add a pattern and the reason to `BANNED` in `tests/copy.spec.js`.

## Known exception

The buttons use the Figma primary orange (#FB612A), as the Forsured Flows components do. White text on
it, and orange text on the outline button, is about 3.1:1, below the WCAG AA 4.5:1 for small text.
The accessibility test skips contrast findings that only involve that orange (see `contrastExceptions`
in `brand.json`). Everything else must pass.
