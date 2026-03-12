/**
 * URL canonicalization for link exposure tracking.
 * Creates stable canonical_url keys per conservative rules:
 * - lowercases hostname, removes fragments and tracking params
 * - preserves path and non-tracking query params in order
 */

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid'
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return TRACKING_PARAMS.has(lower) || lower.startsWith('utm_');
}

export function canonicalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();

  const toRemove: string[] = [];
  for (const key of parsed.searchParams.keys()) {
    if (isTrackingParam(key)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    parsed.searchParams.delete(key);
  }

  let result = parsed.toString();
  if (result.endsWith('?')) {
    result = result.slice(0, -1);
  }
  return result;
}

export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}