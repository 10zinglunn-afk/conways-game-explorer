import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoard,
  placePattern,
} from './life.js';
import {
  describeDriftClaim,
  describePeriodClaim,
  describePopulationSnapshot,
} from './dev-tools.js';

test('period claim verifies a still life', () => {
  const block = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  const board = placePattern(createBoard(8, 8), block, 3, 3);

  assert.equal(describePeriodClaim(board), 'Verified still life: the board returns after 1 generation.');
});

test('period claim verifies an oscillator', () => {
  const blinker = [
    [0, 1],
    [1, 1],
    [2, 1],
  ];
  const board = placePattern(createBoard(8, 8), blinker, 3, 3);

  assert.equal(describePeriodClaim(board), 'Verified oscillator: the board returns after 2 generations.');
});

test('drift claim verifies a glider translation', () => {
  const glider = [
    [1, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ];
  const board = placePattern(createBoard(20, 20), glider, 4, 4);

  assert.equal(describeDriftClaim(board), 'Verified drift after 4 generations: translated by (1, 1).');
});

test('population snapshot summarizes live cells and density', () => {
  const board = placePattern(createBoard(10, 10), [[0, 0], [1, 0]], 0, 0);

  assert.equal(describePopulationSnapshot(board), 'Generation 0: 2 live cells, 2.00% density.');
});
