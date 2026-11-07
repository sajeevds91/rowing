'use strict';
/**
 * Generic HTTP track & trace provider.
 *
 * Calls TRACKING_API_URL (with {reference}, {carrier} and {type} placeholders) and expects the
 * normalized JSON documented in README.md ("Connecting a real track & trace feed").
 * If your feed returns a different shape, adapt `normalize()` below; nothing else needs to change.
 */
const config = require('../config');

const STATUSES = ['BOOKED', 'GATE_IN', 'LOADED', 'IN_TRANSIT', 'TRANSSHIPMENT', 'ARRIVED', 'DISCHARGED', 'GATE_OUT', 'DELIVERED'];

function port(p) {
  if (!p) return null;
  if (typeof p === 'string') return { code: null, name: p, lat: null, lon: null };
  return { code: p.code || p.locode || null, name: p.name || p.code || '', lat: p.lat ?? null, lon: p.lon ?? p.lng ?? null };
}

function normalize(raw, reference) {
  const now = Date.now();
  const events = (raw.events || [])
    .map((e) => ({
      time: e.time || e.date || e.timestamp,
      code: (e.code || e.status || '').toUpperCase(),
      location: e.location?.name || e.location || '',
      locode: e.location?.code || e.locode || null,
      description: e.description || e.status || '',
      vessel: e.vessel || null,
      actual: e.actual ?? new Date(e.time || e.date || e.timestamp).getTime() <= now,
    }))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  const happened = events.filter((e) => e.actual);
  const status = STATUSES.includes(String(raw.status).toUpperCase()) ? String(raw.status).toUpperCase() : 'IN_TRANSIT';
  const etd = raw.etd || raw.departure || null;
  const eta = raw.eta || raw.arrival || null;
  let progress = raw.progress;
  if (progress == null && etd && eta) {
    progress = Math.min(1, Math.max(0, (now - new Date(etd)) / (new Date(eta) - new Date(etd))));
  }
  return {
    reference,
    source: 'api',
    status,
    origin: port(raw.origin || raw.pol),
    destination: port(raw.destination || raw.pod),
    transshipment: (raw.transshipment || []).map(port),
    etd,
    eta,
    progress: progress ?? 0,
    vessel: raw.vessel ? { name: raw.vessel.name || raw.vessel, imo: raw.vessel.imo || null, mmsi: raw.vessel.mmsi || null, voyage: raw.vessel.voyage || null } : null,
    vesselPosition: null,
    route: raw.route || null,
    events,
    lastEvent: happened[happened.length - 1] || null,
    fetchedAt: new Date(now).toISOString(),
  };
}

async function track({ reference, carrier, refType }) {
  const { apiUrl, apiKey, apiKeyHeader } = config.tracking;
  if (!apiUrl) throw new Error('TRACKING_API_URL is not set');
  const url = apiUrl
    .replace('{reference}', encodeURIComponent(reference))
    .replace('{carrier}', encodeURIComponent(carrier || ''))
    .replace('{type}', encodeURIComponent(refType || ''));
  const headers = { Accept: 'application/json' };
  if (apiKey) headers[apiKeyHeader] = apiKeyHeader.toLowerCase() === 'authorization' ? `Bearer ${apiKey}` : apiKey;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (res.status === 404) {
    const err = new Error('Reference not found by the tracking service yet');
    err.notFound = true;
    throw err;
  }
  if (!res.ok) throw new Error(`Tracking service returned HTTP ${res.status}`);
  return normalize(await res.json(), reference);
}

module.exports = { name: 'http', track, normalize };
