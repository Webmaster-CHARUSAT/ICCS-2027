# ICCS-CIRCLE 2027 — Design System

How the conference website looks, why it looks that way, and how to extend it without breaking
the look. Written for anyone editing the page, adding a section, or handing the site to a new
developer.

**Source of truth:** `css/style.css` (all styling) and `index.html` (markup). If this document and
the code disagree, the code wins — fix this file. Contrast ratios below were measured from the
actual colour values, not estimated.

**Contents:** 1 Direction · 2 Colour · 3 Typography · 4 Spacing & layout · 5 Page map ·
6 Components · 7 Imagery & logos · 8 Motion · 9 Accessibility · 10 Implementation rules ·
11 Known issues

---

## 1. Design direction

**Editorial, classic international-conference style.** Black, white and off-white carry the page,
photography provides the drama, and the brand accents (teal and gold) are used sparingly. The one
deliberately animated, eye-catching element is the **Register Now** button.

Principles:

- **Flat over decorated.** No drop shadows, gradients or glass cards, except the photo overlays,
  the translucent header and the Register button's glow. Depth comes from 1px borders and the
  alternation of white and off-white sections.
- **Rectangular and sharp.** Corner radius is `2px` everywhere — buttons, cards, inputs, chips,
  the Register button. No pills. The only round elements are the initials avatars.
- **Serif for voice, sans-serif for utility.** Headings and the wordmark are set in a serif
  (Source Serif 4); everything you read or operate — body text, menu, labels, buttons, forms — is
  sans-serif (Inter).
- **Uppercase for structure, sentence case for content.** Headings, labels, buttons and nav are
  uppercase with letter-spacing. Body text, descriptions and typed input stay in normal case.
- **Lists before cards.** Ordered content (themes, FAQ) is a bordered editorial list. Cards are
  for independent items (committee roles, contact details, payment options).
- **One accent per moment.** Teal marks interactive and labelling elements on light backgrounds;
  gold appears on dark backgrounds only (header, hero, footer, photo banners).
- **Honest content.** No fake urgency (no invented countdowns, "seats filling fast", fake counts),
  no stock or AI-generated portraits, no made-up names. Unknown details show a clear
  "Coming Soon" instead.

---

## 2. Colour

Every colour is a CSS custom property on `:root`. In components, **use the semantic tokens**
(`--ink-*`, `--surface`, `--panel`, `--border`) and never hard-code a hex value, so dark mode keeps
working.

### Brand and core palette

| Token | Value | Use |
|---|---|---|
| `--color-black` | `#000` | Solid buttons, active date box, back-to-top, footer |
| `--color-near-black` | `#0a0a0a` | Hero fallback behind photography |
| `--color-white` | `#fff` | Light-mode surface |
| `--color-off-white` | `#f5f5f3` | Light-mode panel (alternating sections) |
| `--teal` (= `--accent`) | `#167c80` | Section labels, links, focus ring, solid-button hover |
| `--gold` | `#c6922d` | "CIRCLE" in the wordmark, active nav, hero eyebrow — **dark backgrounds only** |
| `--blue` | `#1e5b8f` | Defined, currently unused |

### Logo-derived brand tokens (Register button only)

Taken from the ICCS-CIRCLE logo; used by `.register-btn` and nothing else yet.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--brand-ink` | `#0A0A0A` | `#F5F5F5` | |
| `--brand-teal` | `#0B787E` | `#13959C` | |
| `--brand-gold` | `#C58A2B` | `#D9A043` | Orbit arc, arrow, focus ring |
| `--brand-bg` | `#FFFFFF` | `#0E1416` | |
| `--cta-fill` | `#0B787E` | `#0B787E` | **Same in both themes**: white text on it is 5.25:1; on the dark-theme teal `#13959C` it would be only 3.62:1 |
| `--cta-fill-hover` | `#086569` | `#086569` | |

> Two near-identical palettes now coexist: the site accents (`--teal #167c80`, `--gold #c6922d`)
> and these logo-derived tokens (`#0B787E`, `#C58A2B`). Pick one set if the site is ever re-skinned.

