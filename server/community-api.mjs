import { fromNodeHeaders } from 'better-auth/node';
import { createPostgresCommunityRepository } from './community-repository.mjs';

const MAX_BODY_BYTES = 1_000_000;

export async function handleCommunityRequest({ request, response, auth, pool } = {}) {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (url.pathname !== '/api/community' && !url.pathname.startsWith('/api/community/')) {
    return false;
  }

  if (!auth || !pool) {
    sendJson(response, 503, {
      error: 'PostgreSQL community backend is not configured.',
    });
    return true;
  }

  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers || {}) });
    if (!session?.user?.id) {
      sendJson(response, 401, { error: 'Sign in before using the community backend.' });
      return true;
    }

    const repo = createPostgresCommunityRepository({ pool, userId: session.user.id });
    const segments = url.pathname.split('/').filter(Boolean).slice(2);
    const [resource, id, action] = segments;

    if (request.method === 'GET' && resource === 'state') {
      sendJson(response, 200, await repo.loadCommunityState());
      return true;
    }
    if (request.method === 'GET' && resource === 'trending') {
      sendJson(response, 200, await repo.listTrendingCreations({ limit: url.searchParams.get('limit') }));
      return true;
    }
    if (request.method === 'POST' && resource === 'profile') {
      sendJson(response, 200, await repo.saveProfile(await readJson(request)));
      return true;
    }
    if (request.method === 'POST' && resource === 'creations' && !id) {
      const body = await readJson(request);
      sendJson(response, 201, await repo.createCreation(body, { publish: body.publish === true }));
      return true;
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'versions') {
      sendJson(response, 201, await repo.saveVersion(id, await readJson(request)));
      return true;
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'restore') {
      const body = await readJson(request);
      sendJson(response, 200, await repo.restoreVersion(id, body.versionId));
      return true;
    }
    if (request.method === 'PATCH' && resource === 'creations' && id) {
      sendJson(response, 200, await repo.updateCreationMetadata(id, await readJson(request)));
      return true;
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'publish') {
      sendJson(response, 200, await repo.publishCreation(id));
      return true;
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'unpublish') {
      sendJson(response, 200, await repo.unpublishCreation(id));
      return true;
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'archive') {
      sendJson(response, 200, await repo.archiveCreation(id));
      return true;
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'star') {
      sendJson(response, 200, await repo.toggleStar(id));
      return true;
    }
    if (request.method === 'POST' && resource === 'creations' && id && action === 'remix') {
      const remix = await repo.cloneCreation(id);
      sendJson(response, 201, remix ? { remix, source: repo.findCreation(id) } : null);
      return true;
    }
    if (request.method === 'DELETE' && resource === 'creations' && id) {
      sendJson(response, 200, { deleted: await repo.deleteCreation(id) });
      return true;
    }

    sendJson(response, 404, { error: 'Community route not found.' });
    return true;
  } catch (error) {
    const status = error.status || (/not found|requires|archived|authentication|sign in|not available/i.test(error.message)
      ? 400
      : 500);
    sendJson(response, status, {
      error: status === 500 ? 'Community request failed.' : error.message,
    });
    return true;
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw createHttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw createHttpError(400, 'Request body must be valid JSON.');
  }
}

function createHttpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}
