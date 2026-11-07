'use strict';
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('./config');
const db = require('./db');
const carriers = require('./carriers');
const tracking = require('./tracking');
const notifier = require('./notifier');
const mailer = require('./mailer');
const { esc } = require('./emails');

const api = express.Router();
const FREQUENCIES = ['change', 'daily', 'weekly'];
const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------- helpers ----------
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, company: u.company });

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please sign in' });
  const user = db.get('SELECT * FROM users WHERE id = ?', req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Please sign in' });
  }
  req.user = user;
  next();
}

function ownShipment(req) {
  const row = db.get('SELECT * FROM shipments WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
  if (!row) throw new HttpError(404, 'Shipment not found');
  return row;
}

function shipmentJson(row, snap) {
  return {
    id: row.id,
    reference: row.reference,
    refType: row.ref_type,
    carrier: row.carrier,
    label: row.label,
    vesselImo: row.vessel_imo,
    vesselMmsi: row.vessel_mmsi,
    createdAt: row.created_at,
    notify: {
      enabled: Boolean(row.notify_enabled),
      frequency: row.notify_frequency,
      onChange: Boolean(row.notify_on_change),
      email: row.notify_email,
      lastSentAt: row.last_notified_at,
    },
    tracking: snap,
  };
}

function cleanVesselId(v, len) {
  const s = String(v ?? '').replace(/\D/g, '');
  if (!s) return null;
  if (s.length !== len) throw new HttpError(400, len === 7 ? 'IMO numbers have 7 digits' : 'MMSI numbers have 9 digits');
  return s;
}

function readNotify(body, current = {}) {
  const n = body.notify || {};
  const out = {
    enabled: n.enabled !== undefined ? Boolean(n.enabled) : current.enabled ?? true,
    frequency: n.frequency !== undefined ? n.frequency : current.frequency ?? 'daily',
    onChange: n.onChange !== undefined ? Boolean(n.onChange) : current.onChange ?? true,
    email: n.email !== undefined ? String(n.email || '').trim() || null : current.email ?? null,
  };
  if (!FREQUENCIES.includes(out.frequency)) throw new HttpError(400, 'Choose how often to receive emails');
  if (out.email && !EMAIL_RE.test(out.email)) throw new HttpError(400, 'Enter a valid email address for updates');
  if (out.frequency === 'change') out.onChange = true;
  return out;
}

// Basic brute-force protection for sign-in.
const attempts = new Map();
function throttle(key) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < 15 * 60e3);
  if (a.length >= 10) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.');
  a.push(now);
  attempts.set(key, a);
}

// Mutating API calls must come from our own front end (CSRF protection on top of SameSite cookies).
api.use((req, res, next) => {
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'transco-dashboard') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ---------- public ----------
api.get('/config', (req, res) => {
  res.json({
    companyName: config.companyName,
    signupRequiresCode: Boolean(config.signupCode),
    trackingProvider: tracking.providerName,
    marineTrafficLive: tracking.marineTrafficEnabled,
    emailDelivery: mailer.smtpConfigured ? 'smtp' : 'outbox',
    carriers: carriers.CARRIERS,
    supportEmail: config.supportEmail,
  });
});

api.post('/auth/register', async (req, res) => {
  const { name, company, email, password, signupCode } = req.body || {};
  throttle(`reg:${req.ip}`);
  if (config.signupCode && signupCode !== config.signupCode) throw new HttpError(403, 'The customer access code is not correct. Please contact Transco for your code.');
  if (!name || String(name).trim().length < 2) throw new HttpError(400, 'Please enter your name');
  if (!email || !EMAIL_RE.test(String(email).trim())) throw new HttpError(400, 'Please enter a valid email address');
  if (!password || String(password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const em = String(email).trim().toLowerCase();
  if (db.get('SELECT id FROM users WHERE email = ?', em)) throw new HttpError(409, 'An account with this email already exists. Please sign in.');
  const hash = await bcrypt.hash(String(password), 12);
  const r = db.run('INSERT INTO users (email, name, company, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    em, String(name).trim().slice(0, 100), String(company || '').trim().slice(0, 120) || null, hash, new Date().toISOString());
  await new Promise((ok, fail) => req.session.regenerate((e) => (e ? fail(e) : ok())));
  req.session.userId = Number(r.lastInsertRowid);
  res.status(201).json({ user: publicUser(db.get('SELECT * FROM users WHERE id = ?', req.session.userId)) });
});

api.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  throttle(`login:${req.ip}:${em}`);
  const user = em ? db.get('SELECT * FROM users WHERE email = ?', em) : null;
  const ok = user && (await bcrypt.compare(String(password || ''), user.password_hash));
  if (!ok) throw new HttpError(401, 'Email or password is incorrect');
  attempts.delete(`login:${req.ip}:${em}`);
  await new Promise((ok2, fail) => req.session.regenerate((e) => (e ? fail(e) : ok2())));
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

api.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('transco.sid');
    res.json({ ok: true });
  });
});

