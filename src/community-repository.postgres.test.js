import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityRepository, createPostgresCommunityRepository } from './community-repository.js';

test('PostgreSQL browser repository keeps credentials server-side and uses same-origin cookies', async () => {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/get-session') {
      return response({
        session: { id: 'session-1' },
        user: { id: 'user-1', email: 'ada@example.com' },
      });
    }
    if (url === '/api/community/profile') {
      return response({
        id: 'user-1',
        email: 'ada@example.com',
        username: 'ada',
        displayName: 'Ada',
      });
    }
    if (url === '/api/community/creations') {
      return response({
        id: 'creation-1',
        title: 'Glider',
        visibility: 'private',
        versions: [],
      });
    }
    throw new Error(`Unexpected request ${url}`);
  };
  const repo = createPostgresCommunityRepository({ fetch });

  assert.deepEqual(await repo.getAuthSession(), {
    id: 'session-1',
    user: { id: 'user-1', email: 'ada@example.com' },
  });
  await repo.saveProfile({ displayName: 'Ada' });
  const creation = await repo.saveCreation({ title: 'Glider', rle: 'x = 1, y = 1\no!' });

  assert.equal(creation.id, 'creation-1');
  assert.equal(repo.getState().profile.id, 'user-1');
  assert.equal(repo.findCreation('creation-1').title, 'Glider');
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/auth/get-session',
    '/api/community/profile',
    '/api/community/creations',
  ]);
  assert.equal(calls[2].options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    title: 'Glider',
    rle: 'x = 1, y = 1\no!',
    publish: false,
  });
});

test('PostgreSQL browser repository preserves server errors for the UI', async () => {
  const repo = createPostgresCommunityRepository({
    fetch: async () => response({ error: 'Sign in before using the community backend.' }, 401),
  });

  await assert.rejects(
    () => repo.loadCommunityState(),
    /Sign in before using the community backend/,
  );
});

test('community repository factory selects PostgreSQL without browser database credentials', () => {
  const repo = createCommunityRepository({ backend: 'postgres', fetch: async () => response({}) });

  assert.equal(repo.backend, 'postgres');
  assert.equal(repo.requiresAuth, true);
});

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}
