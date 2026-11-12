// Terms of Service and Privacy Policy by the forms. The site runs Google Analytics and collects emails,
// so every form that collects an email says that submitting means agreeing to both, with working links.
// The footer links on every page are checked in site.spec.js.
const { test, expect } = require('@playwright/test');
const { PAGES, open, read } = require('./helpers');

const TERMS = 'https://app.forsured.com/terms';
const PRIVACY = 'https://app.forsured.com/privacy';

test('every form that collects an email carries the agreement line with both links', () => {
  let forms = 0;
  for (const p of PAGES) {
    const html = read(p.file);
    const n = (html.match(/<form[\s>]/g) || []).length;
    if (!n) continue;
    forms += n;
    const lines = html.match(/<p class="(?:fnote|fine)"[^>]*>By (?:submitting|subscribing), you agree to our .*?<\/p>/g) || [];
    expect(lines.length, `${p.file}: one agreement line per form`).toBe(n);
    for (const l of lines) {
      expect(l).toContain(`<a href="${TERMS}" target="_blank" rel="noopener">Terms of Service</a>`);
      expect(l).toContain(`<a href="${PRIVACY}" target="_blank" rel="noopener">Privacy Policy</a>`);
    }
  }
  // Home page waitlist + risk check, and the blog subscribe boxes.
  expect(forms).toBeGreaterThanOrEqual(3);
});

test('the agreement links are visible under the home page risk check form', async ({ page }) => {
  await open(page, '/', { fonts: false, reveal: true });
  const note = page.locator('#fc .fnote');
  await note.scrollIntoViewIfNeeded();
  for (const [name, href] of [['Terms of Service', TERMS], ['Privacy Policy', PRIVACY]]) {
    const link = note.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toBeVisible();
  }
});