### Semantic tokens (theme-swappable)

| Token | Light | Dark |
|---|---|---|
| `--body-bg` | `#fff` | `#0a0a0a` |
| `--surface` (cards, inputs, tables) | `#fff` | `#111111` |
| `--panel` (`section.alt`, hovers, chips) | `#f5f5f3` | `#161616` |
| `--ink-900` (headings, strong text) | `#000` | `#ffffff` |
| `--ink-700` (body text) | `#1a1a1a` | `#e7e7e5` |
| `--ink-500` (secondary text) | `#6b6b6b` | `#9c9c9a` |
| `--border` | `#d9d9d9` | `#2a2a2a` |
| `--nav-bg` (scrolled header) | `rgba(10,10,10,.92)` | `rgba(0,0,0,.92)` |
| `--footer-bg` / `--footer-text` | `#000` / `rgba(255,255,255,.72)` | `#000` / `rgba(255,255,255,.65)` |

### Status colours

Each meaning has a text, background and border token, redefined for dark mode.

| Meaning | Tokens | Used for |
|---|---|---|
| Success | `--success-text` `--success-bg` `--success-border` | `.success-box`, Accepted chip |
| Danger | `--danger` `--danger-bg` `--danger-border` | `.error-box`, field errors, Rejected chip |
| Info | `--info-text` `--info-bg` `--info-border` | `.info-box`, `.reg-badge`, Under Review chip |

### Dark mode

- Activated by `data-theme="dark"` on `<html>`. `js/theme-init.js` sets it **before first paint**
  from `localStorage['iccs-theme']`, falling back to the OS setting; the header button toggles it.
- Only the semantic tokens change. Components must never test the theme themselves — the single
  exception is swapping the About-section logo variant (§7).
- The header, footer, hero, photo banners and the mobile sticky bar are dark in **both** themes.

### Contrast (measured)

| Pair | Ratio | Verdict |
|---|---|---|
| Body `#1a1a1a` on white / `#e7e7e5` on `#0a0a0a` | 17.4 / 16.0 | Pass |
| Secondary `#6b6b6b` on white / on `#f5f5f3` | 5.33 / 4.88 | Pass |
| Secondary `#9c9c9a` on `#0a0a0a` / on `#161616` | 7.20 / 6.58 | Pass |
| Teal `#167c80` on white / on `#f5f5f3` | 4.97 / 4.55 | Pass |
| Gold `#c6922d` on black (header, footer) | 7.55 | Pass |
| Footer text on black (light / dark theme) | 10.6 / 8.6 | Pass |
| White on CTA teal `#0B787E` | 5.25 | Pass |
| Status chips (success / danger / info) | 7.1 / 5.6 / 8.3 | Pass |
| **Gold `#c6922d` on white** | **2.78** | **Fail — never use as text on light surfaces** |
| **Teal `#167c80` on `#0a0a0a` / on `#161616` (dark mode)** | **3.99 / 3.64** | **Large text and UI only; small teal text fails** — see §11 |
| **Placeholder `#9a9a9a` on white** | **2.81** | **Fail** — see §11 |

Minimum for text: **4.5:1** (3:1 for text ≥ 24px or bold ≥ 19px, and for UI borders/focus rings).

---

## 3. Typography

| Family | Weights | Token | Used for |
|---|---|---|---|
| **Source Serif 4** (Google Fonts, free) | 500–700 | `--font-heading` | Hero title and subtitle, section and card headings, the wordmark, countdown digits, schedule/theme numbers, avatars |
| **Inter** (Google Fonts) | 400–800 | `--font-body` | Everything else: paragraphs, nav, section labels, buttons, forms, tables, footer |

Fallbacks: serif → Georgia, "Times New Roman"; sans → Arial, Helvetica. Both are requested in one
`<link>` in `index.html` with `display=swap`.

> Source Serif 4 was chosen as the closest freely licensed match to Anthropic's serif, which is
> proprietary and not available for use on this site. To change the heading face, edit
> `--font-heading` and the Google Fonts URL in `index.html` — nothing else.

