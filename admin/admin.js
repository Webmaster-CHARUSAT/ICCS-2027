// Faculty review dashboard for ICCS-CIRCLE 2027 (/admin). Talks only to /api/admin/* through
// the shared js/api.js client. The session token lives in sessionStorage (cleared when the tab
// closes) and is sent as "Authorization: Bearer <token>". All server data is rendered with
// textContent/createElement — never innerHTML — since abstract text is user-submitted.
document.addEventListener('DOMContentLoaded', function () {
  var TOKEN_KEY = 'iccs_admin_session';

  /* ---------- Session storage (wrapped: sessionStorage can throw in locked-down browsers) ---------- */
  var memorySession = null;
  function getSession() {
    try {
      var raw = sessionStorage.getItem(TOKEN_KEY);
      return raw ? JSON.parse(raw) : memorySession;
    } catch (e) { return memorySession; }
  }
  function setSession(session) {
    memorySession = session;
    try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session)); } catch (e) {}
  }
  function clearSession() {
    memorySession = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function showBox(box, message) { box.textContent = message; box.style.display = 'block'; }
  function hideBox(box) { box.style.display = 'none'; }
  function formatDate(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return value ? String(value) : '—';
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  var CHIP_CLASS = { 'Accepted': 'is-accepted', 'Rejected': 'is-rejected', 'Under Review': 'is-review' };
  function chip(status) { return el('span', 'status-chip ' + (CHIP_CLASS[status] || ''), status); }

  // Authenticated request; a 401 anywhere means the session is gone, so drop back to login.
  function api(endpoint, options) {
    options = options || {};
    var session = getSession();
    options.headers = Object.assign({}, options.headers, session ? { Authorization: 'Bearer ' + session.token } : {});
    return ICCS_API.request('/admin' + endpoint, options).catch(function (err) {
      if (err.status === 401 && endpoint !== '/login') {
        clearSession();
        showLogin('Your session has expired. Please log in again.');
      }
      throw err;
    });
  }

  /* ---------- Theme toggle (same storage key as the public site) ---------- */
  var root = document.documentElement;
  var themeBtn = $('themeToggle');
  function syncThemeLabel() { themeBtn.textContent = root.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark'; }
  syncThemeLabel();
  themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (next === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    syncThemeLabel();
    try { localStorage.setItem('iccs-theme', next); } catch (e) {}
  });

  /* ---------- Views ---------- */
  var loginView = $('loginView');
  var dashView = $('dashView');
  var userLabel = $('adminUser');
  var logoutBtn = $('logoutBtn');

  function showLogin(message) {
    dashView.hidden = true;
    loginView.hidden = false;
    userLabel.hidden = true;
    logoutBtn.hidden = true;
    if ($('detailDialog').open) $('detailDialog').close();
    if (message) showBox($('loginError'), message);
    $('loginEmail').focus();
  }
  function showDashboard(user) {
    loginView.hidden = true;
    dashView.hidden = false;
    userLabel.textContent = user.name + ' (' + user.role + ')';
    userLabel.hidden = false;
    logoutBtn.hidden = false;
    loadList();
  }

  logoutBtn.addEventListener('click', function () {
    clearSession();
    $('loginForm').reset();
    hideBox($('loginError'));
    showLogin();
  });

  /* ---------- Login ---------- */
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('loginEmail').value.trim();
    var password = $('loginPassword').value;
    hideBox($('loginError'));
    if (!email || !password) { showBox($('loginError'), 'Please enter your email and password.'); return; }

    var btn = $('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    api('/login', { method: 'POST', body: { email: email, password: password } }).then(function (res) {
      setSession({ token: res.data.token, user: res.data.user });
      $('loginPassword').value = '';
      showDashboard(res.data.user);
    }).catch(function (err) {
      showBox($('loginError'), err.message);
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'Log in';
    });
  });

  /* ---------- List: filters, stats, table, paging ---------- */
  var state = { page: 1, status: '', category: '', search: '', totalPages: 1 };
  var filtersPopulated = false;
  var STAT_TILES = [
    ['', 'Total'], ['Submitted', 'Submitted'], ['Under Review', 'Under Review'],
    ['Accepted', 'Accepted'], ['Rejected', 'Rejected']
  ];

  function renderSkeleton() {
    var tbody = $('abstractRows');
    clear(tbody);
    for (var i = 0; i < 5; i++) {
      var tr = el('tr', 'skeleton');
      ['', '', 'col-optional', 'col-optional', 'col-optional', ''].forEach(function (cls) { tr.appendChild(el('td', cls, '…')); });
      tbody.appendChild(tr);
    }
    Array.prototype.forEach.call($('statTiles').children, function (t) { t.classList.add('is-loading'); });
  }

  function renderStats(stats) {
    var wrap = $('statTiles');
    clear(wrap);
    STAT_TILES.forEach(function (def) {
      var tile = el('button', 'stat-tile' + (state.status === def[0] ? ' is-active' : ''));
      tile.type = 'button';
      tile.appendChild(el('strong', '', String(def[0] ? (stats[def[0]] || 0) : stats.total)));
      tile.appendChild(el('span', '', def[1]));
      tile.setAttribute('aria-pressed', state.status === def[0] ? 'true' : 'false');
      tile.addEventListener('click', function () {
        state.status = def[0];
        $('filterStatus').value = def[0];
        state.page = 1;
        loadList();
      });
      wrap.appendChild(tile);
    });
  }

  function populateFilters(data) {
    if (filtersPopulated) return;
    data.statuses.forEach(function (s) { var o = el('option', '', s); o.value = s; $('filterStatus').appendChild(o); });
    data.categories.forEach(function (c) { var o = el('option', '', c); o.value = c; $('filterCategory').appendChild(o); });
    filtersPopulated = true;
  }

  function renderRows(items) {
    var tbody = $('abstractRows');
    clear(tbody);
    $('emptyState').hidden = items.length !== 0;
    items.forEach(function (a) {
      var tr = el('tr');
      tr.tabIndex = 0;
      tr.setAttribute('aria-label', 'Open abstract ' + a.abstract_id + ': ' + a.title);
      tr.appendChild(el('td', '', a.abstract_id));
      tr.appendChild(el('td', 'cell-title', a.title));
      tr.appendChild(el('td', 'col-optional', a.authors));
      tr.appendChild(el('td', 'col-optional', a.presentation_category));
      tr.appendChild(el('td', 'col-optional', formatDate(a.created_at)));
      var statusCell = el('td');
      statusCell.appendChild(chip(a.submission_status));
      tr.appendChild(statusCell);
      tr.addEventListener('click', function () { openDetail(a.abstract_id); });
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(a.abstract_id); }
      });
      tbody.appendChild(tr);
    });
  }

  var listRequestId = 0;
  function loadList(fresh) {
    var requestId = ++listRequestId;
    hideBox($('listError'));
    renderSkeleton();
    $('refreshBtn').disabled = true;
    var params = ['page=' + state.page, 'limit=20'];
    if (state.status) params.push('status=' + encodeURIComponent(state.status));
    if (state.category) params.push('category=' + encodeURIComponent(state.category));
    if (state.search) params.push('search=' + encodeURIComponent(state.search));
    if (fresh) params.push('fresh=1');

    api('/abstracts?' + params.join('&')).then(function (res) {
      if (requestId !== listRequestId) return; // a newer filter change superseded this one
      var data = res.data;
      populateFilters(data);
      renderStats(data.stats);
      renderRows(data.items);
      state.page = data.pagination.page;
      state.totalPages = data.pagination.totalPages;
      $('pageInfo').textContent = 'Page ' + data.pagination.page + ' of ' + data.pagination.totalPages +
        ' · ' + data.pagination.total + ' abstract' + (data.pagination.total === 1 ? '' : 's');
      $('prevPage').disabled = state.page <= 1;
      $('nextPage').disabled = state.page >= state.totalPages;
    }).catch(function (err) {
      if (requestId !== listRequestId || err.status === 401) return;
      clear($('abstractRows'));
      showBox($('listError'), 'Could not load abstracts: ' + err.message);
    }).finally(function () {
      if (requestId === listRequestId) $('refreshBtn').disabled = false;
    });
  }

  $('refreshBtn').addEventListener('click', function () { loadList(true); });
  $('filterStatus').addEventListener('change', function () { state.status = this.value; state.page = 1; loadList(); });
  $('filterCategory').addEventListener('change', function () { state.category = this.value; state.page = 1; loadList(); });
  var searchTimer = null;
  $('filterSearch').addEventListener('input', function () {
    var value = this.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { state.search = value; state.page = 1; loadList(); }, 350);
  });
  $('prevPage').addEventListener('click', function () { if (state.page > 1) { state.page--; loadList(); } });
  $('nextPage').addEventListener('click', function () { if (state.page < state.totalPages) { state.page++; loadList(); } });

  /* ---------- Detail + decision ---------- */
  var dialog = $('detailDialog');
  var currentId = null;

  function addRow(dl, label, value) {
    dl.appendChild(el('dt', '', label));
    dl.appendChild(el('dd', '', value ? String(value) : '—'));
  }

  function renderDetail(data) {
    var a = data.abstract;
    var reg = data.registration;
    var body = $('detailBody');
    clear(body);
    $('detailTitle').textContent = a.title;

    var head = el('p');
    head.appendChild(chip(a.submission_status));
    body.appendChild(head);

    var dl = el('dl', 'detail-grid');
    addRow(dl, 'Abstract ID', a.abstract_id);
    addRow(dl, 'Registration ID', a.registration_id || (reg && reg.registration_id));
    addRow(dl, 'Authors', a.authors);
    addRow(dl, 'Corresponding author', a.corresponding_author);
    addRow(dl, 'Email', a.email);
    addRow(dl, 'Affiliation', a.affiliation);
    addRow(dl, 'Presentation category', a.presentation_category);
    addRow(dl, 'Keywords', a.keywords);
    addRow(dl, 'Word count', a.word_count);
    addRow(dl, 'Submitted', formatDate(a.created_at));
    if (reg) {
      addRow(dl, 'Registrant', reg.name);
      addRow(dl, 'Institution', reg.institution);
      addRow(dl, 'Registration category', reg.category);
    }
    if (a.reviewer) {
      addRow(dl, 'Last decision by', a.reviewer);
      addRow(dl, 'Last updated', formatDate(a.updated_at));
    }
    body.appendChild(dl);

    body.appendChild(el('h3', 'detail-section', 'Abstract'));
    body.appendChild(el('div', 'detail-text', a.abstract_text));
    if (a.review_comments) {
      body.appendChild(el('h3', 'detail-section', 'Current comments'));
      body.appendChild(el('div', 'detail-text', a.review_comments));
    }

    $('decisionComments').value = a.review_comments || '';
    $('decisionForm').hidden = false;
  }

  function openDetail(id) {
    currentId = id;
    clear($('detailBody'));
    $('detailBody').appendChild(el('p', 'admin-muted', 'Loading abstract…'));
    $('detailTitle').textContent = id;
    $('decisionForm').hidden = true;
    hideBox($('detailError'));
    hideBox($('decisionSuccess'));
    if (!dialog.open) dialog.showModal();

    api('/abstracts/' + encodeURIComponent(id)).then(function (res) {
      if (currentId === id) renderDetail(res.data);
    }).catch(function (err) {
      if (currentId === id && err.status !== 401) {
        clear($('detailBody'));
        showBox($('detailError'), 'Could not load this abstract: ' + err.message);
      }
    });
  }

  function decide(decision) {
    var comments = $('decisionComments').value.trim();
    var question = decision === 'Accepted'
      ? 'Accept abstract ' + currentId + '? The author will be emailed and shown the payment details.'
      : 'Reject abstract ' + currentId + '?';
    if (!window.confirm(question)) return;

    var buttons = [$('acceptBtn'), $('rejectBtn')];
    buttons.forEach(function (b) { b.disabled = true; });
    hideBox($('detailError'));
    hideBox($('decisionSuccess'));
    var id = currentId;
    api('/abstracts/' + encodeURIComponent(id) + '/decision', {
      method: 'PATCH',
      body: { decision: decision, comments: comments }
    }).then(function (res) {
      var note = decision === 'Accepted'
        ? (res.data.email_queued ? ' An acceptance email is being sent to the author.' : ' Email is not configured on the server, so no email was sent.')
        : '';
      showBox($('decisionSuccess'), 'Abstract ' + id + ' marked as ' + res.data.submission_status + '.' + note);
      openDetailRefresh(id);
      loadList();
    }).catch(function (err) {
      if (err.status !== 401) showBox($('detailError'), 'Could not save the decision: ' + err.message);
    }).finally(function () {
      buttons.forEach(function (b) { b.disabled = false; });
    });
  }

  // Re-render the open dialog with the saved values, keeping the success message visible.
  function openDetailRefresh(id) {
    api('/abstracts/' + encodeURIComponent(id)).then(function (res) {
      if (currentId === id && dialog.open) renderDetail(res.data);
    }).catch(function () {});
  }

  $('acceptBtn').addEventListener('click', function () { decide('Accepted'); });
  $('rejectBtn').addEventListener('click', function () { decide('Rejected'); });
  $('detailClose').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', function () { currentId = null; });

  /* ---------- Start: resume a stored session if it's still valid ---------- */
  var session = getSession();
  if (!session) {
    showLogin();
  } else {
    api('/me').then(function (res) { showDashboard(res.data.user); }).catch(function (err) {
      if (err.status !== 401) showLogin('Could not reach the server: ' + err.message);
    });
  }
});
