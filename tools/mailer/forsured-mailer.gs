// Forsured Mailer: a Google Apps Script that runs inside zach@forsured.ai's Google account.
//
// Job 1 (on from day one): turn JSON files that Claude drops in the Drive folder
// "Forsured Mail Outbox" into Gmail DRAFTS with clean links and Zach's Gmail signature.
// It never sends these. Zach reviews and hits Send.
//
// Job 2 (RETIRED 2026-11-17, kept for reference): emailed every subscriber each time a post went live.
// setupWeeklyDigest() turns it off. Make scenario 6806850, its predecessor, is also off.
//
// Job 3 (the subscriber email since 2026-11-17): every Monday morning, send last week's digest,
// forsured.ai/blog/email/weekly/<last Monday>.json, to everyone on the Attio "Blog subscribers" list.
// A week with no posts has no file, so nothing goes out.
//
// Unsubscribe (since 2026-11-18): every digest carries a personal one-click link, plus the
// List-Unsubscribe headers that make Gmail and Apple Mail show their own Unsubscribe button. Both hit
// this script deployed as a web app (doGet / doPost below). An unsubscribe is stored in Script
// Properties ("unsub:<email>"), which every send checks, and the person is also taken off the Attio
// list when the ATTIO_API_KEY can edit list entries.
//
// Why this exists: the Gmail connector Claude uses rewrites every link into a google.com/url
// redirect. GmailApp hands Gmail the HTML as written, so links stay clean.
//
// Setup is in tools/mailer/README.md. Paste this whole file into a new Apps Script project.

const OUTBOX_FOLDER_ID = '18DQRIlsK0VsgALUEO-LwYQroVHSHvnjd';
const FROM_NAME = 'Zach Servideo';
const SITE = 'https://forsured.ai';
const ATTIO_LIST = 'blog_subscribers';

// Fallback if the Gmail advanced service is off and the live signature can't be read.
const FALLBACK_SIGNATURE =
  '<div style="font-family:Arial,sans-serif;font-size:12px">' +
  '<b>Zach Servideo</b><br>Founder / CGO<br><b>m:</b> 424.280.2876<br>' +
  '<b>w:</b> <a href="https://forsured.ai/">www.forsured.ai</a></div>';

// ---------- setup ----------

// Run once from the editor (pick "setup" in the function menu, press Run, approve the prompt).
// It installs the every-minute Outbox check and runs it once.
function setup() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'processOutbox')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processOutbox').timeBased().everyMinutes(1).create();
  processOutbox();
}

// Run once only when switching blog post emails over from Make (Job 2).
function setupPostEmails() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ATTIO_API_KEY')) throw new Error('Add the ATTIO_API_KEY script property first.');
  // Mark every post already in the feed as sent, so turning this on never re-sends old posts.
  feedSlugs_().forEach((slug) => props.setProperty('sent:' + slug, 'seeded'));
  props.setProperty('ENABLE_POST_EMAILS', 'true');
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'sendNewPostEmails')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendNewPostEmails').timeBased().everyMinutes(30).create();
}

// Run once to switch from one email per post to the Monday digest (Job 3). It turns Job 2 off,
// installs a Monday 7 AM trigger (Project Settings > Time zone must be America/New_York). The first
// digest goes out the next Monday and covers the week before it, including any post already emailed.
function setupWeeklyDigest() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ATTIO_API_KEY')) throw new Error('Add the ATTIO_API_KEY script property first.');
  props.setProperty('ENABLE_POST_EMAILS', 'false');
  props.setProperty('ENABLE_WEEKLY_DIGEST', 'true');
  ScriptApp.getProjectTriggers()
    .filter((t) => ['sendNewPostEmails', 'sendWeeklyDigest'].includes(t.getHandlerFunction()))
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendWeeklyDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
}