### Scale

| Role | Size | Weight | Case / tracking | Token / class |
|---|---|---|---|---|
| Hero title (`h1`) | `clamp(2.6rem, 5vw + 1rem, 4.6rem)`; 2.3rem ≤600px | 700 | Upper, .5px | `--fs-hero` |
| Section heading (`h2`) | `clamp(2rem, 3.2vw, 2.75rem)` | 600 | Upper, .5px | `--fs-h2`, `.section-title h2` |
| Card heading (`h3`) | 1.15rem | 600 | Upper, .3px | `--fs-h3`, `.card h3` |
| Body | 1rem | 400 | Sentence | `--fs-body` |
| Long-form body (About) | 1.05rem | 400 | Sentence | `.editorial-split .col-body p` |
| Hero eyebrow | 16px | 500 | Upper, 2px, gold | `--fs-eyebrow` |
| Section label | 12px | 600 | Upper, 2px, teal | `.section-label` |
| Nav link | 13px | 500 | Upper, 1.4px | `--fs-nav` |
| Button | 14px (12px compact) | 600–700 | Upper, 1px | `--fs-btn` |
| Form label | 12px | 600 | Upper, .6px | `label` |
| Micro labels (chips, status, table head) | 11px | 700 | Upper, 1px | `.status-chip`, `th` |

### Line spacing

The larger and more uppercase the text, the tighter the line-height.

| Text | Line-height |
|---|---|
| Hero title (`h1`) | 1.08 |
| Section headings (`h2`) | 1.15–1.18 |
| Card and speaker headings (`h3`), uppercase list titles | 1.3–1.35 |
| Labels, FAQ questions | 1.4–1.45 |
| Hero subtitle | 1.55 |
| Body text (default) | 1.65 |
| Section intros, card text, FAQ answers | 1.7 |
| Long-form prose (About) | 1.75 |

Card headings get `--s-3` space below so they never touch the text under them. Keep body text to
about 60–75 characters per line (`.section-title p` is capped at `60ch`).

> **Gotcha:** the global `h1` rule is white and hero-sized because the only `h1` sits on the hero
> photo. An `h1` added elsewhere must override `color` and `font-size`.

---

## 4. Spacing and layout

### Spacing scale

| Token | `--s-1` | `--s-2` | `--s-3` | `--s-4` | `--s-5` | `--s-6` | `--s-7` | `--s-8` |
|---|---|---|---|---|---|---|---|---|
| Value | 4px | 8px | 12px | 16px | 24px | 32px | 48px | 64px |

Use the scale for every margin, padding and gap. Typical: grid gaps `--s-6`, card padding `--s-6`,
form field gap `--s-5`, section-title bottom margin `--s-7`.

### Page structure

- **Container:** `.container` = `min(1200px, 92%)`, centred (4% gutters on phones).
- **Sections:** `100px` vertical padding (`60px` ≤600px). Use `section.alt` (off-white panel) to
  separate neighbours without rules; `section.dark` gives a black band.
- **Section header pattern** — use it for every new section:

  ```html
  <div class="section-title reveal">            <!-- add .centered to centre it -->
    <span class="section-label">Label</span>    <!-- optional -->
    <h2>Section Heading</h2>
    <p>Optional one-sentence intro.</p>
  </div>
  ```

- **Fixed header:** anchors are offset by `scroll-padding-top`, driven by `--header-h`, which
  `js/script.js` measures at runtime.

### Z-index

| Layer | z-index |
|---|---|
| Skip link | 1000 |
| Header | 50 |
| Mobile sticky Register bar | 45 |
| Back-to-top button | 40 |

### Grids

