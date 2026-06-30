# Conway Life Logic Community Platform Plan

## Status snapshot

| Capability | State |
| --- | --- |
| Local-first Community MVP (profiles, save, publish, clone/remix, stars, trending, share) | Done, in vanilla JS |
| Repository seam (`src/community-repository.js`) | Done, async interface |
| Backend-selection factory (`createCommunityRepository`) | Done, local default + Supabase client path + URL/key factory path |
| Shared contract test suite | Done (`src/community-repository.contract.js`) |
| URL share links + import-on-load | Done |
| Supabase project | Done: `conway-life-community` (`wfkzhsdjzgnmurkgsjvd`, `us-east-1`) |
| Supabase schema / RLS / functions | Done on the linked project: migration history is repaired, all local migrations through `20260630214126_harden_rpc_security_definer_exposure.sql` are recorded remotely, public RPCs no longer run as `SECURITY DEFINER`, and `save_creation` is deployed with the intended authenticated/service-role grant surface. |
| RLS + counter-function tests | Linked-project pgTAP coverage passes for RLS/counters/clone/trending plus `save_creation` (19/19 via `supabase db query --linked --file supabase/tests/community_rls_counters.test.sql`). Local Docker remains unavailable, so local Supabase runner coverage is still pending. |
| Supabase repository implementation | Done: shared contract runs against the Supabase repository fake client, and the opt-in live contract passed 8/8 against the linked hosted project on 2026-06-30 using a server-only service-role test-user setup. Profile, atomic `save_creation`, publish, star/unstar, clone RPC, trending, auth helpers, runtime config, migration, and returning-user hydration are covered. |
| Browser auth UI + shared-action gating | Done: magic-link controls, sign-out fallback to local mode, local-to-cloud migration on sign-in, and publish/star/clone gating |
| Next.js migration + public SSR pages | Not started (Phase 3) |

The local-first build is the product scaffold. It is not real auth or
database-backed community data; it proves the loop and keeps the simulator
intact.

## Architecture: the repository seam (done)

The Community functions sit behind an async interface created by
`createLocalCommunityRepository` and selected through
`createCommunityRepository(config)`:

- `loadCommunityState`, `saveProfile`, `saveCreation`, `publishCreation`,
  `toggleStar`, `cloneCreation`, `listTrendingCreations`
- plus local UI helpers `getState`, `findCreation`, `setActiveCreation`

Methods are async so the contract already matches a network backend. `src/app.js`
talks only to this interface and keeps a synchronous render cache via
`getState()`. The same interface is exercised by a backend-agnostic contract
suite (`src/community-repository.contract.js`) so any future implementation is
verified against identical behavior.

---

## Phase 2 — Supabase backend (complete for the static app)

### 2.1 Identity & auth model (resolves the prior contradiction)

Two tiers, so frictionless local play and RLS-protected shared data coexist:

- **Local tier (no auth):** anyone can build and save to localStorage with the
  current email+name profile. No publishing to the shared community.
- **Cloud tier (Supabase Auth):** publishing, starring, and cloning *shared*
  creations require sign-in (email magic link; GitHub OAuth optional). The
  `profiles` row is keyed by `auth.users.id`, which every RLS policy keys on via
  `auth.uid()`.

Signing in **claims** the local data: the local profile and builds are migrated
into the authenticated account (see 2.6). This keeps the frictionless entry
point while making `auth.uid()` real wherever RLS depends on it.

### 2.2 Data model (concrete schema)

The authored schema lives in `supabase/migrations/0001_community_schema.sql`.
Key mapping from the **denormalized local object** to the **normalized DB**:

- Local `creation.currentVersion` (embedded) → `creation_versions` row, with
  `creations.current_version_id` FK pointing at the latest snapshot.
- Local `starredBy[]` → `stars` rows (one per profile+creation).
- Local `remixedFromId` / `rootCreationId` → `creations` self-FK plus a
  `remixes` lineage row.
- `star_count` / `clone_count` / `view_count` are **denormalized counters**,
  never written directly by clients (see 2.3).

