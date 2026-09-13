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
  createLifeStepper,
} from './life.js';

function referenceGeneration(board, wrapping) {
  const next = createBoard(board.width, board.height);
  next.generation = board.generation + 1;
  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      const neighbors = countNeighbors(board, x, y, { wrapping });
      next.cells[y * board.width + x] = neighbors === 3
        || (board.cells[y * board.width + x] && neighbors === 2) ? 1 : 0;
    }
  }
  return next;
}

for (const wrapping of [true, false]) {
  test(`optimized engine matches reference across partial tiles and edges (wrapping=${wrapping})`, () => {
    let random = 1234567;
    for (const [width, height] of [[1, 1], [2, 3], [3, 2], [31, 33], [65, 67], [128, 96]]) {
      let expected = createBoard(width, height);
      for (let i = 0; i < expected.cells.length; i += 1) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        expected.cells[i] = random / 4294967296 < 0.3 ? 1 : 0;
      }
      const stepper = createLifeStepper(expected, { wrapping });
      for (let generation = 0; generation < 25; generation += 1) {
        expected = referenceGeneration(expected, wrapping);
        const actual = stepper.step();
        assert.deepEqual(actual.cells, expected.cells, `${width}x${height} generation ${generation}`);
        assert.equal(actual.generation, expected.generation);
        assert.equal(actual.population, expected.cells.reduce((sum, value) => sum + value, 0));
      }
      const snapshot = stepper.snapshot();
      const preserved = snapshot.cells.slice();
      stepper.step();
      stepper.step();
      assert.deepEqual(snapshot.cells, preserved);
    }
  });
}

test('optimized simulation carries a spaceship across empty tile and world boundaries', () => {
  const coordinates = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
  let expected = placePattern(createBoard(97, 99), coordinates, 94, 96);
  const stepper = createLifeStepper(expected);
  for (let generation = 0; generation < 160; generation += 1) {
    expected = referenceGeneration(expected, true);
    assert.deepEqual(stepper.step().cells, expected.cells);
  }
});

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
