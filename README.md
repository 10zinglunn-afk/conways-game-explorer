# Conway Life Logic Lab

A Conway's Game of Life playground growing into a community lab for learning logic, building cellular machines, and remixing what other people discover.

The current app is a large, zoomable finite toroidal world. The board wraps at the edges, so patterns can travel continuously while still fitting inside a practical browser canvas. It now has three modes:

- **Playground**: draw cells, stamp presets, import/export RLE, and explore emergent behavior.
- **Dev Lab**: treat gliders as signals, stamp logic components, and run lightweight claim checks.
- **Community**: create a local profile, save board states, publish builds, star them, clone/remix them, and view a trending list.

Community mode stays local-first by default. When Supabase runtime config is present, it adds magic-link sign-in, migrates local builds after sign-in, and gates publish/star/clone until the user is signed in.

## Run

```bash
npm run dev
```

Open http://127.0.0.1:5173.

## Community Cloud

Local drafts work with no network config. To enable the Supabase-backed community UI, run the dev server with:

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run dev
```

The server injects those safe browser values into the inline `life-runtime-config` JSON tag when serving `index.html`.

## Controls

- Play, pause, and step one generation at a time.
- Draw live cells, erase cells, stamp the selected preset, or pan around the world.
- Use the speed slider to change generations per second.
- Use the zoom slider or Ctrl-scroll/pinch to zoom around the pointer.
- Toggle age colors to see newborn, mature, and old live cells differently.
- Watch the population chart track growth, collapse, oscillation, and stabilization.
- Load curated presets with short explanations: still lifes, oscillators, gliders, growth seeds, Gosper glider gun, R-pentomino, Diehard, Acorn, and more.
- Import and export Conway RLE patterns from the RLE panel.
- Create a local community account, save the current board as a creation, publish it, copy a share payload, star builds, and clone/remix public experiments.

## Community Roadmap

The larger goal is a GitHub-like creative community for Game of Life machines:

1. Stabilize the current Playground, Dev Lab, and local-first Community MVP.
2. Keep hardening the Supabase Auth/Postgres-backed community path for creations, versions, stars, and remix lineage.
3. Move the app shell to Next.js while keeping the Life engine as pure reusable logic.
4. Add public `/c/[slug]` and `/u/[username]` pages for SEO-indexable builds and profiles.
5. Deploy through Vercel with GitHub preview deployments.
6. Expand Logic Lab with reusable gates, clocks, signal lanes, calculators, tutorials, and featured builds.

LinkedIn launch shape:

> This started as a Conway's Game of Life explorer. The larger goal is a community lab where people can learn logic through living patterns, clone and remix each other's machines, and publish cellular automata experiments.

Call to action: try the playground, star the repo, and share a pattern or logic demo you want the community version to support.

## Verification

```bash
npm test
node --check src/app.js
node --check src/community.js
node --check src/patterns.js
node --check src/presets.js
node --check server.mjs
```
