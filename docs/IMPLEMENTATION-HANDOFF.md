# Life Lab implementation handoff

Prepared 2026-09-08. This is the execution entry point for the accepted launch.
Task assignments below are planned model ownership, not agents already running.
The user requested a handoff and paused coding; do not start implementation until
the user tells the coding model to begin. No application code changed in this
handoff step.

## Read first

1. `CLAUDE.md` and applicable `AGENTS.md` instructions.
2. `docs/launch-product-spec.md`: accepted product and acceptance journey.
3. This handoff: current implementation state, order, ownership, and review gates.
4. `docs/launch-discovery.md` for decision history only. Its final “no
   implementation change” paragraph describes the discovery phase, not today's
   checkout. This handoff supersedes that paragraph as a progress report.
5. Relevant skills for the assigned task. Apply current skill instructions;
   do not assume a previous agent's unavailable browser tools are available.

Use vanilla ES modules, Canvas, Better Auth, PostgreSQL, and Cloudflare Workers
with Hyperdrive. Next/React dependencies exist but a framework migration is not
part of this release. Supabase/Vercel material is historical unless a file is
still part of a compatibility test. Do not reopen the settled product interview.

## Product boundaries

Audience: curious beginners and builders experimenting with motion, logic, and
art. One coherent journey: Playground → Studio → publish → Community → remix.

- Guests edit, run, save locally, and try remixes without an account.
- One real account flow preserves work and resumes the interrupted action.
- Try opens an isolated experiment; Add to board stamps; Remix creates a private
  attributed copy. Navigation preserves the active project.
- Editor supports selection/move/copy/paste/rotate/flip, undo/redo, authored-start
  reset, pan/zoom, meaningful previews, and usable mobile controls.
- Public browsing, public creation/profile links, favorites, comments, and remix
  lineage must work with durable data and correct ownership checks.
- Showcase real Conway gates and a binary half-adder. A full programmable CPU,
  full calculator, and HashLife implementation are not launch requirements.
- Larger boards need measured performance and responsive controls, not an
  unsupported promise of unlimited simulation.
- Account recovery/deletion, reporting/removal, input limits, operational
  recovery, and useful sharing metadata belong to launch readiness.

## Checkout safety and evidence

Repository: https://github.com/10zinglunn-afk/conways-game-explorer

Current inspected HEAD: `43e7563` (`feat: enable password account authentication`).
Discovery found main nine commits ahead of tracked origin/main; that is a
historical local tracking comparison, not a freshly fetched remote status.
Live URL: https://conways-game-explorer.10zinglunn.workers.dev

The working tree was already dirty before this effort. Preserve all existing
changes. Do not reset, clean, or reconstruct from HEAD. Before implementation,
record `git status --short` and `git diff --stat`; inspect affected files before
editing. Do not stage secrets or assume untracked files are disposable.

Existing pre-effort changes include app/UI/repository code, package files,
project documentation, browser tests, and migration `0002_publish_readiness.sql`.
The additional unfinished work from this effort is listed below. No migration,
new deployment, commit, push, or LinkedIn post was performed during this effort.

### Implementation inventory

