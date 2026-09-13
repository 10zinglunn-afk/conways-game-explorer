import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVersionInput } from './version-validation.mjs';

test('cloud version validation derives population and rejects dimension disagreement', () => {
  const valid = validateVersionInput({
    rle: 'x = 40, y = 40, rule = B3/S23\n3o!', width: 40, height: 40,
    population: 999, settings: { width: 40, height: 40 },
  });
  assert.equal(valid.population, 3);
  assert.throws(() => validateVersionInput({ ...valid, width: 41 }), (error) => (
    error.status === 422 && error.code === 'VERSION_VALIDATION_FAILED'
  ));
});

test('publication applies its separate RLE byte and live-cell limits', () => {
  const rle = `x = 1000, y = 201, rule = B3/S23\n${Array(201).fill('1000o').join('$')}!`;
  assert.throws(() => validateVersionInput({ rle, width: 1000, height: 201 }, { publication: true }),
    /at most 200,000 live cells/);
});
