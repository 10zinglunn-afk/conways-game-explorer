import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIntroBoard,
  getIntroFlowStepAfterChoice,
  getIntroPanelCopy,
  getIntroCompletionClasses,
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

test('intro completion removes ready and running chrome states while fading out', () => {
  assert.deepEqual(getIntroCompletionClasses(['intro-layer--ready', 'intro-layer--running']), {
    add: ['intro-layer--complete'],
    remove: ['intro-layer--ready', 'intro-layer--running'],
  });
});

test('intro starts with mode choices before asking for a profile', () => {
  const copy = getIntroPanelCopy('mode');

  assert.equal(copy.title, 'Choose Mode');
  assert.equal(copy.primaryAction, 'Playground');
  assert.equal(copy.secondaryAction, 'Develop');
  assert.equal(copy.showProfileFields, false);
});

test('playground intro choice enters the board immediately', () => {
  assert.equal(getIntroFlowStepAfterChoice('playground'), 'complete');
});

test('develop intro choice asks for a profile before entering Dev Studio', () => {
  assert.equal(getIntroFlowStepAfterChoice('develop'), 'profile');
});
