/* Cloud mode: Firebase Authentication (logins) + Firestore (shared data).
   The app keeps working on one in-memory data object; this module fills it from Firestore
   in real time and writes back only the documents that changed after each edit. */
const Cloud = (() => {
  const cfg = window.FIREBASE_CONFIG;
  const enabled = !!(cfg && cfg.apiKey);
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  const USER_DOMAIN = 'stcrowing.team'; // usernames become username@stcrowing.team
  let fs = null, auth = null;
  let profile = null, user = null;
  let unsub = [];
  const remote = {};   // collection -> {docId: data} as last seen on the server
  const synced = {};   // collection -> {docId: json string}
  let users = [];
  let onChange = () => {};

  // which collections each role may write (the server rules enforce the same)
  const WRITES = {
    coach: null, // everything
    entry: ['attendance', 'completion', 'metrics'],
    athlete: ['metrics', 'logs'],
    advisory: [],
  };
  const toEmail = (u) => (u.includes('@') ? u.trim() : `${u.trim().toLowerCase().replace(/\s+/g, '.')}@${USER_DOMAIN}`);
  const plain = (o) => JSON.parse(JSON.stringify(o));
  // key-order-independent JSON so local and server copies compare equal
  const canon = (v) => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
    : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
    : JSON.stringify(v === undefined ? null : v));

  // ----- db object <-> documents -----
  function docsOf(db, key) {
    if (key === 'config') {
      const { coachPin, entryPin, demo, ...settings } = db.settings;
      return { main: plain({ settings, events: db.events, crews: db.crews }) };
    }
    if (Store.ARRAYS.includes(key)) return Object.fromEntries(db[key].map((x) => [x.id, plain(x)]));
    return Object.fromEntries(Object.entries(db[key]).map(([k, v]) => [k, plain(v)]));
  }
  function applyRemote(db, key) {
    const docs = remote[key] || {};
    if (key === 'config') {
      const m = docs.main;
      if (m) { db.settings = { ...db.settings, ...m.settings }; db.events = m.events || db.events; db.crews = m.crews || {}; }
    } else if (Store.ARRAYS.includes(key)) db[key] = Object.values(docs).map(plain);
    else db[key] = Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, plain(v)]));
  }
  const KEYS = () => ['config', ...Store.ARRAYS, ...Store.MAPS];
  const colName = (key) => (key === 'config' ? 'team' : key);

  function subscribe() {
    unsub.forEach((u) => u()); unsub = [];
    let pending = KEYS().length;
    KEYS().forEach((key) => {
      const ref = key === 'config' ? fs.collection('team').doc('main') : fs.collection(colName(key));
      unsub.push(ref.onSnapshot((snap) => {
        remote[key] = {}; synced[key] = {};
        const docs = key === 'config' ? (snap.exists ? [snap] : []) : snap.docs;
        docs.forEach((d) => { remote[key][d.id] = d.data(); synced[key][d.id] = canon(d.data()); });
        applyRemote(Store.db, key);
        if (pending > 0) pending--;
        if (pending === 0) onChange('data');
      }, (err) => { console.error(key, err); U.toast('Cannot read ' + key + ': ' + err.message); }));
    });
    if (profile.role === 'coach') {
      unsub.push(fs.collection('users').onSnapshot((snap) => { users = snap.docs.map((d) => ({ uid: d.id, ...d.data() })); onChange('users'); }));
    }
  }

  // write every changed document the current role is allowed to write
  let pushing = Promise.resolve();
  function push(db) {
    if (!profile) return;
    const allowed = WRITES[profile.role];
    const ops = [];
    KEYS().forEach((key) => {
      if (allowed && !allowed.includes(key)) return;
      const now = docsOf(db, key); const was = synced[key] || {};
      for (const [id, data] of Object.entries(now)) { const j = canon(data); if (was[id] !== j) ops.push({ key, id, data, j }); }
      for (const id of Object.keys(was)) if (!(id in now)) ops.push({ key, id, del: true });
    });
    if (!ops.length) return;
    // optimistic: mark as synced now so repeated saves don't duplicate writes
    ops.forEach((o) => { synced[o.key] ||= {}; if (o.del) delete synced[o.key][o.id]; else synced[o.key][o.id] = o.j; });
    pushing = pushing.then(async () => {
      for (let i = 0; i < ops.length; i += 400) {
        const batch = fs.batch();
        ops.slice(i, i + 400).forEach((o) => {
          const ref = fs.collection(colName(o.key)).doc(o.id);
          if (o.del) batch.delete(ref); else batch.set(ref, o.data);
        });
        await batch.commit();
      }
    }).catch((err) => {
      console.error(err);
      U.toast('Not saved: ' + (err.code === 'permission-denied' ? 'your login is not allowed to change that.' : err.message));
      // roll back to the server's version
      ops.forEach((o) => { synced[o.key] = Object.fromEntries(Object.entries(remote[o.key] || {}).map(([k, v]) => [k, canon(v)])); applyRemote(Store.db, o.key); });
      onChange('data');
    });
  }

  // ----- auth -----
  async function init(cb) {
    onChange = cb;
    for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadScript(SDK + f);
    firebase.initializeApp(cfg);
    auth = firebase.auth(); fs = firebase.firestore();
    auth.onAuthStateChanged(async (u) => {
      user = u; profile = null; unsub.forEach((x) => x()); unsub = [];
      if (!u) { onChange('signedOut'); return; }
      try {
        const snap = await fs.collection('users').doc(u.uid).get();
        profile = snap.exists ? snap.data() : null;
      } catch (e) { console.error(e); profile = null; }
      if (!profile || !profile.role) { onChange('noProfile'); return; }
      subscribe();
      onChange('signedIn');
    });
  }
  const signIn = (u, p) => auth.signInWithEmailAndPassword(toEmail(u), p);
  const signOut = () => auth.signOut();
  const signUp = (u, p) => auth.createUserWithEmailAndPassword(toEmail(u), p);
  const changePassword = (p) => user.updatePassword(p);
  // first-time setup: the very first account can make itself the coach
  async function claimCoach(nameStr) {
    const batch = fs.batch();
    batch.set(fs.collection('team').doc('owner'), { uid: user.uid });
    batch.set(fs.collection('users').doc(user.uid), { role: 'coach', name: nameStr || 'Head Coach', login: user.email, athleteId: '' });
    await batch.commit();
    window.location.reload();
  }
  // coach creates logins for others (uses a second app instance so the coach stays signed in)
  async function createAccount({ login, password, role, athleteId, name }) {
    const sec = firebase.apps.find((a) => a.name === 'secondary') || firebase.initializeApp(cfg, 'secondary');
    const cred = await sec.auth().createUserWithEmailAndPassword(toEmail(login), password);
    await sec.auth().signOut();
    await fs.collection('users').doc(cred.user.uid).set({ role, athleteId: athleteId || '', name: name || login, login: toEmail(login) });
  }
  const updateUser = (uid, data) => fs.collection('users').doc(uid).update(data);
  const removeUser = (uid) => fs.collection('users').doc(uid).delete();
  const resetPassword = (email) => auth.sendPasswordResetEmail(email);

  return {
    enabled, USER_DOMAIN, init, push, signIn, signOut, signUp, changePassword, claimCoach, createAccount, updateUser, removeUser, resetPassword, toEmail,
    get profile() { return profile; }, get user() { return user; }, get users() { return users; },
  };
})();
