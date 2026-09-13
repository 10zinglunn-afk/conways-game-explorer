# Life Lab integration contracts

Status: R1 approved by Astra on 2026-09-08 after the corrections recorded below.
T1 and T2 may proceed; later review gates remain in force.

This document fixes the boundaries shared by the simulation, editor, storage,
account, API and UI tasks. It describes the target launch contract. Where the
current checkout differs, the gap is called out explicitly. Product scope comes
from `launch-product-spec.md` and is not reopened here.

## Contract principles

1. An owned snapshot never changes after it crosses a module boundary.
2. A project version is immutable. Draft metadata and the current-version
   pointer can change; a published snapshot changes only through Publish.
3. Guests own useful device-local projects. Authentication adds cloud and
   shared actions without changing the editor model.
4. Public reads are projections of an explicit published snapshot and contain
   no private account or draft data.
5. Workspace navigation changes what is visible, not the contents of another
   workspace's session.
6. API errors retain HTTP status and structured validation details through the
   browser repository so the UI can offer a specific recovery action.

## Board and simulation

### Owned `BoardSnapshot`

```js
{
  width: integer,
  height: integer,
  generation: nonNegativeInteger,
  population: nonNegativeInteger,
  cells: Uint8Array // length === width * height; values 0 or 1
}
```

- A snapshot returned from a worker, repository decoder, history operation or
  `snapshot()` owns its `Uint8Array`. Receivers may retain it indefinitely.
- `createLifeStepper().step()` may return a borrowed buffer valid only until the
  next step. It must not be stored, posted or used as authored state. Call
  `snapshot()` to cross a boundary.
- `population` must equal the number of live cells. If an older caller omits it,
  the receiving boundary computes it once; contradictory values are rejected or
  corrected before persistence.
- Conway B3/S23 is the only launch rule. `wrapping` is a simulation setting:
  `true` means a torus and `false` means bounded dead space.

### Dimensions and payload limits

- Persisted/imported boards: 1–2048 cells on each axis.
- New custom boards in the UI: 40–2048 cells on each axis. Smaller valid imports
  remain their declared size and can be enlarged in the editor.
- Local board recovery stores the owned binary cell snapshot, not expanded
  coordinate arrays or RLE. It supports every valid 2048×2048 board, including
  populations above the public limit, subject to actual browser storage quota.
- Local RLE import/export accepts up to 5,000,000 UTF-8 bytes and up to the full
  4,194,304-cell board. Parsing must not materialize millions of `[x, y]` arrays
  before building the board. Invalid headers, rules, runs, bounds and missing
  `!` termination are rejected.
- Private cloud versions accept at most 5,000,000 UTF-8 bytes each. Payloads
  above the per-request limit use bounded upload chunks. Guest-history upload
  batches contain at most 40 versions and 20 MiB of encoded version data; these
  are batch limits, not limits on a project's complete version history.
- Public publication is intentionally stricter: its selected immutable version
  must encode within 200,000 UTF-8 bytes and contain at most 200,000 live cells.
  A larger project remains editable and locally/cloud saved, while Publish
  explains the public limit and offers an RLE export.
- Board RLE serialization preserves full board dimensions and absolute cell
  placement, including empty top/left/right/bottom margins. Pattern/stamp RLE
  may normalize to its live-cell bounds and is a separate operation.
- The 2048 axis limit is a validity limit, not a real-time performance promise.
  The UI presents measured guidance from T1 and keeps interaction responsive by
  using the worker and bounded update cadence.

The current settings test uses an input of 2000, which is valid and must remain
2000. A separate input above 2048 verifies clamping to 2048. T1 and T2 must use
one exported/shared limit definition or contract tests so editor validity,
private upload limits and public publication limits cannot drift again.

### Authored, working and live state

Each editable session owns three explicit snapshots:

- `authoredStart`: the deliberate starting arrangement. Reset always restores
  an owned clone of this snapshot, including its settings.
- `working`: the current editable arrangement when paused. A completed edit
  replaces `working`, records history and also becomes the next simulation load.
- `live`: the newest accepted worker result. Playback changes `live` only; it
  does not mutate `authoredStart` or create undo entries.

