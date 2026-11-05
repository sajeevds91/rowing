/* App shell: roles, navigation, sign-in, event wiring. */
const App = (() => {
  const ROLE_TABS = {
    coach: ['today', 'overview', 'schedule', 'daily', 'athletes', 'crews', 'results', 'races', 'combos', 'report', 'data'],
    entry: ['today', 'daily', 'schedule', 'overview', 'crews'],
    athlete: ['me', 'today', 'schedule', 'overview', 'crews', 'races', 'results'],
    advisory: ['report', 'overview', 'athletes', 'races', 'results', 'crews', 'schedule', 'today'],
  };
  const LABELS = { today: 'Today', overview: 'Team Info', schedule: 'Schedule & Calendar', daily: 'Daily Entry', me: 'My Page', athletes: 'Athletes', crews: 'Crews & Boats', results: 'Boat Progress & Records', races: 'Regattas & Results', combos: 'Combinations', report: 'Committee Report', data: 'Data & Settings' };
  const ROLE_LABEL = { coach: 'Coach', entry: 'Data Entry', athlete: 'Athlete', advisory: 'Advisory Committee' };

  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  const root = document.getElementById('view');
  const cloud = typeof Cloud !== 'undefined' && Cloud.enabled;

  // local mode role (PIN-protected for coach and data entry)
  let role = ls.get('stc-role') || 'athlete';
  const unlocked = new Set((ss.get('stc-unlocked') || '').split(',').filter(Boolean));
  if (!cloud && (role === 'coach' || role === 'entry') && !unlocked.has(role)) role = 'athlete';
  let localAthlete = ls.get('stc-athlete') || '';
  let ready = false;

  const currentRole = () => (cloud ? Cloud.profile?.role : role);
  const currentTab = () => {
    const tabs = ROLE_TABS[currentRole()] || [];
    const h = location.hash.slice(1);
    return tabs.includes(h) ? h : tabs[0];
  };
  const ctx = () => {
    const r = currentRole();
    return {
      role: r, coach: r === 'coach', entry: r === 'coach' || r === 'entry', readonly: r === 'advisory',
      athleteId: r === 'athlete' ? (cloud ? Cloud.profile?.athleteId : localAthlete) : null,
      userName: cloud ? Cloud.profile?.name : ROLE_LABEL[r],
    };
  };

  function renderShell() {
    const st = Store.db.settings; const r = currentRole(); const tab = currentTab();
    document.getElementById('brandTitle').textContent = st.teamName;
    const days = st.regattaDate ? U.daysBetween(U.today(), st.regattaDate) : null;
    document.getElementById('countdown').innerHTML = days === null ? '' : days >= 0
      ? `<b>${days} days</b>to the ${U.esc(st.regattaName)}` : `<b>${U.esc(st.regattaName)}</b>${U.fmtDate(st.regattaDate)}`;
    const sw = document.getElementById('roleSwitch');
    if (cloud) {
      sw.innerHTML = Cloud.profile ? `<span class="who-am-i">${U.esc(Cloud.profile.name || '')} · ${ROLE_LABEL[r] || ''}</span>
        <button data-acct="password">Change password</button><button data-acct="signout">Sign out</button>` : '';
    } else {
      sw.innerHTML = ['athlete', 'entry', 'coach', 'advisory'].map((k) => `<button data-role="${k}" class="${k === r ? 'active' : ''}">${ROLE_LABEL[k]}</button>`).join('');
    }
    document.getElementById('tabs').innerHTML = (ROLE_TABS[r] || []).map((t) => `<a href="#${t}" class="${t === tab ? 'active' : ''}">${LABELS[t]}</a>`).join('');
  }

  function render() {
    if (!ready) return;
    if (cloud && !Cloud.profile) return;
    renderShell();
    UI.clearCharts();
    const view = Views[currentTab()];
    const y = window.scrollY;
    root.innerHTML = view ? view.render(ctx()) : '';
    if (view?.mount) view.mount(root, ctx());
    window.scrollTo(0, y);
  }

  // live updates from the cloud: don't re-render under someone's fingers
  let deferred = false;
  const busy = () => document.getElementById('modalRoot').innerHTML || (root.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
  function softRender() { if (busy()) { deferred = true; return; } render(); }
  root.addEventListener('focusout', () => setTimeout(() => { if (deferred && !busy()) { deferred = false; render(); } }, 200));

  function commit(msg) { Store.save(); if (msg) U.toast(msg); render(); }

  // result: false → nothing, null → re-render only, true → save silently, string → save + toast
  async function run(name, el) {
    const view = Views[currentTab()];
    const fn = view?.act?.[name];
    if (!fn) return;
    if (ctx().readonly && !['print', 'pick', 'pickEvent', 'filter', 'raceFilter', 'weekNav', 'monthNav', 'crewFilter', 'dayNav', 'dayPick', 'copyMsg', 'shareMsg', 'printDay', 'csvSquad', 'csvResults'].includes(name)) return;
    let r;
    try { r = await fn.call(view, el, ctx()); } catch (e) { console.error(e); U.toast('Something went wrong: ' + e.message); return; }
    if (r === false) return;
    if (r !== null) { Store.save(); if (typeof r === 'string') U.toast(r); }
    render();
  }
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    e.preventDefault(); run(el.dataset.act, el);
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault(); run(f.dataset.form, f);
  });
  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]'); if (!el) return;
    run(el.dataset.change, el);
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  // ---------- local-mode roles ----------
  function askPin(r) {
    const pin = r === 'coach' ? Store.db.settings.coachPin : Store.db.settings.entryPin;
    UI.modal(`<form><h3>${ROLE_LABEL[r]} access</h3>
      <p class="muted" style="margin-top:0">Enter the ${ROLE_LABEL[r].toLowerCase()} PIN.${Store.db.settings.demo ? ` (Demo PIN: ${r === 'coach' ? '1234' : '1111'})` : ''}</p>
      <input type="password" name="pin" inputmode="numeric" autocomplete="off" required>
      <div class="btn-row" style="margin-top:12px"><button class="btn">Open</button><button type="button" class="btn ghost" data-close>Cancel</button></div></form>`,
    { onSubmit: (f) => {
      if (f.pin.value !== String(pin)) { U.toast('Incorrect PIN'); f.pin.value = ''; return false; }
      unlocked.add(r); ss.set('stc-unlocked', [...unlocked].join(',')); setRole(r, true);
    } });
    setTimeout(() => U.$('#modalRoot input')?.focus(), 30);
  }
  function setRole(r, ok) {
    if ((r === 'coach' || r === 'entry') && !unlocked.has(r) && !ok) return askPin(r);
    role = r; ls.set('stc-role', r);
    if (!ROLE_TABS[r].includes(location.hash.slice(1))) history.replaceState(null, '', '#' + ROLE_TABS[r][0]);
    render();
  }
  document.getElementById('roleSwitch').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.role) setRole(b.dataset.role);
    if (b.dataset.acct === 'signout') Cloud.signOut();
    if (b.dataset.acct === 'password') {
      UI.modal(`<form><h3>Change password</h3><label>New password<input type="password" name="p1" minlength="6" required></label><label>Repeat<input type="password" name="p2" minlength="6" required></label>
        <div class="btn-row" style="margin-top:12px"><button class="btn">Change</button><button type="button" class="btn ghost" data-close>Cancel</button></div></form>`,
      { onSubmit: async (f) => {
        if (f.p1.value !== f.p2.value) { U.toast('Passwords do not match'); return false; }
        try { await Cloud.changePassword(f.p1.value); U.toast('Password changed'); } catch (err) { U.toast(err.code === 'auth/requires-recent-login' ? 'Please sign out and in again, then retry' : err.message); return false; }
      } });
    }
  });
  function setLocalAthlete(id) { localAthlete = id; ls.set('stc-athlete', id); }

  // ---------- cloud sign-in screens ----------
  function loginScreen(msg = '') {
    document.getElementById('tabs').innerHTML = ''; document.getElementById('roleSwitch').innerHTML = '';
    root.innerHTML = `<div class="login card"><h2>Sign in</h2>
      <p class="muted">Coaches, data entry, athletes and advisory committee members each have their own login. Ask the coach if you don't have one.</p>
      ${msg ? `<div class="notice">${U.esc(msg)}</div>` : ''}
      <form id="loginForm" class="form" style="grid-template-columns:1fr"><label>Username or email<input name="u" autocomplete="username" required></label>
        <label>Password<input type="password" name="p" autocomplete="current-password" required></label><button class="btn">Sign in</button></form>
      <details style="margin-top:16px"><summary>First-time setup (coach only)</summary>
        <p class="muted">Only works once, for the very first account. That account becomes the coach and can then create logins for everyone else.</p>
        <form id="setupForm" class="form" style="grid-template-columns:1fr"><label>Your name<input name="n" required></label><label>Username or email<input name="u" required></label>
          <label>Password (6+ characters)<input type="password" name="p" minlength="6" required></label><button class="btn ghost">Create coach account</button></form></details></div>`;
    U.$('#loginForm').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      try { await Cloud.signIn(f.u.value, f.p.value); } catch (err) { loginScreen(err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' ? 'Username or password is incorrect.' : err.message); }
    };
    U.$('#setupForm').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      ss.set('stc-setup-name', f.n.value);
      try { await Cloud.signUp(f.u.value, f.p.value); } catch (err) { if (err.code === 'auth/email-already-in-use') { try { await Cloud.signIn(f.u.value, f.p.value); } catch (e2) { loginScreen(e2.message); } } else loginScreen(err.message); }
    };
  }
  function noProfileScreen() {
    document.getElementById('tabs').innerHTML = '';
    document.getElementById('roleSwitch').innerHTML = '<button data-acct="signout">Sign out</button>';
    root.innerHTML = `<div class="login card"><h2>Waiting for access</h2>
      <p>You're signed in as <b>${U.esc(Cloud.user?.email || '')}</b>, but the coach hasn't given this login a role yet.</p>
      <details><summary>Setting up the site for the first time?</summary><p class="muted">If nobody has set up the coach account yet, you can claim it now.</p>
        <button class="btn" id="claim">Make me the coach</button></details></div>`;
    U.$('#claim').onclick = async () => {
      try { await Cloud.claimCoach(ss.get('stc-setup-name') || 'Head Coach'); } catch (err) { U.toast(err.code === 'permission-denied' ? 'A coach already exists — ask them to give you access.' : err.message); }
    };
  }

  // ---------- boot ----------
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = getComputedStyle(document.documentElement).fontFamily;
    Chart.defaults.color = '#5d6b82';
  }
  Store.load().then(() => {
    ready = true;
    if (!cloud) { render(); return; }
    root.innerHTML = '<div class="empty">Connecting…</div>';
    Cloud.init((evt) => {
      if (evt === 'signedOut') loginScreen();
      else if (evt === 'noProfile') noProfileScreen();
      else if (evt === 'signedIn') { root.innerHTML = '<div class="empty">Loading team data…</div>'; renderShell(); }
      else if (evt === 'data' || evt === 'users') softRender();
    }).catch((e) => { root.innerHTML = `<div class="card">${U.esc(e.message)} — check your internet connection and js/firebase-config.js.</div>`; });
  });

  return { commit, render, setLocalAthlete };
})();
