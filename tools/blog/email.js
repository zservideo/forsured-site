// The email each blog subscriber gets when a post goes live: one personal message from Zach per
// subscriber (sent from Gmail, not a newsletter tool), built from the post's front matter.
//
//   node tools/blog/email.js <slug> [first name] [--no-hero]   prints { subject, html, text } as JSON
//   node tools/blog/email.js --welcome [first name]             the welcome email a new subscriber gets
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

// Emoji and other characters outside the Basic Multilingual Plane become numeric entities in the
// HTML. Apps Script's GmailApp turns raw ones into a row of question marks.
const entities = (html) => html.replace(/[\u{10000}-\u{10FFFF}]/gu, (c) => `&#x${c.codePointAt(0).toString(16).toUpperCase()};`);

const EMOJI = {
  'COI basics': '📋',
  'How-to': '🛠️',
  'Market outlook': '📈',
  'Industry news': '📰',
  'Event takeaways': '🎤',
  'Forsured news': '🧡',
};

const track = (url, campaign = 'blog') => {
  const [base, hash] = url.split('#');
  const q = `${base.includes('?') ? '&' : '?'}utm_source=email&utm_medium=subscriber&utm_campaign=${campaign}`;
  return `${base}${q}${hash ? `#${hash}` : ''}`;
};

// Posts that still read well months later go first in the welcome email's "Start here".
const EVERGREEN = ['COI basics', 'How-to', 'Market outlook'];

const sans = 'font-family:Inter,Arial,Helvetica,sans-serif';
const serif = "font-family:Georgia,'Times New Roman',serif";

// Front matter text uses the blog's inline Markdown; links inside it are dropped to plain text here
// so the only links in the email are the ones we mean readers to click.
const rich = (s) => inline(s).replace(/<a [^>]*>([^<]*)<\/a>/g, '$1');
const plain = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

// The frame every subscriber email shares: wordmark, rows, Zach's sign-off and the opt-out footer.
function frame({ title, preheader, rows, closer, blog }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background-color:${BG}" bgcolor="${BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BG}" bgcolor="${BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${LINE};border-radius:12px;border-top:4px solid ${ORANGE}">
  <tr><td style="padding:24px 32px 0;${sans}">
    <a href="${esc(blog)}" style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${INK};text-decoration:none">Forsured</a>
    <span style="font-size:13px;color:${MUTED};padding-left:8px">Blog</span>
  </td></tr>
${rows}  <tr><td style="padding:28px 32px 0;${sans};font-size:16px;line-height:1.6;color:${INK}">
    <p style="margin:0">${closer}</p>
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
}

const SIGN_OFF = ['Zach Servideo', 'Founder / CGO', 'Forsured'];
const footer = () =>
  `You're getting this because you signed up for new posts on the Forsured blog (${SITE}/blog/). Not for you anymore? Reply "stop" and I'll take you off.`;

const button = (href, label) => `  <tr><td align="left" style="padding:24px 32px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="${ORANGE}" style="background-color:${ORANGE};border-radius:8px"><a href="${esc(href)}" style="display:inline-block;padding:12px 22px;${sans};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${label}</a></td>
    </tr></table>
  </td></tr>
`;

// A tinted box with an uppercase label, used for takeaways and the welcome offer.
const box = (label, inner) => `  <tr><td style="padding:20px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF8F4" style="background-color:#FFF8F4;border-left:3px solid ${ORANGE};border-radius:8px">
      <tr><td style="padding:16px 20px;${sans};font-size:15px;line-height:1.55;color:${INK}">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#344051">${label}</p>
${inner}
      </td></tr>
    </table>
  </td></tr>
`;

function email(p, firstName = '', { hero = `${SITE}/blog/${p.slug}/hero.png` } = {}) {
  const url = track(`${SITE}${p.url}`);
  const blog = track(`${SITE}/blog/`);
  const hi = firstName ? `Hi ${esc(firstName)},` : 'Hi there,';
  const emoji = EMOJI[p.category] || '📌';

  const html = frame({
    title: p.title,
    preheader: plain(p.dek),
    blog,
    rows: `  <tr><td style="padding:24px 32px 0;${sans};font-size:16px;line-height:1.6;color:${INK}">
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
` +
      box('⚡ The short version', p.takeaways.map((t) => `        <p style="margin:8px 0 0">✅ <strong>${rich(t)}</strong></p>`).join('\n')) +
      button(url, 'Read the full post →'),
    closer: 'Questions, or a COI you want a second set of eyes on? Just hit reply. It comes straight to me.',
  });

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
    ...SIGN_OFF,
    '',
    footer(),
  ].join('\n');

  return { subject: `${emoji} ${p.title}`, html: entities(html), text, date: human(p.date) };
}

