# ICCS-CIRCLE 2027 — Design System

How the conference website looks and why, written for anyone changing the page or adding a
section. Everything here is taken from the code: `css/style.css` (public site) and
`admin/admin.css` (faculty review dashboard). When this document and the CSS disagree, the CSS
wins — update this file.

---

## 1. Design direction

**Editorial, classic international-conference style.** Black, white and off-white carry the page.
Photography provides the drama, and the brand accents (teal and gold) are used sparingly.

Principles:

- **Flat over decorated.** No drop shadows, gradients (except the photo overlays) or glassy cards.
  Depth comes from 1px borders and the white / off-white alternation of sections.
- **Rectangular and sharp.** Corner radius is `2px` everywhere. No pill buttons, no rounded cards.
  The only round elements are the initials avatars.
- **Uppercase for structure, sentence case for content.** Headings, labels, buttons and nav are
  uppercase with letter-spacing. Body text, descriptions and form input stay in normal case.
- **Lists before cards.** Ordered content (themes, schedule, FAQ) is a bordered editorial list,
  not a grid of boxes. Cards are kept for independent items (committee roles, contact, payment).
- **One accent per moment.** Teal marks interactive and labelling elements on light backgrounds;
  gold only appears on dark backgrounds (hero, header, footer, photo banners).

---

## 2. Colour

All colours are CSS custom properties on `:root`. **Use the semantic tokens** (`--ink-*`,
`--surface`, `--panel`, `--border`) in components — never hard-code a hex value — so dark mode
keeps working.

### Brand and core palette

| Token | Value | Use |
|---|---|---|
| `--color-black` | `#000` | Solid buttons, active date box, back-to-top, footer |
| `--color-near-black` | `#0a0a0a` | Hero fallback behind photography |
| `--color-white` | `#fff` | Light-mode surface |
| `--color-off-white` | `#f5f5f3` | Light-mode panel (alternating sections) |
| `--teal` (= `--accent`) | `#167c80` | Section labels, focus ring, links, solid-button hover |
| `--gold` | `#c6922d` | "CIRCLE" in the wordmark, active nav, hero eyebrow — **dark backgrounds only** |
| `--blue` | `#1e5b8f` | Defined but currently unused |

Gold on white is below WCAG contrast for text, so don't use it on light surfaces. Teal on white
passes for text and UI.

### Semantic tokens (theme-swappable)

| Token | Light | Dark |
|---|---|---|
| `--body-bg` | `#fff` | `#0a0a0a` |
| `--surface` (cards, inputs, tables) | `#fff` | `#111111` |
| `--panel` (`section.alt`, hovers, chips) | `#f5f5f3` | `#161616` |
| `--ink-900` (headings, strong text) | `#000` | `#ffffff` |
| `--ink-700` (body text) | `#1a1a1a` | `#e7e7e5` |
| `--ink-500` (secondary text, descriptions) | `#6b6b6b` | `#9c9c9a` |
| `--border` | `#d9d9d9` | `#2a2a2a` |
| `--nav-bg` (scrolled header) | `rgba(10,10,10,.92)` | `rgba(0,0,0,.92)` |
| `--footer-bg` / `--footer-text` | `#000` / `rgba(255,255,255,.72)` | `#000` / `rgba(255,255,255,.65)` |

### Status colours

Used by message boxes and status chips. Each has a text, background and border token, redefined
for dark mode.

| Meaning | Tokens | Used for |
|---|---|---|
| Success | `--success-text` `--success-bg` `--success-border` | `.success-box`, Accepted chip |
| Danger | `--danger` `--danger-bg` `--danger-border` | `.error-box`, field errors, Rejected chip |
| Info | `--info-text` `--info-bg` `--info-border` | `.info-box`, `.reg-badge`, Under Review chip |

### Dark mode

- Activated by `data-theme="dark"` on `<html>`. `js/theme-init.js` sets it **before first paint**
  from `localStorage['iccs-theme']`, falling back to the OS preference; the header button toggles
  it. The dashboard shares the same key, so the choice carries across.
- Only the semantic tokens change. Components must never check the theme themselves.
- The header, footer, hero and photo banners are dark in **both** themes by design.

---

## 3. Typography

**Typeface:** Inter (Google Fonts, weights 400–800), falling back to Arial/Helvetica. Headings and
body use the same family — hierarchy comes from size, weight, case and spacing.

