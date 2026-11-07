'use strict';
const session = require('express-session');
const db = require('./db');

/** Minimal express-session store backed by the app's SQLite database. */
class SqliteStore extends session.Store {
  constructor() {
    super();
    const prune = () => db.run('DELETE FROM sessions WHERE expires < ?', Date.now());
    prune();
    setInterval(prune, 60 * 60 * 1000).unref();
  }
  expiry(sess) {
    const e = sess?.cookie?.expires;
    return e ? new Date(e).getTime() : Date.now() + 24 * 3600 * 1000;
  }
  get(sid, cb) {
    try {
      const row = db.get('SELECT sess, expires FROM sessions WHERE sid = ?', sid);
      if (!row || row.expires < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.sess));
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb = () => {}) {
    try {
      db.run(
        'INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires',
        sid, JSON.stringify(sess), this.expiry(sess)
      );
      cb(null);
    } catch (e) { cb(e); }
  }
  touch(sid, sess, cb = () => {}) {
    try { db.run('UPDATE sessions SET expires = ? WHERE sid = ?', this.expiry(sess), sid); cb(null); } catch (e) { cb(e); }
  }
  destroy(sid, cb = () => {}) {
    try { db.run('DELETE FROM sessions WHERE sid = ?', sid); cb(null); } catch (e) { cb(e); }
  }
}

module.exports = SqliteStore;
