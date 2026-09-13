import { createPublicCommunity } from './public-community.mjs';

export function matchPublicPage(pathname) {
  const creation = pathname.match(/^\/c\/([^/]+)$/);
  if (creation) return { kind: 'creation', identifier: decodeURIComponent(creation[1]) };
  const profile = pathname.match(/^\/u\/([^/]+)$/);
  if (profile) return { kind: 'profile', identifier: decodeURIComponent(profile[1]) };
  return null;
}

export async function getPublicPageMetadata({ pathname, pool, origin }) {
  const route = matchPublicPage(pathname);
  if (!route || !pool) return null;
  const repo = createPublicCommunity({ pool });
  const record = route.kind === 'creation'
    ? await repo.get(route.identifier)
    : await repo.profile(route.identifier);
  if (!record) return { title: 'Unavailable creation · Life Lab', description: 'This public Life Lab page is unavailable.', url: `${origin}${pathname}` };
  return route.kind === 'creation'
    ? { title: `${record.title} by ${record.ownerName} · Life Lab`, description: record.description || `Play ${record.title} in Conway's Game of Life.`, url: `${origin}/c/${record.slug}` }
    : { title: `${record.displayName} · Life Lab`, description: record.bio || `See ${record.displayName}'s public Conway's Game of Life creations.`, url: `${origin}/u/${record.username}` };
}

export function injectPublicPageMetadata(html, metadata) {
  if (!metadata) return html;
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const url = escapeHtml(metadata.url);
  let output = String(html).replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  const tags = `<meta name="description" content="${description}" />\n    <meta property="og:title" content="${title}" />\n    <meta property="og:description" content="${description}" />\n    <meta property="og:url" content="${url}" />\n    <meta property="og:type" content="website" />\n    <meta name="twitter:card" content="summary" />`;
  return output.replace('</head>', `    ${tags}\n  </head>`);
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
