'use strict';
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { DATA_DIR } = require('./config');

const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, 'transco.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  company       TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference         TEXT NOT NULL,
  ref_type          TEXT NOT NULL DEFAULT 'container',
  carrier           TEXT,
  label             TEXT,
  vessel_imo        TEXT,
  vessel_mmsi       TEXT,
  notify_enabled    INTEGER NOT NULL DEFAULT 1,
  notify_frequency  TEXT NOT NULL DEFAULT 'daily',
  notify_on_change  INTEGER NOT NULL DEFAULT 1,
  notify_email      TEXT,
  notified_state    TEXT,
  last_notified_at  TEXT,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  created_at        TEXT NOT NULL,
  UNIQUE (user_id, reference)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT PRIMARY KEY,
  sess    TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS email_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipient  TEXT NOT NULL,
  subject    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  ok         INTEGER NOT NULL,
  error      TEXT,
  sent_at    TEXT NOT NULL
);
`);

const q = (sql) => db.prepare(sql);

module.exports = {
  db,
  get: (sql, ...p) => q(sql).get(...p),
  all: (sql, ...p) => q(sql).all(...p),
  run: (sql, ...p) => q(sql).run(...p),
};
