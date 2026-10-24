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

  /* ---------- Register Now CTA: entrance, off-screen pause, sticky bar ---------- */

  var ctaButtons = Array.prototype.slice.call(document.querySelectorAll('.register-btn'));
  var stickyBar = document.getElementById('registerSticky');
  if ('IntersectionObserver' in window) {
    // Entrance (fade + rise, once) for the in-page buttons; also pause their looping animations
    // whenever they are off-screen. The sticky button has its own slide-up instead.
    var ctaObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var btn = entry.target;
        btn.classList.toggle('is-offscreen', !entry.isIntersecting);
        if (entry.isIntersecting && btn.classList.contains('is-pending') && !btn.classList.contains('is-in')) {
          btn.classList.add('is-in');
          // Once the entrance has played, drop its classes so hover/press transforms apply normally.
          setTimeout(function () { btn.classList.remove('is-pending', 'is-in'); }, 700);
        }
      });
    });
    ctaButtons.forEach(function (btn) {
      if (!btn.classList.contains('register-btn--sticky') && !btn.closest('.nav-controls')) btn.classList.add('is-pending');
      ctaObserver.observe(btn);
    });

    // Sticky bar (mobile CSS only): visible once the hero has scrolled away, hidden while the
    // registration form or the Join Us banner (which has its own button) is on screen.
    var heroEl = document.querySelector('.hero');
    var hideZones = [document.getElementById('registration'), document.getElementById('joinUs')].filter(Boolean);
    if (stickyBar && heroEl) {
      var heroVisible = true;
      var zonesVisible = {};
      var updateSticky = function () {
        var anyZone = Object.keys(zonesVisible).some(function (k) { return zonesVisible[k]; });
        var show = !heroVisible && !anyZone;
        stickyBar.classList.toggle('is-visible', show);
        document.body.classList.toggle('has-sticky-cta', show);
      };
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
        updateSticky();
      }).observe(heroEl);
      var zoneObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { zonesVisible[entry.target.id] = entry.isIntersecting; });
        updateSticky();
      });
      hideZones.forEach(function (z) { zoneObserver.observe(z); });
    }
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

  /* ---------- Legacy cleanup ----------
     Earlier versions kept the visitor's Registration ID + email in the browser to unlock an
     abstract form. Submissions now go through Microsoft CMT, so remove that stored
     personal data from visitors who registered before. */
  ['localStorage', 'sessionStorage'].forEach(function (store) {
    try { window[store].removeItem('iccs_registration'); } catch (e) {}
  });

  /* ---------- Registration ID gates ----------
     Two forms ask for the Registration ID + the email it was registered with and check them
     against the Registrations sheet (Apps Script action verifyRegistration):
       "View Payment Details" (#paymentGateForm)            -> reveals #paymentDetails
       "Continue to Abstract Submission" (#abstractGateForm) -> redirects to ICCS_CONFIG.cmtUrl
     Element ids follow <prefix>RegId / Email / SubmitBtn / Success / Error. */
  function setupGate(prefix, formId, label, onVerified) {
    var form = document.getElementById(formId);
    if (!form) return null;
    var regIdInput = document.getElementById(prefix + 'RegId');
    var emailInput = document.getElementById(prefix + 'Email');
    var submitBtn = document.getElementById(prefix + 'SubmitBtn');
    var successBox = document.getElementById(prefix + 'Success');
    var errorBox = document.getElementById(prefix + 'Error');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideBoxes(successBox, errorBox);
      var regId = regIdInput.value.trim().toUpperCase();
      var email = emailInput.value.trim();
      var ok = true;
      ok = validateField(regIdInput.closest('.field'), /^REG-[A-Z0-9]{6,}$/.test(regId), 'Please enter your Registration ID (it starts with REG-).') && ok;
      ok = validateField(emailInput.closest('.field'), isValidEmail(email), 'Please enter the email address you registered with.') && ok;
      if (!ok) { focusFirstInvalid(form); return; }

      setSubmitting(submitBtn, true, label);
      ICCS_API.request('/registrations/verify', {
        method: 'POST',
        body: { registrationId: regId, email: email }
      }).then(function (res) {
        // onVerified returns true when the page is about to navigate away (keep the button disabled).
        if (!onVerified(res.data, successBox)) setSubmitting(submitBtn, false, label);
      }).catch(function (err) {
        var msg;
        if (err.code === 'REGISTRATION_NOT_FOUND') {
          msg = 'We could not find this Registration ID. Check it against your confirmation email, or register first.';
        } else if (err.code === 'REGISTRATION_INVALID' || err.code === 'RATE_LIMITED') {
          msg = err.message;
        } else if (err.code === 'VALIDATION_ERROR') {
          msg = String(err.message).replace(/^\w+:\s*/, '');
        } else {
          msg = 'Could not verify your registration: ' + err.message;
        }
        showBox(errorBox, msg);
        setSubmitting(submitBtn, false, label);
      });
    });

    return {
      // Fill the gate (e.g. right after registering) and bring it into view.
      open: function (regId, email) {
        if (regId) regIdInput.value = regId;
        if (email) emailInput.value = email;
        form.scrollIntoView({ block: 'center' });
        (regId && email ? submitBtn : (regId ? emailInput : regIdInput)).focus({ preventScroll: true });
      }
    };
  }

  var paymentGate = setupGate('pay', 'paymentGateForm', 'View Payment Details', function (data, box) {
    showBox(box, 'Registration ' + data.registration_id + ' verified. The payment options are shown below — after paying, upload your receipt (compulsory).');
    var details = document.getElementById('paymentDetails');
    if (details) {
      details.hidden = false;
      details.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
      details.focus({ preventScroll: true });
      details.scrollIntoView({ block: 'start' });
    }
    return false;
  });

  var abstractGate = setupGate('gate', 'abstractGateForm', 'Verify & Continue to CMT', function (data, box) {
    var cmtUrl = window.ICCS_CONFIG && window.ICCS_CONFIG.cmtUrl;
    showBox(box, 'Registration ' + data.registration_id + ' verified. Taking you to Microsoft CMT to submit your abstract…');
    if (!cmtUrl) return false;
    setTimeout(function () { window.location.assign(cmtUrl); }, 1500);
    return true;
  });

  // Next steps appended under a registration result: pay, then submit the abstract.
  function offerNextSteps(box, regId, email) {
    if (!box) return;
    var next = document.createElement('div');
    next.className = 'next-step';
    var note = document.createElement('p');
    note.textContent = 'Next: view the payment details, then submit your abstract on Microsoft CMT. Both use your Registration ID.';
    var actions = document.createElement('p');
    actions.className = 'next-step-actions';
    [['View Payment Details', '#how-to-pay', paymentGate, 'btn btn-solid'],
     ['Continue to Abstract Submission', '#how-to-submit', abstractGate, 'btn btn-outline-dark']].forEach(function (step) {
      if (!step[2]) return;
      var a = document.createElement('a');
      a.className = step[3];
      a.href = step[1];
      a.textContent = step[0];
      a.addEventListener('click', function (e) {
        e.preventDefault();
        step[2].open(regId, email);
      });
      actions.appendChild(a);
    });
    next.appendChild(note);
    next.appendChild(actions);
    box.appendChild(next);
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

      var registeredEmail = email.value.trim();
      setSubmitting(regSubmitBtn, true, 'Register');
      ICCS_API.request('/registrations', {
        method: 'POST',
        body: {
          name: name.value.trim(),
          email: email.value.trim(),
          phone: phone.value.trim(),
          category: category.value,
          affiliation: affiliation.value.trim(),
          website: document.getElementById('regWebsite').value
        }
      }).then(function (res) {
        var emailNote = res.data.email_queued
          ? 'A confirmation email with your next steps (abstract submission on Microsoft CMT, fee payment and receipt upload) has been sent to your address — please also check your Spam folder.'
          : 'We could not send the confirmation email, so please save your Registration ID now and contact the organizers.';
        showBox(regSuccessBox, 'Registration successful! Your Registration ID is ' + res.data.registration_id +
          '. ' + emailNote);
        regForm.reset();
        clearFieldStates(regForm);
        offerNextSteps(regSuccessBox, res.data.registration_id, registeredEmail);
      }).catch(function (err) {
        if (err.code === 'ALREADY_REGISTERED') {
          showBox(regInfoBox, 'Already Registered — this email address or phone number is already registered. ' +
            'Please check your inbox for the confirmation email, or contact the organizers if you need help.');
          offerNextSteps(regInfoBox, '', registeredEmail);
        } else {
          showBox(regErrorBox, 'Registration failed: ' + err.message);
        }
      }).finally(function () {
        setSubmitting(regSubmitBtn, false, 'Register');
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
          message: message.value.trim(),
          website: document.getElementById('contactWebsite').value
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


});
