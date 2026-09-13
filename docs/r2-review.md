# R2 review — rereview passed

## Current decision — requested correction and rereview, 2026-09-12

**R2 passes this user-requested rereview.** No remaining blocker was found in
the reviewed R2 correction paths. This is the current agent's review after the
user explicitly requested both correction and another review; it does not claim
that a separate reviewer/model was launched. Release verification is still T7,
and this decision does not approve production migration or deployment.

The completion-order defect is corrected in `server/creation-imports.mjs`.
While holding the existing owner/project transaction lock, completion assigns
`greatest(clock_timestamp(), prior maximum + 1 microsecond)` entirely in SQL.
The next transaction cannot acquire that lock before commit/rollback. Thus
successful completions receive strictly increasing timestamps independent of
BEGIN ordering, timestamp ties, or backward wall-clock changes. Ownership,
immutable-history checks, and real cloud-head conflict detection remain intact.
No schema migration is required for this correction.

Rereview checked the lock lifetime, timestamp precision, scope of the maximum,
rollback behavior, existing version mappings, and preservation of the cloud-head
check. The original failing interleaving remains in the database regression and
now passes. A further test seeds a future timestamp and proves a later completed
import still becomes the selected mapping.

Fresh verification on the corrected working tree:

- `npm test`: 193 passed, 2 environment-gated skips, no failures.
- `npm run test:e2e -- --workers=1 --output=/private/tmp/life-r2-rereview`:
  30 passed, 4 skips. Two are cloud cases run separately below; two are existing
  mobile publish-readiness/debounced-recovery cases. Desktop and mobile selection,
  worker synchronization, binary recovery, circuits, drawing, and workspace tests
  passed. Existing Playwright fallback used; no new frontend changes in this fix.
- `R2_BROWSER_TESTS=1 node --env-file=.claude/.env.local scripts/run-postgres-lifecycle.mjs`:
  disposable PostgreSQL lifecycle 1 passed, including out-of-order completion,
  clock ordering, concurrent deduplication, ownership, and true cloud conflicts;
  cloud failure/edit/reload/retry browser tests 2 passed, desktop and mobile.
  Temporary database cleanup completed.
- Worker asset build, JavaScript syntax checks, and whitespace checks passed.

Next: **T7 — GPT-5.6 Sol**, complete guest/A/B release verification and the
remaining acceptance matrix, write `docs/release-verification.md`, then stop at
R3. No production changes, commit, push, or announcement were performed here.


## Earlier acceptance decision — 2026-09-12

**R2 remains changes required.** Selection correction passes fresh desktop and
mobile verification. The ordinary duplicate-project scenario is covered by the
preceding submission, but a deterministic real PostgreSQL review regression
exposes a remaining resumability blocker.

### P1 — import completion ordering can permanently reject a valid retry

`server/creation-imports.mjs:136` chooses the prior completed mapping by
`completed_at DESC`, while completion writes `completed_at=now()`. PostgreSQL's
transaction timestamp reflects transaction start, not completion order. The
owner/project advisory lock serializes the writes but does not fix that ordering.

Reproduced in `server/postgres-lifecycle.integration.test.mjs:116`: begin an
import containing version 4, hold it after BEGIN, complete another import of
versions 1–3, then release the first transaction. Both complete successfully.
The next import of the complete four-version history chooses the three-version
mapping and throws `IMPORT_CONFLICT` at `server/creation-imports.mjs:144`, falsely
claiming newer cloud edits. Repeated attempts cannot reconcile automatically.

**Sol correction:** make the authoritative project mapping reflect serialized
completion order (for example, a mapping row advanced under the existing lock,
or a reliable completion sequence). Preserve immutable history, owner isolation,
and actual cloud-head conflict detection. Keep the deterministic regression and
make the full disposable lifecycle and cloud browser retry tests pass.

Fresh checks on 2026-09-12:

