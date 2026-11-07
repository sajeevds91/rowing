'use strict';
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('./config');
const db = require('./db');

const OUTBOX = path.join(config.DATA_DIR, 'outbox');
const smtp = Boolean(config.mail.host);

const transport = smtp
  ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    })
  : null;

/**
 * Sends an email via SMTP. Without SMTP settings, the email is written to data/outbox/
 * as an .html file so it can be previewed during setup.
 */
async function send({ to, subject, html, text, userId = null, kind = 'update' }) {
  const sentAt = new Date().toISOString();
  try {
    if (transport) {
      await transport.sendMail({ from: config.mail.from, to, subject, html, text });
    } else {
      fs.mkdirSync(OUTBOX, { recursive: true });
      const file = path.join(OUTBOX, `${sentAt.replace(/[:.]/g, '-')}-${to.replace(/[^a-z0-9@.]/gi, '_')}.html`);
      fs.writeFileSync(file, `<!-- To: ${to}\n     Subject: ${subject} -->\n${html}`);
      console.log(`[mail] SMTP not configured, saved email to ${path.relative(config.ROOT, file)}`);
    }
    db.run('INSERT INTO email_log (user_id, recipient, subject, kind, ok, sent_at) VALUES (?, ?, ?, ?, 1, ?)', userId, to, subject, kind, sentAt);
    return { ok: true, delivered: Boolean(transport) };
  } catch (err) {
    console.error(`[mail] failed to send to ${to}: ${err.message}`);
    db.run('INSERT INTO email_log (user_id, recipient, subject, kind, ok, error, sent_at) VALUES (?, ?, ?, ?, 0, ?, ?)', userId, to, subject, kind, err.message, sentAt);
    return { ok: false, error: err.message };
  }
}

module.exports = { send, smtpConfigured: smtp };