// The welcome a new subscriber gets right after signing up: thanks, what to expect, three posts to
// start with (newest evergreen ones first), and the free COI risk check offer.
function welcome(firstName = '', posts = readPosts()) {
  const blog = track(`${SITE}/blog/`, 'welcome');
  const offer = track(`${SITE}/#demo`, 'welcome');
  const hi = firstName ? `Hi ${esc(firstName)},` : 'Hi there,';
  const start = [...posts.filter((p) => EVERGREEN.includes(p.category)), ...posts.filter((p) => !EVERGREEN.includes(p.category))];
  const reads = start.slice(0, 3).map((p) => ({ ...p, link: track(`${SITE}${p.url}`, 'welcome'), emoji: EMOJI[p.category] || '📌' }));
  const expect = [
    ['New posts as they go live.', 'Plain-language reads on contractor COIs and project requirements.'],
    ['Short and useful.', 'Two-minute reads you can forward to your project team.'],
    ['A real person on the other end.', 'Hit reply anytime. It comes straight to me.'],
  ];

  const html = frame({
    title: 'Welcome to the Forsured community',
    preheader: "You're in. Here's what to expect, a few reads to start with, and a free COI risk check.",
    blog,
    rows: `  <tr><td style="padding:24px 32px 0;${serif}">
    <p style="margin:0;font-size:28px;line-height:1.25;color:${INK}">Welcome to the Forsured community 🎉</p>
  </td></tr>
  <tr><td style="padding:16px 32px 0;${sans};font-size:16px;line-height:1.6;color:${INK}">
    <p style="margin:0 0 12px">${hi}</p>
    <p style="margin:0">Thanks for signing up. You just joined the contractors, brokers, risk managers and carriers who would rather catch a coverage gap on a contractor COI <strong>before</strong> a claim finds it. 🧡</p>
  </td></tr>
` +
      box('📬 What you\'ll get', expect.map(([b, t]) => `        <p style="margin:8px 0 0">✅ <strong>${b}</strong> ${t}</p>`).join('\n')) +
      `  <tr><td style="padding:28px 32px 0;${sans}">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#344051">📚 Start here</p>
${reads.map((p) => `    <p style="margin:12px 0 0;font-size:16px;line-height:1.45">${p.emoji} <a href="${esc(p.link)}" style="color:${INK};font-weight:600;text-decoration:underline;text-decoration-color:${ORANGE}">${esc(p.title)}</a><br/><span style="font-size:13px;color:${MUTED}">${esc(p.category)} · ${p.minutes} min read</span></p>`).join('\n')}
  </td></tr>
` +
      box('🎁 A welcome offer', `        <p style="margin:8px 0 0"><strong>Free COI risk check, no strings attached.</strong> Send us one project's requirements and a contractor COI or two, and we'll walk you through every gap we find.</p>`) +
      button(offer, 'Get my free COI risk check →'),
    closer: "Glad you're here. If there is a COI question you want us to write about, reply and tell me.",
  });

  const text = [
    firstName ? `Hi ${firstName},` : 'Hi there,',
    '',
    'Welcome to the Forsured community! 🎉',
    '',
    'Thanks for signing up. You just joined the contractors, brokers, risk managers and carriers who would rather catch a coverage gap on a contractor COI before a claim finds it.',
    '',
    "What you'll get:",
    ...expect.map(([b, t]) => `- ${b} ${t}`),
    '',
    'Start here:',
    ...reads.map((p) => `- ${p.title}: ${p.link}`),
    '',
    `A welcome offer: a free COI risk check, no strings attached. Send us one project's requirements and a contractor COI or two, and we'll walk you through every gap we find: ${offer}`,
    '',
    "Glad you're here. If there is a COI question you want us to write about, reply and tell me.",
    '',
    ...SIGN_OFF,
    '',
    footer(),
  ].join('\n');

  return { subject: '🧡 Welcome to the Forsured community', html: entities(html), text };
}

module.exports = { email, welcome };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--welcome') {
    process.stdout.write(JSON.stringify(welcome(args[1]), null, 2) + '\n');
    process.exit(0);
  }
  const noHero = args.includes('--no-hero');
  const [slug, firstName] = args.filter((a) => a !== '--no-hero');
  const post = readPosts().find((p) => p.slug === slug);
  if (!post) {
    console.error(`No published post "${slug}". Usage: node tools/blog/email.js <slug> [first name]`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(email(post, firstName, noHero ? { hero: '' } : {}), null, 2) + '\n');
}
