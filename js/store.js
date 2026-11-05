/* Data store + derived calculations.
   Data lives in the browser (localStorage). To share one data set with the whole
   team, the coach exports a JSON file and publishes it as data/team-data.json —
   anyone opening the site without local edits loads that file. */
const Store = (() => {
  const KEY = 'stc-rowing-hub-v1';
  let db = null;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const emptyDB = () => {
    const d = clone(SEED);
    Object.assign(d, { athletes: [], metrics: [], results: [], combos: [], calendar: [], attendance: {}, updates: [], photos: [], weeks: {} });
    d.crews = {};
    d.settings.demo = false;
    d.events.forEach((e) => { e.record = null; });
    return d;
  };

  function normalise(d) {
    const base = clone(SEED);
    for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
    d.settings = { ...base.settings, ...d.settings };
    return d;
  }

  async function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { db = normalise(JSON.parse(raw)); db._source = 'local'; return db; }
    } catch (e) { console.warn('local data unreadable', e); }
    try {
      const res = await fetch('data/team-data.json', { cache: 'no-store' });
      if (res.ok) { db = normalise(await res.json()); db._source = 'published'; return db; }
    } catch (e) { /* no published file — fall back to demo */ }
    db = clone(SEED); db._source = 'demo';
    return db;
  }
  function save() {
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
    db = normalise(d); save();
  }
  function reset(kind) {
    localStorage.removeItem(KEY);
    db = kind === 'empty' ? emptyDB() : clone(SEED);
    if (kind === 'empty') save();
  }

  // ---------- lookups ----------
  const athlete = (id) => db.athletes.find((a) => a.id === id);
  const event = (id) => db.events.find((e) => e.id === id);
  const name = (id) => athlete(id)?.name || '—';
  const short = (id) => { const n = name(id); const p = n.split(' '); return p.length > 1 ? p[0][0] + '. ' + p.slice(1).join(' ') : n; };

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
  const best = (athleteId, type) => {
    const s = series(athleteId, type); if (!s.length) return null;
    return METRICS[type].lowerBetter === false ? s.reduce((a, b) => (b.value > a.value ? b : a)) : s.reduce((a, b) => (b.value < a.value ? b : a));
  };
  // Resting HR more than 5 bpm above the athlete's 4-reading baseline is a common sign of fatigue/illness.
  function rhrFlag(athleteId) {
    const s = series(athleteId, 'rhr'); if (s.length < 3) return null;
    const last = s[s.length - 1];
    const base = U.mean(s.slice(-5, -1).map((m) => m.value));
    const diff = last.value - base;
    return diff >= 5 ? { diff: U.round(diff, 0), last, base: U.round(base, 0) } : null;
  }
  function wPerKg(athleteId) {
    const e = best(athleteId, 'erg2k'); const w = latest(athleteId, 'weight')?.value || athlete(athleteId)?.weight;
    if (!e || !w) return null;
    return U.round(U.watts(e.value, 2000) / w, 2);
  }

  // ---------- attendance ----------
  function attendancePct(athleteId, fromDate) {
    let tot = 0, pres = 0;
    for (const [d, marks] of Object.entries(db.attendance)) {
      if (fromDate && d < fromDate) continue;
      const m = marks[athleteId]; if (!m) continue;
      if (m === 'E') continue; // excused does not count against
      tot++; if (m === 'P' || m === 'L') pres++;
    }
    return tot ? Math.round((pres / tot) * 100) : null;
  }
  function squadAttendance(fromDate) {
    const vals = db.athletes.map((a) => attendancePct(a.id, fromDate)).filter((v) => v !== null);
    return vals.length ? Math.round(U.mean(vals)) : null;
  }
  function attendanceByWeek(weeksBack = 8) {
    const out = [];
    const mon = U.mondayOf(U.today());
    for (let w = weeksBack - 1; w >= 0; w--) {
      const ws = U.addDays(mon, -7 * w), we = U.addDays(ws, 6);
      let tot = 0, pres = 0;
      for (const [d, marks] of Object.entries(db.attendance)) {
        if (d < ws || d > we) continue;
        for (const m of Object.values(marks)) { if (m === 'E') continue; tot++; if (m === 'P' || m === 'L') pres++; }
      }
      out.push({ week: ws, pct: tot ? Math.round((pres / tot) * 100) : null });
    }
    return out;
  }

  // ---------- boat results ----------
  const eventResults = (eventId) => db.results.filter((r) => r.eventId === eventId).sort((a, b) => a.date.localeCompare(b.date));
  // Every result normalised to the race distance (Paul's law) so tests over different distances are comparable.
  const raceEquivalent = (r) => {
    const ev = event(r.eventId);
    return r.distance === ev.distance ? r.time : U.projectTime(r.time, r.distance, ev.distance);
  };
  function eventSummary(eventId) {
    const ev = event(eventId); const rs = eventResults(eventId);
    if (!rs.length) return { ev, count: 0 };
    const eq = rs.map((r) => ({ r, t: raceEquivalent(r) }));
    const bestR = eq.reduce((a, b) => (b.t < a.t ? b : a));
    const latestR = eq[eq.length - 1];
    const firstR = eq[0];
    const rec = ev.record;
    return {
      ev, count: rs.length, best: bestR, latest: latestR, first: firstR,
      gapBest: rec ? bestR.t - rec : null,
      gapLatest: rec ? latestR.t - rec : null,
      pctOfRecord: rec ? (rec / bestR.t) * 100 : null, // speed as % of record speed
      improvement: firstR.t - latestR.t,
    };
  }

  return {
    get db() { return db; }, load, save, exportJSON, importJSON, reset, emptyDB,
    athlete, event, name, short, METRICS, series, latest, first, best, rhrFlag, wPerKg,
    attendancePct, squadAttendance, attendanceByWeek, eventResults, raceEquivalent, eventSummary,
  };
})();