| Role | Size | Weight | Case / tracking | Token / class |
|---|---|---|---|---|
| Hero title (`h1`) | `clamp(2.6rem, 5vw + 1rem, 4.6rem)`; 2.3rem ≤600px | 700 | Upper, .5px | `--fs-hero` |
| Section heading (`h2`) | `clamp(2rem, 3.2vw, 2.75rem)` | 600 | Upper, .5px | `--fs-h2`, `.section-title h2` |
| Card heading (`h3`) | 1.15rem | 600 | Upper, .3px | `--fs-h3`, `.card h3` |
| Body | 1rem, line-height 1.65 | 400 | Sentence | `--fs-body` |
| Long-form body (About) | 1.05rem, line-height 1.75 | 400 | Sentence | `.editorial-split .col-body p` |
| Hero eyebrow | 16px | 500 | Upper, 2px, gold | `--fs-eyebrow`, `.hero-eyebrow` |
| Section label | 12px | 600 | Upper, 2px, teal | `.section-label` |
| Nav link | 13px | 500 | Upper, 1.4px | `--fs-nav` |
| Button | 14px | 600 | Upper, 1px | `--fs-btn` |
| Form label | 12px | 600 | Upper, .6px | `label` |
| Micro labels (chips, status, table head) | 11px | 700 | Upper, 1px | `.status-chip`, `th` |

**Line spacing:** the larger and more uppercase the text, the tighter the line-height.

| Text | Line-height |
|---|---|
| Hero title (`h1`) | 1.08 |
| Section headings (`h2`) | 1.15–1.18 |
| Card and speaker headings (`h3`), uppercase list titles | 1.3–1.35 |
| Labels, FAQ questions, schedule sessions | 1.4–1.45 |
| Hero subtitle | 1.55 |
| Body text (default) | 1.65 |
| Section intros, card text, FAQ answers | 1.7 |
| Long-form prose (About) | 1.75 |

Card titles have `--s-3` space below them so they never touch the text underneath. Keep body
text to roughly 60–75 characters per line (`.section-title p` is capped at `60ch`).

> **Gotcha:** the global `h1` rule is white and hero-sized because the only public `h1` sits on the
> hero photo. Any `h1` elsewhere (e.g. the dashboard) must override `color` and `font-size`.

---

## 4. Spacing and layout

### Spacing scale

| Token | `--s-1` | `--s-2` | `--s-3` | `--s-4` | `--s-5` | `--s-6` | `--s-7` | `--s-8` |
|---|---|---|---|---|---|---|---|---|
| Value | 4px | 8px | 12px | 16px | 24px | 32px | 48px | 64px |

Use the scale for every margin, padding and gap. Typical choices: grid gaps `--s-6`, card padding
`--s-6`, form field gap `--s-5`, section-title bottom margin `--s-7`.

### Page structure

- **Container:** `.container` = `min(1200px, 92%)`, centred. The 92% gives a 4% gutter on phones.
- **Sections:** every `<section>` gets `100px` vertical padding (`60px` at ≤600px). Alternate
  `section` and `section.alt` (off-white panel) so neighbouring sections are visually separated
  without rules. `section.dark` gives a black band.
- **Section header pattern** — use it for every new section:

  ```html
  <div class="section-title reveal">            <!-- add .centered to centre it -->
    <span class="section-label">Label</span>
    <h2>Section Heading</h2>
    <p>Optional one-sentence intro.</p>
  </div>
  ```

- **Fixed header:** content anchors are offset by `scroll-padding-top`, driven by `--header-h`,
  which `js/script.js` measures at runtime.

### Grids

| Pattern | Rule | Result |
|---|---|---|
| `.cards` | `repeat(auto-fit, minmax(280px, 1fr))` | 3-up desktop → 1-up phone |
| `.speaker-grid` | `repeat(auto-fit, minmax(260px, 1fr))` | 4 / 3 / 2 / 1 columns |
| `.editorial-split` | `1fr 1.15fr` | Heading left, prose right (About) |
| `.venue-split` | `1.1fr 1fr` | Photo left, details right |
| `.partners-layout` | `1.2fr 1fr` | Organizer card + "coming soon" |
| `.timeline` | 4 equal columns, 1px gaps | Important dates strip |
| `.footer-grid` | `1.3fr 1fr 1fr` | Brand / links / contact |

Prefer `auto-fit` + `minmax` over fixed column counts so layouts reflow without breakpoints.

### Breakpoints

| Width | Changes |
|---|---|
| ≤1080px | Nav collapses to the ☰ menu; split layouts and two-column forms stack; footer 2 columns |
| ≤760px | (Dashboard) filters stack; table hides Authors/Category/Submitted; detail grid stacks |
| ≤700px | Table first column becomes sticky; partners and organizer card stack |
| ≤600px | Section padding 60px; hero full height; timeline and schedule stack; footer 1 column |

Everything must work at **360px wide with no horizontal page scroll**. Wide tables scroll inside
`.table-wrap`, never the page.

---

