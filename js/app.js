/* App shell: roles, navigation, event wiring. */
(() => {
  const ROLE_TABS = {
    team: ['overview', 'schedule', 'athletes', 'attendance', 'crews', 'results'],
    coach: ['overview', 'schedule', 'athletes', 'attendance', 'crews', 'results', 'combos', 'report', 'data'],
    advisory: ['report', 'overview', 'schedule', 'results', 'crews', 'attendance', 'athletes'],
  };
  const LABELS = { overview: 'Team Info', schedule: 'Schedule & Calendar', athletes: 'Athletes & Fitness', attendance: 'Attendance', crews: 'Crews & Boats', results: 'Boat Progress & Records', combos: 'Combinations', report: 'Committee Report', data: 'Data & Settings' };
  const TEAM_LABELS = { athletes: 'My Progress' };

  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  let role = ls.get('stc-role') || 'team';
  let coachOk = false;
  try { coachOk = sessionStorage.getItem('stc-coach') === '1'; } catch { /* ignore */ }
  if (role === 'coach' && !coachOk) role = 'team';

  const root = document.getElementById('view');
  const currentTab = () => {
    const h = location.hash.slice(1);
    return ROLE_TABS[role].includes(h) ? h : ROLE_TABS[role][0];
  };
  const ctx = () => ({ role, coach: role === 'coach' });

  function renderShell() {
    U.$$('.role-switch button').forEach((b) => b.classList.toggle('active', b.dataset.role === role));
    const tab = currentTab();
    document.getElementById('tabs').innerHTML = ROLE_TABS[role].map((t) => `<a href="#${t}" class="${t === tab ? 'active' : ''}">${(role === 'team' && TEAM_LABELS[t]) || LABELS[t]}</a>`).join('');
    const st = Store.db.settings;
    document.getElementById('brandTitle').textContent = st.teamName;
    const days = st.regattaDate ? U.daysBetween(U.today(), st.regattaDate) : null;
    document.getElementById('countdown').innerHTML = days === null ? '' : days >= 0
      ? `<b>${days} days</b>to the ${U.esc(st.regattaName)}` : `<b>${U.esc(st.regattaName)}</b>${U.fmtDate(st.regattaDate)}`;
  }

  function render() {
    renderShell();
    Views.clearCharts();
    const view = Views[currentTab()];
    const y = window.scrollY;
    root.innerHTML = view.render(ctx());
    if (view.mount) view.mount(root, ctx());
    window.scrollTo(0, y);
  }

  // result: false → nothing, null → re-render only, true → save silently, string → save + toast
  async function run(name, el) {
    const view = Views[currentTab()];
    const fn = view.act && view.act[name];
    if (!fn) return;
    let r;
    try { r = await fn.call(view, el, ctx()); } catch (e) { console.error(e); U.toast('Something went wrong: ' + e.message); return; }
    if (r === false) return;
    if (r !== null) { Store.save(); if (typeof r === 'string') U.toast(r); }
    render();
  }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    e.preventDefault();
    run(el.dataset.act, el);
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    run(f.dataset.form, f);
  });
  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]'); if (!el) return;
    run(el.dataset.change, el);
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  // ---------- role switching ----------
  function askPin() {
    const m = document.getElementById('modalRoot');
    m.innerHTML = `<div class="modal-back"><form class="modal" id="pinForm"><h3>Coach access</h3>
      <p class="muted" style="margin-top:0">Enter the coach PIN to open the editing view.${Store.db.settings.demo ? ' (Demo PIN: 1234)' : ''}</p>
      <input type="password" name="pin" inputmode="numeric" autocomplete="off" autofocus required>
      <div class="btn-row" style="margin-top:12px"><button class="btn">Open coach view</button><button type="button" class="btn ghost" id="pinCancel">Cancel</button></div></form></div>`;
    const close = () => { m.innerHTML = ''; };
    U.$('#pinCancel').onclick = close;
    U.$('.modal-back').onclick = (e) => { if (e.target.classList.contains('modal-back')) close(); };
    U.$('#pinForm').onsubmit = (e) => {
      e.preventDefault();
      if (e.target.pin.value === String(Store.db.settings.coachPin)) {
        coachOk = true; try { sessionStorage.setItem('stc-coach', '1'); } catch { /* ignore */ }
        close(); setRole('coach');
      } else { U.toast('Incorrect PIN'); e.target.pin.value = ''; }
    };
    setTimeout(() => U.$('#pinForm input')?.focus(), 30);
  }
  function setRole(r) {
    if (r === 'coach' && !coachOk) return askPin();
    role = r; ls.set('stc-role', r);
    if (!ROLE_TABS[role].includes(location.hash.slice(1))) history.replaceState(null, '', '#' + ROLE_TABS[role][0]);
    render();
  }
  U.$$('.role-switch button').forEach((b) => { b.onclick = () => setRole(b.dataset.role); });

  // ---------- boot ----------
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = getComputedStyle(document.documentElement).fontFamily;
    Chart.defaults.color = '#5d6b82';
  }
  Store.load().then(render);
})();
