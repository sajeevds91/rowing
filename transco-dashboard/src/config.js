'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const DATA_DIR = path.resolve(ROOT, env.DATA_DIR || 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Keep sessions valid across restarts even if SESSION_SECRET is not set.
function sessionSecret() {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const file = path.join(DATA_DIR, '.session-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}

const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

module.exports = {
  ROOT,
  DATA_DIR,
  port: int(env.PORT, 3000),
  appUrl: (env.APP_URL || `http://localhost:${int(env.PORT, 3000)}`).replace(/\/$/, ''),
  production: env.NODE_ENV === 'production',
  sessionSecret: sessionSecret(),
  signupCode: env.SIGNUP_CODE || '',
  companyName: env.COMPANY_NAME || 'Transco Consolidation',
  supportEmail: env.SUPPORT_EMAIL || '',

  tracking: {
    provider: (env.TRACKING_PROVIDER || 'demo').toLowerCase(), // demo | http
    apiUrl: env.TRACKING_API_URL || '',
    apiKey: env.TRACKING_API_KEY || '',
    apiKeyHeader: env.TRACKING_API_KEY_HEADER || 'Authorization',
    cacheMinutes: int(env.TRACKING_CACHE_MINUTES, 15),
    // Optional: Transco's own public track & trace page, e.g. https://track.example.com/?ref={reference}
    transcoUrl: env.TRANSCO_TRACKING_URL || '',
  },

  marineTraffic: {
    apiKey: env.MARINETRAFFIC_API_KEY || '',
    baseUrl: (env.MARINETRAFFIC_BASE_URL || 'https://services.marinetraffic.com/api').replace(/\/$/, ''),
    timespanMinutes: int(env.MARINETRAFFIC_TIMESPAN, 60),
    cacheMinutes: int(env.MARINETRAFFIC_CACHE_MINUTES, 10),
  },

  mail: {
    host: env.SMTP_HOST || '',
    port: int(env.SMTP_PORT, 587),
    secure: bool(env.SMTP_SECURE, false),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || `"${env.COMPANY_NAME || 'Transco Consolidation'}" <no-reply@localhost>`,
  },

  scheduler: {
    enabled: bool(env.SCHEDULER_ENABLED, true),
    intervalMinutes: Math.max(1, int(env.SCHEDULER_INTERVAL_MINUTES, 30)),
  },
};
