'use strict';
const config = require('./config');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}
function fmtDay(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const STATUS_COLORS = {
  DELIVERED: '#15803d', ARRIVED: '#15803d', DISCHARGED: '#15803d', GATE_OUT: '#15803d',
  IN_TRANSIT: '#1d4ed8', TRANSSHIPMENT: '#b45309', UNKNOWN: '#6b7280',
};

function shipmentBlock({ shipment, snap, reason }) {
  const color = STATUS_COLORS[snap.status] || '#0f766e';
  const pos = snap.vesselPosition;
  const last = snap.lastEvent;
  const route = snap.origin && snap.destination ? `${esc(snap.origin.name)} &rarr; ${esc(snap.destination.name)}` : '';
  const pct = Math.round((snap.progress || 0) * 100);
  const unsub = `${config.appUrl}/unsubscribe/${shipment.unsubscribe_token}`;
  const linksHtml = [
    `<a href="${config.appUrl}/#/shipment/${shipment.id}" style="color:#0f4c81">Open in dashboard</a>`,
    snap.links?.transco && `<a href="${esc(snap.links.transco)}" style="color:#0f4c81">Transco track &amp; trace</a>`,
    snap.links?.carrier && `<a href="${esc(snap.links.carrier)}" style="color:#0f4c81">${esc(snap.carrierName)} tracking</a>`,
    snap.links?.marineTraffic && `<a href="${esc(snap.links.marineTraffic)}" style="color:#0f4c81">Vessel on MarineTraffic</a>`,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;margin:0 0 16px;background:#ffffff">
    <tr><td style="padding:16px 18px">
      ${reason === 'change' ? '<div style="font-size:12px;font-weight:600;color:#b45309;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Status update</div>' : ''}
      <div style="font-size:16px;font-weight:700;color:#0f172a">${esc(shipment.label || shipment.reference)}</div>
      <div style="font-size:13px;color:#475569;margin-top:2px">${esc(shipment.reference)} · ${esc(snap.carrierName)}${route ? ` · ${route}` : ''}</div>
      <div style="margin-top:12px">
        <span style="display:inline-block;background:${color};color:#fff;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600">${esc(snap.statusLabel)}</span>
        <span style="font-size:13px;color:#334155;margin-left:8px">ETA <b>${fmtDay(snap.eta)}</b></span>
      </div>
      <div style="background:#e2e8f0;border-radius:999px;height:6px;margin:12px 0 4px"><div style="background:${color};width:${pct}%;height:6px;border-radius:999px"></div></div>
      <div style="font-size:12px;color:#64748b">${pct}% of the journey complete</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:13px;color:#334155">
        ${last ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Latest event</td><td>${esc(last.description)} — ${esc(last.location)} (${fmtDate(last.time)})</td></tr>` : ''}
        ${snap.vessel?.name ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Vessel</td><td>${esc(snap.vessel.name)}${snap.vessel.voyage ? ` / ${esc(snap.vessel.voyage)}` : ''}</td></tr>` : ''}
        ${pos?.lat != null ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Position</td><td>${pos.lat.toFixed(3)}, ${pos.lon.toFixed(3)} · ${pos.speed != null ? `${pos.speed.toFixed(1)} kn` : ''} ${pos.navStatus ? `· ${esc(pos.navStatus)}` : ''} (${fmtDate(pos.timestamp)})</td></tr>` : ''}
      </table>
      <div style="font-size:13px;margin-top:12px">${linksHtml}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:10px"><a href="${unsub}" style="color:#94a3b8">Stop emails for this shipment</a></div>
    </td></tr>
  </table>`;
}

/**
 * @param {{name:string}} user
 * @param {{shipment:object, snap:object, reason:'change'|'scheduled'|'test'|'subscribed'}[]} items
 */
function updateEmail(user, items) {
  const changes = items.filter((i) => i.reason === 'change');
  let subject;
  if (items.length === 1) {
    const { shipment, snap, reason } = items[0];
    const name = shipment.label || shipment.reference;
    subject = reason === 'subscribed'
      ? `You're now following ${name}`
      : reason === 'change'
        ? `${name}: ${snap.statusLabel}`
        : `${name}: ${snap.statusLabel}, ETA ${fmtDay(snap.eta)}`;
  } else {
    subject = `Shipment update: ${items.length} shipments${changes.length ? ` (${changes.length} changed)` : ''}`;
  }

  const intro = items[0].reason === 'subscribed'
    ? `You'll receive email updates for this shipment. Here is where it is right now.`
    : items[0].reason === 'test'
      ? `This is a test of your shipment email updates. Here is where your shipment is right now.`
      : changes.length && changes.length === items.length
        ? `There has been a change to ${items.length === 1 ? 'your shipment' : 'your shipments'}.`
        : `Here is the latest on the shipments you follow.`;

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">
      <tr><td style="background:#0f2b46;border-radius:10px 10px 0 0;padding:18px 20px;color:#fff">
        <div style="font-size:18px;font-weight:700;letter-spacing:.02em">${esc(config.companyName)}</div>
        <div style="font-size:12px;color:#a5c4e0;margin-top:2px">Shipment tracking update · ${fmtDate(new Date().toISOString())}</div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:18px 20px">
        <p style="margin:0 0 16px;font-size:14px;color:#334155">Hello ${esc(user.name)},<br>${intro}</p>
        ${items.map(shipmentBlock).join('')}
        <p style="font-size:12px;color:#64748b;margin:12px 0 0">Change how often you hear from us in your <a href="${config.appUrl}" style="color:#0f4c81">${esc(config.companyName)} dashboard</a>.
        ${config.supportEmail ? ` Questions? Contact <a href="mailto:${esc(config.supportEmail)}" style="color:#0f4c81">${esc(config.supportEmail)}</a>.` : ''}
        ${items.some((i) => i.snap.source === 'demo') ? '<br><i>Tracking data in this email is demo data.</i>' : ''}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const text = [
    `Hello ${user.name},`,
    intro,
    '',
    ...items.map(({ shipment, snap }) => [
      `${shipment.label || shipment.reference} (${shipment.reference}, ${snap.carrierName})`,
      `  Status: ${snap.statusLabel}   ETA: ${fmtDay(snap.eta)}`,
      snap.lastEvent ? `  Latest: ${snap.lastEvent.description} - ${snap.lastEvent.location} (${fmtDate(snap.lastEvent.time)})` : null,
      snap.vessel?.name ? `  Vessel: ${snap.vessel.name}` : null,
      `  Dashboard: ${config.appUrl}/#/shipment/${shipment.id}`,
      snap.links?.marineTraffic ? `  MarineTraffic: ${snap.links.marineTraffic}` : null,
      `  Stop emails: ${config.appUrl}/unsubscribe/${shipment.unsubscribe_token}`,
      '',
    ].filter(Boolean).join('\n')),
  ].join('\n');

  return { subject, html, text };
}

module.exports = { updateEmail, esc };
