/* Data store + derived calculations.
   Two modes:
   - Local mode (default): data lives in this browser (localStorage). Good for trying it out.
   - Cloud mode: when js/firebase-config.js is filled in, data lives in Firebase so every
     login (coach, data-entry, athletes, advisory) sees and edits the same data. See cloud.js. */
const Store = (() => {
  const KEY = 'stc-rowing-hub-v1';
  let db = null;
  let mode = 'local';

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ARRAYS = ['athletes', 'metrics', 'results', 'races', 'combos', 'calendar', 'updates', 'comments', 'logs', 'history', 'photos'];
  const MAPS = ['weeks', 'attendance', 'completion'];

  function emptyDB() {
    const d = clone(SEED);
    // keep events, records, points and regatta history (real data); clear the demo squad and its data
    ARRAYS.filter((k) => k !== 'history').forEach((k) => { d[k] = []; });
    MAPS.forEach((k) => { d[k] = {}; });
    d.crews = {};
    d.settings.demo = false;
    return d;
  }

  // Bring older saved data up to the current shape.
  function migrate(d) {
    const base = clone(SEED);
    // version 1 had placeholder records/distances — replace with the published Royal Thomian events
    if (!d.version || d.version < 2) {
      const byId = Object.fromEntries(base.events.map((e) => [e.id, e]));
      d.events = (d.events || []).map((e) => byId[e.id] || e);
      d.history = base.history;
      d.settings = { ...(d.settings || {}), regattaDate: base.settings.regattaDate, venue: base.settings.venue, about: base.settings.about };
    }
    for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = ARRAYS.includes(k) ? [] : MAPS.includes(k) ? {} : base[k];
    d.settings = { ...base.settings, ...d.settings };
    d.athletes.forEach((a) => {
      if (!a.skills) {
        const r = a.role || '';
        a.skills = r === 'Cox' ? ['cox'] : r === 'Sculler' ? ['scull'] : r === 'Bow side' ? ['bow'] : r === 'Both sides' ? ['stroke', 'bow'] : ['stroke'];
        delete a.role;
      }
    });
    d.events.forEach((e) => { if (e.points === undefined) e.points = null; });
    Object.values(d.weeks).forEach((w) => w.sessions.forEach((s) => {
      if (s.start === undefined) { s.start = s.time || ''; s.end = s.time ? U.hhmm(U.minutes(s.time) + 90) : ''; delete s.time; }
      s.crews ||= []; s.exceptions ||= {}; if (s.km === undefined) s.km = 0;
    }));
    d.version = 2;
    return d;
  }

  async function load() {
    if (typeof Cloud !== 'undefined' && Cloud.enabled) {
      mode = 'cloud';
      db = emptyDB(); db._source = 'cloud';
      return db;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { db = migrate(JSON.parse(raw)); db._source = 'local'; return db; }
    } catch (e) { console.warn('local data unreadable', e); }
    try {
      const res = await fetch('data/team-data.json', { cache: 'no-store' });
      if (res.ok) { db = migrate(await res.json()); db._source = 'published'; return db; }
    } catch (e) { /* no published file */ }
    db = clone(SEED); db._source = 'demo';
    return db;
  }
  function save() {
    if (mode === 'cloud') { Cloud.push(db); return true; }
    try {
      const { _source, ...rest } = db;
      localStorage.setItem(KEY, JSON.stringify(rest));
      db._source = 'local';
      return true;
    } catch (e) {
      U.toast('Could not save — browser storage is full. Remove some photos or export data.');
      return false;
    }
  }
  const exportJSON = () => { const { _source, ...rest } = db; return JSON.stringify(rest, null, 1); };
  function importJSON(text) {
    const d = JSON.parse(text);
    if (!d.events || !d.athletes) throw new Error('Not a Crew Hub data file');
    const src = db?._source; db = migrate(d); db._source = src; save();
  }
  function reset(kind) {
    const src = db?._source;
    if (mode === 'local') localStorage.removeItem(KEY);
    db = kind === 'empty' ? emptyDB() : clone(SEED);
    if (mode === 'cloud') db._source = src;
    if (kind === 'empty' || mode === 'cloud') save();
  }
  const replace = (d) => { db = d; };

  // ---------- lookups ----------
  const athlete = (id) => db.athletes.find((a) => a.id === id);
  const event = (id) => db.events.find((e) => e.id === id);
  const name = (id) => athlete(id)?.name || '—';
  const short = (id) => { const n = name(id); const p = n.split(' '); return p.length > 1 ? p[0][0] + '. ' + p.slice(1).join(' ') : n; };
  const SKILLS = { stroke: 'Sweep — stroke side', bow: 'Sweep — bow side', scull: 'Sculler', cox: 'Cox' };
  const SKILL_SHORT = { stroke: 'Stroke side', bow: 'Bow side', scull: 'Sculler', cox: 'Cox' };
  const isCox = (a) => !!a && a.skills?.length === 1 && a.skills[0] === 'cox';
  const skillText = (a) => (a?.skills || []).map((k) => SKILL_SHORT[k]).join(' · ') || '—';
  const athleteEvents = (id) => db.events.filter((e) => { const c = db.crews[e.id]; return c && (c.seats.includes(id) || c.cox === id); });

  // ---------- metrics ----------
  const METRICS = {
    erg2k: { label: '2k erg', unit: 'time', lowerBetter: true },
    erg5k: { label: '5k erg', unit: 'time', lowerBetter: true },
    vo2: { label: 'VO₂ max', unit: 'ml/kg/min', lowerBetter: false },
    rhr: { label: 'Resting HR', unit: 'bpm', lowerBetter: true },
    weight: { label: 'Body weight', unit: 'kg', lowerBetter: null },
  };
  const series = (athleteId, type) => db.metrics.filter((m) => m.athleteId === athleteId && m.type === type).sort((a, b) => a.date.localeCompare(b.date));
  const latest = (athleteId, type) => { const s = series(athleteId, type); return s.length ? s[s.length - 1] : null; };
  const first = (athleteId, type) => series(athleteId, type)[0] || null;
  const onDate = (athleteId, type, date) => db.metrics.find((m) => m.athleteId === athleteId && m.type === type && m.date === date) || null;
  const best = (athleteId, type) => {
    const s = series(athleteId, type); if (!s.length) return null;
    return METRICS[type].lowerBetter === false ? s.reduce((a, b) => (b.value > a.value ? b : a)) : s.reduce((a, b) => (b.value < a.value ? b : a));
  };
  // set (or replace) the single value of a metric for an athlete on a date
  function setMetric(athleteId, type, date, value, extra = {}) {
    const ex = onDate(athleteId, type, date);
    if (value === null || value === '' || isNaN(value)) { if (ex) db.metrics = db.metrics.filter((m) => m !== ex); return; }
    if (ex) Object.assign(ex, { value, ...extra });
    else db.metrics.push({ id: U.uid('m'), athleteId, date, type, value, ...extra });
  }
  // Resting HR 5+ bpm above the athlete's recent baseline is a common sign of fatigue or illness.
  function rhrFlag(athleteId) {
    const s = series(athleteId, 'rhr'); if (s.length < 4) return null;
    const last = s[s.length - 1];
    if (U.daysBetween(last.date, U.today()) > 3) return null;
    const base = U.mean(s.slice(-8, -1).map((m) => m.value));
    const diff = last.value - base;
    return diff >= 5 ? { diff: U.round(diff, 0), last, base: U.round(base, 0) } : null;
  }
  function wPerKg(athleteId) {
    const e = best(athleteId, 'erg2k'); const w = latest(athleteId, 'weight')?.value || athlete(athleteId)?.weight;
    if (!e || !w) return null;
    return U.round(U.watts(e.value, 2000) / w, 2);
  }

  // ---------- attendance ----------
  const present = (m) => m === 'P' || m === 'L';
  function attendancePct(athleteId, fromDate) {
    let tot = 0, pres = 0;
    for (const [d, marks] of Object.entries(db.attendance)) {
      if (fromDate && d < fromDate) continue;
      const m = marks[athleteId]; if (!m || m === 'E') continue;
      tot++; if (present(m)) pres++;
    }
    return tot ? Math.round((pres / tot) * 100) : null;
  }
  function squadAttendance(fromDate) {
    const vals = db.athletes.map((a) => attendancePct(a.id, fromDate)).filter((v) => v !== null);
    return vals.length ? Math.round(U.mean(vals)) : null;
  }
  function attendanceByWeek(weeksBack = 8) {
    const out = []; const mon = U.mondayOf(U.today());
    for (let w = weeksBack - 1; w >= 0; w--) {
      const ws = U.addDays(mon, -7 * w), we = U.addDays(ws, 6);
      let tot = 0, pres = 0;
      for (const [d, marks] of Object.entries(db.attendance)) {
        if (d < ws || d > we) continue;
        for (const m of Object.values(marks)) { if (m === 'E') continue; tot++; if (present(m)) pres++; }
      }
      out.push({ week: ws, pct: tot ? Math.round((pres / tot) * 100) : null });
    }
    return out;
  }

  // ---------- schedule ----------
  const dayName = (date) => U.DAYS[(U.parseISO(date).getDay() + 6) % 7];
  const sessionCrews = (s) => (s.crews && s.crews.length ? s.crews : db.events.map((e) => e.id));
  const sessionsOn = (date) => {
    const wk = db.weeks[U.mondayOf(date)]; if (!wk) return [];
    return wk.sessions.filter((s) => s.day === dayName(date)).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
  };
  // sessions that apply to an athlete (through any crew they are in, or whole-squad sessions)
  function athleteSessions(athleteId, date) {
    const mine = athleteEvents(athleteId).map((e) => e.id);
    return sessionsOn(date).filter((s) => !s.crews?.length || s.crews.some((c) => mine.includes(c)))
      .map((s) => ({ s, via: s.crews?.length ? s.crews.filter((c) => mine.includes(c)) : [], exception: mine.map((c) => s.exceptions?.[c]).find(Boolean) || '' }));
  }
  const completionOf = (date, sessionId, crewId) => db.completion[date]?.[sessionId]?.[crewId] || '';
  const FACTOR = { done: 1, partial: 0.5, missed: 0 };
  // km an athlete rowed: planned km of water/erg sessions on days they attended, scaled by how much
  // of the session their crew completed (unmarked past sessions count as done), plus their own logged extra km.
  function kmOn(athleteId, date) {
    const att = db.attendance[date]?.[athleteId];
    let km = 0;
    if (present(att)) {
      const mine = athleteEvents(athleteId).map((e) => e.id);
      athleteSessions(athleteId, date).forEach(({ s }) => {
        if (!s.km) return;
        const crewsToCheck = (s.crews?.length ? s.crews : mine).filter((c) => mine.includes(c));
        const marks = crewsToCheck.map((c) => completionOf(date, s.id, c)).filter(Boolean);
        const f = marks.length ? Math.max(...marks.map((m) => FACTOR[m])) : 1;
        km += Number(s.km) * f;
      });
    }
    km += db.logs.filter((l) => l.athleteId === athleteId && l.date === date).reduce((t, l) => t + (Number(l.km) || 0), 0);
    return km;
  }
  function kmWeek(athleteId, monday) {
    let t = 0; for (let i = 0; i < 7; i++) { const d = U.addDays(monday, i); if (d <= U.today()) t += kmOn(athleteId, d); }
    return U.round(t, 1);
  }
  // completion rate of a crew over recent days
  function crewCompletion(crewId, fromDate) {
    let tot = 0, score = 0;
    for (const [d, sess] of Object.entries(db.completion)) {
      if (fromDate && d < fromDate) continue;
      for (const marks of Object.values(sess)) { const m = marks[crewId]; if (!m) continue; tot++; score += FACTOR[m]; }
    }
    return tot ? Math.round((score / tot) * 100) : null;
  }

  // ---------- boat time tests ----------
  const eventResults = (eventId) => db.results.filter((r) => r.eventId === eventId).sort((a, b) => a.date.localeCompare(b.date));
  // results over other distances converted to the race distance with Paul's law
  const raceEquivalent = (r) => {
    const ev = event(r.eventId);
    return Math.abs(r.distance - ev.distance) < 0.5 ? r.time : U.projectTime(r.time, r.distance, ev.distance);
  };
  function eventSummary(eventId) {
    const ev = event(eventId); const rs = eventResults(eventId);
    if (!rs.length) return { ev, count: 0 };
    const eq = rs.map((r) => ({ r, t: raceEquivalent(r) }));
    const bestR = eq.reduce((a, b) => (b.t < a.t ? b : a));
    const latestR = eq[eq.length - 1], firstR = eq[0], rec = ev.record;
    return {
      ev, count: rs.length, best: bestR, latest: latestR, first: firstR,
      gapBest: rec ? bestR.t - rec : null, gapLatest: rec ? latestR.t - rec : null,
      pctOfRecord: rec ? (rec / bestR.t) * 100 : null, improvement: firstR.t - latestR.t,
    };
  }

  // ---------- regatta races ----------
  const raceWon = (r) => Number(r.placing) === 1;
  const athleteRaces = (id) => db.races.filter((r) => r.crew.includes(id) || r.cox === id).sort((a, b) => b.date.localeCompare(a.date));
  function record(list) { const w = list.filter(raceWon).length; return { w, l: list.length - w, n: list.length }; }
  const athletePoints = (id) => athleteEvents(id).reduce((t, e) => t + (Number(e.points) || 0), 0);

  return {
    get db() { return db; }, get mode() { return mode; }, load, save, exportJSON, importJSON, reset, emptyDB, migrate, replace, ARRAYS, MAPS,
    athlete, event, name, short, SKILLS, isCox, skillText, athleteEvents,
    METRICS, series, latest, first, onDate, best, setMetric, rhrFlag, wPerKg,
    present, attendancePct, squadAttendance, attendanceByWeek,
    dayName, sessionCrews, sessionsOn, athleteSessions, completionOf, kmOn, kmWeek, crewCompletion,
    eventResults, raceEquivalent, eventSummary, raceWon, athleteRaces, record, athletePoints,
  };
})();
