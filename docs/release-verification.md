# T7 release verification

Completed 2026-09-12 on the current dirty `main` working tree. This packet
verifies release behavior locally and against a disposable PostgreSQL database.
It does not record a production migration, deployment, commit, or push.

## Outcome

R3 initially found blockers in Worker auth lifetime, asset redirects, and the
SQL snapshot CHECK. All are corrected; **R3 passes the requested rereview on
2026-09-12**. Fresh evidence in [r3-review.md](r3-review.md) includes 194 unit
passes, 34 local browser passes, the actual Wrangler bundle, real PostgreSQL
constraint tests, and both desktop/mobile journeys through workerd. T8 is next.
The original T7 results below remain historical local/Node evidence.

T7 is complete and ready for R3 review. The accepted guest, two-user, public
snapshot, privacy, account, editor, responsive, and simulation paths passed in
Chromium at desktop and mobile viewports. T7 found and fixed two integration
defects: account-dialog focus could escape after repeated Tab presses, and an
asynchronous Community feed refresh could overwrite a direct creator route.

## Environment

- macOS arm64, Apple M2, Node v22.20.0.
- Desktop Chromium at 1440×900 and mobile Chromium with the iPhone 13 profile.
- Local application server at `127.0.0.1`; stateful browser tests used a fresh
  disposable PostgreSQL database with migrations 0001–0003 applied in order.
- Better Auth used test-only same-origin configuration. Secrets and connection
  strings were not printed or placed in browser configuration.
- The in-app Browser skill was available, but its required JavaScript control
  runtime was unavailable in this session. The repository Playwright workflow
  was used as the documented fallback.

## Verification results

| Check | Result |
| --- | --- |
| `npm test` | 193 passed, 2 environment-gated skips, 0 failed |
| `npm run build:worker` | Passed |
| Full local Playwright suite | 34 passed, 6 skipped, 0 failed |
| Disposable PostgreSQL lifecycle | 1 passed; database cleaned up |
| T7 PostgreSQL browser journey | 2 passed; desktop and mobile |
| R2 interrupted import journey | 2 passed; desktop and mobile in the preceding R2 gate |
| Syntax and `git diff --check` | Passed |

The six local Playwright skips are deliberate: the four PostgreSQL browser
cases run under their disposable-database harness, while the two older mobile
publish/recovery cases remain superseded by mobile database publication and the
2048×2048 binary-recovery test. No failing assertion was removed or weakened.

## Acceptance evidence

The disposable browser journey in `tests/browser/t7-cloud.spec.js` proves:

1. Two Better Auth users receive distinct profiles and owner scopes.
2. User A publishes a valid creation; a signed-out direct `/c/:slug` request
   receives the canonical title, Open Graph URL, public data, and runnable UI.
3. A later private version remains inaccessible and does not alter the public
   snapshot until explicit republish.
4. User B favorites, comments on, reports, and remixes the public creation.
   The edited remix publishes with source lineage, and both profile APIs list
   the correct public work.
5. Anonymous and cross-owner requests cannot read private state or versions.
6. Unpublish removes the public route; republish preserves the canonical slug
   and publishes the chosen newer version.
7. Recovery-key generation succeeds. Deleting User B removes the remix while
   retaining their comment on User A's creation with a deleted-account author.
8. Direct `/u/:username` navigation renders the creator and their public
   creation without a stale Community refresh replacing the route.

The R2 PostgreSQL journey separately proves guest creation, interrupted import,
edit after failed refresh, reload, resumable claim, queued Publish, and one
owner-scoped cloud project. The lifecycle test covers version immutability,
concurrent import completion ordering, real cloud-head conflicts, recovery-key
rotation/session revocation, deletion cascades, and owner isolation.

Local browser coverage proves visible selection/move/copy/paste/rotate/reflect,
Undo/Redo followed by Step, real mobile drawing and stamping, project save and
version restore, publish validation, public preset routes, guest remix/reload,
auth gating, Community filters and empty states, maximum-size binary recovery,
circuit truth behavior, and no mobile horizontal overflow. New T7 coverage
keeps keyboard focus inside the account dialog, closes it with Escape, restores
the Account trigger, and clears a running 1200×1200 board without a stale Worker
result reappearing.

## Visual inspection

Screenshots were inspected at:

- `/private/tmp/life-t7-desktop-chromium.png`
- `/private/tmp/life-t7-mobile-chromium.png`
- `/private/tmp/life-t7-account-desktop-chromium.png`
- `/private/tmp/life-t7-account-mobile-chromium.png`

They show the loaded creator profile and public creation card at desktop/mobile
sizes, and the modal account surface with its focused close control. No error
overlay, blank application shell, horizontal mobile overflow, or unreadable
control state was observed. Full local artifacts are under
`/private/tmp/life-t7-final-after-route`; database-browser artifacts are under
`/private/tmp/life-t7-cloud-artifacts`.

## Performance evidence

A fresh engine benchmark on the environment above measured sparse 2048×2048
boards at 0.62 ms/generation bounded and 0.61 ms wrapped. Dense 2048×2048 boards
measured 36.96 ms bounded and 39.54 ms wrapped. These figures exclude Canvas,
Worker transfer, and browser scheduling. The browser cancellation test verifies
that Clear remains responsive and rejects stale work on a half-populated
1200×1200 board. The product makes no 60 FPS promise for maximum dense boards.

## Known limits and R3 boundary

- Browser evidence covers Chromium, not Safari or Firefox.
- Production migrations, backups, bindings, observability, live domain checks,
  and rollback execution belong to T8 after R3 approval.
- Recovery is key-based because no transactional email provider is configured.
- Browser persistence remains subject to the browser's IndexedDB quota and site
  data controls.
- The working tree contains the accumulated implementation and remains
  uncommitted. R3 must review the complete release diff before production work.
