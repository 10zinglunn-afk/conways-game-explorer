# Conway Life Logic Lab: launch product specification

Status: accepted direction assembled from the launch interview. The audience,
public launch, guest workflow, editor direction, playable gallery, working gates
and binary addition showcase, and direct first-visit entry are confirmed.

## Purpose

Help curious beginners and builders experiment with Conway's Game of Life,
progress from moving patterns to logic and computation, make visual art, and
share work that others can run, favorite, and remix.

The user explicitly wants a coherent product across Studio, presets, account
access, and Community. They would personally try building a computer, logic
gates, a calculator, or art.

## Core journey

Try a pattern -> experiment in Studio -> save a draft -> publish -> others remix.

A visitor can explore, edit, save drafts on the device, and try a remix without
an account. Signing in enables cloud saving and shared community actions. Work
survives account creation/sign-in, and the interrupted action resumes.

## Product language and shared navigation

- Playground: immediate experiments and learning the rules.
- Studio: named projects and construction tools.
- Community: playable presets and public creations with search and favorites.
- A consistent account entry across every destination.
- Use Project consistently for an editable saved document. Avoid parallel New
  Design / New Project concepts without distinct behavior.
- Try runs an isolated example. Add to board stamps a pattern into the current
  experiment. Remix creates an editable private copy with visible attribution.
- Share copies a public creation URL; it must not unexpectedly become a draft,
  overwrite a board, or put a link into an unrelated pattern-format field.

## Playground and first visit

Provide a meaningful editable example, clear Play/Pause, Step, Reset, drawing,
stamping, pan, zoom, and access to a visual pattern library. Explain the actual
Life rules with optional interactive guidance. First visits enter the live
example directly; the title animation can be replayed separately.

## Studio

One project browser and one focused editor should support:

- A blank project, an existing draft, or a remix as entry points.
- Drawing and erasing, persistent stamps, selection/moving, copy/paste,
  rotation/reflection, undo/redo, and reset to the experiment's starting state.
- Visible selection and placement feedback, keyboard equivalents, and usable
  mobile controls.
- Pattern previews and explanations, organized for discovery and reuse.
- Simulation controls with consistent edge behavior and replay settings.
- Cell appearance and trail settings for artistic experimentation.
- Clear save state, recovery after reload, and immutable saved versions.
- A publishing flow that shows title, description, tags, preview, and attribution.

Running a simulation must preserve the authored starting point for reset and
replay. Opening a preset or browsing Community must preserve the current project.
Published changes must be deliberate, with correct version and preview state.

## Authentic computation

Computation examples must evolve under Conway B3/S23. Input controls initialize
real patterns, and output probes observe the resulting board. Verify truth
tables and timing using the same engine as the visitor's simulation.

Confirmed launch showcase: editable gates and a small binary addition demo that
teaches how signals combine. Improve larger simulation capability and document
its measured limits, while full programmable computer tooling is a future
extension rather than a launch requirement.

Curated historical patterns require verified sources and attribution. Distinguish
loadable experiments from external references. Never present an approximation
or explanatory button as a verified machine.

### Research evidence for scope

Read-only research found Carlini's authentic 150x150 LWSS gate tiles with a
60-generation signal period:
https://nicholas.carlini.com/writing/2021/improved-logic-gates-game-of-life.html

Myreen and Carneiro's verified half-adder uses four tiles (300x300), with a
stated worst settling delay of 18 signal ticks / 1,080 generations. It is a
concrete candidate for the demonstration 1 + 1 -> binary 10:
https://research.chalmers.se/publication/548890/file/548890_Fulltext.pdf

Source components exist at https://github.com/CakeML/game-of-life/tree/master/gates.
Some RLE files lack headers and require preserving tile origins/ports. The paper
declares CC BY 4.0, but repository asset licensing was not established; resolve
asset reuse terms before bundling, preserving author attribution.

Current settings cap dimensions at 600x600 and speed at 40 gen/s. The engine
scans every cell on the main thread, while the render loop has unbounded
catch-up. A useful computation workflow needs bounded time budgets, faster
batch execution, labeled input/output ports, phase-aware simulation, and output
probes. Truth-table tests must exercise physical cell behavior.

Large published machines are materially different in scale: Carlini's improved
counter is 7000x11000, and programmable designs such as
https://github.com/nicolasloizeau/scalable-gol-computer require a larger/sparse
simulation system. The user's launch-showcase choice determines whether that
engine expansion belongs in this release.

## Playable gallery and public pages

- Presets and user creations use one recognizable preview and action model.
- Browse/search/filter experiments by useful categories such as starters,
  motion, logic, and art. Public browsing works while signed out.
- Favorite/star creations and revisit them in a Favorites view. Signed-in
  favorites persist across refreshes and devices.
- A dedicated creation page provides a runnable preview, creator, description,
  tags, source attribution, remix history, favorites/stars, comments, and share.
- A creator page lists public creations and public profile information.
- Remix preserves the source relationship and creates a private editable copy.
- Empty, loading, error, and unavailable-content states have useful next actions.
- Public URLs open the advertised creation directly and provide useful link
  metadata for LinkedIn and other sharing surfaces.

## Accounts and durable data

- One real account flow, available from any workspace. Local drafts require no
  pretend account or collection of an email address.
- Claiming guest drafts preserves versions, settings, attribution, and identity
  mappings, and can resume after a partial failure without creating duplicates.
- Private projects remain accessible only to their owner. Public reads exclude
  private account fields and drafts.
- Favorites and comments are durable shared actions with ownership enforcement.
- Saving, versioning, publication, unpublication, and restoration maintain
  correct canonical links, previews, and publication state.
- Implement account recovery and the account lifecycle required by the existing
  public-launch plan; exercise these against the deployed authentication system.
- Complete the existing public-launch requirements for payload/rate limits,
  reporting, content removal, account deletion, and operational recovery.

## Visual implementation

Use one set of typography, color, spacing, icons, and interaction states across
the product. Keep the board dominant in editing destinations, with a deliberate
tool hierarchy. Gallery pages prioritize playable previews and readable titles.
Account forms use the same design system and return to the user's context.

Create coordinated visual concepts before frontend implementation, then compare
actual desktop/mobile rendering against them. Life cells and pattern previews
remain data-driven simulation graphics, not image substitutes. The dark arcade
identity is the starting point; first visits enter an interactive example.

## Delivery and acceptance

1. Coherent experience: implement navigation, the board/Studio/gallery/account
   design system, and predictable transitions without losing active work.
2. Real experiments: implement editor mechanics, curated examples, and verified
   computation demonstrations at the confirmed depth.
3. Durable public loop: fix the audited cloud defects and complete public pages,
   accounts, claiming, favorites, comments, and remix lineage.
4. Launch proof: run local checks, real database authorization/lifecycle tests,
   desktop/mobile browser journeys, and deployed public-link verification.

The acceptance journey uses a guest, User A, and User B: create and save a guest
project, sign in as A without losing work, publish, open the public URL signed
out, favorite and remix as B, edit and publish the remix, and inspect the source
relationship. Prove cross-owner private access is denied and recovery/version
behavior survives reload, failures, and publication updates.

Publish the finished app and push the completed repository work. Once deployed
behavior is verified, post the live URL on LinkedIn explaining the actual
shipped capabilities, audience, Conway's rules, and learning/building/art uses.
The original request authorizes both publications. LinkedIn posting access and
the intended posting identity still need to be established.