| Pattern | Rule | Result |
|---|---|---|
| `.cards` | `repeat(auto-fit, minmax(280px, 1fr))` | 3-up desktop → 1-up phone |
| `.speaker-grid` | `repeat(auto-fit, minmax(260px, 1fr))` | 4 / 3 / 2 / 1 columns |
| `.editorial-split` | `1fr 1.15fr` | Heading left, prose right (About) |
| `.venue-split` | `1.1fr 1fr` | Photo left, details right |
| `.partners-layout` | `1.2fr 1fr` | Organizer card + "Coming Soon" |
| `.timeline` | 4 equal columns, 1px gaps | Important dates |
| `.footer-grid` | `1.3fr 1fr 1fr` | Brand / links / contact |

Prefer `auto-fit` + `minmax` over fixed column counts so layouts reflow without breakpoints.

### Breakpoints

| Width | Changes |
|---|---|
| ≥1081px | Full nav shown; the "Registration" text link is hidden (the Register button replaces it) |
| ≤1080px | Nav collapses to ☰; split layouts and two-column forms stack; footer 2 columns |
| ≤768px | Header Register button hides; mobile sticky Register bar activates |
| ≤700px | Table first column sticky; partners and organizer card stack |
| ≤600px | Section padding 60px; hero full height; timeline stacks; footer 1 column; smaller hero logo |

Everything must work at **360px wide with no horizontal page scroll**. Wide tables scroll inside
`.table-wrap`, never the page.

---

## 5. Page map

Section order in `index.html` and the background each uses (`alt` = off-white panel):

| # | Section | `id` | Background | Purpose |
|---|---|---|---|---|
| 1 | Header | `siteHeader` | Transparent → black on scroll | Wordmark, nav, Register button, theme toggle |
| 2 | Hero | — | Photo + overlay | Logo, date/venue, title, countdown, Register + Submit Abstract |
| 3 | About | `about` | White | Vision, mission, objectives, theme-switching logo |
| 4 | Scientific Themes | `themes` | Alt | Five numbered tracks |
| 5 | Distinguished Speakers | `speakers` | White | Filterable photo cards |
| 6 | Conference Programme | `schedule` | Alt | "Coming Soon" card |
| 7 | Registration | `registration` | Alt | Fee table, payment note, registration form |
| 8 | Call for Papers banner | — | Photo | Submission invitation |
| 9 | Call for Abstracts | `abstracts` | White | Gate → form → status panel (+ payment once Accepted) |
| 10 | Important Dates | `dates` | White | Early bird, deadline, notification, conference |
| 11 | Steering Committee | `committee` | Alt | Role cards |
| 12 | Venue | `venue` | White | Building photo, address |
| 13 | Partners & Collaborators | `partners` | Alt | Organizer card + "Coming Soon" |
| 14 | FAQ | `faq` | White | Accordion |
| 15 | Contact | `contact` | Alt | Secretariat details, contact form |
| 16 | Join Us banner | `joinUs` | Photo | Final Register CTA |
| 17 | Footer | — | Black | Brand, links, contact, organizer |

---

## 6. Components

### Header and navigation
- Fixed; **transparent over the hero**, solid (`--nav-bg` + blur) once scrolled past 40px
  (`header.scrolled`).
- **Wordmark:** ICCS-CIRCLE logo mark (44px, dark variant) + `ICCS-`**`CIRCLE`**` 2027` in the
  heading serif, "CIRCLE" in gold. The text sits in `.logo-text` (`nowrap`) so it never wraps.
- **Nav links:** 13px uppercase white, `nowrap`; hover/active draws a 1px gold underline and the
  active section turns gold (scroll-spy in `js/script.js`).
- **Right side:** compact Register button, outlined `.theme-toggle`, and ☰ below 1081px.

### Register Now button (`.register-btn`)
The site's primary call to action — **one component, three sizes**, always a real
`<a href="#registration">`.

```html
<a class="register-btn register-btn--primary" href="#registration">
  <span class="register-btn__ring" aria-hidden="true"></span>
  <span class="register-btn__face">Register Now <span class="register-btn__arrow" aria-hidden="true">→</span></span>
</a>
```

