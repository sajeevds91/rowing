'use strict';
const R = 6371; // km
const rad = (d) => (d * Math.PI) / 180;

function distanceKm([lat1, lon1], [lat2, lon2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing([lat1, lon1], [lat2, lon2]) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

function pathLengthKm(path) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += distanceKm(path[i - 1], path[i]);
  return d;
}

/** Point and heading at fraction f (0..1) along a polyline. */
function along(path, f) {
  const total = pathLengthKm(path);
  let target = Math.min(Math.max(f, 0), 1) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceKm(path[i - 1], path[i]);
    if (target <= seg || i === path.length - 1) {
      const t = seg === 0 ? 0 : Math.min(target / seg, 1);
      const [a, b] = [path[i - 1], path[i]];
      return { lat: a[0] + (b[0] - a[0]) * t, lon: a[1] + (b[1] - a[1]) * t, course: bearing(a, b) };
    }
    target -= seg;
  }
  const last = path[path.length - 1];
  return { lat: last[0], lon: last[1], course: 0 };
}

module.exports = { distanceKm, bearing, pathLengthKm, along };
