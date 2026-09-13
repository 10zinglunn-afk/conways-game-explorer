# Launch discovery

Started 2026-09-07. This document records the current launch request, factual
audit, and product decisions as the interview progresses. Proposed answers are
not accepted decisions.

## User request and authorization

- Read the repository and project context before changing the product.
- Use the GitHub grill-me workflow to resolve unfinished UX and mechanics.
- Complete implementation, verify it, and publish the finished app.
- Once finished, post the app URL on LinkedIn with an explanation of what was
  built, who it serves, Conway's Game of Life, and interesting uses.
- Publishing the app and the eventual LinkedIn post are explicitly requested;
  product choices and any missing account access still need to be resolved.

## Existing product direction

The workspace redesign specification describes three destinations:

- Playground: immediate drawing, persistent stamps, simulation, and learning.
- Dev Studio: precise construction, settings, immutable versions, and publishing.
- Community: discovery, public creations, stars, comments, and remix lineage.

The latest project instructions select vanilla ES modules, Better Auth,
PostgreSQL, and Cloudflare Workers with Hyperdrive. Older memory references to
Supabase and Vercel predate that pivot. The planned Next.js migration has not
been implemented, although related packages are installed.

## Starting checkout

- Repository: https://github.com/10zinglunn-afk/conways-game-explorer
- Branch: main, initially nine commits ahead of the tracked origin/main.
- HEAD: 43e7563, password account authentication.
- Eighteen tracked files already have uncommitted changes, and
  postgres/migrations/0002_publish_readiness.sql is untracked. Preserve and
  integrate this existing work.
- GitHub discovery returned no issues or pull requests for the repository.

## Initial audit

- A deployment responds at https://conways-game-explorer.10zinglunn.workers.dev.
  Its public runtime configuration selects the PostgreSQL backend. Documentation
  saying deployment/provisioning has not happened is stale.
- Baseline npm test: 160 tests total, 159 passed, one historical Supabase live
  integration test skipped. This does not verify the live PostgreSQL journey.
- src/app.js runDevDemo currently selects a glider/collision/gun and displays
  explanatory text. The AND, OR, XOR, and adder controls do not load and verify
  working circuits.
- Community comment submission currently updates state.communityComments in
  browser memory; it is not a durable shared comment service.
- Several advanced tutorials are explicitly external references. Some lesson
  prompts use substitute patterns. Do not advertise these as implemented
  machines or interactive masterworks.
- The server API creates a repository instance per request, while creation
  saving depends on an in-memory profile being loaded. An authenticated local
  request reproduced a 500 before database access. This also blocks claiming
  local drafts and requires a request-lifecycle regression test.
- Read-only database audit found foundation migration 0001 applied, migration
  0002 absent, and zero users, profiles, creations, or publications.
- Public creation/profile routes are missing. The app advertises /c/<slug> but
  only hash-payload sharing is implemented. Owner-scoped slug uniqueness must
  be reconciled with globally addressed creation URLs.
- Anonymous production trending requests return 401, blocking guest cloud
  discovery. Session lookup returns 200 with null for an anonymous visitor.
- Published version updates can retain stale preview/readiness fields. Local
  claiming transfers only the current snapshot and then clears local data,
  losing version history; resumable import IDs are absent. Star membership is
  not hydrated after refresh. These need real lifecycle coverage.
- Account recovery and the shared two-user publishing/remixing journey require
  implementation and verification before the agreed public launch.

## Interview: first round settled

1. Confirmed audience: curious beginners and builders who want to experiment.
2. Confirmed launch scope: Playground, Dev Studio, and the complete public
   community loop (guest drafts, accounts, public links, profiles, stars,
   remixes).
3. User identifies Dev Studio, presets, login, and Community as confusing and
   incoherent. The goal is a coherent experience across these surfaces, beyond
   visual polishing of individual panels.

## Coherence audit

- Intro and Studio request local name/email profiles, while the real account
  flow lives inside Community. Local profile creation is described as sign-in
  even though it is not authentication.
- A blocked publish action updates Community auth text without reliably
  bringing its form into the current Studio context or resuming the action.
- Studio presents Create New Design and Create New Project without a clear
  distinction for the visitor.
- Preset selection enables stamping, while lessons load a fresh board. These
  different consequences are not expressed as consistent actions.
- Community exposes overlapping Edit Clone and Remix actions with different
  navigation behavior. A guest copy helper exists but entry points gate it
  behind profile creation.

## Interview: second round settled

1. Confirmed guest workflow: editing, on-device draft saving, and trying remixes
   before authentication; one account flow for cloud sync, publication, stars,
   and comments; preserve work and resume the attempted action afterward.
2. The user wants to experiment with making a computer, logic gates, perhaps a
   calculator, and art. The agreed proposed foundation is a freeform editor with
   selection/moving, copy/rotate, undo/redo, reset-to-start, and working logic
   examples with inputs and observable outputs. Whether a full calculator or
   computer must be included as a launch showcase still needs clarification.
3. Confirmed browsing model: a playable gallery with favorites and remixing.
   Presets and community creations share visual previews, explanations, and
   predictable Try / Add to board / Remix behavior.

## Interview: third round settled

1. Confirmed launch computing showcase: working editable gates and a small
   binary addition demo, with tools for attempting larger machines. The user
   asks whether larger simulations are feasible and what currently limits them;
   investigate and improve the engine as part of the implementation.
2. Confirmed first visit: a live editable example with optional rule guidance,
   immediate Studio/gallery access, and a replayable title animation.
3. The user confirms the recommendations are on point. Product discovery has
   converged sufficiently to implement the agreed release; no additional
   blanket implementation or publication permission is needed.

## Draft product specification

The evolving implementation/acceptance brief is in launch-product-spec.md.
Confirmed requirements and unresolved launch choices are marked separately.

Later questions depend on those answers: the first meaningful visitor outcome,
onboarding, actual logic construction tools, guided lessons versus freeform
building, first-release examples, community behavior, and launch messaging.

## Workflow and access

The requested Matt Pocock workflow is now named grilling:
https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md

Use it to resolve dependent product decisions in rounds and investigate facts
without asking the user to supply information available in the repository.

The frontend testing and Browser skills were read. Browser execution could not
be discovered in the tools exposed for this session, so no visual QA has been
performed yet. A supported browser path or permitted fallback is still needed.
No LinkedIn connector was discovered; posting access has not been established.

The frontend-app-builder skill is selected for the coordinated redesign. Its
visual concept workflow must cover the board, Studio, gallery, creation detail,
and account state; functional Life cells remain real simulation graphics.

No implementation change, migration, new deployment, or LinkedIn post has been
performed during discovery. Project planning documents are being updated.