Completed authoring commands while at the authored state—draw, erase, stamp,
paste, transform, resize, import, undo and redo—replace `authoredStart` and set
its generation to zero. Play and Step advance the current `working` board.
After an edit or Reset that board equals the authored start; after pausing at
generation 40, Play resumes from 40 and Step advances to 41. Neither command
implicitly resets. Pausing adopts the latest accepted `live` as the visible
`working` state, while `authoredStart` remains unchanged. Cancel any in-flight
operation and reload that accepted board before resuming if the worker has
advanced beyond it, so no unseen generations are skipped.

Save always persists `authoredStart`; saving by itself never promotes an evolved
frame. Reset cancels work and restores it. “Use current state as start” is the
explicit command that copies the visible evolved cells to `authoredStart`, sets
generation to zero, records one undo entry and marks the project dirty. Editing
an evolved paused frame first performs that promotion, then applies the edit as
the same undoable authoring transaction. Opening/restoring a saved version sets
all three from that version's cells, normalizing its replay start to generation
zero. Publishing snapshots the already-saved current version.

Example: draw a glider → run to generation 40 → pause → Save. The saved version
and Reset target remain the drawn glider at generation zero. Choosing “Use
current state as start” before Save instead stores the generation-40 cell layout
as a new generation-zero starting arrangement.

### Worker protocol and cancellation

Messages use a session `epoch` and per-operation `requestId`:

```js
// main → worker
{ type: 'load', epoch, board: BoardSnapshot, wrapping }
{ type: 'advance', epoch, requestId, count }
{ type: 'cancel', epoch, requestId? }

// worker → main
{ type: 'ready', epoch }
{ type: 'snapshot', epoch, requestId, completed, done, board: BoardSnapshot }
{ type: 'error', epoch, requestId?, code, message }
```

- `epoch` increases after edit, reset, resize, wrapping change, project/session
  change, or worker restart. Only messages matching the active epoch and active
  request are accepted.
- A newer `advance` cancels the prior operation. `cancel` is acknowledged by no
  further accepted snapshots for that request. Stale transferred buffers may
  arrive and are discarded.
- Work is chunked to a bounded time budget. Intermediate snapshots are throttled
  and final completion is explicit. The UI never runs an unbounded catch-up loop
  on the main thread.
- Worker exceptions and invalid messages become `error`; the client pauses,
  retains the last owned snapshot and offers retry. Restart reloads an owned
  snapshot rather than transferring the only copy.

The existing worker implements only `load`, `advance` and snapshots; it does not
yet expose ready/error/cancel or a client wrapper. T1 owns that gap.

### Undo, redo and clipboard

- One history record is made per completed user gesture/command, never per
  pointer event or simulation generation. Undo/redo are available only while
  paused and contain owned board snapshots plus the selection required to render
  the result coherently.
- The default **combined** undo+redo cell-buffer budget is 24 MiB with at most 40
  entries total. Adding an entry evicts the oldest non-current history until both
  limits hold. Current board, authored start and clipboard are outside this
  history budget and remain separately bounded by board/RLE limits.
- A new edit after undo clears redo. Reset and resize are undoable commands.
  Opening another project clears session history.
- Clipboard coordinates are normalized inside an explicit rectangular selection
  so empty margins, anchor and transformed dimensions survive copy/rotate/flip.
  Paste is previewed, clipped only on commit at board edges and creates one entry.

The current history implementation applies 24 MiB independently to each stack,
and current selection transforms discard empty margins. T1 must align both.

## Projects, versions and settings

### Canonical project shape

The browser and server repository expose camel-case JSON:

```js
{
  id, slug, ownerId, ownerName, ownerUsername,
  title, description, tags, attribution, tutorialReference,
  visibility, moderationStatus,
  previewConfig, publishReadiness,
  currentVersion, versions,
  publishedVersionId,
  remixedFromId, rootCreationId,
  starredByViewer, starCount, cloneCount, viewCount, commentCount,
  createdAt, updatedAt, publishedAt, archivedAt
}
```

Private owner responses may contain all immutable versions. Public responses
contain the published version as `currentVersion`, never private version history,
and may contain public source/remix summaries. They never contain email,
recovery data, session data or another user's private fields.

`starredByViewer` is a boolean. Do not expose a `starredBy` user-ID array publicly.
Local compatibility code may use such an array internally until it is migrated.

### Version shape and immutability

