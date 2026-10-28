// Forsured Mailer: a Google Apps Script that runs inside zach@forsured.ai's Google account.
//
// Job 1 (on from day one): turn JSON files that Claude drops in the Drive folder
// "Forsured Mail Outbox" into Gmail DRAFTS with clean links and Zach's Gmail signature.
// It never sends these. Zach reviews and hits Send.
//
// Job 2 (off until ENABLE_POST_EMAILS is set): when a new post appears in forsured.ai/blog/feed.xml,
// send blog/<slug>/email.json to everyone on the Attio "Blog subscribers" list. This replaces
// Make scenario 6806850 and is meant to run only after that scenario is turned off.
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
        GmailApp.sendEmail(p.email, mail.subject, plain_(html), { htmlBody: html, name: FROM_NAME });
      });
      console.log('Sent ' + slug + ' to ' + people.length + ' subscribers');
    });
  } finally {
    lock.releaseLock();
  }
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
  const seen = {};
  entries.forEach((entry) => {
    const person = JSON.parse(UrlFetchApp.fetch(
      'https://api.attio.com/v2/objects/people/records/' + entry.parent_record_id, { headers }
    ).getContentText()).data;
    const address = ((person.values.email_addresses || [])[0] || {}).email_address;
    if (!address || seen[address.toLowerCase()]) return;
    const first = ((person.values.name || [])[0] || {}).first_name || '';
    seen[address.toLowerCase()] = { email: address, first: first.trim() };
  });
  return Object.values(seen);
}

// ---------- helpers ----------

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
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
