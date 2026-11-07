'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('./src/config');
const SqliteStore = require('./src/session-store');
const { api, pages } = require('./src/routes');
const notifier = require('./src/notifier');
const tracking = require('./src/tracking');
const mailer = require('./src/mailer');

const app = express();
app.disable('x-powered-by');
if (config.production) app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  });
  next();
});

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(session({
  name: 'transco.sid',
  store: new SqliteStore(),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: 14 * 24 * 3600 * 1000 },
}));

app.use('/api', api);
app.use(pages);
app.use('/vendor/leaflet', express.static(path.join(path.dirname(require.resolve('leaflet/package.json')), 'dist'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Errors (Express 5 forwards rejected promises here).
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  if (res.headersSent) return next(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
});

if (require.main === module) {
  app.listen(config.port, config.host, () => {
    console.log(`${config.companyName} dashboard running at ${config.appUrl}`);
    console.log(`  track & trace: ${tracking.providerName}${tracking.providerName === 'demo' ? ' (demo data)' : ''}`);
    console.log(`  MarineTraffic: ${tracking.marineTrafficEnabled ? 'live API' : 'not configured (positions come from track & trace / demo)'}`);
    console.log(`  email: ${mailer.smtpConfigured ? 'SMTP' : 'SMTP not configured, emails saved to data/outbox/'}`);
    notifier.start();
  });
}

module.exports = app;