```js
{
  id, creationId, versionNumber, parentVersionId,
  rle, width, height, generation, population, rule,
  settings: DesignSettings,
  createdAt
}
```

- Version rows are append-only. Restore appends a new version whose
  `parentVersionId` is the restored version; it never overwrites history.
- Version numbers increase monotonically within a project and are allocated
  while holding a project-level database lock.
- `currentVersion` is the owner's editable head. Saving a changed board creates
  a version; metadata-only changes do not. The client sends the current version
  ID when saving so the server can reject/resolve stale concurrent heads rather
  than silently overwriting them.
- RLE dimensions, explicit width/height, population and settings dimensions must
  agree after normalization. T2 validates the RLE itself on every cloud write.

### `DesignSettings`

Persist exactly the serialized fields already established by
`src/design-settings.js`: grid preset and dimensions, wrapping, speed, zoom,
camera, six colors, render style, trail intensity and rule. Unknown fields are
dropped at the boundary. The rule normalizes to B3/S23. Simulation speed remains
1–40 generations/second; batch “run until” uses a separate generation target.
Camera/style affect replay presentation but never Conway evolution.

### Metadata and publication

- Mutable draft metadata: title (1–120 for publish), description (20–2000 for
  publish), 1–8 normalized tags of at most 32 characters, attribution, tutorial
  reference and preview configuration. Private drafts may be incomplete.
- `previewConfig` is deterministic version 1 data: camera mode/frame, preview
  grid, live-cell coordinates, colors and alt text. Server publication rebuilds
  or validates it against the version being published.
- Publish atomically sets `visibility=public`, `publishedVersionId` to the
  current immutable version, and copies the public metadata/preview/readiness to
  `publishedMetadata`. `publishedAt` records that publish event.
- Later private saves and metadata edits do not change any public projection.
  Publish again explicitly replaces the public snapshot with the current head
  and current metadata.
- Unpublish/archive clear active public snapshot fields and canonical exposure;
  immutable version rows remain. Archive additionally removes the project from
  the active owner list. Deleting removes the project and its versions.

The draft `0003` and repository approximate this contract but still require
NULL/type-safe constraints, version ownership enforcement and real DB tests.

### Stable URLs and usernames

- Creation `slug` is globally unique, lowercase, generated once and immutable
  across title/owner profile changes. Canonical route: `/c/<slug>`.
- Profile `username` is globally unique, lowercase, 3–40 characters using
  letters, numbers and single hyphens. It is allocated transactionally during
  profile creation and is stable for launch. Canonical route: `/u/<username>`.
- Display name remains editable and does not determine URL identity after the
  initial available username is allocated.
- Direct routes resolve on Node and Worker reloads and receive public social
  metadata generated from the published projection only.

## Guest storage and resumable account claim

### Device-local data

Guests do not have pretend profiles or local email records. Device storage owns:

- a random local installation ID;
- Playground scratch/authored state;
- Studio projects with stable local project ID, stable random `importKey`, all
  immutable local versions, metadata/settings/lineage and active head;
- pending account-gated action, if any, with the smallest replay-safe arguments.

Writes use a schema version and atomic replacement strategy supported by the
chosen browser store. Corrupt records are quarantined/exportable rather than
silently replacing good data. Storage quota errors leave the in-memory project
intact and present export/recovery guidance.

### Import endpoint and retry contract

Claim uses a staged protocol so complete history never has to fit in one request:

1. `POST /api/community/imports` starts or resumes an import with `importKey`,
   `localProjectId`, `capturedRevision`, project metadata, current local version
   ID, total version count and digest of the ordered manifest. Manifest entries
   (local version ID, parent ID, byte length, SHA-256 and settings) are uploaded
   in numbered batches through `PUT /api/community/imports/:importId/manifest/:batch`.
   Identical batch retries succeed; conflicting content returns `409`.
2. `PUT /api/community/imports/:importId/versions/:localVersionId` uploads one
   version in request-sized chunks. Every chunk declares byte offset, total size
   and digest; an identical retry is idempotent and conflicting bytes return
   `409`. The server reports received ranges so interrupted uploads resume.
