'use strict';
const config = require('./config');
const demo = require('./providers/demo-tracking');
const http = require('./providers/http-tracking');
const marineTraffic = require('./providers/marinetraffic');
const carriers = require('./carriers');

const provider = config.tracking.provider === 'http' ? http : demo;
const cache = new Map();

const STATUS_LABELS = {
  BOOKED: 'Booked',
  GATE_IN: 'At origin terminal',
  LOADED: 'Loaded on vessel',
  IN_TRANSIT: 'In transit',
  TRANSSHIPMENT: 'At transshipment port',
  ARRIVED: 'Arrived at destination',
  DISCHARGED: 'Discharged',
  GATE_OUT: 'Out for delivery',
  DELIVERED: 'Delivered',
  UNKNOWN: 'Awaiting tracking data',
};

function links(shipment, snap) {
  const vessel = {
    imo: shipment.vessel_imo || snap?.vessel?.imo,
    mmsi: shipment.vessel_mmsi || snap?.vessel?.mmsi,
    name: snap?.vessel?.name,
  };
  return {
    carrier: carriers.carrierTrackingUrl(shipment.carrier, shipment.reference),
    transco: carriers.transcoTrackingUrl(shipment.reference),
    marineTraffic: vessel.imo || vessel.mmsi || vessel.name ? carriers.marineTrafficUrl(vessel) : null,
  };
}

/**
 * Full tracking picture for a shipment row: milestones from track & trace,
 * live vessel position from MarineTraffic when available.
 */
async function getTracking(shipment, { force = false } = {}) {
  const key = `${shipment.carrier || ''}|${shipment.reference}|${shipment.vessel_imo || ''}|${shipment.vessel_mmsi || ''}`;
  const hit = cache.get(key);
  if (!force && hit && hit.until > Date.now()) return hit.value;

  let snap;
  try {
    snap = await provider.track({
      reference: shipment.reference,
      carrier: shipment.carrier,
      refType: shipment.ref_type,
      createdAt: shipment.created_at,
    });
  } catch (err) {
    snap = {
      reference: shipment.reference,
      source: provider.name,
      status: 'UNKNOWN',
      error: err.message,
      events: [],
      lastEvent: null,
      progress: 0,
      fetchedAt: new Date().toISOString(),
    };
  }

  // Customer-entered vessel identifiers override what the feed says.
  if (shipment.vessel_imo || shipment.vessel_mmsi) {
    snap.vessel = { ...(snap.vessel || {}), imo: shipment.vessel_imo || null, mmsi: shipment.vessel_mmsi || null, demo: false };
  }
  const ids = { imo: snap.vessel?.imo, mmsi: snap.vessel?.mmsi };
  const live = await marineTraffic.position(ids);
  if (live && live.lat != null) {
    snap.vesselPosition = live;
    if (live.name && snap.vessel) snap.vessel.name = snap.vessel.name || live.name;
  }

  snap.statusLabel = STATUS_LABELS[snap.status] || snap.status;
  snap.carrierName = carriers.carrierName(shipment.carrier);
  snap.links = links(shipment, snap);
  cache.set(key, { value: snap, until: Date.now() + config.tracking.cacheMinutes * 60000 });
  return snap;
}

function invalidate(shipment) {
  for (const k of cache.keys()) if (k.includes(`|${shipment.reference}|`)) cache.delete(k);
}

/** Small fingerprint used to detect meaningful changes for "notify on change". */
function fingerprint(snap) {
  return {
    status: snap.status,
    eta: snap.eta ? snap.eta.slice(0, 10) : null,
    lastEvent: snap.lastEvent ? `${snap.lastEvent.code}@${snap.lastEvent.locode || snap.lastEvent.location}` : null,
  };
}

module.exports = {
  getTracking,
  invalidate,
  fingerprint,
  STATUS_LABELS,
  providerName: provider.name,
  marineTrafficEnabled: marineTraffic.enabled(),
};