Tables: `profiles`, `creations`, `creation_versions`, `stars`, `remixes`.
Constraints worth noting: `creations (owner_id, slug)` is unique (slug collisions
are scoped per owner), `visibility in ('private','public')`, tags as `text[]`.

### 2.3 Counter integrity & RLS (the clone problem)

The hard case: cloning increments `clone_count` on the **source** creation, which
the cloning user does **not** own — a plain "owners update their own rows" policy
would block it. Same for `star_count`. Resolution:

- Counters are maintained by **`SECURITY DEFINER` trigger functions** on `stars`
  and `remixes` that recompute the count from the source-of-truth rows. Triggers
  run with definer privileges, so they update the count column on a row the
  acting user cannot otherwise write — without granting clients direct write
  access to counts.
- Cloning is done atomically through a **`clone_creation` RPC**. The public RPC
  is `SECURITY INVOKER`; the privileged helper body lives in the private
  `community_private` schema, validates the source is public, creates the
  caller-owned private creation + version, and inserts the `remixes` row (which
  fires the count trigger).
- Saving is done atomically through a **`save_creation` RPC** (`SECURITY
  INVOKER`) that validates the caller, inserts the caller-owned creation,
  inserts the first version, and sets `current_version_id` in one database
  transaction under normal table grants/RLS policies.

RLS summary (full policies in the migration):

- `profiles`: read if `is_public` or `id = auth.uid()`; write only own row.
- `creations`: read if `visibility = 'public'` or owner; insert/update/delete own.
- `creation_versions`: read if the parent creation is readable; insert if the
  caller owns the creation.
- `stars`: read public; insert/delete only own rows, and only against public
  creations.
- `remixes`: insert only via the `clone_creation` RPC.

### 2.4 Trending

A `trending_creations` view applies the same weighting the local engine uses
(`stars*8 + clones*13 + views*0.5 + freshness`, freshness = `max(0, 14 - age in
days)`) over public creations, ordered by score. Callers paginate with
`limit`/`offset`. `view_count` is incremented by an `increment_view` RPC
(rate-limited client-side) when a creation detail page is opened.

### 2.5 Backend selection (config swap)

