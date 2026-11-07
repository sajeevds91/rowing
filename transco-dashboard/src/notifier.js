'use strict';
const config = require('./config');
const db = require('./db');
const tracking = require('./tracking');
const mailer = require('./mailer');
const { updateEmail } = require('./emails');

const PERIOD_MS = { daily: 24 * 3600e3, weekly: 7 * 24 * 3600e3 };

function recipient(row) {
  return row.notify_email || row.user_email;
}

/** Send one email immediately for a shipment (used for "subscribed" confirmations and test sends). */
async function sendNow(shipmentId, reason) {
  const row = db.get('SELECT s.*, u.email AS user_email, u.name AS user_name FROM shipments s JOIN users u ON u.id = s.user_id WHERE s.id = ?', shipmentId);
  if (!row) return { ok: false, error: 'Shipment not found' };
  const snap = await tracking.getTracking(row);
  const email = updateEmail({ name: row.user_name }, [{ shipment: row, snap, reason }]);
  const result = await mailer.send({ to: recipient(row), ...email, userId: row.user_id, kind: reason });
  if (result.ok) {
    db.run('UPDATE shipments SET notified_state = ?, last_notified_at = ? WHERE id = ?', JSON.stringify(tracking.fingerprint(snap)), new Date().toISOString(), row.id);
  }
  return { ...result, to: recipient(row) };
}

/**
 * One scheduler pass: refresh tracking for every followed shipment, then send
 * change alerts and due daily/weekly summaries, grouped into one email per recipient.
 */
async function runCycle({ now = Date.now(), force = false } = {}) {
  const rows = db.all('SELECT s.*, u.email AS user_email, u.name AS user_name FROM shipments s JOIN users u ON u.id = s.user_id WHERE s.notify_enabled = 1');
  const slack = (config.scheduler.intervalMinutes * 60e3) / 2;
  const groups = new Map();
  let checked = 0;

  for (const row of rows) {
    const snap = await tracking.getTracking(row, { force: true });
    checked++;
    if (snap.status === 'UNKNOWN') continue;
    const fp = tracking.fingerprint(snap);
    const prev = row.notified_state ? JSON.parse(row.notified_state) : null;
    const changed = prev && (prev.status !== fp.status || prev.eta !== fp.eta || prev.lastEvent !== fp.lastEvent);
    const period = PERIOD_MS[row.notify_frequency];
    const last = row.last_notified_at ? new Date(row.last_notified_at).getTime() : 0;
    const digestDue = period && (force || now - last >= period - slack);

    // Once the customer has been told a shipment is delivered, stop its regular summaries.
    if (prev?.status === 'DELIVERED' && fp.status === 'DELIVERED') continue;

    let reason = null;
    if (changed && row.notify_on_change) reason = 'change';
    else if (digestDue) reason = 'scheduled';

    if (!prev && !reason) {
      db.run('UPDATE shipments SET notified_state = ? WHERE id = ?', JSON.stringify(fp), row.id);
      continue;
    }
    if (!reason) continue;

    const to = recipient(row);
    if (!groups.has(to)) groups.set(to, { to, user: { name: row.user_name }, userId: row.user_id, items: [] });
    groups.get(to).items.push({ shipment: row, snap, reason, fp });
  }

  let sent = 0;
  for (const g of groups.values()) {
    // Most important first: changes, then by ETA.
    g.items.sort((a, b) => (a.reason === 'change' ? -1 : 0) - (b.reason === 'change' ? -1 : 0) || new Date(a.snap.eta) - new Date(b.snap.eta));
    const email = updateEmail(g.user, g.items);
    const result = await mailer.send({ to: g.to, ...email, userId: g.userId, kind: 'update' });
    if (!result.ok) continue;
    sent++;
    const stamp = new Date(now).toISOString();
    for (const it of g.items) {
      db.run('UPDATE shipments SET notified_state = ?, last_notified_at = ? WHERE id = ?', JSON.stringify(it.fp), stamp, it.shipment.id);
    }
  }
  return { checked, emails: sent };
}

let timer = null;
let running = false;
function start() {
  if (!config.scheduler.enabled || timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runCycle();
      if (r.emails) console.log(`[scheduler] checked ${r.checked} shipments, sent ${r.emails} emails`);
    } catch (err) {
      console.error('[scheduler]', err);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 10e3).unref();
  timer = setInterval(tick, config.scheduler.intervalMinutes * 60e3);
  timer.unref();
  console.log(`[scheduler] checking followed shipments every ${config.scheduler.intervalMinutes} min`);
}

module.exports = { runCycle, sendNow, start };
