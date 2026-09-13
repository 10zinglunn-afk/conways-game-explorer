import { createBetterAuth, createPostgresPool } from './server/auth.mjs';
import { handleCommunityFetchRequest } from './server/community-api.mjs';
import {
  injectCommunityConfig,
  renderCommunityConfigScript,
} from './server/community-config.mjs';
import { getPublicPageMetadata, injectPublicPageMetadata, matchPublicPage } from './server/public-page.mjs';

function getServices(env, origin) {
  const runtimeEnv = {
    ...env,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL || origin,
    NODE_ENV: 'production',
  };
  const pool = createPostgresPool({ env: runtimeEnv });
  const auth = createBetterAuth({ env: runtimeEnv, database: pool });
  return { env: runtimeEnv, pool, auth };
}

function serviceUnavailable() {
  return new Response(JSON.stringify({
    error: 'Better Auth is not configured. Set Hyperdrive, BETTER_AUTH_SECRET, and BETTER_AUTH_URL.',
  }), {
    status: 503,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function injectRuntimeConfig(response, env) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return new Response(injectCommunityConfig(await response.text(), env), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const services = getServices(env, url.origin);

    try {
      const communityResponse = await handleCommunityFetchRequest({
        request,
        auth: services.auth,
        pool: services.pool,
      });
      if (communityResponse) return communityResponse;

      if (url.pathname === '/api/auth' || url.pathname.startsWith('/api/auth/')) {
        // Keep request-owned connections alive until Better Auth finishes its
        // asynchronous database work; finally runs before an unawaited return.
        return services.auth ? await services.auth.handler(request) : serviceUnavailable();
      }

      if (url.pathname === '/life-runtime.js' || url.pathname === '/life-config.js' || url.pathname === '/community-config.js') {
        return new Response(renderCommunityConfigScript(services.env), {
          headers: {
            'cache-control': 'no-store',
            'content-type': 'text/javascript; charset=utf-8',
          },
        });
      }

      const publicRoute = matchPublicPage(url.pathname);
      const appRoute = publicRoute || ['/studio', '/community', '/community/favorites'].includes(url.pathname);
      // The asset service redirects /index.html to /. Fetch the canonical shell
      // internally so direct app links retain their URL and receive metadata.
      const assetRequest = appRoute ? new Request(new URL('/', url), { headers: request.headers }) : request;
      const asset = await env.ASSETS.fetch(assetRequest);
      const contentType = asset.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return asset;
      let html = injectCommunityConfig(await asset.text(), services.env);
      if (publicRoute) html = injectPublicPageMetadata(html, await getPublicPageMetadata({ pathname: url.pathname, pool: services.pool, origin: url.origin }));
      const headers = new Headers(asset.headers);
      headers.delete('content-length');
      headers.delete('etag');
      headers.set('cache-control', 'no-store');
      headers.set('content-type', 'text/html; charset=utf-8');
      return new Response(html, { status: asset.status, headers });
    } finally {
      if (services.pool) ctx.waitUntil(services.pool.end());
    }
  },
};
