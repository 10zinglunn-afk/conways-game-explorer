import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../server/auth.mjs';

const migrationDirectory = fileURLToPath(new URL('../postgres/migrations', import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL before running npm run db:migrate.');
}

const pool = createPostgresPool({ env: process.env });
const migrations = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();

try {
  await pool.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const name of migrations) {
    const sql = await readFile(join(migrationDirectory, name), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      const applied = await client.query(
        'select 1 from public.schema_migrations where version = $1',
        [name],
      );
      if (applied.rowCount) {
        await client.query('commit');
        console.log(`Skipped ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query(
        'insert into public.schema_migrations (version) values ($1)',
        [name],
      );
      await client.query('commit');
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query('rollback');
      throw new Error(`Migration ${name} failed: ${error.message}`, { cause: error });
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
