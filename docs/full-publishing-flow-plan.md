# Full Publishing Flow Execution Plan

## Goal

Ship a reliable end-to-end product flow in which a visitor can learn Conway's
Game of Life, build locally, sign in without losing work, publish a canonical
public creation, discover other creations, star or remix them, and publish the
remix with visible lineage.

The delivery sequence is an invite-only beta first, followed by open public
publishing after the abuse, moderation, account-deletion, and legal safeguards
are in place. This avoids making public user-generated publishing depend on
unbuilt safety controls while preserving the intended final product.

## Product flow to prove

1. A guest enters Playground or Dev Studio and creates a pattern.
2. The guest saves a local draft with its board and replay settings intact.
3. The guest signs in with email and password and the local draft migrates to PostgreSQL.
4. The builder supplies valid publishing metadata and an accessible preview.
5. Publishing creates a stable canonical URL at `/c/[slug]`.
6. A signed-out visitor can open and run the public creation.
7. A second authenticated user can star it and remix it into a private draft.
8. The remix can be edited and published with its source lineage preserved.
9. Both users' public profile pages list their published work.
10. Private drafts remain inaccessible to every non-owner.

## Guiding constraints

- Preserve the framework-independent Life engine and repository contract.
- Keep local creation available without authentication.
- Require authentication for cloud publishing, starring, commenting, and
  remixing.
- Keep PostgreSQL as the system of record for community data. Better Auth owns
  authentication/session tables; application data is accessed through
  server-side repository methods.
- Apply every schema change through an authored PostgreSQL migration with
  authorization and ownership tests.
- Treat creation versions as immutable snapshots.
- Do not expose service-role credentials to the browser.
- Do not open publishing to the general public until the public-launch gate is
  satisfied.

## Phase 0 — Stabilize the current workspace redesign

### Implementation

- Review the existing uncommitted workspace changes and split them into
  coherent commits without discarding user work.
- Resolve visual and interaction regressions across Playground, Dev Studio,
  Community, onboarding, the tool drawer, and responsive layouts.
- Ensure workspace changes clear transient stamp state and do not lose an
  active draft.
- Complete keyboard navigation, focus management, labels, reduced-motion
  behavior, contrast, and mobile touch interactions.
- Remove or clearly label UI controls whose cloud behavior is still demo-only.

### Verification

- Run the complete Node test suite and syntax checks.
- Add browser-level smoke coverage for all three workspaces.
- Manually verify desktop and mobile layouts at representative widths.
- Verify drawing, inferred erasing, repeated stamping, stamp transforms,
  panning, zooming, tutorials, opening projects, and workspace transitions.

### Exit criteria

- The redesign is committed as a stable baseline.
- Automated tests are green.
- Browser verification has no blocking console, layout, or interaction errors.
- Every visible Community action is either functional or explicitly marked as
  unavailable in the beta.

## Phase 1 — Complete the durable design and version model

### Schema

- Add structured replay metadata to `creation_versions`, including dimensions,
  edge behavior, simulation speed, render style, theme, trail/glow settings,
  and default camera framing.
- Add any missing creation-level metadata: description, attribution, tutorial
  reference, preview configuration, and publish-readiness fields.
- Add constraints for supported dimensions, metadata lengths, tag limits,
  color values, rule format, and RLE payload size.
- Add indexes for owner project lists, public slugs, publication date, tags,
  and version history.

### Repository contract

- Distinguish `createCreation` from saving a new immutable version of an
  existing creation.
- Add methods to update creation metadata, list versions, load a version,
  unpublish, and delete/archive a creation.
- Ensure local and PostgreSQL repositories implement identical behavior.
- Preserve settings and lineage when cloning a creation.
- Make version creation and `current_version_id` updates atomic.

### Dev Studio

- Open and update an existing project without producing duplicate creations.
- Add version history with current-version indication and restore-as-new-version
  behavior.
- Add explicit dirty, saving, saved, failed, and offline states.
- Add debounced local recovery/autosave without silently publishing changes.
- Warn before navigation when unrecoverable changes remain.
- Support editing metadata, unpublishing, archiving/deleting, and republishing.

### Verification

- Extend the shared repository contract for update/version/archive behavior.
- Add server authorization tests for cross-owner version and metadata writes.
- Test version rollback as a new snapshot rather than mutation of history.
- Run the live PostgreSQL contract against a disposable database and test the
  Better Auth session flow through the server API.

### Exit criteria

- A design can be created, reopened, edited, versioned, restored, and deleted
  locally and in PostgreSQL without data loss or duplicate project records.
- All replay settings survive save, reload, clone, and migration.

## Phase 2 — Build the validated publishing workflow

