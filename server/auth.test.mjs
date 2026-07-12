import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBetterAuth,
  createBetterAuthHandler,
  createPostgresPool,
  getDatabaseConnectionString,
} from './auth.mjs';

test('PostgreSQL auth is opt-in when DATABASE_URL is absent', () => {
  const env = { NODE_ENV: 'test' };

  assert.equal(createPostgresPool({ env }), null);
  assert.equal(createBetterAuth({ env }), null);
  assert.equal(createBetterAuthHandler({ env }), null);
});

test('Better Auth fails clearly when a database is configured without a secret', () => {
  const env = {
    DATABASE_URL: 'postgres://example.invalid/life',
    NODE_ENV: 'test',
  };

  assert.throws(
    () => createBetterAuth({ env, database: { query() {} } }),
    /BETTER_AUTH_SECRET is missing/,
  );
});

test('PostgreSQL pool uses standard connection options for hosted Postgres', async () => {
  const pool = createPostgresPool({
    env: { DATABASE_URL: 'postgres://example.invalid/life' },
  });

  assert.equal(pool.options.options, undefined);
  await pool.end();
});

test('PostgreSQL pool accepts the Cloudflare Hyperdrive connection binding', async () => {
  const env = {
    HYPERDRIVE: { connectionString: 'postgres://example.invalid/life' },
  };
  const pool = createPostgresPool({ env });

  assert.equal(getDatabaseConnectionString(env), 'postgres://example.invalid/life');
  assert.equal(pool.options.connectionString, 'postgres://example.invalid/life');
  await pool.end();
});

test('Better Auth accepts an injected database and magic-link sender', () => {
  const env = {
    DATABASE_URL: 'postgres://example.invalid/life',
    BETTER_AUTH_SECRET: 'test-secret-that-is-long-enough-to-meet-minimum-length',
    BETTER_AUTH_URL: 'http://127.0.0.1:5173',
    NODE_ENV: 'test',
  };
  const database = {
    async connect() {
      return {
        async query() {
          return { rows: [] };
        },
        release() {},
      };
    },
    async query() {
      return { rows: [] };
    },
  };
  const auth = createBetterAuth({
    env,
    database,
    sendMagicLink: async () => {},
  });

  assert.equal(typeof auth.handler, 'function');
  assert.equal(typeof auth.api.getSession, 'function');
});