3. `POST /api/community/imports/:importId/complete` verifies the manifest,
   digests and current version across every batch, then makes the complete
   project/history visible atomically. Validated versions may be staged in
   bounded transactions; a final transaction activates the project only when
   every declared version and parent link is present. Incomplete projects never
   appear in normal reads. Staged records have bounded retention and are safe
   to abandon or retry.

No request exceeds 1,000,000 bytes. One staged version is at most 5,000,000
bytes; each upload batch is at most 40 versions and 20 MiB total. A project may
span multiple batches, including more than 40 versions or 20 MiB overall.
Metadata and lineage are carried in the small start request. Local parent IDs
are mapped consistently across batches and verified before activation. Never
truncate history to fit a batch. If operational storage limits prevent finishing,
return an explicit resumable error, preserve all local history and offer export;
do not mark the claim complete or block unrelated account actions.

Completion is `201` for a new import or `200` for an already completed import:

```js
{
  imported: true,
  existing: boolean,
  creation: Project,
  mapping: { localProjectId, cloudProjectId, versionIds: { [localId]: cloudId } }
}
```

- Unique `(owner_id, import_key)` makes start and completion idempotent. The
  server either activates the complete verified history and lineage or leaves
  the import incomplete; staging rows never appear in owner/public reads.
- The client imports projects serially or with a small bound. It records each
  confirmed mapping and removes only that confirmed local project after the
  returned cloud project is readable. Failure leaves that project untouched.
- Retrying the same key and manifest returns upload status or the original
  mapping and cannot append duplicate versions. A key reused with a different
  manifest, captured revision or content digest returns `409`.
- Local parent version IDs are translated inside the transaction. Public source
  creation IDs are retained only when the source is still public/accessible;
  invalid foreign/local IDs never become arbitrary ownership links.
- The client captures the local project's monotonic revision and content digest
  at import start. It removes local data only after completion is readable **and**
  the current local revision/digest still equals that captured snapshot. If the
  user edited meanwhile, the cloud mapping is retained and the newer local
  revision remains as unsynced work for the next save; it is never deleted.
- Revision/digest comparison, cloud-mapping persistence and conditional local
  record removal happen in one IndexedDB read-write transaction. Every local
  writer, including other tabs, increments the revision in that same store.
  Comparing in memory and deleting later is forbidden. If transactional storage
  is unavailable, retain the local copy; successful upload alone never permits
  unconditional cleanup.
- Guest projects are private, so claim never silently publishes them.

The current `migrateLocalState` sends only each current version, clears all local
state after the loop, and its current `importKey` support does not return version
mappings. It does not meet this contract; T2 owns the endpoint/repository and T5
owns the UI transition.

### Interrupted actions

Account-required actions are `cloud-save`, `publish`, `favorite-creation`,
`favorite-pattern` and `comment`. The UI stores one pending action with
an idempotency token and return route, opens the shared account dialog, completes
profile setup and guest import, then revalidates and executes the action once.
Success clears it; cancellation leaves the project and returns to its route;
failure keeps a visible retry. Comment text may be retained locally but never
submitted twice. The server remains authoritative for duplicate prevention.

Remix is never account-gated. Signed-out visitors immediately receive a complete
device-local private project with the public source/root attribution and open it
in Studio. Sign-in is requested later only for cloud save, publication or other
shared actions; claim then imports that local remix like any other guest project.

## HTTP API

### Response and error envelope

Successful endpoints return the resource shapes stated below. Errors use:

```js
{ error: string, code: string, issues?: [{ field, code, message }], retryAfter?: number }
```

The browser repository throws an error carrying `status`, `code`, `issues` and
`retryAfter`. Expected statuses: `400` malformed request, `401` authentication,
`403` ownership/origin, `404` unavailable resource, `409` stale/conflict,
`413` payload too large, `422` validation, `429` rate limit, `500` unexpected,
`503` backend unavailable. Production `500` responses do not expose SQL,
credentials or stack traces.

Each JSON/binary request body is at most 1,000,000 bytes; staged version chunks
allow larger private versions and histories without weakening that boundary.
Mutating requests require the
same trusted origin in Node and Worker deployments; missing Origin is permitted
only for verified same-site/non-browser server flows as defined in T2. The Node
adapter must construct its URL from the validated forwarded/Host protocol and
host so a legitimate browser Origin is compared with the actual app origin.

### Public, optional-session reads

