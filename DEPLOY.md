# Deploying ICCS-CIRCLE 2027

The site has **no server of its own**. It is two pieces:

| Piece | What it is | Hosted on |
|---|---|---|
| Website | Static files: `index.html`, `css/`, `js/`, `assets/` | Vercel (auto-deploys on every push to `main`) |
| Forms backend | `google-apps-script/Code.gs`, a Google Apps Script attached to the conference spreadsheet | Google (deployed as a Web App) |

The browser sends the two forms (registration, contact) straight to the Apps Script's `/exec`
URL, set in `js/config.js`. The script validates the input, writes the spreadsheet, enforces
"one registration per email/phone", and sends the emails.

**Abstract submission is not handled by this site.** It is separate from registration and will
run through EasyChair; the abstract section of the page shows a "Coming Soon" card until the
EasyChair link is available (see §4).

---

## 1. The spreadsheet

Four tabs with these header rows (row 1). Names are case-sensitive, column order doesn't matter,
extra columns are fine. The script refuses to write if a required column is missing.

| Tab | Required columns |
|---|---|
| `Registrations` | registration_id, name, email, phone, institution, category, payment_status, registration_status, created_at, updated_at (optional: designation, country, presentation_type) |
| `Abstracts` *(dormant — only used if the in-page abstract flow returns)* | abstract_id, registration_id, title, authors, corresponding_author, email, affiliation, keywords, presentation_category, abstract_text, word_count, submission_status, reviewer, review_comments, created_at, updated_at (optional: submission_id) |
| `ContactMessages` | message_id, name, email, subject, message, status, created_at |

The old `Users` tab is no longer used and can be deleted.

## 2. Deploy or update the Apps Script

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `google-apps-script/Code.gs` from this repo. Save.
3. **Once:** choose `installTriggers` in the function dropdown → **Run** → authorize. This
   installs the trigger that emails authors when their abstract is accepted. *(Only needed if the
   in-page abstract flow returns; it can be skipped while abstracts go through EasyChair.)*
4. **Deploy → Manage deployments →** select the existing Web app → ✏️ **Edit** → Version:
   **New version** → **Deploy**. Keep *Execute as: Me* and *Who has access: Anyone*.
   - Editing the existing deployment keeps the same `/exec` URL, so `js/config.js` doesn't change.
   - If you create a *new* deployment instead, copy its URL into `js/config.js` and push.
5. Check: open the `/exec` URL in a browser → `{"success":true,"data":{"status":"ok",...}}`.

**Every edit to `Code.gs` needs step 4 again**, or the live forms keep running the old version.
The `SHARED_SECRET` script property from the old setup is no longer used and can be deleted.

## 3. Deploy the website

Push to `main`; Vercel publishes the files as they are (no build step). After deploying, hard
refresh (Ctrl+F5). Static assets use `?v=N` query strings — bump `N` in `index.html` when you
change a CSS/JS/image file so browsers fetch the new copy.

## 4. Abstract submission (EasyChair)

The "Call for Abstracts" section currently shows a **Coming Soon — Submit via EasyChair** card.
When the EasyChair submission page is ready, replace that card in `index.html` (section
`id="abstracts"`) with a button linking to it, e.g. `<a class="btn btn-solid" href="…">Submit on
EasyChair</a>`, bump `?v=N` on the CSS/JS links if you touch them, and push.

The in-page abstract code in `Code.gs` (`submitAbstract`, `abstractStatus`, `verifyRegistration`
and the acceptance-email trigger) is **dormant**: nothing on the site calls it, but it still answers
if someone posts to the `/exec` URL directly. Delete those functions if the in-page flow is not
coming back.

## 5. Smoke test after a deploy

On the live site:
1. Register with a test email → you see a Registration ID and receive the confirmation email.
2. Register again with the same email → "Already Registered".
3. Check the *Registration* section shows the fee table and the *How to pay* options.
4. Check the *Call for Abstracts* section shows the **Coming Soon** card.
5. Send a contact message → it appears in `ContactMessages` and iccscircle@gmail.com is emailed.

Then delete the test rows from the `Registrations` and `ContactMessages` tabs.

## Limits to know

- **Email quota:** Apps Script sends from the account that deployed it — about 100
  recipients/day on a personal Gmail account, 1,500 on Google Workspace. Each registration
  and contact message uses one.
- **Spam protection:** hidden honeypot field, input length limits, and at most 5 submissions per
  email address per 10 minutes. There is no per-IP limit (Apps Script cannot see IP addresses).
- **Speed:** the first request after a quiet period can take a few seconds while Google starts
  the script.
- The `/exec` URL in `js/config.js` is public by design; the script exposes only form actions
  (register, contact, plus the dormant abstract ones) — nobody can read or list the spreadsheet
  through it.