Implementation status (2026-07-12): the local implementation is complete.
Shared client/server validation now requires complete metadata and a non-empty,
bounded RLE; active repositories allocate deterministic owner-scoped slugs;
publish retries preserve the original timestamp and `/c/[slug]`; the UI exposes
explicit validation/publishing/success/failure/unpublished states; and
`0002_publish_readiness.sql` prevents incomplete rows from becoming public.
Dev Studio now lets builders fit the pattern or use the current view as the
default camera, then persists a deterministic lightweight preview with theme
colors and accessible fallback text. Community cards and details consume that
same preview contract. Applying the migrations and running the repository/auth
contract against a disposable PostgreSQL database remains the Phase 2
verification gap.

### Publish readiness

- Require a title, meaningful description, valid tags, and a non-empty board.
- Validate metadata and RLE on both client and database boundaries.
- Generate a URL-safe owner-scoped slug and handle collisions deterministically.
- Let the builder choose and preview the default camera framing.
- Produce a lightweight static or deterministic preview representation with
  accessible fallback text.
- Show attribution and remix lineage before confirmation.

### Publish state machine

- Introduce explicit states: draft, validating, publishing, published, failed,
  and unpublished.
- Prevent duplicate submissions while a publish request is pending.
- Make retries idempotent.
- Return the canonical public URL after success.
- Support editing metadata and publishing a later version without changing the
  canonical URL.
- Support unpublishing with a clear confirmation and predictable public-page
  behavior.

### Verification

- Test every validation rule locally and through PostgreSQL.
- Test slug collision, repeated publish requests, failed requests, retry, later
  versions, and unpublish/republish.
- Confirm private content never becomes readable before the transaction
  completes.

### Exit criteria

- Publishing is deliberate, atomic, retry-safe, and ends at a stable URL.
- Invalid or private content cannot leak into public queries.

## Phase 3 — Migrate the shell to Next.js and add canonical routes

### Foundation

- Create a Next.js App Router application with TypeScript.
- Move pure Life, pattern, sharing, design-settings, and repository contracts to
  framework-independent modules before wrapping them in React.
- Wrap the canvas and direct browser interactions in focused client components.
- Keep public data fetching in server components or server-side data helpers.
- Replace the temporary Node static server and injected runtime script with
  environment-aware Next.js configuration.

### Routes

- `/` — onboarding and Playground.
- `/dev` and `/dev/[id]` — Dev Studio launcher and authenticated project editor.
- `/community` — discovery feed.
- `/c/[slug]` — public creation detail.
- `/u/[username]` — public creator profile.
- `/auth/callback` — future OAuth completion and local-draft claim.
- Account/settings routes for profile changes and account deletion.

### Public creation pages

- Render title, author, description, tags, lineage, counts, publication time,
  and accessible preview metadata on the server.
- Add interactive play/pause/step preview as progressive enhancement.
- Add Open in Playground, Remix in Dev Studio, Star, and Share actions.
- Record views through a guarded, abuse-resistant path.
- Return correct behavior for missing, private, unpublished, and removed work.
- Add canonical metadata, Open Graph metadata, sitemap entries, and robots rules.

### Public profile pages

- Add unique validated usernames and public display names.
- Show published creations, remix relationships, and basic creator statistics.
- Keep private account fields and drafts out of public responses.

### Exit criteria

- A signed-out browser can open a canonical creation and creator URL directly.
- Public pages are server rendered and produce useful unfurled link metadata.
- Existing simulator behavior passes parity tests after the migration.

## Phase 4 — Complete Community discovery and comments

### Discovery

- Add paginated queries for trending, newest, famous/curated, and remixes.
- Add server-side search over title, description, tags, and public creator name.
- Add filters for tags, author, pattern type, grid size, and remix status.
- Add stable cursor-based pagination and deterministic ordering.
- Add related creations and source/remix-tree queries.
- Add loading, empty, error, retry, and offline states.
- Define a maintainable process for curated historical patterns and attribution.

### Comments

- Add a `comments` table with creation, author, body, timestamps, edit state, and
  moderation state.
- Add server authorization for public reads and authenticated author writes.
- Add create, edit, soft-delete, list, and report repository methods.
- Maintain comment counts from source-of-truth rows.
- Paginate threads and handle removed authors/content predictably.

### Verification

- Test search/filter combinations and pagination boundaries.
- Test comment authorization, edits, deletion, counts, and removed/private creations.
- Verify Community never exposes private creations through search or counts.

### Exit criteria

- Community data is cloud backed; no production action relies on demo-only
  local state.
- Discovery remains usable with empty, large, slow, and partially failing data.

## Phase 5 — Authentication, trust, and public-platform safety

### Authentication and accounts

- Configure production and preview redirect URLs.
- Add password recovery only after a transactional email sender is configured.
- Add username onboarding, uniqueness, normalization, and reserved-name rules.
- Add profile editing, sign-out-everywhere expectations, account deletion, and
  data export/removal behavior.
- Verify local-to-cloud claiming is idempotent and recoverable after partial
  failure.

