/* All page views. Each view: { title, roles, render(ctx) -> html, mount?(root, ctx), act?: {name: fn} } */
const Views = (() => {
  const { esc, fmtTime, fmtDate, fmtShort, round } = U;
  const S = Store;
  const db = () => S.db;

  // ---------- shared UI state ----------
  const ui = {
    week: U.mondayOf(U.today()),
    month: U.today().slice(0, 7),
    athleteId: null,
    eventId: 'ev4A',
    attDate: U.today(),
    resultFilter: '',
    comboEvent: 'ev4A',
    editAthlete: null,
    bulkType: 'erg2k',
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

  // ---------- small builders ----------
  const avatar = (a) => (a?.photo ? `<img class="avatar" src="${a.photo}" alt="">` : `<span class="avatar">${esc(U.initials(a?.name))}</span>`);
  const kpi = (label, value, delta = '', cls = '') => `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="delta ${cls}">${delta}</div></div>`;
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`;
  const athleteOptions = (sel, filter = () => true, blank = '— select —') => `<option value="">${blank}</option>` + db().athletes.filter(filter).map((a) => opt(a.id, a.name, sel)).join('');
  const eventOptions = (sel) => db().events.map((e) => opt(e.id, `${e.code} · ${e.name}`, sel)).join('');
  const coachCard = (title, body) => `<div class="card coach-only"><div class="card-head"><h3>${title}</h3><span class="spacer"></span><span class="coach-tag">Coach</span></div>${body}</div>`;
  const empty = (t) => `<div class="empty">${t}</div>`;
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
  const crewNames = (evId) => { const c = db().crews[evId]; if (!c) return '—'; return c.seats.filter(Boolean).map(S.short).join(', ') + (c.cox ? ` · cox ${S.short(c.cox)}` : ''); };
  const daysToRegatta = () => (db().settings.regattaDate ? U.daysBetween(U.today(), db().settings.regattaDate) : null);
  const seatLabel = (ev, i) => (ev.seats === 1 ? 'Sculler' : i === 0 ? 'Bow' : i === ev.seats - 1 ? 'Stroke' : `Seat ${i + 1}`);

  // =====================================================================
  // OVERVIEW
  // =====================================================================
  const overview = {
    title: 'Team Info', roles: ['team', 'coach', 'advisory'],
    render(ctx) {
      const d = db(); const st = d.settings;
      const att4 = S.squadAttendance(U.addDays(U.today(), -28));
      const rowers = d.athletes.filter((a) => a.role !== 'Cox');
      const impr = rowers.map((a) => { const f = S.first(a.id, 'erg2k'), l = S.latest(a.id, 'erg2k'); return f && l && f !== l ? f.value - l.value : null; }).filter((v) => v !== null);
      const sums = d.events.map((e) => S.eventSummary(e.id));
      const within = sums.filter((s) => s.count && s.ev.record && s.gapBest / s.ev.record <= 0.02).length;
      const wk = d.weeks[U.mondayOf(U.today())];
      const upcoming = d.calendar.filter((e) => e.date >= U.today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
      const updates = [...d.updates].sort((a, b) => b.date.localeCompare(a.date));
      return `
      ${st.demo ? `<div class="notice" style="margin-bottom:14px">Showing <b>demo data</b> (fictional names and times, placeholder regatta records). Coaches can clear it from <b>Data &amp; Settings → Start empty</b>.</div>` : ''}
      <div class="hero">
        <h1>${esc(st.teamName)}</h1>
        <p>${esc(st.about)}</p>
        <p><b>Coaches:</b> ${esc(st.coaches)} &nbsp;·&nbsp; <b>${esc(st.regattaName)}:</b> ${fmtDate(st.regattaDate)} ${st.venue ? '· ' + esc(st.venue) : ''}</p>
      </div>
      <div class="grid g4" style="margin-top:16px">
        ${kpi('Squad', d.athletes.length, `${rowers.length} rowers · ${d.athletes.length - rowers.length} coxes`)}
        ${kpi('Attendance (4 wks)', att4 === null ? '—' : att4 + '%', 'present or late, excused not counted', att4 >= 85 ? 'up' : att4 >= 75 ? 'flat' : 'down')}
        ${kpi('Avg 2k erg gain', impr.length ? fmtTime(U.mean(impr)) : '—', 'first test → latest test', 'up')}
        ${kpi('Crews within 2% of record', `${within}/${d.events.length}`, 'best race-equivalent time')}
      </div>
      <div class="grid g3" style="margin-top:16px">
        <div class="card span2">
          <div class="card-head"><h3>Daily updates</h3></div>
          ${ctx.coach ? `<form class="form" data-form="addUpdate" style="margin-bottom:12px">
            <label>Date<input type="date" name="date" value="${U.today()}" required></label>
            <label>Tag<select name="tag">${['Session', 'Notice', 'Result', 'Health', 'Selection'].map((t) => opt(t, t)).join('')}</select></label>
            <label>Author<input name="author" value="Head Coach"></label>
            <label class="full">Update<textarea name="text" required placeholder="What happened today, what is next…"></textarea></label>
            <div><button class="btn">Post update</button></div></form>` : ''}
          <div class="feed">${updates.length ? updates.map((u) => `
            <div class="feed-item"><div class="meta"><b>${fmtDate(u.date)}</b><span class="badge">${esc(u.tag)}</span><span>${esc(u.author)}</span>
              ${ctx.coach ? `<button class="icon-btn" data-act="delUpdate" data-id="${u.id}" title="Delete">✕</button>` : ''}</div>
              <div>${esc(u.text)}</div></div>`).join('') : empty('No updates posted yet.')}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Coming up</h3></div>
          ${upcoming.length ? `<div class="table-wrap"><table>${upcoming.map((e) => `<tr><td><b>${fmtShort(e.date)}</b><br><small>${U.daysBetween(U.today(), e.date)} days</small></td><td><span class="ev ${e.type}" style="display:inline-block">${esc(e.title)}</span></td></tr>`).join('')}</table></div>` : empty('Nothing scheduled.')}
          <div class="card-head" style="margin-top:14px"><h3>This week</h3><span class="spacer"></span><a href="#schedule">Full schedule →</a></div>
          ${wk ? `<div><b>Focus:</b> ${esc(wk.focus || '—')}</div>
            <ul style="padding-left:18px;margin:6px 0 0">${U.DAYS.map((day) => { const ss = wk.sessions.filter((s) => s.day === day); return ss.length ? `<li><b>${day}</b> — ${ss.map((s) => esc(s.title)).join('; ')}</li>` : ''; }).join('')}</ul>` : empty('No plan entered for this week.')}
        </div>
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Squad progress — average 2k erg</h3></div><div class="chart-box"><canvas id="ovErg"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>Attendance by week</h3></div><div class="chart-box"><canvas id="ovAtt"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Photos</h3><span class="spacer"></span>
          ${ctx.coach ? `<form class="btn-row" data-form="addPhoto"><input type="file" name="file" accept="image/*" multiple style="width:auto"><input name="caption" placeholder="Caption" style="width:200px"><button class="btn sm">Upload</button></form>` : ''}</div>
        ${d.photos.length ? `<div class="gallery">${d.photos.map((p) => `<figure><img src="${p.src}" alt="${esc(p.caption)}" loading="lazy"><figcaption>${esc(p.caption || '')} <small style="color:#ddd">${fmtShort(p.date)}</small></figcaption>${ctx.coach ? `<button class="icon-btn" data-act="delPhoto" data-id="${p.id}" title="Delete">✕</button>` : ''}</figure>`).join('')}</div>`
          : empty(ctx.coach ? 'No photos yet — upload training and regatta pictures above. Images are resized automatically.' : 'No photos yet.')}
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>The squad</h3><span class="spacer"></span><a href="#athletes">Athlete dashboards →</a></div>
        <div class="gallery" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${d.athletes.map((a) => `
          <div class="who card" style="padding:8px;box-shadow:none">${avatar(a)}<div><b>${esc(a.name)}</b><br><small>${esc(a.role)} · ${esc(a.squad)} · ${esc(a.grade || '')}</small></div></div>`).join('') || empty('No athletes added.')}</div>
      </div>`;
    },
    mount() {
      const d = db();
      // weekly average of each rower's most recent 2k as at that week
      const mon = U.mondayOf(U.today()); const labels = [], vals = [];
      for (let w = 11; w >= 0; w--) {
        const end = U.addDays(mon, -7 * w + 6);
        const v = d.athletes.map((a) => S.series(a.id, 'erg2k').filter((m) => m.date <= end).pop()?.value).filter(Boolean);
        labels.push(fmtShort(U.addDays(mon, -7 * w))); vals.push(v.length ? round(U.mean(v), 1) : null);
      }
      chart('ovErg', { type: 'line', data: { labels, datasets: [{ label: 'Squad average 2k', data: vals, borderColor: COLORS[1], backgroundColor: COLORS[1] + '22', fill: true, tension: .3, spanGaps: true }] },
        options: { scales: { y: { reverse: true, ticks: timeTicks, title: { display: true, text: 'faster ↑' } } }, plugins: { tooltip: timeTooltip, legend: { display: false } } } });
      const aw = S.attendanceByWeek(8);
      chart('ovAtt', { type: 'bar', data: { labels: aw.map((x) => fmtShort(x.week)), datasets: [{ label: 'Attendance %', data: aw.map((x) => x.pct), backgroundColor: aw.map((x) => (x.pct >= 85 ? COLORS[5] : x.pct >= 75 ? COLORS[4] : COLORS[6])) }] },
        options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } } });
    },
    act: {
      addUpdate(f) { const v = U.formData(f); db().updates.push({ id: U.uid('u'), ...v }); return 'Update posted'; },
      delUpdate(el) { if (!confirm('Delete this update?')) return false; db().updates = db().updates.filter((u) => u.id !== el.dataset.id); return 'Deleted'; },
      async addPhoto(f) {
        const files = Array.from(f.file.files); if (!files.length) { U.toast('Choose an image first'); return false; }
        for (const file of files) db().photos.unshift({ id: U.uid('p'), src: await U.readImage(file), caption: f.caption.value.trim(), date: U.today() });
        return `${files.length} photo(s) added`;
      },
      delPhoto(el) { if (!confirm('Delete this photo?')) return false; db().photos = db().photos.filter((p) => p.id !== el.dataset.id); return 'Photo removed'; },
    },
  };

  // =====================================================================
  // SCHEDULE + CALENDAR
  // =====================================================================
  const TYPES = { water: 'Water', erg: 'Erg', gym: 'Gym', run: 'Run / cross-train', test: 'Test / trial', meeting: 'Meeting', rest: 'Rest' };
  const CAL_TYPES = { session: 'Session', timetest: 'Time test', trial: 'Trial regatta', regatta: 'Regatta', meeting: 'Meeting', other: 'Other' };
  const schedule = {
    title: 'Schedule & Calendar', roles: ['team', 'coach', 'advisory'],
    render(ctx) {
      const d = db(); const wk = d.weeks[ui.week] || { focus: '', sessions: [] };
      const weekEnd = U.addDays(ui.week, 6);
      const totalSessions = wk.sessions.filter((s) => s.type !== 'rest').length;
      const byType = Object.keys(TYPES).map((t) => [t, wk.sessions.filter((s) => s.type === t).length]).filter(([, n]) => n);
      // calendar grid
      const [y, m] = ui.month.split('-').map(Number);
      const first = `${ui.month}-01`; const gridStart = U.mondayOf(first);
      const evs = [...d.calendar];
      if (d.settings.regattaDate) evs.push({ id: 'rtr', date: d.settings.regattaDate, type: 'regatta', title: d.settings.regattaName });
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const day = U.addDays(gridStart, i);
        if (i >= 35 && day.slice(0, 7) !== ui.month) break;
        const list = evs.filter((e) => e.date === day);
        cells.push(`<div class="cell ${day.slice(0, 7) !== ui.month ? 'other' : ''} ${day === U.today() ? 'today' : ''}"><div class="num">${Number(day.slice(8))}</div>${list.map((e) => `<span class="ev ${e.type}" title="${esc(e.title)}${e.notes ? ' — ' + esc(e.notes) : ''}">${esc(e.title)}</span>`).join('')}</div>`);
      }
      const monthEvents = evs.filter((e) => e.date.startsWith(ui.month)).sort((a, b) => a.date.localeCompare(b.date));
      return `
      <div class="section-title"><h2>Weekly schedule</h2><span class="spacer"></span>
        <div class="btn-row"><button class="btn ghost sm" data-act="weekNav" data-n="-7">◀ Prev</button>
        <b>${fmtShort(ui.week)} – ${fmtDate(weekEnd)}</b>
        <button class="btn ghost sm" data-act="weekNav" data-n="7">Next ▶</button>
        <button class="btn ghost sm" data-act="weekNav" data-n="0">This week</button></div></div>
      <div class="card" style="margin-bottom:12px">
        <div class="btn-row"><b>Week focus:</b> ${ctx.coach ? `<form data-form="setFocus" class="btn-row" style="flex:1"><input name="focus" value="${esc(wk.focus || '')}" placeholder="e.g. Aerobic base + technique" style="flex:1;min-width:200px"><button class="btn sm">Save</button></form>` : `<span>${esc(wk.focus || '—')}</span>`}</div>
        <div class="btn-row" style="margin-top:8px"><span class="muted">Summary:</span> <b>${totalSessions} sessions</b> ${byType.map(([t, n]) => `<span class="badge">${TYPES[t]} × ${n}</span>`).join('')}</div>
      </div>
      <div class="week">${U.DAYS.map((day, i) => {
        const date = U.addDays(ui.week, i);
        const ss = wk.sessions.filter((s) => s.day === day).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
        return `<div class="day ${date === U.today() ? 'today' : ''}"><h4><span>${day}</span><small>${fmtShort(date)}</small></h4>
          ${ss.map((s) => `<div class="slot t-${s.type}"><b>${esc(s.time || '')} ${esc(s.title)}</b>${esc(s.details || '')}${ctx.coach ? `<button class="icon-btn" data-act="delSession" data-id="${s.id}" title="Remove">✕</button>` : ''}</div>`).join('') || '<small class="muted">—</small>'}</div>`;
      }).join('')}</div>
      ${ctx.coach ? `<div style="margin-top:12px">${coachCard('Add a session to this week', `
        <form class="form" data-form="addSession">
          <label>Day<select name="day">${U.DAYS.map((x) => opt(x, x)).join('')}</select></label>
          <label>Time<input type="time" name="time" value="05:30"></label>
          <label>Type<select name="type">${Object.entries(TYPES).map(([k, v]) => opt(k, v)).join('')}</select></label>
          <label>Title<input name="title" required placeholder="Water — steady state"></label>
          <label class="full">Details<input name="details" placeholder="3 × 4 km UT2 @ r20"></label>
          <div class="btn-row full"><button class="btn">Add session</button>
            <button type="button" class="btn ghost" data-act="copyWeek">Copy previous week's plan</button>
            <button type="button" class="btn danger" data-act="clearWeek">Clear this week</button></div>
        </form>`)}</div>` : ''}

      <div class="section-title" style="margin-top:26px"><h2>Calendar</h2><span class="spacer"></span>
        <div class="btn-row"><button class="btn ghost sm" data-act="monthNav" data-n="-1">◀</button><b>${U.MONTHS[m - 1]} ${y}</b><button class="btn ghost sm" data-act="monthNav" data-n="1">▶</button>
        <button class="btn ghost sm" data-act="monthNav" data-n="0">Today</button></div></div>
      <div class="card">
        <div class="legend" style="margin-bottom:8px">${Object.entries(CAL_TYPES).map(([k, v]) => `<span style="--c:var(--${{ regatta: 'bad', trial: 'x', timetest: 'warn', session: 'blue', meeting: 'black', other: 'muted' }[k]})" class="lg-${k}">${v}</span>`).join('')}</div>
        <div class="cal">${U.DAYS.map((x) => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div>
      </div>
      <div class="grid ${ctx.coach ? 'g2' : ''}" style="margin-top:12px">
        <div class="card"><div class="card-head"><h3>Events in ${U.MONTHS[m - 1]}</h3></div>
          ${monthEvents.length ? `<div class="table-wrap"><table><tr><th>Date</th><th>Event</th><th>Type</th>${ctx.coach ? '<th></th>' : ''}</tr>${monthEvents.map((e) => `<tr><td>${fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td><b>${esc(e.title)}</b>${e.notes ? `<br><small>${esc(e.notes)}</small>` : ''}</td><td><span class="ev ${e.type}" style="display:inline-block">${CAL_TYPES[e.type] || e.type}</span></td>${ctx.coach ? `<td>${e.id !== 'rtr' ? `<button class="icon-btn" data-act="delEvent" data-id="${e.id}">✕</button>` : ''}</td>` : ''}</tr>`).join('')}</table></div>` : empty('No events this month.')}
        </div>
        ${ctx.coach ? coachCard('Add calendar event', `<form class="form" data-form="addEvent">
          <label>Date<input type="date" name="date" value="${U.today()}" required></label>
          <label>Type<select name="type">${Object.entries(CAL_TYPES).map(([k, v]) => opt(k, v)).join('')}</select></label>
          <label class="full">Title<input name="title" required placeholder="Trial regatta vs …"></label>
          <label class="full">Notes<input name="notes"></label>
          <div><button class="btn">Add event</button></div></form>`) : ''}
      </div>`;
    },
    mount() {
      // colour legend swatches
      const map = { regatta: '#c8312e', trial: '#7b3fe4', timetest: '#c27a00', session: '#1f6fd1', meeting: '#0d0f14', other: '#5d6b82' };
      Object.entries(map).forEach(([k, c]) => U.$$('.lg-' + k).forEach((el) => el.style.setProperty('--c', c)));
    },
    act: {
      weekNav(el) { const n = +el.dataset.n; ui.week = n ? U.addDays(ui.week, n) : U.mondayOf(U.today()); return null; },
      monthNav(el) {
        const n = +el.dataset.n; if (!n) { ui.month = U.today().slice(0, 7); return null; }
        const [y, m] = ui.month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1);
        ui.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; return null;
      },
      setFocus(f) { const w = (db().weeks[ui.week] ||= { focus: '', sessions: [] }); w.focus = f.focus.value.trim(); return 'Focus saved'; },
      addSession(f) { const w = (db().weeks[ui.week] ||= { focus: '', sessions: [] }); w.sessions.push({ id: U.uid('s'), ...U.formData(f) }); return 'Session added'; },
      delSession(el) { const w = db().weeks[ui.week]; w.sessions = w.sessions.filter((s) => s.id !== el.dataset.id); return 'Removed'; },
      copyWeek() {
        const prev = db().weeks[U.addDays(ui.week, -7)];
        if (!prev) { U.toast('No plan in the previous week to copy'); return false; }
        const cur = db().weeks[ui.week];
        if (cur && cur.sessions.length && !confirm('Replace this week\'s sessions with last week\'s?')) return false;
        db().weeks[ui.week] = { focus: prev.focus, sessions: prev.sessions.map((s) => ({ ...s, id: U.uid('s') })) };
        return 'Copied previous week';
      },
      clearWeek() { if (!confirm('Remove all sessions this week?')) return false; delete db().weeks[ui.week]; return 'Week cleared'; },
      addEvent(f) { db().calendar.push({ id: U.uid('e'), ...U.formData(f) }); return 'Event added'; },
      delEvent(el) { db().calendar = db().calendar.filter((e) => e.id !== el.dataset.id); return 'Event removed'; },
    },
  };

  // =====================================================================
  // ATHLETES & FITNESS
  // =====================================================================
  const athletes = {
    title: 'Athletes & Fitness', roles: ['team', 'coach', 'advisory'],
    render(ctx) {
      const d = db();
      if (!ui.athleteId || !S.athlete(ui.athleteId)) ui.athleteId = d.athletes[0]?.id || null;
      const a = S.athlete(ui.athleteId);
      const flags = d.athletes.filter((x) => S.rhrFlag(x.id));
      const rows = d.athletes.map((x) => {
        const l = S.latest(x.id, 'erg2k'), f = S.first(x.id, 'erg2k'), b = S.best(x.id, 'erg2k');
        const flag = S.rhrFlag(x.id); const att = S.attendancePct(x.id);
        return `<tr><td><a href="#athletes" data-act="pick" data-id="${x.id}" class="who" style="text-decoration:none;color:inherit">${avatar(x)}<b>${esc(x.name)}</b></a></td>
          <td>${esc(x.squad)}</td><td>${esc(x.role)}</td>
          <td class="num">${l ? fmtTime(l.value) : '—'}</td><td class="num">${b ? fmtTime(b.value) : '—'}</td>
          <td class="num">${f && l && f !== l ? delta(l.value - f.value, true, (v) => fmtTime(v)) : '—'}</td>
          <td class="num">${S.wPerKg(x.id) ?? '—'}</td>
          <td class="num">${S.latest(x.id, 'vo2')?.value ?? '—'}</td>
          <td class="num">${S.latest(x.id, 'rhr')?.value ?? '—'} ${flag ? `<span class="badge warn" title="${flag.diff} bpm above baseline ${flag.base}">+${flag.diff}</span>` : ''}</td>
          <td class="num"><span class="badge ${att >= 85 ? 'good' : att >= 75 ? 'warn' : 'bad'}">${att ?? '—'}%</span></td></tr>`;
      }).join('');
      const ed = ui.editAthlete ? S.athlete(ui.editAthlete) : null;
      return `
      <div class="section-title"><h2>${ctx.role === 'team' ? 'My progress' : 'Athlete dashboard'}</h2><span class="spacer"></span>
        <label style="flex-direction:row;display:flex;align-items:center;gap:8px">${ctx.role === 'team' ? 'I am' : 'Athlete'}
          <select data-change="pick" style="width:240px">${d.athletes.map((x) => opt(x.id, x.name, ui.athleteId)).join('')}</select></label></div>
      ${a ? this.profile(a, ctx) : empty('Add athletes to get started.')}
      ${flags.length && ctx.role !== 'team' ? `<div class="notice" style="margin:16px 0">⚠ <b>Recovery watch:</b> ${flags.map((x) => esc(x.name)).join(', ')} — latest resting HR is 5+ bpm above their recent baseline. Consider a lighter session or a check-in.</div>` : ''}
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Squad testing summary</h3><span class="spacer"></span><button class="btn ghost sm" data-act="csvSquad">Export CSV</button></div>
        <div class="table-wrap"><table><tr><th>Athlete</th><th>Squad</th><th>Role</th><th class="num">Latest 2k</th><th class="num">Best 2k</th><th class="num">Change</th><th class="num">W/kg</th><th class="num">VO₂ max</th><th class="num">Resting HR</th><th class="num">Attendance</th></tr>${rows}</table></div>
        <small>W/kg uses the Concept2 watts formula on the best 2k and latest body weight. Resting HR flagged when 5+ bpm above the athlete's previous four readings.</small>
      </div>
      ${ctx.coach ? `<div class="grid g2" style="margin-top:16px">
        ${coachCard('Test-day entry (whole squad)', `
          <form data-form="bulkMetric">
            <div class="form"><label>Test<select name="type" data-change="bulkType">${Object.entries(S.METRICS).map(([k, v]) => opt(k, v.label, ui.bulkType)).join('')}</select></label>
            <label>Date<input type="date" name="date" value="${U.today()}" required></label></div>
            <div class="table-wrap" style="max-height:380px;margin-top:8px"><table>${d.athletes.filter((x) => !(x.role === 'Cox' && ['erg2k', 'erg5k', 'vo2'].includes(ui.bulkType))).map((x) => `<tr><td>${esc(x.name)}</td><td style="width:140px"><input name="v_${x.id}" placeholder="${S.METRICS[ui.bulkType].unit === 'time' ? 'm:ss.t' : S.METRICS[ui.bulkType].unit}"></td><td class="num"><small>last: ${metricFmt(ui.bulkType, S.latest(x.id, ui.bulkType)?.value)}</small></td></tr>`).join('')}</table></div>
            <div style="margin-top:8px"><button class="btn">Save all entries</button> <small>Blank rows are skipped.</small></div>
          </form>`)}
        ${coachCard(ed ? 'Edit athlete' : 'Add athlete', `
          <form class="form" data-form="saveAthlete">
            <label class="full">Full name<input name="name" required value="${esc(ed?.name || '')}"></label>
            <label>Squad<select name="squad">${['Senior', 'U16'].map((x) => opt(x, x, ed?.squad)).join('')}</select></label>
            <label>Role<select name="role">${['Stroke side', 'Bow side', 'Both sides', 'Sculler', 'Cox'].map((x) => opt(x, x, ed?.role)).join('')}</select></label>
            <label>Grade<input name="grade" value="${esc(ed?.grade || '')}"></label>
            <label>Age<input type="number" name="age" value="${esc(ed?.age || '')}"></label>
            <label>Height (cm)<input type="number" name="height" value="${esc(ed?.height || '')}"></label>
            <label>Weight (kg)<input type="number" step="0.1" name="weight" value="${esc(ed?.weight || '')}"></label>
            <label class="full">Photo<input type="file" name="file" accept="image/*"></label>
            <label class="full">Notes<textarea name="notes">${esc(ed?.notes || '')}</textarea></label>
            <div class="btn-row full"><button class="btn">${ed ? 'Save changes' : 'Add athlete'}</button>
              ${ed ? `<button type="button" class="btn ghost" data-act="cancelEdit">Cancel</button><button type="button" class="btn danger" data-act="delAthlete" data-id="${ed.id}">Delete athlete</button>` : ''}</div>
          </form>`)}
      </div>` : ''}`;
    },
    profile(a, ctx) {
      const types = a.role === 'Cox' ? ['rhr', 'weight'] : ['erg2k', 'vo2', 'rhr', 'weight'];
      const tiles = types.map((t) => {
        const l = S.latest(a.id, t), f = S.first(a.id, t), M = S.METRICS[t];
        return kpi(M.label, metricFmt(t, l?.value), l ? (f && f !== l ? delta(l.value - f.value, M.lowerBetter !== false, (v) => (M.unit === 'time' ? fmtTime(v) : round(v, 1) + (M.unit === 'kg' ? ' kg' : ''))) + ' since ' + fmtShort(f.date) : 'tested ' + fmtShort(l.date)) : 'no data');
      }).join('');
      const crewsIn = db().events.filter((e) => { const c = db().crews[e.id]; return c && (c.seats.includes(a.id) || c.cox === a.id); });
      const hist = db().metrics.filter((m) => m.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date));
      const flag = S.rhrFlag(a.id);
      return `
      <div class="card" style="margin-bottom:16px"><div class="who">${a.photo ? `<img class="avatar" style="width:64px;height:64px" src="${a.photo}">` : `<span class="avatar" style="width:64px;height:64px;font-size:1.2rem">${esc(U.initials(a.name))}</span>`}
        <div style="flex:1"><h2 style="margin:0">${esc(a.name)}</h2><div class="muted">${esc(a.role)} · ${esc(a.squad)} · ${esc(a.grade || '')} ${a.age ? '· ' + a.age + ' yrs' : ''} ${a.height ? '· ' + a.height + ' cm' : ''}</div>
        <div class="btn-row" style="margin-top:6px">${crewsIn.map((e) => `<span class="badge dark">${esc(e.code)}</span>`).join('') || '<small class="muted">Not in a provisional crew</small>'}
        <span class="badge ${S.attendancePct(a.id) >= 85 ? 'good' : 'warn'}">Attendance ${S.attendancePct(a.id) ?? '—'}%</span>
        ${S.wPerKg(a.id) ? `<span class="badge">${S.wPerKg(a.id)} W/kg</span>` : ''}
        ${flag ? `<span class="badge warn">Resting HR +${flag.diff} bpm vs baseline</span>` : ''}</div>
        ${a.notes ? `<div style="margin-top:6px">${esc(a.notes)}</div>` : ''}</div>
        ${ctx.coach ? `<button class="btn ghost sm" data-act="editAthlete" data-id="${a.id}">Edit profile</button>` : ''}</div></div>
      <div class="grid g4">${tiles}</div>
      <div class="grid g2" style="margin-top:16px">
        ${a.role !== 'Cox' ? `<div class="card"><div class="card-head"><h3>Erg times</h3></div><div class="chart-box"><canvas id="athErg"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>VO₂ max</h3></div><div class="chart-box"><canvas id="athVo2"></canvas></div></div>` : ''}
        <div class="card"><div class="card-head"><h3>Resting heart rate</h3></div><div class="chart-box"><canvas id="athRhr"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>Body weight</h3></div><div class="chart-box"><canvas id="athWt"></canvas></div></div>
      </div>
      <div class="grid ${ctx.coach ? 'g2' : ''}" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Test history</h3></div>
          <div class="table-wrap" style="max-height:320px"><table><tr><th>Date</th><th>Test</th><th class="num">Result</th><th class="num">Split /500m</th>${ctx.coach ? '<th></th>' : ''}</tr>
          ${hist.map((m) => `<tr><td>${fmtDate(m.date)}</td><td>${S.METRICS[m.type].label}</td><td class="num">${metricFmt(m.type, m.value)}</td><td class="num">${m.type === 'erg2k' ? fmtTime(U.split500(m.value, 2000)) : m.type === 'erg5k' ? fmtTime(U.split500(m.value, 5000)) : ''}</td>${ctx.coach ? `<td><button class="icon-btn" data-act="delMetric" data-id="${m.id}">✕</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="5">${empty('No tests recorded.')}</td></tr>`}</table></div></div>
        ${ctx.coach ? coachCard('Add a test result for ' + esc(a.name.split(' ')[0]), `
          <form class="form" data-form="addMetric">
            <label>Test<select name="type">${Object.entries(S.METRICS).map(([k, v]) => opt(k, v.label)).join('')}</select></label>
            <label>Date<input type="date" name="date" value="${U.today()}" required></label>
            <label>Value<input name="value" required placeholder="6:45.2 / 55 / 58"></label>
            <div><button class="btn">Add</button></div>
            <small class="full">Erg tests as m:ss.t · VO₂ max in ml/kg/min · resting HR in bpm · weight in kg.</small></form>`) : ''}
      </div>`;
    },
    mount() {
      const a = S.athlete(ui.athleteId); if (!a) return;
      const line = (id, type, color, opts = {}) => {
        const s = S.series(a.id, type); if (!s.length) return;
        const time = S.METRICS[type].unit === 'time';
        chart(id, { type: 'line', data: { labels: s.map((m) => fmtShort(m.date)), datasets: [{ label: S.METRICS[type].label, data: s.map((m) => m.value), borderColor: color, backgroundColor: color + '22', fill: true, tension: .3, pointRadius: 4 }] },
          options: { plugins: { legend: { display: false }, tooltip: time ? timeTooltip : {} }, scales: { y: time ? { reverse: true, ticks: timeTicks } : { ...opts } } } });
      };
      // 2k + 5k on one chart as split/500m so both scales match
      const e2 = S.series(a.id, 'erg2k'), e5 = S.series(a.id, 'erg5k');
      if (e2.length || e5.length) {
        const dates = [...new Set([...e2, ...e5].map((m) => m.date))].sort();
        const val = (s, d, dist) => { const m = s.find((x) => x.date === d); return m ? round(U.split500(m.value, dist), 1) : null; };
        chart('athErg', { type: 'line', data: { labels: dates.map(fmtShort), datasets: [
          { label: '2k split /500m', data: dates.map((d) => val(e2, d, 2000)), borderColor: COLORS[1], spanGaps: true, tension: .3, pointRadius: 4 },
          { label: '5k split /500m', data: dates.map((d) => val(e5, d, 5000)), borderColor: COLORS[3], spanGaps: true, tension: .3, pointRadius: 4 }] },
          options: { scales: { y: { reverse: true, ticks: timeTicks } }, plugins: { tooltip: timeTooltip } } });
      }
      line('athVo2', 'vo2', COLORS[5]);
      line('athRhr', 'rhr', COLORS[6]);
      line('athWt', 'weight', COLORS[0]);
    },
    act: {
      pick(el) { ui.athleteId = el.value || el.dataset.id; window.scrollTo({ top: 0, behavior: 'smooth' }); return null; },
      bulkType(el) { ui.bulkType = el.value; return null; },
      editAthlete(el) { ui.editAthlete = el.dataset.id; setTimeout(() => U.$('[data-form="saveAthlete"]')?.scrollIntoView({ behavior: 'smooth' }), 50); return null; },
      cancelEdit() { ui.editAthlete = null; return null; },
      async saveAthlete(f) {
        const v = U.formData(f); delete v.file;
        ['age', 'height', 'weight'].forEach((k) => { v[k] = v[k] ? Number(v[k]) : ''; });
        const file = f.file.files[0];
        const photo = file ? await U.readImage(file, 400, 0.8) : null;
        if (ui.editAthlete) {
          const a = S.athlete(ui.editAthlete); Object.assign(a, v); if (photo) a.photo = photo; ui.editAthlete = null; return 'Athlete updated';
        }
        const a = { id: U.uid('ath'), photo: photo || '', ...v }; db().athletes.push(a); ui.athleteId = a.id; return 'Athlete added';
      },
      delAthlete(el) {
        const a = S.athlete(el.dataset.id); if (!confirm(`Delete ${a.name} and all of their test data?`)) return false;
        const d = db(); d.athletes = d.athletes.filter((x) => x.id !== a.id); d.metrics = d.metrics.filter((m) => m.athleteId !== a.id);
        Object.values(d.crews).forEach((c) => { c.seats = c.seats.map((s) => (s === a.id ? '' : s)); if (c.cox === a.id) c.cox = ''; });
        Object.values(d.attendance).forEach((day) => delete day[a.id]);
        ui.editAthlete = null; ui.athleteId = null; return 'Athlete deleted';
      },
      addMetric(f) {
        const v = U.formData(f);
        const val = S.METRICS[v.type].unit === 'time' ? U.parseTime(v.value) : Number(v.value);
        if (!val || isNaN(val)) { U.toast('Enter a valid value'); return false; }
        db().metrics.push({ id: U.uid('m'), athleteId: ui.athleteId, date: v.date, type: v.type, value: val }); return 'Test recorded';
      },
      bulkMetric(f) {
        const type = f.type.value, date = f.date.value; let n = 0, bad = 0;
        U.$$('input[name^="v_"]', f).forEach((inp) => {
          if (!inp.value.trim()) return;
          const val = S.METRICS[type].unit === 'time' ? U.parseTime(inp.value) : Number(inp.value);
          if (!val || isNaN(val)) { bad++; return; }
          db().metrics.push({ id: U.uid('m'), athleteId: inp.name.slice(2), date, type, value: val }); n++;
        });
        if (!n) { U.toast(bad ? 'Some values could not be read' : 'Nothing entered'); return false; }
        return `${n} results saved${bad ? `, ${bad} skipped (unreadable)` : ''}`;
      },
      delMetric(el) { db().metrics = db().metrics.filter((m) => m.id !== el.dataset.id); return 'Removed'; },
      csvSquad() {
        const rows = [['Athlete', 'Squad', 'Role', 'Date', 'Test', 'Value']];
        db().metrics.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((m) => rows.push([S.name(m.athleteId), S.athlete(m.athleteId)?.squad, S.athlete(m.athleteId)?.role, m.date, S.METRICS[m.type].label, S.METRICS[m.type].unit === 'time' ? fmtTime(m.value) : m.value]));
        U.download('stc-rowing-tests.csv', U.toCSV(rows), 'text/csv'); return false;
      },
    },
  };

  // =====================================================================
  // ATTENDANCE
  // =====================================================================
  const NEXT = { '': 'P', P: 'L', L: 'A', A: 'E', E: '' };
  const attendance = {
    title: 'Attendance', roles: ['team', 'coach', 'advisory'],
    render(ctx) {
      const d = db();
      const days = Object.keys(d.attendance).sort().slice(-14);
      if (ctx.coach && !days.includes(ui.attDate)) days.push(ui.attDate);
      days.sort();
      const marks = d.attendance[ui.attDate] || {};
      const from28 = U.addDays(U.today(), -28);
      const low = d.athletes.filter((a) => (S.attendancePct(a.id, from28) ?? 100) < 80);
      return `
      <div class="section-title"><h2>Attendance</h2></div>
      <div class="grid g4">
        ${kpi('Squad — last 4 weeks', (S.squadAttendance(from28) ?? '—') + '%')}
        ${kpi('Squad — season', (S.squadAttendance() ?? '—') + '%')}
        ${kpi('Training days logged', Object.keys(d.attendance).length)}
        ${kpi('Below 80% (4 wks)', low.length, low.map((a) => esc(S.short(a.id))).join(', ') || 'everyone above 80%', low.length ? 'down' : 'up')}
      </div>
      ${ctx.coach ? `<div style="margin-top:16px">${coachCard('Take attendance', `
        <div class="btn-row" style="margin-bottom:10px"><label style="display:flex;flex-direction:row;align-items:center;gap:6px">Date <input type="date" value="${ui.attDate}" data-change="attDate" style="width:auto"></label>
          <button class="btn ghost sm" data-act="allPresent">Mark everyone present</button>
          <span class="muted">Tap a name's buttons: <b>P</b> present · <b>L</b> late · <b>A</b> absent · <b>E</b> excused</span></div>
        <div class="gallery" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px">${d.athletes.map((a) => `
          <div class="btn-row" style="justify-content:space-between;border:1px solid var(--border);border-radius:8px;padding:5px 8px"><span>${esc(a.name)}</span>
          <span class="btn-row" style="gap:3px">${['P', 'L', 'A', 'E'].map((k) => `<button class="att-btn ${marks[a.id] === k ? 'att-' + k : ''}" data-act="mark" data-id="${a.id}" data-k="${k}">${k}</button>`).join('')}</span></div>`).join('')}</div>`)}</div>` : ''}
      <div class="grid g3" style="margin-top:16px">
        <div class="card span2"><div class="card-head"><h3>Last ${days.length} training days</h3>${ctx.coach ? '<span class="muted">— click a cell to cycle P → L → A → E → blank</span>' : ''}</div>
          <div class="table-wrap"><table><tr><th>Athlete</th>${days.map((x) => `<th class="att-cell">${fmtDate(x, { day: 'numeric', month: 'numeric' })}</th>`).join('')}<th class="num">%</th></tr>
          ${d.athletes.map((a) => `<tr><td style="white-space:nowrap">${esc(S.short(a.id))}</td>${days.map((x) => { const k = d.attendance[x]?.[a.id] || ''; return `<td class="att-cell">${ctx.coach ? `<button class="att-btn ${k ? 'att-' + k : ''}" data-act="cycle" data-id="${a.id}" data-d="${x}">${k}</button>` : `<span class="att-btn ${k ? 'att-' + k : ''}" style="display:inline-grid;place-items:center">${k}</span>`}</td>`; }).join('')}
            <td class="num"><b>${S.attendancePct(a.id) ?? '—'}%</b></td></tr>`).join('')}</table></div></div>
        <div class="card"><div class="card-head"><h3>Weekly squad attendance</h3></div><div class="chart-box tall"><canvas id="attWeek"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Attendance ranking (season)</h3></div><div class="chart-box tall"><canvas id="attRank"></canvas></div></div>`;
    },
    mount() {
      const aw = S.attendanceByWeek(10);
      chart('attWeek', { type: 'line', data: { labels: aw.map((x) => fmtShort(x.week)), datasets: [{ label: 'Attendance %', data: aw.map((x) => x.pct), borderColor: COLORS[1], backgroundColor: COLORS[1] + '22', fill: true, tension: .3 }] }, options: { scales: { y: { min: 50, max: 100 } }, plugins: { legend: { display: false } } } });
      const ranked = db().athletes.map((a) => ({ n: S.short(a.id), v: S.attendancePct(a.id) })).filter((x) => x.v !== null).sort((a, b) => b.v - a.v);
      chart('attRank', { type: 'bar', data: { labels: ranked.map((x) => x.n), datasets: [{ label: 'Attendance %', data: ranked.map((x) => x.v), backgroundColor: ranked.map((x) => (x.v >= 85 ? COLORS[5] : x.v >= 75 ? COLORS[4] : COLORS[6])) }] }, options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } } });
    },
    act: {
      attDate(el) { ui.attDate = el.value; return null; },
      mark(el) { const day = (db().attendance[ui.attDate] ||= {}); day[el.dataset.id] = day[el.dataset.id] === el.dataset.k ? '' : el.dataset.k; if (!day[el.dataset.id]) delete day[el.dataset.id]; return true; },
      cycle(el) { const day = (db().attendance[el.dataset.d] ||= {}); const n = NEXT[day[el.dataset.id] || '']; if (n) day[el.dataset.id] = n; else delete day[el.dataset.id]; return true; },
      allPresent() { const day = (db().attendance[ui.attDate] ||= {}); db().athletes.forEach((a) => { if (!day[a.id]) day[a.id] = 'P'; }); return 'Marked present (existing marks kept)'; },
    },
  };

  // =====================================================================
  // CREWS & BOATS
  // =====================================================================
  const crews = {
    title: 'Crews & Boats', roles: ['team', 'coach', 'advisory'],
    render(ctx) {
      const d = db();
      const usage = {};
      Object.values(d.crews).forEach((c) => [...c.seats, c.cox].filter(Boolean).forEach((id) => { usage[id] = (usage[id] || 0) + 1; }));
      const unassigned = d.athletes.filter((a) => !usage[a.id]);
      const groups = [['Fours', '4+'], ['Double sculls', '2x'], ['Pairs', '2-'], ['Single sculls', '1x']];
      const card = (ev) => {
        const c = d.crews[ev.id] || { seats: Array(ev.seats).fill(''), cox: '' };
        while (c.seats.length < ev.seats) c.seats.push('');
        const ergs = c.seats.map((id) => S.best(id, 'erg2k')?.value).filter(Boolean);
        const wts = c.seats.map((id) => S.latest(id, 'weight')?.value || S.athlete(id)?.weight).filter(Boolean);
        const sum = S.eventSummary(ev.id);
        const seat = (id, i, label) => ctx.coach
          ? `<div class="seat"><small>${label}</small><select data-change="seat" data-ev="${ev.id}" data-i="${i}">${athleteOptions(id, (a) => (i === 'cox' ? a.role === 'Cox' || a.id === id : a.role !== 'Cox'), '— empty —')}</select></div>`
          : `<div class="seat ${id ? '' : 'empty'}"><small>${label}</small>${id ? esc(S.short(id)) + (usage[id] > 1 ? ` <span class="badge" title="Races in ${usage[id]} events">×${usage[id]}</span>` : '') : 'empty'}</div>`;
        return `<div class="card"><div class="card-head"><h3>${esc(ev.code)}</h3><span class="muted">${esc(ev.name)}</span><span class="spacer"></span>${gapBadge(sum)}</div>
          <div class="boat-hull">${ev.cox ? seat(c.cox, 'cox', 'Cox') : ''}${[...c.seats.keys()].reverse().map((i) => seat(c.seats[i], i, seatLabel(ev, i))).join('')}</div>
          <div class="btn-row" style="margin-top:8px;font-size:.84rem">
            <span>Avg best 2k: <b>${ergs.length ? fmtTime(U.mean(ergs)) : '—'}</b></span>
            <span>Avg weight: <b>${wts.length ? round(U.mean(wts), 1) + ' kg' : '—'}</b></span>
            <span>Best ${ev.distance} m: <b>${sum.count ? fmtTime(sum.best.t) : '—'}</b></span>
            <span>Record: <b>${ev.record ? fmtTime(ev.record) : '—'}</b></span></div></div>`;
      };
      return `
      <div class="section-title"><h2>Crews for the ${esc(d.settings.regattaName)}</h2><span class="spacer"></span>${ctx.coach ? '<span class="muted">Choose rowers from the drop-downs — changes save instantly.</span>' : '<span class="muted">Provisional selection · stern (cox, stroke) on the left → bow on the right</span>'}</div>
      ${groups.map(([label, boat]) => { const evs = d.events.filter((e) => e.boat === boat); return evs.length ? `<h3 style="margin:18px 0 8px">${label}</h3><div class="grid ${ctx.coach && evs[0].seats >= 4 ? '' : 'g2'}">${evs.map(card).join('')}</div>` : ''; }).join('')}
      ${d.events.filter((e) => !groups.some(([, b]) => b === e.boat)).map(card).join('')}
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Not yet in a crew</h3></div>
        ${unassigned.length ? `<div class="btn-row">${unassigned.map((a) => `<span class="badge">${esc(a.name)} · ${esc(a.role)}</span>`).join('')}</div>` : empty('Every athlete is in at least one crew.')}</div>`;
    },
    act: {
      seat(el) {
        const ev = S.event(el.dataset.ev);
        const c = (db().crews[ev.id] ||= { seats: Array(ev.seats).fill(''), cox: '' });
        if (el.dataset.i === 'cox') c.cox = el.value; else c.seats[+el.dataset.i] = el.value;
        return 'Crew updated';
      },
    },
  };

  // =====================================================================
  // BOAT PROGRESS & RECORDS
  // =====================================================================
  const KINDS = ['Time test', 'Trial regatta', 'Regatta', 'Practice piece'];
  const results = {
    title: 'Boat Progress & Records', roles: ['team', 'coach', 'advisory'],
    render(ctx) {
      const d = db();
      const sums = d.events.map((e) => S.eventSummary(e.id));
      const ev = S.event(ui.eventId) || d.events[0]; ui.eventId = ev?.id;
      const log = d.results.filter((r) => !ui.resultFilter || r.eventId === ui.resultFilter).sort((a, b) => b.date.localeCompare(a.date));
      const crew = d.crews[ev?.id];
      return `
      <div class="section-title"><h2>Boat-by-boat progress vs regatta records</h2></div>
      <div class="card">
        <div class="table-wrap"><table>
          <tr><th>Event</th><th>Crew</th><th class="num">Race dist.</th><th class="num">Record</th><th class="num">Best*</th><th class="num">Latest*</th><th class="num">Gap to record</th><th class="num">% of record speed</th><th class="num">Improvement</th><th class="num">Tests</th><th>Status</th></tr>
          ${sums.map((s) => `<tr>
            <td><a href="#results" data-act="pickEvent" data-id="${s.ev.id}"><b>${esc(s.ev.code)}</b></a></td>
            <td><small>${crewNames(s.ev.id)}</small></td>
            <td class="num">${s.ev.distance} m</td>
            <td class="num">${s.ev.record ? fmtTime(s.ev.record) : '—'}${s.ev.record && !s.ev.recordVerified ? ' <span class="badge warn" title="Placeholder — enter the official record in Data & Settings">?</span>' : ''}</td>
            <td class="num">${s.count ? fmtTime(s.best.t) : '—'}</td>
            <td class="num">${s.count ? fmtTime(s.latest.t) : '—'}</td>
            <td class="num">${s.gapBest != null ? (s.gapBest <= 0 ? '<span class="up">' : '<span>') + (s.gapBest > 0 ? '+' : '') + round(s.gapBest, 1) + ' s</span>' : '—'}</td>
            <td class="num" style="min-width:130px">${s.pctOfRecord ? `<div class="bar ${s.pctOfRecord >= 98 ? 'good' : s.pctOfRecord >= 95 ? 'warn' : 'bad'}"><i style="width:${Math.min(100, s.pctOfRecord)}%"></i></div><small>${round(s.pctOfRecord, 1)}%</small>` : '—'}</td>
            <td class="num">${s.count > 1 ? delta(-s.improvement, true, (v) => round(v, 1) + ' s') : '—'}</td>
            <td class="num">${s.count}</td><td>${gapBadge(s)}</td></tr>`).join('')}
        </table></div>
        <small>* Race-equivalent time: tests over other distances are converted to the race distance with Paul's law (+5 s per 500 m for each doubling of distance), so 500 m and 2000 m pieces can be compared with 1000 m tests. Records marked <span class="badge warn">?</span> are placeholders until a coach enters the official figure.</small>
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>All crews — % of record speed over time</h3></div><div class="chart-box tall"><canvas id="resPct"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>Gap to record now (best time)</h3></div><div class="chart-box tall"><canvas id="resGap"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Progress by boat</h3><span class="spacer"></span>
          <div class="pill-tabs">${d.events.map((e) => `<button class="${e.id === ui.eventId ? 'active' : ''}" data-act="pickEvent" data-id="${e.id}">${esc(e.code)}</button>`).join('')}</div></div>
        ${ev ? `<div class="muted" style="margin-bottom:6px">${esc(ev.name)} · ${ev.distance} m · record ${ev.record ? fmtTime(ev.record) : 'not set'}${ev.recordHolder ? ' (' + esc(ev.recordHolder) + (ev.recordYear ? ', ' + esc(ev.recordYear) : '') + ')' : ''} · crew: ${crewNames(ev.id)}</div>
        <div class="grid g3"><div class="span2"><div class="chart-box tall"><canvas id="resEvent"></canvas></div></div>
          <div class="chart-box tall"><canvas id="resSplit"></canvas></div></div>` : ''}
      </div>
      ${ctx.coach ? `<div style="margin-top:16px">${coachCard('Log a time test / trial regatta result', `
        <form class="form" data-form="addResult">
          <label>Date<input type="date" name="date" value="${U.today()}" required></label>
          <label>Event / boat<select name="eventId" data-change="resEvent">${eventOptions(ui.eventId)}</select></label>
          <label>Type<select name="kind">${KINDS.map((k) => opt(k, k)).join('')}</select></label>
          <label>Distance (m)<input type="number" name="distance" value="${ev?.distance || 1000}" required></label>
          <label>Time<input name="time" required placeholder="3:25.4"></label>
          <label>Stroke rate<input type="number" name="rate" placeholder="34"></label>
          <label>Conditions<select name="conditions">${['Calm', 'Light headwind', 'Strong headwind', 'Tailwind', 'Crosswind', 'Rough'].map((x) => opt(x, x)).join('')}</select></label>
          <label class="full">Notes<input name="notes" placeholder="Start was messy, strong finish…"></label>
          <small class="full">Line-up recorded: <b>${crew ? crewNames(ev.id) : 'none set'}</b> (current crew for this event — change it on the Crews tab, or use Combinations for seat racing).</small>
          <div><button class="btn">Save result</button></div></form>`)}</div>` : ''}
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Results log</h3><span class="spacer"></span>
          <select data-change="filter" style="width:auto"><option value="">All events</option>${eventOptions(ui.resultFilter)}</select>
          <button class="btn ghost sm" data-act="csvResults">Export CSV</button></div>
        <div class="table-wrap" style="max-height:420px"><table><tr><th>Date</th><th>Event</th><th>Type</th><th class="num">Distance</th><th class="num">Time</th><th class="num">Split /500m</th><th class="num">Race equiv.</th><th class="num">vs record</th><th class="num">Rate</th><th>Conditions</th><th>Line-up / notes</th>${ctx.coach ? '<th></th>' : ''}</tr>
        ${log.map((r) => { const e = S.event(r.eventId); const eq = S.raceEquivalent(r); return `<tr><td>${fmtDate(r.date)}</td><td><b>${esc(e?.code)}</b></td><td>${esc(r.kind)}</td><td class="num">${r.distance} m</td><td class="num"><b>${fmtTime(r.time)}</b></td><td class="num">${fmtTime(U.split500(r.time, r.distance))}</td><td class="num">${fmtTime(eq)}</td><td class="num">${e?.record ? (eq - e.record > 0 ? '+' : '') + round(eq - e.record, 1) + ' s' : '—'}</td><td class="num">${r.rate || ''}</td><td>${esc(r.conditions || '')}</td><td><small>${(r.lineup || []).filter(Boolean).map(S.short).join(', ')}${r.notes ? ' — ' + esc(r.notes) : ''}</small></td>${ctx.coach ? `<td><button class="icon-btn" data-act="delResult" data-id="${r.id}">✕</button></td>` : ''}</tr>`; }).join('') || `<tr><td colspan="12">${empty('No results logged yet.')}</td></tr>`}
        </table></div></div>`;
    },
    mount() {
      const d = db();
      // % of record speed over time for every event
      const dates = [...new Set(d.results.map((r) => r.date))].sort();
      chart('resPct', { type: 'line', data: { labels: dates.map(fmtShort), datasets: d.events.filter((e) => e.record).map((e, i) => ({
        label: e.code, borderColor: COLORS[i % COLORS.length], backgroundColor: COLORS[i % COLORS.length], spanGaps: true, tension: .25, pointRadius: 3,
        data: dates.map((dt) => { const r = d.results.find((x) => x.eventId === e.id && x.date === dt); return r ? round((e.record / S.raceEquivalent(r)) * 100, 2) : null; }),
      })) }, options: { scales: { y: { suggestedMax: 100, title: { display: true, text: '% of record speed (100 = record)' } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw}%` } } } } });
      const sums = d.events.map((e) => S.eventSummary(e.id)).filter((s) => s.count && s.ev.record);
      chart('resGap', { type: 'bar', data: { labels: sums.map((s) => s.ev.code), datasets: [
        { label: 'Best — seconds off record', data: sums.map((s) => round(s.gapBest, 1)), backgroundColor: sums.map((s) => (s.gapBest / s.ev.record <= 0.02 ? COLORS[5] : s.gapBest / s.ev.record <= 0.05 ? COLORS[4] : COLORS[6])) },
        { label: 'Latest — seconds off record', data: sums.map((s) => round(s.gapLatest, 1)), backgroundColor: COLORS[2] + '99' }] },
        options: { indexAxis: 'y', scales: { x: { title: { display: true, text: 'seconds slower than record (lower is better)' } } } } });
      const ev = S.event(ui.eventId); if (!ev) return;
      const rs = S.eventResults(ev.id);
      chart('resEvent', { type: 'line', data: { labels: rs.map((r) => fmtShort(r.date)), datasets: [
        { label: `Race-equivalent ${ev.distance} m`, data: rs.map((r) => round(S.raceEquivalent(r), 1)), borderColor: COLORS[1], backgroundColor: COLORS[1], tension: .25, pointRadius: 5 },
        ...(ev.record ? [{ label: 'Regatta record', data: rs.map(() => ev.record), borderColor: COLORS[6], borderDash: [6, 4], pointRadius: 0 }] : []),
        ...(ev.record ? [{ label: 'Within 2% target', data: rs.map(() => round(ev.record * 1.02, 1)), borderColor: COLORS[5], borderDash: [2, 4], pointRadius: 0 }] : [])] },
        options: { scales: { y: { reverse: true, ticks: timeTicks, title: { display: true, text: 'faster ↑' } } }, plugins: { tooltip: timeTooltip } } });
      chart('resSplit', { type: 'bar', data: { labels: rs.map((r) => fmtShort(r.date) + ` (${r.distance}m)`), datasets: [{ label: 'Split /500m', data: rs.map((r) => round(U.split500(r.time, r.distance), 1)), backgroundColor: COLORS[0] }] },
        options: { scales: { y: { ticks: timeTicks, min: rs.length ? Math.floor(Math.min(...rs.map((r) => U.split500(r.time, r.distance))) - 5) : 0 } }, plugins: { tooltip: timeTooltip, legend: { display: false } } } });
    },
    act: {
      pickEvent(el) { ui.eventId = el.dataset.id; return null; },
      resEvent(el) { ui.eventId = el.value; return null; },
      filter(el) { ui.resultFilter = el.value; return null; },
      addResult(f) {
        const v = U.formData(f); const t = U.parseTime(v.time);
        if (!t) { U.toast('Enter time as m:ss.t'); return false; }
        const c = db().crews[v.eventId];
        db().results.push({ id: U.uid('r'), date: v.date, eventId: v.eventId, kind: v.kind, distance: Number(v.distance), time: t, rate: v.rate ? Number(v.rate) : '', conditions: v.conditions, notes: v.notes, lineup: c ? [...c.seats, ...(c.cox ? [c.cox] : [])] : [] });
        ui.eventId = v.eventId; return 'Result saved';
      },
      delResult(el) { if (!confirm('Delete this result?')) return false; db().results = db().results.filter((r) => r.id !== el.dataset.id); return 'Deleted'; },
      csvResults() {
        const rows = [['Date', 'Event', 'Type', 'Distance', 'Time', 'Split/500', 'Race equivalent', 'Record', 'Gap (s)', 'Rate', 'Conditions', 'Line-up', 'Notes']];
        db().results.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => { const e = S.event(r.eventId); const eq = S.raceEquivalent(r); rows.push([r.date, e?.code, r.kind, r.distance, fmtTime(r.time), fmtTime(U.split500(r.time, r.distance)), fmtTime(eq), e?.record ? fmtTime(e.record) : '', e?.record ? round(eq - e.record, 1) : '', r.rate, r.conditions, (r.lineup || []).map(S.name).join(' / '), r.notes]); });
        U.download('stc-rowing-results.csv', U.toCSV(rows), 'text/csv'); return false;
      },
    },
  };

  // =====================================================================
  // COMBINATIONS (coach only) — seat racing / line-up testing
  // =====================================================================
  const lineupKey = (c) => [...c.lineup].join('|') + '#' + (c.cox || '');
  const combos = {
    title: 'Combinations', roles: ['coach'],
    render() {
      const d = db(); const ev = S.event(ui.comboEvent) || d.events[0]; ui.comboEvent = ev.id;
      const list = d.combos.filter((c) => c.eventId === ev.id);
      // group by line-up
      const groups = {};
      list.forEach((c) => { (groups[lineupKey(c)] ||= { lineup: c.lineup, cox: c.cox, runs: [] }).runs.push(c); });
      const ranked = Object.values(groups).map((g) => {
        const splits = g.runs.map((r) => U.split500(r.time, r.distance));
        const eqs = g.runs.map((r) => U.projectTime(r.time, r.distance, ev.distance));
        return { ...g, best: Math.min(...splits), avg: U.mean(splits), eq: Math.min(...eqs), last: g.runs.map((r) => r.date).sort().pop() };
      }).sort((a, b) => a.avg - b.avg);
      // seat-racing effect: avg split with athlete vs without
      const athletesIn = [...new Set(list.flatMap((c) => c.lineup))].filter(Boolean);
      const allAvg = U.mean(list.map((c) => U.split500(c.time, c.distance)));
      const effect = athletesIn.map((id) => {
        const w = list.filter((c) => c.lineup.includes(id)).map((c) => U.split500(c.time, c.distance));
        const wo = list.filter((c) => !c.lineup.includes(id)).map((c) => U.split500(c.time, c.distance));
        return { id, n: w.length, with: U.mean(w), without: wo.length ? U.mean(wo) : null };
      }).map((x) => ({ ...x, diff: x.without !== null ? x.with - x.without : null })).sort((a, b) => (a.diff ?? 99) - (b.diff ?? 99));
      const seats = Array.from({ length: ev.seats }, (_, i) => i);
      const cur = d.crews[ev.id];
      return `
      <div class="section-title"><h2>Combinations tested</h2><span class="spacer"></span>
        <div class="pill-tabs">${d.events.map((e) => `<button class="${e.id === ev.id ? 'active' : ''}" data-act="pickCombo" data-id="${e.id}">${esc(e.code)} <small>(${d.combos.filter((c) => c.eventId === e.id).length})</small></button>`).join('')}</div></div>
      <div class="grid g2">
        ${coachCard('Log a combination piece — ' + esc(ev.code), `
          <form class="form" data-form="addCombo">
            <label>Date<input type="date" name="date" value="${U.today()}" required></label>
            <label>Distance (m)<input type="number" name="distance" value="500" required></label>
            <label>Time<input name="time" required placeholder="1:38.2"></label>
            <label>Rate<input type="number" name="rate" placeholder="34"></label>
            ${seats.map((i) => `<label>${seatLabel(ev, i)}<select name="seat${i}">${athleteOptions(cur?.seats[i], (a) => a.role !== 'Cox')}</select></label>`).join('')}
            ${ev.cox ? `<label>Cox<select name="cox">${athleteOptions(cur?.cox, (a) => a.role === 'Cox')}</select></label>` : ''}
            <label class="full">Notes<input name="notes" placeholder="Swapped 2 and 3 seat"></label>
            <div><button class="btn">Save piece</button></div></form>`)}
        <div class="card"><div class="card-head"><h3>How to use</h3></div>
          <p style="margin-top:0">Row the same piece with different line-ups (ideally same distance, rate and conditions). Each line-up is ranked by its average split, projected to the ${ev.distance} m race distance and compared with the record. The <b>seat-racing effect</b> table compares the average split of pieces <i>with</i> each athlete against pieces <i>without</i> them — negative means the boat went faster with that athlete.</p>
          <div class="grid g2">${kpi('Pieces logged', list.length)}${kpi('Line-ups tried', ranked.length)}</div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Line-up ranking — ${esc(ev.code)}</h3></div>
        ${ranked.length ? `<div class="table-wrap"><table><tr><th>#</th><th>Line-up (bow → stroke)</th><th class="num">Pieces</th><th class="num">Avg split</th><th class="num">Best split</th><th class="num">Projected ${ev.distance} m</th><th class="num">vs record</th><th>Last tried</th><th></th></tr>
          ${ranked.map((g, i) => `<tr><td><b>${i + 1}</b></td><td>${g.lineup.map((id) => esc(S.short(id))).join(' · ')}${g.cox ? ` <small>(cox ${esc(S.short(g.cox))})</small>` : ''}</td><td class="num">${g.runs.length}</td><td class="num"><b>${fmtTime(g.avg)}</b></td><td class="num">${fmtTime(g.best)}</td><td class="num">${fmtTime(g.eq)}</td><td class="num">${ev.record ? '+' + round(g.eq - ev.record, 1) + ' s' : '—'}</td><td>${fmtShort(g.last)}</td>
            <td><button class="btn ghost sm" data-act="adopt" data-key="${esc(lineupKey(g.runs[0]))}">Set as crew</button></td></tr>`).join('')}</table></div>
          <div class="chart-box short" style="margin-top:10px"><canvas id="comboChart"></canvas></div>` : empty('No combinations logged for this boat yet.')}
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Seat-racing effect</h3></div>
          ${effect.length ? `<div class="table-wrap"><table><tr><th>Athlete</th><th class="num">Pieces in</th><th class="num">Avg split with</th><th class="num">Avg split without</th><th class="num">Effect</th></tr>
            ${effect.map((x) => `<tr><td>${esc(S.name(x.id))}</td><td class="num">${x.n}</td><td class="num">${fmtTime(x.with)}</td><td class="num">${x.without !== null ? fmtTime(x.without) : '—'}</td><td class="num">${x.diff !== null ? delta(x.diff, true, (v) => round(v, 1) + ' s') : '<small>in every piece</small>'}</td></tr>`).join('')}</table></div>
            <small>Squad average split for these pieces: ${fmtTime(allAvg)}. Treat small differences (&lt; 0.5 s) with caution — conditions vary.</small>` : empty('Log pieces to see the effect.')}</div>
        <div class="card"><div class="card-head"><h3>All pieces</h3></div>
          <div class="table-wrap" style="max-height:360px"><table><tr><th>Date</th><th>Line-up</th><th class="num">Dist</th><th class="num">Time</th><th class="num">Split</th><th></th></tr>
          ${list.slice().sort((a, b) => b.date.localeCompare(a.date)).map((c) => `<tr><td>${fmtShort(c.date)}</td><td><small>${c.lineup.map(S.short).join(' · ')}${c.notes ? '<br>' + esc(c.notes) : ''}</small></td><td class="num">${c.distance}</td><td class="num">${fmtTime(c.time)}</td><td class="num">${fmtTime(U.split500(c.time, c.distance))}</td><td><button class="icon-btn" data-act="delCombo" data-id="${c.id}">✕</button></td></tr>`).join('') || `<tr><td colspan="6">${empty('None yet.')}</td></tr>`}</table></div></div>
      </div>`;
    },
    mount() {
      const ev = S.event(ui.comboEvent); const list = db().combos.filter((c) => c.eventId === ev.id);
      const groups = {}; list.forEach((c) => { (groups[lineupKey(c)] ||= { lineup: c.lineup, runs: [] }).runs.push(c); });
      const g = Object.values(groups).map((x) => ({ l: x.lineup.map((id) => U.initials(S.name(id))).join('-'), v: round(U.mean(x.runs.map((r) => U.split500(r.time, r.distance))), 1) })).sort((a, b) => a.v - b.v);
      chart('comboChart', { type: 'bar', data: { labels: g.map((x) => x.l), datasets: [{ label: 'Avg split /500m', data: g.map((x) => x.v), backgroundColor: g.map((_, i) => (i === 0 ? COLORS[5] : COLORS[1])) }] },
        options: { indexAxis: 'y', scales: { x: { ticks: timeTicks, min: g.length ? Math.floor(Math.min(...g.map((x) => x.v)) - 2) : 0 } }, plugins: { legend: { display: false }, tooltip: timeTooltip } } });
    },
    act: {
      pickCombo(el) { ui.comboEvent = el.dataset.id; return null; },
      addCombo(f) {
        const ev = S.event(ui.comboEvent); const v = U.formData(f); const t = U.parseTime(v.time);
        if (!t) { U.toast('Enter time as m:ss.t'); return false; }
        const lineup = Array.from({ length: ev.seats }, (_, i) => v['seat' + i]);
        if (lineup.some((x) => !x)) { U.toast('Fill every seat'); return false; }
        if (new Set(lineup).size !== lineup.length) { U.toast('The same athlete is in two seats'); return false; }
        db().combos.push({ id: U.uid('c'), date: v.date, eventId: ev.id, lineup, cox: v.cox || '', distance: Number(v.distance), time: t, rate: v.rate, notes: v.notes });
        return 'Piece saved';
      },
      adopt(el) {
        const c = db().combos.find((x) => lineupKey(x) === el.dataset.key);
        if (!confirm('Make this line-up the selected crew for ' + S.event(c.eventId).code + '?')) return false;
        db().crews[c.eventId] = { seats: [...c.lineup], cox: c.cox || db().crews[c.eventId]?.cox || '' };
        return 'Crew updated';
      },
      delCombo(el) { db().combos = db().combos.filter((c) => c.id !== el.dataset.id); return 'Deleted'; },
    },
  };

  // =====================================================================
  // ADVISORY COMMITTEE REPORT
  // =====================================================================
  const report = {
    title: 'Committee Report', roles: ['advisory', 'coach'],
    render() {
      const d = db(); const st = d.settings;
      const sums = d.events.map((e) => S.eventSummary(e.id));
      const tested = sums.filter((s) => s.count && s.ev.record);
      const within2 = tested.filter((s) => s.gapBest / s.ev.record <= 0.02).length;
      const avgPct = tested.length ? U.mean(tested.map((s) => s.pctOfRecord)) : null;
      const flags = d.athletes.filter((a) => S.rhrFlag(a.id));
      const from28 = U.addDays(U.today(), -28);
      const att = S.squadAttendance(from28), attPrev = S.squadAttendance(U.addDays(U.today(), -56));
      const rowers = d.athletes.filter((a) => a.role !== 'Cox');
      const ergImpr = rowers.map((a) => { const f = S.first(a.id, 'erg2k'), l = S.latest(a.id, 'erg2k'); return f && l && f !== l ? f.value - l.value : null; }).filter((v) => v !== null);
      const vo2 = rowers.map((a) => S.latest(a.id, 'vo2')?.value).filter(Boolean);
      const days = daysToRegatta();
      const wkPlan = d.weeks[U.mondayOf(U.today())];
      const recent = [...d.updates].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
      return `
      <div class="section-title"><h2>Advisory committee report</h2><span class="spacer"></span><span class="muted">Generated ${fmtDate(U.today())}</span><button class="btn ghost sm no-print" onclick="window.print()">Print / save PDF</button></div>
      <div class="hero" style="margin-bottom:16px"><h1>${days !== null ? (days >= 0 ? `${days} days to the ${esc(st.regattaName)}` : `${esc(st.regattaName)} was ${-days} days ago`) : esc(st.regattaName)}</h1>
        <p>${tested.length ? `Across ${tested.length} tested boats the crews are rowing at an average of <b>${round(avgPct, 1)}%</b> of record speed; <b>${within2}</b> boat${within2 === 1 ? ' is' : 's are'} within 2% of the regatta record.` : 'No boat time tests recorded yet.'}
        Squad attendance over the last four weeks is <b>${att ?? '—'}%</b>.</p></div>
      <div class="grid g4">
        ${kpi('Squad size', d.athletes.length, `${rowers.length} rowers · ${d.athletes.length - rowers.length} coxes`)}
        ${kpi('Attendance (4 wks)', (att ?? '—') + '%', attPrev !== null && att !== null ? `8-wk average ${attPrev}%` : '', att >= 85 ? 'up' : 'down')}
        ${kpi('Avg 2k erg improvement', ergImpr.length ? fmtTime(U.mean(ergImpr)) : '—', `${ergImpr.filter((v) => v > 0).length}/${ergImpr.length} rowers faster`, 'up')}
        ${kpi('Avg VO₂ max', vo2.length ? round(U.mean(vo2), 1) : '—', 'ml/kg/min, latest tests')}
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Boat readiness</h3></div>
        <div class="table-wrap"><table><tr><th>Event</th><th>Provisional crew</th><th class="num">Best*</th><th class="num">Record</th><th class="num">Gap</th><th class="num">Since first test</th><th>Status</th></tr>
        ${sums.map((s) => `<tr><td><b>${esc(s.ev.code)}</b><br><small>${esc(s.ev.name)}</small></td><td><small>${crewNames(s.ev.id)}</small></td><td class="num">${s.count ? fmtTime(s.best.t) : '—'}</td><td class="num">${s.ev.record ? fmtTime(s.ev.record) : '—'}</td><td class="num">${s.gapBest != null ? (s.gapBest > 0 ? '+' : '') + round(s.gapBest, 1) + ' s' : '—'}</td><td class="num">${s.count > 1 ? delta(-s.improvement, true, (v) => round(v, 1) + ' s faster') : '—'}</td><td>${gapBadge(s)}</td></tr>`).join('')}</table></div>
        <small>* Best race-equivalent time from time tests and trial regattas.</small></div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>% of record speed by boat</h3></div><div class="chart-box tall"><canvas id="repPct"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>Attendance trend</h3></div><div class="chart-box tall"><canvas id="repAtt"></canvas></div></div>
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Training this week</h3></div>
          ${wkPlan ? `<p style="margin-top:0"><b>Focus:</b> ${esc(wkPlan.focus || '—')}</p><p>${wkPlan.sessions.filter((s) => s.type !== 'rest').length} sessions planned: ${Object.entries(TYPES).map(([k, v]) => [v, wkPlan.sessions.filter((s) => s.type === k).length]).filter(([, n]) => n).map(([v, n]) => `${n} × ${v}`).join(', ')}.</p>` : empty('No plan entered.')}
          <h3 style="margin-top:12px">Athlete welfare</h3>
          ${flags.length ? `<p>${flags.length} athlete(s) currently show elevated resting heart rate (possible fatigue or illness) and are being monitored.</p>` : '<p>No welfare flags from resting heart-rate monitoring.</p>'}</div>
        <div class="card"><div class="card-head"><h3>Latest from the coaches</h3></div>
          <div class="feed">${recent.map((u) => `<div class="feed-item"><div class="meta"><b>${fmtDate(u.date)}</b><span class="badge">${esc(u.tag)}</span></div>${esc(u.text)}</div>`).join('') || empty('No updates.')}</div></div>
      </div>`;
    },
    mount() {
      const sums = db().events.map((e) => S.eventSummary(e.id)).filter((s) => s.count && s.ev.record);
      chart('repPct', { type: 'bar', data: { labels: sums.map((s) => s.ev.code), datasets: [
        { label: 'First test', data: sums.map((s) => round((s.ev.record / s.first.t) * 100, 1)), backgroundColor: COLORS[2] + 'aa' },
        { label: 'Best', data: sums.map((s) => round(s.pctOfRecord, 1)), backgroundColor: COLORS[0] }] },
        options: { scales: { y: { min: 80, max: 102, title: { display: true, text: '% of record speed' } } } } });
      const aw = S.attendanceByWeek(10);
      chart('repAtt', { type: 'line', data: { labels: aw.map((x) => fmtShort(x.week)), datasets: [{ label: 'Attendance %', data: aw.map((x) => x.pct), borderColor: COLORS[5], backgroundColor: COLORS[5] + '22', fill: true, tension: .3 }] }, options: { scales: { y: { min: 50, max: 100 } }, plugins: { legend: { display: false } } } });
    },
  };

  // =====================================================================
  // DATA & SETTINGS (coach)
  // =====================================================================
  const data = {
    title: 'Data & Settings', roles: ['coach'],
    render() {
      const d = db(); const st = d.settings;
      const size = new Blob([Store.exportJSON()]).size;
      return `
      <div class="section-title"><h2>Data &amp; settings</h2></div>
      <div class="grid g2">
        ${coachCard('Team settings', `<form class="form" data-form="saveSettings">
          <label class="full">Team name<input name="teamName" value="${esc(st.teamName)}"></label>
          <label>Main regatta<input name="regattaName" value="${esc(st.regattaName)}"></label>
          <label>Regatta date<input type="date" name="regattaDate" value="${esc(st.regattaDate)}"></label>
          <label class="full">Venue<input name="venue" value="${esc(st.venue)}"></label>
          <label class="full">Coaches<input name="coaches" value="${esc(st.coaches)}"></label>
          <label class="full">About the team<textarea name="about">${esc(st.about)}</textarea></label>
          <label>Coach PIN<input name="coachPin" value="${esc(st.coachPin)}"></label>
          <div><button class="btn">Save settings</button></div></form>`)}
        ${coachCard('Save, share &amp; back up', `
          <p style="margin-top:0">Data is stored in <b>this browser</b> (currently ${round(size / 1024, 0)} KB, source: <b>${d._source}</b>). To share it with the team and advisory committee:</p>
          <ol style="padding-left:18px"><li>Click <b>Download data file</b>.</li><li>Upload it to the website's repository as <code>data/team-data.json</code>.</li><li>Everyone who opens the site will see that data. (Browsers with their own local edits keep theirs until they press <i>Load published data</i>.)</li></ol>
          <div class="btn-row"><button class="btn" data-act="exportJSON">Download data file</button>
            <label class="btn ghost" style="display:inline-block;color:var(--navy);font-size:.88rem">Import data file<input type="file" accept="application/json,.json" data-change="importJSON" hidden></label>
            <button class="btn ghost" data-act="loadPublished">Load published data</button></div>
          <hr style="border:0;border-top:1px solid var(--border);margin:14px 0">
          <div class="btn-row"><button class="btn danger" data-act="resetDemo">Reload demo data</button><button class="btn danger" data-act="startEmpty">Start empty (keep events)</button></div>
          <p><small>The coach PIN only hides editing controls from casual visitors — it is not real security, since the data file itself is public on a static site.</small></p>`)}
      </div>
      <div style="margin-top:16px">${coachCard('Events &amp; regatta records', `
        <p style="margin-top:0">Enter the official Royal Thomian record for each event and tick <b>Verified</b>. Every progress dashboard compares crews against these figures. Race distance is used to convert time tests over other distances.</p>
        <form data-form="saveEvents"><div class="table-wrap"><table><tr><th>Code</th><th>Event name</th><th>Boat</th><th class="num">Rowers</th><th>Cox</th><th class="num">Race dist. (m)</th><th>Record time</th><th>Record holder</th><th>Year</th><th>Verified</th><th></th></tr>
          ${d.events.map((e) => `<tr>
            <td><input name="code_${e.id}" value="${esc(e.code)}" style="width:80px"></td>
            <td><input name="name_${e.id}" value="${esc(e.name)}"></td>
            <td><select name="boat_${e.id}" style="width:70px">${['4+', '4-', '4x', '2x', '2-', '1x', '8+'].map((b) => opt(b, b, e.boat)).join('')}</select></td>
            <td class="num"><input type="number" name="seats_${e.id}" value="${e.seats}" min="1" max="8" style="width:60px"></td>
            <td><input type="checkbox" name="cox_${e.id}" ${e.cox ? 'checked' : ''} style="width:auto"></td>
            <td class="num"><input type="number" name="distance_${e.id}" value="${e.distance}" style="width:90px"></td>
            <td><input name="record_${e.id}" value="${e.record ? fmtTime(e.record) : ''}" placeholder="m:ss.t" style="width:90px"></td>
            <td><input name="holder_${e.id}" value="${esc(e.recordHolder || '')}" placeholder="School / crew"></td>
            <td><input name="year_${e.id}" value="${esc(e.recordYear || '')}" style="width:70px"></td>
            <td><input type="checkbox" name="verified_${e.id}" ${e.recordVerified ? 'checked' : ''} style="width:auto"></td>
            <td><button type="button" class="icon-btn" data-act="delEventType" data-id="${e.id}" title="Remove event">✕</button></td></tr>`).join('')}
        </table></div><div class="btn-row" style="margin-top:10px"><button class="btn">Save events &amp; records</button><button type="button" class="btn ghost" data-act="addEventType">+ Add event</button></div></form>`)}</div>`;
    },
    act: {
      saveSettings(f) { const v = U.formData(f); if (!v.coachPin) { U.toast('PIN cannot be empty'); return false; } Object.assign(db().settings, v); return 'Settings saved'; },
      saveEvents(f) {
        let bad = 0;
        db().events.forEach((e) => {
          const g = (k) => f.elements[`${k}_${e.id}`];
          e.code = g('code').value.trim() || e.code; e.name = g('name').value.trim(); e.boat = g('boat').value;
          e.seats = Math.max(1, Number(g('seats').value) || e.seats); e.cox = g('cox').checked;
          e.distance = Number(g('distance').value) || e.distance;
          const r = g('record').value.trim(); const rt = r ? U.parseTime(r) : null; if (r && !rt) bad++; e.record = rt;
          e.recordHolder = g('holder').value.trim(); e.recordYear = g('year').value.trim(); e.recordVerified = g('verified').checked;
          const c = db().crews[e.id]; if (c) c.seats = c.seats.slice(0, e.seats);
        });
        return bad ? `Saved — ${bad} record time(s) unreadable and cleared` : 'Events & records saved';
      },
      addEventType() { db().events.push({ id: U.uid('ev'), code: 'New', name: 'New event', boat: '4+', seats: 4, cox: true, distance: 1000, record: null, recordHolder: '', recordYear: '', recordVerified: false }); return 'Event added — fill in its details'; },
      delEventType(el) {
        const e = S.event(el.dataset.id); const n = db().results.filter((r) => r.eventId === e.id).length;
        if (!confirm(`Remove ${e.code}? ${n} result(s) for it will also be removed.`)) return false;
        const d = db(); d.events = d.events.filter((x) => x.id !== e.id); d.results = d.results.filter((r) => r.eventId !== e.id); d.combos = d.combos.filter((r) => r.eventId !== e.id); delete d.crews[e.id];
        return 'Event removed';
      },
      exportJSON() { U.download(`team-data.json`, Store.exportJSON()); return false; },
      async importJSON(el) {
        const file = el.files[0]; if (!file) return false;
        try { Store.importJSON(await file.text()); return 'Data imported'; } catch (e) { U.toast('Import failed: ' + e.message); return false; }
      },
      async loadPublished() {
        try {
          const res = await fetch('data/team-data.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('no published file found (data/team-data.json)');
          if (!confirm('Replace the data in this browser with the published data file?')) return false;
          Store.importJSON(await res.text()); return 'Published data loaded';
        } catch (e) { U.toast(e.message); return false; }
      },
      resetDemo() { if (!confirm('Replace everything in this browser with the demo data?')) return false; Store.reset('demo'); return 'Demo data loaded'; },
      startEmpty() { if (!confirm('Remove ALL athletes, results, attendance, schedules and photos from this browser? (Download a backup first if needed.)')) return false; Store.reset('empty'); return 'Started with an empty data set'; },
    },
  };

  return { overview, schedule, athletes, attendance, crews, results, combos, report, data, ui, clearCharts };
})();
