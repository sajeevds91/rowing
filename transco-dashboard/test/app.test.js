'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolated data directory, demo tracking, no SMTP (emails go to the outbox).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'transco-test-'));
process.env.DATA_DIR = tmp;
process.env.SCHEDULER_ENABLED = 'false';
process.env.TRACKING_PROVIDER = 'demo';
for (const k of ['SMTP_HOST', 'MARINETRAFFIC_API_KEY', 'SIGNUP_CODE']) delete process.env[k];

const app = require('../server');
const carriers = require('../src/carriers');
const demo = require('../src/providers/demo-tracking');
const notifier = require('../src/notifier');
const db = require('../src/db');

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

function client() {
  let cookie = '';
  return async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'transco-dashboard', ...(cookie && { Cookie: cookie }), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  };
}

test('container number validation (ISO 6346)', () => {
  assert.ok(carriers.containerCheckDigitValid('CSQU3054383'));
  assert.ok(!carriers.containerCheckDigitValid('CSQU3054384'));
  assert.strictEqual(carriers.detectCarrier('MSCU1234566'), 'MSCU');
  assert.strictEqual(carriers.detectRefType('MAEU12345678'), 'bl');
});

test('demo tracking is deterministic and self-consistent', () => {
  const created = new Date(Date.now() - 5 * 86400000).toISOString();
  const a = demo.track({ reference: 'MSCU1234566', createdAt: created });
  const b = demo.track({ reference: 'MSCU1234566', createdAt: created });
  assert.deepStrictEqual(a.route, b.route);
  assert.strictEqual(a.eta, b.eta);
  assert.ok(new Date(a.eta) > new Date(a.etd));
  assert.ok(a.events.length >= 8);
  assert.ok(a.progress >= 0 && a.progress <= 1);
  assert.ok(Number.isFinite(a.vesselPosition.lat) && Number.isFinite(a.vesselPosition.lon));
  const times = a.events.map((e) => new Date(e.time).getTime());
  assert.deepStrictEqual(times, [...times].sort((x, y) => x - y), 'events are in order');
});

