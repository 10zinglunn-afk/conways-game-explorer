import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoard,
  countNeighbors,
  nextGeneration,
  setCell,
  toggleCell,
  getCell,
  placePattern,
} from './life.js';

test('counts neighbors across toroidal board edges', () => {
  let board = createBoard(5, 5);
  board = setCell(board, 4, 4, true);
  board = setCell(board, 0, 4, true);
  board = setCell(board, 4, 0, true);

  assert.equal(countNeighbors(board, 0, 0), 3);
});

test('bounded neighbor counts do not wrap across board edges', () => {
  let board = createBoard(5, 5);
  board = setCell(board, 4, 4, true);
  board = setCell(board, 0, 4, true);
  board = setCell(board, 4, 0, true);

  assert.equal(countNeighbors(board, 0, 0, { wrapping: false }), 0);
});

test('births a dead cell with exactly three live neighbors', () => {
  let board = createBoard(5, 5);
  board = setCell(board, 1, 0, true);
  board = setCell(board, 1, 1, true);
  board = setCell(board, 1, 2, true);

  const next = nextGeneration(board);

  assert.equal(getCell(next, 0, 1), true);
});

test('bounded generation does not birth cells from wrapped neighbors', () => {
  let board = createBoard(3, 3);
  board = setCell(board, 0, 0, true);
  board = setCell(board, 2, 0, true);
  board = setCell(board, 0, 2, true);

  const wrapped = nextGeneration(board);
  const bounded = nextGeneration(board, { wrapping: false });

  assert.equal(getCell(wrapped, 2, 2), true);
  assert.equal(getCell(bounded, 2, 2), false);
});

test('kills a live cell with fewer than two live neighbors', () => {
  let board = createBoard(5, 5);
  board = setCell(board, 2, 2, true);
  board = setCell(board, 2, 3, true);

  const next = nextGeneration(board);

  assert.equal(getCell(next, 2, 2), false);
});

test('kills a live cell with more than three live neighbors', () => {
  let board = createBoard(5, 5);
  board = setCell(board, 2, 2, true);
  board = setCell(board, 1, 1, true);
  board = setCell(board, 2, 1, true);
  board = setCell(board, 3, 1, true);
  board = setCell(board, 1, 2, true);

  const next = nextGeneration(board);

  assert.equal(getCell(next, 2, 2), false);
});

test('keeps a live cell with two or three live neighbors', () => {
  let board = createBoard(5, 5);
  board = setCell(board, 2, 2, true);
  board = setCell(board, 1, 2, true);
  board = setCell(board, 3, 2, true);

  const next = nextGeneration(board);

  assert.equal(getCell(next, 2, 2), true);
});

test('toggles cells and wraps negative coordinates', () => {
  let board = createBoard(4, 4);
  board = toggleCell(board, -1, -1);

  assert.equal(getCell(board, 3, 3), true);
});

test('places pattern centered on wrapped coordinates', () => {
  const glider = [
    [1, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ];

  const board = placePattern(createBoard(6, 6), glider, 5, 5);

  assert.equal(getCell(board, 0, 5), true);
  assert.equal(getCell(board, 1, 0), true);
});