- `GET /api/community/feed?q=&tag=&favorites=&cursor=&limit=` →
  `{ creations: Project[], cursor: string|null }`. Cursor is opaque to clients;
  limit is 1–48. `favorites=true` requires a session and otherwise returns 401.
- `GET /api/community/trending?limit=` → `Project[]` (compatibility view).
- `GET /api/community/public/:slugOrId` → published `Project` with public
  `source` and up to 12 public `remixes`, or 404.
- `GET /api/community/public/:slugOrId/comments?cursor=` →
  `{ comments: Comment[], cursor: string|null }`. Comment pagination uses a
  stable timestamp+ID cursor, not a bare timestamp.
- `GET /api/community/profiles/:username?cursor=` → public profile fields plus
  `{ creations, cursor }`, never email.

Optional session affects viewer-specific booleans only. Hidden, archived,
unpublished and incomplete snapshots return 404 to non-owners.

### Authenticated account/project routes

- Better Auth owns `/api/auth/*`, cookie sessions and password deletion.
- `GET /api/community/state` → `{ profile, creations, activeCreationId }` for the
  current owner, including version history and favorite/star membership needed
  after refresh.
- `POST /api/community/profile` creates/updates allowed public profile fields;
  email comes from Better Auth and cannot be changed through this route.
- `POST/PUT /api/community/imports...` use the staged claim contract above.
- `POST /api/community/creations` creates a private project. Immediate publish
  is not used by guest claim. `POST .../:id/versions` appends with an expected
  current version ID. Private versions that do not fit the request-body limit
  reuse the staged version-chunk upload mechanism, then append only after digest
  verification. `PATCH .../:id` edits metadata.
- `POST .../:id/publish|unpublish|archive|restore|remix|star` and
  `DELETE .../:id` keep their current broad route meanings, but return 403/404
  without leaking another owner's private resource. Remix accepts only a public
  source, returns a private project and preserves source/root lineage.
- `GET/POST /api/community/favorites` persists curated-pattern favorites. Public
  creation stars remain creation-star records; UI may call both “favorites,” but
  identifiers cannot collide or share an untyped table contract.
- Comment create and author-only edit/soft-delete routes return the complete
  normalized comment, not only an ID/change boolean. Reports are immutable to
  the reporter and visible only in operator tooling.
- `POST /api/community/recovery-key` and
  `POST /api/community/recover` follow the recovery contract below.

Rate-limit buckets are action-specific and have bounded database retention.
Recovery is limited by IP plus normalized-account key without revealing whether
an account exists. Authenticated writes use user/action buckets; comment/report
abuse has tighter resource-specific limits than ordinary saves.

### Ownership rules

- Owner project operations always constrain by both project ID and session user.
- Public endpoints always require visibility public, no archive, moderation
  visible, a valid published version owned by the same project, and complete
  snapshotted metadata.
- Stars/favorites belong to the authenticated user/profile and toggle only that
  row. Comments can be changed only by their author; operators moderate through
  a separate auditable path. Reports cannot target unavailable content.
- Counts are derived transactionally or by queries; clients never submit trusted
  star/clone/comment/view counts.

## Accounts, recovery and deletion

- Account dialog supports sign up, sign in and recovery in one contextual flow.
  Passwords are 12–128 characters under the current Better Auth policy.
- With no configured email provider, recovery uses one high-entropy recovery key
  shown only on generation/rotation. The UI asks the user to save it and clearly
  states that the service cannot email it. It never logs, stores locally in plain
  text after dismissal, or returns the active key on ordinary reads.
- Creating/rotating a key requires the current password. Only its cryptographic
  digest is stored. Rotation invalidates the previous key immediately.
- Recovery requires normalized email, active key and new password; responses do
  not reveal which field/account was wrong. Success changes the password,
  revokes every existing session, consumes/rotates the key and shows the new key
  once. Reusing the submitted key fails.
- If both password and recovery key are lost, the account cannot be recovered in
  this release. State this plainly; do not offer a fake email path. Device-local
  projects remain exportable and may be claimed by a different account if they
  were never successfully removed after import.
- Account deletion requires recent authentication/current password and an
  explicit destructive confirmation. It removes the account, sessions, profile,
  owned projects/publications/versions, stars/favorites/recovery key and reports
  tied to deleted owned content. Comments on other people's creations remain as
  content with `authorId=null` and “Deleted account”; no email/profile link is
  retained. Remixes of deleted creations remain, with unavailable-source lineage.

