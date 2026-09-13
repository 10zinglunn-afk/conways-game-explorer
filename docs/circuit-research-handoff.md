# Circuit research handoff

Research obtained in the preceding implementation session. Reproduce these
results against the final shipped engine before presenting them as verified
launch behavior. Nothing in this document grants upstream asset rights.

## Sources

- Carlini's gate construction and signal explanation:
  https://nicholas.carlini.com/writing/2021/improved-logic-gates-game-of-life.html
- CakeML gate coordinates and simulator recipe:
  https://github.com/CakeML/game-of-life/tree/master/gates and the repository's
  `gol_simLib.sml`.
- Myreen and Carneiro paper:
  https://research.chalmers.se/publication/548890/file/548890_Fulltext.pdf

The paper declares CC BY 4.0. An explicit license for the repository RLE assets
was not established; do not assume the paper's license covers every repository
file. Establish reuse terms or another appropriately licensed source before
shipping. Keep source/author credits with each curated experiment.

## T3 provenance check — 2026-09-08

The circuit recipe was reproduced against this repository's bounded B3/S23
engine using the upstream raw files. The truth tables and timing in this handoff
remain reproducible. The exact upstream commit inspected was
`c3439fc4c24948f93945c75c973e56ed4a001ad6` (2025-11-09). GitHub's repository
metadata reports `license: null`, and its license endpoint returns 404. Its
README identifies the RLE gates as designs in the repository but supplies no
reuse terms. The paper identifies the repository as supplementary software and
licenses the paper itself under CC BY 4.0; it does not explicitly grant a
license for the supplementary RLE assets.

Accordingly, do not copy these RLE strings into a shipped module yet. The
verified source file SHA-256 values are retained here for a future permission or
licensed-source audit:

| File | SHA-256 |
| --- | --- |
| `and-en-e.rle` | `0fef9d77de42e8d00241a985f4e14f53609d91838ae89e0935520b1739edb3be` |
| `or-en-e.rle` | `41db119b1cb47f8e674c884a7d753e291ca4fadafd33559ac606e8f7ff71f716` |
| `not-e-e.rle` | `1e54c37cc365ef65ef776f6679592e44c992af073e895d58395fb96349617842` |
| `half-adder-ee-ee.rle` | `4e44625cf8fc7657ca43f745d84dac83499579d0f4fd414fb8e45a01c4203795` |
| `terminator-e.rle` | `0ad47641ac6628e254f79fffcafadbeda1c93dfed3ca768b0d0823f69fb5b19e` |

## Reproducible geometry and observations

Downloaded research files: `and-en-e.rle`, `or-en-e.rle`, `not-e-e.rle`,
`half-adder-ee-ee.rle`, `terminator-e.rle`. Temporary copies existed in
`/private/tmp/` on 2026-09-08; the scratch verification program was
`/private/tmp/circuit-facts-final.mjs`. These paths are ephemeral; retrieve
upstream files if absent and record the commit/hash used for final validation.

Raw RLE has no headers. Preserve origin offsets, including isolated cells at
(0,0). OR can extend to x=151 and half-adder to x=301, outside nominal tile
dimensions. Do not crop to 150/300 or normalize away ports.

Use bounded B3/S23 boards, gate origin (480,20):

| Experiment | Board | Nominal tile size | Observe generation |
| --- | --- | --- | --- |
| AND, OR, NOT | 800×650 | 150×150 | 600 |
| Half-adder | 950×340 | 300×300 | 1200 |

Stamp the gate at origin. Stamp terminator at origin+(size,0); half-adder has
another terminator at origin+(300,150).

Eastbound LWSS raw RLE: `$5bo2bo$9bo$5bo3bo$6b4o!` (preserve leading offset).
Northbound LWSS raw RLE: `2b3o$bo2bo$4bo$4bo$bobo!`.

Initialize finite packet trains for k=1..14; no runtime signal injection:

- A=1: eastbound LWSS at origin+(-5-30k,70).
- Half-adder B=1: eastbound LWSS at origin+(-5-30k,220).
- AND/OR B=1: northbound LWSS at origin+(70,160+30(k-1)).
- A/B=0: omit that train.

Observe live-cell population in a 12×12 probe centered at
origin+(size,75). Half-adder carry probe is centered at origin+(300,225).
The prior scratch run observed population 0 for low, 9 for high:

| A | B | AND | OR | Half-adder sum | Half-adder carry |
| --- | --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 | 1 | 0 |
| 1 | 0 | 0 | 1 | 1 | 0 |
| 1 | 1 | 1 | 1 | 0 | 1 |

NOT: A=0 → high; A=1 → low. Half-adder observations were stable in the tested
1140–1440-generation interval. Show settling before the valid observation
window; startup pulses must not be reported as settled results. Signals are
finite and eventually expire. Reset rebuilds the selected input configuration.
Labels may explain expected results, but actual output indicators must observe
the cells and respect phase/timing.
