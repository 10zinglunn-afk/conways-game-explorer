# R3 release-readiness review

Reviewed 2026-09-12 at the user's request, against the accumulated dirty working
tree at HEAD `43e7563`. No separate reviewer model was launched.

## Decision after correction and rereview

**R3 passes the user-requested current-agent rereview on 2026-09-12.** All three
findings below are corrected and the Worker validation gap is closed. No
separate reviewer/model was launched. T8 is ready for GPT-5.6 Sol, subject to
the already-required production backup/binding/data checks before mutation.

Corrections reviewed:

- Worker authentication now awaits Better Auth before closing its request pool.
  A regression exercises asynchronous connection acquisition and checks that
  authentication completes before cleanup.
- Direct app routes fetch the canonical `/` asset internally, preserving the
  requested public URL and metadata. Rewritten HTML drops the original asset
  content length and ETag. The unit asset stub now models index redirects.
- The published snapshot predicate requires `IS TRUE` and explicit string types
  for title/description. The real lifecycle test rejects 29 invalid metadata
  cases and confirms the valid public snapshot remains unchanged.
- The missing native executable was repaired. Restoring the old locked runtime
  exposed a second toolchain issue: it only supported dates through July while
  this app uses September. Wrangler is now pinned to 4.131.1, with workerd
  1.20260911.1 in the lockfile; the September compatibility date is retained.
- `scripts/verify-worker-release.mjs` runs real Wrangler/workerd with the actual
  assets and a disposable database. The parent harness bounds the child runtime
  so a startup hang cannot prevent database cleanup. Test credentials remain in
  memory and are not written to the temporary config.

### Fresh rereview evidence

| Check | Result |
| --- | --- |
| `npm test` | 196 total: 194 passed, 2 environment-gated skips, 0 failures |
| `npm run build:worker` | Static assets built |
| `npx wrangler deploy --dry-run --outdir /private/tmp/life-r3-bundle` | Actual Worker bundle passed with Wrangler 4.131.1; 2883.53 KiB / gzip 494.42 KiB |
| `npm run test:e2e -- --workers=1 --output=/private/tmp/life-r3-local-artifacts` | 34 passed, 6 expected skips, no failures |
| `R3_WORKER_TESTS=1 node --env-file=.claude/.env.local scripts/run-postgres-lifecycle.mjs` | Real PostgreSQL lifecycle passed, Worker HTTP/auth checks passed, both desktop/mobile browser journeys passed |
| `git diff --check` and changed-module syntax | Passed |

The Worker checks exercised direct Studio/Community/public/profile routes with
the real asset service, then sign-up, sign-in, session lookup, password-confirmed
deletion, and post-deletion session rejection. The existing T7 two-user browser
journey ran through workerd, rather than the Node adapter, and verified public
creation/profile rendering and Open Graph metadata, private-version denial,
immutable publication, favorites/comments/reports, remix lineage, republishing,
recovery-key generation, and deletion. Both browser runs reported no page or
console errors. The desktop/mobile creator screenshots were inspected again.

Environment: macOS arm64, Node 22.20.0, Chromium desktop/mobile, local workerd,
and a fresh PostgreSQL database with migrations 0001–0003. Browser control's
required JavaScript runtime was unavailable; the plan-authorized repository
Playwright fallback was used. Browser evidence is at
`/private/tmp/life-r3-worker-artifacts` and `/private/tmp/life-r3-local-artifacts`;
screenshots are `/private/tmp/life-t7-desktop-chromium.png` and
`/private/tmp/life-t7-mobile-chromium.png`.

The successful harness removed its database. The earlier stalled runtime's
disposable database was also removed after its connections closed. No production
tables were migrated or changed, and no deployment, commit, or push occurred.

Remaining limits: Chromium only; local Worker uses a direct connection to the
disposable database. Production Hyperdrive, secrets, provider backup/restore,
live domain/auth behavior, and the actual deployed journey remain T8 checks.
This is a focused release-readiness review, not exhaustive certification.

## Original findings — all resolved

### 1. P1 — Worker closes the pool before authentication finishes

