// Accessibility checks with axe-core (WCAG 2.1/2.2 A and AA plus best practices) on every page,
// and keyboard basics: every focusable element shows where focus is.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { BROWSER_PAGES, BRAND, open } = require('./helpers');

// Product illustrations drawn in HTML (the hero project screen, the "before" collage, big watermark
// labels) are pictures of UI, marked role="img" or aria-hidden. WCAG treats text in them as incidental.
const ILLUSTRATIONS = ['.hero-app', '.chaos-visual', '.sol-num[aria-hidden="true"]'];

// Contrast findings that only involve colors listed in brand.json contrastExceptions are a known,
// deliberate brand choice (see the note there). Everything else must pass.
const EXCEPT = BRAND.contrastExceptions.colors.map((c) => c.toLowerCase());
const knownBrandContrast = (node) => {
  const d = (node.any[0] && node.any[0].data) || {};
  return [d.fgColor, d.bgColor].some((c) => c && EXCEPT.includes(String(c).toLowerCase()));
};

// BROWSER_PAGES: every page, with the state pages represented by a sample (see tests/helpers.js).
for (const p of BROWSER_PAGES) {
  test.describe(`${p.name} accessibility`, () => {
    test('has no axe violations', async ({ page }) => {
      await open(page, p.url, { reveal: true });
      let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']);
      for (const sel of ILLUSTRATIONS) builder = builder.exclude(sel);
      const results = await builder.analyze();
      const violations = results.violations
        .map((v) => ({ ...v, nodes: v.id === 'color-contrast' ? v.nodes.filter((n) => !knownBrandContrast(n)) : v.nodes }))
        .filter((v) => v.nodes.length);
      const summary = violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 8).map((n) => `${n.target.join(' ')}: ${(n.any[0] && n.any[0].message) || ''}`.slice(0, 220)).join('\n    ')}`
      );
      expect(summary).toEqual([]);
    });

    test('keyboard focus is always visible', async ({ page, isMobile }) => {
      test.skip(isMobile, 'keyboard navigation is a desktop concern');
      await open(page, p.url, { reveal: true });
      const invisible = [];
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
          return { ring, label: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"` };
        });
        if (info && !info.ring) invisible.push(info.label);
      }
      expect([...new Set(invisible)], 'focused elements with no focus ring').toEqual([]);
    });

    test('images have alt text and the page has landmarks', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      expect(await page.locator('img:not([alt])').count(), 'images without an alt attribute').toBe(0);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('nav').first()).toBeAttached();
      await expect(page.locator('footer')).toHaveCount(1);
      expect(await page.locator('html').getAttribute('lang')).toBe('en');
    });
  });
}
