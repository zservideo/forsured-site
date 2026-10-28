// Layout sweep across phone, tablet, laptop and wide-monitor sizes for every page.
// Runs in its own "responsive" project (see playwright.config.js).
const { test, expect } = require('@playwright/test');
const { BROWSER_PAGES: PAGES, open, loadImages } = require('./helpers');

const VIEWPORTS = [
  { width: 320, height: 568, phone: true }, // iPhone SE (1st gen), the narrowest phone still around
  { width: 360, height: 780, phone: true }, // common Android
  { width: 375, height: 667, phone: true }, // iPhone SE / 8
  { width: 390, height: 844, phone: true }, // iPhone 13-15
  { width: 414, height: 896, phone: true }, // iPhone Plus / XR
  { width: 768, height: 1024, tablet: true }, // iPad portrait
  { width: 834, height: 1194, tablet: true }, // iPad Air portrait
  { width: 1024, height: 768, tablet: true }, // iPad landscape / small laptop
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

// Touch targets on phones. Buttons follow Apple's 44px minimum; full-width form fields can be a bit
// shorter; secondary links (logo, announcement bar, footer, links inside text) follow WCAG 2.2 AA (24px).
const TAP = [
  { min: 44, kind: 'button', selector: '.cta-p, .cta-g, .wl-sub, button:not(.ib-x), .mmenu a' },
  { min: 40, kind: 'form field', selector: 'input:not([type=hidden]), select, textarea' },
  { min: 24, kind: 'link', selector: 'a, .ib-x' },
];
// Smallest readable text, outside decorative product mockups.
const TEXT_MIN = 10;

// Runs in the page: returns layout problems grouped by kind.
function audit({ textMin }) {
  const vw = document.documentElement.clientWidth;
  const out = { spill: [], clipped: [], squashed: [], tiny: [] };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
  };
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
  // Decorative product mockups (scaled-down app UI) are judged as pictures, not text.
  const decorative = (el) => el.closest('[aria-hidden="true"], [role="img"], svg');

  const spilled = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    // Sticks out past the left/right edge of the screen without a clipping parent.
    // (Anything parked entirely off the left edge, like a skip link waiting for focus, is hidden on purpose.)
    if ((r.right > vw + 1 || r.left < -1) && r.right > 0 && !spilled.some((s) => s.contains(el))) {
      let a = el.parentElement;
      let clippedByParent = false;
      while (a && a !== document.body && a !== document.documentElement) {
        if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(a).overflowX)) {
          const ar = a.getBoundingClientRect();
          if (ar.right <= vw + 1 && ar.left >= -1) { clippedByParent = true; break; }
        }
        a = a.parentElement;
      }
      if (!clippedByParent && cs.position !== 'fixed') spilled.push(el) && out.spill.push(`${name(el)} spans ${Math.round(r.left)}..${Math.round(r.right)}px (screen is ${vw}px)`);
    }

    // Text that no longer fits in its own box (cut off or overlapping its neighbours).
    if (hasText(el) && !decorative(el) && cs.display !== 'inline' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
      out.clipped.push(`${name(el)} "${el.textContent.trim().slice(0, 40)}" needs ${el.scrollWidth}px, has ${el.clientWidth}px`);
    }

    // Text too small to read.
    if (hasText(el) && !decorative(el) && parseFloat(cs.fontSize) < textMin) {
      out.tiny.push(`${name(el)} "${el.textContent.trim().slice(0, 30)}" at ${cs.fontSize}`);
    }

    // Stretched or squashed images.
    if (el.tagName === 'IMG' && el.naturalWidth && ['fill', ''].includes(cs.objectFit)) {
      const natural = el.naturalWidth / el.naturalHeight;
      const shownRatio = r.width / r.height;
      if (Math.abs(shownRatio - natural) / natural > 0.03) out.squashed.push(`${el.getAttribute('src')} shown at ${shownRatio.toFixed(2)}:1, file is ${natural.toFixed(2)}:1`);
    }
  }
  return out;
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.phone,
      hasTouch: !!(vp.phone || vp.tablet),
      deviceScaleFactor: vp.phone ? 2 : 1,
    });

    for (const p of PAGES) {
      test(`${p.name}: layout holds together`, async ({ page }) => {
        await open(page, p.url, { reveal: true });
        // Load lazy images so their shapes can be checked.
        await loadImages(page);
        const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
        expect.soft(scroll, 'page scrolls sideways').toBeLessThanOrEqual(width);
        const issues = await page.evaluate(audit, { textMin: TEXT_MIN });
        expect.soft(issues.spill, 'elements past the screen edge').toEqual([]);
        expect.soft(issues.clipped, 'text that does not fit its box').toEqual([]);
        expect.soft(issues.tiny, `text smaller than ${TEXT_MIN}px`).toEqual([]);
        expect.soft(issues.squashed, 'stretched or squashed images').toEqual([]);
      });

      test(`${p.name}: header fits and the headline shows on the first screen`, async ({ page }) => {
        await open(page, p.url);
        const nav = page.locator('nav').first();
        const navBox = await nav.boundingBox();
        expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth), 'nav content fits').toBe(true);
        expect(navBox.height, 'nav stays one row').toBeLessThanOrEqual(64);
        // Nav items never overlap each other.
        const boxes = await nav.locator(':scope > *:visible').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
        for (let i = 1; i < boxes.length; i++) expect(boxes[i].left, 'nav items overlap').toBeGreaterThanOrEqual(boxes[i - 1].right - 1);
        const h1 = await page.locator('h1').boundingBox();
        expect(h1.y, 'headline starts below the nav').toBeGreaterThanOrEqual(navBox.y + navBox.height);
        expect(h1.y + h1.height, 'headline fits on the first screen').toBeLessThanOrEqual(vp.height);
      });
    }

    test('home: one nav mode at a time, and it works', async ({ page }) => {
      await open(page, '/');
      const links = page.locator('#nav .nlinks');
      const burger = page.locator('#menu-btn');
      const desktopNav = await links.isVisible();
      expect(desktopNav, 'section links and hamburger never show together').not.toBe(await burger.isVisible());
      if (!desktopNav) {
        await burger.click();
        const menu = page.locator('#mm');
        await expect(menu).toBeVisible();
        const menuTop = (await menu.boundingBox()).y;
        const navBox = await page.locator('#nav').boundingBox();
        expect(menuTop, 'menu opens below the nav').toBeGreaterThanOrEqual(navBox.y + navBox.height - 1);
        for (const a of await menu.locator('a').all()) await expect(a).toBeInViewport();
      }
    });

    test('home: hero call to action is on the first screen', async ({ page }) => {
      test.skip(vp.height < 640, 'very short screens scroll to the CTA');
      await open(page, '/');
      const cta = await page.locator('.hero .cta-p').boundingBox();
      expect(cta.y + cta.height).toBeLessThanOrEqual(vp.height);
    });

    test('home: product showcase fits this screen', async ({ page }) => {
      await open(page, '/', { reveal: true });
      const comp = page.locator('#product .show-comp');
      const steps = page.locator('#product .show-steps li');
      await expect(steps).toHaveCount(4);
      if (vp.width > 900) {
        // Desktop: the composite, then the four steps in one row beneath it.
        await expect(comp).toBeVisible();
        await comp.scrollIntoViewIfNeeded();
        await expect.poll(() => comp.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
        const image = await comp.boundingBox();
        const boxes = await steps.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
        for (const [i, b] of boxes.entries()) {
          expect(b.top, `step ${i + 1} sits below the image`).toBeGreaterThanOrEqual(image.y + image.height);
          expect(Math.abs(b.top - boxes[0].top), `step ${i + 1} lines up with the row`).toBeLessThanOrEqual(1);
          expect(b.left, `step ${i + 1} inside the column`).toBeGreaterThanOrEqual(image.x - 1);
          expect(b.right, `step ${i + 1} inside the column`).toBeLessThanOrEqual(image.x + image.width + 1);
          if (i) expect(b.left, `steps ${i} and ${i + 1} overlap`).toBeGreaterThanOrEqual(boxes[i - 1].right);
        }
        await expect(page.locator('#product .ss-img').first()).toBeHidden();
      } else {
        // Phones and small tablets: stacked cards, each with its own screenshot.
        await expect(comp).toBeHidden();
        let lastBottom = 0;
        for (const card of await steps.all()) {
          await card.scrollIntoViewIfNeeded();
          const img = card.locator('.ss-img');
          await expect(img).toBeVisible();
          await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
          const box = await card.evaluate((el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, width: r.width }; });
          expect(box.top, 'cards stack without overlapping').toBeGreaterThanOrEqual(lastBottom);
          expect(box.width, 'card uses the column width').toBeGreaterThan(Math.min(vp.width - 80, 600));
          lastBottom = box.bottom;
        }
      }
    });

    test('home: forms are usable', async ({ page }) => {
      await open(page, '/', { reveal: true });
      for (const id of ['#wl-name', '#wl-email', '#wl-role', '#wl-btn', '#oh-name', '#oh-email', '#oh-role', '#oh-btn']) {
        const el = page.locator(id);
        await el.scrollIntoViewIfNeeded();
        const box = await el.boundingBox();
        expect(box.width, `${id} width`).toBeGreaterThanOrEqual(Math.min(240, vp.width - 100));
        expect(box.x + box.width, `${id} on screen`).toBeLessThanOrEqual(vp.width);
        expect(box.height, `${id} tall enough to tap`).toBeGreaterThanOrEqual(40);
      }
      // Text fields and dropdowns line up at one height. Left to the font, a dropdown can end up
      // a pixel off its neighbours depending on when the web font arrives.
      const heights = await page.$$eval('.fld input, .fld select', (els) =>
        [...new Set(els.map((e) => e.getBoundingClientRect().height).filter((h) => h > 0))]
      );
      expect(heights, 'form fields share one height').toHaveLength(1);
    });

    if (vp.phone) {
      for (const p of PAGES) {
        test(`${p.name}: buttons and links are big enough to tap`, async ({ page }) => {
          await open(page, p.url, { reveal: true });
          const measure = () =>
            page.evaluate((tiers) => {
              const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
              const all = [...new Set(tiers.flatMap((t) => [...document.querySelectorAll(t.selector)]))].filter(shown);
              const center = (r) => [r.left + r.width / 2, r.top + r.height / 2];
              const distToRect = ([x, y], r) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
              // WCAG 2.5.8 exceptions: links inside a sentence, and small targets with enough space around them.
              const inSentence = (el) => getComputedStyle(el).display === 'inline' && [...el.parentElement.childNodes].some((n) => n !== el && n.nodeType === 3 && n.nodeValue.trim());
              const spaced = (el, min) => {
                const c = center(el.getBoundingClientRect());
                return all.every((o) => o === el || o.contains(el) || el.contains(o) || distToRect(c, o.getBoundingClientRect()) >= min / 2);
              };
              const out = [];
              const seen = new Set();
              for (const { min, kind, selector } of tiers) {
                for (const el of document.querySelectorAll(selector)) {
                  if (seen.has(el) || !shown(el)) continue;
                  seen.add(el);
                  const r = el.getBoundingClientRect();
                  if (Math.min(r.width, r.height) >= min) continue;
                  if (kind === 'link' && (inSentence(el) || spaced(el, min))) continue;
                  const label = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 30);
                  out.push(`${kind} "${label}" is ${Math.round(r.width)}x${Math.round(r.height)} (min ${min})`);
                }
              }
              return out;
            }, TAP);
          const small = await measure();
          // The mobile menu's links only exist on screen once it is open.
          if (await page.locator('#menu-btn').isVisible().catch(() => false)) {
            await page.locator('#menu-btn').click();
            small.push(...(await measure()));
          }
          expect([...new Set(small)]).toEqual([]);
        });
      }
    }
  });
}