T2 must verify Better Auth hooks and database foreign keys implement this exact
policy. Enabling `deleteUser` alone does not prove it.

## UI composition and navigation

### Module boundary decision

Keep and harden the pure domain modules (`life`, `patterns`, design settings,
community transformations, presets/tutorial data). Replace the current
monolithic composition rather than continuing to add behavior to the roughly
3,700-line `src/app.js` and large static shell.

Stay on vanilla ES modules and Canvas. `src/app.js` becomes a small composition
entry. Extract modules with single ownership for router/app state, board canvas,
simulation worker client, editor commands/history, local project store, account
flow, repository API and destination views. Replace `index.html`/shared CSS in
one controlled T4 integration after the controller contracts are tested. Do not
run old and new state managers simultaneously, and do not migrate to React/Next.

This is a modular replacement of UI composition with reuse of tested domain
logic, not a ground-up engine/data rewrite.

### App state ownership

- Router owns current route and overlay route; it does not own board data.
- `playgroundSession` owns scratch/authored/working/live state and optional Try
  source. Trying a gallery item replaces the isolated trial only after preserving
  the previous scratch state for return.
- `studioSession` owns active project ID, selected version, authored/working/live
  snapshots, settings, metadata, selection/history, dirty/save state.
- Community views own query/filter/cursor/selected public record and lightweight
  preview runners. A preview never mutates Playground or Studio.
- Account controller owns session, pending action and claim progress. Repository
  state does not pretend a guest email/profile exists.

Only one full editor Canvas is active at a time, but Playground and Studio
sessions remain in memory/device storage independently. Switching destinations
pauses playback and preserves both. Opening a project replaces Studio only after
the existing dirty project is durably recovered locally.

### Routes and actions

- `/` Playground; `/studio` Studio project browser/editor; `/community` gallery;
  `/community/favorites` favorites; `/c/:slug` public creation; `/u/:username`
  public creator. History API back/forward restores the destination and query,
  never an obsolete transferred board buffer.
- First visit enters a running editable example. Rules guidance is optional and
  the title intro is replayable from Help rather than a mandatory gate.
- `Try` opens an isolated Playground trial. `Add to board` stamps into the
  currently active editable session (or Playground scratch if none). `Remix`
  creates/claims a private Studio project with attribution. `Share` copies the
  canonical public URL only.
- Account modal overlays the current route. Successful authentication/claim
  returns to it and runs one pending action. Cancel returns without discarding
  work.
- Public routes and gallery are fully usable signed out. Remix creates a local
  project immediately. Cloud save, publish, stars/favorites and comments prompt
  for account at action time.

### States and accessibility

Every async surface exposes idle/loading/success/empty/error/offline states with
a useful next action. Buttons remain disabled only while their own request is in
flight. Dialog focus is trapped and restored. Board commands have keyboard and
visible mobile equivalents; touch editing does not depend on hover. Status and
simulation output use appropriate live regions without announcing each frame.

## R1 approved decisions

Astra approved these choices for T1/T2 on 2026-09-08, including explicit resume
semantics, batch-limited complete-history imports and transactional local cleanup:

1. One 2048×2048 editor/local ceiling, 5 MB private-version ceiling, stricter
   200,000-cell/byte public ceiling and 24 MiB combined undo history budget,
   with measured performance guidance rather than a speed claim.
2. Explicit authored/working/live state and epoch/request worker protocol.
3. Staged, resumable guest-history upload with atomic completion, stable import
   key and returned version mapping; local deletion only after verified cloud
   readability and an unchanged local revision.
4. Immutable global creation slug and stable launch username.
5. Published version+metadata snapshot isolated from all later private edits.
6. Recovery-key-only launch experience and the stated deletion/anonymization
   policy while no email provider exists.
7. Modular vanilla UI replacement that reuses domain modules and keeps separate
   Playground, Studio and Community sessions.

Known implementation investigations do not require new product discovery:
strict RLE completion, Worker cancellation/error behavior, Node origin handling,
database constraint/foreign-key correctness, circuit asset reuse terms and the
eventual LinkedIn posting connection.
