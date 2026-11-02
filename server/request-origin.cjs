'use strict';

function publicOrigin(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('ROOT_PUBLIC_ORIGIN must be an absolute HTTP(S) origin.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.hostname.includes('*')
  )
    throw new Error('ROOT_PUBLIC_ORIGIN must contain only scheme, host and optional port.');
  return url.origin;
}

/** Explicit browser origins support published ports without trusting forwarded headers. */
function createOriginPolicy(configuredOrigin) {
  const configured = publicOrigin(configuredOrigin);
  return (req) => {
    const port = req.socket.localPort;
    const origins = [
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
      ...(configured ? [configured] : []),
    ].map((origin) => new URL(origin).origin);
    const hosts = origins.map((origin) => new URL(origin).host);
    const host = req.headers.host;
    if (typeof host !== 'string' || !hosts.includes(host.toLowerCase())) return false;
    const origin = req.headers.origin;
    if (origin !== undefined && !origins.includes(origin)) return false;
    const site = req.headers['sec-fetch-site'];
    return !site || site === 'same-origin' || site === 'none';
  };
}

module.exports = { createOriginPolicy };
