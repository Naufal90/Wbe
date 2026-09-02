export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function clampNumber(value, { min, max } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  let result = num;
  if (typeof min === 'number') result = Math.max(min, result);
  if (typeof max === 'number') result = Math.min(max, result);
  return result;
}

export function recentTimestamps(timestamps, windowMs, now = Date.now()) {
  if (!Array.isArray(timestamps)) return [];
  return timestamps.filter(ts =>
    typeof ts === 'number' && now - ts < windowMs
  );
}
