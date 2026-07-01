# Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Playground, Dev Studio, and Community workspace redesign on `main`, including persistent stamping, drawing-board erase behavior, Dev customization, saved settings, tutorials, and richer community discovery.

**Architecture:** Keep the vanilla JS app and Life engine. Add focused pure helpers for interaction copy, design settings, tutorial metadata, and community metadata, then wire them into the existing app shell. Preserve the existing community repository seam so local and Supabase-backed flows keep using the same API.

**Tech Stack:** Vanilla ES modules, Node `node:test`, Canvas 2D, localStorage community repository, optional Supabase repository.

---

## File Structure

- Modify `src/interaction.js`: persistent stamp state helpers, haptic-safe feedback patterns, workspace transition behavior, and user-facing stamp messages.
- Modify `src/interaction.test.js`: red/green coverage for persistent stamping, no one-shot paste wording, and workspace stamp clearing.
- Modify `src/life.js`: optional bounded-edge simulation support while keeping toroidal wrapping as the default.
- Modify `src/life.test.js`: bounded-edge regression coverage.
- Create `src/design-settings.js`: Dev Studio customization defaults, input normalization, settings serialization, and preview summaries.
- Create `src/design-settings.test.js`: tests for grid sizing, themes, render styles, and persisted metadata.
- Create `src/tutorials.js`: famous Life tutorial catalog grounded in existing pattern IDs and researched famous designs.
- Create `src/tutorials.test.js`: coverage for tutorial grouping, loadability, and source metadata.
- Modify `src/community.js`: persist design settings and comments/comment counts on creations and clones.
- Modify `src/community.test.js`: saved setting and comment lineage tests.
- Modify `src/community-repository.js`: pass design settings through local save/clone and keep Supabase inputs backward-compatible.
- Modify `src/community-repository.test.js`: repository-level setting persistence.
- Modify `index.html`: reshape controls into separate full-screen workspace surfaces and add Dev customization/community feed elements.
- Modify `src/app.js`: wire persistent stamp behavior, haptics/toasts, workspace navigation, Dev customization, tutorials, saved projects, publish actions, community feed/detail/comment actions, and board settings.
- Modify `src/styles.css`: full-screen workspace layouts, animations, reduced-motion support, cursor/tool feedback, Dev Studio controls, and Community stream/detail styling.

---

### Task 1: Interaction Helper Tests And Stamp Model

**Files:**
- Modify: `src/interaction.test.js`
- Modify: `src/interaction.js`
- Modify: `src/app.js`
- Modify: `index.html`

- [ ] **Step 1: Write failing interaction tests**

Add tests like:

```js
test('stamp placement keeps the stamp tool active for repeated placement', () => {
  assert.equal(shouldKeepPointerActiveAfterApply({ pointerMode: 'stamp' }), true);
  assert.equal(shouldKeepPointerActiveAfterApply({ pointerMode: 'draw' }), true);
});

test('stamp status copy describes persistent stamping without paste-once language', () => {
  const message = getToolStatusMessage({
    tool: 'stamp',
    selectedPresetName: 'Gosper glider gun',
  });

  assert.match(message, /Stamp on: Gosper glider gun/);
  assert.doesNotMatch(message, /paste|click the board to paste|Place again/i);
});

test('switching workspaces clears active stamp state', () => {
  assert.equal(getToolAfterWorkspaceChange({ currentTool: 'stamp' }), 'draw');
  assert.equal(getToolAfterWorkspaceChange({ currentTool: 'draw' }), 'draw');
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- src/interaction.test.js`

Expected: FAIL because `shouldKeepPointerActiveAfterApply`, `getToolStatusMessage`, and `getToolAfterWorkspaceChange` do not exist yet.

- [ ] **Step 3: Implement minimal interaction helpers**

Add exports in `src/interaction.js`:

```js
export function shouldKeepPointerActiveAfterApply({ pointerMode }) {
  return pointerMode === 'stamp' || pointerMode === 'draw' || pointerMode === 'erase';
}

export function getToolAfterWorkspaceChange({ currentTool }) {
  return currentTool === 'stamp' ? 'draw' : currentTool;
}

export function getToolStatusMessage({ tool, selectedPresetName }) {
  if (tool === 'stamp') {
    return selectedPresetName
      ? `Stamp on: ${selectedPresetName}. Click the board to place copies until you turn Stamp off.`
      : 'Choose a pattern, then turn Stamp on to place repeated copies.';
  }

  return 'Draw mode: drag from empty cells to paint; drag from live cells while paused to erase.';
}
```

