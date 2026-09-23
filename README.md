<<<<<<< HEAD
# ICCS-CIRCLE 2027 Conference Website

A static public conference website (HTML/CSS/vanilla JS) for **ICCS-CIRCLE 2027** — the *International Conference on Convergence Science* (21–22 January 2027, India) — backed by a small Node.js/Express API that stores Registrations and Abstracts (and Contact Messages) in a Google Sheet and emails a confirmation copy after each step.

```
Browser (public site)  ──HTTPS──▶  Express API (backend/)  ──▶  Repository layer  ──▶  Google Apps Script Web App  ──▶  Google Sheet
```

The browser **never** talks to Google Sheets directly — every write goes through the Express API, which validates input server-side. The API itself doesn't talk to Google's Sheets REST API either: it calls a small Google Apps Script bound to the spreadsheet (`google-apps-script/Code.gs`), deployed as a Web App. That script has direct access to the sheet and does the actual row write — this avoids needing a Google Cloud project, a service account, or a private key.

There is no login, no admin dashboard, and no user accounts. Managing/reviewing submitted data is done directly in the Google Sheet.

## Registration → Abstract workflow

**Conference registration is mandatory before abstract submission**, and it's enforced by the backend, not just the UI:

```
Visitor
   │
   ▼
Conference Registration (name, email, phone, category, affiliation)
   │
   ▼
Email + phone uniqueness check
   │
   ▼
Registration saved → Registration ID (REG-XXXXXXXX) + confirmation email
   │
   ▼
Abstract Submission (must include the Registration ID)
   │
   ▼
Backend verifies the Registration ID against the Registrations sheet
   │
   ▼
Abstract saved → Abstract ID (ABS-XXXXXXXX) + confirmation email
```

- `POST /api/registrations` rejects a submission if its (normalized, case-insensitive) email **or** its (normalized) phone number already has a registration on file — `409 ALREADY_REGISTERED`.
- `POST /api/abstracts` requires a `registrationId` in the request body. The backend looks that ID up in the `Registrations` sheet — it is never trusted at face value:
  - missing → `400 REGISTRATION_REQUIRED`
  - not found → `404 REGISTRATION_NOT_FOUND`
  - found but `registration_status` isn't `Submitted`/`Confirmed`, or its email doesn't match the abstract's email → `403 REGISTRATION_INVALID`
  - valid → the abstract is saved with that `registration_id` attached, and only then is it also checked against the one-abstract-per-registration rule (`409 ABSTRACT_ALREADY_SUBMITTED` if this registration already has one).
- Because this check happens in `abstractController.create` itself, calling `/api/abstracts` directly (bypassing the UI entirely) with no/a fake registration ID is rejected the same way a browser submission would be — the frontend's "Registration Required" gate is a convenience, not the actual security boundary.
- The frontend keeps the registration_id in `sessionStorage` purely to unlock/prefill the abstract form for the rest of that browser tab's session; it carries no authority on its own.

## Project Structure

```
Conference_Website/
├── index.html                              # Public conference site
├── robots.txt
├── render.yaml                             # Render Blueprint (single web service, same-origin)
├── DEPLOY.md                               # Step-by-step deployment guide
├── archive/
│   └── ICCS-CIRCLE_2027_Conference_Website.html # Earlier self-contained single-file snapshot (unchanged)
├── css/style.css                           # Public site styles
├── js/
│   ├── script.js                           # Public site behavior (countdown, tabs, forms, registration→abstract gating, etc.)
│   ├── theme-init.js                       # Applies the saved theme before first paint (external file, required by CSP)
│   ├── dev-config.js                       # Local-dev-only: points API calls at the backend when served from a different port
│   └── api.js                              # Shared fetch wrapper for the public site's forms
├── backend/
│   ├── server.js                           # Express app entry point
│   ├── package.json
│   ├── .env.example
│   ├── config/config.js                    # Env var loading
│   ├── routes/                             # registrations, abstracts, contact — each a single POST /
│   ├── controllers/                        # request handling per resource
│   ├── middleware/                         # validation (zod), rate limiting
│   ├── services/                           # googleSheets.js (Apps Script HTTP client), emailService.js (SMTP), idService.js
│   ├── repositories/                       # repository.js (interface) + sheetsRepository.js (impl)
│   └── models/                             # per-resource sheet name/headers/enums
├── google-apps-script/
│   └── Code.gs                             # Paste into the spreadsheet's Apps Script editor and deploy as a Web App
└── .gitignore
```