- `npm test`: 193 passed, 2 environment-gated skips, no failures.
- Selection browser test: 2 passed (desktop 1440×900, mobile iPhone 13 Chromium),
  using the existing Playwright fallback; artifacts in
  `/private/tmp/life-r2-review-selection`. No page errors in those journeys.
- Disposable PostgreSQL lifecycle with the new completion-order regression:
  failed at the follow-up completion with `IMPORT_CONFLICT`; the temporary
  database cleanup completed. The regression retains real transactions and
  controls interleaving by pausing one client immediately after BEGIN.
- No fresh full browser run or production verification is claimed in this review.
- Only the regression test and review/status documents changed in this review;
  no application fix, production migration, deployment, commit, or push.

Next implementation owner: **GPT-5.6 Sol** for this bounded correction. After R2
passes, **T7 is also GPT-5.6 Sol**: complete guest/A/B and mobile release
verification, producing `docs/release-verification.md`, then stop at R3.


## Final two blocker corrections — 2026-09-11

The two findings below are corrected in the working tree. This is a correction
submission, not an independent R2 acceptance or release approval.

- `server/creation-imports.mjs` now serializes completion by owner/local project,
  reuses the prior cloud creation, preserves existing immutable version IDs, and
  appends newer history atomically. Concurrent retries cannot allocate duplicate
  projects. Prior manifest history must remain intact. A newer cloud version or
  deleted/archived target produces a conflict and retains local work.
- `src/app.js`, `index.html`, and `src/styles.css` now render a shaded, outlined
  selection while dragging and afterward. Touch-accessible commands copy/paste,
  move by one cell, rotate, reflect, and deselect. Keyboard shortcuts use the same
  commands. Selection edits retain the rectangle, record undo history, reset the
  authored start, and reload the worker. Moves/rotations cannot crop at edges;
  opening/replacing boards clears stale selections.
- Help and API documentation describe the actual controls and reconciliation.

Verification:

- Unit suite: 193 passed, 2 environment-gated skips, no failures.
- Full local desktop/mobile browser suite: 30 passed, 4 skips (two cloud cases
  executed separately; two pre-existing mobile cases).
- Final asymmetric selection regression: 2 passed. Rotation and reflection
  change cell coordinates; move/copy/paste preserve population, Undo/Redo
  restores the transformed board, and Step evolves that edited state.
- Disposable PostgreSQL cloud browser failure/save/reload/retry test: 2 passed,
  including the unchanged assertion counting all private and public projects.
- Expanded real PostgreSQL lifecycle: 1 passed. Concurrent changed-revision
  retries reuse one project and three versions, preserve original version IDs,
  isolate owners, reject cross-owner import access, and reject a newer cloud head.
  The disposable database was cleaned up.
- Worker asset build, JavaScript syntax checks, and `git diff --check` passed.
- Screenshots inspected: `/private/tmp/life-selection-desktop-chromium.png` and
  `/private/tmp/life-selection-mobile-chromium.png`. Selection browser coverage
  lives in `tests/browser/selection.spec.js`; full run artifacts are under
  `/private/tmp/life-r2-final-suite`.
- Browser plugin skill was read, but its required JavaScript execution tool is
  unavailable in this session. Existing Playwright tests provided verification.

No production migration, deployment, commit, push, or announcement was performed.
T7 still follows independent R2 rereview under the implementation handoff.


## Historical acceptance decision — Astra, 2026-09-10

**R2 is not accepted.** The six most recent corrections do not establish the
broader accepted product requirements. This review made no application changes;
it strengthened a regression assertion and reran the disposable database journey.