| Area | Existing work | Evidence and remaining gap |
| --- | --- | --- |
| Product/design | Accepted specification and three PNG concepts under `docs/design/` | Concepts exist; design-system/component inventory and rendered comparisons do not |
| Engine | `src/life.js`: reusable buffers, halo neighbors, active tiles via `createLifeStepper` | 12 engine tests passed in the preceding implementation session, including reference comparisons and boundary crossing; rerun on current checkout |
| Worker | `src/simulation-worker.js`: chunked advance, epoch/request IDs, transferred snapshots | Not connected to UI or verified in browser; cancellation and stale-result behavior need tests |
| Board tools | `src/board-tools.js` and its test file: RLE roundtrip, stamping, transforms, bounded history | Tests were written but not run; move/copy/paste UI is not implemented |
| Board limits/RLE | Limits changed toward 2048; parser has size/rule/run checks and optional origin preservation; settings tests now cover valid 2000 and clamping above 2048 | Parser termination/overflow and server validation incomplete; local, private-cloud and public limits must follow the reviewed contract |
| Public snapshots | `0003_public_lab.sql`, repository snapshot fields/reads, `server/public-community.mjs` | Unapplied, unverified; SQL NULL/type checks and version ownership need review |
| API | Anonymous public routes, comments, favorites, reports, recovery endpoints added | New routes lack complete lifecycle tests; local origin conversion may reject legitimate writes |
| Identity/import | Creation loads profile from DB; import key dedupe and unique creation slugs added | Full guest version import/resume and stable profile usernames not finished |
| Account lifecycle | `server/account-security.mjs`; Better Auth deletion enabled | Recovery keys are a proposed implementation, not a completed verified flow; UI, concurrency, limits cleanup, deletion behavior need work |
| Frontend | Existing `src/app.js`, `src/styles.css`, `index.html` plus prior edits | Coordinated redesign and integration have not been implemented |
| Release | Existing Worker URL and migration/build scripts | Wrangler native dependency previously failed; current build, real DB journey, deployment and live QA pending |

Historical baseline: `npm test` reported 160 total, 159 passed, one legacy
Supabase live test skipped. This predates the unfinished changes above. Do not
report the current suite as passing based on that result.

Read-only DB audit during discovery: only `0001` applied, zero users/profiles/
creations/publications. Recheck before migrations; the database may have changed.
`.claude/.env.local` contains DATABASE_URL. Never print its contents or secrets.

## Model assignments and order

Default to one coding agent at a time to reduce coordination and repeated
context. Model names below are assignments, not claims about current pricing.
Use medium reasoning initially; escalate a specific unresolved problem to Astra
instead of repeatedly retrying or raising effort for the entire project.

| ID | Task | Assigned model | Depends on | Completion status |
| --- | --- | --- | --- | --- |
| T0 | Validate starting state and record integration contracts | GPT-5.6 Sol | Handoff accepted/start requested | Not started |
| T1 | Complete simulation and editing primitives | GPT-5.6 Terra | T0, review R1 | Partial code exists |
| T2 | Complete durable public data and account lifecycle | GPT-5.6 Sol | T0, review R1 | Partial code exists |
| T3 | Package and verify authentic circuit experiments | GPT-5.6 Terra | T1 | Research only |
| T4 | Implement shared shell, Playground, and Studio | GPT-5.6 Terra | T1, T3, T2 contracts | Not started |
| T5 | Integrate accounts, playable Community, and public pages | GPT-5.6 Sol | T2, T4 | Not started |
| T6 | Write user help, credits, operational docs, and launch draft | GPT-5.6 Luna | T3, T5 | Not started |
| T7 | Verify and fix complete guest/two-user/mobile journeys | GPT-5.6 Sol | T4–T6, review R2 | Not started |
| T8 | Migrate, deploy, verify live, commit and push | GPT-5.6 Sol | T7, review R3 | Not started |
| T9 | Publish accurate LinkedIn announcement | GPT-5.6 Sol | T8, review R4 | Access unresolved |

Recommended sequence: T0 → R1 → T1 → T2 → T3 → T4 → T5 → T6 → R2 →
T7 → R3 → T8 → R4 → T9. If explicitly choosing parallel agents later, only
T1/T2 are initially independent. Give them exclusive file ownership and agreed
contracts; both must not edit `src/community.js` or settings limits concurrently.
Do not run multiple agents on `src/app.js`, shared CSS, or migration files.

## Task instructions and acceptance

### T0 — Sol: baseline and contracts

Read current diffs, run the current unit suite, and record failures without
silently treating pre-existing failures as acceptable. Create
`docs/implementation-status.md` with task status, validation results, and the
next task. Document contracts in `docs/integration-contracts.md`:

- Board snapshot ownership, epoch/request cancellation, authored start versus
  evolving state, worker errors, dimensions, history memory budget.
