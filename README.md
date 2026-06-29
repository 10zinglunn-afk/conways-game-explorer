# Conway's Game Explorer

A large, zoomable Conway's Game of Life web app built as a finite toroidal world. The board wraps at the edges, so patterns can travel continuously while still fitting inside a practical browser canvas.

## Run

```bash
npm run dev
```

Open http://127.0.0.1:5173.

## Controls

- Play, pause, and step one generation at a time.
- Draw live cells, erase cells, or pan around the world.
- Use the speed slider to change generations per second.
- Use the zoom slider or Ctrl-scroll/pinch to zoom around the pointer.
- Load curated presets with short explanations: glider, lightweight spaceship, pulsar, Gosper glider gun, R-pentomino, Diehard, Acorn, and more.

## Verification

```bash
npm test
node --check src/app.js
node --check server.mjs
```
