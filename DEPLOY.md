# Deploying ICCS-CIRCLE 2027

The site has **no server of its own**. It is two pieces:

| Piece | What it is | Hosted on |
|---|---|---|
| Website | Static files: `index.html`, `css/`, `js/`, `assets/` | Vercel (auto-deploys on every push to `main`) |
| Forms backend | `google-apps-script/Code.gs`, a Google Apps Script attached to the conference spreadsheet | Google (deployed as a Web App) |

The browser sends every form (registration, verify, abstract, abstract status, contact) straight
to the Apps Script's `/exec` URL, set in `js/config.js`. The script validates the input, writes
the spreadsheet, enforces "one registration per email/phone" and "one abstract per
registration", and sends the emails. Faculty review abstracts directly in the spreadsheet.

---

## 1. The spreadsheet

Four tabs with these header rows (row 1). Names are case-sensitive, column order doesn't matter,
extra columns are fine. The script refuses to write if a required column is missing.

| Tab | Required columns |
|---|---|
| `Registrations` | registration_id, name, email, phone, institution, category, payment_status, registration_status, created_at, updated_at (optional: designation, country, presentation_type) |
| `Abstracts` | abstract_id, registration_id, title, authors, corresponding_author, email, affiliation, keywords, presentation_category, abstract_text, word_count, submission_status, reviewer, review_comments, created_at, updated_at (optional: submission_id) |
| `ContactMessages` | message_id, name, email, subject, message, status, created_at |

The old `Users` tab is no longer used and can be deleted.

## 2. Deploy or update the Apps Script

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `google-apps-script/Code.gs` from this repo. Save.
3. **Once:** choose `installTriggers` in the function dropdown → **Run** → authorize. This
   installs the trigger that emails authors when their abstract is accepted.
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

## 4. Reviewing abstracts (faculty)

In the `Abstracts` tab, set **`submission_status`** to `Accepted` or `Rejected` (the column has
a dropdown). Optionally fill `review_comments` (shown to the author after the decision) and
`reviewer`.

- Setting **Accepted** emails the author once (via the trigger from step 2.3). They then see
  the payment details by entering their Registration ID and email under *Call for Abstracts*.
- Payment details are only ever sent for an `Accepted` abstract. They live in `PAYMENT_INFO`
  near the top of `Code.gs`.

## 5. Smoke test after a deploy

On the live site:
1. Register with a test email → you see a Registration ID and receive the confirmation email.
2. Register again with the same email → "Already Registered".
3. Submit a 50+ word abstract → status panel shows **Submitted**, no payment details.
4. In the sheet, set that abstract to **Accepted** → the author email arrives; *Refresh status*
   on the site shows **Accepted** with the payment details.
5. Send a contact message → it appears in `ContactMessages` and iccscircle@gmail.com is emailed.

Then delete the test rows from the three tabs.

## Limits to know

- **Email quota:** Apps Script sends from the account that deployed it — about 100
  recipients/day on a personal Gmail account, 1,500 on Google Workspace. Each registration,
  abstract, acceptance and contact message uses one.
- **Spam protection:** hidden honeypot field, input length limits, and at most 5 submissions per
  email address per 10 minutes. There is no per-IP limit (Apps Script cannot see IP addresses).
- **Speed:** the first request after a quiet period can take a few seconds while Google starts
  the script.
- The `/exec` URL in `js/config.js` is public by design; the script only exposes the five form
  actions above — nobody can read or list the spreadsheet through it.