- Project/version/settings representation and serialization limits.
- API request/response/error shapes, pagination, guest import mapping/retries,
  public snapshot semantics, stable slugs, and ownership enforcement.
- UI boundaries and navigation state preservation; decide incremental modules
  versus replacing the existing shell after inspecting its behavior.
- Recovery-key experience and consequences when a key is lost; do not invent
  email delivery when no provider is configured.

Keep this bounded to resolving implementation contracts and baseline evidence.
Do not redesign product scope. Stop at R1 with a concrete contract document and
the unresolved decisions, if any.

### T1 — Terra: simulation and board primitives

Primary files: `src/life.js`, `src/life.test.js`, `src/simulation-worker.js`,
`src/board-tools.js`, its tests, `src/patterns.js`, pattern tests, and
`src/design-settings.js`/tests. Coordinate shared publish limits with T2.

Complete strict B3/S23 RLE validation including malformed/truncated input,
headers, run/coordinate overflow, supported dimensions and population limits.
Roundtrip preserves board dimensions and absolute placement. Ensure sparse
optimization matches the reference engine for bounded/wrapped, tiny, random,
and edge-crossing boards. Verify history limits across undo and redo and
transform behavior for selections containing empty margins and board edges.

Implement a testable worker client with load/advance/cancel/error behavior;
discard stale results after edits, resets, project changes, or newer requests.
Never transfer away the only retained authored snapshot. Measure simulation
separately from render/UI costs at 300×200, 600², 1200², 2048² on sparse/dense
bounded/wrapped boards. Record hardware, method, medians, and limits in
`docs/simulation-performance.md`; do not promise a constant frame rate.

Done: engine and serialization tests pass; worker integration tests prove
reset/edit cancellation; no unbounded main-thread catch-up; documented API is
ready for T4. Final UI responsiveness is verified by T7.

### T2 — Sol: data, accounts, and public API

Primary files: `server/`, migrations, local/cloud repository modules and their
tests, relevant `src/community.js` contract/validation, Node/Worker routing.

Finish and test:

- A fresh authenticated request can create without an in-memory profile cache.
- Saving private edits leaves public metadata, version, preview and link intact;
  explicit publish updates them atomically. Restore/unpublish/archive/moderate
  have consistent behavior and never expose drafts.
- Fix `0003` constraint NULL/type loopholes and enforce published-version
  ownership. Test migrations against a disposable database/schema with public
  and private fixtures. Review the existing `0002` before relying on it.
- Validate actual RLE on every save/import, not just declared dimensions.
- Fix origin handling in the Node request adapter while preserving same-origin
  protection; inspect the actual adapter location rather than assuming it.
- Stable unique profile usernames and global creation URLs, privacy-safe public
  reads, durable favorites/comments/reporting with ownership and abuse limits.
- Import every guest version/settings/source relationship with stable IDs;
  retry after partial failures without duplication; preserve local data until
  confirmed imported. Define conflict behavior explicitly.
- Recovery-key generation/rotation/reuse rejection, password reset and session
  revocation; password-authenticated deletion and resulting content policy.
  Check Better Auth behavior against current official docs. Rate limits must
  include bounded retention/cleanup and appropriate account attack controls.

Done: real PostgreSQL tests exercise guest import, concurrent updates, public
snapshot isolation, two-user authorization, recovery/deletion and migrations.
Mock-only tests do not establish this. Keep production migration for T8.
Provide the final API contract to T4/T5.

### T3 — Terra: authentic circuits

Create a dedicated circuit module and engine truth-table tests. Use the research
recipe in `docs/circuit-research-handoff.md`. Retrieve source coordinates from
the linked upstream and establish appropriate reuse terms/attribution before
bundling; temporary files are research evidence, not a licensed asset package.

Inputs must initialize real cells. Output probes must read evolved cells.
Provide AND, OR, NOT and a binary half-adder with settling timing, visible ports,
finite-signal explanation, reset/rebuild, and editable starting state. Avoid
advertising an XOR demo unless it is independently implemented and verified.

