/* Boat progress vs records, regatta results + Royal Thomian history, combinations (seat racing),
   advisory committee report, data & settings (incl. login accounts). */
(() => {
  const { esc, fmtTime, fmtDate, fmtShort, round } = U;
  const S = Store, ui = UI.state;
  const db = () => S.db;
  const { kpi, opt, empty, roleCard, chart, COLORS, timeTicks, timeTooltip, delta, crewNames, eventOptions, distanceOptions, athleteOptions, canRow, canCox, gapBadge, seatLabel } = UI;
  const KINDS = ['Time test', 'Practice piece', 'Seat race'];
  const recMark = (e) => (e.record && !e.recordVerified ? ` <span class="badge warn" title="${esc(e.recordNote || 'Not yet verified')}">?</span>` : '');

  // =====================================================================
  // BOAT PROGRESS & RECORDS
  // =====================================================================
  Views.results = {
    render(ctx) {
      const d = db();
      const sums = d.events.map((e) => S.eventSummary(e.id));
      const ev = S.event(ui.eventId) || d.events[0]; ui.eventId = ev?.id;
      const log = d.results.filter((r) => !ui.resultFilter || r.eventId === ui.resultFilter).sort((a, b) => b.date.localeCompare(a.date));
      return `
      <div class="section-title"><h2>Boat-by-boat progress vs Royal Thomian records</h2></div>
      <div class="card">
        <div class="table-wrap"><table>
          <tr><th>Event</th><th>Crew</th><th class="num">Pts</th><th class="num">Record</th><th class="num">STC best</th><th class="num">Our best*</th><th class="num">Latest*</th><th class="num">Gap to record</th><th class="num">% of record speed</th><th class="num">Improvement</th><th>Status</th></tr>
          ${sums.map((s) => `<tr>
            <td><a href="#results" data-act="pickEvent" data-id="${s.ev.id}"><b>${esc(s.ev.code)}</b></a><br><small>${esc(s.ev.name)}</small></td>
            <td><small>${crewNames(s.ev.id)}</small></td>
            <td class="num">${s.ev.points ?? '—'}</td>
            <td class="num" title="${esc(s.ev.recordHolder || '')} ${esc(s.ev.recordYear || '')}">${s.ev.record ? fmtTime(s.ev.record, 0) : '—'}${recMark(s.ev)}<br><small>${esc(s.ev.recordYear || '')}</small></td>
            <td class="num">${s.ev.stcBest ? fmtTime(s.ev.stcBest, 0) : '—'}<br><small>${esc(s.ev.stcBestYear || '')}</small></td>
            <td class="num">${s.count ? fmtTime(s.best.t) : '—'}</td>
            <td class="num">${s.count ? fmtTime(s.latest.t) : '—'}</td>
            <td class="num">${s.gapBest != null ? (s.gapBest <= 0 ? '<span class="up">' : '<span>') + (s.gapBest > 0 ? '+' : '') + round(s.gapBest, 1) + ' s</span>' : '—'}</td>
            <td class="num" style="min-width:120px">${s.pctOfRecord ? `<div class="bar ${s.pctOfRecord >= 98 ? 'good' : s.pctOfRecord >= 95 ? 'warn' : 'bad'}"><i style="width:${Math.min(100, s.pctOfRecord)}%"></i></div><small>${round(s.pctOfRecord, 1)}%</small>` : '—'}</td>
            <td class="num">${s.count > 1 ? delta(-s.improvement, true, (v) => round(v, 1) + ' s') : '—'}</td>
            <td>${gapBadge(s)}</td></tr>`).join('')}
        </table></div>
        <small>Royal Thomian races are 1000 yards (914.4 m). * Race-equivalent time: tests over 300 m, 500 m, 1000 m, 2000 m or a 2-mile head are converted to 1000 yd with Paul's law (+5 s per 500 m for each doubling of distance). Records: published course records updated with reported 2026 times — <span class="badge warn">?</span> until confirmed against the official sheet.</small>
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>All crews — % of record speed over time</h3></div><div class="chart-box tall"><canvas id="resPct"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>Seconds off the record (best time)</h3></div><div class="chart-box tall"><canvas id="resGap"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Progress by boat</h3><span class="spacer"></span>
          <div class="pill-tabs">${d.events.map((e) => `<button class="${e.id === ui.eventId ? 'active' : ''}" data-act="pickEvent" data-id="${e.id}">${esc(e.code)}</button>`).join('')}</div></div>
        ${ev ? `<div class="muted" style="margin-bottom:6px">${esc(ev.name)} · ${U.fmtDist(ev.distance)} · record ${ev.record ? fmtTime(ev.record, 0) : 'not set'}${ev.recordHolder ? ' (' + esc(ev.recordHolder) + (ev.recordYear ? ', ' + esc(ev.recordYear) : '') + ')' : ''} · STC best ${ev.stcBest ? fmtTime(ev.stcBest, 0) : '—'} · crew: ${crewNames(ev.id)}</div>
        <div class="grid g3"><div class="span2"><div class="chart-box tall"><canvas id="resEvent"></canvas></div></div><div class="chart-box tall"><canvas id="resSplit"></canvas></div></div>` : ''}
      </div>
      ${ctx.coach ? `<div style="margin-top:16px">${roleCard('Log a time test / practice piece', `
        <form class="form" data-form="addResult">
          <label>Date<input type="date" name="date" value="${U.today()}" required></label>
          <label>Boat<select name="eventId">${eventOptions(ui.eventId)}</select></label>
          <label>Type<select name="kind">${KINDS.map((k) => opt(k, k)).join('')}</select></label>
          <label>Distance<select name="distance">${distanceOptions(914.4)}</select></label>
          <label>Time<input name="time" required placeholder="3:05.4"></label>
          <label>Stroke rate<input type="number" name="rate" placeholder="34"></label>
          <label>Conditions<select name="conditions">${['Calm', 'Light headwind', 'Strong headwind', 'Tailwind', 'Crosswind', 'Rough'].map((x) => opt(x, x)).join('')}</select></label>
          <label class="full">Notes<input name="notes" placeholder="Start was messy, strong finish…"></label>
          <small class="full">The boat's current crew line-up is saved with the result (change it on Crews, or use Combinations for seat racing). For races against other schools use <a href="#races">Regattas</a>.</small>
          <div><button class="btn">Save result</button></div></form>`)}</div>` : ''}
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Time test log</h3><span class="spacer"></span>
          <select data-change="filter" style="width:auto"><option value="">All boats</option>${eventOptions(ui.resultFilter)}</select>
          <button class="btn ghost sm" data-act="csvResults">Export CSV</button></div>
        <div class="table-wrap" style="max-height:420px"><table><tr><th>Date</th><th>Boat</th><th>Type</th><th class="num">Distance</th><th class="num">Time</th><th class="num">Split /500m</th><th class="num">1000 yd equiv.</th><th class="num">vs record</th><th class="num">Rate</th><th>Conditions</th><th>Line-up / notes</th>${ctx.coach ? '<th></th>' : ''}</tr>
        ${log.map((r) => { const e = S.event(r.eventId); const eq = S.raceEquivalent(r); return `<tr><td>${fmtDate(r.date)}</td><td><b>${esc(e?.code)}</b></td><td>${esc(r.kind)}</td><td class="num">${U.fmtDist(r.distance)}</td><td class="num"><b>${fmtTime(r.time)}</b></td><td class="num">${fmtTime(U.split500(r.time, r.distance))}</td><td class="num">${fmtTime(eq)}</td><td class="num">${e?.record ? (eq - e.record > 0 ? '+' : '') + round(eq - e.record, 1) + ' s' : '—'}</td><td class="num">${r.rate || ''}</td><td>${esc(r.conditions || '')}</td><td><small>${(r.lineup || []).filter(Boolean).map(S.short).join(', ')}${r.notes ? ' — ' + esc(r.notes) : ''}</small></td>${ctx.coach ? `<td><button class="icon-btn" data-act="delResult" data-id="${r.id}">✕</button></td>` : ''}</tr>`; }).join('') || `<tr><td colspan="12">${empty('No results logged yet.')}</td></tr>`}
        </table></div></div>`;
    },
    mount() {
      const d = db();
      const dates = [...new Set(d.results.map((r) => r.date))].sort();
      chart('resPct', { type: 'line', data: { labels: dates.map(fmtShort), datasets: d.events.filter((e) => e.record).map((e, i) => ({
        label: e.code, borderColor: COLORS[i % COLORS.length], backgroundColor: COLORS[i % COLORS.length], spanGaps: true, tension: .25, pointRadius: 3,
        data: dates.map((dt) => { const r = d.results.find((x) => x.eventId === e.id && x.date === dt); return r ? round((e.record / S.raceEquivalent(r)) * 100, 2) : null; }),
      })) }, options: { scales: { y: { suggestedMax: 100, title: { display: true, text: '% of record speed (100 = record)' } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw}%` } } } } });
      const sums = d.events.map((e) => S.eventSummary(e.id)).filter((s) => s.count && s.ev.record);
      chart('resGap', { type: 'bar', data: { labels: sums.map((s) => s.ev.code), datasets: [
        { label: 'Our best', data: sums.map((s) => round(s.gapBest, 1)), backgroundColor: sums.map((s) => (s.gapBest / s.ev.record <= 0.02 ? COLORS[5] : s.gapBest / s.ev.record <= 0.05 ? COLORS[4] : COLORS[6])) },
        { label: "STC's best ever", data: sums.map((s) => (s.ev.stcBest ? round(s.ev.stcBest - s.ev.record, 1) : null)), backgroundColor: COLORS[2] + 'aa' }] },
        options: { indexAxis: 'y', scales: { x: { title: { display: true, text: 'seconds slower than the course record (lower is better)' } } } } });
      const ev = S.event(ui.eventId); if (!ev) return;
      const rs = S.eventResults(ev.id);
      const flat = (v, label, color, dash) => (v ? [{ label, data: rs.map(() => v), borderColor: color, borderDash: dash, pointRadius: 0 }] : []);
      chart('resEvent', { type: 'line', data: { labels: rs.map((r) => fmtShort(r.date)), datasets: [
        { label: `Our time (1000 yd equiv.)`, data: rs.map((r) => round(S.raceEquivalent(r), 1)), borderColor: COLORS[1], backgroundColor: COLORS[1], tension: .25, pointRadius: 5 },
        ...flat(ev.record, 'Course record', COLORS[6], [6, 4]), ...flat(ev.stcBest, "STC's best", COLORS[3], [3, 3]), ...flat(ev.record ? round(ev.record * 1.02, 1) : null, 'Within 2%', COLORS[5], [2, 4])] },
        options: { scales: { y: { reverse: true, ticks: timeTicks, title: { display: true, text: 'faster ↑' } } }, plugins: { tooltip: timeTooltip } } });
      chart('resSplit', { type: 'bar', data: { labels: rs.map((r) => fmtShort(r.date) + ` (${U.fmtDist(r.distance)})`), datasets: [{ label: 'Split /500m', data: rs.map((r) => round(U.split500(r.time, r.distance), 1)), backgroundColor: COLORS[0] }] },
        options: { scales: { y: { ticks: timeTicks, min: rs.length ? Math.floor(Math.min(...rs.map((r) => U.split500(r.time, r.distance))) - 5) : 0 } }, plugins: { tooltip: timeTooltip, legend: { display: false } } } });
    },
    act: {
      pickEvent(el) { ui.eventId = el.dataset.id; return null; },
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
        const rows = [['Date', 'Boat', 'Type', 'Distance (m)', 'Time', 'Split/500', '1000yd equivalent', 'Record', 'Gap (s)', 'Rate', 'Conditions', 'Line-up', 'Notes']];
        db().results.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => { const e = S.event(r.eventId); const eq = S.raceEquivalent(r); rows.push([r.date, e?.code, r.kind, r.distance, fmtTime(r.time), fmtTime(U.split500(r.time, r.distance)), fmtTime(eq), e?.record ? fmtTime(e.record) : '', e?.record ? round(eq - e.record, 1) : '', r.rate, r.conditions, (r.lineup || []).map(S.name).join(' / '), r.notes]); });
        U.download('stc-rowing-time-tests.csv', U.toCSV(rows), 'text/csv'); return false;
      },
    },
  };

  // =====================================================================
  // REGATTAS — race results through the year + Royal Thomian history
  // =====================================================================
  Views.races = {
    render(ctx) {
      const d = db();
      const year = U.today().slice(0, 4);
      const list = d.races.filter((r) => !ui.raceFilter || r.eventId === ui.raceFilter).sort((a, b) => b.date.localeCompare(a.date));
      const season = d.races.filter((r) => r.date >= U.addDays(U.today(), -365));
      const rec = S.record(season);
      const byEvent = d.events.map((e) => ({ e, ...S.record(season.filter((r) => r.eventId === e.id)) })).filter((x) => x.n);
      const fe = S.event(ui.raceEvent) || null; const crew = fe ? d.crews[fe.id] : null;
      const nSeats = fe ? fe.seats : Number(ui.raceSeats || 4); const hasCox = fe ? fe.cox : ui.raceCox;
      const hist = [...d.history].sort((a, b) => b.year - a.year);
      const rt = hist.reduce((t, h) => { if (h.stc > h.royal) t.stc++; else if (h.royal > h.stc) t.rc++; else t.draw++; return t; }, { stc: 0, rc: 0, draw: 0 });
      return `
      <div class="section-title"><h2>Regattas &amp; race results</h2></div>
      <div class="grid g4">
        ${kpi('Races (last 12 months)', rec.n)}
        ${kpi('Won', rec.w, rec.n ? Math.round((rec.w / rec.n) * 100) + '% win rate' : '', 'up')}
        ${kpi('Lost / placed', rec.l, '', rec.l ? 'down' : '')}
        ${kpi('Distances raced', [...new Set(season.map((r) => U.fmtDist(r.distance)))].join(', ') || '—')}
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Wins &amp; losses by boat</h3></div><div class="chart-box"><canvas id="raceWL"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>By boat</h3></div>
          ${byEvent.length ? `<div class="table-wrap"><table><tr><th>Boat</th><th class="num">Races</th><th class="num">Won</th><th class="num">Lost</th><th>Latest</th></tr>${byEvent.map((x) => { const last = season.filter((r) => r.eventId === x.e.id).sort((a, b) => b.date.localeCompare(a.date))[0]; return `<tr><td><b>${esc(x.e.code)}</b></td><td class="num">${x.n}</td><td class="num up">${x.w}</td><td class="num down">${x.l}</td><td><small>${esc(last.regatta)} — ${UI.ordinal(last.placing)}</small></td></tr>`; }).join('')}</table></div>` : empty('No races yet.')}</div>
      </div>
      ${ctx.coach ? `<div style="margin-top:16px">${roleCard('Record a race result', `
        <form class="form" data-form="addRace">
          <label>Date<input type="date" name="date" value="${U.today()}" required></label>
          <label class="span2">Regatta<input name="regatta" required placeholder="e.g. Schools Sprint Regatta" list="regattaNames"></label>
          <datalist id="regattaNames">${[...new Set(d.races.map((r) => r.regatta))].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <label>Boat / event<select name="eventId" data-change="raceEvent"><option value="">— other boat —</option>${eventOptions(ui.raceEvent)}</select></label>
          ${fe ? '' : `<label>Seats<select name="seats" data-change="raceSeats">${[1, 2, 4, 8].map((n) => opt(n, n, nSeats)).join('')}</select></label><label class="check" style="align-self:center"><input type="checkbox" name="hascox" data-change="raceCox" ${hasCox ? 'checked' : ''}> Coxed</label>`}
          <label>Race name<input name="race" value="${esc(fe?.name || '')}" placeholder="Senior Four"></label>
          <label>Distance<select name="distance">${distanceOptions(1000)}</select></label>
          <label>Place<input type="number" name="placing" min="1" value="1" required></label>
          <label>Crews in race<input type="number" name="field" min="1" value="2"></label>
          <label>Our time<input name="time" placeholder="3:05.0"></label>
          <label>Winner's time<input name="winnerTime" placeholder="if we lost"></label>
          <label>Main opponent<input name="opponent" placeholder="Royal College"></label>
          ${Array.from({ length: nSeats }, (_, i) => `<label>${nSeats === 1 ? 'Sculler' : i === 0 ? 'Bow' : i === nSeats - 1 ? 'Stroke' : 'Seat ' + (i + 1)}<select name="seat${i}">${athleteOptions(crew?.seats[i], canRow)}</select></label>`).join('')}
          ${hasCox ? `<label>Cox<select name="cox">${athleteOptions(crew?.cox, canCox)}</select></label>` : ''}
          <label class="full">Notes<input name="notes"></label>
          <div><button class="btn">Save race</button></div>
          <small class="full">Each rower and cox gets this race on their own page, with a running win–loss record.</small></form>`)}</div>` : ''}
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>All races</h3><span class="spacer"></span><select data-change="raceFilter" style="width:auto"><option value="">All boats</option>${eventOptions(ui.raceFilter)}</select></div>
        <div class="table-wrap" style="max-height:460px"><table><tr><th>Date</th><th>Regatta</th><th>Race</th><th>Distance</th><th>Crew</th><th class="num">Time</th><th class="num">Behind winner</th><th>Result</th>${ctx.coach ? '<th></th>' : ''}</tr>
        ${list.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.regatta)}</td><td>${esc(r.race)}${r.opponent ? `<br><small>vs ${esc(r.opponent)}</small>` : ''}</td><td>${U.fmtDist(r.distance)}</td><td><small>${r.crew.map(S.short).join(', ')}${r.cox ? ' · cox ' + S.short(r.cox) : ''}</small></td><td class="num">${r.time ? fmtTime(r.time) : '—'}</td><td class="num">${r.time && r.winnerTime && !S.raceWon(r) ? '+' + round(r.time - r.winnerTime, 1) + ' s' : ''}</td><td>${UI.placeText(r)}</td>${ctx.coach ? `<td><button class="icon-btn" data-act="delRace" data-id="${r.id}">✕</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="9">${empty('No races recorded.')}</td></tr>`}</table></div></div>

      <div class="section-title" style="margin-top:26px"><h2>Royal Thomian Regatta — history</h2><span class="spacer"></span><a href="${esc(d.settings.historyLink)}" target="_blank" rel="noopener">Full history on Wikipedia →</a></div>
      <div class="grid g4">
        ${kpi("S. Thomas' wins", rt.stc, `in the ${hist.length} years recorded here`)}${kpi('Royal wins', rt.rc)}${kpi('Draws', rt.draw)}
        ${kpi('Points available', d.events.reduce((t, e) => t + (Number(e.points) || 0), 0), 'across the scoring events')}
      </div>
      <div class="card" style="margin-top:12px"><div class="table-wrap"><table><tr><th>Year</th><th class="num">Royal</th><th class="num">S. Thomas'</th><th>Overall result</th><th>Trophy holder</th><th>Boat Race</th><th>Notes</th><th>Source</th>${ctx.coach ? '<th></th>' : ''}</tr>
        ${hist.map((h) => `<tr><td><b>${h.year}</b></td><td class="num">${h.royal ?? '—'}</td><td class="num">${h.stc ?? '—'}</td><td>${esc(h.result || '')}</td><td>${esc(h.trophy || '')}</td><td>${esc(h.boatRace || '—')}</td><td><small>${esc(h.notes || '')}</small></td><td>${h.source ? `<a href="${esc(h.source)}" target="_blank" rel="noopener">link</a>` : ''}</td>${ctx.coach ? `<td><button class="icon-btn" data-act="delHistory" data-id="${h.id}">✕</button></td>` : ''}</tr>
          ${h.events?.length ? `<tr><td></td><td colspan="${ctx.coach ? 8 : 7}"><details><summary>${h.year} race-by-race results</summary><div class="table-wrap"><table><tr><th>Event</th><th class="num">Pts</th><th class="num">Royal</th><th class="num">S. Thomas'</th><th>Winner</th><th>Note</th></tr>
            ${h.events.map((x) => `<tr><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td class="num">${x.points}</td><td class="num ${x.winner === 'RC' ? 'strong' : ''}">${x.rc ? fmtTime(x.rc, 0) : '—'}</td><td class="num ${x.winner === 'STC' ? 'strong' : ''}">${x.stc ? fmtTime(x.stc, 0) : '—'}</td><td>${x.winner === 'STC' ? '<span class="badge good">STC</span>' : '<span class="badge">Royal</span>'}</td><td><small>${esc(x.note || '')}</small></td></tr>`).join('')}</table></div></details></td></tr>` : ''}`).join('')}
      </table></div>
      <small>Recent results compiled from Wikipedia, ePRESS, the Royal College Union and ThePapare. Overall result, trophy holder and Boat Race winner are kept separate (e.g. 2026: 26–26 draw, Royal retained the trophy, S. Thomas' won the Boat Race).</small></div>
      ${ctx.coach ? `<div style="margin-top:12px">${roleCard('Add a Royal Thomian year', `<form class="form" data-form="addHistory">
        <label>Year<input type="number" name="year" required value="${Number(year)}"></label><label>Royal points<input type="number" name="royal"></label><label>S. Thomas' points<input type="number" name="stc"></label>
        <label>Overall result<input name="result" placeholder="S. Thomas' won"></label><label>Trophy holder<input name="trophy"></label><label>Boat Race winner<input name="boatRace"></label>
        <label class="full">Notes<input name="notes"></label><label class="full">Source link<input name="source" placeholder="https://…"></label>
        <div><button class="btn">Add year</button></div></form>`)}</div>` : ''}`;
    },
    mount() {
      const season = db().races.filter((r) => r.date >= U.addDays(U.today(), -365));
      const evs = db().events.filter((e) => season.some((r) => r.eventId === e.id));
      chart('raceWL', { type: 'bar', data: { labels: evs.map((e) => e.code), datasets: [
        { label: 'Won', data: evs.map((e) => season.filter((r) => r.eventId === e.id && S.raceWon(r)).length), backgroundColor: COLORS[5] },
        { label: 'Lost / placed', data: evs.map((e) => season.filter((r) => r.eventId === e.id && !S.raceWon(r)).length), backgroundColor: COLORS[6] }] },
        options: { scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } } } });
    },
    act: {
      raceEvent(el) { ui.raceEvent = el.value; return null; },
      raceSeats(el) { ui.raceSeats = el.value; return null; },
      raceCox(el) { ui.raceCox = el.checked; return null; },
      raceFilter(el) { ui.raceFilter = el.value; return null; },
      addRace(f) {
        const v = U.formData(f); const ev = S.event(v.eventId);
        const n = ev ? ev.seats : Number(v.seats || 4);
        const crew = Array.from({ length: n }, (_, i) => v['seat' + i]).filter(Boolean);
        if (!crew.length) { U.toast('Choose the crew'); return false; }
        db().races.push({ id: U.uid('rc'), date: v.date, regatta: v.regatta, race: v.race || ev?.name || '', eventId: v.eventId || '', boat: ev?.boat || '',
          distance: Number(v.distance), crew, cox: v.cox || '', placing: Number(v.placing), field: v.field ? Number(v.field) : '', time: U.parseTime(v.time) || '', winnerTime: U.parseTime(v.winnerTime) || '', opponent: v.opponent, notes: v.notes });
        return 'Race saved — it now appears on each crew member\'s page';
      },
      delRace(el) { if (!confirm('Delete this race?')) return false; db().races = db().races.filter((r) => r.id !== el.dataset.id); return 'Deleted'; },
      addHistory(f) { const v = U.formData(f); db().history.push({ id: U.uid('h'), ...v, year: Number(v.year), royal: v.royal === '' ? null : Number(v.royal), stc: v.stc === '' ? null : Number(v.stc) }); return 'Year added'; },
      delHistory(el) { if (!confirm('Delete this year?')) return false; db().history = db().history.filter((h) => h.id !== el.dataset.id); return 'Deleted'; },
    },
  };

  // =====================================================================
  // COMBINATIONS (coach) — seat racing / line-up testing
  // =====================================================================
  const lineupKey = (c) => [...c.lineup].join('|') + '#' + (c.cox || '');
  Views.combos = {
    render() {
      const d = db(); const ev = S.event(ui.comboEvent) || d.events[0]; ui.comboEvent = ev.id;
      const list = d.combos.filter((c) => c.eventId === ev.id);
      const groups = {};
      list.forEach((c) => { (groups[lineupKey(c)] ||= { lineup: c.lineup, cox: c.cox, runs: [] }).runs.push(c); });
      const ranked = Object.values(groups).map((g) => {
        const splits = g.runs.map((r) => U.split500(r.time, r.distance));
        const eqs = g.runs.map((r) => U.projectTime(r.time, r.distance, ev.distance));
        return { ...g, best: Math.min(...splits), avg: U.mean(splits), eq: Math.min(...eqs), last: g.runs.map((r) => r.date).sort().pop() };
      }).sort((a, b) => a.avg - b.avg);
      const athletesIn = [...new Set(list.flatMap((c) => c.lineup))].filter(Boolean);
      const allAvg = U.mean(list.map((c) => U.split500(c.time, c.distance)));
      const effect = athletesIn.map((id) => {
        const w = list.filter((c) => c.lineup.includes(id)).map((c) => U.split500(c.time, c.distance));
        const wo = list.filter((c) => !c.lineup.includes(id)).map((c) => U.split500(c.time, c.distance));
        return { id, n: w.length, with: U.mean(w), without: wo.length ? U.mean(wo) : null };
      }).map((x) => ({ ...x, diff: x.without !== null ? x.with - x.without : null })).sort((a, b) => (a.diff ?? 99) - (b.diff ?? 99));
      const cur = d.crews[ev.id];
      return `
      <div class="section-title"><h2>Combinations tested</h2><span class="spacer"></span>
        <div class="pill-tabs">${d.events.map((e) => `<button class="${e.id === ev.id ? 'active' : ''}" data-act="pickCombo" data-id="${e.id}">${esc(e.code)} <small>(${d.combos.filter((c) => c.eventId === e.id).length})</small></button>`).join('')}</div></div>
      <div class="grid g2">
        ${roleCard('Log a combination piece — ' + esc(ev.code), `
          <form class="form" data-form="addCombo">
            <label>Date<input type="date" name="date" value="${U.today()}" required></label>
            <label>Distance<select name="distance">${distanceOptions(500)}</select></label>
            <label>Time<input name="time" required placeholder="1:38.2"></label>
            <label>Rate<input type="number" name="rate" placeholder="34"></label>
            ${Array.from({ length: ev.seats }, (_, i) => `<label>${seatLabel(ev, i)}<select name="seat${i}">${athleteOptions(cur?.seats[i], canRow)}</select></label>`).join('')}
            ${ev.cox ? `<label>Cox<select name="cox">${athleteOptions(cur?.cox, canCox)}</select></label>` : ''}
            <label class="full">Notes<input name="notes" placeholder="Swapped 2 and 3 seat"></label>
            <div><button class="btn">Save piece</button></div></form>`)}
        <div class="card"><div class="card-head"><h3>How to use</h3></div>
          <p style="margin-top:0">Row the same piece with different line-ups (same distance, rate and conditions where possible). Line-ups are ranked by average split and projected to ${U.fmtDist(ev.distance)}. The <b>seat-racing effect</b> compares pieces <i>with</i> each athlete against pieces <i>without</i> them — negative means the boat went faster with that athlete.</p>
          <div class="grid g2">${kpi('Pieces logged', list.length)}${kpi('Line-ups tried', ranked.length)}</div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Line-up ranking — ${esc(ev.code)}</h3></div>
        ${ranked.length ? `<div class="table-wrap"><table><tr><th>#</th><th>Line-up (bow → stroke)</th><th class="num">Pieces</th><th class="num">Avg split</th><th class="num">Best split</th><th class="num">Projected ${U.fmtDist(ev.distance)}</th><th class="num">vs record</th><th>Last tried</th><th></th></tr>
          ${ranked.map((g, i) => `<tr><td><b>${i + 1}</b></td><td>${g.lineup.map((id) => esc(S.short(id))).join(' · ')}${g.cox ? ` <small>(cox ${esc(S.short(g.cox))})</small>` : ''}</td><td class="num">${g.runs.length}</td><td class="num"><b>${fmtTime(g.avg)}</b></td><td class="num">${fmtTime(g.best)}</td><td class="num">${fmtTime(g.eq)}</td><td class="num">${ev.record ? '+' + round(g.eq - ev.record, 1) + ' s' : '—'}</td><td>${fmtShort(g.last)}</td>
            <td><button class="btn ghost sm" data-act="adopt" data-key="${esc(lineupKey(g.runs[0]))}">Set as crew</button></td></tr>`).join('')}</table></div>
          <div class="chart-box short" style="margin-top:10px"><canvas id="comboChart"></canvas></div>` : empty('No combinations logged for this boat yet.')}
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Seat-racing effect</h3></div>
          ${effect.length ? `<div class="table-wrap"><table><tr><th>Athlete</th><th class="num">Pieces in</th><th class="num">Avg split with</th><th class="num">Avg split without</th><th class="num">Effect</th></tr>
            ${effect.map((x) => `<tr><td>${esc(S.name(x.id))}</td><td class="num">${x.n}</td><td class="num">${fmtTime(x.with)}</td><td class="num">${x.without !== null ? fmtTime(x.without) : '—'}</td><td class="num">${x.diff !== null ? delta(x.diff, true, (v) => round(v, 1) + ' s') : '<small>in every piece</small>'}</td></tr>`).join('')}</table></div>
            <small>Average split for these pieces: ${fmtTime(allAvg)}. Treat differences under 0.5 s with caution.</small>` : empty('Log pieces to see the effect.')}</div>
        <div class="card"><div class="card-head"><h3>All pieces</h3></div>
          <div class="table-wrap" style="max-height:360px"><table><tr><th>Date</th><th>Line-up</th><th class="num">Dist</th><th class="num">Time</th><th class="num">Split</th><th></th></tr>
          ${list.slice().sort((a, b) => b.date.localeCompare(a.date)).map((c) => `<tr><td>${fmtShort(c.date)}</td><td><small>${c.lineup.map(S.short).join(' · ')}${c.notes ? '<br>' + esc(c.notes) : ''}</small></td><td class="num">${U.fmtDist(c.distance)}</td><td class="num">${fmtTime(c.time)}</td><td class="num">${fmtTime(U.split500(c.time, c.distance))}</td><td><button class="icon-btn" data-act="delCombo" data-id="${c.id}">✕</button></td></tr>`).join('') || `<tr><td colspan="6">${empty('None yet.')}</td></tr>`}</table></div></div>
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
  // ADVISORY COMMITTEE REPORT (view only)
  // =====================================================================
  Views.report = {
    render() {
      const d = db(); const st = d.settings;
      const sums = d.events.map((e) => S.eventSummary(e.id));
      const tested = sums.filter((s) => s.count && s.ev.record);
      const within2 = tested.filter((s) => s.gapBest / s.ev.record <= 0.02);
      const avgPct = tested.length ? U.mean(tested.map((s) => s.pctOfRecord)) : null;
      const totalPts = d.events.reduce((t, e) => t + (Number(e.points) || 0), 0);
      const ptsClose = within2.reduce((t, s) => t + (Number(s.ev.points) || 0), 0);
      const flags = d.athletes.filter((a) => S.rhrFlag(a.id));
      const from28 = U.addDays(U.today(), -28);
      const att = S.squadAttendance(from28);
      const rowers = d.athletes.filter((a) => !S.isCox(a));
      const ergImpr = rowers.map((a) => { const f = S.first(a.id, 'erg2k'), l = S.latest(a.id, 'erg2k'); return f && l && f !== l ? f.value - l.value : null; }).filter((v) => v !== null);
      const season = d.races.filter((r) => r.date >= U.addDays(U.today(), -365)); const rec = S.record(season);
      const days = UI.daysToRegatta();
      const wkPlan = d.weeks[U.mondayOf(U.today())];
      const recent = [...d.updates].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
      const mon = U.mondayOf(U.today());
      const load = d.athletes.map((a) => {
        const evs = S.athleteEvents(a.id); const r = S.record(S.athleteRaces(a.id));
        const f = S.first(a.id, 'erg2k'), l = S.latest(a.id, 'erg2k');
        const km4 = U.round(U.mean([0, 1, 2, 3].map((w) => S.kmWeek(a.id, U.addDays(mon, -7 * w)))), 1);
        return { a, evs, pts: S.athletePoints(a.id), r, erg: f && l && f !== l ? l.value - f.value : null, att: S.attendancePct(a.id), km4, flag: S.rhrFlag(a.id) };
      }).sort((x, y) => y.pts - x.pts || y.evs.length - x.evs.length);
      const last = [...d.history].sort((a, b) => b.year - a.year)[0];
      return `
      <div class="section-title"><h2>Advisory committee report</h2><span class="spacer"></span><span class="muted">Generated ${fmtDate(U.today())}</span><button class="btn ghost sm no-print" data-act="print">Print / save PDF</button></div>
      <div class="hero" style="margin-bottom:16px"><h1>${days !== null ? (days >= 0 ? `${days} days to the ${esc(st.regattaName)}` : `${esc(st.regattaName)} was ${-days} days ago`) : esc(st.regattaName)}</h1>
        <p>${tested.length ? `Across ${tested.length} tested boats the crews are rowing at an average of <b>${round(avgPct, 1)}%</b> of course-record speed. <b>${within2.length}</b> boat${within2.length === 1 ? ' is' : 's are'} within 2% of the record, carrying <b>${ptsClose} of ${totalPts}</b> Royal Thomian points.` : 'No boat time tests recorded yet.'}
        Squad attendance over the last four weeks is <b>${att ?? '—'}%</b>. Race record this season: <b>${rec.w} won, ${rec.l} lost</b>.
        ${last ? `Last regatta (${last.year}): Royal ${last.royal} – ${last.stc} S. Thomas' — ${esc(last.result)}${last.boatRace ? `; Boat Race: ${esc(last.boatRace)}` : ''}.` : ''}</p></div>
      <div class="grid g4">
        ${kpi('Squad size', d.athletes.length, `${rowers.length} rowers · ${d.athletes.length - rowers.length} coxes`)}
        ${kpi('Attendance (4 wks)', (att ?? '—') + '%', '', att >= 85 ? 'up' : 'down')}
        ${kpi('Avg 2k erg improvement', ergImpr.length ? fmtTime(U.mean(ergImpr)) : '—', `${ergImpr.filter((v) => v > 0).length}/${ergImpr.length} rowers faster`, 'up')}
        ${kpi('Races won', `${rec.w}/${rec.n}`, rec.n ? Math.round((rec.w / rec.n) * 100) + '% this season' : '')}
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Boat readiness</h3></div>
        <div class="table-wrap"><table><tr><th>Event</th><th class="num">Pts</th><th>Provisional crew</th><th class="num">Our best*</th><th class="num">Record</th><th class="num">STC best</th><th class="num">Gap</th><th class="num">Since first test</th><th class="num">Races W–L</th><th>Status</th></tr>
        ${sums.map((s) => { const r = S.record(season.filter((x) => x.eventId === s.ev.id)); return `<tr><td><b>${esc(s.ev.code)}</b><br><small>${esc(s.ev.name)}</small></td><td class="num">${s.ev.points ?? '—'}</td><td><small>${crewNames(s.ev.id)}</small></td><td class="num">${s.count ? fmtTime(s.best.t) : '—'}</td><td class="num">${s.ev.record ? fmtTime(s.ev.record, 0) : '—'}</td><td class="num">${s.ev.stcBest ? fmtTime(s.ev.stcBest, 0) : '—'}</td><td class="num">${s.gapBest != null ? (s.gapBest > 0 ? '+' : '') + round(s.gapBest, 1) + ' s' : '—'}</td><td class="num">${s.count > 1 ? delta(-s.improvement, true, (v) => round(v, 1) + ' s faster') : '—'}</td><td class="num">${r.n ? `${r.w}–${r.l}` : '—'}</td><td>${gapBadge(s)}</td></tr>`; }).join('')}</table></div>
        <small>* Best time from time tests, converted to 1000 yd.</small></div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Athlete load — events, points and progress</h3></div>
        <div class="table-wrap"><table><tr><th>Athlete</th><th>Boats</th><th class="num">Events</th><th class="num">Points carried</th><th class="num">Races W–L</th><th class="num">2k change</th><th class="num">km / week (4-wk avg)</th><th class="num">Attendance</th><th>Watch</th></tr>
        ${load.map((x) => `<tr class="${x.evs.length >= 2 ? 'hl' : ''}"><td><b>${esc(x.a.name)}</b><br><small>${esc(S.skillText(x.a))}</small></td><td>${x.evs.map((e) => `<span class="chip">${esc(e.code)}</span>`).join('') || '—'}</td><td class="num">${x.evs.length}</td>
          <td class="num"><b>${x.pts}</b>${totalPts ? ` <small>(${Math.round((x.pts / totalPts) * 100)}%)</small>` : ''}</td><td class="num">${x.r.n ? `${x.r.w}–${x.r.l}` : '—'}</td>
          <td class="num">${x.erg !== null ? delta(x.erg, true, (v) => fmtTime(v)) : '—'}</td><td class="num">${x.km4}</td><td class="num">${x.att ?? '—'}%</td>
          <td>${x.evs.length >= 3 ? '<span class="badge warn">3+ events</span> ' : x.evs.length === 2 ? '<span class="badge">doubling up</span> ' : ''}${x.flag ? '<span class="badge warn">raised RHR</span>' : ''}${x.att !== null && x.att < 80 ? '<span class="badge bad">low attendance</span>' : ''}</td></tr>`).join('')}</table></div>
        <small>Points carried = Royal Thomian points of every boat the athlete is in. Highlighted rows race in more than one event.</small></div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>% of record speed by boat</h3></div><div class="chart-box tall"><canvas id="repPct"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>Attendance trend</h3></div><div class="chart-box tall"><canvas id="repAtt"></canvas></div></div>
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Training this week</h3></div>
          ${wkPlan ? `<p style="margin-top:0"><b>Focus:</b> ${esc(wkPlan.focus || '—')}</p><p>${wkPlan.sessions.filter((s) => s.type !== 'rest').length} sessions planned, ${wkPlan.sessions.filter((s) => s.crews?.length).length} of them crew-specific.</p>` : empty('No plan entered.')}
          <p>Training completed by crews over the last 2 weeks: ${d.events.map((e) => `<span class="chip">${esc(e.code)} ${S.crewCompletion(e.id, U.addDays(U.today(), -14)) ?? '—'}%</span>`).join(' ')}</p>
          <h3 style="margin-top:12px">Athlete welfare</h3>
          ${flags.length ? `<p>${flags.length} athlete(s) currently show raised resting heart rate (possible fatigue or illness) and are being monitored.</p>` : '<p>No welfare flags from resting heart-rate monitoring.</p>'}</div>
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
      chart('repAtt', { type: 'line', data: { labels: aw.map((x) => fmtShort(x.week)), datasets: [{ label: 'Attendance %', data: aw.map((x) => x.pct), borderColor: COLORS[5], backgroundColor: COLORS[5] + '22', fill: true, tension: .3, spanGaps: true }] }, options: { scales: { y: { min: 50, max: 100 } }, plugins: { legend: { display: false } } } });
    },
    act: { print() { window.print(); return false; } },
  };

  // =====================================================================
  // DATA, SETTINGS & ACCOUNTS (coach)
  // =====================================================================
  const ROLE_NAMES = { coach: 'Coach', entry: 'Data entry (secretary / cox)', athlete: 'Athlete', advisory: 'Advisory committee (view only)' };
  Views.data = {
    render() {
      const d = db(); const st = d.settings;
      const size = new Blob([Store.exportJSON()]).size;
      const cloud = S.mode === 'cloud';
      return `
      <div class="section-title"><h2>Data &amp; settings</h2></div>
      ${this.accounts(cloud)}
      <div class="grid g2" style="margin-top:16px">
        ${roleCard('Team settings', `<form class="form" data-form="saveSettings">
          <label class="full">Team name<input name="teamName" value="${esc(st.teamName)}"></label>
          <label>Main regatta<input name="regattaName" value="${esc(st.regattaName)}"></label>
          <label>Next regatta date<input type="date" name="regattaDate" value="${esc(st.regattaDate)}"></label>
          <label class="full">Venue<input name="venue" value="${esc(st.venue)}"></label>
          <label>Rowing from<input type="time" name="rowStart" value="${esc(st.rowStart)}"></label>
          <label>Rowing until<input type="time" name="rowEnd" value="${esc(st.rowEnd)}"></label>
          <label>Fitness until<input type="time" name="fitnessEnd" value="${esc(st.fitnessEnd)}"></label>
          <label class="full">Coaches<input name="coaches" value="${esc(st.coaches)}"></label>
          <label class="full">About the team<textarea name="about">${esc(st.about)}</textarea></label>
          ${cloud ? '' : `<label>Coach PIN<input name="coachPin" value="${esc(st.coachPin)}"></label><label>Data-entry PIN<input name="entryPin" value="${esc(st.entryPin)}"></label>`}
          <div><button class="btn">Save settings</button></div></form>`)}
        ${roleCard('Back up &amp; restore', `
          <p style="margin-top:0">Mode: <b>${cloud ? 'Cloud (shared, with logins)' : 'Local (this browser only)'}</b> · ${round(size / 1024, 0)} KB.</p>
          <div class="btn-row"><button class="btn" data-act="exportJSON">Download backup</button>
            <label class="btn ghost" style="display:inline-block;color:var(--navy);font-size:.88rem">Restore / import backup<input type="file" accept="application/json,.json" data-change="importJSON" hidden></label></div>
          <hr class="sep">
          <div class="btn-row"><button class="btn danger" data-act="resetDemo">Load demo squad</button><button class="btn danger" data-act="startEmpty">Start empty (keeps events, records &amp; history)</button></div>
          ${cloud ? '<p><small>In cloud mode these replace the shared data for everyone — download a backup first.</small></p>' : '<p><small>Local mode: the PINs only hide editing controls. Switch on cloud mode (below) for real logins.</small></p>'}`)}
      </div>
      <div style="margin-top:16px">${roleCard('Events, points &amp; records', `
        <p style="margin-top:0">Royal Thomian events are raced over 1000 yd (914.4 m). Records are published course records updated with reported 2026 times; tick <b>Verified</b> once checked against the official record sheet.</p>
        <form data-form="saveEvents"><div class="table-wrap"><table><tr><th>Code</th><th>Event name</th><th>Boat</th><th class="num">Rowers</th><th>Cox</th><th>Distance</th><th class="num">Points</th><th>Record</th><th>Holder</th><th>Year</th><th>STC best</th><th>STC year</th><th>Verified</th><th></th></tr>
          ${d.events.map((e) => `<tr>
            <td><input name="code_${e.id}" value="${esc(e.code)}" style="width:70px"></td>
            <td><input name="name_${e.id}" value="${esc(e.name)}" style="min-width:170px"></td>
            <td><select name="boat_${e.id}" style="width:64px">${['4+', '4-', '4x', '2x', '2-', '1x', '8+'].map((b) => opt(b, b, e.boat)).join('')}</select></td>
            <td class="num"><input type="number" name="seats_${e.id}" value="${e.seats}" min="1" max="8" style="width:56px"></td>
            <td><input type="checkbox" name="cox_${e.id}" ${e.cox ? 'checked' : ''} style="width:auto"></td>
            <td><select name="distance_${e.id}" style="width:120px">${distanceOptions(e.distance)}</select></td>
            <td class="num"><input type="number" name="points_${e.id}" value="${e.points ?? ''}" style="width:60px"></td>
            <td><input name="record_${e.id}" value="${e.record ? fmtTime(e.record, 0) : ''}" placeholder="m:ss" style="width:70px"></td>
            <td><input name="holder_${e.id}" value="${esc(e.recordHolder || '')}" style="min-width:120px"></td>
            <td><input name="year_${e.id}" value="${esc(e.recordYear || '')}" style="width:90px"></td>
            <td><input name="stc_${e.id}" value="${e.stcBest ? fmtTime(e.stcBest, 0) : ''}" style="width:70px"></td>
            <td><input name="stcyear_${e.id}" value="${esc(e.stcBestYear || '')}" style="width:80px"></td>
            <td><input type="checkbox" name="verified_${e.id}" ${e.recordVerified ? 'checked' : ''} style="width:auto"></td>
            <td><button type="button" class="icon-btn" data-act="delEventType" data-id="${e.id}" title="Remove event">✕</button></td></tr>`).join('')}
        </table></div><div class="btn-row" style="margin-top:10px"><button class="btn">Save events &amp; records</button><button type="button" class="btn ghost" data-act="addEventType">+ Add event</button></div></form>`)}</div>`;
    },
    accounts(cloud) {
      if (!cloud) {
        return roleCard('Logins for coaches, data entry, athletes &amp; the advisory committee', `
          <p style="margin-top:0">The site is in <b>local mode</b>: data stays in this browser and the role buttons are protected only by PINs. To give everyone their own login and share one set of data:</p>
          <ol><li>Create a free Firebase project and fill in <code>js/firebase-config.js</code> — the steps are written at the top of that file and in the README.</li>
          <li>Open the site, choose <b>First-time setup</b> on the sign-in screen and create your coach account.</li>
          <li>Back here, click <b>Download backup</b> before switching, then in cloud mode use <b>Restore</b> to upload your data.</li>
          <li>Create a login for each athlete (linked to their profile), the secretary / coxes doing data entry, and committee members.</li></ol>`);
      }
      const users = Cloud.users.slice().sort((a, b) => (a.role + a.name).localeCompare(b.role + b.name));
      return roleCard('Logins', `
        <div class="table-wrap"><table><tr><th>Name</th><th>Username / email</th><th>Role</th><th>Linked athlete</th><th></th></tr>
          ${users.map((u) => `<tr><td><b>${esc(u.name || '')}</b></td><td><small>${esc((u.login || '').replace('@' + Cloud.USER_DOMAIN, ''))}</small></td>
            <td><select data-change="userRole" data-uid="${u.uid}" ${u.uid === Cloud.user?.uid ? 'disabled' : ''}>${Object.entries(ROLE_NAMES).map(([k, v]) => opt(k, v, u.role)).join('')}</select></td>
            <td>${u.role === 'athlete' ? `<select data-change="userAthlete" data-uid="${u.uid}">${athleteOptions(u.athleteId, () => true, '— not linked —')}</select>` : ''}</td>
            <td>${u.uid !== Cloud.user?.uid ? `<button class="btn danger sm" data-act="removeUser" data-uid="${u.uid}">Remove access</button>` : '<small>you</small>'}</td></tr>`).join('') || `<tr><td colspan="5">${empty('No accounts yet.')}</td></tr>`}</table></div>
        <h3 style="margin-top:14px">Create a login</h3>
        <form class="form" data-form="createUser">
          <label>Name<input name="name" required placeholder="Ashen Perera"></label>
          <label>Username or email<input name="login" required placeholder="ashen.perera"></label>
          <label>Temporary password<input name="password" required minlength="6" value="${Math.random().toString(36).slice(2, 8)}rw"></label>
          <label>Role<select name="role">${Object.entries(ROLE_NAMES).map(([k, v]) => opt(k, v, 'athlete')).join('')}</select></label>
          <label>Athlete profile<select name="athleteId">${athleteOptions('', () => true, '— for athletes —')}</select></label>
          <div><button class="btn">Create login</button></div>
          <small class="full">Give the person their username and password. They can change the password from the account menu (top right). Usernames without “@” sign in as written — no email needed. If someone forgets their password, remove access and create a new login.</small>
        </form>`, 'Coach');
    },
    act: {
      saveSettings(f) { const v = U.formData(f); if (S.mode === 'local' && (!v.coachPin || !v.entryPin)) { U.toast('PINs cannot be empty'); return false; } Object.assign(db().settings, v); return 'Settings saved'; },
      saveEvents(f) {
        let bad = 0;
        db().events.forEach((e) => {
          const g = (k) => f.elements[`${k}_${e.id}`];
          const time = (k) => { const r = g(k).value.trim(); const t = r ? U.parseTime(r) : null; if (r && !t) bad++; return t; };
          e.code = g('code').value.trim() || e.code; e.name = g('name').value.trim(); e.boat = g('boat').value;
          e.seats = Math.max(1, Number(g('seats').value) || e.seats); e.cox = g('cox').checked;
          e.distance = Number(g('distance').value) || e.distance; e.points = g('points').value === '' ? null : Number(g('points').value);
          e.record = time('record'); e.recordHolder = g('holder').value.trim(); e.recordYear = g('year').value.trim();
          e.stcBest = time('stc'); e.stcBestYear = g('stcyear').value.trim(); e.recordVerified = g('verified').checked;
          const c = db().crews[e.id]; if (c) c.seats = c.seats.slice(0, e.seats);
        });
        return bad ? `Saved — ${bad} time(s) unreadable and cleared` : 'Events & records saved';
      },
      addEventType() { db().events.push({ id: U.uid('ev'), code: 'New', name: 'New event', boat: '4+', seats: 4, cox: true, distance: 914.4, points: null, record: null, recordHolder: '', recordYear: '', stcBest: null, stcBestYear: '', recordVerified: false }); return 'Event added — fill in its details'; },
      delEventType(el) {
        const e = S.event(el.dataset.id); const n = db().results.filter((r) => r.eventId === e.id).length;
        if (!confirm(`Remove ${e.code}? ${n} time test(s) for it will also be removed.`)) return false;
        const d = db(); d.events = d.events.filter((x) => x.id !== e.id); d.results = d.results.filter((r) => r.eventId !== e.id); d.combos = d.combos.filter((r) => r.eventId !== e.id); delete d.crews[e.id];
        return 'Event removed';
      },
      exportJSON() { U.download(`stc-rowing-backup-${U.today()}.json`, Store.exportJSON()); return false; },
      async importJSON(el) {
        const file = el.files[0]; if (!file) return false;
        if (!confirm('Replace the current data with this backup?')) return false;
        try { Store.importJSON(await file.text()); return 'Backup restored'; } catch (e) { U.toast('Import failed: ' + e.message); return false; }
      },
      resetDemo() { if (!confirm('Replace all data with the demo squad?')) return false; Store.reset('demo'); return 'Demo data loaded'; },
      startEmpty() { if (!confirm('Remove ALL athletes, results, attendance, schedules and photos? Events, records and Royal Thomian history are kept. (Download a backup first if needed.)')) return false; Store.reset('empty'); return 'Started with an empty squad'; },
      async createUser(f) {
        const v = U.formData(f);
        if (v.role === 'athlete' && !v.athleteId) { U.toast('Choose the athlete profile to link'); return false; }
        try { await Cloud.createAccount(v); U.toast(`Login created: ${v.login} / ${v.password}`); f.reset(); } catch (e) { U.toast('Could not create: ' + e.message); }
        return false;
      },
      async userRole(el) { try { await Cloud.updateUser(el.dataset.uid, { role: el.value }); U.toast('Role updated'); } catch (e) { U.toast(e.message); } return false; },
      async userAthlete(el) { try { await Cloud.updateUser(el.dataset.uid, { athleteId: el.value }); U.toast('Linked'); } catch (e) { U.toast(e.message); } return false; },
      async removeUser(el) { if (!confirm('Remove this person\'s access?')) return false; try { await Cloud.removeUser(el.dataset.uid); U.toast('Access removed'); } catch (e) { U.toast(e.message); } return false; },
    },
  };
})();
