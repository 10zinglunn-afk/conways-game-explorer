# Supabase backend (Phase 2)

These migrations back the `conway-life-community` Supabase project:

- project ref: `wfkzhsdjzgnmurkgsjvd`
- region: `us-east-1`

They are the concrete design referenced by
[`docs/community-platform-plan.md`](../docs/community-platform-plan.md) Phase 2.

## Apply to a fresh project

```bash
supabase init          # if not already initialized
supabase start         # local stack for testing
supabase db push       # apply migrations/ to the linked project
```

## Linked project note

The linked project previously had older remote migration-history entries
(`20260629225225`, `20260629225345`, `20260629225422`,
`20260629225445`) for the already-applied base schema/hardening work, while
this repo keeps the authored local files as `0001_community_schema.sql` plus the
`2026062923050*` hardening files. That drift has been repaired: `supabase
migration list --linked` now matches every local migration through
`20260630214126_harden_rpc_security_definer_exposure.sql`.

Run `supabase migration list --linked` before future `supabase db push` calls so
new work starts from an aligned history.

## What's here

- `migrations/0001_community_schema.sql` — tables, indexes, RLS policies,
  `SECURITY DEFINER` counter triggers, the atomic `clone_creation` RPC, the
  `increment_view` RPC, and the initial `trending_creations` view.
- `migrations/2026062923050*_*` — security-advisor hardening for
  `security_invoker` view behavior and function EXECUTE grants.
- `migrations/20260630041751_grant_community_api_access.sql` — explicit Data API
  table/view/function grants plus policy `TO` clauses for newer Supabase
  projects that do not auto-expose SQL-created objects.
- `migrations/20260630145548_atomic_save_creation_rpc.sql` — authenticated
  `save_creation` RPC that saves a creation, first version, and
  `current_version_id` pointer in one database transaction.
- `migrations/20260630214126_harden_rpc_security_definer_exposure.sql` — moves
  privileged clone/view helper bodies into a private schema, keeps stable public
  RPC wrappers as `SECURITY INVOKER`, and changes `save_creation` to run as an
  invoker-protected RPC.
- `tests/community_rls_counters.test.sql` — pgTAP coverage for public/private
  visibility, non-owner update denial, atomic save RPC behavior, star/clone
  counters, direct remix insert denial, clone RPC behavior, and the trending view.
  On the linked project this currently passes 19/19 via
  `supabase db query --linked --file supabase/tests/community_rls_counters.test.sql`.
  `supabase db advisors --linked --type all --level warn --fail-on none`
  currently reports no warning-level issues.

## Contract

A Supabase repository implementation must pass the same backend-agnostic suite
the local repository passes: `src/community-repository.contract.js`. Run it
against a fresh local Supabase instance (`supabase start`) or disposable hosted
project before flipping `createCommunityRepository({ backend: 'supabase' })`.

The opt-in live JS harness is available as:

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=... \
SUPABASE_TEST_EMAIL=you+life-contract@yourdomain.com \
npm run test:supabase:live
```

It is designed for a fresh local or disposable project. It skips populated
community databases because the shared contract expects global trending to only
contain rows created by the current test case. Use a disposable test email on a
real, non-reserved domain; hosted Supabase Auth rejects reserved example/test
domains before the repository contract can run.

For hosted projects that rate-limit public sign-ups, add
`SUPABASE_SERVICE_ROLE_KEY` in the shell that runs the live test. The harness
uses it only from Node to create and later delete a confirmed disposable Auth
user; never expose that key in browser runtime config.
