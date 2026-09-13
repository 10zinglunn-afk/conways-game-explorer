# Life Lab help

Life Lab is a browser workspace for exploring Conway's Game of Life. The
Playground is for immediate experiments; Studio keeps named projects and
versions; Community contains public, playable creations.

## The rule being simulated

Every cell is either alive or dead. On each generation, all cells are updated
at the same time using B3/S23:

- A dead cell is born when it has exactly three live neighbors.
- A live cell survives when it has two or three live neighbors.
- Every other live cell dies, and every other dead cell stays dead.

The eight surrounding positions are the neighbors. With wrapping enabled, an
edge connects to the opposite edge; with wrapping disabled, outside the board
is dead space. The launch rule remains B3/S23.

## Controls

In Playground or Studio, draw cells on the board, erase them, stamp a pattern,
and use Play, Pause, Step, and Reset. Reset returns to the authored starting
arrangement. Undo and Redo apply to completed editing commands. Studio also
supports selection, move, copy, paste, rotate, flip, pan, zoom, fit, pattern
import/export, and local recovery after a reload. On mobile, use the visible
touch controls and board gestures when keyboard shortcuts are unavailable.

Choose **Select**, then drag a rectangle on the board. Its shaded outline shows
what will be edited. The selection buttons copy, paste, rotate, reflect, or
move the rectangle one cell at a time. To paste elsewhere, select a destination
first. Keyboard equivalents are Ctrl/Cmd+C, Ctrl/Cmd+V, R, F, and the arrow
keys; Escape clears the selection. Moves stop at board edges, and rotations
that would crop the selection are refused.

Play and Step continue from the current paused generation. Saving stores the
authored start; it does not silently turn a later running frame into a new
start. Use “Use current state as start” when that is what you intend.

Try opens an isolated example. Add to board stamps it into the current board.
Remix makes an editable private copy and keeps the source attribution.

## Saving, accounts, and recovery

You can edit and save drafts on this device without an account. Local recovery
stores a binary board snapshot in IndexedDB; device projects and their history
also use IndexedDB transactions, subject to the
browser's storage quota. Clearing site data, changing browser profiles, or
using a private browsing session can remove those drafts; export important work
as RLE when you need a portable copy.

When the configured PostgreSQL community service is available, an email and
password account adds cloud saving and shared actions such as publishing,
favorites, and comments. Remixing immediately creates an editable device draft
without requiring an account. The browser sends requests to the same
origin; database credentials are server-only. If the service is unavailable,
the app says so and keeps device drafts local.

Guest history is uploaded in bounded, resumable batches. Local data is removed
only after the cloud import and account activation succeed, with the captured
revision checked inside the same transaction that removes it. Editing during
an import keeps the newer local work. A failed cloud refresh keeps the local
project available for saving and retrying.

Generate a recovery key after signing in by confirming the current password.
The key is displayed for you to save; Life Lab cannot email it. Creating a new
key replaces the previous key. Using a key to set a new password also rotates
the key and revokes existing sessions. A lost password and lost recovery key
cannot be recovered by this application.

Account deletion requires the account password and the explicit deletion
confirmation. It deletes the account's projects, versions, recovery key,
sessions, stars, and owned community rows through database cascades. Comments
left on other creators' work can remain with a deleted-account author label.

## Board and publication limits

Valid boards are 1–2048 cells on each axis; new custom boards in the editor
use 40–2048 cells on each axis. Local recovery and local RLE support a valid
2048×2048 board, subject to browser storage. A private cloud version may use
up to 5,000,000 UTF-8 bytes of RLE. Public publication is capped at 200,000
live cells and 200,000 UTF-8 bytes for the selected version. A larger project
can remain local or private/cloud-saved and can be exported instead of
published.

The measured engine baseline on an Apple M2 is approximately 0.03 ms per
generation for a sparse 300×200 board and 30.88–32.50 ms per generation for a
dense 2048×2048 board, before rendering, Worker transfer, and browser costs.
Sparse and dense results differ substantially. Large runs use the Worker,
bounded batches, throttled visual snapshots, and cancellation; these numbers
are guidance, not a promise of 60 fps. See
[`simulation-performance.md`](simulation-performance.md).

## Circuits and credits

Studio includes editable AND, OR, NOT, and binary half-adder experiments. They
use finite trains of real Life cells as inputs and observe live cells at output
probes after settling: the gates at generation 600 and the half-adder at
generation 1200. A high probe is the observed nine-cell packet; a low probe is
zero cells. Before the settling point, the output is intentionally unset.
Signals are finite and eventually expire; reset rebuilds the selected input
configuration. The half-adder exposes Sum and Carry, so 1 + 1 is represented as
sum 0 and carry 1. This is a teaching demonstration, not a full CPU or
calculator.

The gate geometry is from the CakeML Game of Life repository at commit
`c3439fc4c24948f93945c75c973e56ed4a001ad6`. The repository credits the CakeML
project and designs associated there with Nicolas Loizeau and Nicholas
Carlini. The project owner authorized inclusion of the coordinates. The
source, probe recipe, and evidence hashes are recorded in
[`circuit-research-handoff.md`](circuit-research-handoff.md).

## Community and privacy

Public pages expose the selected published version, public metadata, creator
profile fields, public remix lineage, favorites, and non-deleted comments.
Private drafts and private version history are not public projections.
Favorites, comments, reports, publishing, unpublishing, archiving, restoring a
version, and deleting a creation require the applicable signed-in context and
ownership checks. Comments are limited to 1–2000 characters; reports ask for a
5–2000 character reason and are rate-limited along with other write actions.

Use Report on a public creation to submit a moderation report. Reports are
stored for an operator to review. A visible creation can be hidden through
moderation status, and archived or unpublished creations leave public listings;
this checkout does not promise an instant removal SLA or provide a public
moderation dashboard.

## When something goes wrong

Keep the browser tab open while a local recovery indicator is present. Export
the current board as RLE before clearing site data. For a failed or interrupted
cloud import, retry from the account flow; staged uploads are invisible until
completion and the unchanged local revision is retained. A stale concurrent
cloud save should be reloaded and reviewed before saving again.

Operators should apply the authored PostgreSQL migrations in order, keep the
database connection and Better Auth secret server-only, and use a disposable
database for lifecycle checks. Before a production migration or deployment,
take a provider-supported PostgreSQL backup and record its restore point. To
restore, stop writes, restore into a controlled database, apply only the
reviewed migrations needed to reach the target schema, run the lifecycle and
authorization checks, then update the Worker connection/binding and verify
public and private routes. Keep the previous Worker version available for
rollback. These are release procedures for T8; no production migration or
backup is claimed by this document.
