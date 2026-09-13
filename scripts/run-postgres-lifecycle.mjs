import { readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createServer } from 'node:http';
import { createRequestHandler } from '../server.mjs';

const source = process.env.DATABASE_URL;
if (!source) throw new Error('Set DATABASE_URL to a PostgreSQL server that permits temporary databases.');
const databaseName = `life_t2_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const admin = new Pool({ connectionString: source, max: 1 });
const testUrl = new URL(source);
testUrl.pathname = `/${databaseName}`;
const migrationsPath = fileURLToPath(new URL('../postgres/migrations', import.meta.url));

try {
  await admin.query(`create database "${databaseName}"`);
  const pool = new Pool({ connectionString: testUrl.toString(), max: 2 });
  try {
    for (const name of (await readdir(migrationsPath)).filter((name) => name.endsWith('.sql')).sort()) {
      await pool.query(await readFile(join(migrationsPath, name), 'utf8'));
    }
  } finally { await pool.end(); }
  await child(process.execPath, ['--test', 'server/postgres-lifecycle.integration.test.mjs'], {
    ...process.env, T2_DATABASE_URL: testUrl.toString(), DATABASE_URL: '',
  });
  if (process.env.R3_WORKER_TESTS === '1') {
    // Isolate Wrangler startup so even a startup hang cannot prevent the
    // parent from reaching database cleanup.
    await child(process.execPath, ['scripts/verify-worker-release.mjs'], {
      ...process.env, T2_DATABASE_URL: testUrl.toString(), DATABASE_URL: '',
    });
  }
  if (process.env.R2_BROWSER_TESTS === '1') {
    const browserPool = new Pool({ connectionString: testUrl.toString(), max: 5 });
    let handler;
    const server = createServer((request, response) => handler(request, response));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseURL = `http://127.0.0.1:${port}`;
    handler = createRequestHandler({ databasePool: browserPool, port, env: {
      DATABASE_URL: testUrl.toString(),
      BETTER_AUTH_SECRET: 'disposable-browser-test-secret-at-least-thirty-two-characters',
      BETTER_AUTH_URL: baseURL, NODE_ENV: 'test',
    } });
    try {
      await child(process.execPath, ['node_modules/@playwright/test/cli.js', 'test',
        'tests/browser/r2-cloud.spec.js', '--workers=1', '--output=/private/tmp/life-r2-cloud-artifacts'], {
        ...process.env, DATABASE_URL: '', R2_CLOUD_TEST: '1', PLAYWRIGHT_BASE_URL: baseURL,
      });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await browserPool.end();
    }
  }
  if (process.env.T7_BROWSER_TESTS === '1') {
    const browserPool = new Pool({ connectionString: testUrl.toString(), max: 8 });
    let handler;
    const server = createServer((request, response) => handler(request, response));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseURL = `http://127.0.0.1:${port}`;
    handler = createRequestHandler({ databasePool: browserPool, port, env: {
      DATABASE_URL: testUrl.toString(),
      BETTER_AUTH_SECRET: 'disposable-browser-test-secret-at-least-thirty-two-characters',
      BETTER_AUTH_URL: baseURL, NODE_ENV: 'test',
    } });
    try {
      await child(process.execPath, ['node_modules/@playwright/test/cli.js', 'test',
        'tests/browser/t7-cloud.spec.js', '--workers=1', '--output=/private/tmp/life-t7-cloud-artifacts'], {
        ...process.env, DATABASE_URL: '', T7_CLOUD_TEST: '1', PLAYWRIGHT_BASE_URL: baseURL,
      });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await browserPool.end();
    }
  }
} finally {
  await admin.query('select pg_terminate_backend(pid) from pg_stat_activity where datname=$1', [databaseName]).catch(() => {});
  await admin.query(`drop database if exists "${databaseName}"`).catch((error) => {
    console.error(`Could not drop disposable database ${databaseName}: ${error.message}`);
    process.exitCode = 1;
  });
  await admin.end();
}

function child(command, args, env) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { env, stdio: 'inherit', timeout: 300_000 });
    process.on('error', reject);
    process.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Test process exited ${code}.`)));
  });
}
