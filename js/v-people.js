/* Daily entry (attendance + resting HR + session completion), athlete pages ("My Page" and the
   coach/advisory athlete dashboard) and crew selection. */
(() => {
  const { esc, fmtTime, fmtDate, fmtShort, round } = U;
  const S = Store, ui = UI.state;
  const db = () => S.db;
  const { kpi, opt, empty, roleCard, chart, COLORS, timeTicks, timeTooltip, avatar, delta, metricFmt, athleteOptions, canRow, canCox, crewCodes } = UI;
  const SOURCES = ['Manual', 'Garmin', 'Whoop', 'Apple Watch', 'Polar', 'Fitbit', 'Other device'];
  const ATT = { P: 'Present', L: 'Late', A: 'Absent', E: 'Excused' };
  const chips = (evs) => evs.map((e) => `<span class="chip">${esc(e.code)}</span>`).join('');

  // =====================================================================
  // DAILY ENTRY (coach + data-entry)
  // =====================================================================
  Views.daily = {
    render(ctx) {
      const d = db(); const date = ui.entryDate;
      const marks = d.attendance[date] || {};
      const sessions = S.sessionsOn(date).filter((s) => s.type !== 'rest');
      const days = Object.keys(d.attendance).sort().slice(-14);
      const from28 = U.addDays(U.today(), -28);
      const low = d.athletes.filter((a) => (S.attendancePct(a.id, from28) ?? 100) < 80);
      const rhrCount = d.athletes.filter((a) => S.onDate(a.id, 'rhr', date)).length;
      return `
      <div class="section-title"><h2>Daily entry</h2><span class="spacer"></span>
        <div class="btn-row"><button class="btn ghost sm" data-act="dNav" data-n="-1">◀</button><input type="date" value="${date}" max="${U.today()}" data-change="dPick" style="width:auto"><button class="btn ghost sm" data-act="dNav" data-n="1">▶</button><button class="btn ghost sm" data-act="dNav" data-n="0">Today</button></div></div>
      <div class="notice" style="margin-bottom:12px">Fill in attendance and each rower's resting heart rate (taken on waking), then tick off which crews completed each session. Athletes can also enter their own resting HR from their login — those values appear here automatically.</div>
      <form data-form="saveDay">
        <div class="card">
          <div class="card-head"><h3>Attendance &amp; resting HR — ${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</h3><span class="spacer"></span>
            <span class="muted">${Object.keys(marks).length}/${d.athletes.length} marked · ${rhrCount} HR entered</span>
            <button type="button" class="btn ghost sm" id="allP">Everyone present</button></div>
          <div class="table-wrap"><table class="entry"><tr><th>Athlete</th><th>Crews</th><th>Attendance</th><th>Resting HR (bpm)</th><th>Source</th></tr>
          ${d.athletes.map((a) => { const r = S.onDate(a.id, 'rhr', date); const flag = S.rhrFlag(a.id); return `<tr>
            <td><b>${esc(a.name)}</b></td><td>${chips(S.athleteEvents(a.id))}</td>
            <td class="att-radios">${Object.entries(ATT).map(([k, v]) => `<label class="att-r att-${k}" title="${v}"><input type="radio" name="att_${a.id}" value="${k}" ${marks[a.id] === k ? 'checked' : ''}><span>${k}</span></label>`).join('')}
              <label class="att-r clear" title="Clear"><input type="radio" name="att_${a.id}" value=""><span>–</span></label></td>
            <td><input type="number" min="30" max="120" name="rhr_${a.id}" value="${r?.value ?? ''}" style="width:90px">${flag && date === U.today() ? ` <span class="badge warn" title="Above baseline ${flag.base}">+${flag.diff}</span>` : ''}</td>
            <td><select name="src_${a.id}" style="width:130px">${SOURCES.map((x) => opt(x, x, r?.source || 'Manual')).join('')}</select></td></tr>`; }).join('')}
          </table></div>
        </div>
        ${sessions.length ? `<div class="card" style="margin-top:12px"><div class="card-head"><h3>Which crews did the training?</h3></div>
          <div class="table-wrap"><table><tr><th>Session</th><th>Crews</th></tr>${sessions.map((s) => `<tr><td><b>${U.fmt12(s.start)}</b> ${esc(s.title)}${s.km ? ` <small>${s.km} km</small>` : ''}</td><td class="btn-row">
            ${S.sessionCrews(s).map((c) => { const m = S.completionOf(date, s.id, c); return `<label class="comp-pick"><span>${esc(S.event(c)?.code)}</span><select name="comp_${s.id}_${c}"><option value="">—</option>${['done', 'partial', 'missed'].map((k) => opt(k, { done: '✓ Done', partial: '½ Partial', missed: '✗ Missed' }[k], m)).join('')}</select></label>`; }).join('')}</td></tr>`).join('')}</table></div>
          <small>Unmarked past sessions count as completed when working out each athlete's km.</small></div>` : ''}
        <div class="btn-row" style="margin-top:12px"><button class="btn">Save ${date === U.today() ? "today's" : 'this day\'s'} entries</button></div>
      </form>
      <div class="grid g4" style="margin-top:20px">
        ${kpi('Squad — last 4 weeks', (S.squadAttendance(from28) ?? '—') + '%')}
        ${kpi('Squad — season', (S.squadAttendance() ?? '—') + '%')}
        ${kpi('Training days logged', Object.keys(d.attendance).length)}
        ${kpi('Below 80% (4 wks)', low.length, low.map((a) => esc(S.short(a.id))).join(', ') || 'everyone above 80%', low.length ? 'down' : 'up')}
      </div>
      <div class="grid g3" style="margin-top:16px">
        <div class="card span2"><div class="card-head"><h3>Last ${days.length} training days</h3></div>
          <div class="table-wrap"><table><tr><th>Athlete</th>${days.map((x) => `<th class="att-cell">${fmtDate(x, { day: 'numeric', month: 'numeric' })}</th>`).join('')}<th class="num">%</th></tr>
          ${d.athletes.map((a) => `<tr><td style="white-space:nowrap">${esc(S.short(a.id))}</td>${days.map((x) => { const k = d.attendance[x]?.[a.id] || ''; return `<td class="att-cell"><span class="att-btn ${k ? 'att-' + k : ''}">${k}</span></td>`; }).join('')}
            <td class="num"><b>${S.attendancePct(a.id) ?? '—'}%</b></td></tr>`).join('')}</table></div></div>
        <div class="card"><div class="card-head"><h3>Weekly squad attendance</h3></div><div class="chart-box tall"><canvas id="attWeek"></canvas></div></div>
      </div>`;
    },
    mount(root) {
      U.$('#allP', root)?.addEventListener('click', () => {
        db().athletes.forEach((a) => { if (!U.$(`input[name="att_${a.id}"]:checked`, root) || U.$(`input[name="att_${a.id}"]:checked`, root).value === '') U.$(`input[name="att_${a.id}"][value="P"]`, root).checked = true; });
      });
      const aw = S.attendanceByWeek(10);
      chart('attWeek', { type: 'line', data: { labels: aw.map((x) => fmtShort(x.week)), datasets: [{ label: 'Attendance %', data: aw.map((x) => x.pct), borderColor: COLORS[1], backgroundColor: COLORS[1] + '22', fill: true, tension: .3, spanGaps: true }] }, options: { scales: { y: { min: 50, max: 100 } }, plugins: { legend: { display: false } } } });
    },
    act: {
      dNav(el) { const n = +el.dataset.n; ui.entryDate = n ? U.addDays(ui.entryDate, n) : U.today(); if (ui.entryDate > U.today()) ui.entryDate = U.today(); return null; },
      dPick(el) { if (el.value) ui.entryDate = el.value; return null; },
      saveDay(f, ctx) {
        const d = db(); const date = ui.entryDate; let a = 0, h = 0;
        const day = (d.attendance[date] ||= {});
        d.athletes.forEach((x) => {
          const r = U.$(`input[name="att_${x.id}"]:checked`, f);
          if (r) { if (r.value) { day[x.id] = r.value; a++; } else delete day[x.id]; }
          const v = f.elements['rhr_' + x.id].value;
          const ex = S.onDate(x.id, 'rhr', date);
          if (v !== '' || ex) { S.setMetric(x.id, 'rhr', date, v === '' ? null : Number(v), { source: f.elements['src_' + x.id].value, enteredBy: ctx.userName || ctx.role }); if (v !== '') h++; }
        });
        if (!Object.keys(day).length) delete d.attendance[date];
        U.$$('select[name^="comp_"]', f).forEach((sel) => {
          const [, sid, ...rest] = sel.name.split('_'); const cid = rest.join('_');
          const c = (d.completion[date] ||= {}); const ss = (c[sid] ||= {});
          if (sel.value) ss[cid] = sel.value; else delete ss[cid];
        });
        return `Saved — ${a} attendance marks, ${h} heart rates`;
      },
    },
  };

  // =====================================================================
  // ATHLETE PAGE (shared by "My Page" and the athlete dashboard)
  // =====================================================================
  function profile(a, ctx) {
    const own = ctx.role === 'athlete' && ctx.athleteId === a.id;
    const cox = S.isCox(a);
    const evs = S.athleteEvents(a.id);
    const mon = U.mondayOf(U.today());
    const kmW = S.kmWeek(a.id, mon), kmPrev = S.kmWeek(a.id, U.addDays(mon, -7));
    const types = cox ? ['rhr', 'weight'] : ['erg2k', 'vo2', 'rhr'];
    const tiles = [kpi('km this week', kmW, delta(kmW - kmPrev, false, (v) => round(v, 1) + ' km') + ' vs last week')].concat(types.map((t) => {
      const l = S.latest(a.id, t), f = S.first(a.id, t), M = S.METRICS[t];
      return kpi(M.label, metricFmt(t, l?.value), l ? (f && f !== l ? delta(l.value - f.value, M.lowerBetter !== false, (v) => (M.unit === 'time' ? fmtTime(v) : round(v, 1))) + ' since ' + fmtShort(f.date) : 'tested ' + fmtShort(l.date)) : 'no data');
    })).join('');
    const flag = S.rhrFlag(a.id);
    const todayRhr = S.onDate(a.id, 'rhr', U.today());
    const races = S.athleteRaces(a.id); const rec = S.record(races);
    const tests = db().results.filter((r) => (r.lineup || []).includes(a.id)).sort((x, y) => y.date.localeCompare(x.date));
    const comments = db().comments.filter((c) => c.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date));
    const logs = db().logs.filter((l) => l.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date));
    const hist = db().metrics.filter((m) => m.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date));
    const pts = S.athletePoints(a.id);
    return `
    <div class="card" style="margin-bottom:16px"><div class="who">${avatar(a, 64)}
      <div style="flex:1"><h2 style="margin:0">${esc(a.name)}</h2><div class="muted">${esc(S.skillText(a))} · ${esc(a.squad)} · ${esc(a.grade || '')} ${a.age ? '· ' + a.age + ' yrs' : ''} ${a.height ? '· ' + a.height + ' cm' : ''}</div>
      <div class="btn-row" style="margin-top:6px">${evs.map((e) => `<span class="badge dark">${esc(e.code)}</span>`).join('') || '<small class="muted">Not in a provisional crew</small>'}
      ${evs.length ? `<span class="badge">${pts} Royal Thomian pts in their boats</span>` : ''}
      <span class="badge ${S.attendancePct(a.id) >= 85 ? 'good' : 'warn'}">Attendance ${S.attendancePct(a.id) ?? '—'}%</span>
      ${rec.n ? `<span class="badge">${rec.w}W – ${rec.l}L this year</span>` : ''}
      ${S.wPerKg(a.id) ? `<span class="badge">${S.wPerKg(a.id)} W/kg</span>` : ''}
      ${flag ? `<span class="badge warn">Resting HR +${flag.diff} bpm vs baseline</span>` : ''}</div></div>
      ${ctx.coach ? `<button class="btn ghost sm" data-act="editAthlete" data-id="${a.id}">Edit profile</button>` : ''}</div></div>

    ${own ? `<div class="grid g2" style="margin-bottom:16px">
      <div class="card coach-only"><div class="card-head"><h3>Today's resting heart rate</h3><span class="spacer"></span><span class="coach-tag">${fmtShort(U.today())}</span></div>
        <form class="form" data-form="myRhr"><label>Resting HR (bpm)<input type="number" min="30" max="120" name="value" required value="${todayRhr?.value ?? ''}"></label>
          <label>From<select name="source">${SOURCES.map((x) => opt(x, x, todayRhr?.source || 'Manual')).join('')}</select></label>
          <div><button class="btn">${todayRhr ? 'Update' : 'Save'}</button></div>
          <small class="full">Take it on waking, before getting up. Copy the number from your watch (Garmin, Whoop…) or count your pulse for 60 s.</small></form></div>
      <div class="card coach-only"><div class="card-head"><h3>Training log</h3><span class="spacer"></span><span class="coach-tag">How did it go?</span></div>
        <form class="form" data-form="addLog"><label>Date<input type="date" name="date" value="${U.today()}" max="${U.today()}"></label>
          <label>Effort (1–10)<input type="number" name="rpe" min="1" max="10" placeholder="7"></label>
          <label>Extra km (own training)<input type="number" step="0.5" min="0" name="km" placeholder="0"></label>
          <label class="full">What you did / what you're working on<textarea name="text" required placeholder="Felt strong on race pieces. Working on a slower slide."></textarea></label>
          <div><button class="btn">Add to log</button></div></form></div>
    </div>` : ''}

    <div class="grid g4">${tiles}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h3>This week's training</h3><span class="spacer"></span><small class="muted">all sessions for ${evs.length ? 'your boats' : 'the squad'}</small></div>${weekPlan(a)}</div>
      <div class="card"><div class="card-head"><h3>km rowed per week</h3></div><div class="chart-box"><canvas id="athKm"></canvas></div>
        <small>Planned km of the sessions their crew completed on days they attended, plus km they logged themselves.</small></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h3>Coach feedback</h3><span class="spacer"></span><small class="muted">${comments.filter((c) => !c.done).length} to work on</small></div>
        ${ctx.coach ? `<form class="form" data-form="addComment" style="margin-bottom:10px"><label>Focus<select name="focus">${['Technical', 'Fitness', 'Racing', 'General'].map((x) => opt(x, x)).join('')}</select></label>
          <label class="full">Comment<textarea name="text" required placeholder="What to fix and how…"></textarea></label><div><button class="btn sm">Add feedback</button></div></form>` : ''}
        <div class="feed">${comments.map((c) => `<div class="feed-item ${c.done ? 'done' : ''}"><div class="meta"><b>${fmtDate(c.date)}</b><span class="badge">${esc(c.focus)}</span><span>${esc(c.author)}</span>${c.done ? '<span class="badge good">Fixed</span>' : ''}
          ${ctx.coach ? `<button class="btn ghost sm" data-act="toggleComment" data-id="${c.id}">${c.done ? 'Re-open' : 'Mark fixed'}</button><button class="icon-btn" data-act="delComment" data-id="${c.id}">✕</button>` : ''}</div>${esc(c.text)}</div>`).join('') || empty('No feedback yet.')}</div></div>
      <div class="card"><div class="card-head"><h3>Training log</h3></div>
        <div class="feed">${logs.map((l) => `<div class="feed-item"><div class="meta"><b>${fmtDate(l.date)}</b>${l.rpe ? `<span class="badge">Effort ${l.rpe}/10</span>` : ''}${Number(l.km) ? `<span class="badge">+${l.km} km</span>` : ''}
          ${own || ctx.coach ? `<button class="icon-btn" data-act="delLog" data-id="${l.id}">✕</button>` : ''}</div>${esc(l.text)}</div>`).join('') || empty(own ? 'Add your first entry above.' : 'No log entries yet.')}</div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      ${!cox ? `<div class="card"><div class="card-head"><h3>Erg splits</h3></div><div class="chart-box"><canvas id="athErg"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>VO₂ max</h3></div><div class="chart-box"><canvas id="athVo2"></canvas></div></div>` : ''}
      <div class="card"><div class="card-head"><h3>Resting heart rate</h3></div><div class="chart-box"><canvas id="athRhr"></canvas></div></div>
      <div class="card"><div class="card-head"><h3>Body weight</h3></div><div class="chart-box"><canvas id="athWt"></canvas></div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h3>Race results</h3><span class="spacer"></span>${rec.n ? `<span class="badge good">${rec.w} won</span><span class="badge bad">${rec.l} lost</span>` : ''}</div>
      ${races.length ? `<div class="table-wrap"><table><tr><th>Date</th><th>Regatta</th><th>Race</th><th>Distance</th><th>Crew</th><th class="num">Time</th><th>Result</th></tr>
        ${races.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.regatta)}</td><td>${esc(r.race)}</td><td>${U.fmtDist(r.distance)}</td><td><small>${r.crew.filter((x) => x !== a.id).map(S.short).join(', ') || 'single'}${r.cox && r.cox !== a.id ? ' · cox ' + S.short(r.cox) : ''}</small></td><td class="num">${r.time ? fmtTime(r.time) : '—'}</td><td>${UI.placeText(r)}</td></tr>`).join('')}</table></div>` : empty('No regatta results yet.')}
      ${tests.length ? `<h3 style="margin-top:14px">Boat time tests</h3><div class="table-wrap"><table><tr><th>Date</th><th>Boat</th><th>Distance</th><th class="num">Time</th><th class="num">Split /500m</th><th class="num">vs record</th></tr>
        ${tests.slice(0, 12).map((r) => { const e = S.event(r.eventId); const eq = S.raceEquivalent(r); return `<tr><td>${fmtDate(r.date)}</td><td>${esc(e?.code)}</td><td>${U.fmtDist(r.distance)}</td><td class="num">${fmtTime(r.time)}</td><td class="num">${fmtTime(U.split500(r.time, r.distance))}</td><td class="num">${e?.record ? '+' + round(eq - e.record, 1) + ' s' : '—'}</td></tr>`; }).join('')}</table></div>` : ''}
    </div>
    <div class="grid ${ctx.coach ? 'g2' : ''}" style="margin-top:16px">
      <div class="card"><div class="card-head"><h3>Test history</h3></div>
        <div class="table-wrap" style="max-height:320px"><table><tr><th>Date</th><th>Test</th><th class="num">Result</th><th>Source</th>${ctx.coach ? '<th></th>' : ''}</tr>
        ${hist.map((m) => `<tr><td>${fmtDate(m.date)}</td><td>${S.METRICS[m.type].label}</td><td class="num">${metricFmt(m.type, m.value)}${m.type === 'erg2k' ? ` <small>(${fmtTime(U.split500(m.value, 2000))}/500)</small>` : ''}</td><td><small>${esc(m.source || '')}</small></td>${ctx.coach ? `<td><button class="icon-btn" data-act="delMetric" data-id="${m.id}">✕</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="5">${empty('No tests recorded.')}</td></tr>`}</table></div></div>
      ${ctx.coach ? roleCard('Add a test result for ' + esc(a.name.split(' ')[0]), `
        <form class="form" data-form="addMetric">
          <label>Test<select name="type">${Object.entries(S.METRICS).map(([k, v]) => opt(k, v.label)).join('')}</select></label>
          <label>Date<input type="date" name="date" value="${U.today()}" required></label>
          <label>Value<input name="value" required placeholder="6:45.2 / 55 / 58"></label>
          <div><button class="btn">Add</button></div>
          <small class="full">Erg tests as m:ss.t · VO₂ max in ml/kg/min · resting HR in bpm · weight in kg.</small></form>`) : ''}
    </div>`;
  }
  function weekPlan(a) {
    const mon = U.mondayOf(U.today());
    const rows = U.DAYS.map((day, i) => {
      const date = U.addDays(mon, i);
      const list = S.athleteSessions(a.id, date).filter(({ s }) => s.type !== 'rest');
      if (!list.length) return '';
      return `<tr class="${date === U.today() ? 'today-row' : ''}"><td><b>${day}</b><br><small>${fmtShort(date)}</small></td><td>${list.map(({ s, via, exception }) => {
        const marks = via.map((c) => S.completionOf(date, s.id, c)).filter(Boolean);
        return `<div style="margin-bottom:4px"><b>${U.fmt12(s.start)}</b> ${esc(s.title)} ${via.length ? via.map((c) => `<span class="chip">${esc(S.event(c).code)}</span>`).join('') : '<span class="chip all">squad</span>'}${s.km ? ` <small>${s.km} km</small>` : ''}
          ${exception ? `<div class="exceptions"><b>For you:</b> ${esc(exception)}</div>` : ''}${marks.length ? ` <small class="${marks.includes('done') ? 'up' : 'down'}">${marks.join('/')}</small>` : ''}</div>`;
      }).join('')}</td><td class="num"><small>${date <= U.today() ? round(S.kmOn(a.id, date), 1) + ' km' : ''}</small></td></tr>`;
    }).join('');
    return rows ? `<div class="table-wrap"><table>${rows}</table></div>` : empty('No sessions planned this week.');
  }
  function mountProfile(a) {
    if (!a) return;
    const mon = U.mondayOf(U.today()); const weeks = [];
    for (let w = 7; w >= 0; w--) weeks.push(U.addDays(mon, -7 * w));
    chart('athKm', { type: 'bar', data: { labels: weeks.map(fmtShort), datasets: [{ label: 'km', data: weeks.map((wk) => S.kmWeek(a.id, wk)), backgroundColor: weeks.map((wk) => (wk === mon ? COLORS[2] : COLORS[1])) }] }, options: { plugins: { legend: { display: false } } } });
    const line = (id, type, color) => {
      const s = S.series(a.id, type); if (!s.length) return;
      chart(id, { type: 'line', data: { labels: s.map((m) => fmtShort(m.date)), datasets: [{ label: S.METRICS[type].label, data: s.map((m) => m.value), borderColor: color, backgroundColor: color + '22', fill: true, tension: .15, pointRadius: s.length > 20 ? 2 : 4 }] },
        options: { plugins: { legend: { display: false } } } });
    };
    const e2 = S.series(a.id, 'erg2k'), e5 = S.series(a.id, 'erg5k');
    if (e2.length || e5.length) {
      const dates = [...new Set([...e2, ...e5].map((m) => m.date))].sort();
      const val = (s, d, dist) => { const m = s.find((x) => x.date === d); return m ? round(U.split500(m.value, dist), 1) : null; };
      chart('athErg', { type: 'line', data: { labels: dates.map(fmtShort), datasets: [
        { label: '2k split /500m', data: dates.map((d) => val(e2, d, 2000)), borderColor: COLORS[1], spanGaps: true, tension: .3, pointRadius: 4 },
        { label: '5k split /500m', data: dates.map((d) => val(e5, d, 5000)), borderColor: COLORS[3], spanGaps: true, tension: .3, pointRadius: 4 }] },
        options: { scales: { y: { reverse: true, ticks: timeTicks } }, plugins: { tooltip: timeTooltip } } });
    }
    line('athVo2', 'vo2', COLORS[5]); line('athRhr', 'rhr', COLORS[6]); line('athWt', 'weight', COLORS[0]);
  }
  const profileActs = {
    myRhr(f, ctx) { const v = Number(f.value.value); if (!v) return false; S.setMetric(ctx.athleteId, 'rhr', U.today(), v, { source: f.source.value, enteredBy: 'athlete' }); return 'Resting HR saved'; },
    addLog(f, ctx) { const v = U.formData(f); db().logs.push({ id: U.uid('lg'), athleteId: ctx.athleteId, date: v.date || U.today(), km: v.km ? Number(v.km) : 0, rpe: v.rpe ? Number(v.rpe) : '', text: v.text }); return 'Logged'; },
    delLog(el) { db().logs = db().logs.filter((l) => l.id !== el.dataset.id); return 'Removed'; },
    addComment(f, ctx) { const v = U.formData(f); db().comments.push({ id: U.uid('cm'), athleteId: ui.athleteId, date: U.today(), author: ctx.userName || 'Coach', focus: v.focus, text: v.text, done: false }); return 'Feedback added'; },
    toggleComment(el) { const c = db().comments.find((x) => x.id === el.dataset.id); c.done = !c.done; return true; },
    delComment(el) { db().comments = db().comments.filter((x) => x.id !== el.dataset.id); return 'Removed'; },
    addMetric(f) {
      const v = U.formData(f);
      const val = S.METRICS[v.type].unit === 'time' ? U.parseTime(v.value) : Number(v.value);
      if (!val || isNaN(val)) { U.toast('Enter a valid value'); return false; }
      db().metrics.push({ id: U.uid('m'), athleteId: ui.athleteId, date: v.date, type: v.type, value: val, source: 'Manual' }); return 'Test recorded';
    },
    delMetric(el) { db().metrics = db().metrics.filter((m) => m.id !== el.dataset.id); return 'Removed'; },
    editAthlete(el) { ui.editAthlete = el.dataset.id; location.hash = '#athletes'; setTimeout(() => U.$('[data-form="saveAthlete"]')?.scrollIntoView({ behavior: 'smooth' }), 80); return null; },
  };

  // "My Page" — the athlete's own view
  Views.me = {
    render(ctx) {
      const d = db();
      if (ctx.athleteId) { ui.athleteId = ctx.athleteId; }
      const a = S.athlete(ctx.athleteId);
      const picker = S.mode === 'local' ? `<div class="notice" style="margin-bottom:12px">Local/demo mode: choose whose page to view. With cloud logins switched on, each athlete signs in and sees only their own page.
        <select data-change="pickMe" style="width:auto;margin-left:8px">${athleteOptions(ctx.athleteId, () => true, '— choose athlete —')}</select></div>` : '';
      if (!a) return picker + (S.mode === 'local' ? empty('Pick an athlete above.') : `<div class="card">${empty('Your login is not linked to an athlete yet — ask the coach to link it.')}</div>`);
      return picker + profile(a, ctx);
    },
    mount(root, ctx) { mountProfile(S.athlete(ctx.athleteId)); },
    act: { ...profileActs, pickMe(el) { App.setLocalAthlete(el.value); return null; } },
  };

  // Athlete dashboard for coach / advisory / data entry
  Views.athletes = {
    render(ctx) {
      const d = db();
      if (!ui.athleteId || !S.athlete(ui.athleteId)) ui.athleteId = d.athletes[0]?.id || null;
      const a = S.athlete(ui.athleteId);
      const flags = d.athletes.filter((x) => S.rhrFlag(x.id));
      const mon = U.mondayOf(U.today());
      const rows = d.athletes.map((x) => {
        const l = S.latest(x.id, 'erg2k'), f = S.first(x.id, 'erg2k');
        const flag = S.rhrFlag(x.id); const att = S.attendancePct(x.id); const rec = S.record(S.athleteRaces(x.id));
        return `<tr><td><a href="#athletes" data-act="pick" data-id="${x.id}" class="who" style="text-decoration:none;color:inherit">${avatar(x)}<b>${esc(x.name)}</b></a></td>
          <td><small>${esc(S.skillText(x))}</small></td><td>${chips(S.athleteEvents(x.id))}</td>
          <td class="num">${S.kmWeek(x.id, mon)}</td>
          <td class="num">${l ? fmtTime(l.value) : '—'}</td>
          <td class="num">${f && l && f !== l ? delta(l.value - f.value, true, (v) => fmtTime(v)) : '—'}</td>
          <td class="num">${S.wPerKg(x.id) ?? '—'}</td>
          <td class="num">${S.latest(x.id, 'vo2')?.value ?? '—'}</td>
          <td class="num">${S.latest(x.id, 'rhr')?.value ?? '—'} ${flag ? `<span class="badge warn" title="${flag.diff} bpm above baseline ${flag.base}">+${flag.diff}</span>` : ''}</td>
          <td class="num">${rec.n ? `${rec.w}–${rec.l}` : '—'}</td>
          <td class="num"><span class="badge ${att >= 85 ? 'good' : att >= 75 ? 'warn' : 'bad'}">${att ?? '—'}%</span></td></tr>`;
      }).join('');
      const ed = ui.editAthlete ? S.athlete(ui.editAthlete) : null;
      return `
      <div class="section-title"><h2>Athletes</h2><span class="spacer"></span>
        <label style="flex-direction:row;display:flex;align-items:center;gap:8px">Athlete
          <select data-change="pick" style="width:240px">${d.athletes.map((x) => opt(x.id, x.name, ui.athleteId)).join('')}</select></label></div>
      ${flags.length ? `<div class="notice" style="margin-bottom:16px">⚠ <b>Recovery watch:</b> ${flags.map((x) => esc(x.name)).join(', ')} — latest resting HR is 5+ bpm above their recent baseline. Consider a lighter session or a check-in.</div>` : ''}
      ${a ? profile(a, ctx) : empty('Add athletes to get started.')}
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Squad summary</h3><span class="spacer"></span><button class="btn ghost sm" data-act="csvSquad">Export CSV</button></div>
        <div class="table-wrap"><table><tr><th>Athlete</th><th>Rows</th><th>Boats</th><th class="num">km wk</th><th class="num">Latest 2k</th><th class="num">2k change</th><th class="num">W/kg</th><th class="num">VO₂</th><th class="num">Rest HR</th><th class="num">Races W–L</th><th class="num">Attend.</th></tr>${rows}</table></div>
      </div>
      ${ctx.coach ? `<div class="grid g2" style="margin-top:16px">
        ${roleCard('Test-day entry (whole squad)', `
          <form data-form="bulkMetric">
            <div class="form"><label>Test<select name="type" data-change="bulkType">${Object.entries(S.METRICS).map(([k, v]) => opt(k, v.label, ui.bulkType)).join('')}</select></label>
            <label>Date<input type="date" name="date" value="${U.today()}" required></label></div>
            <div class="table-wrap" style="max-height:380px;margin-top:8px"><table>${d.athletes.filter((x) => !(S.isCox(x) && ['erg2k', 'erg5k', 'vo2'].includes(ui.bulkType))).map((x) => `<tr><td>${esc(x.name)}</td><td style="width:140px"><input name="v_${x.id}" placeholder="${S.METRICS[ui.bulkType].unit === 'time' ? 'm:ss.t' : S.METRICS[ui.bulkType].unit}"></td><td class="num"><small>last: ${metricFmt(ui.bulkType, S.latest(x.id, ui.bulkType)?.value)}</small></td></tr>`).join('')}</table></div>
            <div style="margin-top:8px"><button class="btn">Save all entries</button> <small>Blank rows are skipped.</small></div>
          </form>`)}
        ${roleCard(ed ? 'Edit athlete' : 'Add athlete', `
          <form class="form" data-form="saveAthlete">
            <label class="full">Full name<input name="name" required value="${esc(ed?.name || '')}"></label>
            <fieldset class="full crew-pick"><legend>Can row as — tick all that apply</legend><div class="checks">${Object.entries(S.SKILLS).map(([k, v]) => `<label class="check"><input type="checkbox" name="skill" value="${k}" ${ed?.skills?.includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}</div></fieldset>
            <label>Squad<select name="squad">${['Senior', 'U16'].map((x) => opt(x, x, ed?.squad)).join('')}</select></label>
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
    mount() { mountProfile(S.athlete(ui.athleteId)); },
    act: {
      ...profileActs,
      pick(el) { ui.athleteId = el.value || el.dataset.id; window.scrollTo({ top: 0, behavior: 'smooth' }); return null; },
      bulkType(el) { ui.bulkType = el.value; return null; },
      editAthlete(el) { ui.editAthlete = el.dataset.id; setTimeout(() => U.$('[data-form="saveAthlete"]')?.scrollIntoView({ behavior: 'smooth' }), 80); return null; },
      cancelEdit() { ui.editAthlete = null; return null; },
      async saveAthlete(f) {
        const v = U.formData(f); delete v.file; delete v.skill;
        v.skills = U.$$('input[name="skill"]:checked', f).map((x) => x.value);
        if (!v.skills.length) { U.toast('Tick at least one: stroke side, bow side, sculler or cox'); return false; }
        ['age', 'height', 'weight'].forEach((k) => { v[k] = v[k] ? Number(v[k]) : ''; });
        const file = f.file.files[0]; const photo = file ? await U.readImage(file, 400, 0.8) : null;
        if (ui.editAthlete) { const a = S.athlete(ui.editAthlete); Object.assign(a, v); if (photo) a.photo = photo; ui.editAthlete = null; return 'Athlete updated'; }
        const a = { id: U.uid('ath'), photo: photo || '', ...v }; db().athletes.push(a); ui.athleteId = a.id; return 'Athlete added';
      },
      delAthlete(el) {
        const a = S.athlete(el.dataset.id); if (!confirm(`Delete ${a.name} and all of their test data?`)) return false;
        const d = db(); d.athletes = d.athletes.filter((x) => x.id !== a.id); d.metrics = d.metrics.filter((m) => m.athleteId !== a.id);
        d.logs = d.logs.filter((m) => m.athleteId !== a.id); d.comments = d.comments.filter((m) => m.athleteId !== a.id);
        Object.values(d.crews).forEach((c) => { c.seats = c.seats.map((s) => (s === a.id ? '' : s)); if (c.cox === a.id) c.cox = ''; });
        Object.values(d.attendance).forEach((day) => delete day[a.id]);
        ui.editAthlete = null; ui.athleteId = null; return 'Athlete deleted';
      },
      bulkMetric(f) {
        const type = f.type.value, date = f.date.value; let n = 0, bad = 0;
        U.$$('input[name^="v_"]', f).forEach((inp) => {
          if (!inp.value.trim()) return;
          const val = S.METRICS[type].unit === 'time' ? U.parseTime(inp.value) : Number(inp.value);
          if (!val || isNaN(val)) { bad++; return; }
          S.setMetric(inp.name.slice(2), type, date, val, { source: 'Manual' }); n++;
        });
        if (!n) { U.toast(bad ? 'Some values could not be read' : 'Nothing entered'); return false; }
        return `${n} results saved${bad ? `, ${bad} skipped (unreadable)` : ''}`;
      },
      csvSquad() {
        const rows = [['Athlete', 'Squad', 'Rows as', 'Date', 'Test', 'Value', 'Source']];
        db().metrics.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((m) => { const x = S.athlete(m.athleteId); rows.push([x?.name, x?.squad, S.skillText(x), m.date, S.METRICS[m.type].label, S.METRICS[m.type].unit === 'time' ? fmtTime(m.value) : m.value, m.source || '']); });
        U.download('stc-rowing-tests.csv', U.toCSV(rows), 'text/csv'); return false;
      },
    },
  };

  // =====================================================================
  // CREWS & BOATS
  // =====================================================================
  Views.crews = {
    render(ctx) {
      const d = db();
      const usage = {};
      Object.values(d.crews).forEach((c) => [...c.seats, c.cox].filter(Boolean).forEach((id) => { usage[id] = (usage[id] || 0) + 1; }));
      const unassigned = d.athletes.filter((a) => !usage[a.id]);
      const groups = [['Coxed fours', '4+'], ['Double sculls', '2x'], ['Pairs', '2-'], ['Single sculls', '1x']];
      const recent = U.addDays(U.today(), -14);
      const card = (ev) => {
        const c = d.crews[ev.id] || { seats: Array(ev.seats).fill(''), cox: '' };
        while (c.seats.length < ev.seats) c.seats.push('');
        const ergs = c.seats.map((id) => S.best(id, 'erg2k')?.value).filter(Boolean);
        const wts = c.seats.map((id) => S.latest(id, 'weight')?.value || S.athlete(id)?.weight).filter(Boolean);
        const sum = S.eventSummary(ev.id); const comp = S.crewCompletion(ev.id, recent);
        const sculling = ['1x', '2x', '4x'].includes(ev.boat);
        const fits = (a) => canRow(a) && (sculling ? a.skills.includes('scull') : a.skills.some((k) => k === 'stroke' || k === 'bow'));
        const seat = (id, i, label) => ctx.coach
          ? `<div class="seat"><small>${label}</small><select data-change="seat" data-ev="${ev.id}" data-i="${i}">${athleteOptions(id, (a) => (i === 'cox' ? canCox(a) || a.id === id : fits(a) || a.id === id), '— empty —')}</select></div>`
          : `<div class="seat ${id ? '' : 'empty'}"><small>${label}</small>${id ? esc(S.short(id)) + (usage[id] > 1 ? ` <span class="badge" title="Races in ${usage[id]} events">×${usage[id]}</span>` : '') : 'empty'}</div>`;
        return `<div class="card"><div class="card-head"><h3>${esc(ev.code)}</h3><span class="muted">${esc(ev.name)}</span>${ev.points ? `<span class="badge dark">${ev.points} pts</span>` : ''}<span class="spacer"></span>${UI.gapBadge(sum)}</div>
          <div class="boat-hull">${ev.cox ? seat(c.cox, 'cox', 'Cox') : ''}${[...c.seats.keys()].reverse().map((i) => seat(c.seats[i], i, UI.seatLabel(ev, i))).join('')}</div>
          <div class="btn-row" style="margin-top:8px;font-size:.84rem">
            <span>Avg best 2k: <b>${ergs.length ? fmtTime(U.mean(ergs)) : '—'}</b></span>
            <span>Avg weight: <b>${wts.length ? round(U.mean(wts), 1) + ' kg' : '—'}</b></span>
            <span>Best ${U.fmtDist(ev.distance)}: <b>${sum.count ? fmtTime(sum.best.t) : '—'}</b></span>
            <span>Record: <b>${ev.record ? fmtTime(ev.record, 0) : '—'}</b></span>
            <span>STC best: <b>${ev.stcBest ? fmtTime(ev.stcBest, 0) : '—'}</b></span>
            <span>Training done (2 wks): <b>${comp ?? '—'}%</b></span></div></div>`;
      };
      return `
      <div class="section-title"><h2>Crews for the ${esc(d.settings.regattaName)}</h2><span class="spacer"></span><span class="muted">Stern (cox, stroke) on the left → bow on the right${ctx.coach ? ' · only athletes ticked for sweep or sculling appear in the matching boats' : ''}</span></div>
      ${groups.map(([label, boat]) => { const evs = d.events.filter((e) => e.boat === boat); return evs.length ? `<h3 style="margin:18px 0 8px">${label}</h3><div class="grid ${ctx.coach && evs[0].seats >= 4 ? '' : 'g2'}">${evs.map(card).join('')}</div>` : ''; }).join('')}
      ${d.events.filter((e) => !groups.some(([, b]) => b === e.boat)).map(card).join('')}
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Athletes in more than one boat</h3></div>
        ${Object.entries(usage).filter(([, n]) => n > 1).length ? `<div class="btn-row">${Object.entries(usage).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<span class="badge">${esc(S.name(id))} · ${S.athleteEvents(id).map((e) => e.code).join(', ')}</span>`).join('')}</div>` : empty('Nobody is doubling up.')}</div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Not yet in a crew</h3></div>
        ${unassigned.length ? `<div class="btn-row">${unassigned.map((a) => `<span class="badge">${esc(a.name)} · ${esc(S.skillText(a))}</span>`).join('')}</div>` : empty('Every athlete is in at least one crew.')}</div>`;
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
})();
