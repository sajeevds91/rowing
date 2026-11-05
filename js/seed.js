/* Demo data so every dashboard has something to show on first load.
   Athlete names, times and records are FICTIONAL placeholders — the coach should
   replace them (Data tab → "Start empty" or edit/delete entries). */
const SEED = (() => {
  // deterministic pseudo-random so demo looks the same each load
  let s = 20261105;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const jitter = (n) => (rnd() - 0.5) * 2 * n;

  const EVENTS = [
    { id: 'ev4A', code: '4+ A', name: 'Fours — A Crew', boat: '4+', seats: 4, cox: true, distance: 1000, record: 192.0 },
    { id: 'ev4B', code: '4+ B', name: 'Fours — B Crew', boat: '4+', seats: 4, cox: true, distance: 1000, record: 198.0 },
    { id: 'ev4C', code: '4+ C', name: 'Fours — C Crew', boat: '4+', seats: 4, cox: true, distance: 1000, record: 204.0 },
    { id: 'ev2xA', code: '2x A', name: 'Double Sculls — A', boat: '2x', seats: 2, cox: false, distance: 1000, record: 212.0 },
    { id: 'ev2xB', code: '2x B', name: 'Double Sculls — B', boat: '2x', seats: 2, cox: false, distance: 1000, record: 220.0 },
    { id: 'ev2-A', code: '2- A', name: 'Pairs — A', boat: '2-', seats: 2, cox: false, distance: 1000, record: 225.0 },
    { id: 'ev2-B', code: '2- B', name: 'Pairs — B', boat: '2-', seats: 2, cox: false, distance: 1000, record: 232.0 },
    { id: 'ev1xA', code: '1x A', name: 'Single Sculls — A', boat: '1x', seats: 1, cox: false, distance: 1000, record: 235.0 },
    { id: 'ev1xB', code: '1x B', name: 'Single Sculls — B', boat: '1x', seats: 1, cox: false, distance: 1000, record: 245.0 },
    { id: 'evU16', code: 'U16 4+', name: 'Under 16 Fours', boat: '4+', seats: 4, cox: true, distance: 1000, record: 210.0 },
  ].map((e) => ({ ...e, recordHolder: '', recordYear: '', recordVerified: false }));

  const NAMES = [
    'Ashen Perera', 'Dinuk Fernando', 'Kavindu Silva', 'Ravindu Jayasuriya', 'Sahan de Mel', 'Nethum Wickramasinghe',
    'Thisal Gunawardena', 'Yohan Rodrigo', 'Pasindu Senanayake', 'Isuru Bandara', 'Chamath Dias', 'Lahiru Mendis',
    'Hiran Abeysekera', 'Senuka Ratnayake', 'Dulith Karunaratne', 'Minul Peiris', 'Avishka Hettiarachchi', 'Tharindu Weerasinghe',
    'Kaveesh Jayawardena', 'Oshada Samarasinghe', 'Vihanga de Alwis', 'Rehan Wijesinghe', 'Sanuk Liyanage', 'Janith Cooray',
  ];
  const athletes = NAMES.map((name, i) => {
    const cox = i >= 21; // last three are coxswains
    const u16 = i >= 16 && i < 21;
    return {
      id: 'ath' + (i + 1),
      name,
      grade: u16 ? 'Grade 10' : ['Grade 11', 'Grade 12', 'Grade 13'][i % 3],
      age: u16 ? 15 : 16 + (i % 3),
      role: cox ? 'Cox' : ['Stroke side', 'Bow side', 'Sculler', 'Both sides'][i % 4],
      squad: u16 ? 'U16' : 'Senior',
      height: cox ? 160 + Math.round(rnd() * 6) : 172 + Math.round(rnd() * 16),
      weight: cox ? 52 + Math.round(rnd() * 5) : 64 + Math.round(rnd() * 16),
      photo: '',
      notes: '',
      // hidden demo generation params
      _base2k: cox ? null : (u16 ? 445 : 400) + i * 1.6 + jitter(6),
    };
  });

  const TODAY = U.today();
  const start = U.addDays(TODAY, -84); // 12 weeks of history

  // ---------- Metrics ----------
  const metrics = [];
  athletes.forEach((a, idx) => {
    const rhrBase = 52 + Math.round(rnd() * 10);
    const vo2Base = a.role === 'Cox' ? null : 50 + rnd() * 8 - (a.squad === 'U16' ? 3 : 0);
    for (let w = 0; w <= 12; w++) {
      const d = U.addDays(start, w * 7 + (idx % 3));
      if (d > TODAY) continue;
      const prog = w / 12;
      // resting HR: weekly, gradually falling, with one spike for a couple of athletes
      let rhr = rhrBase - prog * 4 + jitter(1.5);
      if ((idx === 4 || idx === 11) && w === 11) rhr += 8; // shows the fatigue flag
      metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'rhr', value: Math.round(rhr) });
      if (a._base2k && w % 3 === 0) {
        const t = a._base2k - prog * (8 + rnd() * 6) + jitter(1.5);
        metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'erg2k', value: U.round(t, 1) });
      }
      if (a._base2k && w % 4 === 1) {
        const t = a._base2k * 2.62 - prog * 25 + jitter(4);
        metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'erg5k', value: U.round(t, 1) });
      }
      if (vo2Base && w % 4 === 0) {
        metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'vo2', value: U.round(vo2Base + prog * 3 + jitter(0.6), 1) });
      }
      if (w % 4 === 0) {
        metrics.push({ id: U.uid('m'), athleteId: a.id, date: d, type: 'weight', value: U.round(a.weight - prog * 1 + jitter(0.6), 1) });
      }
    }
  });
  athletes.forEach((a) => delete a._base2k);

  // ---------- Crews (current provisional selection) ----------
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

  // ---------- Results: time tests & trial regattas ----------
  const results = [];
  const trialDays = [-77, -63, -49, -35, -21, -10, -3];
  EVENTS.forEach((ev, ei) => {
    const startGap = 0.10 + rnd() * 0.04; // % slower than record at start of season
    const endGap = 0.015 + rnd() * 0.03;
    trialDays.forEach((off, k) => {
      const prog = k / (trialDays.length - 1);
      const gap = startGap + (endGap - startGap) * Math.pow(prog, 0.8);
      const dist = k === 2 ? 500 : k === 4 ? 2000 : ev.distance;
      const t1000 = ev.record * (1 + gap) + jitter(1.2);
      const t = U.projectTime(t1000, 1000, dist);
      results.push({
        id: U.uid('r'), date: U.addDays(TODAY, off + (ei % 2)), eventId: ev.id,
        kind: k === 5 ? 'Trial regatta' : 'Time test',
        distance: dist, time: U.round(t, 1), rate: dist === 500 ? 36 : dist === 2000 ? 30 : 33,
        conditions: ['Calm', 'Light headwind', 'Tailwind', 'Crosswind', 'Calm'][Math.floor(rnd() * 5)],
        lineup: crews[ev.id] ? [...crews[ev.id].seats] : [], notes: '',
      });
    });
  });

  // ---------- Combination tests (seat racing for 4+ A) ----------
  const combos = [];
  const comboSets = [
    [ids[0], ids[1], ids[2], ids[3]], [ids[0], ids[1], ids[4], ids[3]], [ids[0], ids[5], ids[2], ids[3]],
    [ids[4], ids[1], ids[2], ids[3]], [ids[0], ids[1], ids[2], ids[7]],
  ];
  comboSets.forEach((lineup, i) => {
    [-24, -12].forEach((off, j) => {
      combos.push({
        id: U.uid('c'), date: U.addDays(TODAY, off + i % 2), eventId: 'ev4A', lineup, cox: ids[21],
        distance: 500, time: U.round(U.projectTime(192 * (1.05 - j * 0.02) + i * 0.9 + jitter(1), 1000, 500), 1),
        rate: 34, notes: i === 0 ? 'Base crew' : 'Swap seat ' + (((i - 1) % 4) + 1),
      });
    });
  });

  // ---------- Weekly schedule ----------
  const template = [
    ['Mon', '05:30', 'water', 'Water — steady state', '3 × 4 km UT2 @ r20, technical focus on catch timing'],
    ['Mon', '15:30', 'gym', 'Strength circuit', 'Deadlift, bench pull, core'],
    ['Tue', '05:30', 'erg', 'Erg intervals', '4 × 1000 m @ 2k pace + 4 s, 3 min rest'],
    ['Wed', '05:30', 'water', 'Water — technique', 'Pause drills, square-blade rowing'],
    ['Wed', '15:30', 'run', 'Run + mobility', '6 km easy run, 20 min stretching'],
    ['Thu', '05:30', 'water', 'Water — race pace', '6 × 250 m starts + 500 m pieces'],
    ['Fri', '15:30', 'gym', 'Strength', 'Squat, pull-ups, leg press'],
    ['Sat', '06:00', 'test', 'Time test / seat racing', 'Crew time tests over 1000 m'],
    ['Sun', '', 'rest', 'Rest day', 'Recovery, hydrate, sleep'],
  ];
  const weeks = {};
  [-7, 0, 7].forEach((off) => {
    const mon = U.mondayOf(U.addDays(TODAY, off));
    weeks[mon] = {
      focus: off < 0 ? 'Aerobic base + technique' : off === 0 ? 'Race pace introduction' : 'Speed & starts',
      sessions: template.map(([day, time, type, title, details]) => ({ id: U.uid('s'), day, time, type, title, details })),
    };
  });

  // ---------- Calendar ----------
  const calendar = [
    ...trialDays.map((off, k) => ({ id: U.uid('e'), date: U.addDays(TODAY, off), type: k === 5 ? 'trial' : 'timetest', title: k === 5 ? 'Trial regatta' : 'Crew time test', notes: '' })),
    { id: U.uid('e'), date: U.addDays(TODAY, 4), type: 'timetest', title: 'Crew time test — 1000 m', notes: '' },
    { id: U.uid('e'), date: U.addDays(TODAY, 11), type: 'trial', title: 'Inter-school trial regatta', notes: '' },
    { id: U.uid('e'), date: U.addDays(TODAY, 18), type: 'meeting', title: 'Advisory committee review', notes: 'Crew progress presentation' },
    { id: U.uid('e'), date: U.addDays(TODAY, 25), type: 'timetest', title: '2k erg test (all squad)', notes: '' },
    { id: U.uid('e'), date: U.addDays(TODAY, 39), type: 'trial', title: 'Final selection trials', notes: '' },
  ];

  // ---------- Attendance (one mark per athlete per training day) ----------
  const attendance = {};
  for (let d = U.addDays(TODAY, -41); d <= TODAY; d = U.addDays(d, 1)) {
    if (U.parseISO(d).getDay() === 0) continue; // Sundays off
    attendance[d] = {};
    athletes.forEach((a, i) => {
      const r = rnd();
      const reliability = i % 7 === 3 ? 0.78 : 0.93;
      attendance[d][a.id] = r < reliability ? 'P' : r < reliability + 0.03 ? 'L' : r < reliability + 0.05 ? 'E' : 'A';
    });
  }

  const updates = [
    { id: U.uid('u'), date: TODAY, author: 'Head Coach', tag: 'Session', text: 'Good water session this morning — 4+ A held rate 34 through the full 500 m pieces. Focus tomorrow: finishing strokes together.' },
    { id: U.uid('u'), date: U.addDays(TODAY, -1), author: 'Head Coach', tag: 'Notice', text: 'Saturday time test moved to 6:00 am start. Bring water bottles and HR straps.' },
    { id: U.uid('u'), date: U.addDays(TODAY, -3), author: 'Assistant Coach', tag: 'Result', text: 'Time test results are in — every crew improved on the previous test. See the Results tab.' },
    { id: U.uid('u'), date: U.addDays(TODAY, -6), author: 'Head Coach', tag: 'Health', text: 'Reminder to log resting heart rate first thing each morning before getting out of bed.' },
  ];

  return {
    version: 1,
    settings: {
      teamName: "S. Thomas' College Rowing",
      regattaName: 'Royal Thomian Regatta',
      regattaDate: '2027-03-06',
      venue: 'Set venue in Data → Settings',
      coachPin: '1234',
      about: "The S. Thomas' College rowing crew trains year-round toward the Royal Thomian Regatta. This hub brings together the squad, training plans, attendance, physiological testing, crew selection and boat-by-boat time tests so coaches, rowers and the advisory committee can all see how the crew is progressing.",
      coaches: 'Head Coach · Assistant Coach',
      demo: true,
    },
    events: EVENTS,
    athletes, metrics, crews, results, combos, weeks, calendar, attendance, updates,
    photos: [],
  };
})();
