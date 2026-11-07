/* Transco Consolidation customer dashboard (no build step, vanilla JS + Leaflet). */
(() => {
  'use strict';

  // ---------------------------------------------------------------- state
  const state = {
    config: null,
    user: null,
    shipments: [],
    loaded: false,
    filter: 'active',
    search: '',
  };
  let maps = [];

  const $app = document.getElementById('app');
  const $modal = document.getElementById('modal-root');

  // ---------------------------------------------------------------- utils
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'transco-dashboard' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/auth/login' && path !== '/me') {
      state.user = null;
      render();
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  let toastTimer;
  function toast(msg, isErr = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `show${isErr ? ' err' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = ''), 3800);
  }

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  function relDays(iso) {
    if (!iso) return '';
    const d = Math.round((new Date(iso) - Date.now()) / 86400000);
    if (d === 0) return 'today';
    if (d === 1) return 'tomorrow';
    if (d === -1) return 'yesterday';
    return d > 0 ? `in ${d} days` : `${-d} days ago`;
  }
  function ago(iso) {
    if (!iso) return '';
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
  }

  const STATUS_CLASS = {
    BOOKED: 's-pre', GATE_IN: 's-pre', LOADED: 's-pre',
    IN_TRANSIT: 's-transit',
    TRANSSHIPMENT: 's-port',
    ARRIVED: 's-done', DISCHARGED: 's-done', GATE_OUT: 's-done', DELIVERED: 's-done',
    UNKNOWN: 's-unknown',
  };
  const statusClass = (s) => STATUS_CLASS[s] || 's-unknown';
  const pill = (t) => `<span class="pill ${statusClass(t.status)}">${esc(t.statusLabel || 'Unknown')}</span>`;
  const isDone = (t) => ['DELIVERED'].includes(t.status);
  const FREQ_LABEL = { change: 'When something changes', daily: 'Daily summary', weekly: 'Weekly summary' };

  const ICON = {
    ship: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15l1.5 4.5h15L21 15H3z"/><path d="M6 15V9h12v6"/><path d="M10 9V5h4v4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>',
    bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.7 21a2 2 0 01-3.4 0M18.6 13A17.9 17.9 0 0118 8M6.3 6.3A6 6 0 006 8c0 7-3 9-3 9h14M18 8a6 6 0 00-9.3-5M2 2l20 20"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  const LOGO = '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#163a5c"/><path d="M12 38h40l-6 10H18z" fill="#2fb5a8"/><rect x="18" y="24" width="12" height="11" rx="1.5" fill="#fff"/><rect x="32" y="24" width="12" height="11" rx="1.5" fill="#a5c4e0"/><rect x="25" y="13" width="12" height="10" rx="1.5" fill="#fff"/></svg>';

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function busy(btn, fn) {
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${ICON.refresh.replace('<svg', '<svg class="spin"')} Working…`;
    try {
      return await fn();
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  }

  // ---------------------------------------------------------------- router
  function route() {
    const h = location.hash.replace(/^#/, '') || '/';
    const m = h.match(/^\/shipment\/(\d+)/);
    if (m) return { name: 'shipment', id: Number(m[1]) };
    if (h.startsWith('/account')) return { name: 'account' };
    return { name: 'dashboard' };
  }
  window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });

  function clearMaps() {
    maps.forEach((m) => m.remove());
    maps = [];
  }

  function render() {
    clearMaps();
    if (!state.user) return renderAuth();
    const r = route();
    $app.innerHTML = shell(r);
    bindShell();
    if (!state.loaded) {
      document.getElementById('view').innerHTML = '<div class="empty">Loading your shipments…</div>';
      return;
    }
    if (r.name === 'shipment') return renderDetail(r.id);
    if (r.name === 'account') return renderAccount();
    return renderDashboard();
  }

  // ---------------------------------------------------------------- auth
  function renderAuth(mode = 'login', error = '') {
    const c = state.config;
    $app.innerHTML = `
    <div class="auth">
      <section class="auth-hero">
        <a class="brand" href="#/">${LOGO}<div><b>${esc(c.companyName)}</b><small>Customer portal</small></div></a>
        <div>
          <h1>Know where your cargo is, any time.</h1>
          <p>Follow every shipment you have with us in one place, from booking to delivery.</p>
          <ul>
            <li>${ICON.box}<div><b>Track &amp; trace</b><br>Container milestones, ETA and journey progress for each shipment.</div></li>
            <li>${ICON.map}<div><b>Live vessel position</b><br>See the vessel carrying your cargo on the map, with a link to MarineTraffic.</div></li>
            <li>${ICON.mail}<div><b>Email updates</b><br>Daily or weekly summaries, and an alert as soon as something changes.</div></li>
          </ul>
        </div>
        <small style="color:#7f9ab3">${c.supportEmail ? `Need help? <a style="color:#a5c4e0" href="mailto:${esc(c.supportEmail)}">${esc(c.supportEmail)}</a>` : '&nbsp;'}</small>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          <div class="tabs" role="tablist">
            <button role="tab" data-mode="login" class="${mode === 'login' ? 'active' : ''}" aria-selected="${mode === 'login'}">Sign in</button>
            <button role="tab" data-mode="register" class="${mode === 'register' ? 'active' : ''}" aria-selected="${mode === 'register'}">Create account</button>
          </div>
          ${mode === 'login' ? `
            <h2>Welcome back</h2>
            <p class="sub">Sign in to see your shipments.</p>
            ${error ? `<div class="error">${esc(error)}</div>` : ''}
            <form id="auth-form" novalidate>
              <label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" required autofocus></label>
              <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
              <button class="btn primary" type="submit">Sign in</button>
            </form>` : `
            <h2>Create your account</h2>
            <p class="sub">For ${esc(c.companyName)} customers.</p>
            ${error ? `<div class="error">${esc(error)}</div>` : ''}
            <form id="auth-form" novalidate>
              <div class="grid-2">
                <label class="field"><span>Your name</span><input type="text" name="name" autocomplete="name" required></label>
                <label class="field"><span>Company</span><input type="text" name="company" autocomplete="organization"></label>
              </div>
              <label class="field"><span>Work email</span><input type="email" name="email" autocomplete="email" required></label>
              <label class="field"><span>Password</span><input type="password" name="password" autocomplete="new-password" minlength="8" required><small>At least 8 characters.</small></label>
              ${c.signupRequiresCode ? '<label class="field"><span>Customer access code</span><input type="text" name="signupCode" required><small>Provided by your Transco account manager.</small></label>' : ''}
              <button class="btn primary" type="submit">Create account</button>
            </form>`}
        </div>
      </section>
    </div>`;

    $app.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => renderAuth(b.dataset.mode)));
    const form = document.getElementById('auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      try {
        const data = await busy(btn, () => api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: formData(form) }));
        state.user = data.user;
        state.loaded = false;
        render();
        await loadShipments();
      } catch (err) {
        const keep = formData(form);
        renderAuth(mode, err.message);
        const f = document.getElementById('auth-form');
        for (const [k, v] of Object.entries(keep)) if (k !== 'password' && f.elements[k]) f.elements[k].value = v;
      }
    });
  }

  // ---------------------------------------------------------------- shell
  function shell(r) {
    const u = state.user;
    return `
    <header class="topbar"><div class="inner">
      <a class="brand" href="#/">${LOGO}<div><b>${esc(state.config.companyName)}</b><small>Shipment tracking</small></div></a>
      <nav>
        <a href="#/" class="${r.name !== 'account' ? 'active' : ''}">Shipments</a>
        <a href="#/account" class="${r.name === 'account' ? 'active' : ''}">Account</a>
      </nav>
      <div class="spacer"></div>
      <div class="who"><b>${esc(u.name)}</b><small>${esc(u.company || u.email)}</small></div>
      <button class="btn ghost small" id="logout">Sign out</button>
    </div></header>
    <main id="view"></main>
    <div class="footer-note">
      ${state.config.trackingProvider === 'demo' ? 'Showing <b>demo tracking data</b>. ' : ''}
      Vessel positions ${state.config.marineTrafficLive ? 'from MarineTraffic AIS' : 'are estimated from the voyage schedule'}.
      ${state.config.supportEmail ? ` · Questions? <a href="mailto:${esc(state.config.supportEmail)}">${esc(state.config.supportEmail)}</a>` : ''}
    </div>`;
  }

  function bindShell() {
    document.getElementById('logout').addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => {});
      state.user = null;
      state.shipments = [];
      state.loaded = false;
      location.hash = '#/';
      render();
    });
  }

  async function loadShipments() {
    try {
      const data = await api('/shipments');
      state.shipments = data.shipments;
      state.loaded = true;
      render();
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ---------------------------------------------------------------- map
  function vesselIcon(course, moving) {
    const color = moving ? '#1d4ed8' : '#b45309';
    const svg = moving
      ? `<svg width="26" height="26" viewBox="0 0 26 26" style="transform:rotate(${course || 0}deg)"><path d="M13 2l7 20-7-4-7 4z" fill="${color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`;
    const size = moving ? 26 : 20;
    return L.divIcon({ className: 'vessel-icon', html: svg, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  function makeMap(el) {
    if (typeof L === 'undefined') {
      el.innerHTML = '<div class="empty">Map could not load. Check your internet connection.</div>';
      return null;
    }
    const map = L.map(el, { worldCopyJump: true, scrollWheelZoom: false, minZoom: 2 }).setView([18, 70], 3);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 12,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    maps.push(map);
    return map;
  }

  function popupHtml(s) {
    const t = s.tracking;
    const p = t.vesselPosition;
    return `<div class="map-pop">
      <b>${esc(s.label || s.reference)}</b>
      <span>${esc(t.vessel?.name || 'Vessel')}${p?.speed != null ? ` · ${p.speed.toFixed(1)} kn` : ''}${p?.navStatus ? ` · ${esc(p.navStatus)}` : ''}</span><br>
      <span>${esc(t.statusLabel)} · ETA ${fmtDate(t.eta)}</span><br>
      <a href="#/shipment/${s.id}">View shipment</a>
      ${t.links?.marineTraffic ? ` · <a href="${esc(t.links.marineTraffic)}" target="_blank" rel="noopener">MarineTraffic</a>` : ''}
    </div>`;
  }

  function drawShipment(map, s, { focus = false } = {}) {
    const t = s.tracking;
    const bounds = [];
    const color = t.status === 'IN_TRANSIT' ? '#1d4ed8' : isDone(t) ? '#15803d' : '#0f8f84';
    if (t.route?.length) {
      L.polyline(t.route, { color, weight: focus ? 3 : 2, opacity: focus ? 0.8 : 0.45, dashArray: focus ? null : '6 6' }).addTo(map);
      if (focus) bounds.push(...t.route);
    }
    for (const port of [t.origin, t.destination, ...(t.transshipment || [])]) {
      if (port?.lat == null) continue;
      L.circleMarker([port.lat, port.lon], { radius: 5, color: '#0f2b46', weight: 2, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(esc(port.name), { direction: 'top' })
        .addTo(map);
      bounds.push([port.lat, port.lon]);
    }
    const p = t.vesselPosition;
    if (p?.lat != null && !isDone(t)) {
      const moving = (p.speed || 0) > 0.5;
      L.marker([p.lat, p.lon], { icon: vesselIcon(p.course, moving), zIndexOffset: 500 })
        .bindPopup(popupHtml(s))
        .addTo(map);
      bounds.push([p.lat, p.lon]);
    }
    return bounds;
  }

  // ---------------------------------------------------------------- dashboard
  function counts() {
    const list = state.shipments;
    const soon = Date.now() + 7 * 86400000;
    return {
      total: list.length,
      transit: list.filter((s) => ['IN_TRANSIT', 'TRANSSHIPMENT'].includes(s.tracking.status)).length,
      arriving: list.filter((s) => s.tracking.eta && !['ARRIVED', 'DISCHARGED', 'GATE_OUT', 'DELIVERED'].includes(s.tracking.status) && new Date(s.tracking.eta) <= soon).length,
      delivered: list.filter((s) => isDone(s.tracking)).length,
      alerts: list.filter((s) => s.notify.enabled).length,
    };
  }

  function filtered() {
    const q = state.search.trim().toLowerCase();
    return state.shipments
      .filter((s) => (state.filter === 'all' ? true : state.filter === 'done' ? isDone(s.tracking) : !isDone(s.tracking)))
      .filter((s) => !q || [s.reference, s.label, s.tracking.vessel?.name, s.tracking.origin?.name, s.tracking.destination?.name, s.tracking.carrierName]
        .some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => new Date(a.tracking.eta || 8.64e15) - new Date(b.tracking.eta || 8.64e15));
  }

  function rowHtml(s) {
    const t = s.tracking;
    const pct = Math.round((t.progress || 0) * 100);
    const bar = statusClass(t.status).replace('s-', 's-') + '-bar';
    return `
    <a class="row" href="#/shipment/${s.id}">
      <div>
        <div class="ttl">${esc(s.label || s.reference)}</div>
        <div class="ref">${esc(s.reference)} · ${esc(t.carrierName)}</div>
      </div>
      <div class="col-route">
        <div class="route">${t.origin ? `${esc(t.origin.name)} ${ICON.arrow} ${esc(t.destination?.name)}` : `<span class="muted">${esc(t.error || 'Waiting for first tracking update')}</span>`}</div>
        ${t.vessel?.name ? `<div class="vessel-line">${esc(t.vessel.name)}${t.vessel.voyage ? ` · ${esc(t.vessel.voyage)}` : ''}</div>` : ''}
      </div>
      <div>${pill(t)}</div>
      <div class="eta col-eta"><b>${fmtDate(t.eta)}</b><span>${t.eta ? `ETA ${relDays(t.eta)}` : ''}</span></div>
      <div class="col-progress"><span class="muted" style="font-size:12.5px">${pct}% complete</span><div class="progress"><div class="${bar}" style="width:${pct}%"></div></div></div>
      <div class="bell ${s.notify.enabled ? 'on' : ''}" title="${s.notify.enabled ? `Email: ${FREQ_LABEL[s.notify.frequency]}` : 'Email updates off'}">${s.notify.enabled ? ICON.bell : ICON.bellOff}</div>
    </a>`;
  }

  function renderDashboard() {
    const view = document.getElementById('view');
    const c = counts();
    const first = state.user.name.split(' ')[0];

    if (!state.shipments.length) {
      view.innerHTML = `
        <div class="page-head"><div><h1>Hello, ${esc(first)}</h1><p>Your shipment dashboard</p></div></div>
        <div class="card empty">
          ${ICON.box}
          <h3>Add your first shipment</h3>
          <p>Enter a container number, booking or bill of lading number. We will show where it is, track the vessel and email you updates.</p>
          <button class="btn primary" id="add-first">${ICON.plus} Add shipment</button>
        </div>`;
      document.getElementById('add-first').addEventListener('click', openAddModal);
      return;
    }

    view.innerHTML = `
      <div class="page-head">
        <div><h1>Hello, ${esc(first)}</h1><p>${c.total} shipment${c.total === 1 ? '' : 's'} on your dashboard · updated ${ago(state.shipments[0]?.tracking.fetchedAt)}</p></div>
        <div class="actions">
          <button class="btn" id="refresh-all">${ICON.refresh} Refresh</button>
          <button class="btn primary" id="add">${ICON.plus} Add shipment</button>
        </div>
      </div>
      <div class="kpis">
        <div class="card kpi"><div class="label">Following</div><div class="value">${c.total}</div></div>
        <div class="card kpi"><div class="label">At sea</div><div class="value">${c.transit}</div></div>
        <div class="card kpi"><div class="label">Arriving ≤ 7 days</div><div class="value">${c.arriving}</div></div>
        <div class="card kpi"><div class="label">Delivered</div><div class="value">${c.delivered}</div></div>
        <div class="card kpi"><div class="label">Email updates on</div><div class="value">${c.alerts}<small>of ${c.total}</small></div></div>
      </div>
      <div class="map" id="map" role="region" aria-label="Map of vessels carrying your shipments"></div>
      <div class="card" style="margin-top:18px">
        <div class="list-head">
          <h3>Shipments</h3>
          <div class="filters" role="tablist">
            ${[['active', 'Active'], ['done', 'Delivered'], ['all', 'All']].map(([k, l]) => `<button data-f="${k}" class="${state.filter === k ? 'active' : ''}">${l}</button>`).join('')}
          </div>
          <label class="search">${ICON.search}<span class="sr-only">Search shipments</span><input type="text" id="q" placeholder="Search reference, vessel, port…" value="${esc(state.search)}"></label>
        </div>
        <div class="rows" id="rows"></div>
      </div>`;

    const drawRows = () => {
      const list = filtered();
      document.getElementById('rows').innerHTML = list.length
        ? list.map(rowHtml).join('')
        : '<div class="empty" style="padding:32px">No shipments match.</div>';
    };
    drawRows();

    const map = makeMap(document.getElementById('map'));
    if (map) {
      const bounds = [];
      state.shipments.filter((s) => !isDone(s.tracking)).forEach((s) => bounds.push(...drawShipment(map, s)));
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
      else if (bounds.length === 1) map.setView(bounds[0], 4);
    }

    view.querySelectorAll('.filters button').forEach((b) => b.addEventListener('click', () => {
      state.filter = b.dataset.f;
      view.querySelectorAll('.filters button').forEach((x) => x.classList.toggle('active', x === b));
      drawRows();
    }));
    document.getElementById('q').addEventListener('input', (e) => { state.search = e.target.value; drawRows(); });
    document.getElementById('add').addEventListener('click', openAddModal);
    document.getElementById('refresh-all').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      await Promise.all(state.shipments.map((s) => api(`/shipments/${s.id}/refresh`, { method: 'POST' }).catch(() => null)));
      await loadShipments();
      toast('Tracking refreshed');
    }));
  }

  // ---------------------------------------------------------------- detail
  async function renderDetail(id) {
    const view = document.getElementById('view');
    let s = state.shipments.find((x) => x.id === id);
    if (!s) {
      try {
        s = (await api(`/shipments/${id}`)).shipment;
      } catch {
        view.innerHTML = `<a class="back" href="#/">${ICON.back} All shipments</a><div class="card empty"><h3>Shipment not found</h3><p>It may have been removed from your dashboard.</p></div>`;
        return;
      }
    }
    const t = s.tracking;
    const p = t.vesselPosition;
    const pct = Math.round((t.progress || 0) * 100);
    const events = t.events || [];
    const lastActualIdx = events.reduce((acc, e, i) => (e.actual ? i : acc), -1);

    view.innerHTML = `
      <a class="back" href="#/">${ICON.back} All shipments</a>
      <div class="page-head">
        <div>
          <h1>${esc(s.label || s.reference)} ${pill(t)}</h1>
          <p><span class="mono">${esc(s.reference)}</span> · ${esc(t.carrierName)} · ${s.refType === 'container' ? 'Container' : 'Booking / B/L'}</p>
        </div>
        <div class="actions">
          <button class="btn" id="refresh">${ICON.refresh} Refresh</button>
          <button class="btn" id="edit">Edit details</button>
        </div>
      </div>

      <div class="detail-grid">
        <div class="stack">
          <div class="card">
            <div class="summary">
              <div><div class="k">From</div><div class="v">${esc(t.origin?.name || '—')}<small>ETD ${fmtDate(t.etd)}</small></div></div>
              <div><div class="k">To</div><div class="v">${esc(t.destination?.name || '—')}<small>${t.transshipment?.length ? `via ${esc(t.transshipment.map((x) => x.name).join(', '))}` : 'Direct'}</small></div></div>
              <div><div class="k">ETA</div><div class="v">${fmtDate(t.eta)}<small>${relDays(t.eta)}</small></div></div>
              <div><div class="k">Last update</div><div class="v">${t.lastEvent ? esc(t.lastEvent.description) : '—'}<small>${t.lastEvent ? `${esc(t.lastEvent.location)} · ${fmtDateTime(t.lastEvent.time)}` : ''}</small></div></div>
            </div>
            <div class="journey">
              <div class="journey-bar"><span>${esc(t.origin?.code || 'Origin')}</span><div class="progress"><div class="${statusClass(t.status)}-bar" style="width:${pct}%"></div></div><span>${esc(t.destination?.code || 'Destination')}</span></div>
              <div class="muted" style="font-size:12.5px;margin-top:6px">${pct}% of the journey complete</div>
            </div>
          </div>

          <div class="map tall" id="map" role="region" aria-label="Map of this shipment's route and vessel"></div>

          <div class="card card-pad">
            <h3>Vessel</h3>
            ${t.vessel ? `
            <dl class="kv">
              <dt>Name</dt><dd>${esc(t.vessel.name || '—')}${t.vessel.voyage ? ` <span class="muted">· voyage ${esc(t.vessel.voyage)}</span>` : ''}</dd>
              ${t.vessel.imo ? `<dt>IMO</dt><dd class="mono">${esc(t.vessel.imo)}</dd>` : ''}
              ${t.vessel.mmsi ? `<dt>MMSI</dt><dd class="mono">${esc(t.vessel.mmsi)}</dd>` : ''}
              ${p?.lat != null ? `
                <dt>Position</dt><dd>${p.lat.toFixed(3)}°, ${p.lon.toFixed(3)}°</dd>
                <dt>Speed / course</dt><dd>${p.speed != null ? `${p.speed.toFixed(1)} kn` : '—'} / ${p.course != null ? `${Math.round(p.course)}°` : '—'}</dd>
                ${p.navStatus ? `<dt>Status</dt><dd>${esc(p.navStatus)}</dd>` : ''}
                ${p.destination ? `<dt>AIS destination</dt><dd>${esc(p.destination)}</dd>` : ''}
                <dt>Position time</dt><dd>${fmtDateTime(p.timestamp)} <span class="muted">(${ago(p.timestamp)})</span></dd>` : ''}
            </dl>` : '<p class="muted">No vessel assigned yet.</p>'}
            ${p?.source && p.source !== 'marinetraffic' ? `<div class="notice">${ICON.info}<div>This position is estimated from the voyage schedule. ${t.vessel?.imo || t.vessel?.mmsi ? '' : 'Add the vessel IMO or MMSI number under <b>Edit details</b> to link the exact ship. '}Live AIS positions appear here when MarineTraffic is connected.</div></div>` : ''}
            <div class="links">
              ${t.links?.marineTraffic ? `<a class="btn small" href="${esc(t.links.marineTraffic)}" target="_blank" rel="noopener">${ICON.ext} View vessel on MarineTraffic</a>` : ''}
              ${t.links?.transco ? `<a class="btn small" href="${esc(t.links.transco)}" target="_blank" rel="noopener">${ICON.ext} Transco track &amp; trace</a>` : ''}
              ${t.links?.carrier ? `<a class="btn small" href="${esc(t.links.carrier)}" target="_blank" rel="noopener">${ICON.ext} ${esc(t.carrierName)} tracking</a>` : ''}
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="card card-pad" id="notify-card"></div>
          <div class="card card-pad">
            <h3>Tracking history</h3>
            ${t.error ? `<div class="error">${esc(t.error)}</div>` : ''}
            ${events.length ? `<ol class="timeline">${events.map((e, i) => `
              <li class="${e.actual ? 'done' : 'future'} ${i === lastActualIdx ? 'current' : ''}">
                <span class="dot"></span>
                <div class="t-title">${esc(e.description)}${e.actual ? '' : '<span class="est">Planned</span>'}</div>
                <div class="t-meta">${esc(e.location)} · ${fmtDateTime(e.time)}${e.vessel && !e.description.includes(e.vessel) ? ` · ${esc(e.vessel)}` : ''}</div>
              </li>`).join('')}</ol>` : '<p class="muted">No tracking events yet.</p>'}
            <div class="muted" style="font-size:12.5px">Checked ${ago(t.fetchedAt)}${t.source === 'demo' ? ' · demo data' : ''}</div>
          </div>
          <div class="card card-pad">
            <h3>Remove shipment</h3>
            <p class="muted" style="margin:0 0 12px;font-size:14px">Takes it off your dashboard and stops its emails.</p>
            <button class="btn danger" id="remove">Remove from dashboard</button>
          </div>
        </div>
      </div>`;

    renderNotifyCard(s);

    const map = makeMap(document.getElementById('map'));
    if (map) {
      const bounds = drawShipment(map, s, { focus: true });
      if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
    }

    document.getElementById('refresh').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      const { shipment } = await api(`/shipments/${s.id}/refresh`, { method: 'POST' });
      upsert(shipment);
      render();
      toast('Tracking refreshed');
    }));
    document.getElementById('edit').addEventListener('click', () => openEditModal(s));
    document.getElementById('remove').addEventListener('click', async () => {
      if (!confirm(`Remove ${s.label || s.reference} from your dashboard? Its email updates will stop.`)) return;
      try {
        await api(`/shipments/${s.id}`, { method: 'DELETE' });
        state.shipments = state.shipments.filter((x) => x.id !== s.id);
        location.hash = '#/';
        toast('Shipment removed');
      } catch (err) { toast(err.message, true); }
    });
  }

  function upsert(shipment) {
    const i = state.shipments.findIndex((x) => x.id === shipment.id);
    if (i >= 0) state.shipments[i] = shipment;
    else state.shipments.unshift(shipment);
  }

  function notifyFields(n, userEmail) {
    return `
      <div class="toggle">
        <div><b>Email me updates</b><span>Sent to ${esc(n.email || userEmail)}</span></div>
        <label class="switch"><input type="checkbox" name="enabled" ${n.enabled ? 'checked' : ''}><i></i><span class="sr-only">Email updates</span></label>
      </div>
      <fieldset ${n.enabled ? '' : 'disabled'}>
        <div class="freq" role="radiogroup" aria-label="How often">
          <label><input type="radio" name="frequency" value="change" ${n.frequency === 'change' ? 'checked' : ''}><div><b>Only when something changes</b><span>Status, ETA or a new tracking event</span></div></label>
          <label><input type="radio" name="frequency" value="daily" ${n.frequency === 'daily' ? 'checked' : ''}><div><b>Daily summary</b><span>One email a day with where it is now</span></div></label>
          <label><input type="radio" name="frequency" value="weekly" ${n.frequency === 'weekly' ? 'checked' : ''}><div><b>Weekly summary</b><span>One email a week</span></div></label>
        </div>
        <label class="check" data-onchange ${n.frequency === 'change' ? 'hidden' : ''}><input type="checkbox" name="onChange" ${n.onChange ? 'checked' : ''}><span>Also email me straight away when the status or ETA changes</span></label>
        <label class="field"><span>Send to a different email <span class="muted">(optional)</span></span><input type="email" name="email" placeholder="${esc(userEmail)}" value="${esc(n.email || '')}"><small>For example your logistics team's shared inbox.</small></label>
      </fieldset>`;
  }

  function wireNotifyFields(root) {
    const enabled = root.querySelector('input[name=enabled]');
    const fs = root.querySelector('fieldset');
    const onChange = root.querySelector('[data-onchange]');
    enabled.addEventListener('change', () => (fs.disabled = !enabled.checked));
    root.querySelectorAll('input[name=frequency]').forEach((r) => r.addEventListener('change', () => (onChange.hidden = r.value === 'change' && r.checked)));
  }

  function readNotify(root) {
    return {
      enabled: root.querySelector('input[name=enabled]').checked,
      frequency: root.querySelector('input[name=frequency]:checked')?.value || 'daily',
      onChange: root.querySelector('input[name=onChange]').checked,
      email: root.querySelector('input[name=email]').value.trim(),
    };
  }

  function renderNotifyCard(s) {
    const card = document.getElementById('notify-card');
    card.innerHTML = `
      <h3>${ICON.mail.replace('<svg', '<svg width="18" height="18" style="vertical-align:-3px;margin-right:6px"')}Email updates</h3>
      <form id="notify-form">
        ${notifyFields(s.notify, state.user.email)}
        <div class="btn-row">
          <button class="btn primary" type="submit">Save</button>
          <button class="btn" type="button" id="test-email">Send me one now</button>
        </div>
        ${s.notify.lastSentAt ? `<div class="hint">Last email sent ${fmtDateTime(s.notify.lastSentAt)}</div>` : ''}
      </form>`;
    const form = document.getElementById('notify-form');
    wireNotifyFields(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      try {
        const { shipment } = await busy(btn, () => api(`/shipments/${s.id}`, { method: 'PATCH', body: { notify: readNotify(form) } }));
        upsert(shipment);
        renderNotifyCard(shipment);
        toast(shipment.notify.enabled ? `Saved: ${FREQ_LABEL[shipment.notify.frequency].toLowerCase()}` : 'Email updates turned off');
      } catch (err) { toast(err.message, true); }
    });
    document.getElementById('test-email').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try {
        const r = await api(`/shipments/${s.id}/test-email`, { method: 'POST' });
        toast(r.delivered ? `Update sent to ${r.to}` : `Email created for ${r.to} (email server not set up yet, saved to outbox)`);
      } catch (err) { toast(err.message, true); }
    }));
  }

  // ---------------------------------------------------------------- modals
  function openModal(html, onMount) {
    $modal.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const back = $modal.querySelector('.modal-back');
    back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
    $modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    document.addEventListener('keydown', escClose);
    onMount($modal.querySelector('.modal'));
    $modal.querySelector('input, select')?.focus();
  }
  function escClose(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() {
    $modal.innerHTML = '';
    document.removeEventListener('keydown', escClose);
  }

  function carrierOptions(selected) {
    return `<option value="">Detect from container number</option>${state.config.carriers.map((c) => `<option value="${c.code}" ${c.code === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="OTHER" ${selected === 'OTHER' ? 'selected' : ''}>Other / not sure</option>`;
  }

  // Mirrors the server-side ISO 6346 check so customers get instant feedback.
  function checkContainer(ref) {
    if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(ref)) return null;
    const vals = {};
    let v = 10;
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') { if (v % 11 === 0) v++; vals[ch] = v++; }
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (/\d/.test(ref[i]) ? Number(ref[i]) : vals[ref[i]]) * 2 ** i;
    return (sum % 11) % 10 === Number(ref[10]);
  }

  function openAddModal() {
    openModal(`
      <form id="add-form" novalidate>
        <header><h2>Add a shipment</h2><button class="btn ghost small" type="button" data-close aria-label="Close">${ICON.x}</button></header>
        <div class="body">
          <div id="add-error"></div>
          <label class="field"><span>Container, booking or B/L number</span>
            <input type="text" name="reference" class="mono" placeholder="e.g. MSCU1234566" autocomplete="off" required>
            <small id="ref-hint">Find it on your booking confirmation or bill of lading.</small></label>
          <div class="grid-2">
            <label class="field"><span>Shipping line</span><select name="carrier">${carrierOptions('')}</select></label>
            <label class="field"><span>Your reference <span class="muted">(optional)</span></span><input type="text" name="label" placeholder="e.g. PO 4521 – Garments" maxlength="80"></label>
          </div>
          <details class="more"><summary>Vessel IMO / MMSI (optional)</summary>
            <div class="grid-2">
              <label class="field"><span>IMO number</span><input type="text" name="vesselImo" inputmode="numeric" maxlength="7" placeholder="7 digits"></label>
              <label class="field"><span>MMSI number</span><input type="text" name="vesselMmsi" inputmode="numeric" maxlength="9" placeholder="9 digits"></label>
            </div>
            <small class="hint" style="margin:-6px 0 12px">Only needed if you want to pin the exact vessel on MarineTraffic. Otherwise we use the vessel from track &amp; trace.</small>
          </details>
          <div class="section-title">Email updates</div>
          <div id="add-notify">${notifyFields({ enabled: true, frequency: 'daily', onChange: true, email: '' }, state.user.email)}</div>
        </div>
        <footer><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">${ICON.plus} Add to dashboard</button></footer>
      </form>`, (root) => {
      const form = root.querySelector('form');
      wireNotifyFields(root.querySelector('#add-notify'));
      const ref = form.elements.reference;
      const hint = root.querySelector('#ref-hint');
      ref.addEventListener('input', () => {
        const v = ref.value.toUpperCase().replace(/[\s-]/g, '');
        const ok = checkContainer(v);
        if (ok === true) { hint.textContent = '✓ Valid container number'; hint.className = 'hint good'; }
        else if (ok === false) { hint.textContent = 'This container number’s check digit does not match. Please check it.'; hint.className = 'hint bad'; }
        else if (/^[A-Z]{4}\d{7}$/.test(v)) { hint.textContent = 'Container numbers have U, J or Z as the 4th letter.'; hint.className = 'hint bad'; }
        else { hint.textContent = v.length >= 4 ? 'Booking or bill of lading number' : 'Find it on your booking confirmation or bill of lading.'; hint.className = 'hint'; }
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = formData(form);
        const btn = form.querySelector('button[type=submit]');
        try {
          const { shipment } = await busy(btn, () => api('/shipments', {
            method: 'POST',
            body: { reference: d.reference, carrier: d.carrier || undefined, label: d.label, vesselImo: d.vesselImo, vesselMmsi: d.vesselMmsi, notify: readNotify(root.querySelector('#add-notify')) },
          }));
          upsert(shipment);
          closeModal();
          location.hash = `#/shipment/${shipment.id}`;
          toast(shipment.notify.enabled ? `Added. We'll email ${shipment.notify.email || state.user.email} with updates.` : 'Shipment added');
        } catch (err) {
          root.querySelector('#add-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
        }
      });
    });
  }

  function openEditModal(s) {
    openModal(`
      <form id="edit-form" novalidate>
        <header><h2>Edit shipment</h2><button class="btn ghost small" type="button" data-close aria-label="Close">${ICON.x}</button></header>
        <div class="body">
          <div id="edit-error"></div>
          <label class="field"><span>Reference</span><input type="text" class="mono" value="${esc(s.reference)}" disabled><small>To track a different number, add it as a new shipment.</small></label>
          <div class="grid-2">
            <label class="field"><span>Shipping line</span><select name="carrier">${carrierOptions(s.carrier)}</select></label>
            <label class="field"><span>Your reference</span><input type="text" name="label" maxlength="80" value="${esc(s.label || '')}"></label>
            <label class="field"><span>Vessel IMO</span><input type="text" name="vesselImo" inputmode="numeric" maxlength="7" value="${esc(s.vesselImo || '')}" placeholder="7 digits"></label>
            <label class="field"><span>Vessel MMSI</span><input type="text" name="vesselMmsi" inputmode="numeric" maxlength="9" value="${esc(s.vesselMmsi || '')}" placeholder="9 digits"></label>
          </div>
          <small class="hint">Leave the vessel numbers empty to use the vessel reported by track &amp; trace.</small>
        </div>
        <footer><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></footer>
      </form>`, (root) => {
      const form = root.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = formData(form);
        try {
          const { shipment } = await busy(form.querySelector('button[type=submit]'), () => api(`/shipments/${s.id}`, {
            method: 'PATCH',
            body: { carrier: d.carrier || 'OTHER', label: d.label, vesselImo: d.vesselImo, vesselMmsi: d.vesselMmsi },
          }));
          upsert(shipment);
          closeModal();
          render();
          toast('Shipment updated');
        } catch (err) {
          root.querySelector('#edit-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
        }
      });
    });
  }

  // ---------------------------------------------------------------- account
  function renderAccount() {
    const u = state.user;
    const view = document.getElementById('view');
    view.innerHTML = `
      <div class="page-head"><div><h1>Account</h1><p>${esc(u.email)}</p></div></div>
      <div class="detail-grid">
        <div class="stack">
          <form class="card card-pad" id="profile">
            <h3>Your details</h3>
            <div class="grid-2">
              <label class="field"><span>Name</span><input type="text" name="name" value="${esc(u.name)}" required></label>
              <label class="field"><span>Company</span><input type="text" name="company" value="${esc(u.company || '')}"></label>
            </div>
            <button class="btn primary" type="submit">Save details</button>
          </form>
          <form class="card card-pad" id="password">
            <h3>Change password</h3>
            <div class="grid-2">
              <label class="field"><span>Current password</span><input type="password" name="currentPassword" autocomplete="current-password" required></label>
              <label class="field"><span>New password</span><input type="password" name="newPassword" autocomplete="new-password" minlength="8" required></label>
            </div>
            <button class="btn primary" type="submit">Change password</button>
          </form>
        </div>
        <div class="card card-pad">
          <h3>Your email updates</h3>
          ${state.shipments.length ? `<dl class="kv">${state.shipments.map((s) => `<dt><a href="#/shipment/${s.id}">${esc(s.label || s.reference)}</a></dt><dd>${s.notify.enabled ? `${FREQ_LABEL[s.notify.frequency]}${s.notify.frequency !== 'change' && s.notify.onChange ? ' + changes' : ''}` : '<span class="muted">Off</span>'}</dd>`).join('')}</dl>
          <p class="hint" style="margin-top:14px">Open a shipment to change how often you hear about it. Shipments with the same email address are combined into one email.</p>` : '<p class="muted">No shipments yet.</p>'}
        </div>
      </div>`;

    document.getElementById('profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const { user } = await busy(e.target.querySelector('button'), () => api('/me', { method: 'PATCH', body: formData(e.target) }));
        state.user = user;
        render();
        toast('Details saved');
      } catch (err) { toast(err.message, true); }
    });
    document.getElementById('password').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await busy(e.target.querySelector('button'), () => api('/me', { method: 'PATCH', body: formData(e.target) }));
        e.target.reset();
        toast('Password changed');
      } catch (err) { toast(err.message, true); }
    });
  }

  // ---------------------------------------------------------------- boot
  (async function boot() {
    try {
      state.config = await api('/config');
    } catch {
      $app.innerHTML = '<div class="boot">The tracking service is not reachable right now. Please try again shortly.</div>';
      return;
    }
    document.title = `${state.config.companyName} · Shipment Tracking`;
    try {
      state.user = (await api('/me')).user;
    } catch {
      state.user = null;
    }
    render();
    if (state.user) await loadShipments();

    // Keep the dashboard current while it is open.
    setInterval(() => {
      if (state.user && !document.hidden && !$modal.innerHTML && route().name !== 'account') loadShipments();
    }, 5 * 60 * 1000);
  })();
})();