1. **P1: import retry duplicates the project after a local save.** Reproduce:
   complete guest upload, fail the activation refresh, save locally, reload.
   `src/community-repository.js:1109` rotates the import key on save;
   `src/guest-import.js:40` starts another import without reconciling the durable
   project mapping. `server/creation-imports.mjs:133` creates a new project for
   that import. The browser receives two projects: the stale private import and
   the newer public project. This violates the accepted requirement to resume
   after partial failure without duplicates. Preserve one owner-scoped cloud
   project identity while reconciling newer local versions; do not discard edits
   or bypass ownership checks. Keep the strengthened all-project assertion in
   `tests/browser/r2-cloud.spec.js:63` and make it pass on both viewports.
2. **P2: selection mechanics and mobile controls remain incomplete.**
   `src/app.js:3945` records a selection, but there is no selection rendering
   path. Copy/paste and selection rotation exist only in the keyboard handler
   at `src/app.js:4291`; no selection move/reflection command or touch buttons
   are wired in `index.html:150`. Stamp Flip is a separate operation. The accepted
   Studio scope requires visible selection, moving, reflection, and usable mobile
   equivalents, while `docs/user-help.md:25` already claims those capabilities.
   Complete those controls and verify select/move/copy/paste/rotate/reflect,
   Undo/Redo, and Step after edits through desktop and touch interactions.

Fresh verification: disposable PostgreSQL lifecycle passed (1 test); the
strengthened cloud browser regression failed on both desktop and mobile,
expected 1 project, received 2. The earlier 2 passing cloud tests counted only
public copies and did not establish project deduplication. Failure screenshots
and traces are in `/private/tmp/life-r2-cloud-artifacts`. No full browser/unit
rerun or visual acceptance is claimed in this review. T7 remains pending R2;
deployment remains held. These two findings are sufficient to reject acceptance.

Reviewed 2026-09-09 against the R1 contracts and current implementation. R2 is
not approved. Earlier completion labels describe implementation submissions,
not verified acceptance. No application changes were made during this review.

## Required corrections

1. **Sol: make guest cleanup atomic across tabs.** In
   `src/community-repository.js:1328`, cleanup checks the in-memory project and
   persists removal before opening IndexedDB. The subsequent transaction does
   not read the current project or compare its digest/revision. Its retained
   branch writes the old captured snapshot. Move authoritative project writes,
   comparison, mapping, and conditional deletion into IndexedDB transactions.
   Prove two-tab edits and transaction abort preserve newer work.
2. **Terra: save the authored start with full board geometry.**
   `src/app.js:2425` reads live cells, serializes normalized pattern RLE and
   sends the full board dimensions. This loses placement and disagrees with
   strict cloud validation. Recovery uses the same normalized RLE path at
   `src/app.js:1068`. Use owned authored snapshots and full-board serialization;
   use binary local recovery. Wire an explicit promote-current-state command.
   Test glider/run/pause/save/reload/reset and a dense board above 200,000 cells.
3. **Sol: remap the active editor after guest claim.**
   `activateCloudCommunity` switches repositories without consuming
   `migration.creationMap`; the editor retains its local creation ID and later
   writes that ID to cloud routes. Preserve unsaved work and map active project
   and version references before resuming Publish. Prove this through the actual
   browser and disposable PostgreSQL service.
4. **Sol: repair recovery payload and key presentation.**
   `src/app.js:747` sends `newPassword`; `recoverAccount` on the server requires
   `password`. Also, the rotated key output lives inside account-security, which
   is hidden while signed out. Exercise recovery through the UI, visibly retain
   the new key, and prove old sessions and key are invalidated.
5. **Terra: integrate ordinary playback with the worker.**
   `src/app.js:1622` still uses main-thread `nextGeneration`; only circuit runs
   use worker advance. Wire ordinary Play/Step/cancel/edit/reset to the client
   with stale-result rejection and owned state. Circuit Run currently rebuilds
   before every run, discarding circuit edits; separate rebuilding inputs from
   running the editable board. Test cancelling runs and keeping edited cells.