// ---------- signed in ----------
api.use(requireAuth);

api.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

api.patch('/me', async (req, res) => {
  const { name, company, currentPassword, newPassword } = req.body || {};
  if (name !== undefined) {
    if (String(name).trim().length < 2) throw new HttpError(400, 'Please enter your name');
    db.run('UPDATE users SET name = ? WHERE id = ?', String(name).trim().slice(0, 100), req.user.id);
  }
  if (company !== undefined) db.run('UPDATE users SET company = ? WHERE id = ?', String(company).trim().slice(0, 120) || null, req.user.id);
  if (newPassword) {
    if (!(await bcrypt.compare(String(currentPassword || ''), req.user.password_hash))) throw new HttpError(400, 'Current password is incorrect');
    if (String(newPassword).length < 8) throw new HttpError(400, 'New password must be at least 8 characters');
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', await bcrypt.hash(String(newPassword), 12), req.user.id);
  }
  res.json({ user: publicUser(db.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
});

api.get('/shipments', async (req, res) => {
  const rows = db.all('SELECT * FROM shipments WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
  const out = await Promise.all(rows.map(async (r) => shipmentJson(r, await tracking.getTracking(r))));
  res.json({ shipments: out });
});

api.post('/shipments', async (req, res) => {
  const body = req.body || {};
  const reference = carriers.normalizeReference(body.reference);
  if (reference.length < 4) throw new HttpError(400, 'Enter a container, booking or bill of lading number');
  const refType = carriers.detectRefType(reference);
  if (refType === 'container' && !carriers.containerCheckDigitValid(reference)) {
    throw new HttpError(400, `${reference} does not look like a valid container number (the check digit does not match). Please check it.`);
  }
  let carrier = body.carrier || carriers.detectCarrier(reference);
  if (carrier && !carriers.isKnownCarrier(carrier) && carrier !== 'OTHER') throw new HttpError(400, 'Unknown shipping line');
  if (!carrier) carrier = 'OTHER';
  const notify = readNotify(body);
  const imo = cleanVesselId(body.vesselImo, 7);
  const mmsi = cleanVesselId(body.vesselMmsi, 9);
  if (db.get('SELECT id FROM shipments WHERE user_id = ? AND reference = ?', req.user.id, reference)) {
    throw new HttpError(409, `${reference} is already on your dashboard`);
  }
  const r = db.run(
    `INSERT INTO shipments (user_id, reference, ref_type, carrier, label, vessel_imo, vessel_mmsi,
      notify_enabled, notify_frequency, notify_on_change, notify_email, unsubscribe_token, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user.id, reference, refType, carrier, String(body.label || '').trim().slice(0, 80) || null, imo, mmsi,
    notify.enabled ? 1 : 0, notify.frequency, notify.onChange ? 1 : 0, notify.email,
    crypto.randomBytes(24).toString('hex'), new Date().toISOString()
  );
  const row = db.get('SELECT * FROM shipments WHERE id = ?', Number(r.lastInsertRowid));
  const snap = await tracking.getTracking(row);
  if (notify.enabled) notifier.sendNow(row.id, 'subscribed').catch((e) => console.error(e));
  res.status(201).json({ shipment: shipmentJson(row, snap) });
});

api.get('/shipments/:id', async (req, res) => {
  const row = ownShipment(req);
  res.json({ shipment: shipmentJson(row, await tracking.getTracking(row)) });
});

api.patch('/shipments/:id', async (req, res) => {
  const row = ownShipment(req);
  const body = req.body || {};
  const notify = readNotify(body, {
    enabled: Boolean(row.notify_enabled), frequency: row.notify_frequency, onChange: Boolean(row.notify_on_change), email: row.notify_email,
  });
  const label = body.label !== undefined ? String(body.label || '').trim().slice(0, 80) || null : row.label;
  const carrier = body.carrier !== undefined ? body.carrier : row.carrier;
  if (carrier && carrier !== 'OTHER' && !carriers.isKnownCarrier(carrier)) throw new HttpError(400, 'Unknown shipping line');
  const imo = body.vesselImo !== undefined ? cleanVesselId(body.vesselImo, 7) : row.vessel_imo;
  const mmsi = body.vesselMmsi !== undefined ? cleanVesselId(body.vesselMmsi, 9) : row.vessel_mmsi;
  db.run(
    `UPDATE shipments SET label = ?, carrier = ?, vessel_imo = ?, vessel_mmsi = ?, notify_enabled = ?, notify_frequency = ?, notify_on_change = ?, notify_email = ? WHERE id = ?`,
    label, carrier, imo, mmsi, notify.enabled ? 1 : 0, notify.frequency, notify.onChange ? 1 : 0, notify.email, row.id
  );
  const updated = db.get('SELECT * FROM shipments WHERE id = ?', row.id);
  if (notify.enabled && !row.notify_enabled) notifier.sendNow(row.id, 'subscribed').catch((e) => console.error(e));
  tracking.invalidate(updated);
  res.json({ shipment: shipmentJson(updated, await tracking.getTracking(updated)) });
});

api.delete('/shipments/:id', (req, res) => {
  const row = ownShipment(req);
  db.run('DELETE FROM shipments WHERE id = ?', row.id);
  res.json({ ok: true });
});

api.post('/shipments/:id/refresh', async (req, res) => {
  const row = ownShipment(req);
  res.json({ shipment: shipmentJson(row, await tracking.getTracking(row, { force: true })) });
});

api.post('/shipments/:id/test-email', async (req, res) => {
  const row = ownShipment(req);
  throttle(`test-email:${req.user.id}`);
  const result = await notifier.sendNow(row.id, 'test');
  if (!result.ok) throw new HttpError(502, `Email could not be sent: ${result.error}`);
  res.json({ ok: true, to: result.to, delivered: result.delivered });
});

api.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- unsubscribe link (no sign-in needed) ----------
const pages = express.Router();
function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
  <style>body{font-family:system-ui,Segoe UI,Helvetica,Arial,sans-serif;background:#f1f5f9;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
  .card{background:#fff;border-radius:12px;padding:28px;max-width:440px;box-shadow:0 4px 24px rgba(15,23,42,.08)}button,a.btn{background:#0f4c81;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-size:15px;cursor:pointer;text-decoration:none;display:inline-block}</style></head>
  <body><div class="card">${body}</div></body></html>`;
}
pages.get('/unsubscribe/:token', (req, res) => {
  const row = db.get('SELECT * FROM shipments WHERE unsubscribe_token = ?', req.params.token);
  if (!row) return res.status(404).send(page('Link expired', '<h2>Link not valid</h2><p>This shipment may have been removed from the dashboard.</p>'));
  // Use a confirmation form so link scanners in mail systems do not unsubscribe people by accident.
  res.send(page('Stop shipment emails', `<h2>Stop emails?</h2><p>Stop email updates for <b>${esc(row.label || row.reference)}</b> (${esc(row.reference)})?</p>
    <form method="post"><button type="submit">Stop emails for this shipment</button></form>`));
});
pages.post('/unsubscribe/:token', (req, res) => {
  const row = db.get('SELECT * FROM shipments WHERE unsubscribe_token = ?', req.params.token);
  if (!row) return res.status(404).send(page('Link expired', '<h2>Link not valid</h2>'));
  db.run('UPDATE shipments SET notify_enabled = 0 WHERE id = ?', row.id);
  res.send(page('Emails stopped', `<h2>Done</h2><p>You will no longer receive emails for <b>${esc(row.label || row.reference)}</b>. You can turn them back on at any time from your dashboard.</p>
    <p><a class="btn" href="${config.appUrl}">Open dashboard</a></p>`));
});

module.exports = { api, pages, HttpError };
