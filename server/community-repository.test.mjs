import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresCommunityRepository } from './community-repository.mjs';

test('PostgreSQL repository requires an authenticated pool and user', () => {
  assert.throws(
    () => createPostgresCommunityRepository(),
    /requires a pg Pool/,
  );

  assert.throws(
    () => createPostgresCommunityRepository({ pool: { connect() {} } }),
    /authenticated user id/,
  );
});

test('saveProfile uses parameterized SQL and the Better Auth user id', async () => {
  const pool = createRecordingPool();
  const repo = createPostgresCommunityRepository({ pool, userId: 'user-1' });

  const profile = await repo.saveProfile({ displayName: 'Ada Lovelace' });

  assert.equal(profile.id, 'user-1');
  assert.equal(profile.username, 'ada-lovelace');
  const authLookup = pool.queries[0];
  const profileWrite = pool.queries[1];
  assert.match(authLookup.text, /where id = \$1/);
  assert.deepEqual(authLookup.values, ['user-1']);
  assert.match(profileWrite.text, /on conflict \(id\) do update/);
  assert.deepEqual(profileWrite.values.slice(0, 3), ['user-1', 'ada-lovelace', 'Ada Lovelace']);
  assert.doesNotMatch(profileWrite.text, /user-1|Ada Lovelace/);
});

function createRecordingPool() {
  const queries = [];
  return {
    queries,
    async query(text, values = []) {
      queries.push({ text, values });
      if (/from auth\.auth_users/.test(text)) {
        return { rows: [{ id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace', image: null }] };
      }
      if (/insert into public\.profiles/.test(text)) {
        return { rows: [{
          id: values[0],
          username: values[1],
          display_name: values[2],
          avatar_url: values[3],
          bio: values[4],
          github_url: values[5],
          linkedin_url: values[6],
          created_at: '2026-07-11T00:00:00.000Z',
        }] };
      }
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      throw new Error('This test does not need a transaction.');
    },
  };
}
