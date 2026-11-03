# Forsured Mailer (Google Apps Script)

`forsured-mailer.gs` runs inside zach@forsured.ai's Google account. It isn't deployed from this repo.
The copy here is the source of truth, and it's pasted into script.google.com.

## Why

The Gmail connector Claude uses rewrites every link into a `google.com/url` redirect. It does this for
HTML, plain text and bare URLs alike (tested Oct 28, 2026), and no setting or format avoids it.
Gmail's own APIs (GmailApp here, or the Gmail module in Make) keep links exactly as written.

## How Claude drafts an email

Claude writes one JSON file into the Drive folder **Forsured Mail Outbox**
(id `18DQRIlsK0VsgALUEO-LwYQroVHSHvnjd`) with the Google Drive connector (`create_file`,
`contentMimeType: application/json`, `disableConversionToGoogleType: true`, title ending `.json`).
Within about a minute the script turns it into a Gmail draft with Zach's live signature and moves the
file to `Done/` (or `Failed/`, with the error in the file's description).

```json
{
  "to": "name@company.com",
  "cc": "marc@forsured.ai",
  "subject": "Following up from IRMI",
  "html": "<p>Hi Jane,</p><p>...</p>",
  "replyToMessageId": "optional Gmail message id, makes it a reply in that thread",
  "replyAll": false,
  "signature": true
}
```

The script never sends these drafts. Zach reviews and sends.

## One-time setup (about 5 minutes)

1. Go to https://script.new while signed in as zach@forsured.ai. Name the project "Forsured Mailer".
2. Replace everything in `Code.gs` with this file and save.
3. Left sidebar, **Services +** → **Gmail API** → Add. (It reads your live Gmail signature, and blog post
   emails go out through it so emoji arrive intact. GmailApp turns them into question marks.)
4. Pick `setup` in the function menu and press **Run**. Approve the Google prompt (Advanced →
   Go to Forsured Mailer if it warns that the app is unverified; it's your own script).
5. Check Gmail Drafts for "[TEST] Forsured Mailer: clean links check" and click its link.

## Blog post emails (optional, replaces Make scenario 6806850)

1. In Attio, Settings → Developers → create an access token with read access to records and lists.
2. In Apps Script, Project Settings → Script Properties → add `ATTIO_API_KEY`.
3. Turn off Make scenario 6806850 first, then run `setupPostEmails` once. It marks every post already
   in the feed as sent, so nothing old goes out, and checks the feed every 30 minutes after that.

Welcome emails stay on Make scenario 6806829, which works and uses few credits.