6. **Sol: finish bounded resumable import behavior.**
   `src/guest-import.js:52` batches only by count, so five 5 MB versions violate
   the server's 20 MB batch limit. Local revision changes retain the import key,
   but the server rejects that key with changed content. Use count-and-byte
   packing and explicit captured-import identities/retry state. Test partial
   upload, edit, retry, and completion without duplicate or lost projects.
7. **Terra/Luna: reconcile UI and documentation with actual behavior.** The
   recorded final renders still differ substantially from accepted concepts:
   text-only pattern cards, oversized top transport, and no meaningful initial
   example. Help claims an explicit promote-state action and general worker
   playback that are not wired. Complete the accepted UI and then correct help,
   status and launch claims from verified behavior. Capture Studio and gallery,
   as well as Playground/account, on desktop and mobile.

## Verification boundary

The previously reported 190 unit and 18 browser passes do not establish these
flows: local browser tests explicitly exercise unavailable cloud accounts;
the import test stubs the cleanup transaction; engine truth tables do not test
editor persistence. Require targeted regression evidence for the above before
R2 rereview. Preserve the original T7 release verification scope and keep
deployment paused. No new production operations or tests are claimed here.

## Correction pass submitted — rereview pending

### Independent rereview: changes still required

The correction submission is not approved. This rereview inspected the actual
application wiring and test changes; it does not claim a new browser or database
run. The previous green test totals do not prove the following paths.

1. **P1 — Worker state is stale after opening/recovering projects and Undo/Redo.**
   `src/app.js:1025`, `1150`, and `2731` replace the displayed board without
   loading it into the worker. The next Play/Step advances the previously loaded
   board and overwrites the selected/recovered/undone state. Centralize board
   replacement and worker synchronization; test each transition followed by Step.
2. **P1 — Guest cleanup still is not atomic across tabs.**
   `src/community-repository.js:1347` reads localStorage, then `1361` writes a
   whole cached state. Another tab can save between those operations. IndexedDB
   never reads or compares the authoritative project inside its transaction;
   ordinary project writes still use localStorage at `1109`. Move authoritative
   project writes and conditional cleanup into the same transactional store.
   The new sequential two-instance test and mocked abort test do not prove this.
3. **P1 — Circuit Run can fail immediately or observe the wrong generation.**
   `src/app.js:2404` starts an asynchronous worker load, then `2409` calls
   advance without awaiting readiness. The client rejects NOT_LOADED. Runs on
   an already advanced board add the full observation count rather than the
   remaining generations. Await readiness and make the target generation explicit;
   verify direct Run, partial playback then Run, repeated Run, and cancellation.
4. **P1 — Large local recovery exceeds localStorage capacity.**
   `src/app.js:1121` stores a base64 byte per cell plus a duplicate RLE string.
   A 2048-square board needs 5,592,408 base64 characters before metadata/RLE,
   exceeding the usual 5 MiB localStorage quota. Use IndexedDB binary snapshots
   and verify recovery with a maximum-size board in a real browser.
5. **P1 — A cloud refresh failure leaves a cloud ID in a local editor.**
   `src/app.js:621` remaps before the awaited load at `622`; on failure `629`
   switches back to the local repository without restoring the identifier.
   Coordinate repository activation and ID remapping, including durable recovery
   and partial multi-project imports. Test a failed refresh and resumed Save.
6. **P2 — Mobile regression coverage was removed to obtain green results.**
   `tests/browser/workspaces.spec.js:42` returns before drawing, stamping,
   rotation, and tool-reset assertions; `71` similarly bypasses mobile drawing.
   Restore the actual touch interactions and prove they work in the available
   board area. The reported 18 passes are not equivalent to the prior coverage.

Full-board authored save serialization, manifest byte packing, recovery payload
field naming, and signed-out replacement-key placement are visible improvements.
They do not resolve the blockers above. R2 and deployment remain held.

The implementation now captures and serializes the authored full board for saves,
uses a binary local-recovery snapshot, provides an explicit **Use as start** action,
and routes ordinary Play/Step work through the simulation worker. Circuit Run keeps
the currently edited experiment board when its inputs have already been loaded.

