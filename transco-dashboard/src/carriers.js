'use strict';
const config = require('./config');

/** Shipping lines with their public track & trace pages. {ref} is replaced by the reference. */
const CARRIERS = [
  { code: 'MAEU', name: 'Maersk', prefixes: ['MAEU', 'MRKU', 'MSKU', 'MRSU', 'SUDU'], url: 'https://www.maersk.com/tracking/{ref}' },
  { code: 'MSCU', name: 'MSC', prefixes: ['MSCU', 'MEDU', 'MSDU', 'MSMU'], url: 'https://www.msc.com/en/track-a-shipment?trackingNumber={ref}' },
  { code: 'CMDU', name: 'CMA CGM', prefixes: ['CMAU', 'CGMU', 'APHU', 'APZU'], url: 'https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference={ref}' },
  { code: 'HLCU', name: 'Hapag-Lloyd', prefixes: ['HLCU', 'HLXU', 'HAMU', 'UACU'], url: 'https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html?container={ref}' },
  { code: 'ONEY', name: 'Ocean Network Express (ONE)', prefixes: ['ONEU', 'NYKU', 'MOLU', 'KKFU'], url: 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam={ref}' },
  { code: 'EGLV', name: 'Evergreen', prefixes: ['EGHU', 'EMCU', 'EGSU', 'EISU'], url: 'https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do' },
  { code: 'COSU', name: 'COSCO Shipping', prefixes: ['CSNU', 'CBHU', 'CCLU', 'FCIU'], url: 'https://elines.coscoshipping.com/ebusiness/cargoTracking?trackingType=CONTAINER&number={ref}' },
  { code: 'OOLU', name: 'OOCL', prefixes: ['OOLU', 'OOCU'], url: 'https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx' },
  { code: 'YMLU', name: 'Yang Ming', prefixes: ['YMLU', 'YMMU'], url: 'https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx' },
  { code: 'ZIMU', name: 'ZIM', prefixes: ['ZIMU', 'ZCSU', 'ZMOU'], url: 'https://www.zim.com/tools/track-a-shipment?consnumber={ref}' },
  { code: 'HDMU', name: 'HMM', prefixes: ['HDMU', 'HMMU'], url: 'https://www.hmm21.com/e-service/general/trackNTrace/TrackNTrace.do' },
  { code: 'PABV', name: 'PIL', prefixes: ['PCIU'], url: 'https://www.pilship.com/en-our-track-and-trace-pil-pacific-international-lines/120.html' },
];

const byCode = new Map(CARRIERS.map((c) => [c.code, c]));

function normalizeReference(ref) {
  return String(ref || '').toUpperCase().replace(/[\s-]/g, '').slice(0, 40);
}

/** ISO 6346 container number check (e.g. MSCU1234565). */
function isContainerNumber(ref) {
  return /^[A-Z]{3}[UJZ]\d{7}$/.test(ref);
}

/** ISO 6346 check digit for the first 10 characters of a container number. */
function containerCheckDigit(first10) {
  const letterValues = {};
  let v = 10;
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (v % 11 === 0) v++;
    letterValues[ch] = v++;
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = first10[i];
    const val = /\d/.test(ch) ? Number(ch) : letterValues[ch];
    sum += val * 2 ** i;
  }
  return (sum % 11) % 10;
}

function containerCheckDigitValid(ref) {
  return isContainerNumber(ref) && containerCheckDigit(ref.slice(0, 10)) === Number(ref[10]);
}

function detectCarrier(ref) {
  const prefix = ref.slice(0, 4);
  const hit = CARRIERS.find((c) => c.prefixes.includes(prefix));
  return hit ? hit.code : null;
}

function detectRefType(ref) {
  return isContainerNumber(ref) ? 'container' : 'bl';
}

function carrierTrackingUrl(carrierCode, ref) {
  const c = byCode.get(carrierCode);
  if (!c) return `https://www.google.com/search?q=${encodeURIComponent(ref + ' container tracking')}`;
  return c.url.replace('{ref}', encodeURIComponent(ref));
}

function transcoTrackingUrl(ref) {
  const t = config.tracking.transcoUrl;
  return t ? t.replace('{reference}', encodeURIComponent(ref)).replace('{ref}', encodeURIComponent(ref)) : null;
}

function marineTrafficUrl({ imo, mmsi, name } = {}) {
  if (imo) return `https://www.marinetraffic.com/en/ais/details/ships/imo:${encodeURIComponent(imo)}`;
  if (mmsi) return `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${encodeURIComponent(mmsi)}`;
  if (name) return `https://www.marinetraffic.com/en/ais/index/search/all/keyword:${encodeURIComponent(name)}`;
  return 'https://www.marinetraffic.com/';
}

module.exports = {
  CARRIERS: CARRIERS.map(({ code, name }) => ({ code, name })),
  carrierName: (code) => byCode.get(code)?.name || code || 'Unknown carrier',
  isKnownCarrier: (code) => byCode.has(code),
  normalizeReference,
  isContainerNumber,
  containerCheckDigit,
  containerCheckDigitValid,
  detectCarrier,
  detectRefType,
  carrierTrackingUrl,
  transcoTrackingUrl,
  marineTrafficUrl,
};