Done: all input combinations pass against the shipped engine, with tests for
probe timing and reset. No hardcoded boolean output masquerades as simulation.
Circuit schema and instructions are ready for T4; credits ready for T6.

### T4 — Terra: shell, Playground, Studio

Primary files: frontend entry/shell, app modules and CSS, editor interaction,
pattern library, relevant browser tests. Read the frontend builder/testing
skills. Start with `docs/design/design-system.md`: component inventory, tokens,
responsive adaptations, interaction states, and mapping to existing concepts.

Concepts: `docs/design/playground-concept.png`, `studio-concept.png`, and
`community-concept.png`. Direction: charcoal background, restrained lime/teal,
board-dominant editor, shared header, visual pattern rail and compact transport.
Generated pattern geometry/text is illustrative; use real Life data and accurate
credits. Document intentional changes. Complete account/detail design using the
same system and the applicable skill workflow.

Implement direct editable first visit, optional rules, replayable intro; clear
Playground/Studio/Community navigation; project browser and local recovery;
Try/Add/Remix; selection, move/copy/paste/transforms, undo/redo, reset-to-start;
worker playback/run-until-output; settings/art appearance, pan/zoom/fit and
mobile alternatives to keyboard shortcuts. Preserve projects across navigation.

Done: guest can create/edit/save/reload/reset a real project, use verified
circuits, and browse without losing work. Capture desktop/mobile screenshots
and compare against concepts. No placeholder controls or fabricated previews.

### T5 — Sol: accounts and Community integration

Use T4 shared components and T2 contracts. Integrate one contextual account
dialog with real validation, errors, recovery-key handling, and deletion.
Resume attempted save/publish/favorite/comment after login exactly once.

Implement searchable playable preset/public gallery, Favorites, public creation
detail and creator pages, durable comments, reporting, attributed remixes,
publish preview/readiness/version history, unpublish and explicit republish.
Public `/c/<slug>` and creator routes must work on direct request/reload and
produce useful HTML social metadata through Node and Worker routing. Private
drafts cannot appear in public HTML, APIs, metadata, or previews.

Done: guest → A import/publish → signed-out public URL → B favorite/remix/
publish works and survives refresh. Account and publish states preserve the
editor. Loading/empty/error/unavailable states are actionable and accessible.

### T6 — Luna: help, credits, operations and launch draft

Own documentation and agreed user-facing help text; avoid editing shared app
modules while another task owns them. Write concise Conway rules (birth on
three neighbors; survival on two or three; all updates simultaneous), controls,
storage/account/recovery explanations, measured size limits, circuit credits,
privacy/community terms consistent with actual behavior, and moderation/backup/
restore/deletion operations. Do not invent a legal entity, support address,
retention promise, email capability, or license.

Prepare `docs/linkedin-launch-post.md` containing the verified URL, audience,
what shipped, brief rules, art/motion/logic/remix uses and an accurate screenshot
proposal. Mark any unverified feature pending. Done: text matches implementation
and flags only concrete missing facts for Sol/Astra to resolve.

### T7 — Sol: integrated verification and fixes

Run current `npm test`, `npm run build:worker`, and `npm run test:e2e` (see
`playwright.config.js`; it starts a local server when no external base URL is
provided). Use a disposable real PostgreSQL test environment for stateful tests.
If a tool is unavailable, follow the testing skill's permitted fallback and
report the actual environment. Do not claim browser or database verification
from static inspection.

Exercise guest/A/B acceptance, failures and reloads, private access denial,
published snapshots during private edits, interrupted import, recovery/deletion,
comments/reporting, favorites, direct links and sharing metadata. Verify desktop
and mobile, keyboard/focus/dialog behavior, no overflow, real previews, empty
states, and cancellation during large simulations. Update historical browser
tests to accepted behavior; do not remove meaningful assertions to get green.

Done: `docs/release-verification.md` contains commands/results, environment,
screenshots, performance evidence, known limitations, and resolved defects.
No unverified launch blocker is waived silently. Stop at R3.

### T8 — Sol: release execution

