# Conway Workspace Redesign Design

## Decision

Redesign the app around three separate full-screen workspaces:

- **Playground:** fast, simple, fun, and low-stakes. It is for visitors who want to click around and instantly understand Conway's Game of Life.
- **Dev Studio:** a serious building workspace for making, saving, customizing, versioning, and publishing designs.
- **Community:** a discovery and remix space where people browse famous patterns and user designs, star them, comment, copy them, and publish related work.

The implementation should happen in this order:

1. Fix the Playground drawing and stamp model.
2. Split the interface into the three full-screen workspaces.
3. Add Dev Studio customization, saved-project depth, tutorials, and publish polish.
4. Expand Community into a feed/detail/remix experience.

This keeps the current interaction glitches from leaking into the larger redesign while still moving toward the bigger product shape.

## Current Problems

- Playground exposes Draw, Erase, and Place as equal modes. That makes it feel like a technical editor instead of a drawing board.
- Stamp placement communicates like a one-time paste action even though the preferred model is persistent stamping.
- After choosing a stamp, clicking other controls can leave stale copy such as "Placing" or "paste it" in the interface.
- Playground, Dev Lab, and Community currently share the same side-panel layout, so they feel like tabs inside one tool instead of different destinations.
- Dev Mode needs deeper project and customization controls than Playground should ever show.
- Community needs to feel like a living design stream, not only a local save/publish panel.

## Playground

Playground becomes the instant-use version of the app. The first screen should be mostly the board, with compact controls for Play/Pause, Step, Clear, Soup, speed, Draw, Stamp, and a small curated pattern drawer.

### Drawing Model

There is no visible Erase button in Playground.

Draw behaves like a drawing board:

- Dragging from an empty cell paints live cells.
- Dragging from a live cell while paused removes cells.
- The pointer action is inferred from where the drag starts, not from a separate Erase mode.
- The cursor and board feedback should make the current action obvious.

This keeps Playground simple while preserving the ability to erase.

### Stamp Model

Stamp is a persistent tool.

- Clicking a pattern card selects that pattern and turns Stamp on.
- Clicking the Stamp tool also toggles Stamp on or off.
- While Stamp is on, the mouse cursor becomes a stamp-style cursor and a ghost preview follows the board cell under the pointer.
- Every board click places another copy of the selected pattern.
- Stamp stays on until the user clicks the active Stamp button again, switches back to Draw, or leaves the board workspace.
- Clicking settings such as speed, pattern category, color, or tutorial controls must not show stale "paste once" messaging. The only active message should be clear persistent-state language such as "Stamp on: Gosper glider gun."

### Feedback

Playground should feel tactile:

- Stamp toggle: active button animation and optional short haptic pulse.
- Stamp place: placed cells briefly flash or ripple, with optional haptic tap.
- Draw/erase drag: subtle cell paint feedback without noisy toast spam.
- Clipboard or copy actions: copy icon, success state, and "Copied" confirmation.
- Reduced-motion users get instant state changes without pulsing or ripple animation.

All haptics must use safe optional browser support, for example `navigator.vibrate?.(...)`, and never block desktop use.

## Dev Studio

Dev Studio is for people who want to build something with Conway's Game of Life and publish it as a design.

It should have its own full-screen workspace with:

- A project/profile rail showing the signed-in profile, number of saved designs, drafts, published designs, starred designs, and recent work.
- A central build board with the same simulation engine, but more precise controls.
- A right inspector for grid, style, rules, pattern components, tutorials, metadata, and publish readiness.
- A project browser for opening past designs.
- Version history for saved snapshots.
- Clear Save Draft and Publish to Community actions.

### Dev Customization

Dev Mode should be highly customizable. Playground should not expose most of these controls.

Customizable options:

- Grid dimensions: small, medium, large, and custom width/height.
- Board behavior: toroidal wrapping by default, with optional bounded edges for experiments.
- Cell size and zoom: zoom controls plus saved default view for a design.
- Simulation speed: fine-grained speed slider and step controls.
- Visual theme: background, grid, live cells, dying/trail cells, accent color, and selection color.
- Cell rendering style: crisp square, rounded pixel, glowing cell, or minimal dot.
- Trail/glow intensity: off, low, medium, high.
- Pattern library visibility: starter, motion, guns, reflectors, logic, masterworks.
- Rule preset: Conway B3/S23 by default, with room for Life-like rule variants saved as metadata rather than mixed silently into normal Conway designs.
- Publish metadata: title, description, tags, tutorial link, attribution, remix source, and thumbnail framing.

Saved designs should persist both the cell state and the design settings that matter for replay: dimensions, wrapping, theme, render style, speed, camera/view, tags, and description.

### Dev Tutorials

Dev Mode should teach builders how famous Life designs work. Tutorials should be interactive and pattern-based rather than long prose.

Tutorial groups:

- Starter patterns: block, beehive, blinker, toad, beacon, pulsar, glider, lightweight spaceship, R-pentomino, Acorn, and Diehard.
- Builder patterns: Gosper glider gun, Simkin glider gun, eater, Snark reflector, Herschel conduits, glider collisions, rakes, puffers, and breeders.
- Masterworks: OTCA metapixel, Gemini-style self-replication, Sir Robin-style advanced spaceships, and selected Pattern of the Year discoveries.