## Public Website Features

Responsive layout, light/dark theme (persisted in `localStorage` under `iccs-theme` only), live countdown, scroll-spy nav, scroll-reveal animations, programme day tabs, speaker filter, FAQ accordion, copy-to-clipboard contact email, back-to-top button, and a registration fee table (informational — fees "to be announced"). The **Registration** form must be completed first; on success it stores the returned Registration ID for the session and reveals the **Abstract Submission** form (otherwise a "Registration Required" notice is shown in its place). Both forms submit to the backend API with loading/disabled button states and inline success/error messages, and both submitters receive an email confirmation. If the API is unreachable, the rest of the site still renders normally — only the forms show a "submission failed" message.

## Backend Architecture

- **Express** app (`backend/server.js`) with `helmet`, `cors` (restricted to `FRONTEND_URL`/`ADMIN_URL`), JSON body parsing, and a centralized error handler returning `{success:false, error:{code,message}}` (no stack traces leaked outside dev, per `NODE_ENV`).
- **Validation**: `zod` schemas in `middleware/validation.js`. Abstract word count is always recomputed server-side, never trusted from the client. `registrationId` is intentionally *not* required at the schema level — its absence is instead reported as the more specific `REGISTRATION_REQUIRED` error from the controller (see workflow section above).
- **IDs**: `services/idService.js` generates prefixed IDs (`REG-XXXXXXXX`, `ABS-XXXXXXXX`, `MSG-...`) from `crypto.randomUUID()` — safe under concurrent submissions, unlike a "last row + 1" scheme against a spreadsheet.
- **Repository abstraction**: `repositories/repository.js` defines `list/get/findOne/create/update/remove`; `repositories/sheetsRepository.js` is the only implementation today. A future `PostgresRepository` could replace it without changing any route/controller.
- **Google Sheets wrapper** (`services/googleSheets.js`): posts `{secret, action, ...}` JSON to the deployed Apps Script Web App URL and expects back `{ok:true, data:...}` / `{ok:false, error:...}`. The Apps Script side (`google-apps-script/Code.gs`) does the actual row lookup/writing directly against the bound spreadsheet, and serializes all writes behind a `LockService` script lock.
- **Atomic uniqueness** (`createUnique`): duplicate checks that must not race — one registration per email/phone, one abstract per email+title — are done by the Apps Script's `createUnique` action, which performs the check *and* the append together inside its lock. A `findOne`-then-`create` sequence in the Node backend could not do this safely: those are two separate HTTP calls, so two simultaneous submissions could both read a clean sheet before either wrote. The Node backend still owns everything else — it generates the IDs, decides the statuses, and verifies registrations; the script only answers "was it unique, and did I append it?". Keeping ID generation out of the script matters: an ID minted inside Apps Script would never reach the browser, so the ID a submitter is shown would silently differ from the one stored in the sheet.
- **Email confirmations** (`services/emailService.js`): sends an HTML+text email via `nodemailer`/SMTP after each successful registration (Registration ID, name, email, institution, category, presentation type, status) and after each successful abstract (Registration ID, Abstract ID, title, authors, affiliation, category, keywords, word count, abstract text, status). Both are sent fire-and-forget — a mail failure is logged server-side but never fails or delays the response, since the row is already saved by that point. If SMTP isn't configured (`config.emailConfigured` is false), sends are skipped with a console warning instead of throwing.
- **Duplicate protection**: registrations (same normalized email **or** same normalized phone) return `409 ALREADY_REGISTERED`; a second abstract under a registration that already has one returns `409 ABSTRACT_ALREADY_SUBMITTED` — both instead of silently duplicating.
- No payment gateway is implemented; `payment_status` is left for manual/offline handling.

