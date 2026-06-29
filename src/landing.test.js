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