Guest import now uses the immutable captured project for every request, packs manifest
batches by both 40 entries and 20 MB, rotates a local import key with every local
revision, rereads persisted state before cleanup, commits IndexedDB before changing
local storage, and retains an edit observed during that commit. Cloud activation maps
the active Studio project and version identifiers before a queued Publish resumes.

The recovery request uses the server's `password` field and the replacement key is
shown outside signed-in-only security controls. The first Playground board contains an
editable glider; preset cards render their actual seed previews. Targeted unit/browser
evidence is recorded in the current worktree, but **R2 remains unapproved** until an
independent rereview and the configured PostgreSQL journey have passed.

## Astra correction completion — 2026-09-10

This section supersedes the correction submission above. Astra implemented the
six latest rereview fixes directly and verified the following paths in this
working tree. This closes those six implementation items; it is not a production
deployment approval or a claim that all remaining release checks are complete.

1. **Board and worker synchronization:** board replacement loads the worker,
   including project open, recovery, Undo and Redo. Drawing completion and pause
   invalidate stale work. Browser tests follow recovered/opened/undone/redone
   boards with Step and check the resulting population.
2. **Transactional guest storage:** IndexedDB is now authoritative for browser
   projects. Ordinary edits, revision comparisons, conditional import deletion,
   and cloud mappings share read/write transactions. Legacy localStorage is
   migrated after a successful transaction. Real two-tab tests preserve newer
   edits, retain concurrent history writes, roll back an aborted mapping, and
   remove an unchanged imported project while retaining its cloud mapping.
3. **Circuit readiness and observation:** Run awaits the current worker load
   and advances only to the absolute observation generation. Tests cover direct
   Run, repeated Run, Step then Run, an edited empty board, and reset cancellation.
4. **Large recovery:** IndexedDB stores an owned binary authored snapshot with
   no duplicate RLE/base64 payload. Browser tests recover a fully populated
   2048×2048 board, Step it, and Reset it on desktop and mobile. Legacy recovery
   remains readable; browser storage availability still applies.
5. **Cloud activation:** local cleanup is deferred until cloud state loads;
   identifiers remap only on successful activation. Unsaved metadata survives
   rerenders. An existing-session retry resumes queued Publish. The disposable
   PostgreSQL browser test injects a post-import refresh failure, saves locally,
   reloads, and verifies the resumed public project uses a cloud identifier.
6. **Mobile interactions:** restored real touch drawing, stamping, rotation,
   and tool-reset assertions. The test locates an unobstructed canvas point
   instead of returning early on mobile.

### Verification performed

- `npm test`: 193 passed, 2 environment-dependent skips, 0 failures.
- Full local Playwright suite: 28 passed, 4 skipped. Two skips are the cloud
  tests run separately below; two are pre-existing mobile cases. The new R2
  suite runs all five scenarios on both desktop and mobile without skips.
- Final real-IndexedDB cleanup assertions: 2 passed, desktop and mobile.
- `R2_BROWSER_TESTS=1 node --env-file=.claude/.env.local scripts/run-postgres-lifecycle.mjs`:
  disposable PostgreSQL lifecycle passed, then both cloud failure/retry browser
  tests passed. The temporary database was cleaned up. The final existing-session
  resume correction was verified by this run after the full local browser run.
- `npm run build:worker`, JavaScript syntax checks, and `git diff --check` passed.

Regression sources: `tests/browser/r2-regressions.spec.js`,
`tests/browser/r2-cloud.spec.js`, and `tests/browser/workspaces.spec.js`.
The cloud test proves one public project after retry; it does not assert that
editing between import attempts cannot leave an additional private import.
Broader integrated acceptance, T7 release verification, production migration,
deployment, and announcement remain pending. No production changes were made
by this correction pass.