## API Endpoints

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/registrations` | Public (rate-limited) — required before abstract submission; triggers a confirmation email |
| POST | `/api/registrations/verify` | Public (rate-limited) — re-unlocks the abstract form for a returning registrant given their `registrationId` + `email`; returns only `{registration_id, email}` |
| POST | `/api/abstracts` | Public (rate-limited) — requires a valid `registrationId`; triggers a confirmation email |
| POST | `/api/contact` | Public (rate-limited) |
| GET | `/api/health` | Public — reports whether Google Sheets and SMTP are configured |

## Google Sheets Schema

One spreadsheet, three tabs (header row exactly as below, case-sensitive):

- **Registrations**: `registration_id, name, email, phone, institution, designation, category, country, presentation_type, payment_status, registration_status, created_at, updated_at`
- **Abstracts**: `abstract_id, submission_id, registration_id, title, authors, corresponding_author, email, affiliation, keywords, presentation_category, abstract_text, word_count, submission_status, reviewer, review_comments, created_at, updated_at`
- **ContactMessages**: `message_id, name, email, subject, message, status, created_at`

If you have an existing `Abstracts` tab from before this workflow change, add a `registration_id` column to its header row (anywhere in the row — the backend and Apps Script are both header-driven, not position-dependent).

Reviewing/managing submissions (changing statuses, assigning reviewers, marking messages read) is done directly by editing the sheet in Google Sheets — there is no admin API for it.

## Setup

### 1. Google Sheet + Apps Script Web App setup (manual — required before the API can persist data)

1. Create a new Google Sheet. Create three tabs named exactly `Registrations`, `Abstracts`, `ContactMessages`, and put the header row from the schema above as row 1 of each.
2. In that spreadsheet: **Extensions → Apps Script**.
3. Delete any starter code and paste in the full contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. Generate a long random secret (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and set it as a **Script Property** — **Project Settings** (gear icon, left sidebar) → **Script Properties** → **Add script property** → key `SHARED_SECRET`, value your generated secret. (Not a hardcoded constant in the file — that would put the secret in something you might commit to a repository.)
5. **Deploy → New deployment → gear icon → "Web app"**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy, and grant the permissions it asks for (it needs to read/write this spreadsheet on your behalf).
6. Copy the Web App URL it gives you (ends in `/exec`).
7. Whenever you edit `Code.gs` later, you must create a new deployment (or a new version under "Manage deployments") for the change to take effect at that same URL. Editing the `SHARED_SECRET` Script Property does **not** require a new deployment — it's read fresh on every request.

No Google Cloud project, service account, or private key is needed with this approach — the script runs as your own account and only responds to requests carrying the correct `SHARED_SECRET`.

### 2. SMTP for confirmation emails (manual — optional, but emails are skipped without it)

Any standard SMTP provider works. The quickest for testing is Gmail:

1. Enable 2-Step Verification on the sending Google account, then create an [App Password](https://myaccount.google.com/apppasswords).
2. Use `smtp.gmail.com`, port `587`, `SMTP_SECURE=false`, your Gmail address as `SMTP_USER`, and the 16-character App Password as `SMTP_PASS`.

Any other provider (SendGrid, Mailgun, Amazon SES, your institution's SMTP, etc.) works the same way — just fill in its host/port/credentials.

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set APPS_SCRIPT_URL (the /exec URL from step 1.6) and APPS_SCRIPT_SECRET
# (must exactly match the SHARED_SECRET Script Property in Code.gs), and SMTP_HOST/SMTP_USER/SMTP_PASS (step 2)
npm run dev
```

Run the (fast, no-network) unit tests any time with `npm test` — covers phone normalization and the zod validation schemas (`backend/test/`).

### 4. Frontend

The backend also serves the public site, so once `npm run dev` is running just open:

```
http://localhost:8080/
```

No separate static server is needed. This is the recommended way to run it locally: the page and the API share one origin, so there is no CORS to configure, no port mismatch, and nothing for privacy-focused browsers to block — **Brave's Shields refuse a page's requests to `localhost` on a different port**, which shows up in the page as an indistinguishable "could not reach the server". Serving both from `:8080` avoids that entirely.

Only `css/`, `js/`, `assets/` and `index.html` are mounted — never the project root, which would expose `backend/.env`.

If you prefer a separate static server anyway (`python -m http.server 5500`, VS Code Live Server, etc.), that still works: `js/dev-config.js` points API calls at `http://<host>:8080/api` for any loopback origin, and the backend accepts any loopback origin for CORS outside production. In that setup, remember Brave will block the cross-port call unless you lower Shields for the site.

## Security

