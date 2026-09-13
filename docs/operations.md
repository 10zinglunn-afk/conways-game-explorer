# Operations guide

This guide describes the implemented boundaries and the checks required before
a release operation. It does not claim that a production backup, migration, or
deployment has already happened.

## Runtime boundaries

The browser is local-first when no database runtime configuration is present.
With PostgreSQL configured, Better Auth owns password accounts and sessions;
the server repository owns community data. The browser never receives the
database connection string or Better Auth secret. Cloudflare Worker runtime
configuration uses a server-only Hyperdrive binding.

Keep `DATABASE_URL`, `BETTER_AUTH_SECRET`, and any optional Better Auth API key
out of browser configuration, logs, screenshots, commits, and support text.
Use same-origin requests and preserve the origin check on mutating community
routes.

## Routine checks

Run the unit suite, Worker build, syntax checks, and browser suite from the
repository before a release. Run the disposable PostgreSQL lifecycle harness
against a fresh database for migrations, ownership, public snapshot isolation,
guest import, recovery/session revocation, and deletion behavior. Do not count
the local repository fallback as proof of the cloud path.

Inspect public routes as a signed-out visitor and confirm that only the
published projection is returned. Check that a private save leaves the public
version and metadata unchanged until explicit Publish. Check unpublish,
archive, restore, delete, report, comment ownership, and cross-user access.

## Backup and restore procedure for T8

The executed 2026-09-13 backup, restore test, migrations, Worker versions, and
exact release rollback reference are recorded in `t8-release.md`.

1. Record the database provider, schema migration IDs, Worker version, and
   current public route behavior without printing secrets.
2. Take a provider-supported PostgreSQL backup or snapshot and record its
   timestamp/restore identifier in the release notes.
3. Apply migrations `0002_publish_readiness.sql` and `0003_public_lab.sql` in
   order through the reviewed migration runner, with writes controlled as the
   release plan requires.
4. Run the disposable or controlled lifecycle and authorization checks against
   the resulting schema. Verify public snapshot isolation and account deletion
   before opening the service.
5. If rollback is required, stop writes, restore the recorded database backup
   or provider restore point into a controlled target, reconnect the prior
   Worker version, and rerun route/auth checks. Do not improvise a destructive
   SQL rollback for append-only versions or account data.

The migrations define cascades for owned account/community rows and set a
comment author to null when its author account is deleted. Treat a database
restore and account deletion as material operations requiring an explicit
operator record.

## Moderation and deletion boundaries

Reports are authenticated submissions with a bounded reason and rate limit.
They are stored in `content_reports`; review and resolution are operator work.
Public reads filter archived and hidden creations. Owners can unpublish,
archive, delete, and restore versions according to repository ownership checks.
Account deletion is password-confirmed and Better Auth session/account records
and owned content are removed through the configured database cascades. There
is no documented retention period, email workflow, or support address in this
release.
