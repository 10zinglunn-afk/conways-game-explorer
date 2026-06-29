# Landing And Dev Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a retro cell-text landing sequence for `THE GAME OF LIFE` and add a first Dev Mode section for experimentation without replacing the existing Playground.

**Architecture:** The landing is a self-contained overlay with its own canvas and Life board, then it fades away to reveal the current app. Dev Mode is a toggleable panel state layered onto the existing sidebar, exposing concise experiment controls and claim checks while leaving Playground behavior intact.

**Tech Stack:** Vanilla HTML, CSS, JavaScript modules, Canvas 2D, existing `src/life.js` utilities, Node test runner.

---

## File Structure

- Modify `index.html`: add the landing overlay markup, a topbar mode switch, and Dev Mode panel controls.
- Modify `src/app.js`: import landing helpers, wire landing completion, implement Dev Mode toggling, component stamps, and claim checks.
- Create `src/landing.js`: render the cell-wall landing, type `THE GAME OF LIFE`, run the title as Life, and notify app completion.
- Modify `src/styles.css`: style the retro landing, mode switch, and Dev Mode panel.
- Create `src/landing.test.js`: verify title-cell generation and landing phase transitions that can be tested without a browser.
- Run existing tests and syntax checks.

## Task 1: Landing Module

**Files:**
- Create: `src/landing.js`
- Test: `src/landing.test.js`

- [ ] **Step 1: Write tests for deterministic landing helpers**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIntroBoard,
  getIntroVisibleText,
  introTitle,
} from './landing.js';

test('intro title is the approved landing text', () => {
  assert.equal(introTitle, 'THE GAME OF LIFE');
});

test('typing reveals only the visible title prefix', () => {
  assert.equal(getIntroVisibleText(0), '');
  assert.equal(getIntroVisibleText(3), 'THE');
  assert.equal(getIntroVisibleText(999), 'THE GAME OF LIFE');
});

test('intro title board creates live cells for block letters', () => {
  const board = createIntroBoard('THE');
  const population = board.cells.reduce((sum, cell) => sum + cell, 0);

  assert.equal(board.width > 0, true);
  assert.equal(board.height > 0, true);
  assert.equal(population > 40, true);
});
```

- [ ] **Step 2: Run landing tests to verify failure**

Run: `npm test -- src/landing.test.js`

Expected: FAIL because `src/landing.js` does not exist.

- [ ] **Step 3: Implement the landing module**

Implement:

- `introTitle`
- `getIntroVisibleText(count)`
- `createIntroBoard(text)`
- `mountLandingIntro(options)`

`mountLandingIntro` should:

- draw a cell-wall background
- type the title in cell letters
- reveal a `PRESS START` prompt
- start on click or Enter
- run the title board through Life for about 4 seconds
- fade the intro layer out
- call `onComplete`

- [ ] **Step 4: Run landing tests to verify pass**

Run: `npm test -- src/landing.test.js`

Expected: PASS.

## Task 2: DOM Wiring

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`

- [ ] **Step 1: Add landing and Dev Mode markup**

Add:

- `section#intro-layer`
- `canvas#intro-canvas`
- `div#intro-prompt`
- `button#mode-playground`
- `button#mode-dev`
- `section#dev-panel`
- Dev component buttons for glider signal, Gosper gun, eater, and reflector
- Dev claim buttons for period/stillness, spaceship drift, and population snapshot

- [ ] **Step 2: Wire landing completion and Dev Mode state**

In `src/app.js`:

- import `mountLandingIntro`
- add intro elements to `elements`
- call `mountLandingIntro` from `boot`
- add `state.mode`
- add `setMode(mode)`
- add Dev component stamping helpers
- add lightweight claim-check helpers that report useful status text

- [ ] **Step 3: Ensure Playground stays default after landing**

Verify the app starts in Playground Mode after the landing fades. Dev Mode should only activate when the user clicks the Dev button.

## Task 3: Styling

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Style landing overlay**

Add styles for:

- full-screen intro layer
- intro canvas
- arcade prompt
- fade-out state
- reduced-motion behavior

- [ ] **Step 2: Style mode switch and Dev Mode panel**

Add styles for:

- topbar mode switch
- active mode buttons
- hidden/shown Dev panel
- compact Dev controls
- claim output text

## Task 4: Verification

**Files:**
- Existing project files only

- [ ] **Step 1: Run automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run syntax checks**

Run:

```bash
node --check src/app.js
node --check src/landing.js
node --check src/patterns.js
node --check src/presets.js
node --check server.mjs
```

Expected: all commands exit successfully.

- [ ] **Step 3: Start dev server**

Run: `npm run dev`

Expected: local app available at `http://127.0.0.1:5173`.

- [ ] **Step 4: Manual browser verification**

Verify:

- `THE GAME OF LIFE` types in as cell text
- click starts the transition
- Enter starts the transition after reload
- title plays as Life for about 4 seconds
- landing fades into Playground
- Playground controls still work
- Dev Mode button reveals the Dev panel
- Dev component buttons stamp useful patterns
- Dev claim buttons write concise results

## Self-Review

- Spec coverage: The plan covers the approved landing sequence, cell-wall background, click/Enter start, roughly 4 second Life transition, fade into Playground, and the requested first Dev Mode section.
- Placeholder scan: No placeholders, TBDs, or deferred implementation steps remain.
- Type consistency: Planned exports from `src/landing.js` are used by tests and imported by `src/app.js`.
