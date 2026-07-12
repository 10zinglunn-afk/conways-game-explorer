import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

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

test('Worker community routes require configured PostgreSQL and Better Auth services', async () => {
  const response = await worker.fetch(
    new Request('https://life.example/api/community/state'),
    { ASSETS: assets() },
  );

  assert.equal(response.status, 503);
  assert.match(await response.text(), /not configured/);
});