// Sends one digest to yourself only, to check it before the first Monday. Pick a Monday that has
// posts, e.g. previewWeeklyDigest('2026-11-16'), from the editor with a small wrapper, or edit the date.
function previewWeeklyDigest(monday) {
  const week = monday || lastMonday_();
  const res = UrlFetchApp.fetch(SITE + '/blog/email/weekly/' + week + '.json', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('No digest for the week of ' + week);
  const mail = JSON.parse(res.getContentText('UTF-8'));
  const me = Session.getActiveUser().getEmail();
  const link = unsubLink_(me);
  send_(me, '[PREVIEW] ' + mail.subject, mail.html.split('%%UNSUBSCRIBE%%').join(link), link);
}

// ---------- Job 1: Outbox -> Gmail drafts ----------

// Each Outbox file is JSON:
// {
//   "to": "a@x.com, b@y.com",          required
//   "cc": "...", "bcc": "...",          optional
//   "subject": "...",                   required
//   "html": "<p>...</p>",               required (body only; the signature is added)
//   "text": "...",                      optional plain-text version
//   "signature": true,                  optional, default true
//   "replyToMessageId": "1a18...",      optional Gmail message id: makes the draft a reply in that thread
//   "replyAll": true,                   optional, with replyToMessageId
//   "images": [{"cid": "hero", "url": "https://..."}]   optional inline images, use src="cid:hero"
// }
function processOutbox() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const outbox = DriveApp.getFolderById(OUTBOX_FOLDER_ID);
    const done = subfolder_(outbox, 'Done');
    const failed = subfolder_(outbox, 'Failed');
    const files = outbox.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (!/\.json$/i.test(file.getName())) continue;
      try {
        const job = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
        const draft = makeDraft_(job);
        file.setDescription('Draft created ' + new Date().toISOString() + ' id ' + draft.getId());
        file.moveTo(done);
      } catch (err) {
        file.setDescription('Failed ' + new Date().toISOString() + ': ' + err);
        file.moveTo(failed);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function makeDraft_(job) {
  if (!job.subject && !job.replyToMessageId) throw new Error('missing subject');
  if (!job.html) throw new Error('missing html');
  const html = job.signature === false ? job.html : job.html + '<br>' + signature_();
  const text = job.text || plain_(html);
  const opts = { htmlBody: html, name: FROM_NAME };
  if (job.cc) opts.cc = job.cc;
  if (job.bcc) opts.bcc = job.bcc;
  const images = inlineImages_(job.images);
  if (images) opts.inlineImages = images;

  if (job.replyToMessageId) {
    const msg = GmailApp.getMessageById(job.replyToMessageId);
    return job.replyAll ? msg.createDraftReplyAll(text, opts) : msg.createDraftReply(text, opts);
  }
  if (!job.to) throw new Error('missing to');
  return GmailApp.createDraft(job.to, job.subject, text, opts);
}

// ---------- Job 2: new blog post -> every subscriber ----------

function sendNewPostEmails() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ENABLE_POST_EMAILS') !== 'true') return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const fresh = feedSlugs_().filter((slug) => !props.getProperty('sent:' + slug));
    if (!fresh.length) return;
    const people = subscribers_();
    fresh.forEach((slug) => {
      const res = UrlFetchApp.fetch(SITE + '/blog/' + slug + '/email.json', { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return; // Pages may not have deployed it yet; try next run.
      const mail = JSON.parse(res.getContentText('UTF-8'));
      // Record first, so a timeout mid-list can never double-send the people already done.
      props.setProperty('sent:' + slug, new Date().toISOString());
      people.forEach((p) => {
        // Same greeting the Make scenario used: "Hi <first name>," when Attio has one.
        const html = p.first ? mail.html.replace('Hi there,', 'Hi ' + p.first + ',') : mail.html;
        send_(p.email, mail.subject, html);
      });
      console.log('Sent ' + slug + ' to ' + people.length + ' subscribers');
    });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Job 3: Monday digest -> every subscriber ----------

function sendWeeklyDigest() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ENABLE_WEEKLY_DIGEST') !== 'true') return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const week = lastMonday_();
    if (props.getProperty('sent:week:' + week)) return;
    const res = UrlFetchApp.fetch(SITE + '/blog/email/weekly/' + week + '.json', { muteHttpExceptions: true });
    if (res.getResponseCode() === 404) { console.log('No posts the week of ' + week + ', nothing sent'); return; }
    if (res.getResponseCode() !== 200) throw new Error('Digest fetch failed: HTTP ' + res.getResponseCode());
    const mail = JSON.parse(res.getContentText('UTF-8'));
    const people = subscribers_();
    // Record first, so a timeout mid-list can never double-send the people already done.
    props.setProperty('sent:week:' + week, new Date().toISOString());
    people.forEach((p) => {
      const link = unsubLink_(p.email);
      let html = p.first ? mail.html.replace('Hi there,', 'Hi ' + p.first + ',') : mail.html;
      html = html.split('%%UNSUBSCRIBE%%').join(link);
      send_(p.email, mail.subject, html, link);
    });
    console.log('Sent the week of ' + week + ' (' + mail.slugs.length + ' posts) to ' + people.length + ' subscribers');
  } finally {
    lock.releaseLock();
  }
}

// The Monday of the week before this one, in the script's time zone (set it to America/New_York).
function lastMonday_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const dow = Number(Utilities.formatDate(now, tz, 'u')); // 1 = Monday ... 7 = Sunday
  const d = new Date(now.getTime() - (dow - 1 + 7) * 86400000);
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function feedSlugs_() {
  const xml = UrlFetchApp.fetch(SITE + '/blog/feed.xml').getContentText('UTF-8');
  const root = XmlService.parse(xml).getRootElement();
  const channel = root.getChild('channel');
  return channel.getChildren('item')
    .map((item) => (item.getChildText('link') || '').match(/\/blog\/([^/?#]+)/))
    .filter(Boolean)
    .map((m) => m[1]);
}

function subscribers_() {
  const key = PropertiesService.getScriptProperties().getProperty('ATTIO_API_KEY');
  const headers = { Authorization: 'Bearer ' + key };
  const entries = JSON.parse(UrlFetchApp.fetch('https://api.attio.com/v2/lists/' + ATTIO_LIST + '/entries/query', {
    method: 'post', contentType: 'application/json', headers, payload: JSON.stringify({ limit: 500 }),
  }).getContentText()).data;
  const props = PropertiesService.getScriptProperties();
  const seen = {};
  entries.forEach((entry) => {
    const person = JSON.parse(UrlFetchApp.fetch(
      'https://api.attio.com/v2/objects/people/records/' + entry.parent_record_id, { headers }
    ).getContentText()).data;
    const address = ((person.values.email_addresses || [])[0] || {}).email_address;
    if (!address || seen[address.toLowerCase()] || props.getProperty('unsub:' + address.toLowerCase())) return;
    const first = ((person.values.name || [])[0] || {}).first_name || '';
    seen[address.toLowerCase()] = { email: address, first: first.trim() };
  });
  return Object.values(seen);
}

// ---------- Unsubscribe web app ----------
// Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone. The link in each email
// is <web app URL>?e=<email>&t=<token>; the token is an HMAC of the address, so nobody can
// unsubscribe someone else by editing the link.
//
// A plain click (GET) shows a confirm button first, because company email scanners open links in
// incoming mail and would otherwise unsubscribe people by accident. The mail app's one-click
// button sends a POST, which scanners don't do, so that one unsubscribes right away.

function doGet(e) {
  const p = (e && e.parameter) || {};
  const email = String(p.e || '').trim().toLowerCase();
  if (!validToken_(email, p.t)) return page_('This link didn\'t work', '<p>Reply "stop" to any Forsured email and Zach will take you off the list.</p>');
  if (p.confirm !== '1') {
    const confirm = unsubLink_(email) + '&confirm=1';
    return page_('Unsubscribe from the Forsured weekly newsletter?',
      '<p>' + esc_(email) + ' will stop getting the Monday email.</p>' +
      '<p><a class="btn" href="' + esc_(confirm) + '" target="_top">Unsubscribe</a></p>');
  }
  unsubscribe_(email, 'link');
  return page_('You\'re unsubscribed', '<p>' + esc_(email) + ' won\'t get the Forsured weekly newsletter anymore. Changed your mind? Sign up again anytime at <a href="' + SITE + '/blog/" target="_top">forsured.ai/blog</a>.</p>');
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const email = String(p.e || '').trim().toLowerCase();
  if (validToken_(email, p.t)) unsubscribe_(email, 'one-click');
  return ContentService.createTextOutput('ok');
}

function unsubscribe_(email, how) {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('unsub:' + email)) props.setProperty('unsub:' + email, new Date().toISOString() + ' ' + how);
  console.log('Unsubscribed ' + email + ' (' + how + ')');
  try {
    removeFromAttio_(email);
  } catch (err) {
    // Usually a read-only Attio token. The Script Properties entry still stops every send.
    console.log('Attio removal failed for ' + email + ': ' + err);
  }
}

function removeFromAttio_(email) {
  const key = PropertiesService.getScriptProperties().getProperty('ATTIO_API_KEY');
  if (!key) return;
  const headers = { Authorization: 'Bearer ' + key };
  const entries = JSON.parse(UrlFetchApp.fetch('https://api.attio.com/v2/lists/' + ATTIO_LIST + '/entries/query', {
    method: 'post', contentType: 'application/json', headers, payload: JSON.stringify({ limit: 500 }),
  }).getContentText()).data;
  entries.forEach((entry) => {
    const person = JSON.parse(UrlFetchApp.fetch(
      'https://api.attio.com/v2/objects/people/records/' + entry.parent_record_id, { headers }
    ).getContentText()).data;
    const addresses = (person.values.email_addresses || []).map((a) => String(a.email_address || '').toLowerCase());
    if (addresses.includes(email)) {
      UrlFetchApp.fetch('https://api.attio.com/v2/lists/' + ATTIO_LIST + '/entries/' + entry.id.entry_id, { method: 'delete', headers });
      console.log('Removed ' + email + ' from Attio ' + ATTIO_LIST);
    }
  });
}

function unsubLink_(email) {
  const url = ScriptApp.getService().getUrl();
  // Not deployed as a web app yet: fall back to an email to Zach, so a send never goes out with a dead link.
  if (!url) return 'mailto:' + Session.getActiveUser().getEmail() + '?subject=unsubscribe';
  const address = email.toLowerCase();
  return url + '?e=' + encodeURIComponent(address) + '&t=' + token_(address);
}

function token_(email) {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('UNSUB_SECRET');
  if (!secret) { secret = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('UNSUB_SECRET', secret); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(email, secret)).replace(/=+$/, '').slice(0, 22);
}

function validToken_(email, t) {
  return !!email && !!t && email.indexOf('@') > 0 && token_(email) === String(t);
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page_(title, body) {
  const html = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:Inter,Arial,sans-serif;background:#FAFBFA;color:#0A0A0E;margin:0;padding:48px 16px}' +
    '.card{max-width:480px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-top:4px solid #FB612A;border-radius:12px;padding:28px}' +
    'h1{font-size:22px;margin:0 0 12px}p{font-size:16px;line-height:1.55;color:#344051}a{color:#0A0A0E}' +
    '.btn{display:inline-block;background:#FB612A;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px}</style></head>' +
    '<body><div class="card"><p style="font-weight:800;font-size:18px;color:#0A0A0E;margin:0 0 16px">Forsured</p><h1>' + esc_(title) + '</h1>' + body + '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------- helpers ----------

// Sends through the Gmail API with a hand-built UTF-8 message. GmailApp.sendEmail turns emoji in
// the subject and body into rows of question marks; an RFC 2047 subject and base64 UTF-8 parts don't.
// unsubUrl (optional): adds List-Unsubscribe and List-Unsubscribe-Post (RFC 8058), so mail apps show
// their own one-click Unsubscribe button. Only the Gmail API path can set headers.
function send_(to, subject, html, unsubUrl) {
  if (typeof Gmail === 'undefined') {
    // Gmail advanced service not added: GmailApp still delivers, though emoji outside the BMP break.
    console.log('Gmail advanced service is off; sending with GmailApp');
    GmailApp.sendEmail(to, subject, plain_(html), { htmlBody: html, name: FROM_NAME });
    return;
  }
  const b64 = (str) => Utilities.base64Encode(str, Utilities.Charset.UTF_8).replace(/.{76}/g, '$&\r\n');
  const boundary = 'fsd' + Utilities.getUuid().replace(/-/g, '');
  const mime = [
    'From: "' + FROM_NAME + '" <' + Session.getActiveUser().getEmail() + '>',
    'To: ' + to,
    'Subject: ' + encodedWords_(subject),
    ...(unsubUrl && /^https:/.test(unsubUrl) ? [
      'List-Unsubscribe: <' + unsubUrl + '&one=1>, <mailto:' + Session.getActiveUser().getEmail() + '?subject=unsubscribe>',
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    ] : []),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(plain_(html)),
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html),
    '--' + boundary + '--',
  ].join('\r\n');
  Gmail.Users.Messages.send({ raw: Utilities.base64EncodeWebSafe(mime) }, 'me');
}

// RFC 2047 caps an encoded word at 75 characters, so long subjects go out as several, never
// splitting an emoji.
function encodedWords_(text) {
  const chars = Array.from(text);
  const words = [];
  for (let i = 0; i < chars.length; i += 10) {
    words.push('=?UTF-8?B?' + Utilities.base64Encode(chars.slice(i, i + 10).join(''), Utilities.Charset.UTF_8) + '?=');
  }
  return words.join('\r\n ');
}

function signature_() {
  try {
    const me = Session.getActiveUser().getEmail();
    const sig = Gmail.Users.Settings.SendAs.get('me', me).signature;
    if (sig) return '<div class="gmail_signature">' + sig + '</div>';
  } catch (err) {
    console.log('Live signature unavailable (' + err + '), using fallback');
  }
  return FALLBACK_SIGNATURE;
}

function inlineImages_(list) {
  if (!list || !list.length) return null;
  const out = {};
  list.forEach((img) => { out[img.cid] = UrlFetchApp.fetch(img.url).getBlob().setName(img.cid); });
  return out;
}

function subfolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function plain_(html) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>|<\/(p|div|tr|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
