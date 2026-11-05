/* Team info, Today (print / message), weekly schedule board (drag & drop, crew-specific sessions,
   AI suggestions) and the calendar. */
(() => {
  const { esc, fmtTime, fmtDate, fmtShort, round } = U;
  const S = Store, ui = UI.state;
  const db = () => S.db;
  const { kpi, opt, empty, roleCard, chart, COLORS, timeTicks, timeTooltip, avatar, crewCodes } = UI;

  const TYPES = { water: 'Water', erg: 'Erg', gym: 'Fitness — gym', run: 'Fitness — run / cross-train', test: 'Test / trial', meeting: 'Meeting', rest: 'Rest' };
  const CAL_TYPES = { session: 'Session', timetest: 'Time test', trial: 'Trial regatta', regatta: 'Regatta', meeting: 'Meeting', other: 'Other' };
  const COMP = { done: '✓ Done', partial: '½ Partial', missed: '✗ Missed' };
  const chips = (ids) => (ids && ids.length ? ids.map((c) => `<span class="chip">${esc(S.event(c)?.code || '?')}</span>`).join('') : '<span class="chip all">Whole squad</span>');
  const timeRange = (s) => (s.start ? `${U.fmt12(s.start)}${s.end ? '–' + U.fmt12(s.end) : ''}` : '');

  // =====================================================================
  // TEAM INFO
  // =====================================================================
  Views.overview = {
    render(ctx) {
      const d = db(); const st = d.settings;
      const att4 = S.squadAttendance(U.addDays(U.today(), -28));
      const rowers = d.athletes.filter((a) => !S.isCox(a));
      const impr = rowers.map((a) => { const f = S.first(a.id, 'erg2k'), l = S.latest(a.id, 'erg2k'); return f && l && f !== l ? f.value - l.value : null; }).filter((v) => v !== null);
      const sums = d.events.map((e) => S.eventSummary(e.id));
      const within = sums.filter((s) => s.count && s.ev.record && s.gapBest / s.ev.record <= 0.02).length;
      const upcoming = d.calendar.filter((e) => e.date >= U.today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
      const updates = [...d.updates].sort((a, b) => b.date.localeCompare(a.date));
      const last = [...d.history].sort((a, b) => b.year - a.year)[0];
      const today = S.sessionsOn(U.today()).filter((s) => s.type !== 'rest');
      return `
      ${st.demo ? `<div class="notice" style="margin-bottom:14px">Showing <b>demo squad data</b> (fictional names and training data). Royal Thomian events, points, records and recent results are real published figures. Coaches can clear the demo squad from <b>Data &amp; Settings → Start empty</b>.</div>` : ''}
      <div class="hero">
        <h1>${esc(st.teamName)}</h1>
        <p>${esc(st.about)}</p>
        <p><b>Coaches:</b> ${esc(st.coaches)} &nbsp;·&nbsp; <b>Next ${esc(st.regattaName)}:</b> ${fmtDate(st.regattaDate)} ${st.venue ? '· ' + esc(st.venue) : ''}</p>
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
            <label>Author<input name="author" value="${esc(ctx.userName || 'Head Coach')}"></label>
            <label class="full">Update<textarea name="text" required placeholder="What happened today, what is next…"></textarea></label>
            <div><button class="btn">Post update</button></div></form>` : ''}
          <div class="feed">${updates.length ? updates.map((u) => `
            <div class="feed-item"><div class="meta"><b>${fmtDate(u.date)}</b><span class="badge">${esc(u.tag)}</span><span>${esc(u.author)}</span>
              ${ctx.coach ? `<button class="icon-btn" data-act="delUpdate" data-id="${u.id}" title="Delete">✕</button>` : ''}</div>
              <div>${esc(u.text)}</div></div>`).join('') : empty('No updates posted yet.')}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Today</h3><span class="spacer"></span><a href="#today">Details →</a></div>
          ${today.length ? `<ul class="plain">${today.map((s) => `<li><b>${timeRange(s)}</b> ${esc(s.title)} <small>${crewCodes(s.crews)}</small></li>`).join('')}</ul>` : empty('No training today.')}
          <div class="card-head" style="margin-top:14px"><h3>Coming up</h3></div>
          ${upcoming.length ? `<div class="table-wrap"><table>${upcoming.map((e) => `<tr><td><b>${fmtShort(e.date)}</b><br><small>${U.daysBetween(U.today(), e.date)} days</small></td><td><span class="ev ${e.type}" style="display:inline-block">${esc(e.title)}</span></td></tr>`).join('')}</table></div>` : empty('Nothing scheduled.')}
          ${last ? `<div class="card-head" style="margin-top:14px"><h3>Last Royal Thomian</h3><span class="spacer"></span><a href="#races">History →</a></div>
            <div><b>${last.year}:</b> Royal ${last.royal} – ${last.stc} S. Thomas' · ${esc(last.result)}</div>
            <small>Trophy: ${esc(last.trophy || '—')}${last.boatRace ? ' · Boat Race: ' + esc(last.boatRace) : ''}</small>` : ''}
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
        <div class="card-head"><h3>The squad</h3></div>
        <div class="gallery" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${d.athletes.map((a) => `
          <div class="who card" style="padding:8px;box-shadow:none">${avatar(a)}<div><b>${esc(a.name)}</b><br><small>${esc(S.skillText(a))} · ${esc(a.squad)}</small><br>${S.athleteEvents(a.id).map((e) => `<span class="chip">${esc(e.code)}</span>`).join('')}</div></div>`).join('') || empty('No athletes added.')}</div>
      </div>`;
    },
    mount() {
      const d = db(); const mon = U.mondayOf(U.today()); const labels = [], vals = [];
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
      addUpdate(f) { db().updates.push({ id: U.uid('u'), ...U.formData(f) }); return 'Update posted'; },
      delUpdate(el) { db().updates = db().updates.filter((u) => u.id !== el.dataset.id); return 'Deleted'; },
      async addPhoto(f) {
        const files = Array.from(f.file.files); if (!files.length) { U.toast('Choose an image first'); return false; }
        for (const file of files) db().photos.unshift({ id: U.uid('p'), src: await U.readImage(file, 1000, 0.72), caption: f.caption.value.trim(), date: U.today() });
        return `${files.length} photo(s) added`;
      },
      delPhoto(el) { db().photos = db().photos.filter((p) => p.id !== el.dataset.id); return 'Photo removed'; },
    },
  };

  // =====================================================================
  // TODAY — day plan, completion tracking, print & message
  // =====================================================================
  Views.today = {
    render(ctx) {
      const d = db(); const date = ui.day;
      let list = S.sessionsOn(date);
      const mineCrews = ctx.athleteId ? S.athleteEvents(ctx.athleteId).map((e) => e.id) : null;
      const filter = ui.crewFilter;
      if (filter) list = list.filter((s) => S.sessionCrews(s).includes(filter));
      const marks = d.attendance[date] || {};
      const counts = { P: 0, L: 0, A: 0, E: 0 }; Object.values(marks).forEach((m) => { counts[m] = (counts[m] || 0) + 1; });
      const msg = UI.dayMessage(date, filter);
      const allSessions = S.sessionsOn(date);
      return `
      <div class="section-title"><h2>${date === U.today() ? 'Today' : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2><span class="spacer"></span>
        <div class="btn-row no-print"><button class="btn ghost sm" data-act="dayNav" data-n="-1">◀</button>
          <input type="date" value="${date}" data-change="dayPick" style="width:auto">
          <button class="btn ghost sm" data-act="dayNav" data-n="1">▶</button><button class="btn ghost sm" data-act="dayNav" data-n="0">Today</button>
          <select data-change="crewFilter" style="width:auto"><option value="">All crews</option>${d.events.map((e) => opt(e.id, e.code, filter)).join('')}</select></div></div>
      ${mineCrews ? `<div class="notice" style="margin-bottom:12px">Your crews: ${chips(mineCrews)} — sessions for all of your boats are shown on <a href="#me">My Page</a>.</div>` : ''}
      <div class="grid g3">
        <div class="span2">
          ${list.length ? list.map((s) => this.sessionCard(s, date, ctx, allSessions)).join('') : `<div class="card">${empty('No training scheduled for this day.')}</div>`}
        </div>
        <div>
          <div class="card no-print"><div class="card-head"><h3>Send to the team</h3></div>
            <textarea id="dayMsg" readonly style="min-height:220px;font-size:.82rem">${esc(msg)}</textarea>
            <div class="btn-row" style="margin-top:8px">
              <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a>
              <button class="btn ghost" data-act="copyMsg">Copy</button>
              <button class="btn ghost" data-act="shareMsg">Share…</button>
              <button class="btn ghost" data-act="printDay">Print</button></div>
            <small>WhatsApp opens with the message ready — pick the team group and send.</small></div>
          <div class="card" style="margin-top:12px"><div class="card-head"><h3>Attendance</h3><span class="spacer"></span>${ctx.entry ? '<a href="#daily">Enter →</a>' : ''}</div>
            ${Object.keys(marks).length ? `<div class="btn-row"><span class="badge good">${counts.P} present</span><span class="badge warn">${counts.L} late</span><span class="badge bad">${counts.A} absent</span><span class="badge">${counts.E} excused</span></div>` : empty('Not entered yet.')}</div>
          <div class="card" style="margin-top:12px"><div class="card-head"><h3>Crews</h3></div>
            <div class="table-wrap"><table>${d.events.filter((e) => !filter || e.id === filter).map((e) => `<tr><td><b>${esc(e.code)}</b></td><td><small>${UI.crewNames(e.id)}</small></td></tr>`).join('')}</table></div></div>
        </div>
      </div>
      <pre class="print-only">${esc(msg)}</pre>`;
    },
    sessionCard(s, date, ctx, all) {
      const crews = S.sessionCrews(s).filter((c) => !ui.crewFilter || c === ui.crewFilter);
      const warn = UI.sessionWarnings(s, all);
      const exc = Object.entries(s.exceptions || {}).filter(([c, t]) => t && crews.includes(c));
      const past = date <= U.today();
      return `<div class="card slot-card t-${s.type}" style="margin-bottom:10px">
        <div class="card-head"><span class="badge dark">${timeRange(s) || 'All day'}</span><h3>${esc(s.title)}</h3><span class="badge">${TYPES[s.type] || s.type}</span>${s.km ? `<span class="badge">${s.km} km</span>` : ''}<span class="spacer"></span>${chips(s.crews)}</div>
        ${s.details ? `<div>${esc(s.details)}</div>` : ''}
        ${exc.length ? `<div class="exceptions">${exc.map(([c, t]) => `<div><b>${esc(S.event(c)?.code)}:</b> ${esc(t)}</div>`).join('')}</div>` : ''}
        ${warn.length ? `<div class="warn-line">⚠ ${warn.map(esc).join(' · ')}</div>` : ''}
        ${s.type !== 'rest' ? `<div class="completion">
          <small class="muted">${past ? 'Completed by crew:' : 'Crews:'}</small>
          ${crews.map((c) => { const m = S.completionOf(date, s.id, c); const code = esc(S.event(c)?.code || c);
            return ctx.entry && past ? `<label class="comp-pick"><span>${code}</span><select data-change="complete" data-s="${s.id}" data-c="${c}" class="comp-${m || 'none'}"><option value="">—</option>${Object.entries(COMP).map(([k, v]) => opt(k, v, m)).join('')}</select></label>`
              : `<span class="chip comp-${m || 'none'}">${code}${m ? ' ' + COMP[m].split(' ')[0] : ''}</span>`; }).join('')}
          ${ctx.entry && past ? `<button class="btn ghost sm" data-act="allDone" data-s="${s.id}">All done</button>` : ''}
        </div>` : ''}
      </div>`;
    },
    act: {
      dayNav(el) { const n = +el.dataset.n; ui.day = n ? U.addDays(ui.day, n) : U.today(); return null; },
      dayPick(el) { if (el.value) ui.day = el.value; return null; },
      crewFilter(el) { ui.crewFilter = el.value; return null; },
      complete(el) {
        const day = (db().completion[ui.day] ||= {}); const ss = (day[el.dataset.s] ||= {});
        if (el.value) ss[el.dataset.c] = el.value; else delete ss[el.dataset.c];
        return true;
      },
      allDone(el) {
        const s = S.sessionsOn(ui.day).find((x) => x.id === el.dataset.s);
        const day = (db().completion[ui.day] ||= {}); const ss = (day[s.id] ||= {});
        S.sessionCrews(s).forEach((c) => { if (!ss[c]) ss[c] = 'done'; });
        return 'Marked done (existing marks kept)';
      },
      async copyMsg() { try { await navigator.clipboard.writeText(U.$('#dayMsg').value); U.toast('Copied — paste into your team chat'); } catch { U.$('#dayMsg').select(); U.toast('Select-all done — press Ctrl/Cmd + C'); } return false; },
      async shareMsg() {
        const text = U.$('#dayMsg').value;
        if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } } else U.toast('Sharing not supported here — use Copy or WhatsApp');
        return false;
      },
      printDay() { document.body.classList.add('print-day'); window.print(); setTimeout(() => document.body.classList.remove('print-day'), 500); return false; },
    },
  };

  // =====================================================================
  // SCHEDULE BOARD + CALENDAR
  // =====================================================================
  function sessionForm(s, isNew) {
    const evs = db().events;
    return `<form><h3>${isNew ? 'Add session' : 'Edit session'}</h3>
      <div class="form">
        <label>Day<select name="day">${U.DAYS.map((x) => opt(x, x, s.day)).join('')}</select></label>
        <label>Start<input type="time" name="start" value="${esc(s.start || '')}"></label>
        <label>End<input type="time" name="end" value="${esc(s.end || '')}"></label>
        <label>Type<select name="type">${Object.entries(TYPES).map(([k, v]) => opt(k, v, s.type)).join('')}</select></label>
        <label>Planned km<input type="number" step="0.5" min="0" name="km" value="${esc(s.km ?? '')}"></label>
        <label class="full">Title<input name="title" required value="${esc(s.title || '')}" placeholder="Water — steady state"></label>
        <label class="full">Details<textarea name="details" placeholder="3 × 4 km UT2 @ r20">${esc(s.details || '')}</textarea></label>
      </div>
      <fieldset class="crew-pick"><legend>Which crews?</legend>
        <label class="check"><input type="checkbox" name="all" ${!s.crews?.length ? 'checked' : ''}> <b>Whole squad</b> (overall plan)</label>
        <div class="checks">${evs.map((e) => `<label class="check"><input type="checkbox" name="crew" value="${e.id}" ${s.crews?.includes(e.id) ? 'checked' : ''}> ${esc(e.code)}</label>`).join('')}</div>
        <small>Tick specific boats to give them their own session (e.g. technical work while the rest follow the main plan).</small>
      </fieldset>
      <details ${Object.values(s.exceptions || {}).some(Boolean) ? 'open' : ''}><summary><b>Exceptions</b> — different instructions for a crew within this session</summary>
        <div class="form" style="margin-top:8px">${evs.map((e) => `<label>${esc(e.code)}<input name="exc_${e.id}" value="${esc(s.exceptions?.[e.id] || '')}" placeholder="e.g. technical only"></label>`).join('')}</div></details>
      <div class="btn-row" style="margin-top:14px"><button class="btn" value="save">Save</button>
        ${isNew ? '' : '<button class="btn ghost" value="dup">Save as copy</button><button class="btn danger" value="del" formnovalidate>Delete</button>'}
        <button type="button" class="btn ghost" data-close>Cancel</button></div></form>`;
  }
  function readSession(f, base) {
    const v = U.formData(f);
    const crews = f.all.checked ? [] : U.$$('input[name="crew"]:checked', f).map((x) => x.value);
    const exceptions = {}; db().events.forEach((e) => { const t = f.elements['exc_' + e.id].value.trim(); if (t) exceptions[e.id] = t; });
    return { ...base, day: v.day, start: v.start, end: v.end, type: v.type, km: v.km ? Number(v.km) : 0, title: v.title, details: v.details, crews, exceptions };
  }
  function openSession(id) {
    const wk = (db().weeks[ui.week] ||= { focus: '', sessions: [] });
    const s = id ? wk.sessions.find((x) => x.id === id) : { day: 'Mon', start: '14:30', end: '16:30', type: 'water', crews: [], exceptions: {}, km: 0 };
    UI.modal(sessionForm(s, !id), { wide: true, onSubmit: (f, btn) => {
      const which = btn?.value || 'save';
      if (which === 'del') { wk.sessions = wk.sessions.filter((x) => x !== s); App.commit('Session deleted'); return; }
      if (!f.reportValidity()) return false;
      const ns = readSession(f, s);
      if (which === 'dup' || !id) wk.sessions.push({ ...ns, id: U.uid('s') });
      else Object.assign(s, ns);
      const w = UI.sessionWarnings(which === 'dup' || !id ? wk.sessions[wk.sessions.length - 1] : s, wk.sessions);
      App.commit(w.length ? 'Saved — check: ' + w[0] : 'Session saved');
    } });
  }

  // ----- rule-based training suggestions -----
  function phaseInfo() {
    const days = UI.daysToRegatta();
    if (days === null || days < 0) return { key: 'off', label: 'Off-season / rebuild', factor: 0.9 };
    if (days > 84) return { key: 'base', label: 'Base (aerobic & technique)', factor: 1.0 };
    if (days > 42) return { key: 'build', label: 'Build (threshold & strength)', factor: 0.95 };
    if (days > 14) return { key: 'race', label: 'Race preparation', factor: 0.85 };
    return { key: 'taper', label: 'Taper & sharpen', factor: 0.65 };
  }
  function suggest() {
    const d = db(); const st = d.settings; const ph = phaseInfo();
    const groups = {};
    const recent = U.addDays(U.today(), -14);
    d.events.forEach((e) => {
      const c = d.crews[e.id]; if (!c || !c.seats.some(Boolean)) return;
      const sum = S.eventSummary(e.id);
      const gap = sum.count && e.record ? (sum.gapBest / e.record) * 100 : null;
      const flagged = [...c.seats, c.cox].filter(Boolean).filter((id) => S.rhrFlag(id));
      const comp = S.crewCompletion(e.id, recent);
      let cat = flagged.length ? 'recovery' : gap === null ? 'baseline' : gap > 5 ? 'aerobic' : gap > 2 ? 'racepace' : 'speed';
      if (ph.key === 'base' && cat === 'speed') cat = 'racepace';
      (groups[cat] ||= []).push({ e, gap, flagged, comp });
    });
    const T = {
      recovery: { type: 'water', title: 'Water — light technical paddle', details: 'Steady r16–18, pause and feet-out drills. Keep it easy for athletes with raised resting HR.', km: 7 },
      baseline: { type: 'test', title: 'Time test — 1000 yd', details: 'Race-distance time test to set a baseline, then 3 km easy paddle.', km: 5 },
      aerobic: { type: 'water', title: 'Water — aerobic base', details: '3 × 5 km UT2 @ r18–20, focus on length, ratio and catch timing.', km: 15 },
      racepace: { type: 'water', title: 'Water — race-pace pieces', details: '5 × 1000 yd @ race rate −2, 4 min easy between; record splits and rate.', km: 10 },
      speed: { type: 'water', title: 'Water — starts & speed', details: '10 × 20-stroke starts, 4 × 500 m at race rate with full recovery.', km: 8 },
    };
    const REASON = {
      recovery: (g) => `Raised resting HR: ${g.flatMap((x) => x.flagged).map(S.short).join(', ')}.`,
      baseline: () => 'No time test logged yet for these boats.',
      aerobic: (g) => `More than 5% off the course record (${g.map((x) => `${x.e.code} ${round(x.gap, 1)}%`).join(', ')}) — build the aerobic engine.`,
      racepace: (g) => `Within 2–5% of the record (${g.map((x) => `${x.e.code} ${round(x.gap, 1)}%`).join(', ')}) — sharpen race rhythm.`,
      speed: (g) => `Within 2% of the record (${g.map((x) => `${x.e.code} ${round(x.gap, 1)}%`).join(', ')}) — speed and starts.`,
    };
    const wk = d.weeks[ui.week] || { sessions: [] };
    const out = [];
    const rs = U.minutes(st.rowStart) + 30;
    Object.entries(groups).forEach(([cat, g]) => {
      const crews = g.map((x) => x.e.id);
      // the weekday with the fewest crew-specific water sessions for these crews
      const day = ['Tue', 'Wed', 'Thu', 'Mon', 'Fri'].map((dy) => ({ dy, n: wk.sessions.filter((s) => s.day === dy && s.crews?.some((c) => crews.includes(c))).length })).sort((a, b) => a.n - b.n)[0].dy;
      const t = T[cat];
      const lowComp = g.filter((x) => x.comp !== null && x.comp < 80).map((x) => x.e.code);
      out.push({ ...t, km: Math.round(t.km * ph.factor), crews, day, start: U.hhmm(rs), end: U.hhmm(Math.min(rs + 120, U.minutes(st.rowEnd))),
        reason: REASON[cat](g) + (lowComp.length ? ` Completion under 80% recently: ${lowComp.join(', ')}.` : '') });
    });
    const fit = { base: ['Fitness — strength endurance circuit', '3 rounds: squats, bench pulls, lunges, core — 45 s on / 15 s off'], build: ['Fitness — max strength', 'Deadlift / squat 5 × 5, pull-ups, core'], race: ['Fitness — power', 'Box jumps, power cleans (light), med-ball throws, core'], taper: ['Fitness — mobility & activation', '30 min mobility, band work, light core'], off: ['Fitness — general conditioning', 'Circuit + 5 km run'] }[ph.key];
    const fe = U.minutes(st.rowEnd);
    out.push({ type: 'gym', title: fit[0], details: fit[1], km: 0, crews: [], day: 'Wed', start: U.hhmm(fe), end: U.hhmm(Math.min(fe + 60, U.minutes(st.fitnessEnd))), reason: `Squad fitness for the ${ph.label.toLowerCase()} phase, after rowing.` });
    return { phase: ph, items: out };
  }
  function claudePrompt() {
    const d = db(); const st = d.settings; const ph = phaseInfo(); const wk = d.weeks[ui.week];
    const crews = d.events.map((e) => {
      const sum = S.eventSummary(e.id); const c = d.crews[e.id];
      return `- ${e.code} (${e.name}, ${e.points ?? 0} pts): crew ${c ? c.seats.filter(Boolean).length : 0} rowers; best ${sum.count ? fmtTime(sum.best.t) : 'n/a'} vs record ${e.record ? fmtTime(e.record) : 'n/a'}${sum.gapBest != null ? ` (+${round(sum.gapBest, 1)} s)` : ''}; training completion last 2 wks ${S.crewCompletion(e.id, U.addDays(U.today(), -14)) ?? 'n/a'}%`;
    }).join('\n');
    const flags = d.athletes.filter((a) => S.rhrFlag(a.id)).map((a) => a.name);
    const plan = wk ? wk.sessions.map((s) => `${s.day} ${s.start}-${s.end} ${s.title} [${crewCodes(s.crews)}] ${s.km ? s.km + ' km' : ''}`).join('\n') : 'none yet';
    return `I coach the S. Thomas' College (Sri Lanka) schoolboy rowing squad. Main event: the Royal Thomian Regatta over 1000 yards (914.4 m) on Beira Lake, in ${UI.daysToRegatta()} days. Training phase: ${ph.label}.
Training time: weekdays after school, rowing ${U.fmt12(st.rowStart)}–${U.fmt12(st.rowEnd)}, then fitness until ${U.fmt12(st.fitnessEnd)}; Saturday mornings available; Sunday rest.
Crews and status:
${crews}
Athletes with raised resting heart rate: ${flags.join(', ') || 'none'}.
Current plan for the week of ${fmtDate(ui.week)}:
${plan}

Please suggest a training week: for each day give session times within the windows above, which crews (whole squad or specific boats), session type (water/erg/fitness), the workout (distances, rates, rest) and planned km. Give crews that are further off the record more aerobic work and crews close to the record more race-pace and speed work. Present it as a table I can copy into my schedule.`;
  }

  Views.schedule = {
    render(ctx) {
      const d = db(); const wk = d.weeks[ui.week] || { focus: '', sessions: [] };
      const weekEnd = U.addDays(ui.week, 6); const filter = ui.crewFilter;
      const visible = wk.sessions.filter((s) => !filter || S.sessionCrews(s).includes(filter));
      const kmByCrew = d.events.map((e) => ({ e, km: wk.sessions.filter((s) => S.sessionCrews(s).includes(e.id)).reduce((t, s) => t + (Number(s.km) || 0), 0) }));
      const warnings = wk.sessions.map((s) => ({ s, w: UI.sessionWarnings(s, wk.sessions) })).filter((x) => x.w.length);
      const st = d.settings;
      return `
      <div class="section-title"><h2>Weekly schedule</h2><span class="spacer"></span>
        <div class="btn-row"><button class="btn ghost sm" data-act="weekNav" data-n="-7">◀ Prev</button>
        <b>${fmtShort(ui.week)} – ${fmtDate(weekEnd)}</b>
        <button class="btn ghost sm" data-act="weekNav" data-n="7">Next ▶</button>
        <button class="btn ghost sm" data-act="weekNav" data-n="0">This week</button>
        <select data-change="crewFilter" style="width:auto"><option value="">All crews</option>${d.events.map((e) => opt(e.id, 'Only ' + e.code, filter)).join('')}</select></div></div>
      <div class="card" style="margin-bottom:12px">
        <div class="btn-row"><b>Week focus:</b> ${ctx.coach ? `<form data-form="setFocus" class="btn-row" style="flex:1"><input name="focus" value="${esc(wk.focus || '')}" placeholder="e.g. Aerobic base + technique" style="flex:1;min-width:200px"><button class="btn sm">Save</button></form>` : `<span>${esc(wk.focus || '—')}</span>`}</div>
        <div class="btn-row" style="margin-top:8px"><span class="muted">Training window:</span> rowing <b>${U.fmt12(st.rowStart)}–${U.fmt12(st.rowEnd)}</b>, fitness until <b>${U.fmt12(st.fitnessEnd)}</b> on weekdays.</div>
        <div class="btn-row" style="margin-top:6px"><span class="muted">Planned km:</span> ${kmByCrew.map((x) => `<span class="chip">${esc(x.e.code)} ${round(x.km, 1)} km</span>`).join('')}</div>
        ${warnings.length ? `<div class="warn-line" style="margin-top:8px">⚠ ${warnings.map((x) => `<b>${x.s.day} ${esc(x.s.title)}</b>: ${x.w.map(esc).join(', ')}`).join(' · ')}</div>` : ''}
      </div>
      ${ctx.coach ? `<div class="btn-row no-print" style="margin-bottom:10px"><button class="btn" data-act="addSession">+ Add session</button>
        <button class="btn ghost" data-act="copyWeek">Copy previous week</button>
        <button class="btn ghost" data-act="suggest">✨ Suggest sessions</button>
        <button class="btn danger" data-act="clearWeek">Clear week</button>
        <span class="muted">Drag cards between days · click a card to edit, assign crews or add exceptions</span></div>` : ''}
      ${ctx.coach && ui.suggestions ? this.suggestions() : ''}
      <div class="week board">${U.DAYS.map((day, i) => {
        const date = U.addDays(ui.week, i);
        const ss = visible.filter((s) => s.day === day).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
        return `<div class="day ${date === U.today() ? 'today' : ''}" data-day="${day}"><h4><span>${day}</span><small>${fmtShort(date)}</small></h4>
          ${ss.map((s) => {
            const w = UI.sessionWarnings(s, wk.sessions);
            const cr = S.sessionCrews(s); const done = cr.filter((c) => S.completionOf(date, s.id, c) === 'done').length;
            const marked = cr.filter((c) => S.completionOf(date, s.id, c)).length;
            return `<div class="slot t-${s.type}" ${ctx.coach ? `draggable="true" data-act="editSession"` : ''} data-id="${s.id}">
              <b>${timeRange(s)}</b><b>${esc(s.title)}</b>
              <div class="chips">${chips(s.crews)}</div>
              ${s.km ? `<small>${s.km} km</small> ` : ''}${Object.values(s.exceptions || {}).some(Boolean) ? '<small title="Has crew exceptions">✱ exceptions</small> ' : ''}
              ${marked ? `<small class="${done === cr.length ? 'up' : 'flat'}">${done}/${cr.length} done</small>` : ''}
              ${w.length ? `<small class="down" title="${esc(w.join('; '))}">⚠</small>` : ''}</div>`;
          }).join('') || '<small class="muted">—</small>'}</div>`;
      }).join('')}</div>
      ${this.calendar(ctx)}`;
    },
    suggestions() {
      const sg = ui.suggestions;
      return `<div class="card coach-only" style="margin-bottom:12px"><div class="card-head"><h3>✨ Suggested sessions</h3><span class="badge">${esc(sg.phase.label)}</span><span class="spacer"></span>
        <a class="btn sm" target="_blank" rel="noopener" href="https://claude.ai/new?q=${encodeURIComponent(claudePrompt())}">Ask Claude for a full week →</a>
        <button class="btn ghost sm" data-act="copyPrompt">Copy AI prompt</button><button class="icon-btn" data-act="closeSuggest">✕</button></div>
        <p class="muted" style="margin-top:0">Based on days to the regatta, each crew's gap to the course record, recent training completion and resting-HR flags. Add any to this week, then drag or edit as needed.</p>
        <div class="table-wrap"><table><tr><th>Day</th><th>Time</th><th>Session</th><th>Crews</th><th class="num">km</th><th>Why</th><th></th></tr>
        ${sg.items.map((x, i) => `<tr><td>${x.day}</td><td>${U.fmt12(x.start)}–${U.fmt12(x.end)}</td><td><b>${esc(x.title)}</b><br><small>${esc(x.details)}</small></td><td>${chips(x.crews)}</td><td class="num">${x.km || ''}</td><td><small>${esc(x.reason)}</small></td><td><button class="btn sm" data-act="addSuggestion" data-i="${i}">Add</button></td></tr>`).join('')}
        </table></div></div>`;
    },
    calendar(ctx) {
      const d = db();
      const [y, m] = ui.month.split('-').map(Number);
      const gridStart = U.mondayOf(`${ui.month}-01`);
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
      const LEG = { regatta: '#c8312e', trial: '#7b3fe4', timetest: '#c27a00', session: '#1f6fd1', meeting: '#0d0f14', other: '#5d6b82' };
      return `
      <div class="section-title" style="margin-top:26px"><h2>Calendar</h2><span class="spacer"></span>
        <div class="btn-row"><button class="btn ghost sm" data-act="monthNav" data-n="-1">◀</button><b>${U.MONTHS[m - 1]} ${y}</b><button class="btn ghost sm" data-act="monthNav" data-n="1">▶</button>
        <button class="btn ghost sm" data-act="monthNav" data-n="0">Today</button></div></div>
      <div class="card">
        <div class="legend" style="margin-bottom:8px">${Object.entries(CAL_TYPES).map(([k, v]) => `<span style="--c:${LEG[k]}">${v}</span>`).join('')}</div>
        <div class="cal">${U.DAYS.map((x) => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div>
      </div>
      <div class="grid ${ctx.coach ? 'g2' : ''}" style="margin-top:12px">
        <div class="card"><div class="card-head"><h3>Events in ${U.MONTHS[m - 1]}</h3></div>
          ${monthEvents.length ? `<div class="table-wrap"><table><tr><th>Date</th><th>Event</th><th>Type</th>${ctx.coach ? '<th></th>' : ''}</tr>${monthEvents.map((e) => `<tr><td>${fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td><b>${esc(e.title)}</b>${e.notes ? `<br><small>${esc(e.notes)}</small>` : ''}</td><td><span class="ev ${e.type}" style="display:inline-block">${CAL_TYPES[e.type] || e.type}</span></td>${ctx.coach ? `<td>${e.id !== 'rtr' ? `<button class="icon-btn" data-act="delEvent" data-id="${e.id}">✕</button>` : ''}</td>` : ''}</tr>`).join('')}</table></div>` : empty('No events this month.')}
        </div>
        ${ctx.coach ? roleCard('Add calendar event', `<form class="form" data-form="addEvent">
          <label>Date<input type="date" name="date" value="${U.today()}" required></label>
          <label>Type<select name="type">${Object.entries(CAL_TYPES).map(([k, v]) => opt(k, v)).join('')}</select></label>
          <label class="full">Title<input name="title" required placeholder="Trial regatta vs …"></label>
          <label class="full">Notes<input name="notes"></label>
          <div><button class="btn">Add event</button></div></form>`) : ''}
      </div>`;
    },
    mount(root, ctx) {
      if (!ctx.coach) return;
      let dragId = null;
      U.$$('.board .slot[draggable]', root).forEach((el) => {
        el.addEventListener('dragstart', (e) => { dragId = el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
        el.addEventListener('dragend', () => { el.classList.remove('dragging'); U.$$('.day.drop', root).forEach((x) => x.classList.remove('drop')); });
      });
      U.$$('.board .day', root).forEach((col) => {
        col.addEventListener('dragover', (e) => { if (!dragId) return; e.preventDefault(); col.classList.add('drop'); });
        col.addEventListener('dragleave', () => col.classList.remove('drop'));
        col.addEventListener('drop', (e) => {
          e.preventDefault(); col.classList.remove('drop');
          const s = db().weeks[ui.week]?.sessions.find((x) => x.id === dragId); dragId = null;
          if (!s || s.day === col.dataset.day) return;
          s.day = col.dataset.day;
          const w = UI.sessionWarnings(s, db().weeks[ui.week].sessions);
          App.commit(`Moved to ${s.day}${w.length ? ' — check: ' + w[0] : ''}`);
        });
      });
    },
    act: {
      weekNav(el) { const n = +el.dataset.n; ui.week = n ? U.addDays(ui.week, n) : U.mondayOf(U.today()); ui.suggestions = null; return null; },
      crewFilter(el) { ui.crewFilter = el.value; return null; },
      monthNav(el) {
        const n = +el.dataset.n; if (!n) { ui.month = U.today().slice(0, 7); return null; }
        const [y, m] = ui.month.split('-').map(Number); const dt = new Date(y, m - 1 + n, 1);
        ui.month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; return null;
      },
      setFocus(f) { const w = (db().weeks[ui.week] ||= { focus: '', sessions: [] }); w.focus = f.focus.value.trim(); return 'Focus saved'; },
      addSession() { openSession(null); return false; },
      editSession(el) { openSession(el.dataset.id); return false; },
      copyWeek() {
        const prev = db().weeks[U.addDays(ui.week, -7)];
        if (!prev) { U.toast('No plan in the previous week to copy'); return false; }
        const cur = db().weeks[ui.week];
        if (cur && cur.sessions.length && !confirm('Replace this week\'s sessions with last week\'s?')) return false;
        db().weeks[ui.week] = { focus: prev.focus, sessions: prev.sessions.map((s) => ({ ...JSON.parse(JSON.stringify(s)), id: U.uid('s') })) };
        return 'Copied — now drag sessions around or edit them';
      },
      clearWeek() { if (!confirm('Remove all sessions this week?')) return false; delete db().weeks[ui.week]; return 'Week cleared'; },
      suggest() { ui.suggestions = suggest(); return null; },
      closeSuggest() { ui.suggestions = null; return null; },
      addSuggestion(el) {
        const x = ui.suggestions.items[+el.dataset.i];
        const w = (db().weeks[ui.week] ||= { focus: '', sessions: [] });
        w.sessions.push({ id: U.uid('s'), day: x.day, start: x.start, end: x.end, type: x.type, title: x.title, details: x.details, km: x.km, crews: [...x.crews], exceptions: {} });
        ui.suggestions.items.splice(+el.dataset.i, 1);
        return 'Added to ' + x.day;
      },
      async copyPrompt() { try { await navigator.clipboard.writeText(claudePrompt()); U.toast('Prompt copied — paste it into Claude'); } catch { U.toast('Could not copy'); } return false; },
      addEvent(f) { db().calendar.push({ id: U.uid('e'), ...U.formData(f) }); return 'Event added'; },
      delEvent(el) { db().calendar = db().calendar.filter((e) => e.id !== el.dataset.id); return 'Event removed'; },
    },
  };
})();
