import { fromNodeHeaders } from 'better-auth/node';
import { Readable } from 'node:stream';
import { createPostgresCommunityRepository } from './community-repository.mjs';

const MAX_BODY_BYTES = 1_000_000;

// The application has a local Node server and a Cloudflare Worker deployment.
// Keep the business route logic on standard Web Request/Response objects so
// both runtimes enforce exactly the same authentication and ownership checks.
export async function handleCommunityFetchRequest({ request, auth, pool } = {}) {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (url.pathname !== '/api/community' && !url.pathname.startsWith('/api/community/')) {
    return null;
  }

  if (!auth || !pool) {
    return jsonResponse(503, { error: 'PostgreSQL community backend is not configured.' });
  }

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return jsonResponse(401, { error: 'Sign in before using the community backend.' });
    }

    const repo = createPostgresCommunityRepository({ pool, userId: session.user.id });
    const segments = url.pathname.split('/').filter(Boolean).slice(2);
    const [resource, id, action] = segments;

    if (request.method === 'GET' && resource === 'state') {
      return jsonResponse(200, await repo.loadCommunityState());
    }
    if (request.method === 'GET' && resource === 'trending') {
      return jsonResponse(200, await repo.listTrendingCreations({ limit: url.searchParams.get('limit') }));
    }
    if (request.method === 'POST' && resource === 'profile') {
      return jsonResponse(200, await repo.saveProfile(await readJson(request)));
    }
    if (request.method === 'POST' && resource === 'creations' && !id) {
      const body = await readJson(request);
      return jsonResponse(201, await repo.createCreation(body, { publish: body.publish === true }));
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'versions') {
      return jsonResponse(201, await repo.saveVersion(id, await readJson(request)));
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'restore') {
      const body = await readJson(request);
      return jsonResponse(200, await repo.restoreVersion(id, body.versionId));
    }
    if (request.method === 'PATCH' && resource === 'creations' && id) {
      return jsonResponse(200, await repo.updateCreationMetadata(id, await readJson(request)));
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'publish') {
      return jsonResponse(200, await repo.publishCreation(id));
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'unpublish') {
      return jsonResponse(200, await repo.unpublishCreation(id));
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'archive') {
      return jsonResponse(200, await repo.archiveCreation(id));
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'star') {
      return jsonResponse(200, await repo.toggleStar(id));
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'remix') {
      const remix = await repo.cloneCreation(id);
      return jsonResponse(201, remix ? { remix, source: repo.findCreation(id) } : null);
    }
    if (request.method === 'DELETE' && resource === 'creations' && id) {
      return jsonResponse(200, { deleted: await repo.deleteCreation(id) });
    }

    return jsonResponse(404, { error: 'Community route not found.' });
  } catch (error) {
    const status = error.status || (/not found|requires|archived|authentication|sign in|not available/i.test(error.message)
      ? 400
      : 500);
    return jsonResponse(status, {
      error: status === 500 ? 'Community request failed.' : error.message,
    });
  }
}

export async function handleCommunityRequest({ request, response, auth, pool } = {}) {
  const webRequest = toWebRequest(request);
  const result = await handleCommunityFetchRequest({ request: webRequest, auth, pool });
  if (!result) return false;

  response.writeHead(result.status, Object.fromEntries(result.headers.entries()));
  response.end(await result.text());
  return true;
}

export async function readJson(request) {
  const contentLength = Number(request.headers?.get?.('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) throw createHttpError(413, 'Request body is too large.');

  let body = '';
  try {
    body = await request.text();
  } catch {
    throw createHttpError(400, 'Request body must be valid JSON.');
  }
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    throw createHttpError(413, 'Request body is too large.');
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw createHttpError(400, 'Request body must be valid JSON.');
  }
}

function toWebRequest(request) {
  const headers = new Headers(fromNodeHeaders(request.headers || {}));
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  const init = { method: request.method || 'GET', headers };
  if (!['GET', 'HEAD'].includes(init.method)) {
    init.body = Readable.toWeb(Readable.from(request));
    init.duplex = 'half';
  }
  return new Request(url, init);
}

function createHttpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}