`createCommunityRepository({ backend })` selects the implementation. Default is
`local`. When `backend: 'supabase'` and credentials are present (env:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`), it returns the Supabase repository; if
requested without credentials or a client factory it throws a clear error rather
than silently falling back. `server.mjs` injects only the safe browser config
needed for selection into an inline JSON tag in `index.html`. The UI is unchanged across
backends.

### 2.6 Local → cloud data migration

On first successful sign-in, a one-time migration reads the local state via
`loadCommunityState`, then for each local creation calls `saveCreation`
(and `publishCreation` for ones that were public) against the Supabase
repository, remapping local profile/creation ids to server ids. Local state is
kept until migration confirms success, then cleared. Conflicts (same slug) get a
fresh suffix. This is exposed as a `migrateLocalState(localRepo, cloudRepo)`
helper covered by the contract harness.

### 2.7 Validation, limits, abuse

- RLE payload size cap (reject oversized snapshots before save); tag count capped
  at 8 (already enforced locally — mirror as a DB check/trigger).
- Per-user rate limits on publish/star/clone via Supabase policies or an edge
  function.
- Moderation/report flow for public creations is a **non-goal for Phase 2**;
  tracked for later.

### 2.8 Testing strategy

- The backend-agnostic **contract suite** (`community-repository.contract.js`) is
  the single source of behavioral truth; the Supabase repo must pass it against a
  fresh local or disposable hosted Supabase instance seeded with test fixtures.
- The opt-in JS integration harness is
  `src/community-repository.supabase.integration.test.js`; run it with
  `npm run test:supabase:live` after setting `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, and `SUPABASE_TEST_EMAIL`. It intentionally skips
  populated projects because the shared contract expects a fresh global
  `trending_creations` surface. Use a disposable test email on a real,
  non-reserved domain; hosted Supabase Auth rejects reserved example/test
  domains before the contract can run. If hosted sign-up rate limits block the
  test, provide `SUPABASE_SERVICE_ROLE_KEY`; the harness uses it only from Node
  to create and later delete a confirmed disposable Auth user.
- RLS policies get dedicated tests asserting denied cross-owner writes and the
  clone/star counter paths.
- Migration (2.6) is tested by running the contract's local repo through
  `migrateLocalState` into a fresh cloud repo and re-asserting the contract.

### 2.9 Acceptance criteria (Phase 2 done means)

1. `supabase/migrations` applies cleanly to a fresh project.
2. A Supabase repository passes the full contract suite against a fresh local or
   disposable hosted Supabase instance.
3. RLS tests prove: non-owners cannot edit creations; stars/clones update counts;
   private creations are invisible to others.
4. Sign-in migrates existing local builds with no data loss.
5. `createCommunityRepository({ backend: 'supabase' })` runs the live app with no
   UI code changes.

Current verification: on 2026-06-30, `supabase migration list --linked` matched
all local migrations through `20260630214126_harden_rpc_security_definer_exposure.sql`,
`supabase db advisors --linked --type all --level warn --fail-on none` reported
no issues, and `npm run test:supabase:live` passed the 8-test shared repository
contract against the linked hosted project after the linked database reported 0
public creations. The local Docker runner remains environment-dependent and
unavailable in this checkout, so hosted disposable verification is the accepted
Phase 2 proof.

### 2.10 Sequenced steps

1. Provision Supabase project; apply `0001_community_schema.sql`. **Done**: linked metadata confirms the expected Community tables and functions exist, migration history has been repaired to match the authored local files, and `20260630214126_harden_rpc_security_definer_exposure.sql` is applied.
2. Harden exposed functions/views from security advisor output. **Done**: public RPC wrappers are invoker-safe, privileged helper bodies live outside the exposed public schema, and linked advisors report no warning-level issues.
3. RLS + counter-function tests against local Supabase. **Done against the linked project** for the current 19-check pgTAP suite, including `save_creation`; local Docker is still unavailable, and `supabase test db --linked` still requires Docker for the runner.
4. Implement `createSupabaseCommunityRepository`; pass the contract suite. **Done**: profile/atomic-save/publish/star/clone/trending/auth-helper slices pass, the shared repository contract runs against the Supabase implementation via a fake Supabase client, cloned remixes hydrate their own version rows, returning signed-in users hydrate profile/build/version/star state, and the live harness passed 8/8 against the linked hosted project on 2026-06-30.
5. Wire env-based config selection. **Done**: repository selection supports `client` or `supabaseUrl` + `supabaseAnonKey` + `createClient`, `server.mjs` injects safe runtime config into `index.html`, and the browser reads the inline `life-runtime-config` JSON tag.
6. Implement and test `migrateLocalState`. **Done**: migrates profile + creations, publishes public builds, returns ID remaps, and clears local state only after cloud writes succeed.
7. Add auth UI (magic link) gating publish/star/clone. **Done**.
8. Hydrate cloud state after sign-in/migration. **Done in repository/app unit coverage**: activation reloads the cloud profile, owned builds, current versions, and current-user star state before rendering.

---

## Phase 3 — Next.js + public URLs (deferred, scoped)

The current app is static `index.html` + `app.js` + `styles.css` with no build
step. The community payoff — **linkable, SEO-indexable public pages** — needs
server rendering, so it belongs here, not bolted onto the static app. Phase 3 is
a deliberate, separate effort:

- Port the Life engine to framework-agnostic modules (already mostly pure) and
  wrap Canvas in client components.
- App Router routes: `/` (playground), `/c/[slug]` (public creation, SSR),
  `/u/[username]` (profile, SSR). The interim URL-hash share (`#build=...`)
  shipped in Phase 1 is replaced by real `/c/[slug]` URLs.
- Vercel + GitHub: preview deploys per PR, production from `main`.

This phase is **not started** and can begin after the Phase 2 changes are merged
and any production deployment/secrets workflow is settled.

## Non-goals (for now)

- Real-time collaborative editing.
- Content moderation/reporting tooling.
- Native mobile clients.
