'use strict';
/**
 * MarineTraffic vessel positions (API service "PS07 – Single Vessel Positions", endpoint `exportvessel`).
 * Needs MARINETRAFFIC_API_KEY. Results are cached to save API credits.
 */
const config = require('../config');

const NAV_STATUS = [
  'Under way using engine', 'At anchor', 'Not under command', 'Restricted manoeuvrability',
  'Constrained by draught', 'Moored', 'Aground', 'Engaged in fishing', 'Under way sailing',
];

const cache = new Map();

function enabled() {
  return Boolean(config.marineTraffic.apiKey);
}

function parse(row) {
  if (!row) return null;
  const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  const status = num(row.STATUS);
  return {
    lat: num(row.LAT),
    lon: num(row.LON),
    speed: row.SPEED != null ? num(row.SPEED) / 10 : null, // MarineTraffic reports knots x10
    course: num(row.COURSE),
    heading: num(row.HEADING),
    navStatus: status != null ? NAV_STATUS[status] || `AIS status ${status}` : null,
    timestamp: row.TIMESTAMP ? new Date(row.TIMESTAMP.replace(' ', 'T') + (row.TIMESTAMP.endsWith('Z') ? '' : 'Z')).toISOString() : null,
    name: row.SHIPNAME || null,
    imo: row.IMO && row.IMO !== '0' ? String(row.IMO) : null,
    mmsi: row.MMSI ? String(row.MMSI) : null,
    destination: row.DESTINATION || null,
    reportedEta: row.ETA || null,
    source: 'marinetraffic',
  };
}

/** Latest AIS position for a vessel by IMO or MMSI, or null if unavailable. */
async function position({ imo, mmsi }) {
  if (!enabled() || (!imo && !mmsi)) return null;
  const key = imo ? `imo:${imo}` : `mmsi:${mmsi}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;

  const { apiKey, baseUrl, timespanMinutes } = config.marineTraffic;
  const url = `${baseUrl}/exportvessel/v:5/${encodeURIComponent(apiKey)}/timespan:${timespanMinutes}/protocol:jsono/msgtype:extended/${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body?.errors) throw new Error(body.errors.map((e) => e.detail || e.code).join('; '));
    const row = Array.isArray(body) ? body[0] : body?.DATA?.[0] || body;
    const value = parse(row);
    cache.set(key, { value, until: Date.now() + config.marineTraffic.cacheMinutes * 60000 });
    return value;
  } catch (err) {
    console.warn(`[marinetraffic] ${key}: ${err.message}`);
    cache.set(key, { value: null, until: Date.now() + 2 * 60000 });
    return null;
  }
}

module.exports = { enabled, position, parse };
