import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLiveToolAction,
  getNextTool,
  getToolAfterWorkspaceChange,
  getToolStatusMessage,
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

test('stamp tool toggles back to draw when clicked while already active', () => {
  assert.equal(getNextTool({ currentTool: 'stamp', requestedTool: 'stamp' }), 'draw');
});

test('stamp preview hides after the active stamp tool is clicked again', () => {
  assert.equal(shouldHideStampPreview({ currentTool: 'stamp', requestedTool: 'stamp' }), true);
});

test('non-stamp tools still switch directly', () => {
  assert.equal(getNextTool({ currentTool: 'draw', requestedTool: 'erase' }), 'erase');
  assert.equal(getNextTool({ currentTool: 'erase', requestedTool: 'stamp' }), 'stamp');
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

test('switching workspaces clears active stamp state', () => {
  assert.equal(getToolAfterWorkspaceChange({ currentTool: 'stamp' }), 'draw');
  assert.equal(getToolAfterWorkspaceChange({ currentTool: 'draw' }), 'draw');
});
