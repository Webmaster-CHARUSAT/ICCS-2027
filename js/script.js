document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Header height (drives html{scroll-padding-top} so anchors don't land under the fixed header) ---------- */
  var headerEl = document.getElementById('siteHeader');
  function updateHeaderHeight() {
    var h = headerEl ? headerEl.offsetHeight : 0;
    if (h > 0) document.documentElement.style.setProperty('--header-h', h + 'px');
  }
  updateHeaderHeight();
  window.addEventListener('resize', updateHeaderHeight);
  window.addEventListener('load', updateHeaderHeight);

  /* ---------- Header: transparent over the hero, solid once scrolled past it ---------- */
  if (headerEl) {
    function updateHeaderScrolled() {
      headerEl.classList.toggle('scrolled', window.scrollY > 40);
    }
    updateHeaderScrolled();
    window.addEventListener('scroll', updateHeaderScrolled);
  }

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.getElementById('menuToggle');
  var navEl = document.getElementById('primaryNav');
  if (menuBtn && navEl) {
    menuBtn.addEventListener('click', function () {
      var isOpen = navEl.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    navEl.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navEl.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Theme toggle (light/dark) — initial theme is already applied by the inline
     head script to avoid FOUC; this just syncs the button label and wires the click handler. */
  var themeBtn = document.getElementById('themeToggle');
  var root = document.documentElement;
  if (themeBtn) {
    function syncThemeLabel() {
      themeBtn.textContent = root.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark';
    }
    syncThemeLabel();
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (next === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      syncThemeLabel();
      try { localStorage.setItem('iccs-theme', next); } catch (e) {}
    });
  }

  /* ---------- Active nav link on scroll (IntersectionObserver, header-aware) ---------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
  var navLinks = navEl ? Array.prototype.slice.call(navEl.querySelectorAll('a')) : [];
  if ('IntersectionObserver' in window && sections.length && navLinks.length) {
    var spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        navLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
      });
    }, {
      rootMargin: '-' + (parseInt(getComputedStyle(root).getPropertyValue('--header-h')) || 96) + 'px 0px -70% 0px',
      threshold: 0
    });
    sections.forEach(function (sec) { spyObserver.observe(sec); });
  }

  /* ---------- Back to top ---------- */
  var backBtn = document.getElementById('backToTop');
  if (backBtn) {
    window.addEventListener('scroll', function () {
      backBtn.classList.toggle('show', window.scrollY > 500);
    });
    backBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- Countdown timer ---------- */
  var countdownEl = document.getElementById('countdown');
  if (countdownEl) {
    // Explicit +05:30 (IST) offset so the countdown agrees for every visitor regardless of
    // their local timezone — parsing a bare local-time string would drift per-country.
    var conferenceDate = new Date('2027-01-21T09:00:00+05:30');
    var countdownTimer = null;
    function updateCountdown() {
      var diff = conferenceDate.getTime() - Date.now();
      if (diff <= 0) {
        countdownEl.innerHTML = '<div><span>It\'s here!</span><small>Conference Day</small></div>';
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        return;
      }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      countdownEl.innerHTML =
        '<div><span>' + d + '</span><small>Days</small></div>' +
        '<div><span>' + h + '</span><small>Hours</small></div>' +
        '<div><span>' + m + '</span><small>Minutes</small></div>' +
        '<div><span>' + s + '</span><small>Seconds</small></div>';
    }
    function startCountdown() {
      if (countdownTimer) return;
      updateCountdown();
      countdownTimer = setInterval(updateCountdown, 1000);
    }
    function stopCountdown() {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    }
    startCountdown();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopCountdown();
      else startCountdown();
    });
  }

  /* ---------- Programme day tabs (ARIA tabs pattern with arrow-key navigation) ---------- */
  var tabBtns = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  var tabPanels = Array.prototype.slice.call(document.querySelectorAll('.tab-panel'));
  function activateTab(btn, focusIt) {
    tabBtns.forEach(function (b) {
      var selected = b === btn;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-selected', selected ? 'true' : 'false');
      b.tabIndex = selected ? 0 : -1;
    });
    tabPanels.forEach(function (p) { p.classList.remove('active'); p.hidden = true; });
    var panel = document.getElementById(btn.dataset.tab);
    if (panel) { panel.classList.add('active'); panel.hidden = false; }
    if (focusIt) btn.focus();
  }
  tabBtns.forEach(function (btn, idx) {
    btn.addEventListener('click', function () { activateTab(btn, false); });
    btn.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var next = e.key === 'ArrowRight' ? (idx + 1) % tabBtns.length : (idx - 1 + tabBtns.length) % tabBtns.length;
      activateTab(tabBtns[next], true);
    });
  });

  /* ---------- Speaker photo fallback: reveal the initials avatar if a photo fails to load ---------- */
  document.querySelectorAll('.speaker-photo img').forEach(function (img) {
    var markMissing = function () { img.parentNode.classList.add('is-missing'); };
    if (img.complete && img.naturalWidth === 0) markMissing();
    else img.addEventListener('error', markMissing);
  });

  /* ---------- Theme/track filter for speakers ---------- */
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll('.filter-btn'));
  var speakerCards = Array.prototype.slice.call(document.querySelectorAll('#speakers .speaker-card[data-track]'));
  var speakerEmptyState = document.getElementById('speakerEmptyState');
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      var track = btn.dataset.filter;
      var visibleCount = 0;
      speakerCards.forEach(function (card) {
        var show = track === 'all' || card.dataset.track === track;
        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      if (speakerEmptyState) speakerEmptyState.hidden = visibleCount !== 0;
    });
  });

  /* ---------- FAQ accordion (button-based, keyboard accessible) ---------- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', function () {
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function (i) {
        i.classList.remove('open');
        var btn = i.querySelector('.faq-q');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('open');
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ---------- Copy email buttons ---------- */
  function bindCopyButton(btn) {
    btn.addEventListener('click', function () {
      var text = btn.dataset.copy;
      navigator.clipboard && navigator.clipboard.writeText(text).then(function () {
        var original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = original; }, 1500);
      });
    });
  }
  document.querySelectorAll('.copy-btn').forEach(bindCopyButton);

  /* ---------- Form validation helpers ---------- */
  function validateField(field, condition, message) {
    var input = field.querySelector('input,select,textarea');
    var errorEl = field.querySelector('.error-msg');
    if (!condition) {
      field.classList.add('invalid');
      if (errorEl) errorEl.textContent = message;
      if (input) input.setAttribute('aria-invalid', 'true');
      return false;
    }
    field.classList.remove('invalid');
    if (errorEl) errorEl.textContent = '';
    if (input) input.removeAttribute('aria-invalid');
    return true;
  }

  function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function focusFirstInvalid(form) {
    var firstInvalid = form.querySelector('.field.invalid input,.field.invalid select,.field.invalid textarea');
    if (firstInvalid) firstInvalid.focus();
  }

  // Clears leftover red-border/error state after a successful submit + form.reset().
  function clearFieldStates(form) {
    form.querySelectorAll('.field.invalid').forEach(function (field) {
      field.classList.remove('invalid');
      var errorEl = field.querySelector('.error-msg');
      if (errorEl) errorEl.textContent = '';
      var input = field.querySelector('input,select,textarea');
      if (input) input.removeAttribute('aria-invalid');
    });
  }

  /* ---------- Shared submit helpers ---------- */
  function showBox(el, message) {
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
  }
  function hideBox(el) {
    if (!el) return;
    el.style.display = 'none';
  }
  function hideBoxes() {
    Array.prototype.slice.call(arguments).forEach(hideBox);
  }
  function setSubmitting(btn, isSubmitting, idleLabel) {
    btn.disabled = isSubmitting;
    btn.textContent = isSubmitting ? 'Submitting…' : idleLabel;
  }

  /* ---------- Registration <-> Abstract gating ----------
     Abstract submission requires a completed registration first. The registration_id is kept
     client-side purely as a UX convenience (auto-unlocking the abstract form on return visits)
     — it is NOT an authorization mechanism. The backend independently verifies the
     registration_id against the Registrations sheet on every POST /api/abstracts, so a
     missing/tampered/fake value here only affects what the *form* shows; it can never let an
     unregistered submission actually succeed.

     localStorage (persists across browser restarts) is preferred, with sessionStorage as a
     fallback for contexts where localStorage throws (private/incognito windows in some
     browsers, storage disabled by policy, storage quota exceeded, etc.) — both wrapped in
     try/catch since either can throw synchronously just from being accessed. */
  var REG_STORAGE_KEY = 'iccs_registration';

  function getStoredRegistration() {
    try {
      var raw = localStorage.getItem(REG_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    try {
      var sessionRaw = sessionStorage.getItem(REG_STORAGE_KEY);
      return sessionRaw ? JSON.parse(sessionRaw) : null;
    } catch (e) {
      return null;
    }
  }
  function setStoredRegistration(reg) {
    var json = JSON.stringify(reg);
    try { localStorage.setItem(REG_STORAGE_KEY, json); } catch (e) {}
    try { sessionStorage.setItem(REG_STORAGE_KEY, json); } catch (e) {}
  }
  function clearStoredRegistration() {
    try { localStorage.removeItem(REG_STORAGE_KEY); } catch (e) {}
    try { sessionStorage.removeItem(REG_STORAGE_KEY); } catch (e) {}
  }

  /* Three mutually-exclusive states for the Call for Abstracts section:
       gate     — no valid registration on file yet (default)
       form     — registered, hasn't submitted an abstract yet
       locked   — registered AND already has an abstract on file (only one is accepted)
     The backend independently enforces the "one abstract per registration" limit (see
     abstractController.create's ABSTRACT_ALREADY_SUBMITTED check) — the `abstractSubmitted`
     flag kept alongside the registration here is only so a returning visitor sees the locked
     state immediately instead of the form, without needing a submission attempt to fail first. */
  var abstractGate = document.getElementById('abstractGate');
  var abstractFormWrap = document.getElementById('abstractForm-wrap');
  var abstractLocked = document.getElementById('abstractAlreadySubmitted');
  var abstractLockedText = document.getElementById('abstractAlreadySubmittedText');
  var abstractRegBadge = document.getElementById('abstractRegBadge');
  var absRegistrationIdInput = document.getElementById('absRegistrationId');
  var absEmailInput = document.getElementById('absEmail');

  function showAbstractGate() {
    if (abstractFormWrap) abstractFormWrap.hidden = true;
    if (abstractLocked) abstractLocked.hidden = true;
    if (abstractGate) abstractGate.hidden = false;
  }
  function showAbstractForm(reg) {
    if (!abstractFormWrap) return;
    if (abstractGate) abstractGate.hidden = true;
    if (abstractLocked) abstractLocked.hidden = true;
    abstractFormWrap.hidden = false;
    if (abstractRegBadge) abstractRegBadge.textContent = 'Registered as ' + reg.email + ' · Registration ID: ' + reg.registration_id;
    if (absRegistrationIdInput) absRegistrationIdInput.value = reg.registration_id;
    if (absEmailInput) absEmailInput.value = reg.email;
  }
  function showAbstractLocked(reg, customMessage) {
    if (!abstractLocked) return;
    if (abstractGate) abstractGate.hidden = true;
    if (abstractFormWrap) abstractFormWrap.hidden = true;
    abstractLocked.hidden = false;
    abstractLocked.classList.add('visible'); // skip the scroll fade-in: it's already where the user is looking
    if (abstractLockedText) {
      abstractLockedText.textContent = customMessage ||
        ('You have already submitted an abstract for registration ' + reg.registration_id +
          (reg.abstract_id ? ' (Abstract ID: ' + reg.abstract_id + ')' : '') + '. Only one abstract is accepted per registration.');
    }
    loadAbstractStatus(reg, !!customMessage);
  }
  function unlockAbstractForm(reg) {
    if (reg.abstractSubmitted) {
      showAbstractLocked(reg);
      return;
    }
    showAbstractForm(reg);
    // On a new device/browser the local abstractSubmitted flag is missing, so ask the server
    // whether this registration already has an abstract — if so, show its status instead of
    // an empty form that would only fail with ABSTRACT_ALREADY_SUBMITTED.
    ICCS_API.request('/abstracts/status', {
      method: 'POST',
      body: { registrationId: reg.registration_id, email: reg.email }
    }).then(function (res) {
      if (!res.data.abstract) return;
      reg.abstractSubmitted = true;
      reg.abstract_id = res.data.abstract.abstract_id;
      setStoredRegistration(reg);
      showAbstractLocked(reg);
    }).catch(function () { /* the form stays usable; submission re-checks server-side */ });
  }

  /* ---------- Abstract review status + post-acceptance payment details ----------
     The status (and, once Accepted, the payment instructions) come from POST /api/abstracts/
     status, which checks the Registration ID + email. Payment details are deliberately NOT in
     the page source — the server only returns them for an accepted abstract. All server data is
     inserted with textContent/createElement, never innerHTML. */
  var statusBox = document.getElementById('abstractStatus');
  var statusChip = document.getElementById('abstractStatusChip');
  var statusTitle = document.getElementById('abstractStatusTitle');
  var statusNote = document.getElementById('abstractStatusNote');
  var statusComments = document.getElementById('abstractStatusComments');
  var statusCommentsText = document.getElementById('abstractStatusCommentsText');
  var statusError = document.getElementById('abstractStatusError');
  var statusRefreshBtn = document.getElementById('abstractStatusRefresh');
  var paymentPanel = document.getElementById('abstractPayment');

  var STATUS_NOTES = {
    'Submitted': 'Your abstract has been received and is awaiting review.',
    'Under Review': 'Your abstract is currently being reviewed by the faculty committee.',
    'Accepted': 'Congratulations — your abstract has been accepted. Please complete the registration fee payment using the details below.',
    'Rejected': 'We regret that your abstract was not accepted for the conference.',
    'Revision Required': 'The reviewers have requested a revision. Please contact the organizers.'
  };
  var STATUS_CHIP_CLASS = { 'Accepted': 'is-accepted', 'Rejected': 'is-rejected', 'Under Review': 'is-review' };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPayment(payment) {
    while (paymentPanel.firstChild) paymentPanel.removeChild(paymentPanel.firstChild);
    if (!payment) { paymentPanel.hidden = true; return; }

    paymentPanel.appendChild(el('h4', '', 'Registration Fee Payment'));
    var cards = el('div', 'cards');

    var indian = el('div', 'card');
    indian.appendChild(el('h3', '', payment.indian.title));
    indian.appendChild(el('p', '', payment.indian.description));
    var payWrap = el('p', 'pay-online');
    var payLink = el('a', 'btn btn-solid', 'Pay Online');
    payLink.href = payment.indian.payUrl;
    payLink.target = '_blank';
    payLink.rel = 'noopener noreferrer';
    payWrap.appendChild(payLink);
    indian.appendChild(payWrap);
    cards.appendChild(indian);

    var intl = el('div', 'card');
    intl.appendChild(el('h3', '', payment.international.title));
    var details = el('p', 'bank-details');
    payment.international.bankDetails.forEach(function (pair, i) {
      if (i > 0) details.appendChild(document.createElement('br'));
      details.appendChild(el('b', '', pair[0] + ': '));
      details.appendChild(document.createTextNode(pair[1]));
      if (pair[0] === 'Bank A/c Number' || pair[0] === 'Bank SWIFT Code' || pair[0] === 'Bank IFSC Code') {
        var copy = el('button', 'copy-btn', 'Copy');
        copy.type = 'button';
        copy.dataset.copy = pair[1];
        copy.setAttribute('aria-label', 'Copy ' + pair[0]);
        bindCopyButton(copy);
        details.appendChild(copy);
      }
    });
    intl.appendChild(details);
    cards.appendChild(intl);

    paymentPanel.appendChild(cards);
    paymentPanel.appendChild(el('p', 'payment-disclaimer', payment.disclaimer + ' Please keep your payment receipt.'));
    paymentPanel.hidden = false;
  }

  function renderStatus(data, keepMessage) {
    hideBox(statusError);
    if (!data.abstract) {
      statusBox.hidden = true;
      renderPayment(null);
      return;
    }
    var a = data.abstract;
    if (abstractLockedText && !keepMessage) {
      abstractLockedText.textContent = 'Abstract ID: ' + a.abstract_id + ' · Registration ID: ' + data.registration_id;
    }
    statusChip.textContent = a.submission_status;
    statusChip.className = 'status-chip ' + (STATUS_CHIP_CLASS[a.submission_status] || '');
    statusTitle.textContent = a.title;
    statusNote.textContent = STATUS_NOTES[a.submission_status] || '';
    statusComments.hidden = !a.review_comments;
    statusCommentsText.textContent = a.review_comments || '';
    statusBox.hidden = false;
    renderPayment(data.payment);
  }

  var currentStatusReg = null;
  // keepMessage: leave the card's message (e.g. the just-submitted confirmation) in place.
  function loadAbstractStatus(reg, keepMessage) {
    if (!statusBox || !reg) return;
    currentStatusReg = reg;
    if (statusRefreshBtn) { statusRefreshBtn.disabled = true; statusRefreshBtn.textContent = 'Checking…'; }
    ICCS_API.request('/abstracts/status', {
      method: 'POST',
      body: { registrationId: reg.registration_id, email: reg.email }
    }).then(function (res) {
      renderStatus(res.data, keepMessage);
    }).catch(function (err) {
      if (err.code === 'REGISTRATION_NOT_FOUND' || err.code === 'REGISTRATION_INVALID') {
        clearStoredRegistration();
        lockAbstractForm();
        showBox(document.getElementById('verifyError'), err.message);
        return;
      }
      showBox(statusError, 'Could not load your abstract status: ' + err.message);
    }).finally(function () {
      if (statusRefreshBtn) { statusRefreshBtn.disabled = false; statusRefreshBtn.textContent = 'Refresh status'; }
    });
  }
  if (statusRefreshBtn) {
    statusRefreshBtn.addEventListener('click', function () {
      loadAbstractStatus(currentStatusReg || getStoredRegistration(), false);
    });
  }
  // Kept as the one function that fully resets to "no registration" — used by both switch-
  // registration links and by the REGISTRATION_REQUIRED/NOT_FOUND/INVALID error paths below.
  function lockAbstractForm() {
    showAbstractGate();
  }

  var existingRegistration = getStoredRegistration();
  if (existingRegistration) unlockAbstractForm(existingRegistration);

  function switchRegistration() {
    clearStoredRegistration();
    showAbstractGate();
  }
  var switchRegistrationBtn = document.getElementById('switchRegistrationBtn');
  if (switchRegistrationBtn) switchRegistrationBtn.addEventListener('click', switchRegistration);
  var switchRegistrationBtnLocked = document.getElementById('switchRegistrationBtnLocked');
  if (switchRegistrationBtnLocked) switchRegistrationBtnLocked.addEventListener('click', switchRegistration);

  /* ---------- "Already registered?" verify form (in the gate, for returning registrants) ---------- */
  var verifyForm = document.getElementById('verifyForm');
  if (verifyForm) {
    var verifyErrorBox = document.getElementById('verifyError');
    var verifySubmitBtn = document.getElementById('verifySubmitBtn');

    verifyForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideBoxes(verifyErrorBox);

      var registrationId = document.getElementById('verifyRegistrationId');
      var email = document.getElementById('verifyEmail');

      var ok = true;
      ok = validateField(registrationId.closest('.field'), registrationId.value.trim().length > 0, 'Please enter your Registration ID.') && ok;
      ok = validateField(email.closest('.field'), isValidEmail(email.value.trim()), 'Please enter a valid email address.') && ok;

      if (!ok) { focusFirstInvalid(verifyForm); return; }

      setSubmitting(verifySubmitBtn, true, 'Continue');
      ICCS_API.request('/registrations/verify', {
        method: 'POST',
        body: {
          registrationId: registrationId.value.trim(),
          email: email.value.trim()
        }
      }).then(function (res) {
        var reg = { registration_id: res.data.registration_id, email: res.data.email.toLowerCase() };
        setStoredRegistration(reg);
        unlockAbstractForm(reg);
        verifyForm.reset();
        clearFieldStates(verifyForm);
      }).catch(function (err) {
        showBox(verifyErrorBox, err.message);
      }).finally(function () {
        setSubmitting(verifySubmitBtn, false, 'Continue');
      });
    });
  }

  /* ---------- Registration form ---------- */
  var regForm = document.getElementById('registrationForm');
  if (regForm) {
    var regSuccessBox = document.getElementById('regSuccess');
    var regErrorBox = document.getElementById('regError');
    var regInfoBox = document.getElementById('regInfo');
    var regSubmitBtn = document.getElementById('regSubmitBtn');

    regForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideBoxes(regSuccessBox, regErrorBox, regInfoBox);

      var name = document.getElementById('regName');
      var email = document.getElementById('regEmail');
      var phone = document.getElementById('regPhone');
      var category = document.getElementById('regCategory');
      var affiliation = document.getElementById('regAffiliation');

      var ok = true;
      ok = validateField(name.closest('.field'), name.value.trim().length >= 3, 'Please enter your full name.') && ok;
      ok = validateField(email.closest('.field'), isValidEmail(email.value.trim()), 'Please enter a valid email address.') && ok;
      ok = validateField(phone.closest('.field'), phone.value.replace(/\D/g, '').length >= 10, 'Please enter a valid phone number.') && ok;
      ok = validateField(category.closest('.field'), category.value !== '', 'Please select a registration category.') && ok;
      ok = validateField(affiliation.closest('.field'), affiliation.value.trim().length >= 2, 'Please enter your affiliation.') && ok;

      if (!ok) { focusFirstInvalid(regForm); return; }

      setSubmitting(regSubmitBtn, true, 'Register');
      ICCS_API.request('/registrations', {
        method: 'POST',
        body: {
          name: name.value.trim(),
          email: email.value.trim(),
          phone: phone.value.trim(),
          category: category.value,
          affiliation: affiliation.value.trim()
        }
      }).then(function (res) {
        var reg = { registration_id: res.data.registration_id, email: email.value.trim().toLowerCase() };
        setStoredRegistration(reg);
        unlockAbstractForm(reg);
        var emailNote = res.data.email_queued
          ? 'A confirmation email has been sent — '
          : 'Please save your Registration ID — ';
        showBox(regSuccessBox, 'Registration successful! Your Registration ID is ' + res.data.registration_id +
          '. ' + emailNote + 'taking you to Abstract Submission…');
        regForm.reset();
        clearFieldStates(regForm);
        // Give them a moment to read the message, then jump straight to the now-unlocked
        // abstract form so there's no doubt about where to go next.
        setTimeout(function () {
          var abstractsSection = document.getElementById('abstracts');
          if (abstractsSection) abstractsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 1400);
      }).catch(function (err) {
        if (err.code === 'ALREADY_REGISTERED') {
          showBox(regInfoBox, 'Already Registered — this email address or phone number is already registered. ' +
            'Scroll down to "Already Registered?" under Call for Abstracts and enter your Registration ID and email to continue.');
        } else {
          showBox(regErrorBox, 'Registration failed: ' + err.message);
        }
      }).finally(function () {
        setSubmitting(regSubmitBtn, false, 'Register');
      });
    });
  }

  /* ---------- Abstract submission form ---------- */
  var abstractForm = document.getElementById('abstractForm');
  if (abstractForm) {
    var abstractSuccessBox = document.getElementById('abstractSuccess');
    var abstractErrorBox = document.getElementById('abstractError');
    var abstractInfoBox = document.getElementById('abstractInfo');
    var abstractSubmitBtn = document.getElementById('abstractSubmitBtn');

    abstractForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideBoxes(abstractSuccessBox, abstractErrorBox, abstractInfoBox);

      var registration = getStoredRegistration();
      if (!registration) {
        lockAbstractForm();
        showBox(abstractErrorBox, 'Registration Required — please complete conference registration before submitting an abstract.');
        return;
      }

      var title = document.getElementById('absTitle');
      var author = document.getElementById('absAuthor');
      var email = document.getElementById('absEmail');
      var category = document.getElementById('absCategory');
      var text = document.getElementById('absText');

      var ok = true;
      ok = validateField(title.closest('.field'), title.value.trim().length >= 5, 'Please enter a title of at least 5 characters.') && ok;
      ok = validateField(author.closest('.field'), author.value.trim().length >= 3, 'Please enter the author name(s).') && ok;
      ok = validateField(category.closest('.field'), category.value !== '', 'Please select a presentation category.') && ok;
      var wordCount = text.value.trim().split(/\s+/).filter(Boolean).length;
      ok = validateField(text.closest('.field'), wordCount >= 50 && wordCount <= 350, 'Abstract must be between 50 and 350 words (currently ' + wordCount + ').') && ok;

      if (!ok) { focusFirstInvalid(abstractForm); return; }

      setSubmitting(abstractSubmitBtn, true, 'Submit Abstract');
      ICCS_API.request('/abstracts', {
        method: 'POST',
        body: {
          registrationId: registration.registration_id,
          title: title.value.trim(),
          authors: author.value.trim(),
          email: email.value.trim(),
          category: category.value,
          abstractText: text.value.trim()
        }
      }).then(function (res) {
        var emailNote = res.data.email_queued
          ? 'A confirmation email has been sent to your registered email address.'
          : 'Please save your Registration ID and Abstract ID for your records.';
        abstractForm.reset();
        clearFieldStates(abstractForm);
        if (wordCounter) wordCounter.textContent = '0 / 350 words';
        // Only one abstract is accepted per registration — record that locally so a page
        // reload (or a later visit) shows the locked state immediately, without waiting for
        // another submission attempt to fail first. The backend enforces the actual limit.
        registration.abstractSubmitted = true;
        registration.abstract_id = res.data.abstract_id;
        setStoredRegistration(registration);
        // The confirmation goes into the locked card's own message rather than the (now
        // hidden, along with the rest of the form) abstractSuccessBox, so it's actually seen.
        showAbstractLocked(registration, 'Abstract Submitted Successfully. Registration ID: ' +
          res.data.registration_id + ' · Abstract ID: ' + res.data.abstract_id + '. ' + emailNote);
      }).catch(function (err) {
        if (err.code === 'ABSTRACT_ALREADY_SUBMITTED') {
          registration.abstractSubmitted = true;
          setStoredRegistration(registration);
          showAbstractLocked(registration);
        } else if (err.code === 'REGISTRATION_REQUIRED' || err.code === 'REGISTRATION_NOT_FOUND' || err.code === 'REGISTRATION_INVALID') {
          clearStoredRegistration();
          lockAbstractForm();
          showBox(abstractErrorBox, err.message);
        } else if (err.status === 409) {
          showBox(abstractInfoBox, 'It looks like this abstract has already been submitted: ' + err.message);
        } else {
          showBox(abstractErrorBox, 'Submission failed: ' + err.message);
        }
      }).finally(function () {
        setSubmitting(abstractSubmitBtn, false, 'Submit Abstract');
      });
    });
  }

  /* ---------- Contact form ---------- */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    var contactSuccessBox = document.getElementById('contactSuccess');
    var contactErrorBox = document.getElementById('contactError');
    var contactSubmitBtn = document.getElementById('contactSubmitBtn');

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideBoxes(contactSuccessBox, contactErrorBox);

      var name = document.getElementById('contactName');
      var email = document.getElementById('contactEmail');
      var subject = document.getElementById('contactSubject');
      var message = document.getElementById('contactMessage');

      var ok = true;
      ok = validateField(name.closest('.field'), name.value.trim().length >= 2, 'Please enter your name.') && ok;
      ok = validateField(email.closest('.field'), isValidEmail(email.value.trim()), 'Please enter a valid email address.') && ok;
      ok = validateField(subject.closest('.field'), subject.value.trim().length >= 2, 'Please enter a subject.') && ok;
      ok = validateField(message.closest('.field'), message.value.trim().length >= 5, 'Please enter a message.') && ok;

      if (!ok) { focusFirstInvalid(contactForm); return; }

      setSubmitting(contactSubmitBtn, true, 'Send Message');
      ICCS_API.request('/contact', {
        method: 'POST',
        body: {
          name: name.value.trim(),
          email: email.value.trim(),
          subject: subject.value.trim(),
          message: message.value.trim()
        }
      }).then(function () {
        showBox(contactSuccessBox, 'Thank you — your message has been sent to the Organizing Committee.');
        contactForm.reset();
        clearFieldStates(contactForm);
      }).catch(function (err) {
        showBox(contactErrorBox, 'Could not send your message: ' + err.message);
      }).finally(function () {
        setSubmitting(contactSubmitBtn, false, 'Send Message');
      });
    });
  }

  /* ---------- Live word counter for abstract textarea ---------- */
  var absText = document.getElementById('absText');
  var wordCounter = document.getElementById('wordCounter');
  if (absText && wordCounter) {
    absText.addEventListener('input', function () {
      var wc = absText.value.trim().split(/\s+/).filter(Boolean).length;
      wordCounter.textContent = wc + ' / 350 words';
    });
  }

});
