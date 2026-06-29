# Conway's Game Explorer

A large, zoomable Conway's Game of Life web app built as a finite toroidal world. The board wraps at the edges, so patterns can travel continuously while still fitting inside a practical browser canvas.

## Run

```bash
npm run dev
```

Open http://127.0.0.1:5173.

## Controls

- Play, pause, and step one generation at a time.
- Draw live cells, erase cells, stamp the selected preset, or pan around the world.
- Use the speed slider to change generations per second.
- Use the zoom slider or Ctrl-scroll/pinch to zoom around the pointer.
- Toggle age colors to see newborn, mature, and old live cells differently.
- Watch the population chart track growth, collapse, oscillation, and stabilization.
- Load curated presets with short explanations: still lifes, oscillators, gliders, growth seeds, Gosper glider gun, R-pentomino, Diehard, Acorn, and more.
- Import and export Conway RLE patterns from the RLE panel.

## Verification

```bash
npm test
node --check src/app.js
node --check src/patterns.js
node --check src/presets.js
node --check server.mjs
```