Read Workers/wrangler skills and current platform guidance. Repair the previously
failing Wrangler native dependency, verify config/bindings/secret presence
without printing values, and prepare a concrete database backup/restore and
Worker rollback procedure before mutation. Recheck current production data.

After R3, execute reviewed migrations `0002`/`0003` in order with the migration
runner, deploy through `npm run deploy:worker`, verify signed-out routes/auth
and the real publishing/remixing journey on the deployed environment using
clearly identified test fixtures. Clean up those fixtures appropriately.
Preserve all authorized existing work when committing/pushing; inspect staged
diff for secrets, temporary assets and unrelated changes. Record migration IDs,
commit and Worker version, live test evidence and rollback reference.

Done: live app and repository are published and verified. Stop at R4 before
announcing. Existing authorization covers deployment/push; normal tool approval
controls still apply. Review gates are quality checks, not repeated blanket
requests for publication permission.

### T9 — Sol: LinkedIn publication

Apply R4 corrections to the prepared announcement. The user authorized posting,
but no LinkedIn connector/authenticated posting surface was found previously.
Discover current available access. If absent, provide the completed post and
ask for the required connection/posting identity; do not claim publication or
use an unrelated messaging connector. If a supported authorized surface exists,
post once to the established identity and verify the resulting post URL. Record
the URL in release status. No claim of shipped CPU/calculator capability.

## Astra review gates and notification procedure

Astra is the reviewer, not the default implementation coordinator. A coding
model must update `docs/implementation-status.md` when it completes each task.
At a gate it must stop dependent work and end its response with an explicit
notification using the template below. Never mark a gate passed on Astra's
behalf. Independent authorized work may continue only if it does not depend on
the decision under review.

| Gate | Trigger | Astra reviews | Required outcome |
| --- | --- | --- | --- |
| R1 | T0 complete | Baseline gaps, contracts, state ownership, guest import, public snapshots, recovery approach, module boundaries | Contracts accepted or concrete corrections before T1/T2 |
| R2 | T1–T6 integrated | Actual desktop/mobile experience and product acceptance; inspect high-risk engine/auth/data changes and evidence | Specific fix list for T7; no broad redesign without reason |
| R3 | T7 complete | Test evidence, real DB isolation/lifecycle, migrations/backup/rollback, known limits, release diff | Release ready or explicit blockers before production changes |
| R4 | T8 live verified | Live URLs/evidence, actual capabilities versus LinkedIn copy, posting identity/access | Accurate announcement ready to publish |

Also escalate early if a contract must change across tasks, security/data-loss
tests fail without a clear fix, a migration has unexpected production effects,
or an implementation requires dropping an accepted requirement. Bring a concise
diagnosis and a proposed solution; do not ask Astra to redo the entire task.

Required notification:

> **Astra review needed — R[number]: [name].** Completed: [task IDs].
> Evidence: [links to status, diff/commit, tests and screenshots].
> Decisions/blockers: [specific list or none].
> Paused: [dependent task]. Please switch to Astra and ask it to review this gate.

The plan cannot send background/push notifications or automatically switch the
user's model. Notifications are emitted by the active coding agent in the
conversation when it reaches a gate. If the user starts a new chat, include the
bootstrap below so this procedure carries forward. No background monitor is
configured by this document.

## Copy-paste bootstrap for the first coding session

```text
Use GPT-5.6 Sol for task T0 in docs/IMPLEMENTATION-HANDOFF.md.
Read the handoff, accepted product spec, and repository instructions first.
Preserve the dirty checkout. Implement only the currently assigned task; do not
restart discovery or migrate/deploy. Record evidence and progress in
docs/implementation-status.md. At review R1, stop dependent work and explicitly
notify me “Astra review needed — R1” with links to the review packet.
```

For later tasks, substitute the task/model from the table and read status first.
When switching models, pass task ID, changed files, decisions, test results and
next gate rather than the entire conversation. If assigning subagents, give
each the same handoff plus its exclusive task/file scope. Use subagents only
when explicitly authorized and beneficial; this handoff does not launch them.
