const { URL } = require('url');

/**
 * Autorise uniquement HTTPS, refuse hôtes locaux et plages RFC1918.
 */
function isSafeAvatarUrl(raw) {
  if (!raw || typeof raw !== 'string') return false;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host === '::1'
  ) {
    return false;
  }
  if (host.endsWith('.local')) return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
  return true;
}

module.exports = { isSafeAvatarUrl };