`worker.mjs:54` returns the promise from `services.auth.handler(request)` without
awaiting it. The `finally` block at line 76 immediately calls `pool.end()`.
Better Auth subsequently tries to acquire a database connection from that closed
pool. Sign-in fails before reaching PostgreSQL.

Reproduced by invoking the actual Worker handler with a sign-in request, a
test-only secret and an unreachable local database URL. The response was HTTP
500 and the error was `Cannot use a pool after calling end on the pool`, rather
than a connection failure. No live credentials or production writes were used.

Await authentication completion before pool cleanup. Add a regression that
exercises asynchronous auth database work through the Worker handler, then
verify sign-up/sign-in/session/deletion through the actual Worker runtime.
The current lifecycle/browser harness invokes the Node adapter, so it cannot
catch this ordering defect.

### 2. P1 — Direct app/public links forward the asset canonicalization redirect

`worker.mjs:68` rewrites `/c/:slug`, `/u/:username`, `/studio`, and Community
routes to an asset request for `/index.html`. The checked-in configuration uses
the default HTML handling. Cloudflare canonicalizes index HTML URLs to their
directory URL; the Worker returns that non-HTML redirect at line 71, before
injecting public metadata. The visitor loses the requested route.

The documented asset behavior is described in
[Cloudflare HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).
With an asset stub returning that documented 307 to `/`, the current Worker
forwarded 307 `/` for `/c/public-glider`, `/u/ada`, and `/studio`.
This is a source/documentation-backed reproduction, not a workerd runtime test:
the native runtime could not start (see below). Existing Worker tests always
stub assets as HTTP 200 and therefore hide the redirect.

Fetch the shell through an asset URL that resolves to HTML without redirecting,
or explicitly configure and test HTML handling. Verify direct links and social
metadata through Wrangler with the real asset service, including signed-out
creation/profile URLs and reloads.

### 3. P2 — Published snapshot CHECK still accepts missing required metadata

`postgres/migrations/0003_public_lab.sql:19` permits an UNKNOWN SQL CHECK result.
The title and description expressions at lines 24–25 evaluate to NULL when
those properties are absent. Other valid fields do not make the conjunction
false, so PostgreSQL accepts the incomplete public snapshot. Missing readiness
and non-string title/description values also need explicit coverage.

Confirmed against real PostgreSQL by extracting the exact CHECK expression into
a temporary table, inserting a public snapshot with valid tags/readiness/preview
but no title or description, and rolling back. The insert succeeded. No
persistent schema or data was changed. Reproduction script:
`/private/tmp/r3-snapshot-check.mjs`.

Make the predicate reject NULL (for example, require the complete predicate to
be `IS TRUE`) and enforce JSON string types for title/description. Add real SQL
negative cases for absent properties, JSON null, and wrong types. The current
lifecycle test covers version ownership but does not exercise these CHECK
loopholes. API validation mitigates ordinary requests; it does not fulfill the
explicit migration-integrity requirement in T2/R1.

## Initial review evidence (before corrections)

- `npm test`: 195 total, 193 passed, 2 skipped, zero failures.
- `npm run build:worker`: passed; inspection confirms this command only copies
  static assets. It does not compile or validate the Worker bundle.
- `npx wrangler dev --config /private/tmp/r3-wrangler.jsonc --local --port 8793`:
  failed before startup because the installed `workerd` native binary could not
  be resolved. Temporary config used the production asset routing, absolute
  local paths, and no database binding.
- Real PostgreSQL temporary-table CHECK reproduction: defect confirmed;
  transaction rolled back and connection closed.
- T7 desktop/mobile browser and disposable lifecycle results were reviewed as
  historical evidence, not rerun or claimed as fresh R3 results.

The initial review required toolchain repair and real Worker verification.
Those requirements are now satisfied by the fresh rereview evidence above.

## Operational boundary and next step

The operations guide supplies a high-level restore strategy. T8 must still
record the actual provider backup/restore identifier, prior Worker version,
rollback commands, current schema/data audit, and write-control procedure before
mutating production. These were already assigned to T8; a production backup
need not be taken merely to finish this review.

The corrections and requested rereview are complete. T8 remains assigned to
GPT-5.6 Sol. No production migration, deployment, commit, or push was made
during this review and correction pass.
