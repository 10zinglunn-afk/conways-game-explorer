# Life Lab design system

The accepted Playground, Studio, and Community concepts use a near-black
charcoal field so the simulation remains the primary object. Lime is reserved
for an active cell or primary action; teal carries secondary active, focus, and
navigation states. Surfaces are translucent charcoal with one-pixel cool-gray
borders and very small radii.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#07090f` | canvas and page field |
| `--panel` | `rgba(12,18,29,.82)` | rails and inspector surfaces |
| `--panel-strong` | `rgba(15,23,42,.94)` | raised controls |
| `--text` / `--muted` | `#e5edf8` / `#90a4b8` | content hierarchy |
| `--accent` / `--accent-strong` | `#5eead4` / `#2dd4bf` | active navigation and primary actions |
| `--lime` | `#b7f34a` | live cells and settled circuit output |
| `--border` | `rgba(148,163,184,.18)` | surface separation |
| `--space-*` | 8, 12, 16, 24, 32px | compact editor rhythm |
| `--radius` | 2px | controls and panels |

UI text uses Inter/system sans; compact readouts and circuit ports use the
monospace stack. Motion uses 160ms for hover/selection and avoids decorative
movement during simulation.

## Components and states

The shared header contains the Life Lab mark, workspace navigation, saved state,
and a compact account entry. Playground has a visual pattern rail, board canvas,
transport, readout and RLE tools. Studio adds project/version controls, Logic
Kit, real circuit experiments and a right-side Grid/Style inspector. Community
is a gallery with search, filter, preview, Try, Add, and Remix actions.

Buttons have default, hover, focus-visible, active, disabled, selected, and
busy states. Pattern cards have selected/stamp states. Circuit ports show input
off/on, output settling, and a settled high/low state. Board tools have draw,
pan, stamp, select, and paste states. Save shows Saved, Unsaved, Saving,
Offline recovery, and Save failed.

## Responsive behavior

At widths below 900px, fixed rails become a bottom workspace dock and the tool
panel becomes a drawer. The canvas remains full-screen. Transport becomes a
single horizontal row; zoom, fit, undo/redo, reset and circuit run actions stay
touch reachable. Inspector sections stack inside the drawer. Community changes
from three columns to one stream with the selected detail following the gallery.

## Mapping to concepts

The implemented shared left rail and board-first canvas map directly to the
Playground concept. Studio maps the component rail, central canvas, version
tools and inspector to the studio concept. Community maps the discovery stream,
cards, detail area and shared header to the community concept.

Intentional changes: the existing concept imagery is illustrative, so all
pattern thumbnails and previews are drawn from actual Life coordinates. The
Studio Logic Kit has no XOR card: it exposes only the verified AND, OR, NOT and
half-adder experiments. The first visit keeps a replayable optional rules intro,
but its Develop route and recovered-draft route open an editable board directly.
