# Life Logic Lab Landing Design

## Product Split

The existing Conway explorer is Playground Mode. Playground Mode stays focused on visual exploration, curated presets, RLE import and export, drawing, stamping, panning, zooming, and simulation controls.

Dev Mode is a future workbench for experimentation and construction. It will support deeper tools for logic gates, glider signals, timing, verification, reusable components, and user-built circuits. Dev Mode is not part of this landing page implementation.

## Landing Goal

Add an interactive intro that feels like a retro video game booting into Conway's Game of Life. The landing should be eye-catching, short, and directly connected to the simulation. It should not add long explanations, a mode picker, or in-depth guides.

## Experience Sequence

1. The app opens on a full-screen landing layer.
2. The background is a dark cell wall using the existing teal, blue, and dark theme.
3. The title types in as blocky cell text:

   `THE GAME OF LIFE`

4. A small prompt appears after the title finishes typing:

   `PRESS START`

5. The user can start with either a click or the Enter key.
6. On start, the blocky title becomes a live-cell pattern and runs Conway's Life.
7. The title pattern plays for roughly 4 seconds. If the title dies too quickly, shoots away too quickly, or becomes hard to read, tune the simulation timing, seeded support cells, camera scale, or visual pacing so the transition feels intentional.
8. The landing layer fades out and reveals Playground Mode.
9. Playground Mode resumes the current app behavior after the landing completes.

## Visual Direction

The intro should use the current app's visual language:

- dark canvas background
- teal and blue living cells
- glow and trail effects
- grid/cell-wall texture
- compact retro arcade prompt
- no long instructional copy

The title should be made from visible cells, not ordinary text pretending to be cells. It should read as blocky, grid-based lettering before it comes alive.

## Controls

- Click starts the transition.
- Enter starts the transition.
- Starting should be idempotent. Multiple clicks or key presses during the transition should not restart or corrupt the animation.

## Architecture

The landing should be implemented as a lightweight overlay in front of the existing app.

The existing Playground canvas and controls remain the main app. The landing owns its own small animation state and should not require rewriting the core simulation engine.

Where practical, reuse existing Life utilities for board creation and stepping. If a separate intro board is simpler for rendering the title cleanly, keep that code isolated from the Playground state.

## Testing

Automated tests should continue to cover Life rules and pattern parsing. The landing should pass syntax checks. Manual verification should confirm:

- the title types in as `THE GAME OF LIFE`
- click starts the transition
- Enter starts the transition
- the title runs as a Life pattern for about 4 seconds
- the overlay fades into Playground Mode
- the existing Playground controls still work after the landing
