// Interim share links (plan Phase 1 / 3). Encodes a creation into a URL hash so
// a build is shareable as a link today, before Phase 3 ships real /c/[slug]
// pages. Pure and dependency-free so it is unit-testable without a DOM.
export const SHARE_HASH_KEY = 'build';

export function encodeShareLink(creation, { origin = '' } = {}) {
  const payload = {
    title: creation.title,
    description: creation.description,
    tags: creation.tags || [],
    ownerName: creation.ownerName,
    rle: creation.currentVersion?.rle,
    remixedFromId: creation.remixedFromId ?? null,
  };

  return `${origin}#${SHARE_HASH_KEY}=${encodeURIComponent(JSON.stringify(payload))}`;
}

export function decodeShareLink(input) {
  const match = String(input || '').match(new RegExp(`[#&]${SHARE_HASH_KEY}=([^&]+)`));
  if (!match) return null;

  try {
    const payload = JSON.parse(decodeURIComponent(match[1]));
    if (!payload || typeof payload.rle !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
