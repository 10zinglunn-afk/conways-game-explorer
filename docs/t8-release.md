# T8 production release record

Released 2026-09-13 UTC after R3 passed. The live application is
https://conways-game-explorer.10zinglunn.workers.dev.

## Production state

- Database: Neon PostgreSQL 18.6, reached by the Worker through Hyperdrive
  `d4332e03b0874e70b647bfeea352a489` (`conways-postgres`). Connection values
  and credentials are not recorded here.
- Worker secret inventory: `BETTER_AUTH_SECRET` is present as secret text. Its
  value was neither read nor printed.
- Migration `0002_publish_readiness.sql` applied at
  `2026-09-13T00:17:04.468Z`.
- Migration `0003_public_lab.sql` applied at
  `2026-09-13T00:17:04.636Z`.
- Final Worker version: `c88e2698-d13f-42c9-838b-a9e82a438452`, receiving
  100% of production traffic.
- Release implementation commit: `3f29cf7` (`feat: launch Life Lab community
  experience`).
- Prior rollback Worker version: `88256033-e4f4-4679-ba0a-618c90be87ab`.
- An initial T8 version, `c2f4a4a0-e55d-424b-8c64-eb9249bf231d`, exposed a
  live-only homepage routing defect and was immediately superseded. Adding `/`
  to `assets.run_worker_first` fixed the root page's server runtime config.

The database contained zero users, creations, or versions before migration.
After live verification and cleanup, every account, profile, creation, version,
comment, favorite, report, recovery, import, session, verification, and action
limit table returned to zero rows.

## Backup and restore evidence

The pre-migration logical backup is stored locally, outside version control, at
`.backups/life-prod-pre-t8-20260913T0009Z.dump`. It is owner-readable only,
30,136 bytes, with SHA-256:

`94f3ed7bc2587e97d560e3c994d15cf26028ad4becff4e13ac7d9de376a80eab`

PostgreSQL 18.6 `pg_dump` created the custom archive. `pg_restore --list`
validated it, then `pg_restore --exit-on-error` loaded it into a new temporary
database. The restored database contained migration 0001 and the expected zero
users/creations. The temporary restore database was deleted afterward.

## Rollback procedure

The SQL changes are additive and the prior Worker remains compatible with the
new schema. For an application-only rollback, run:

`npx wrangler rollback 88256033-e4f4-4679-ba0a-618c90be87ab`

Then verify `/`, `/studio`, `/api/auth/get-session`, and a signed-out public URL.
The earlier version serves a local runtime configuration on `/`; that behavior
is part of the known rollback state.

Restore the database only for confirmed data/schema corruption. First stop
writes at the Cloudflare route, record any rows created after this release, and
restore the archive into a new controlled PostgreSQL database using PostgreSQL
18 `pg_restore --exit-on-error --no-owner --no-acl`. Verify migration and row
counts there before updating Hyperdrive through Cloudflare's credential-safe
configuration surface. Re-enable the route only after auth, ownership, public
snapshot, and direct-route checks pass. Do not restore the pre-release archive
over new user data or attempt a destructive down-migration.

## Verification

- `npm test`: 197 total, 195 passed, 2 environment-gated skips, 0 failed.
- `npm run build:worker`: passed.
- Wrangler 4.131.1 bundle/deploy: 2,883.53 KiB, 494.42 KiB gzip, 75 ms startup.
- Live homepage, Studio, runtime configuration, signed-out session, and missing
  public-page metadata returned expected 200 responses with no-store HTML.
- The full two-user browser/database journey passed against production in
  desktop and mobile Chromium: publish, direct public metadata, private snapshot
  isolation, favorite, comment, report, remix/lineage, profile pages,
  unpublish/republish, recovery-key generation, deletion, and cleanup.
- Playwright reported 2 passed in 21.3 seconds and no page/console errors.
- Live screenshots:
  `/private/tmp/life-t8-live-desktop-chromium.png` and
  `/private/tmp/life-t8-live-mobile-chromium.png`.
- Browser artifacts: `/private/tmp/life-t8-live-artifacts`.

Browser verification used repository Playwright because the in-app Browser
control runtime was unavailable. Safari and Firefox remain untested. Recovery
remains key-based because no transactional email provider is configured.