| Variant | Where | Notes |
|---|---|---|
| `--primary` | Hero, Join Us banner | 14px, `14px 30px` padding |
| `--nav` | Header, "Registration Required" gate | Compact: 12px, `9px 18px`; hidden in the header ≤768px |
| `--sticky` | Mobile bottom bar (`#registerSticky`) | Full width; shows after the hero; hides over `#registration` and `#joinUs`; lifts the back-to-top button by 68px while visible |

Look: sharp 2px, teal fill `--cta-fill` with white bold uppercase text, a 2px ring, and a gold →
arrow. Animation (CSS only; transform and opacity only):

| Effect | Timing | Detail |
|---|---|---|
| Shimmer | 3.5s loop | Diagonal light streak crosses the face |
| Orbit | 6s loop | Short gold arc travels the 2px border (echoes the logo's orbit ring) |
| Glow | 2.5s loop | Teal halo breathes, opacity .25 → .5 |
| Hover | 200ms | Lifts 2px, scales 1.03, arrow slides 4px right, glow strengthens |
| Press | 100ms | Scales .97 |
| Entrance | 600ms, once | Fades and rises 12px on first view (`.is-pending` → `.is-in`, classes removed after) |
| Sticky bar | 450ms | Slides up with `cubic-bezier(.34,1.56,.64,1)` |

Rules: loops **pause off-screen** (`.is-offscreen`, set by `js/script.js`); under
`prefers-reduced-motion` all loops and the entrance are removed and only a hover colour change
remains; without JavaScript the button is simply visible; focus ring is 2px `--brand-gold`,
offset 3px. Add new instances with the markup above — never copy the CSS.

### Other buttons
| Class | Look | Use |
|---|---|---|
| `.btn-outline` | White outline, fills white on hover | Secondary CTA **on dark/photo backgrounds only** (hero "Submit Abstract") |
| `.btn-primary` | White fill, inverts on hover | Primary CTA on dark backgrounds (Call for Papers banner) |
| `.btn-solid` | Black fill, teal on hover | Primary action on light backgrounds (form submits, Pay Online) |
| `.btn-outline-dark` | Ink outline, compact | Secondary action on light backgrounds (Refresh status) |
| `.btn-link` | Uppercase text, underline | Low-emphasis navigation ("Contact Details →") |
| `.link-btn` | Small teal underlined text | Inline actions ("Not you? Switch registration") |
| `.copy-btn` | Tiny outlined "COPY" | Copy an email, account number or code |

All: 2px radius, uppercase, 1px press-down on `:active`, `opacity:.55` when disabled. While a
request is in flight the button is disabled and relabelled ("Submitting…").

### Cards
`.card` — surface background, 1px border, 2px radius, `--s-6` padding. On hover the border turns
`--ink-900`; **no shadow, no lift**. Titles are serif uppercase `h3`. Stack several people in one
card with separate `<p>`s (add `margin-top:var(--s-3)`), as in the committee cards.

### Editorial lists
- **Themes** (`.highlight-list`/`.highlight-row`): large grey serif number, uppercase title,
  muted description, divided by 1px rules; rows tint to `--panel` on hover.
- **FAQ** (`.faq-item`): full-width question buttons with a `+` that rotates to `×`; answers expand
  with a `grid-template-rows` transition; one item open at a time.

### Speaker cards
- Portrait in a fixed **4:5** frame (`.speaker-photo`), `object-fit: cover`,
  `object-position: 50% 25%` so faces stay in frame; override inline per photo only when needed.
- The **initials avatar** sits behind every photo; if an image fails, `js/script.js` adds
  `.is-missing` and the avatar shows.
- Meta: optional teal status line ("Chief Guest"), name as `h3`, designation in `.speaker-role`,
  institution in muted text.
- Filter buttons (`.filter-btn`): All / Chief Guest / Distinguished Speakers; active = black fill.

### Forms
- Labels: 12px uppercase above the field. Inputs: full width, `14px 16px` padding, 1px border;
  focus turns the border teal (no glow).
- Two fields per row with `.form-row` (stacks ≤1080px).
- Validation: wrap each control in `.field`; on error add `.field.invalid` (red border + the
  `.error-msg` beneath) and focus the first invalid field.
- Result boxes: `.success-box`, `.error-box`, `.info-box` (hidden until shown by script). Add
  `.is-visible` to an `.info-box` for a permanent notice.
- **Anti-spam:** registration and contact forms include a hidden `.hp-field` honeypot
  (`name="website"`, off-screen, `aria-hidden`, `tabindex="-1"`). Never style it visible or label
  it meaningfully.

### Abstract status and payment panel
After a registrant verifies, the Call for Abstracts card shows their abstract: a `.status-chip`
(Submitted / Under Review / Accepted / Rejected), the title, a one-line note and any reviewer
comments. **Only once Accepted** does `.payment-panel` appear with two cards (Indian participants:
"Pay Online"; others: bank details with copy buttons) and the line "This portal cannot confirm
payment status". Payment details live in the Apps Script, never in the page source.
- Chips (`.status-chip`, 11px uppercase, bordered): `.is-accepted` success, `.is-rejected` danger,
  `.is-review` info, neutral default for Submitted. Labels match the `submission_status` values
  faculty set in the spreadsheet.

### Important dates
`.timeline` of `.datebox` cells separated by 1px gaps on a border-coloured background; the
conference itself is the black `.is-active` cell.

### Photo banners
`.hero` and `.photo-banner` set white text over full-bleed photography with a dark overlay
(gradient on the hero, flat 55% black on banners); labels are gold.

### Footer
Black; three columns (brand + conference logo + organizer, quick links, contact with the four
organizer phone numbers); small muted text that goes white on hover; copyright under a faint rule.

---

## 7. Imagery and logos

### Photography
- **Hero / banners:** `venue-auditorium.jpg` under a dark overlay. Keep the subject of a
  replacement photo away from the left third, where hero text sits.
- **Venue:** `pdpias-building.jpg` in a 4:3 frame.
- **Speakers:** `assets/images/conference-images/<firstname-lastname>.jpg`, verified photos only.
- Every content image needs meaningful `alt` text (the person's or building's name). Decorative
  duplicates (header logo mark) use `alt=""` + `aria-hidden="true"`.
- Give `<img>` explicit `width`/`height` (no layout shift) and `loading="lazy"` below the fold.

### ICCS-CIRCLE (conference) logo
Two variants with transparent backgrounds, exported as PNG (the source SVGs are **not** in the
repository — keep the originals; re-export if the logo changes):

| Variant | Files | Use on |
|---|---|---|
| Light | `assets/images/iccs-circle-logo-light-{96,192,320,640}.png` | Light backgrounds (black lettering) |
| Dark | `assets/images/iccs-circle-logo-dark-{96,192,320,640}.png` | Dark backgrounds (white lettering) |

- Pair 96/192 (`srcset` 1×/2×) up to ~96px, and 320/640 above that. Links carry a `?v=N`
  cache-busting suffix — bump it when a file changes.
- Placements: header 44px (dark), hero 140px / 96px phones (dark), About 220px (switches with
  theme), footer 56px (dark), favicon (light 96px).
- **Theme-switching logo:** place both images with `.logo-for-light` and `.logo-for-dark`; CSS shows
  the one matching `data-theme`. Give the dark copy `alt=""` + `aria-hidden="true"` so screen
  readers announce the logo once.

### PDPIAS (organizer) logo
`assets/images/pdpias-logo-160.png` and `-320.png`. Sizes: 56px footer, 64px venue, 120px
organizer card. It is a dark rounded tile with transparent corners, so it works on light and dark —
don't add a border or background behind it.

---

## 8. Motion

| Token | Value | Use |
|---|---|---|
| `--t-fast` | `.2s ease-out` | Hovers, borders, colour changes |
| `--t-base` | `.4s ease-out` | Header background, theme switch, FAQ expand |

- **Scroll reveal:** add `.reveal` to fade + rise (18px) elements into view (IntersectionObserver
  in `js/script.js`). Use it on section headers, cards and rows — not on everything.
- Animate **only `transform` and `opacity`**; no `will-change` except on hover; pause loops
  off-screen.
- `prefers-reduced-motion: reduce` disables transitions, smooth scrolling, reveals and every
  looping animation.
- Motion is functional or brand-led only: no parallax, bounce or auto-playing carousels. The
  Register button is the single place with looping decoration.

---

## 9. Accessibility rules

- Keep the skip link (`.skip-link`) and a visible focus ring: `:focus-visible` is a 2px teal
  outline site-wide, and gold on the Register button.
- Interactive things are `<button>`s or `<a>`s — never clickable `<div>`s.
- Tabs/filters/accordions expose their state (`aria-pressed`, `aria-expanded`, `aria-selected`).
- Error and status messages use `role="alert"` / `role="status"`.
- Insert user- or server-supplied text with `textContent` / `createElement`, never `innerHTML`.
- Don't use colour alone to convey meaning — chips always carry a text label.
- Text contrast ≥ 4.5:1 (see §2); never use gold text on a light surface.
- Everything must remain readable and usable with JavaScript off, in both themes, with reduced
  motion on, and at 360px.

---

## 10. Implementation rules

- **Static site, no server.** Pages are plain files on Vercel; forms post to the Google Apps Script
  URL in `js/config.js` (see `DEPLOY.md`). Never put secrets in front-end files.
- **No inline scripts.** Keep behaviour in `js/*.js` so the page stays compatible with a strict
  `script-src 'self'` policy. Files: `theme-init.js` (pre-paint theme), `config.js`, `api.js`,
  `script.js`.
- **Cache-busting:** CSS, JS and logo files are linked with `?v=N`. Bump `N` in `index.html` whenever
  you change that file.
- **Styles:** add new rules as tokens + classes in a commented block near related components.
  Avoid new inline `style=""` attributes.
- **New section checklist:** section-title pattern · alternate `.alt` background · `.reveal` on
  header and items · reads well at 360px · readable in dark mode · nav/footer link if it's a
  destination · update §5 here.
- **Where things live:** content and markup → `index.html`; all styling → `css/style.css`;
  forms and emails → `google-apps-script/Code.gs`; deployment steps → `DEPLOY.md`.

---

## 11. Known issues

Found while writing this document; none are fixed by it.

| # | Issue | Impact | Suggested fix |
|---|---|---|---|
| 1 | **"Continue" button in the "Already Registered?" form is invisible in light mode.** It uses `.btn-outline` (white text, transparent) on a white card. | Returning registrants can't see the button to continue (dark mode is fine) | Use `.btn-outline-dark` there |
| 2 | **Teal text in dark mode is 3.99:1 on `#0a0a0a`** (3.64:1 on `#161616`) — section labels (12px) and links fall under 4.5:1 | Hard to read for some users | Use a lighter teal such as `#13959C` for text in dark mode |
| 3 | **Form placeholder text is 2.81:1** (`#9a9a9a` on white) | Fails contrast | Darken to ≈ `#767676` |
| 4 | **Register button's gold → arrow is 1.76:1 on teal.** It is decorative (`aria-hidden`) beside the label, but faint | Low visibility of the arrow | Use a lighter gold or white arrow |
| 5 | **`.reveal` content is invisible with JavaScript off** (`opacity:0` by default) | No-JS visitors see blank sections | Apply the hidden state only under an `html.js` class |
| 6 | **Register button sits flush under the paragraph in the "Registration Required" box** | Tight spacing | Add `margin-top` in that card |
| 7 | **Dead CSS:** `.callout`, `.theme-grid`, `.partners-grid`, `.speaker-topic`, `.schedule-*`, `.sep` and `.tabs` / `.tab-*` are unused; the programme-tab script has no tabs to drive | Extra weight, confusion | Delete — restore the schedule styles from Git history when the programme is published |
| 8 | **23 inline `style=""` attributes** remain in `index.html` | Hard to restyle; blocks a strict `style-src` | Move into classes |
| 9 | **Two near-duplicate palettes** (§2) and an unused `--blue` | Drift | Consolidate |
