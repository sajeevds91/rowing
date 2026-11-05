/* Shared helpers: time maths, dates, formatting, DOM. */
const U = (() => {
  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  // "6:42.5" | "1:02:10" | "402.5" -> seconds
  function parseTime(str) {
    if (str === null || str === undefined) return null;
    const s = String(str).trim();
    if (!s) return null;
    const parts = s.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    return parts.reduce((acc, v) => acc * 60 + v, 0);
  }
  function fmtTime(sec, dp = 1) {
    if (sec === null || sec === undefined || isNaN(sec)) return '—';
    const neg = sec < 0; sec = Math.abs(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    let s = (sec % 60).toFixed(dp);
    if (parseFloat(s) >= 60) { s = (0).toFixed(dp); }
    if (s.indexOf('.') === 1 || (dp === 0 && s.length === 1)) s = '0' + s;
    const body = h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    return (neg ? '-' : '') + body;
  }
  const split500 = (sec, dist) => (sec && dist ? sec / (dist / 500) : null);
  // Concept2 formula: watts = 2.80 / pace^3, pace in sec per metre
  const watts = (sec, dist) => (sec && dist ? 2.8 / Math.pow(sec / dist, 3) : null);
  // Paul's law: +5 s per 500 m for each doubling of distance; used to project pace across distances.
  function projectTime(sec, fromDist, toDist) {
    if (!sec || !fromDist || !toDist) return null;
    const pace = split500(sec, fromDist);
    const projPace = pace + 5 * Math.log2(toDist / fromDist);
    return projPace * (toDist / 500);
  }

  // ---------- Dates (local, ISO yyyy-mm-dd strings) ----------
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const mondayOf = (s) => { const d = parseISO(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
    if (!s) return '—';
    return parseISO(s).toLocaleDateString('en-GB', opts);
  }
  const fmtShort = (s) => fmtDate(s, { day: 'numeric', month: 'short' });

  // ---------- Stats ----------
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const min = (a) => (a.length ? Math.min(...a) : null);
  const max = (a) => (a.length ? Math.max(...a) : null);
  const round = (v, dp = 1) => (v === null || v === undefined || isNaN(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp);

  // ---------- DOM ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  function formData(form) {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
    return o;
  }
  // Downscale an uploaded image so it fits in browser storage.
  function readImage(file, maxDim = 1100, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function download(name, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function toCSV(rows) {
    return rows.map((r) => r.map((v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
  }

  // ---------- Distances ----------
  const DISTANCES = [
    { key: '300', label: '300 m', m: 300 },
    { key: '500', label: '500 m', m: 500 },
    { key: '1000yd', label: '1000 yd (Royal Thomian)', m: 914.4 },
    { key: '1000', label: '1000 m', m: 1000 },
    { key: '2000', label: '2000 m', m: 2000 },
    { key: 'head', label: 'Head race — 2 miles', m: 3218.7 },
  ];
  function fmtDist(m) {
    m = Number(m);
    const d = DISTANCES.find((x) => Math.abs(x.m - m) < 0.5);
    if (d) return d.key === '1000yd' ? '1000 yd' : d.key === 'head' ? '2 mi head' : d.label;
    return m >= 1000 ? round(m / 1000, 2) + ' km' : Math.round(m) + ' m';
  }
  const minutes = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const fmt12 = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`; };

  return {
    DISTANCES, fmtDist, minutes, hhmm, fmt12,
    uid, parseTime, fmtTime, split500, watts, projectTime,
    iso, today, parseISO, addDays, mondayOf, daysBetween, DAYS, MONTHS, fmtDate, fmtShort,
    mean, min, max, round, esc, $, $$, initials, toast, formData, readImage, download, toCSV,
  };
})();
