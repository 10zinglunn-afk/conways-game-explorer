import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';

function assets(html = '<script id="life-runtime-config" type="application/json">{"backend":"local"}</script>') {
  return {
    fetch() {
      return Promise.resolve(new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }));
    },
  };
}

test('Worker injects only safe local runtime config into static HTML without database bindings', async () => {
  const response = await worker.fetch(new Request('https://life.example/'), { ASSETS: assets() });

  assert.equal(response.status, 200);
  assert.match(await response.text(), /{"backend":"local"}/);
});

test('Worker-first asset routing includes the homepage runtime config', async () => {
  const config = JSON.parse(await readFile(new URL('./wrangler.jsonc', import.meta.url), 'utf8'));
  assert.ok(config.assets.run_worker_first.includes('/'));
  assert.ok(config.assets.run_worker_first.includes('/api/*'));
});

test('Worker community routes require configured PostgreSQL and Better Auth services', async () => {
  const response = await worker.fetch(
    new Request('https://life.example/api/community/state'),
    { ASSETS: assets() },
  );

  assert.equal(response.status, 503);
  assert.match(await response.text(), /not configured/);
});

test('Worker maps canonical public reloads to the app shell', async () => {
  let requestedPath = '';
  const response = await worker.fetch(new Request('https://life.example/c/public-glider'), {
    ASSETS: { fetch(request) {
      requestedPath = new URL(request.url).pathname;
      if (requestedPath === '/index.html') return Promise.resolve(new Response(null, { status: 307, headers: { location: '/' } }));
      return Promise.resolve(new Response('<html><head><title>Life</title></head><body></body></html>', { headers: { 'content-type': 'text/html', etag: 'original' } }));
    } },
  }, { waitUntil() {} });
  assert.equal(requestedPath, '/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('etag'), null);
});

test('Worker waits for asynchronous auth queries before ending its pool', async (t) => {
  let ended = false;
  let queried = false;
  t.mock.method(Pool.prototype, 'connect', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(ended, false, 'auth must acquire its connection before cleanup');
    return { query: async () => { queried = true; return { rows: [] }; }, release() {} };
  });
  t.mock.method(Pool.prototype, 'end', async () => { ended = true; });
  const cleanup = [];
  const response = await worker.fetch(new Request('https://life.example/api/auth/sign-in/email', {
    method: 'POST', headers: { origin: 'https://life.example', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'missing@example.test', password: 'a-long-test-password' }),
  }), {
    DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
    BETTER_AUTH_SECRET: 'test-only-secret-at-least-thirty-two-characters',
  }, { waitUntil(promise) { cleanup.push(promise); } });
  assert.equal(response.status, 401);
  assert.equal(queried, true);
  await Promise.all(cleanup);
  assert.equal(ended, true);
});
