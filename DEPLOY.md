# Deploying ICCS-CIRCLE 2027

Single web service, same-origin (the backend serves the public site itself — see `server.js`).
Primary target: [Render](https://render.com). Railway works identically; see the note at the end.

## a. Rotate secrets first

Do this **before** pushing anything to GitHub, regardless of whether you believe the current
values have leaked — they were pasted in plaintext during earlier local debugging, which is
reason enough to treat them as no longer private.

1. **Gmail App Password**: go to <https://myaccount.google.com/apppasswords>, revoke the old one,
   generate a new one. You'll use it as `SMTP_PASS` in step d.
2. **Apps Script shared secret**: generate a new random value —
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Keep this value handy for step b and step d — it must be identical in both places.

## b. Update Apps Script

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Confirm `Code.gs` matches the version in this repo (it reads the secret from a Script
   Property now, not a hardcoded constant — if you're updating an older deployment, paste the
   current `google-apps-script/Code.gs` over it).
3. **Project Settings** (gear icon, left sidebar) → **Script Properties** → **Add script
   property**: key `SHARED_SECRET`, value = the new secret from step a.2. (If a `SHARED_SECRET`
   script property already exists, edit it instead.)
4. **Deploy → Manage deployments** → pencil icon on the existing deployment → **New version** →
   **Deploy**. Confirm the settings show **Execute as: Me**, **Who has access: Anyone**.
5. Copy the Web App URL (ends in `/exec`) if you don't already have it — you'll need it in step d.

## c. Push to GitHub

1. If this isn't already a git repository: `git init`.
2. **Before your first commit**, verify `.env` will not be tracked:
   ```bash
   git ls-files | grep -i '\.env$'
   ```
   This must print nothing. If it prints `backend/.env`, stop — do not commit — and instead run
   `git rm --cached backend/.env` first (the `.gitignore` in this repo already excludes it going
   forward, but that only prevents *new* commits from including it).
3. Commit and push to a GitHub repository.

## d. Deploy on Render

1. Render dashboard → **New → Blueprint** → select this repository. Render reads `render.yaml`
   at the repo root and creates the web service.
2. Fill in the env vars marked `sync: false` in `render.yaml`:
   - `APPS_SCRIPT_URL` — the `/exec` URL from step b.5
   - `APPS_SCRIPT_SECRET` — the secret from step a.2 (must exactly match the Script Property)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — from step a.1
   - `FRONTEND_URL`, `ADMIN_URL` — see step e; a placeholder value is fine for the very first
     deploy, since you don't know the final URL until after it exists
3. Deploy.

## e. Point FRONTEND_URL/ADMIN_URL at the real URL

After the first deploy succeeds, Render shows you the service's URL
(`https://<service-name>.onrender.com`, or your custom domain once added — see step f).

1. Render dashboard → the service → **Environment** → set `FRONTEND_URL` and `ADMIN_URL` to that
   URL (exactly, including `https://`, no trailing slash).
2. Save → this triggers a redeploy automatically. Without this step, the app will actually
   **refuse to boot** — `config.js`'s production validation exits with a `FATAL` log line if
   `FRONTEND_URL` is missing or still a `localhost` address, specifically to catch this exact
   omission before it becomes a confusing runtime CORS error instead.

## f. Custom domain (optional)

1. Render dashboard → the service → **Settings → Custom Domains** → add your domain.
2. At your DNS provider, add the CNAME record Render shows you.
3. Render provisions HTTPS automatically once the CNAME resolves (can take a few minutes to a
   few hours depending on DNS propagation).
4. Repeat step e with the custom domain instead of the `.onrender.com` URL.
5. Also update `index.html`'s `<link rel="canonical">` and `og:url` (currently a `YOUR_DOMAIN`
   placeholder with a `TODO` comment next to it) to the real domain.

## g. Smoke test

Replace `$URL` with your deployed URL (no trailing slash) in the commands below.

```bash
# Health — both should be true. If either is false, the corresponding env var is missing/wrong.
curl -s $URL/api/health

# Register (use a real-looking but unique email/phone each time you retest this)
curl -s -X POST $URL/api/registrations -H "Content-Type: application/json" -d '{
  "name":"Smoke Test","email":"smoke.test+1@example.com","phone":"9876543210",
  "category":"Student","affiliation":"Test University"}'
# -> 201, {"success":true,"data":{"registration_id":"REG-...", ...}}

# Duplicate registration (same email as above) — expect 409 ALREADY_REGISTERED
curl -s -i -X POST $URL/api/registrations -H "Content-Type: application/json" -d '{
  "name":"Smoke Test","email":"smoke.test+1@example.com","phone":"9876543211",
  "category":"Student","affiliation":"Test University"}'

# Verify (use the registration_id returned above)
curl -s -X POST $URL/api/registrations/verify -H "Content-Type: application/json" -d '{
  "registrationId":"REG-XXXXXXXX","email":"smoke.test+1@example.com"}'
# -> 200, {"success":true,"data":{"registration_id":"REG-XXXXXXXX","email":"smoke.test+1@example.com"}}

# Abstract submission (registrationId + email must match a real registration from above)
curl -s -X POST $URL/api/abstracts -H "Content-Type: application/json" -d '{
  "registrationId":"REG-XXXXXXXX","title":"Smoke Test Submission Title","authors":"Smoke Test",
  "email":"smoke.test+1@example.com","category":"Oral Presentation",
  "abstractText":"'"$(python3 -c "print('word '*60)" 2>/dev/null || printf 'word %.0s' {1..60})"'"}'
# -> 201, {"success":true,"data":{"abstract_id":"ABS-...","registration_id":"REG-...", ...}}

# Contact message
curl -s -X POST $URL/api/contact -H "Content-Type: application/json" -d '{
  "name":"Smoke Test","email":"smoke.test+1@example.com","subject":"Test","message":"Smoke test message."}'
# -> 201

# Malformed JSON — expect 400 INVALID_JSON (not a 500)
curl -s -i -X POST $URL/api/abstracts -H "Content-Type: application/json" -d '{not valid json'
```

Also open `$URL` in a browser and confirm: the page loads, dark/light theme toggle works, the
Registration form and (after registering) the Abstract form both submit successfully, and no
Content-Security-Policy errors appear in the DevTools console.

Afterward, delete the smoke-test rows from the `Registrations`, `Abstracts` and `ContactMessages`
tabs in the spreadsheet.

## h. About Render's free tier

The free plan **sleeps after ~15 minutes of no traffic** and takes roughly 30–50 seconds to wake
on the next request — the first visitor after a quiet period will see a long hang (and it also
means `APPS_SCRIPT_TIMEOUT_MS`'s 15s default could itself time out before the *app* has even
finished waking up, compounding the delay). This is a poor experience right around the
registration/abstract deadline, when traffic is bursty. Two options:

- Upgrade the service to the **Starter** plan (Render dashboard → service → Settings), which
  doesn't sleep. Do this in the dashboard directly rather than in `render.yaml`, so the blueprint
  doesn't silently commit you to a paid plan for anyone else who deploys from this repo.
- Or keep the free plan and run an uptime pinger (e.g. a free UptimeRobot check hitting
  `$URL/api/health` every 5–10 minutes) during the registration/submission window, to keep the
  service warm.

## i. Alternative: Railway

Railway works the same way — same `startCommand` (`npm start`), same environment variables as
listed in step d.2 plus `NODE_ENV=production` and `TRUST_PROXY=1`. Railway doesn't read
`render.yaml`; create the service from the GitHub repo in the Railway dashboard, set the root
directory to `backend`, and fill in the same env vars manually. Repeat step e using the URL
Railway assigns.
