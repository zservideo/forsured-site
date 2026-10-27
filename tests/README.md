# forsured.ai test suite

Every pull request runs these checks in GitHub Actions (`.github/workflows/test.yml`), and a pull
request should merge only once they pass. They run in Chromium against a local copy of the site served
like GitHub Pages (`tests/server.js`). Google Fonts load for real; the form backends (Web3Forms and
the Make webhook) are stubbed, so no test ever sends a real submission.

## What gets checked

| File | What it catches |
| --- | --- |
| `site.spec.js` | Broken functionality: JavaScript errors, nav links that land under the fixed nav, the mobile menu, both forms (empty, malformed email, success, backend failure), the role values the form backends route on, the IRMI banner and its dismiss. |
| `field-guide.spec.js` | The IRMI field guide page: every page image loads at a readable size, the PDF downloads, links back to the site, the `/irmifieldguide` redirect. |
| `copy.spec.js` | Copy rules on every page: "contractor COIs" and "project requirements" (never "sub COIs", "subcontractor" or "GC requirements"), the brand spelled "Forsured" and the domain forsured.ai, no founder names anywhere in the source, no placeholder text, doubled words or stray punctuation, no IRMI affiliation implied, the current year in the footer, sample-data label on the showcase. |
| `brand.spec.js` | Brand drift: every color in the source and on screen must be in `brand.json`, CSS color tokens, only Inter / Chakra Petch / JetBrains Mono (and they actually load), the wordmark, orange primary buttons with white text, theme color and favicon. |
| `responsive.spec.js` | Eleven screen sizes from a 320px phone to a 1920px monitor: no sideways scrolling or content past the edge, no text cut off or overflowing its box, no text under 10px, no stretched images, the header fits, the headline and main button show on the first screen, the showcase switches between the desktop composite and the phone cards, forms stay usable, and buttons and links are big enough to tap. |
| `visual.spec.js` | Visual regression: screenshots of every home page section, the field guide and the phone menu, compared with the approved images in `__screenshots__/`. |
| `a11y.spec.js` | Accessibility: axe-core WCAG 2.1/2.2 AA rules, visible keyboard focus, alt text, landmarks. |
| `seo.spec.js` | Title and description length, canonical URLs, link-preview tags and image, one h1 and no skipped heading levels, image sizes and lazy loading, every local link resolves, structured data, the CNAME. |
| `performance.spec.js` | Page-weight budgets on first load, file-size limits for HTML, images and the PDF, and no layout jumps while the page loads. |

## Running locally

```bash
npm ci
npx playwright install chromium   # first time only
npm test                          # everything
npx playwright test tests/copy.spec.js   # one file
npm run report                    # open the HTML report after a failure
npm run serve                     # browse the site at http://localhost:4173
```

## When a test fails on purpose

Most failures are real problems to fix in the page. A few are guardrails you update deliberately:

- **A design change made the screenshots differ.** Look at the diff in the report (or the
  `playwright-report` artifact on the failed CI run). If the change is intended, refresh the
  baselines with the **Update visual baselines** workflow in the Actions tab (pick your branch),
  then run **Site tests** on the branch again from the Actions tab. Review the new images in the
  pull request diff. Locally, `npm run test:update-visual` does the same on your machine.
- **A new color.** Add it to `tests/brand.json` under the right group, so the change is visible in review.
- **A new page.** Add it to `PAGES` in `tests/helpers.js`; copy, brand, SEO, accessibility and
  layout checks then cover it automatically.
- **A new copy rule.** Add a pattern and the reason to `BANNED` in `tests/copy.spec.js`.

## Known exception

Small brand-orange text (section labels, tags, the banner button) is about 3.3:1 against the light
background, below the WCAG AA 4.5:1 for small text. The accessibility test skips contrast findings
that only involve the brand orange (see `contrastExceptions` in `brand.json`). A slightly deeper
orange already in the palette (#C44D1E) would pass if we decide to change it.
