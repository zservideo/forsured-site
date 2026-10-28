// The email each blog subscriber gets when a post goes live: one personal message from Zach per
// subscriber (sent from Gmail, not a newsletter tool), built from the post's front matter.
//
//   node tools/blog/email.js <slug> [first name] [--no-hero]   prints { subject, html, text } as JSON
//
// Email clients ignore <style> blocks and web fonts, so everything is inline, table-based and
// falls back to Arial/Georgia. Backgrounds use background-color plus bgcolor, never the
// `background:` shorthand, which Gmail drops. Every link is a real <a> with anchor text.
//
// Send it with something that hands Gmail the HTML as is (the Make Gmail module). The Gmail
// connector rewrites every href into a google.com/url redirect and strips remote images; --no-hero
// leaves the image row out for a send through it.
const { readPosts, esc, inline, human, SITE } = require('./build');

const ORANGE = '#FB612A';
const INK = '#0A0A0E';
const MUTED = '#555555';
const LINE = '#E4E7EC';
const BG = '#FAFBFA';

const EMOJI = {
  'COI basics': '📋',
  'How-to': '🛠️',
  'Market outlook': '📈',
  'Industry news': '📰',
  'Event takeaways': '🎤',
  'Forsured news': '🧡',
};

const track = (url) => `${url}${url.includes('?') ? '&' : '?'}utm_source=email&utm_medium=subscriber&utm_campaign=blog`;

// Front matter text uses the blog's inline Markdown; links inside it are dropped to plain text here
// so the only links in the email are the ones we mean readers to click.
const rich = (s) => inline(s).replace(/<a [^>]*>([^<]*)<\/a>/g, '$1');
const plain = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

function email(p, firstName = '', { hero = `${SITE}/blog/${p.slug}/hero.png` } = {}) {
  const url = track(`${SITE}${p.url}`);
  const blog = track(`${SITE}/blog/`);
  const hi = firstName ? `Hi ${esc(firstName)},` : 'Hi there,';
  const emoji = EMOJI[p.category] || '📌';
  const sans = "font-family:Inter,Arial,Helvetica,sans-serif";
  const serif = "font-family:Georgia,'Times New Roman',serif";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>${esc(p.title)}</title></head>
<body style="margin:0;padding:0;background-color:${BG}" bgcolor="${BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(plain(p.dek))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BG}" bgcolor="${BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${LINE};border-radius:12px;border-top:4px solid ${ORANGE}">
  <tr><td style="padding:24px 32px 0;${sans}">
    <a href="${esc(blog)}" style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${INK};text-decoration:none">Forsured</a>
    <span style="font-size:13px;color:${MUTED};padding-left:8px">Blog</span>
  </td></tr>
  <tr><td style="padding:24px 32px 0;${sans};font-size:16px;line-height:1.6;color:${INK}">
    <p style="margin:0 0 12px">${hi}</p>
    <p style="margin:0">We just published a new post, and I think it's worth your two minutes. ${emoji}</p>
  </td></tr>
${hero ? `  <tr><td style="padding:24px 32px 0">
    <a href="${esc(url)}"><img src="${esc(hero)}" width="536" alt="${esc(p.title)}" style="display:block;width:100%;max-width:536px;height:auto;border:1px solid ${LINE};border-radius:10px"/></a>
  </td></tr>
` : ''}  <tr><td style="padding:20px 32px 0;${sans}">
    <span style="display:inline-block;padding:2px 8px;border:1px solid ${LINE};border-radius:6px;font-size:12px;font-weight:600;color:#344051"><span style="color:${ORANGE}">&#9679;</span> ${esc(p.category)} · ${p.minutes} min read</span>
  </td></tr>
  <tr><td style="padding:12px 32px 0;${serif}">
    <a href="${esc(url)}" style="font-size:28px;line-height:1.25;color:${INK};text-decoration:none">${esc(p.title)}</a>
  </td></tr>
  <tr><td style="padding:12px 32px 0;${sans};font-size:16px;line-height:1.6;color:${MUTED}">${rich(p.dek)}</td></tr>
  <tr><td style="padding:20px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF8F4" style="background-color:#FFF8F4;border-left:3px solid ${ORANGE};border-radius:8px">
      <tr><td style="padding:16px 20px;${sans};font-size:15px;line-height:1.55;color:${INK}">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#344051">⚡ The short version</p>
${p.takeaways.map((t) => `        <p style="margin:8px 0 0">✅ <strong>${rich(t)}</strong></p>`).join('\n')}
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="left" style="padding:24px 32px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="${ORANGE}" style="background-color:${ORANGE};border-radius:8px"><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;${sans};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">Read the full post →</a></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px 32px 0;${sans};font-size:16px;line-height:1.6;color:${INK}">
    <p style="margin:0">Questions, or a COI you want a second set of eyes on? Just hit reply. It comes straight to me.</p>
    <p style="margin:16px 0 0"><strong>Zach Servideo</strong><br/><span style="color:${MUTED};font-size:14px">Founder / CGO<br/>Forsured</span></p>
  </td></tr>
  <tr><td style="padding:28px 32px 24px;${sans};font-size:12px;line-height:1.6;color:${MUTED};border-top:1px solid ${LINE}">
    <p style="margin:20px 0 0">You're getting this because you signed up for new posts on the <a href="${esc(blog)}" style="color:${MUTED}">Forsured blog</a>. Not for you anymore? Reply "stop" and I'll take you off.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  const text = [
    firstName ? `Hi ${firstName},` : 'Hi there,',
    '',
    `We just published a new post, and I think it's worth your two minutes. ${emoji}`,
    '',
    p.title,
    plain(p.dek),
    '',
    'The short version:',
    ...p.takeaways.map((t) => `- ${plain(t)}`),
    '',
    `Read the full post: ${url}`,
    '',
    'Questions, or a COI you want a second set of eyes on? Just hit reply. It comes straight to me.',
    '',
    'Zach Servideo',
    'Founder / CGO',
    'Forsured',
    '',
    `You're getting this because you signed up for new posts on the Forsured blog (${SITE}/blog/). Not for you anymore? Reply "stop" and I'll take you off.`,
  ].join('\n');

  return { subject: `${emoji} ${p.title}`, html, text, date: human(p.date) };
}

module.exports = { email };

if (require.main === module) {
  const args = process.argv.slice(2);
  const noHero = args.includes('--no-hero');
  const [slug, firstName] = args.filter((a) => a !== '--no-hero');
  const post = readPosts().find((p) => p.slug === slug);
  if (!post) {
    console.error(`No published post "${slug}". Usage: node tools/blog/email.js <slug> [first name]`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(email(post, firstName, noHero ? { hero: '' } : {}), null, 2) + '\n');
}
