'use strict';
/** Creates a demo customer with a few shipments: npm run seed */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { containerCheckDigit } = require('../src/carriers');

const EMAIL = process.env.DEMO_EMAIL || 'demo@transco.example';
const PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';
const DAY = 86400000;

const container = (first10) => first10 + containerCheckDigit(first10);

const SHIPMENTS = [
  { ref: container('MSCU482913'), carrier: 'MSCU', label: 'PO 4521 – Knitwear', daysAgo: 6, freq: 'daily' },
  { ref: container('MAEU731004'), carrier: 'MAEU', label: 'PO 4533 – Tea chests', daysAgo: 11, freq: 'change' },
  { ref: container('CMAU562210'), carrier: 'CMDU', label: 'Machinery spares', daysAgo: 3, freq: 'weekly' },
  { ref: container('HLXU900321'), carrier: 'HLCU', label: 'PO 4490 – Rubber gloves', daysAgo: 26, freq: 'daily' },
  { ref: container('ONEU377145'), carrier: 'ONEY', label: 'Fabric rolls (LCL)', daysAgo: 1, freq: 'daily' },
];

(async () => {
  let user = db.get('SELECT * FROM users WHERE email = ?', EMAIL);
  if (!user) {
    db.run('INSERT INTO users (email, name, company, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      EMAIL, 'Nimali Perera', 'Lanka Apparel Exports (Pvt) Ltd', await bcrypt.hash(PASSWORD, 12), new Date().toISOString());
    user = db.get('SELECT * FROM users WHERE email = ?', EMAIL);
  }
  for (const s of SHIPMENTS) {
    if (db.get('SELECT id FROM shipments WHERE user_id = ? AND reference = ?', user.id, s.ref)) continue;
    db.run(
      `INSERT INTO shipments (user_id, reference, ref_type, carrier, label, notify_enabled, notify_frequency, notify_on_change, unsubscribe_token, created_at)
       VALUES (?, ?, 'container', ?, ?, 1, ?, 1, ?, ?)`,
      user.id, s.ref, s.carrier, s.label, s.freq, crypto.randomBytes(24).toString('hex'), new Date(Date.now() - s.daysAgo * DAY).toISOString()
    );
  }
  console.log(`Demo customer ready: ${EMAIL} / ${PASSWORD}`);
})();
