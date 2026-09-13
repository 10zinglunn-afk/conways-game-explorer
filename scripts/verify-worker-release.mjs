import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

// Called only by the disposable-database runner. Secrets stay in memory and
// are never written to the temporary Wrangler config or printed as bindings.
export async function verifyWorkerRelease(databaseURL, runBrowser) {
  const { unstable_dev } = await import('wrangler');
  const directory = await mkdtemp(join(tmpdir(), 'life-worker-review-'));
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  config.main = resolve(config.main);
  config.assets.directory = resolve(config.assets.directory);
  delete config.hyperdrive;
  delete config.$schema;
  config.vars = {};
  const configPath = join(directory, 'wrangler.jsonc');
  await writeFile(configPath, JSON.stringify(config));
  let worker;
  try {
    worker = await unstable_dev(resolve('worker.mjs'), {
      config: configPath, local: true, ip: '127.0.0.1', port: 0,
      logLevel: 'error', persist: false,
      vars: { DATABASE_URL: databaseURL,
        BETTER_AUTH_SECRET: 'disposable-worker-secret-at-least-thirty-two-characters' },
      experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false },
    });
    const baseURL = `http://${worker.address}:${worker.port}`;
    let cookie = '';
    async function request(path, body) {
      const response = await fetch(`${baseURL}${path}`, {
        method: body ? 'POST' : 'GET', redirect: 'manual',
        headers: { origin: baseURL, cookie, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.equal(response.status, 200, `${path}: ${response.status} ${response.status === 200 ? '' : await response.text()}`);
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return response;
    }
    for (const path of ['/studio', '/community', '/community/favorites', '/c/missing', '/u/missing']) {
      const response = await request(path);
      assert.equal(response.headers.get('location'), null);
      assert.match(await response.text(), /<html/);
    }
    const credentials = { email: 'worker-review@example.test', password: 'a-long-worker-review-password' };
    await request('/api/auth/sign-up/email', { ...credentials, name: 'Worker Review' });
    assert.ok((await (await request('/api/auth/get-session')).json()).user);
    cookie = '';
    await request('/api/auth/sign-in/email', credentials);
    assert.ok((await (await request('/api/auth/get-session')).json()).user);
    await request('/api/auth/delete-user', { password: credentials.password });
    assert.equal(await (await request('/api/auth/get-session')).json(), null);
    console.log('Worker runtime: direct routes and sign-up/sign-in/session/deletion passed.');
    await runBrowser(baseURL);
  } finally {
    await worker?.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.env.T2_DATABASE_URL) {
  await verifyWorkerRelease(process.env.T2_DATABASE_URL, (baseURL) => new Promise((resolve, reject) => {
    const browser = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test',
      'tests/browser/t7-cloud.spec.js', '--workers=1', '--output=/private/tmp/life-r3-worker-artifacts'], {
      stdio: 'inherit', timeout: 240_000,
      env: { ...process.env, T2_DATABASE_URL: '', DATABASE_URL: '', T7_CLOUD_TEST: '1', PLAYWRIGHT_BASE_URL: baseURL },
    });
    browser.on('error', reject);
    browser.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Worker browser tests exited ${code}`)));
  }));
}
