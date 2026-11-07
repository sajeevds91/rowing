# Transco Consolidation – Customer Shipment Dashboard

A customer portal where Transco Consolidation customers sign in, add their shipments and see where they are at any time:

- **Sign in / create account**: each customer only sees their own shipments. An optional access code (`SIGNUP_CODE`) limits sign-up to real customers.
- **Dashboard**: every shipment with status, route, ETA and journey progress, plus a map showing the vessels carrying the cargo. Filter and search by reference, vessel or port.
- **Track & trace**: the full milestone history (booked → gate in → loaded → departed → transshipment → arrived → delivered), with links to Transco's own track & trace page and to the shipping line's tracking page.
- **MarineTraffic**: the vessel's live AIS position, speed, course and status, and a link to the ship on MarineTraffic. Customers can pin an exact vessel by IMO or MMSI.
- **Email updates**: per shipment, customers choose *only when something changes*, a *daily summary* or a *weekly summary*, optionally with instant alerts when status or ETA changes, and can send updates to another address (e.g. a shared logistics inbox). Shipments going to the same address are combined into one email. Every email has a one-click "stop emails" link. Summaries stop by themselves once a shipment is delivered.

Container numbers are checked with the ISO 6346 check digit, and the shipping line is detected from the container prefix.

## Run it

Needs Node.js 22.13 or newer (it uses the built-in SQLite, so there is no database to install).

```bash
cd transco-dashboard
npm install
npm run seed      # optional: demo customer demo@transco.example / demo1234 with 5 shipments
npm start         # http://localhost:3000
npm test
```

With no configuration the portal uses **demo tracking data**: realistic journeys through Colombo that move forward in real time. Emails are saved as HTML files in `data/outbox/` so you can preview them. Copy `.env.example` to `.env` to connect the real services.

## Connecting the real services

### Email (SMTP)
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM`. Any SMTP service works (Microsoft 365, Google Workspace, Amazon SES, SendGrid, Mailgun…). Set `APP_URL` to the portal's public address so links in emails work.

The scheduler inside the server checks followed shipments every `SCHEDULER_INTERVAL_MINUTES`. If you would rather run it from an external scheduler, set `SCHEDULER_ENABLED=false` and run `npm run notify:once` on a timer.

### MarineTraffic
Set `MARINETRAFFIC_API_KEY` to a key for MarineTraffic's **Single Vessel Positions (PS07)** API. Positions are looked up by the vessel's IMO or MMSI number (from track & trace, or entered by the customer) and cached for `MARINETRAFFIC_CACHE_MINUTES` to save API credits. Check the field names against your MarineTraffic plan documentation; the parser is in `src/providers/marinetraffic.js`. Without a key, positions are estimated from the voyage schedule and the "View on MarineTraffic" link still works.

### Track & trace
Set `TRACKING_PROVIDER=http` and `TRACKING_API_URL` to your track & trace feed. That can be Transco's own system or a container-tracking aggregator. `{reference}`, `{carrier}` and `{type}` in the URL are filled in. The key in `TRACKING_API_KEY` is sent in `TRACKING_API_KEY_HEADER`.

The feed should return JSON like this (anything missing is simply not shown):

```json
{
  "status": "IN_TRANSIT",
  "origin": { "code": "LKCMB", "name": "Colombo, Sri Lanka", "lat": 6.95, "lon": 79.84 },
  "destination": { "code": "NLRTM", "name": "Rotterdam, Netherlands", "lat": 51.95, "lon": 4.05 },
  "transshipment": [],
  "etd": "2026-11-02T08:00:00Z",
  "eta": "2026-11-24T06:00:00Z",
  "vessel": { "name": "VESSEL NAME", "imo": "9876543", "mmsi": "123456789", "voyage": "045W" },
  "events": [
    { "time": "2026-11-01T10:00:00Z", "code": "LOADED", "location": { "code": "LKCMB", "name": "Colombo" }, "description": "Loaded on vessel", "actual": true }
  ]
}
```

`status` is one of `BOOKED, GATE_IN, LOADED, IN_TRANSIT, TRANSSHIPMENT, ARRIVED, DISCHARGED, GATE_OUT, DELIVERED`. If your feed looks different, change `normalize()` in `src/providers/http-tracking.js`. Nothing else needs to change.

`TRANSCO_TRACKING_URL` adds a "Transco track & trace" button on each shipment and in emails.

## Hosting

Any host that runs Node.js with a persistent disk works (a small VM, Render, Railway, Fly.io, Azure App Service…). Data is in `data/transco.db` (SQLite), so back up that folder. In production set `NODE_ENV=production`, `SESSION_SECRET` and `APP_URL`, and serve it over HTTPS.

## Code layout

| Path | What it does |
|---|---|
| `server.js` | Express app, security headers, sessions |
| `src/routes.js` | Sign-in and shipment API, unsubscribe page |
| `src/tracking.js` | Combines track & trace and MarineTraffic, with caching |
| `src/providers/` | Demo and HTTP track & trace feeds, MarineTraffic client |
| `src/notifier.js` | Email scheduler: change alerts and daily/weekly summaries |
| `src/emails.js`, `src/mailer.js` | Email template and sending (SMTP or outbox) |
| `src/carriers.js` | Shipping lines, tracking links, container number checks |
| `public/` | The dashboard (plain HTML/CSS/JS with Leaflet maps) |