- [ ] **Step 4: Wire app stamp behavior**

In `src/app.js`, stop clearing `state.pointer.active` inside stamp placement, change button label from `Place/Placing` to `Stamp/Stamp on`, remove visible Erase control from Playground, and replace paste wording with `getToolStatusMessage`.

- [ ] **Step 5: Verify interaction tests pass**

Run: `npm test -- src/interaction.test.js`

Expected: PASS.

---

### Task 2: Design Settings, Bounded Simulation, And Tutorial Catalog

**Files:**
- Create: `src/design-settings.js`
- Create: `src/design-settings.test.js`
- Create: `src/tutorials.js`
- Create: `src/tutorials.test.js`
- Modify: `src/life.js`
- Modify: `src/life.test.js`

- [ ] **Step 1: Write failing settings and bounded-edge tests**

Add tests like:

```js
test('normalizes custom grid settings for saved Dev Studio designs', () => {
  const settings = createDesignSettings({
    gridPreset: 'custom',
    width: 480,
    height: 320,
    liveCellColor: '#ff00aa',
    renderStyle: 'glow',
    wrapping: false,
  });

  assert.equal(settings.width, 480);
  assert.equal(settings.height, 320);
  assert.equal(settings.liveCellColor, '#ff00aa');
  assert.equal(settings.renderStyle, 'glow');
  assert.equal(settings.wrapping, false);
});

test('bounded mode does not wrap neighbor counts across edges', () => {
  const board = createBoard(3, 3);
  board.cells[0] = 1;
  board.cells[2] = 1;
  board.cells[6] = 1;

  const wrapped = nextGeneration(board);
  const bounded = nextGeneration(board, { wrapping: false });

  assert.equal(getCell(wrapped, 2, 2), true);
  assert.equal(getCell(bounded, 2, 2), false);
});

test('tutorial catalog includes famous loadable builder lessons', () => {
  const tutorials = getTutorialCatalog();
  assert.equal(tutorials.some((tutorial) => tutorial.patternId === 'gosper-gun'), true);
  assert.equal(tutorials.some((tutorial) => tutorial.title.includes('Simkin')), true);
  assert.equal(tutorials.every((tutorial) => tutorial.sourceUrl), true);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- src/design-settings.test.js src/tutorials.test.js src/life.test.js`

Expected: FAIL because new modules and bounded options are not implemented.

- [ ] **Step 3: Implement settings helpers and bounded Life options**

Implement `createDesignSettings(input)`, `mergeDesignSettings(base, patch)`, `getGridDimensions(settings)`, `serializeDesignSettings(settings)`, and `getDesignSettingSummary(settings)`. Update `nextGeneration(board, { wrapping = true } = {})` and neighbor counting so existing behavior remains toroidal by default.

- [ ] **Step 4: Implement tutorial catalog**

Export `getTutorialCatalog()` and `getTutorialGroups()` with starter, builder, and masterwork tutorials. Use existing `patternId`s where loadable; mark non-local masterworks as reference lessons with `sourceUrl`.

- [ ] **Step 5: Verify tests pass**

Run: `npm test -- src/design-settings.test.js src/tutorials.test.js src/life.test.js`

Expected: PASS.

---

### Task 3: Community Metadata Persistence

**Files:**
- Modify: `src/community.js`
- Modify: `src/community.test.js`
- Modify: `src/community-repository.js`
- Modify: `src/community-repository.test.js`

- [ ] **Step 1: Write failing community persistence tests**

Add tests like:

```js
test('creation drafts persist Dev Studio design settings', () => {
  const draft = createCreationDraft({
    id: 'creation-themed',
    profile: createProfile({ email: 'theme@example.com', displayName: 'Theme Builder' }),
    title: 'Neon gun',
    rle: 'x = 1, y = 1, rule = B3/S23\no!',
    width: 120,
    height: 90,
    settings: { width: 120, height: 90, liveCellColor: '#ff00aa', wrapping: false },
  });

  assert.equal(draft.currentVersion.settings.liveCellColor, '#ff00aa');
  assert.equal(draft.currentVersion.settings.wrapping, false);
});

test('comments increase comment count without mutating original creation', () => {
  const creation = createCreationDraft({
    id: 'creation-commented',
    title: 'Commented',
    rle: 'x = 1, y = 1, rule = B3/S23\no!',
  });

  const commented = addCreationComment(creation, {
    profileId: 'profile-a',
    authorName: 'Ada',
    body: 'This remix chain is readable.',
    now: () => '2026-06-30T20:00:00.000Z',
  });

  assert.equal(creation.commentCount, 0);
  assert.equal(commented.commentCount, 1);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- src/community.test.js src/community-repository.test.js`

Expected: FAIL because settings/comments are not persisted yet.

- [ ] **Step 3: Implement metadata persistence**

Add `settings`, `comments`, and `commentCount` fields to creation drafts, copy settings/comments appropriately during clone, and pass `input.settings` through repository save paths. Keep Supabase RPC payload unchanged unless a value is already supported by schema.

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- src/community.test.js src/community-repository.test.js`

Expected: PASS.

---

### Task 4: Full-Screen Workspace UI

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/app.js`

- [ ] **Step 1: Update the HTML shell**

Create a top-level workspace dock with Playground, Dev Studio, and Community. Replace the Playground tool row with Draw and Stamp only. Add Dev Studio controls for profile stats, project list, grid dimensions, wrapping, render style, trail intensity, theme colors, tutorials, save draft, and publish. Add Community controls for search/filter, famous/trending/new/remix feeds, detail, comment input, and actions: Star, Comment, Copy, Remix, Open in Playground, Open in Dev Studio.

- [ ] **Step 2: Style separate workspace layouts**

Use `.playground-mode`, `.dev-mode`, and `.community-mode` classes. Playground stays open and minimal. Dev mode gets a left project rail and right inspector around the board. Community mode becomes a full-screen browse surface with the board dimmed behind a stream/detail layout. Add `.stamp-cursor`, `.is-stamping`, `.feedback-toast`, `.cell-feedback`, and reduced-motion rules.

- [ ] **Step 3: Wire workspace behavior**

Update `setMode()` to clear active stamp when leaving board workspaces, render workspace-specific profile/project/feed state, and keep settings clicks from changing stamp state. Update keyboard shortcuts so `1` selects Draw and `2` toggles Stamp; no visible Erase shortcut remains in Playground.

- [ ] **Step 4: Wire Dev customization**

Add handlers for grid preset/custom width/height, wrapping, render style, trail intensity, and color inputs. Apply settings to rendering immediately, mark the draft dirty, and include `state.designSettings` in `saveCurrentCreation()`.

- [ ] **Step 5: Wire tutorials and saved projects**

Render tutorial cards from `src/tutorials.js`; clicking a loadable tutorial loads its pattern and switches Stamp on. Render saved projects from community state; clicking opens a saved design into the board with its persisted settings.

- [ ] **Step 6: Wire Community feed/detail/comment actions**

Render famous designs, trending designs, new designs, and remixes. Show detail for the selected design, wire Star/Copy/Remix/Open actions to existing repository functions, and store demo comments through `addCreationComment` for local UI feedback.

---

### Task 5: Verification, Commit, And Push On Main

**Files:**
- Verify all modified source, tests, and docs.

- [ ] **Step 1: Run full automated tests**

Run: `npm test`

Expected: all Node tests pass.

- [ ] **Step 2: Run whitespace check**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Browser smoke test**

Start: `npm run dev`

Verify:
- Playground has Draw and Stamp, no visible Erase.
- Stamp remains active across repeated placements until toggled off.
- Settings clicks do not change active stamp status.
- Dev Studio changes grid size and colors, then saves/publishes with settings.
- Community shows famous/trending feed, detail, comments, star/copy/remix/open actions.
- Mobile viewport does not overlap major controls.

- [ ] **Step 4: Commit on main**

Run:

```bash
git status --short --branch
git add docs/superpowers/plans/2026-06-30-workspace-redesign.md src index.html package.json package-lock.json
git commit -m "Implement workspace redesign"
```

- [ ] **Step 5: Push main**

Run:

```bash
git push origin main
```

Expected: push succeeds and `main` tracks `origin/main`.