test('auth, shipments, ownership and email flow', async () => {
  const alice = client();
  const bob = client();

  assert.strictEqual((await alice('GET', '/api/shipments')).status, 401);
  assert.strictEqual((await alice('POST', '/api/auth/register', { name: 'A', email: 'a@x.com', password: 'longenough' })).status, 400);
  const reg = await alice('POST', '/api/auth/register', { name: 'Alice', company: 'ACME', email: 'alice@example.com', password: 'longenough' });
  assert.strictEqual(reg.status, 201);
  assert.strictEqual((await alice('POST', '/api/auth/register', { name: 'Alice', email: 'ALICE@example.com', password: 'longenough' })).status, 409);

  // CSRF header required for writes
  const noHeader = await alice('POST', '/api/shipments', { reference: 'MSCU1234566' }, { 'X-Requested-With': '' });
  assert.strictEqual(noHeader.status, 403);

  assert.strictEqual((await alice('POST', '/api/shipments', { reference: 'MSCU1234565' })).status, 400, 'bad check digit rejected');
  const add = await alice('POST', '/api/shipments', { reference: 'mscu 123456-6', label: 'PO 1', notify: { enabled: true, frequency: 'daily' } });
  assert.strictEqual(add.status, 201, JSON.stringify(add.body));
  const s = add.body.shipment;
  assert.strictEqual(s.reference, 'MSCU1234566');
  assert.strictEqual(s.carrier, 'MSCU');
  assert.ok(s.tracking.statusLabel);
  assert.ok(s.tracking.links.carrier.includes('msc.com'));
  assert.strictEqual((await alice('POST', '/api/shipments', { reference: 'MSCU1234566' })).status, 409);

  await bob('POST', '/api/auth/register', { name: 'Bob', email: 'bob@example.com', password: 'longenough' });
  assert.strictEqual((await bob('GET', `/api/shipments/${s.id}`)).status, 404, 'other customers cannot see it');
  assert.strictEqual((await bob('DELETE', `/api/shipments/${s.id}`)).status, 404);
  assert.strictEqual((await bob('GET', '/api/shipments')).body.shipments.length, 0);

  const patch = await alice('PATCH', `/api/shipments/${s.id}`, { vesselImo: '9811000', notify: { frequency: 'weekly', email: 'ops@example.com' } });
  assert.strictEqual(patch.status, 200);
  assert.strictEqual(patch.body.shipment.notify.frequency, 'weekly');
  assert.ok(patch.body.shipment.tracking.links.marineTraffic.includes('imo:9811000'));
  assert.strictEqual((await alice('PATCH', `/api/shipments/${s.id}`, { vesselImo: '123' })).status, 400);

  const testMail = await alice('POST', `/api/shipments/${s.id}/test-email`);
  assert.strictEqual(testMail.status, 200);
  assert.strictEqual(testMail.body.to, 'ops@example.com');
  const outbox = fs.readdirSync(path.join(tmp, 'outbox'));
  assert.ok(outbox.some((f) => f.includes('ops@example.com')));

  // Logout / login
  await alice('POST', '/api/auth/logout');
  assert.strictEqual((await alice('GET', '/api/me')).status, 401);
  assert.strictEqual((await alice('POST', '/api/auth/login', { email: 'alice@example.com', password: 'wrong-pass' })).status, 401);
  assert.strictEqual((await alice('POST', '/api/auth/login', { email: 'Alice@Example.com', password: 'longenough' })).status, 200);

  // Unsubscribe link (GET shows a confirmation, POST unsubscribes)
  const token = db.get('SELECT unsubscribe_token FROM shipments WHERE id = ?', s.id).unsubscribe_token;
  const page = await fetch(`${base}/unsubscribe/${token}`);
  assert.match(await page.text(), /Stop emails/);
  assert.strictEqual(db.get('SELECT notify_enabled FROM shipments WHERE id = ?', s.id).notify_enabled, 1);
  await fetch(`${base}/unsubscribe/${token}`, { method: 'POST' });
  assert.strictEqual(db.get('SELECT notify_enabled FROM shipments WHERE id = ?', s.id).notify_enabled, 0);
});

test('scheduler: summaries when due, alerts on change, grouped per recipient', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { name: 'Carol', email: 'carol@example.com', password: 'longenough' });
  const one = (await c('POST', '/api/shipments', { reference: 'CSQU3054383', notify: { frequency: 'daily' } })).body.shipment;
  const two = (await c('POST', '/api/shipments', { reference: 'MAEU1234567', notify: { frequency: 'daily' } })).body.shipment;
  await new Promise((r) => setTimeout(r, 300)); // let the "subscribed" confirmations finish

  const countFor = (to) => fs.readdirSync(path.join(tmp, 'outbox')).filter((f) => f.includes(to)).length;
  const before = countFor('carol@example.com');

  // Nothing due straight after subscribing
  let r = await notifier.runCycle();
  assert.strictEqual(countFor('carol@example.com'), before);

  // A day later both daily summaries are due and go out as ONE email
  r = await notifier.runCycle({ now: Date.now() + 25 * 3600e3 });
  assert.strictEqual(countFor('carol@example.com'), before + 1);

  // A status change triggers an alert even though the summary is not due
  db.run('UPDATE shipments SET notified_state = ? WHERE id = ?', JSON.stringify({ status: 'BOOKED', eta: null, lastEvent: null }), one.id);
  db.run('UPDATE shipments SET last_notified_at = ? WHERE id IN (?, ?)', new Date(Date.now() + 25 * 3600e3).toISOString(), one.id, two.id);
  r = await notifier.runCycle({ now: Date.now() + 26 * 3600e3 });
  assert.strictEqual(countFor('carol@example.com'), before + 2);
  assert.ok(r.checked >= 2);
});