- `helmet` security headers with an explicit Content-Security-Policy (`default-src`/`script-src 'self'`, styles/fonts scoped to Google Fonts, `connect-src 'self'` in production, `object-src`/`frame-ancestors 'none'`, `upgrade-insecure-requests` in production only). No inline `<script>` anywhere — the theme-preference script lives in `js/theme-init.js` specifically so `script-src` needs no `'unsafe-inline'`.
- CORS restricted to `FRONTEND_URL`/`ADMIN_URL` in production; any loopback origin is additionally accepted outside production so local dev works regardless of which static server/port is used.
- `app.set('trust proxy', ...)` in production only, so rate limiting sees the real client IP behind Render/Railway's reverse proxy instead of bucketing every visitor together.
- Rate limiting on all public submission endpoints; malformed/oversized request bodies are rejected as `400 INVALID_JSON` / `413 PAYLOAD_TOO_LARGE` rather than falling through to a generic `500`.
- Abstract submission is gated on a server-verified `registration_id` (see workflow section above) — the frontend's gate is UX only, never the actual authorization boundary. Direct `POST /api/abstracts` calls with no/an invalid registration ID are rejected identically to a browser submission.
- `APPS_SCRIPT_SECRET`/`APPS_SCRIPT_URL` and `SMTP_PASS` only ever live in `backend/.env` (git-ignored) / the platform's environment variables, never sent to the browser and never hardcoded in `Code.gs` (it reads `SHARED_SECRET` from a Script Property — see Setup). Treat that value like a password; anyone who has it (and the deployment URL) can read/write the sheet directly.
- Duplicate-registration and invalid-registration responses never reveal another registrant's email, phone, or any sheet contents — only a generic "already registered" / "could not verify" message. `POST /api/registrations/verify` returns only `{registration_id, email}`, nothing else from the record.
- In production, the app refuses to start (logs a `FATAL` line and exits) if `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` or `FRONTEND_URL` are missing, or if `FRONTEND_URL` is still a `localhost` address — see `config.js`.

## Deployment

See **[`DEPLOY.md`](DEPLOY.md)** for the full step-by-step guide (Render, single same-origin web service via `render.yaml`; Railway works identically).

Two shapes are possible, chosen by where `FRONTEND_URL`/`ADMIN_URL`/CORS point:

- **Combined (recommended, what `render.yaml` deploys)**: `server.js` serves `index.html`/`css`/`js`/`assets` itself, so the API is same-origin — no CORS or CSP `connect-src` configuration needed beyond the defaults in this repo.
- **Split hosting**: static site (Vercel/Netlify/S3/etc.) + `backend/` on any Node host. Set `js/api.js`'s `window.ICCS_API_URL` to the backend's public URL, and add the static site's real origin to `FRONTEND_URL`/`ADMIN_URL`.

## Known Limitations

- **Google Sheets is not a database**: every write is a synchronous Apps Script execution (which has its own quotas — see [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)). Fine at conference scale (hundreds–low thousands of rows), not for a large multi-conference system. The repository abstraction (`repositories/`) exists so Sheets can be swapped for PostgreSQL/Supabase later without touching routes or controllers.
- **Apps Script cold starts**: Web Apps can be slower on the first request after idling. `APPS_SCRIPT_TIMEOUT_MS` (default 15s) bounds how long a request waits before failing cleanly with a clear "please try again" error instead of hanging. Acceptable for a low-traffic conference site; not something to build a high-concurrency system on.
- **No admin UI**: reviewing/updating registrations, abstracts and messages is done by editing the Google Sheet directly.
- **Confirmation emails are fire-and-forget with no retry**: if the SMTP send fails (bad credentials, provider outage), it's logged server-side (`console.error`) and the submitter doesn't get a copy — the registration/submission itself still succeeds and the row is still saved.
- **One abstract per registration**: enforced atomically (`abstractController.create` + the Apps Script `createUnique` action, keyed on `registration_id`). A second submission under the same registration is rejected with `409 ABSTRACT_ALREADY_SUBMITTED`, and the frontend shows a persistent "Abstract Already Submitted" card instead of the form once that's happened (client-side `abstractSubmitted` flag alongside the stored registration — a UX convenience for showing the right state on return visits; the actual limit is enforced server-side regardless of what the client sends).
- **Phone normalization assumes Indian 10-digit mobile numbers** (strips a leading `+91`/`91`/`0`, matching the conference's primary audience) — international numbers with other lengths are normalized only by stripping non-digit characters, so two different-looking international numbers that are the same underlying number in different formats could both be accepted.

## Not implemented by design

No payment gateway integration; no login, accounts, or admin dashboard.
=======
# ICCS-2027
ICCS -2027 PDPIAS conference wesbite
>>>>>>> 09bd97635be436d6c98ef3cc9339dba9c605eab0
