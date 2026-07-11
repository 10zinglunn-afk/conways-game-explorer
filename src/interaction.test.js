import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLiveToolAction,
  getNextTool,
  getStampCta,
  getToolAfterWorkspaceChange,
  getToolStatusMessage,
  getWheelAction,
  shouldHideStampPreview,
  shouldKeepPointerActiveAfterApply,
  getWheelZoomDelta,
} from './interaction.js';

test('live tool erases an already-live cell when paused', () => {
  assert.equal(getLiveToolAction({ playing: false, alive: true }), 'erase');
});

test('live tool draws on empty cells when paused or playing', () => {
  assert.equal(getLiveToolAction({ playing: false, alive: false }), 'draw');
  assert.equal(getLiveToolAction({ playing: true, alive: false }), 'draw');
});

test('live tool does not erase live cells while the simulation is playing', () => {
  assert.equal(getLiveToolAction({ playing: true, alive: true }), 'draw');
});

test('wheel navigation always returns a zoom delta', () => {
  assert.equal(getWheelZoomDelta({ deltaY: -100 }) > 1, true);
  assert.equal(getWheelZoomDelta({ deltaY: 100 }) < 1, true);
});

test('two-finger wheel movement pans the board by default', () => {
  assert.deepEqual(getWheelAction({ deltaX: 42, deltaY: -16, ctrlKey: false, metaKey: false }), {
    type: 'pan',
    panX: -42,
    panY: 16,
  });
});

test('pinch-style wheel movement still zooms around the pointer', () => {
  const action = getWheelAction({ deltaX: 0, deltaY: -80, ctrlKey: true, metaKey: false });

  assert.equal(action.type, 'zoom');
  assert.equal(action.zoomDelta > 1, true);
});

test('stamp tool toggles back to draw when clicked while already active', () => {
  assert.equal(getNextTool({ currentTool: 'stamp', requestedTool: 'stamp' }), 'draw');
});

test('stamp call to action makes the off switch explicit and dangerous', () => {
  assert.deepEqual(getStampCta({ active: true }), {
    label: 'Turn Stamp Off',
    tone: 'danger',
    ariaLabel: 'Turn Stamp mode off',
  });
});

test('inactive stamp call to action asks to turn stamping on', () => {
  assert.deepEqual(getStampCta({ active: false }), {
    label: 'Stamp',
    tone: 'neutral',
    ariaLabel: 'Turn on Stamp mode',
  });
});

test('stamp preview hides after the active stamp tool is clicked again', () => {
  assert.equal(shouldHideStampPreview({ currentTool: 'stamp', requestedTool: 'stamp' }), true);
});

test('non-stamp tools still switch directly', () => {
  assert.equal(getNextTool({ currentTool: 'draw', requestedTool: 'erase' }), 'erase');
  assert.equal(getNextTool({ currentTool: 'erase', requestedTool: 'stamp' }), 'stamp');
  assert.equal(getNextTool({ currentTool: 'draw', requestedTool: 'pan' }), 'pan');
});

test('stamp placement keeps the tool active for repeated placement', () => {
  assert.equal(shouldKeepPointerActiveAfterApply({ pointerMode: 'stamp' }), true);
  assert.equal(shouldKeepPointerActiveAfterApply({ pointerMode: 'draw' }), true);
  assert.equal(shouldKeepPointerActiveAfterApply({ pointerMode: 'pan' }), false);
});

test('stamp status copy describes persistent stamping without paste-once language', () => {
  const message = getToolStatusMessage({
    tool: 'stamp',
    selectedPresetName: 'Gosper glider gun',
  });

  assert.match(message, /Stamp on: Gosper glider gun/);
  assert.doesNotMatch(message, /paste|click the board to paste|Place again/i);
});

test('draw status copy explains drawing-board erasing without a separate erase tool', () => {
  const message = getToolStatusMessage({ tool: 'draw' });

  assert.match(message, /drag from empty cells to paint/i);
  assert.match(message, /drag from live cells while paused to erase/i);
});

test('pan status copy explains board movement directly', () => {
  const message = getToolStatusMessage({ tool: 'pan' });

  assert.match(message, /Pan mode/i);
  assert.match(message, /drag the board/i);
});

test('switching workspaces clears transient canvas tool state', () => {
  assert.equal(getToolAfterWorkspaceChange({ currentTool: 'stamp' }), 'draw');
  assert.equal(getToolAfterWorkspaceChange({ currentTool: 'pan' }), 'draw');
  assert.equal(getToolAfterWorkspaceChange({ currentTool: 'draw' }), 'draw');
});
