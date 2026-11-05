/* Demo data so every dashboard has something to show on first load.
   Athlete names, times, records and points are FICTIONAL placeholders — the coach
   replaces them (Data & Settings → "Start empty", then enter the real squad). */
const SEED = (() => {
  let s = 20261105;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const jitter = (n) => (rnd() - 0.5) * 2 * n;
  const RT = 914.4; // Royal Thomian course: 1000 yards

  // Royal Thomian events. Points = the 52 scoring points (2026 allocation).
  // record = series best (course record) over 1000 yd; stcBest = S. Thomas' best.
  // Source: Wikipedia record table + 2026 ePRESS match report (2026 marks inferred, not officially ratified).
  const EVENTS = [
    // id,     code,     name,                                   boat, seats, cox, pts, record, recYear, recHolder,            stcBest, stcYear
    ['ev4A',  'A4+',    'Senior Coxed Four — Boat Race',          '4+', 4, true, 12, 175, '2011, 2025', 'Royal College',       176, '2025'],
    ['ev4B',  'B4+',    'Junior Coxed Four',                      '4+', 4, true,  8, 183, '2011 / 2019', 'Royal 2011 · STC 2019', 183, '2019'],
    ['ev4C',  'C4+',    'Junior B Coxed Four',                    '4+', 4, true,  0, 192, '2019', 'Royal College',              193, '2019'],
    ['ev2xA', 'A2x',    'Senior Double Scull',                    '2x', 2, false, 8, 184, '2023', 'Royal College',              188, '2025'],
    ['ev2xB', 'B2x',    'Junior Double Scull',                    '2x', 2, false, 4, 191, '2013, 2026', 'Royal College',        196, '2026'],
    ['ev2-A', 'A2-',    'Senior Coxless Pair',                    '2-', 2, false, 8, 189, '2023', "S. Thomas' College",         189, '2023'],
    ['ev2-B', 'B2-',    'Junior Coxless Pair',                    '2-', 2, false, 4, 197, '2023, 2026', 'Royal College',        198, '2013, 2026'],
    ['ev1xA', 'A1x',    'Senior Single Scull',                    '1x', 1, false, 6, 202, '2026', "S. Thomas' College (D. Deheragoda)", 202, '2026'],
    ['ev1xB', 'B1x',    'Junior Single Scull',                    '1x', 1, false, 2, 208, '2013 / 2026', 'STC 2013 · Royal 2026', 208, '2013'],
    ['evU16', 'U16 4+', 'Under-16 Coxed Four',                    '4+', 4, true,  0, 198, '2023', "S. Thomas' College",         198, '2023'],
  ].map(([id, code, name, boat, seats, cox, points, record, recordYear, recordHolder, stcBest, stcBestYear]) => ({
    id, code, name, boat, seats, cox, distance: RT, points, record, recordYear, recordHolder, stcBest, stcBestYear,
    recordVerified: false, recordNote: 'Published record (Wikipedia), updated with reported 2026 times — confirm against the official record sheet',
  }));

  // Recent Royal Thomian results. Overall result, trophy holder and Boat Race winner are kept separate.
  const HISTORY = [
    { id: 'h2026', year: 2026, date: '2026-10-23', royal: 26, stc: 26, result: 'Draw', trophy: 'Royal College (retained)', boatRace: "S. Thomas' College",
      notes: 'Boat Race time disputed: ePRESS 3:03, Wikipedia 3:05.', source: 'https://epress.lk/royal-retain-noel-fernando-trophy-after-thrilling-thomian-draw/',
      events: [
        ['A1x', 'Senior Single Scull', 6, 212, 202, 'STC'], ['B1x', 'Junior Single Scull', 2, 208, 212, 'RC'],
        ['A2-', 'Senior Coxless Pair', 8, 204, 205, 'RC'], ['B2-', 'Junior Coxless Pair', 4, 197, 198, 'RC'],
        ['A2x', 'Senior Double Scull', 8, 195, 203, 'RC'], ['B2x', 'Junior Double Scull', 4, 191, 196, 'RC'],
        ['B4+', 'Junior Coxed Four', 8, 200, 192, 'STC'], ['A4+', 'Senior Coxed Four (Boat Race)', 12, 189, 183, 'STC', 'STC time disputed: 3:03 (ePRESS) vs 3:05 (Wikipedia)'],
        ['U16 4+', 'Under-16 Four', 0, 216, 210, 'STC'], ['C4+', 'Junior B / C Four', 0, 201, 202, 'RC'],
        ['OB 4+', "Old Boys' Four", 0, null, null, 'STC', 'Times not reported'],
      ].map(([code, name, points, rc, stc, winner, note]) => ({ code, name, points, rc, stc, winner, note: note || '' })) },
    { id: 'h2025', year: 2025, royal: 36, stc: 16, result: 'Royal College won', trophy: 'Royal College', boatRace: '', notes: '', source: 'https://en.wikipedia.org/wiki/Royal_Thomian_Regatta' },
    { id: 'h2024', year: 2024, royal: 44, stc: 8, result: 'Royal College won', trophy: 'Royal College', boatRace: '', notes: '53rd regatta', source: 'https://rcu.lk/royal-reclaims-the-t-n-fernando-memorial-trophy-beating-stc-44-8-and-won-the-53rd-royal-thomian-regatta/' },
    { id: 'h2023', year: 2023, royal: 22, stc: 30, result: "S. Thomas' won", trophy: "S. Thomas' College", boatRace: '', notes: '52nd regatta', source: 'https://www.thepapare.com/52nd-royal-thomian-rowing-regatta-2023/' },
    { id: 'h2022', year: 2022, royal: 10, stc: 42, result: "S. Thomas' won", trophy: "S. Thomas' College", boatRace: '', notes: "S. Thomas' largest winning margin", source: 'https://en.wikipedia.org/wiki/Royal_Thomian_Regatta' },
  ];

  const NAMES = [
    'Ashen Perera', 'Dinuk Fernando', 'Kavindu Silva', 'Ravindu Jayasuriya', 'Sahan de Mel', 'Nethum Wickramasinghe',
    'Thisal Gunawardena', 'Yohan Rodrigo', 'Pasindu Senanayake', 'Isuru Bandara', 'Chamath Dias', 'Lahiru Mendis',
    'Hiran Abeysekera', 'Senuka Ratnayake', 'Dulith Karunaratne', 'Minul Peiris', 'Avishka Hettiarachchi', 'Tharindu Weerasinghe',
    'Kaveesh Jayawardena', 'Oshada Samarasinghe', 'Vihanga de Alwis', 'Rehan Wijesinghe', 'Sanuk Liyanage', 'Janith Cooray',
  ];
  const SKILLSETS = [['stroke'], ['bow'], ['stroke', 'scull'], ['bow', 'scull'], ['stroke', 'bow'], ['scull'], ['stroke', 'bow', 'scull']];
  const athletes = NAMES.map((name, i) => {
    const cox = i >= 21;
    const u16 = i >= 16 && i < 21;
    return {
      id: 'ath' + (i + 1), name,
      grade: u16 ? 'Grade 10' : ['Grade 11', 'Grade 12', 'Grade 13'][i % 3],
      age: u16 ? 15 : 16 + (i % 3),
      skills: cox ? ['cox'] : SKILLSETS[i % SKILLSETS.length],
      squad: u16 ? 'U16' : 'Senior',
      height: cox ? 160 + Math.round(rnd() * 6) : 172 + Math.round(rnd() * 16),
      weight: cox ? 52 + Math.round(rnd() * 5) : 64 + Math.round(rnd() * 16),
      photo: '', notes: '',
      _base2k: cox ? null : (u16 ? 445 : 400) + i * 1.6 + jitter(6),
    };
  });

  const TODAY = U.today();
  const start = U.addDays(TODAY, -84);

  // ---------- Metrics (erg, VO2, weight weekly-ish; RHR daily from the daily entry) ----------
  const metrics = [];
  athletes.forEach((a, idx) => {
    const rhrBase = 52 + Math.round(rnd() * 10);
    const vo2Base = a.skills.includes('cox') ? null : 50 + rnd() * 8 - (a.squad === 'U16' ? 3 : 0);
    for (let w = 0; w <= 12; w++) {
      const d = U.addDays(start, w * 7 + (idx % 3));
      if (d > TODAY) continue;
      const prog = w / 12;
      if (a._base2k && w % 3 === 0) metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'erg2k', value: U.round(a._base2k - prog * (8 + rnd() * 6) + jitter(1.5), 1) });
      if (a._base2k && w % 4 === 1) metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'erg5k', value: U.round(a._base2k * 2.62 - prog * 25 + jitter(4), 1) });
      if (vo2Base && w % 4 === 0) metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'vo2', value: U.round(vo2Base + prog * 3 + jitter(0.6), 1) });
      if (w % 4 === 0) metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'weight', value: U.round(a.weight - prog + jitter(0.6), 1) });
    }
    // daily resting HR for the last 3 weeks (weekdays + Sat)
    for (let k = 21; k >= 0; k--) {
      const d = U.addDays(TODAY, -k);
      if (U.parseISO(d).getDay() === 0) continue;
      let rhr = rhrBase - (1 - k / 84) * 4 + jitter(1.5);
      if ((idx === 4 || idx === 11) && k <= 1) rhr += 8; // shows the recovery flag
      metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'rhr', value: Math.round(rhr), source: ['Manual', 'Garmin', 'Whoop', 'Manual'][idx % 4] });
    }
  });
  athletes.forEach((a) => delete a._base2k);

  // ---------- Crews ----------
  const ids = athletes.map((a) => a.id);
  const crews = {
    ev4A: { seats: [ids[0], ids[1], ids[2], ids[3]], cox: ids[21] },
    ev4B: { seats: [ids[4], ids[5], ids[6], ids[7]], cox: ids[22] },
    ev4C: { seats: [ids[8], ids[9], ids[10], ids[11]], cox: ids[23] },
    ev2xA: { seats: [ids[2], ids[6]] },
    ev2xB: { seats: [ids[10], ids[14]] },
    'ev2-A': { seats: [ids[1], ids[0]] },
    'ev2-B': { seats: [ids[12], ids[13]] },
    ev1xA: { seats: [ids[14]] },
    ev1xB: { seats: [ids[15]] },
    evU16: { seats: [ids[16], ids[17], ids[18], ids[19]], cox: ids[23] },
  };

  // ---------- Boat time tests ----------
  const results = [];
  const trialDays = [-77, -63, -49, -35, -21, -10, -3];
  EVENTS.forEach((ev, ei) => {
    const startGap = 0.10 + rnd() * 0.04, endGap = 0.015 + rnd() * 0.03;
    trialDays.forEach((off, k) => {
      const prog = k / (trialDays.length - 1);
      const gap = startGap + (endGap - startGap) * Math.pow(prog, 0.8);
      const dist = k === 2 ? 500 : k === 4 ? 2000 : RT;
      const tRT = ev.record * (1 + gap) + jitter(1.2);
      results.push({
        id: U.uid('r'), date: U.addDays(TODAY, off + (ei % 2)), eventId: ev.id, kind: 'Time test',
        distance: dist, time: U.round(U.projectTime(tRT, RT, dist), 1), rate: dist === 500 ? 36 : dist === 2000 ? 30 : 33,
        conditions: ['Calm', 'Light headwind', 'Tailwind', 'Crosswind', 'Calm'][Math.floor(rnd() * 5)],
        lineup: [...crews[ev.id].seats, ...(crews[ev.id].cox ? [crews[ev.id].cox] : [])], notes: '',
      });
    });
  });

  // ---------- Regatta races (wins / losses through the year) ----------
  const races = [];
  const regattas = [
    { off: -70, name: 'Novices Regatta', dist: 1000 },
    { off: -42, name: 'Schools Head of the River', dist: 3218.7 },
    { off: -28, name: 'Inter-school Sprint Regatta', dist: 500 },
    { off: -10, name: 'Trial Regatta', dist: RT },
  ];
  regattas.forEach((rg, ri) => {
    EVENTS.forEach((ev, ei) => {
      if (rg.dist === 3218.7 && ev.seats < 4) return; // head race fours only
      if ((ei + ri) % 3 === 2 && ri < 3) return;
      const field = rg.dist === 3218.7 ? 8 : 2 + Math.floor(rnd() * 3);
      const placing = Math.max(1, Math.min(field, 1 + Math.floor(rnd() * (ri < 2 ? 3 : 2))));
      const c = crews[ev.id];
      const t = U.projectTime(ev.record * (1.1 - ri * 0.02) + jitter(2), RT, rg.dist);
      races.push({
        id: U.uid('rc'), date: U.addDays(TODAY, rg.off), regatta: rg.name, race: ev.name, eventId: ev.id, boat: ev.boat,
        distance: rg.dist, crew: [...c.seats], cox: c.cox || '', placing, field, time: U.round(t, 1),
        winnerTime: placing === 1 ? U.round(t, 1) : U.round(t - 1 - rnd() * 4, 1),
        opponent: placing === 1 ? 'Royal College' : 'Royal College', notes: '',
      });
    });
  });

  // ---------- Combination tests (seat racing for 4+ A) ----------
  const combos = [];
  [[0, 1, 2, 3], [0, 1, 4, 3], [0, 5, 2, 3], [4, 1, 2, 3], [0, 1, 2, 7]].forEach((set, i) => {
    [-24, -12].forEach((off, j) => {
      combos.push({ id: U.uid('c'), date: U.addDays(TODAY, off + (i % 2)), eventId: 'ev4A', lineup: set.map((k) => ids[k]), cox: ids[21], distance: 500,
        time: U.round(U.projectTime(172 * (1.05 - j * 0.02) + i * 0.9 + jitter(1), RT, 500), 1), rate: 34, notes: i === 0 ? 'Base crew' : 'Swap seat ' + (((i - 1) % 4) + 1) });
    });
  });

  // ---------- Weekly schedule (after school: rowing 2–6 pm, fitness after) ----------
  // crews: [] = whole squad, otherwise list of event ids
  const plan = [
    ['Mon', '14:30', '16:30', 'water', 'Water — steady state', '3 × 4 km UT2 @ r20, catch timing', 12, []],
    ['Mon', '16:45', '17:45', 'erg', 'Erg — technical', 'Pause drills on the erg, 2 × 15 min', 6, []],
    ['Mon', '18:00', '19:00', 'gym', 'Fitness — strength circuit', 'Deadlift, bench pull, core', 0, []],
    ['Tue', '14:30', '16:00', 'water', 'Water — race pace', '6 × 500 m @ r32–34', 9, ['ev4A', 'ev4B', 'ev2xA', 'ev2-A']],
    ['Tue', '14:30', '16:00', 'water', 'Water — technical (small boats)', 'Square-blade, single-arm drills', 8, ['ev1xA', 'ev1xB', 'ev2xB', 'ev2-B']],
    ['Tue', '16:15', '17:45', 'erg', 'Erg intervals', '4 × 1000 m @ 2k pace +4 s', 7, []],
    ['Tue', '18:00', '18:45', 'run', 'Fitness — run + mobility', '6 km easy, 20 min stretch', 0, []],
    ['Wed', '14:30', '16:30', 'water', 'Water — technique', 'Pause drills, feet-out rowing', 11, ['ev4A', 'ev4B', 'ev2xA', 'ev2xB', 'ev2-A', 'ev2-B', 'ev1xA', 'ev1xB']],
    ['Wed', '14:30', '16:30', 'water', 'U16 & C crew — basics', 'Bladework and balance', 9, ['ev4C', 'evU16']],
    ['Wed', '18:00', '19:00', 'gym', 'Fitness — strength', 'Squat, pull-ups, leg press', 0, []],
    ['Thu', '14:30', '16:30', 'water', 'Water — starts & sprints', '10 × 250 m starts + 3 × 1000 yd', 10, []],
    ['Thu', '16:45', '17:45', 'erg', 'Erg — steady', '45 min UT2', 10, []],
    ['Fri', '14:30', '16:00', 'water', 'Water — light paddle', 'Low rate, crew feel', 8, []],
    ['Fri', '16:30', '17:30', 'gym', 'Fitness — core & mobility', '', 0, []],
    ['Sat', '06:00', '08:30', 'test', 'Time test / seat racing', 'Crew time tests over 1000 yd', 6, []],
    ['Sun', '', '', 'rest', 'Rest day', 'Recovery, hydrate, sleep', 0, []],
  ];
  const weeks = {};
  [-35, -28, -21, -14, -7, 0, 7].forEach((off) => {
    const mon = U.mondayOf(U.addDays(TODAY, off));
    weeks[mon] = {
      focus: off < 0 ? 'Aerobic base + technique' : off === 0 ? 'Race pace introduction' : 'Speed & starts',
      sessions: plan.map(([day, startT, end, type, title, details, km, cr]) => ({ id: U.uid('s'), day, start: startT, end, type, title, details, km, crews: [...cr], exceptions: {} })),
    };
  });
  weeks[U.mondayOf(TODAY)].sessions[0].exceptions = { ev4C: 'Technical only — 2 × 4 km at r18 with pause drills' };

  // ---------- Attendance + session completion ----------
  const attendance = {}, completion = {};
  for (let d = U.addDays(TODAY, -41); d <= TODAY; d = U.addDays(d, 1)) {
    if (U.parseISO(d).getDay() === 0) continue;
    attendance[d] = {};
    athletes.forEach((a, i) => {
      const r = rnd(); const rel = i % 7 === 3 ? 0.78 : 0.93;
      attendance[d][a.id] = r < rel ? 'P' : r < rel + 0.03 ? 'L' : r < rel + 0.05 ? 'E' : 'A';
    });
    const wk = weeks[U.mondayOf(d)];
    if (wk && d < TODAY) {
      const day = U.DAYS[(U.parseISO(d).getDay() + 6) % 7];
      completion[d] = {};
      wk.sessions.filter((x) => x.day === day && x.type !== 'rest').forEach((x) => {
        completion[d][x.id] = {};
        (x.crews.length ? x.crews : EVENTS.map((e) => e.id)).forEach((cid) => {
          const r = rnd(); completion[d][x.id][cid] = r < 0.82 ? 'done' : r < 0.94 ? 'partial' : 'missed';
        });
      });
    }
  }

  const calendar = [
    ...trialDays.map((off) => ({ id: U.uid('e'), date: U.addDays(TODAY, off), type: 'timetest', title: 'Crew time test', notes: '' })),
    ...regattas.map((rg) => ({ id: U.uid('e'), date: U.addDays(TODAY, rg.off), type: 'trial', title: rg.name, notes: '' })),
    { id: U.uid('e'), date: U.addDays(TODAY, 4), type: 'timetest', title: 'Crew time test — 1000 yd', notes: '' },
    { id: U.uid('e'), date: U.addDays(TODAY, 11), type: 'trial', title: 'Inter-school trial regatta', notes: '' },
    { id: U.uid('e'), date: U.addDays(TODAY, 18), type: 'meeting', title: 'Advisory committee review', notes: 'Crew progress presentation' },
    { id: U.uid('e'), date: U.addDays(TODAY, 25), type: 'timetest', title: '2k erg test (all squad)', notes: '' },
    { id: U.uid('e'), date: U.addDays(TODAY, 39), type: 'trial', title: 'Final selection trials', notes: '' },
  ];

  const updates = [
    { id: U.uid('u'), date: TODAY, author: 'Head Coach', tag: 'Session', text: 'Good water session — 4+ A held rate 34 through the 500 m pieces. Focus tomorrow: finishing strokes together.' },
    { id: U.uid('u'), date: U.addDays(TODAY, -1), author: 'Head Coach', tag: 'Notice', text: 'Saturday time test at 6:00 am. Bring water bottles and HR straps.' },
    { id: U.uid('u'), date: U.addDays(TODAY, -3), author: 'Assistant Coach', tag: 'Result', text: 'Time test results are in — every crew improved. See Boat Progress.' },
  ];

  const comments = [
    { id: U.uid('cm'), athleteId: ids[0], date: U.addDays(TODAY, -2), author: 'Head Coach', focus: 'Technical', text: 'Hands are rushing into the catch — let the slide control the recovery. Watch the bow pair video.', done: false },
    { id: U.uid('cm'), athleteId: ids[0], date: U.addDays(TODAY, -9), author: 'Head Coach', focus: 'Technical', text: 'Good improvement on bladework at the finish. Keep the outside hand relaxed.', done: true },
    { id: U.uid('cm'), athleteId: ids[1], date: U.addDays(TODAY, -4), author: 'Head Coach', focus: 'Fitness', text: 'Erg pacing: first 500 m too fast on the 2k. Aim for even splits.', done: false },
  ];
  const logs = [
    { id: U.uid('lg'), athleteId: ids[0], date: U.addDays(TODAY, -1), km: 2, rpe: 7, text: 'Felt strong on the race pieces. Working on slowing the slide.' },
    { id: U.uid('lg'), athleteId: ids[0], date: U.addDays(TODAY, -3), km: 0, rpe: 5, text: 'Extra 20 min stretching at home.' },
  ];

  return {
    version: 2,
    settings: {
      teamName: "S. Thomas' College Rowing",
      regattaName: 'Royal Thomian Regatta',
      regattaDate: '2027-10-22',
      venue: 'Beira Lake — Colombo Rowing Club',
      rowStart: '14:00', rowEnd: '18:00', fitnessEnd: '19:30',
      coachPin: '1234', entryPin: '1111',
      about: "The S. Thomas' College rowing crew trains year-round toward the Royal Thomian Regatta, raced over 1000 yards (914.4 m) on Beira Lake for the T. Noel Fernando Memorial Trophy, with the Senior Four contesting the Boat Race (\u201cCrossed Oars\u201d). This hub brings together the squad, daily attendance and resting heart rate, crew-by-crew training plans, physiological testing, crew selection, time tests and regatta results so coaches, rowers and the advisory committee can all follow the crew's progress.",
      coaches: 'Head Coach · Assistant Coach',
      historyLink: 'https://en.wikipedia.org/wiki/Royal%E2%80%93Thomian_Regatta',
      demo: true,
    },
    events: EVENTS,
    athletes, metrics, crews, results, races, combos, weeks, calendar, attendance, completion, updates, comments, logs,
    history: HISTORY,
    photos: [],
  };
})();
