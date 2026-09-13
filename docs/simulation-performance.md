# Simulation performance baseline

Measured 2026-09-08 on Apple M2 (8 logical CPUs), macOS arm64, Node v22.20.0.
These figures measure `createLifeStepper().step()` only. They exclude Canvas
rendering, Worker messaging, snapshot transfer, browser scheduling and UI work.
They are a planning baseline, not a frame-rate promise.

The benchmark uses a deterministic 0.5% sparse or 35% dense seed, one warm-up
generation, then medians of seven samples at 300×200 and 600² or five samples at
1200² and 2048². Each smaller-board sample times eight generations; each larger
one times three. Run `node scripts/benchmark-life.mjs` to reproduce it.

| Board | Density | Bounded ms/generation | Wrapped ms/generation |
| --- | --- | ---: | ---: |
| 300×200 | sparse | 0.03 | 0.03 |
| 300×200 | dense | 0.42 | 0.43 |
| 600×600 | sparse | 0.05 | 0.04 |
| 600×600 | dense | 2.46 | 2.46 |
| 1200×1200 | sparse | 0.15 | 0.22 |
| 1200×1200 | dense | 10.41 | 10.46 |
| 2048×2048 | sparse | 0.56 | 0.55 |
| 2048×2048 | dense | 30.88 | 32.50 |

The active-tile engine makes sparse worlds inexpensive; dense 2048² worlds take
roughly 31–33 ms per generation before render and transfer costs. The editor
therefore runs simulation in a Worker, gives large boards explicit speed/run
limits, throttles visual snapshots, and lets users cancel long advances. It does
not claim that every 2048² pattern can animate at 60 frames per second.
