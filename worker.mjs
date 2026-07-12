import { createBetterAuth, createPostgresPool } from './server/auth.mjs';
import { handleCommunityFetchRequest } from './server/community-api.mjs';
import {
  injectCommunityConfig,
  renderCommunityConfigScript,
} from './server/community-config.mjs';

let cachedServices = null;

function getServices(env, origin) {
  const runtimeEnv = {
    ...env,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL || origin,
    NODE_ENV: 'production',
  };
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL || null;
  const cacheKey = `${connectionString || 'none'}:${runtimeEnv.BETTER_AUTH_URL}:${env.BETTER_AUTH_SECRET || 'none'}`;

  if (cachedServices?.cacheKey === cacheKey) return cachedServices;

  const pool = createPostgresPool({ env: runtimeEnv });
  const auth = createBetterAuth({ env: runtimeEnv, database: pool });
  cachedServices = { cacheKey, env: runtimeEnv, pool, auth };
  return cachedServices;
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
  async fetch(request, env) {
    const url = new URL(request.url);
    const services = getServices(env, url.origin);

    const communityResponse = await handleCommunityFetchRequest({
      request,
      auth: services.auth,
      pool: services.pool,
    });
    if (communityResponse) return communityResponse;

    if (url.pathname === '/api/auth' || url.pathname.startsWith('/api/auth/')) {
      return services.auth ? services.auth.handler(request) : serviceUnavailable();
    }

    if (url.pathname === '/life-runtime.js' || url.pathname === '/life-config.js' || url.pathname === '/community-config.js') {
      return new Response(renderCommunityConfigScript(services.env), {
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/javascript; charset=utf-8',
        },
      });
    }

    const asset = await env.ASSETS.fetch(request);
    const contentType = asset.headers.get('content-type') || '';
    return contentType.includes('text/html')
      ? injectRuntimeConfig(asset, services.env)
      : asset;
  },
};
