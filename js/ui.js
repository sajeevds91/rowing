/* Shared view helpers + UI state. Views register themselves on the global `Views`. */
const Views = {};
const UI = (() => {
  const { esc, fmtTime, round } = U;
  const S = Store;

  const state = {
    week: U.mondayOf(U.today()),
    month: U.today().slice(0, 7),
    day: U.today(),
    athleteId: null,
    eventId: 'ev4A',
    entryDate: U.today(),
    resultFilter: '',
    comboEvent: 'ev4A',
    editAthlete: null,
    bulkType: 'erg2k',
    crewFilter: '',
    raceFilter: '',
    suggestions: null,
  };

  // ---------- charts ----------
  const charts = [];
  const COLORS = ['#0b1f4b', '#1f6fd1', '#5aa9ff', '#7b3fe4', '#c27a00', '#1a8a4a', '#c8312e', '#0f9fa8', '#d6409f', '#5d6b82'];
  function chart(id, cfg) {
    const el = document.getElementById(id); if (!el || typeof Chart === 'undefined') return;
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: {} }, cfg.options || {});
    cfg.options.plugins.legend = Object.assign({ position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, cfg.options.plugins.legend || {});
    charts.push(new Chart(el, cfg));
  }
  const clearCharts = () => charts.splice(0).forEach((c) => c.destroy());
  const timeTicks = { callback: (v) => fmtTime(v, Number.isInteger(v) ? 0 : 1) };
  const timeTooltip = { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw === null ? '—' : fmtTime(c.raw)}` } };

  // ---------- builders ----------
  const avatar = (a, size = 34) => (a?.photo ? `<img class="avatar" style="width:${size}px;height:${size}px" src="${a.photo}" alt="">` : `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${size / 2.6}px">${esc(U.initials(a?.name))}</span>`);
  const kpi = (label, value, delta = '', cls = '') => `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="delta ${cls}">${delta}</div></div>`;
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(label)}</option>`;
  const athleteOptions = (sel, filter = () => true, blank = '— select —') => `<option value="">${blank}</option>` + S.db.athletes.filter(filter).map((a) => opt(a.id, a.name, sel)).join('');
  const eventOptions = (sel) => S.db.events.map((e) => opt(e.id, `${e.code} · ${e.name}`, sel)).join('');
  const distanceOptions = (sel) => U.DISTANCES.map((d) => opt(d.m, d.label, sel)).join('');
  const roleCard = (title, body, tag = 'Coach') => `<div class="card coach-only"><div class="card-head"><h3>${title}</h3><span class="spacer"></span><span class="coach-tag">${tag}</span></div>${body}</div>`;
  const empty = (t) => `<div class="empty">${t}</div>`;
  const canRow = (a) => !S.isCox(a);
  const canCox = (a) => a.skills?.includes('cox');
  function gapBadge(sum) {
    if (!sum || !sum.count) return '<span class="badge">No tests yet</span>';
    if (sum.ev.record == null) return '<span class="badge">No record set</span>';
    const pct = (sum.gapBest / sum.ev.record) * 100;
    if (pct <= 0) return '<span class="badge good">Record pace</span>';
    if (pct <= 2) return '<span class="badge good">Within 2%</span>';
    if (pct <= 5) return '<span class="badge warn">Within 5%</span>';
    return `<span class="badge bad">${round(pct, 1)}% off</span>`;
  }
  const delta = (v, lowerBetter = true, fmt = (x) => x) => {
    if (v === null || v === undefined || isNaN(v) || Math.abs(v) < 1e-9) return '<span class="flat">no change</span>';
    const good = lowerBetter ? v < 0 : v > 0;
    return `<span class="${good ? 'up' : 'down'}">${v > 0 ? '▲' : '▼'} ${fmt(Math.abs(v))}</span>`;
  };
  const metricFmt = (type, v) => (v === null || v === undefined ? '—' : S.METRICS[type].unit === 'time' ? fmtTime(v) : `${v} ${S.METRICS[type].unit}`);
  const crewNames = (evId) => { const c = S.db.crews[evId]; if (!c) return '—'; return c.seats.filter(Boolean).map(S.short).join(', ') + (c.cox ? ` · cox ${S.short(c.cox)}` : ''); };
  const crewCodes = (ids) => (ids && ids.length ? ids.map((id) => S.event(id)?.code || '?').join(', ') : 'Whole squad');
  const daysToRegatta = () => (S.db.settings.regattaDate ? U.daysBetween(U.today(), S.db.settings.regattaDate) : null);
  const seatLabel = (ev, i) => (ev.seats === 1 ? 'Sculler' : i === 0 ? 'Bow' : i === ev.seats - 1 ? 'Stroke' : `Seat ${i + 1}`);
  const placeText = (r) => (Number(r.placing) === 1 ? '<span class="badge good">Won</span>' : `<span class="badge bad">${ordinal(r.placing)}${r.field ? ' / ' + r.field : ''}</span>`);
  const ordinal = (n) => { n = Number(n); const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  // ---------- modal ----------
  function modal(html, { onSubmit, wide } = {}) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `<div class="modal-back"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelector('.modal-back').addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-back')) close(); });
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    const f = root.querySelector('form');
    if (f && onSubmit) f.addEventListener('submit', async (e) => { e.preventDefault(); const r = await onSubmit(f, e.submitter); if (r !== false) close(); });
    return { root, close };
  }

  // ---------- schedule checks ----------
  // warnings for a session: outside the after-school window, or clashing with another session for the same crew
  function sessionWarnings(s, all) {
    const st = S.db.settings; const w = [];
    const a = U.minutes(s.start), b = U.minutes(s.end);
    if (s.type === 'rest' || a === null) return w;
    if (b !== null && b <= a) w.push('ends before it starts');
    const weekday = !['Sat', 'Sun'].includes(s.day);
    if (weekday) {
      const rs = U.minutes(st.rowStart), re = U.minutes(st.rowEnd), fe = U.minutes(st.fitnessEnd);
      if (['water', 'erg', 'test'].includes(s.type) && (a < rs || (b ?? a) > re)) w.push(`outside rowing time ${U.fmt12(st.rowStart)}–${U.fmt12(st.rowEnd)}`);
      if (['gym', 'run'].includes(s.type) && (a < rs || (b ?? a) > fe)) w.push(`outside training day ${U.fmt12(st.rowStart)}–${U.fmt12(st.fitnessEnd)}`);
    }
    const mine = S.sessionCrews(s);
    all.filter((o) => o !== s && o.day === s.day && o.type !== 'rest' && o.start && o.end && s.end).forEach((o) => {
      const oa = U.minutes(o.start), ob = U.minutes(o.end);
      if (oa < b && a < ob) {
        const shared = S.sessionCrews(o).filter((c) => mine.includes(c));
        if (shared.length) w.push(`clashes with “${o.title}” for ${shared.length === S.db.events.length ? 'the squad' : crewCodes(shared)}`);
      }
    });
    return w;
  }

  // plain-text day plan for printing / messaging
  function dayMessage(date, crewId) {
    const st = S.db.settings;
    let list = S.sessionsOn(date).filter((s) => s.type !== 'rest');
    if (crewId) list = list.filter((s) => S.sessionCrews(s).includes(crewId));
    const head = `${st.teamName} — ${U.fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}${crewId ? ' — ' + S.event(crewId).code : ''}`;
    if (!list.length) return `${head}\nNo training scheduled.`;
    const lines = list.map((s) => {
      const exc = Object.entries(s.exceptions || {}).filter(([c, t]) => t && (!crewId || c === crewId)).map(([c, t]) => `   ↳ ${S.event(c)?.code}: ${t}`);
      return [`• ${U.fmt12(s.start)}${s.end ? '–' + U.fmt12(s.end) : ''}  ${s.title}${s.crews?.length ? ' [' + crewCodes(s.crews) + ']' : ''}`,
        s.details ? `   ${s.details}${s.km ? ` (${s.km} km)` : ''}` : s.km ? `   ${s.km} km` : '', ...exc].filter(Boolean).join('\n');
    });
    const wk = S.db.weeks[U.mondayOf(date)];
    return `${head}\n${wk?.focus ? 'Week focus: ' + wk.focus + '\n' : ''}\n${lines.join('\n')}\n\nReport on time. Log your resting HR before training.`;
  }

  return {
    state, COLORS, chart, clearCharts, timeTicks, timeTooltip,
    avatar, kpi, opt, athleteOptions, eventOptions, distanceOptions, roleCard, empty, canRow, canCox,
    gapBadge, delta, metricFmt, crewNames, crewCodes, daysToRegatta, seatLabel, placeText, ordinal,
    modal, sessionWarnings, dayMessage,
  };
})();