Each tutorial should include:

- A loadable pattern.
- A short goal.
- A step-through explanation.
- A "try modifying this" prompt.
- A button to save the user's variation as a draft.

Source references for the tutorial/pattern list:

- LifeWiki Tutorials: https://conwaylife.com/wiki/Tutorials
- Gosper glider gun: https://conwaylife.com/wiki/Gosper_glider_gun
- Simkin glider gun: https://conwaylife.com/wiki/Simkin_glider_gun
- Snark: https://conwaylife.com/wiki/Snark
- OTCA metapixel: https://conwaylife.com/wiki/OTCA_metapixel
- Pattern of the Year: https://conwaylife.com/wiki/Pattern_of_the_Year

## Community

Community becomes a full-screen discovery surface.

The primary view should be a stream/grid hybrid with:

- Famous designs curated from Life history.
- Trending community designs.
- New designs.
- Remixes and "based on" chains.
- Search and filters for tags, pattern type, speed, grid size, and author.

Design cards should show:

- Animated or static board preview.
- Title, author, tags, and short description.
- Star count, comment count, copy/remix count, and publish date.
- Actions: Star, Comment, Copy, Remix, Open in Playground, Open in Dev Studio.

The detail view should show:

- Larger preview with Play/Pause.
- Description and tutorial notes.
- Comments.
- Related/remixed designs.
- Attribution and source chain.
- Copy and Remix actions that create a private draft for the current user.

## Data Model Implications

The current community repository already supports local/cloud profiles, creations, publishing, starring, cloning, and trending. The redesign should extend that model instead of replacing it.

Likely additions:

- Design settings stored on creation versions: dimensions, wrapping, visual theme, render style, speed, and default camera.
- Comments for public creations.
- Tutorial metadata for curated patterns.
- Remix/source lineage shown prominently in Community.
- Preview thumbnail or lightweight preview seed per published version.

For the first UI implementation, comments and richer preview assets can be local/demo data if the Supabase schema update is split into a later backend task. Publishing, starring, cloning, and profile hydration should continue using the existing repository seam.

## Interaction Rules

- Switching between Playground, Dev Studio, and Community should feel like changing workspaces, not toggling a side panel.
- Leaving a board workspace turns off Stamp to avoid cross-workspace stale tool state.
- Clicking inspector/settings controls while Stamp is active does not cancel Stamp, but it also does not present one-shot paste language.
- Opening a Community design offers clear choices: quick open in Playground, copy/remix into Dev Studio, or view details.
- Dev customization changes apply to the current draft and should be visibly dirty until saved.
- Publishing requires title, description, tags, and an accessible preview state.

## Visual Direction

Use a shared visual system, but let each workspace have a different density:

- Playground: open, playful, minimal, mostly canvas.
- Dev Studio: denser, tool-like, precise, with rails and inspectors.
- Community: browseable, social, content-forward, with strong previews and readable metadata.

The UI should avoid nested cards and crowded explanatory text. Controls should use familiar icons where they are obvious: draw, stamp, play, pause, step, clear, save, publish, copy, star, comment, remix, settings, and profile.

## Architecture

Keep the app in the existing vanilla JS structure for this redesign unless a later phase intentionally migrates to a framework.

Implementation should carve the current large app surface into clearer modules:

- Workspace state and navigation.
- Board tools and pointer feedback.
- Pattern/tutorial catalog.
- Dev project settings and customization state.
- Community view models and actions.
- Shared UI helpers for buttons, toasts, icons, haptics, and reduced-motion handling.

The existing Life engine, pattern parsing, repository seam, and Supabase-backed community repository should remain the behavioral foundation.

## Testing

Automated coverage should include:

- Draw inferred erase behavior.
- Persistent Stamp toggle behavior.
- Stamp remains active after board placement.
- Stamp messaging does not use one-shot paste language.
- Leaving a board workspace clears Stamp.
- Dev settings serialize into saved creation/version data.
- Community copy/remix still uses the repository clone path.
- Existing repository contract tests continue to pass.

Manual/browser verification should include:

- Desktop and mobile layout for all three workspaces.
- Playground drawing and repeated stamping.
- Haptic-safe behavior on unsupported browsers.
- Dev grid resize and visual customization.
- Opening a saved design.
- Publishing from Dev Studio into Community.
- Starring, copying, remixing, and commenting from Community.

## Acceptance Criteria

- The app stays on `main`.
- Playground has no visible Erase tool and feels like a simple drawing board.
- Stamp is persistent, visually obvious, and places repeated copies until toggled off.
- Copy/paste/stamp actions provide visible feedback, safe optional haptics, and reduced-motion-safe animations.
- Playground, Dev Studio, and Community are separate full-screen workspaces.
- Dev Studio supports customizable grid size and visual styling, and those settings persist with saved designs.
- Dev Studio shows profile/project history and supports opening previous designs.
- Dev Studio includes famous-pattern tutorials grounded in known Life patterns.
- Community supports discovery, starring, comments, copying, remixing, and clear design lineage.
- Existing tests pass, and browser verification confirms the redesigned workflows.
