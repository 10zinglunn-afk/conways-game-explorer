import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeRle,
  getPatternBounds,
  normalizeCoordinates,
  parseRle,
} from './patterns.js';

test('calculates pattern bounds from sparse coordinates', () => {
  assert.deepEqual(getPatternBounds([[3, 2], [5, 6], [4, 4]]), {
    minX: 3,
    minY: 2,
    maxX: 5,
    maxY: 6,
    width: 3,
    height: 5,
  });
});

test('normalizes coordinates to start at zero', () => {
  assert.deepEqual(normalizeCoordinates([[4, 3], [6, 5], [5, 3]]), [
    [0, 0],
    [1, 0],
    [2, 2],
  ]);
});

test('parses RLE with run counts and comments', () => {
  const pattern = parseRle(`#N Glider
x = 3, y = 3, rule = B3/S23
bo$2bo$3o!`);

  assert.equal(pattern.width, 3);
  assert.equal(pattern.height, 3);
  assert.deepEqual(pattern.coordinates, [
    [1, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ]);
});

test('encodes coordinates as compact RLE', () => {
  assert.equal(encodeRle([
    [1, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ]), 'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!');
});