## 5. Components

### Header and navigation
- Fixed, **transparent over the hero**, turning solid (`--nav-bg` + blur) once scrolled past
  40px (`header.scrolled`).
- Wordmark: ICCS-CIRCLE logo mark (44px, dark variant) + `ICCS-` **`CIRCLE`** `2027`, with "CIRCLE" in gold.
  The text sits in `.logo-text` so it never wraps.
- Nav links: 13px uppercase white; hover/active draws a 1px gold underline from the left, and
  the active section's link turns gold (scroll-spy in `js/script.js`).
- Controls: outlined `.theme-toggle` (also used for "Log out" in the dashboard) and the ☰ menu.

### Buttons
| Class | Look | Use |
|---|---|---|
| `.btn-primary` | White fill, inverts to outline on hover | Main CTA on dark/photo backgrounds |
| `.btn-outline` | White outline, fills white on hover | Secondary CTA on dark backgrounds |
| `.btn-solid` | Black fill, teal on hover | Primary action on light backgrounds (forms, Pay Online) |
| `.btn-outline-dark` | Ink outline, compact padding | Secondary action on light backgrounds (Refresh) |
| `.btn-link` | Uppercase text with underline | Low-emphasis navigation ("Contact Details →") |
| `.link-btn` | Small teal underlined text button | Inline actions ("Not you? Switch registration") |
| `.copy-btn` | Tiny outlined "COPY" | Copy an email, account number or code |

All buttons: 2px radius, uppercase, 1px press-down on `:active`, `opacity:.55` when disabled.
While a request is in flight the button is disabled and relabelled ("Submitting…").

### Cards
`.card` — surface background, 1px border, 2px radius, `--s-6` padding. On hover the border turns
`--ink-900`; there is **no shadow and no lift**. Card titles are uppercase `h3`. Stack several
people inside one card with separate `<p>`s (add `margin-top:var(--s-3)` between them), as in the
committee cards.

### Editorial lists
- **Themes** (`.highlight-list` / `.highlight-row`): large grey number, uppercase title,
  muted description, divided by 1px rules; rows tint to `--panel` on hover.
- **FAQ** (`.faq-item`): full-width question buttons with a `+` that rotates to `×`; answers
  expand with a `grid-template-rows` transition. One item open at a time.
- **Schedule** (`.schedule-row`): time column + session/detail column. Currently replaced by a
  "Coming Soon" card until the programme is final.

### Speaker cards
- Portrait in a fixed **4:5** frame (`.speaker-photo`), `object-fit: cover`,
  `object-position: 50% 25%` so faces stay in frame. Tune per photo with an inline
  `object-position` only when needed.
- The **initials avatar** sits behind every photo; if the image fails to load, `js/script.js`
  adds `.is-missing` and the avatar shows. Never use a stock or AI-generated portrait.
- Meta: optional teal status line (e.g. "Chief Guest"), name as `h3`, designation in
  `.speaker-role`, institution in muted text.
- Filter buttons (`.filter-btn`) above the grid; active = black fill.

### Forms
- Labels: 12px uppercase above the field. Inputs: full width, `14px 16px` padding, 1px border,
  focus turns the border teal (no glow).
- Two fields side by side with `.form-row` (stacks ≤1080px).
- Validation: wrap each control in `.field`; on error add `.field.invalid`, which reddens the
  border and shows the `.error-msg` beneath. Focus the first invalid field.
- Results: `.success-box`, `.error-box`, `.info-box` (hidden until shown by script). Add
  `.is-visible` to an `.info-box` to make it a permanent static notice.

### Status chips
`.status-chip` — 11px uppercase label in a bordered box. Variants: `.is-accepted` (success),
`.is-rejected` (danger), `.is-review` (info); the neutral default covers "Submitted". Used in the
participant status panel and the dashboard table, so the vocabulary matches in both.

### Important dates
`.timeline` of `.datebox` cells separated by 1px gaps on a border-coloured background; the
conference itself is the black `.is-active` cell.

### Photo banners
`.hero` and `.photo-banner` place text over full-bleed photography with a dark overlay
(gradient on the hero, flat 55% black on banners). Text is white; labels are gold.

### Footer
Black, three columns (brand + organizer logo / quick links / contact), small muted text, white on
hover, copyright row under a faint rule.

### Logos

**ICCS-CIRCLE (conference) logo** — two variants, transparent background:

| Variant | Files | Use on |
|---|---|---|
| Light | `assets/images/iccs-circle-logo-light-{96,192,320,640}.png` | Light backgrounds (black text, dark quadrants) |
| Dark | `assets/images/iccs-circle-logo-dark-{96,192,320,640}.png` | Dark backgrounds (white text, light quadrants) |

