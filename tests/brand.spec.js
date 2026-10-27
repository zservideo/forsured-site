// Brand guardrails: colors, fonts, logo and buttons stay on the brand defined in tests/brand.json.
// A new color or font fails here until it is added to brand.json on purpose.
const { test, expect } = require('@playwright/test');
const { PAGES, BRAND, open, settle, parseColor, onBrand, hex, read } = require('./helpers');

// Colors written in the page source: CSS (including hover/focus states and media queries),
// inline styles, SVG fill/stroke and the data-URI favicon.
function sourceColors(html) {
  const src = html
    .replace(/data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+/g, '')
    .replace(/%23([0-9a-fA-F]{3,8})\b/g, '#$1')
    .replace(/href="#[^"]*"|id="[^"]*"|aria-[a-z]+="[^"]*"/g, '');
  const found = new Map();
  for (const m of src.matchAll(/(?<![&\w])#([0-9a-fA-F]{3,8})\b|rgba?\([^)]*\)/g)) {
    if (m[1] && ![3, 4, 6, 8].includes(m[1].length)) continue;
    const c = parseColor(m[0]);
    if (!c || c[3] === 0) continue;
    const line = src.slice(0, m.index).split('\n').length;
    if (!found.has(hex(c))) found.set(hex(c), { color: m[0], line, rgb: c });
  }
  return [...found.values()];
}

for (const p of PAGES) {
  test.describe(`${p.name} brand`, () => {
    test('every color in the source is on the brand palette', async ({}, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'source check runs once');
      const off = sourceColors(read(p.file)).filter((c) => !onBrand(c.rgb));
      expect(off.map((c) => `${c.color} (${hex(c.rgb)}) near line ${c.line}`), 'colors missing from tests/brand.json').toEqual([]);
    });

    test('every rendered color is on the brand palette', async ({ page }) => {
      await open(page, p.url, { reveal: true });
      const used = await page.evaluate(() => {
        const out = [];
        const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
        for (const el of document.querySelectorAll('body, body *')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden') continue;
          const add = (prop, v) => v && out.push({ el: name(el), prop, v });
          if (el.childNodes && [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) add('color', cs.color);
          add('background-color', cs.backgroundColor);
          for (const c of (cs.backgroundImage.match(/rgba?\([^)]*\)/g) || [])) add('background-image', c);
          for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') add('border', cs[`border${side}Color`]);
          if (el instanceof SVGElement) {
            if (cs.fill && cs.fill.startsWith('rgb')) add('fill', cs.fill);
            if (cs.stroke && cs.stroke.startsWith('rgb') && cs.stroke !== 'none') add('stroke', cs.stroke);
          }
        }
        return out;
      });
      const off = new Map();
      for (const u of used) {
        const c = parseColor(u.v);
        if (!c || c[3] === 0 || onBrand(c)) continue;
        if (!off.has(hex(c))) off.set(hex(c), `${hex(c)} as ${u.prop} on ${u.el}`);
      }
      expect([...off.values()], 'rendered colors missing from tests/brand.json (an unstyled link shows up here as browser blue)').toEqual([]);
    });

    test('CSS color tokens match the brand file', async ({ page }) => {
      await open(page, p.url, { fonts: false });
      const tokens = { ...BRAND.tokens, ...(p.url === '/' ? BRAND.homeTokens : {}) };
      const actual = await page.evaluate((names) => {
        const cs = getComputedStyle(document.documentElement);
        return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()]));
      }, Object.keys(tokens));
      for (const [name, value] of Object.entries(tokens)) {
        expect(parseColor(actual[name]) && hex(parseColor(actual[name])), `${name}`).toBe(hex(parseColor(value)));
      }
    });

    test('text uses only the brand fonts, and they load', async ({ page }) => {
      await open(page, p.url, { reveal: true });
      const { families, loaded } = await page.evaluate(() => {
        const families = {};
        for (const el of document.querySelectorAll('body *')) {
          if (!el.getBoundingClientRect().width) continue;
          if (![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
          const first = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
          families[first] = families[first] || el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
        }
        const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''));
        return { families, loaded: [...new Set(loaded)] };
      });
      const stray = Object.entries(families).filter(([f]) => !BRAND.fonts.includes(f)).map(([f, el]) => `${f} (e.g. ${el})`);
      expect(stray, 'fonts outside the brand set').toEqual([]);
      for (const f of Object.keys(families)) expect(loaded, `${f} web font loaded`).toContain(f);
    });

    test('logo is the Forsured wordmark', async ({ page }) => {
      await open(page, p.url);
      const logo = page.locator('nav .nlogo');
      await expect(logo).toHaveText(BRAND.logo.text);
      const style = await logo.evaluate((el) => ({ family: getComputedStyle(el).fontFamily, weight: getComputedStyle(el).fontWeight, color: getComputedStyle(el).color }));
      expect(style.family).toContain(BRAND.logo.family);
      expect(style.weight).toBe(BRAND.logo.weight);
      expect(hex(parseColor(style.color))).toBe(hex(parseColor(BRAND.tokens['--tx'])));
    });

    test('primary buttons are brand orange with white text', async ({ page }) => {
      await open(page, p.url, { reveal: true });
      const ctas = await page.locator('.cta-p:visible, .wl-sub:visible').evaluateAll((els) =>
        els.map((el) => {
          const cs = getComputedStyle(el);
          return { text: el.textContent.trim(), color: cs.color, bg: cs.backgroundColor, img: cs.backgroundImage };
        })
      );
      expect(ctas.length).toBeGreaterThan(0);
      const orange = hex(parseColor(BRAND.tokens['--f']));
      for (const c of ctas) {
        expect(hex(parseColor(c.color)), `${c.text} text color`).toBe('#FFFFFF');
        const stops = [c.bg, ...(c.img.match(/rgba?\([^)]*\)/g) || [])].map(parseColor).filter((x) => x && x[3] > 0).map(hex);
        expect(stops, `${c.text} background uses brand orange`).toContain(orange);
      }
    });
  });
}

test('browser theme color and favicon use brand orange', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'source check runs once');
  const orange = BRAND.tokens['--f'].toUpperCase();
  for (const p of PAGES) {
    const html = read(p.file);
    expect(html.match(/<meta name="theme-color" content="([^"]+)"/)[1].toUpperCase(), `${p.file} theme-color`).toBe(orange);
    expect(decodeURIComponent(html.match(/<link rel="icon"[^>]*href="([^"]+)"/)[1]).toUpperCase(), `${p.file} favicon`).toContain(orange);
  }
});