### Abuse prevention

- Add server-enforced rate limits for authentication, publishing, starring,
  cloning, commenting, reporting, and view increments.
- Add payload limits, spam heuristics, and optional challenge/CAPTCHA escalation.
- Add report flows for creations, comments, and profiles.
- Add moderation state and an admin-only review/takedown path.
- Add audit logging for moderation and sensitive account actions.
- Define behavior for suspended users, hidden creations, and lineage pointing to
  removed sources.

### Policy surface

- Publish privacy, terms, acceptable-use, copyright/takedown, and contact pages.
- Explain what local data is stored before sign-in and what migrates afterward.
- Document account deletion and retention expectations.

### Exit criteria

- Invite-only beta accounts can be administered and deleted safely.
- Rate limits and reporting are tested before registrations are opened broadly.
- The public-launch gate is signed off before removing the invite restriction.

## Phase 6 — Deployment, observability, and release

### Environments and delivery

- Create separate development/test, preview/staging, and production PostgreSQL
  environments (Neon branches or an explicitly documented safe equivalent).
- Configure Cloudflare Workers preview deployments for pull requests and
  production from `main`; bind Hyperdrive separately in each environment.
- Store environment-specific public and server-only credentials correctly.
- Add an ordered migration workflow with pre-deploy checks and rollback/forward
  recovery instructions.
- Configure the production domain, redirects, HTTPS, and security headers.

### Operations

- Add structured error reporting for browser, server, auth, publishing, and
  repository failures without logging secrets or private RLE payloads.
- Add product analytics for onboarding, first save, sign-in, migration,
  publishing, public-page open, star, remix, and remix publication.
- Add health checks and alerts for elevated auth, database, or publish failures.
- Define database backup and recovery expectations.
- Add dependency and security update routines.
- Set performance budgets for initial load, interactive canvas startup, public
  previews, and unusually large patterns.

### Exit criteria

- Preview and production deployments are repeatable from a clean checkout.
- Production configuration contains no service-role secrets in client bundles.
- Monitoring can identify where the core funnel fails.
- Recovery steps have been exercised at least once in staging.

## Phase 7 — End-to-end beta and public launch gates

### Automated two-user journey

Implement browser coverage that:

1. Creates and saves a guest draft.
2. Signs in User A and confirms successful local-to-cloud migration.
3. Publishes the creation and opens its canonical URL signed out.
4. Signs in User B, stars the creation, and remixes it.
5. Edits and publishes the remix.
6. Verifies lineage and counters on both creation pages and profiles.
7. Attempts cross-owner access to both users' private drafts and receives no
   data.
8. Unpublishes and republishes a version without changing its canonical URL.
9. Deletes an account in the test environment and verifies the documented
   ownership/content behavior.

### Invite-only beta gate

- Phase 0 through Phase 4 exit criteria are complete.
- Production Auth, account deletion, basic rate limits, reporting, and error
  monitoring from Phase 5/6 are operational.
- The automated two-user journey passes against staging.
- A manual desktop/mobile acceptance pass is recorded.
- Known limitations are documented in-product.

### Open public publishing gate

- All Phase 5 and Phase 6 exit criteria are complete.
- Moderation and takedown operations have an accountable owner and runbook.
- Abuse limits have been load-tested or exercised with realistic traffic.
- Privacy, terms, acceptable-use, and deletion flows are live.
- Backups, alerts, and incident recovery have been verified.
- Funnel and reliability metrics from the beta show no unresolved launch
  blockers.

## Cross-cutting test matrix

Every phase should preserve or add coverage at the appropriate layer:

| Layer | Required coverage |
| --- | --- |
| Pure logic | Life rules, patterns, transforms, settings, validation, slugs |
| Repository contract | Local/PostgreSQL behavioral parity and error semantics |
| Database | Migrations, constraints, transaction atomicity, private-data isolation |
| Components | Form validation, state transitions, keyboard and accessible behavior |
| Browser | Workspace workflows, Auth callback, publish, public pages, remix journey |
| Production smoke | Canonical URLs, Auth redirects, public/private access, observability |

## Execution discipline

- Implement one phase or independently releasable vertical slice per branch.
- Start schema-affecting slices with migration and contract-test design.
- Keep commits scoped; never mix unrelated cleanup into a migration or security
  change.
- Run local unit/contract tests on every slice and hosted integration tests when
  PostgreSQL or Better Auth behavior changes.
- Record manual browser verification for visual or interaction-heavy slices.
- Update `README.md`, `CLAUDE.md`, and `docs/community-platform-plan.md` when a
  phase changes the documented architecture or status.

## Definition of done

The full publishing flow is complete when the two-user journey passes in
production-like staging, canonical creation/profile URLs work signed out,
private drafts are proven private, design versions and replay settings survive
the full lifecycle, remix lineage remains correct, and the open-public gate has
all safety and operational controls in place.