- Use 96/192 together (`srcset` 1×/2×) for anything up to 96px, and 320/640 above that.
- Placements: header 44px (dark — the header is dark in both themes), hero 140px / 96px on
  phones (dark), About section 220px (theme-switching), footer 56px (dark), dashboard bar 36px
  (dark), favicon (light 96px).
- **Theme-switching logo:** put both images side by side with `.logo-for-light` and
  `.logo-for-dark`; CSS shows the one matching `data-theme`. Give the dark copy `alt=""` and
  `aria-hidden="true"` so screen readers announce the logo once.
- Source vectors are `iccs-circle-logo-light.svg` / `-dark.svg` (≈150 KB each, kept out of the
  page for weight). Re-export the PNGs from them if the logo changes.

**PDPIAS (organizer) logo** — `assets/images/pdpias-logo-160.png` and `-320.png`. Sizes in use:
56px footer, 64px venue, 120px organizer card. It is a dark rounded tile with transparent
corners, so it works on light and dark backgrounds — don't add a border or background behind it.

---

## 6. Imagery

- **Hero / banners:** venue photography (`venue-auditorium.jpg`) under a dark overlay. Keep
  important content of a new photo away from the left third, where the hero text sits.
- **Venue:** `pdpias-building.jpg` in a 4:3 frame.
- **Speakers:** verified photos only, in `assets/images/conference-images/<firstname-lastname>.jpg`.
- Every content image needs meaningful `alt` text (the person's name, the building's name).
  Decorative duplicates (the header logo mark) use `alt=""` + `aria-hidden="true"`.
- Give `<img>` explicit `width`/`height` to avoid layout shift, and `loading="lazy"` below the
  fold.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `--t-fast` | `.2s ease-out` | Hovers, borders, colour changes |
| `--t-base` | `.4s ease-out` | Header background, theme switch, FAQ expand |

- **Scroll reveal:** add `.reveal` to fade + rise (18px) elements into view (IntersectionObserver
  in `js/script.js`). Use it on section headers, cards and rows — not on every element.
- `prefers-reduced-motion: reduce` disables all transitions, smooth scrolling and reveals.
- Motion is functional only: no parallax, bouncing or auto-playing carousels.

> **Known issue:** `.reveal` starts at `opacity:0`, so content revealed only by JavaScript is
> invisible if JavaScript is disabled. Elements shown later by script (e.g. the abstract status
> card) must also get `.visible` when shown.

---

## 8. Accessibility rules

- Keep the skip link (`.skip-link`) and the visible focus ring (`:focus-visible` → 2px teal).
- Interactive things are `<button>`s or `<a>`s — never clickable `<div>`s. Table rows in the
  dashboard are the exception and are keyboard-focusable with Enter/Space.
- Tabs follow the ARIA tabs pattern (arrow keys); filters and toggles expose `aria-pressed`;
  accordions expose `aria-expanded`.
- Error and status messages use `role="alert"` / `role="status"`.
- Insert user- or server-supplied text with `textContent` / `createElement`, never `innerHTML`.
- Don't use colour alone to convey meaning — chips always carry a text label.

---

## 9. Faculty dashboard (`/admin`)

The dashboard reuses `css/style.css` (tokens, buttons, fields, cards, tables, chips) and adds
`admin/admin.css`:

- Black top bar with the wordmark, signed-in user, theme toggle and log-out button.
- Login card: "Sign in with Google" (Google's own button, `outline` / `filled_black` theme to
  match) above an "or sign in with password" divider.
- Stat tiles (clickable filters), a search + status + category filter row, a bordered table
  with status chips, and a native `<dialog>` for abstract detail and the Accept / Reject decision.
- Accept / Reject use fixed green (`#155c3d`) and red (`#b3261e`) fills with white text in both
  themes, so they stay legible in dark mode.
- Overrides needed because of global rules: `.admin-main section { padding: 0 }` and the `h1`
  colour/size (see the typography gotcha).

---

## 10. Implementation rules

- **No inline scripts.** The Content-Security-Policy is `script-src 'self'` (plus Google's sign-in
  script on `/admin` only). All behaviour lives in `js/*.js` or `admin/admin.js`.
- **Cache-busting:** stylesheets and scripts are linked with `?v=N`. Bump `N` in `index.html`
  (or `admin/index.html`) whenever you change that file.
- **Add new styles as tokens + classes**, appended in a commented block near related components.
  Avoid new inline `style=""` attributes; a few legacy ones remain and should migrate to classes.
- **New section checklist:** section-title pattern · alternate `.alt` background · `.reveal` on
  header and items · works at 360px · readable in dark mode · nav/footer link if it's a
  destination.
