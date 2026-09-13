import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCircuitExperiment,
  circuitExperiments,
  createCircuitStepper,
  readCircuitOutputs,
  resetCircuitExperiment,
} from './circuits.js';

const CASES = [
  ['and', { a: false, b: false }, [false]],
  ['and', { a: false, b: true }, [false]],
  ['and', { a: true, b: false }, [false]],
  ['and', { a: true, b: true }, [true]],
  ['or', { a: false, b: false }, [false]],
  ['or', { a: false, b: true }, [true]],
  ['or', { a: true, b: false }, [true]],
  ['or', { a: true, b: true }, [true]],
  ['not', { a: false }, [true]],
  ['not', { a: true }, [false]],
  ['half-adder', { a: false, b: false }, [false, false]],
  ['half-adder', { a: false, b: true }, [true, false]],
  ['half-adder', { a: true, b: false }, [true, false]],
  ['half-adder', { a: true, b: true }, [false, true]],
];

test('curated circuits keep source, finite-signal, and port metadata', () => {
  assert.deepEqual(circuitExperiments.map((experiment) => experiment.id), ['and', 'or', 'not', 'half-adder']);
  for (const experiment of circuitExperiments) {
    assert.equal(experiment.finiteSignals, true);
    assert.match(experiment.source.url, /^https:\/\//);
    assert.ok(experiment.outputs.length > 0);
  }
});

test('circuit outputs are read from evolved probe cells for every input combination', () => {
  for (const [id, inputs, expected] of CASES) {
    const experiment = buildCircuitExperiment(id, inputs);
    const stepper = createCircuitStepper(experiment);
    let board = experiment.board;
    while (board.generation < experiment.observeGeneration) board = stepper.step();

    const observed = readCircuitOutputs(experiment, board);
    assert.equal(observed.every((output) => output.settled), true, `${id} settles at its documented generation`);
    assert.deepEqual(observed.map((output) => output.high), expected, `${id} ${JSON.stringify(inputs)}`);
    for (const output of observed) assert.equal(output.population, output.high ? 9 : 0);
  }
});

test('startup probe activity is not reported as a settled boolean and reset reconstructs cells', () => {
  const experiment = buildCircuitExperiment('half-adder', { a: false, b: false });
  const stepper = createCircuitStepper(experiment);
  let board = experiment.board;
  while (board.generation < experiment.observeGeneration - 1) board = stepper.step();

  const early = readCircuitOutputs(experiment, board);
  assert.deepEqual(early.map((output) => output.high), [null, null]);

  const reset = resetCircuitExperiment(experiment);
  assert.equal(reset.board.generation, 0);
  assert.deepEqual(reset.board.cells, experiment.authoredBoard.cells);
  assert.deepEqual(reset.inputs, experiment.inputs);
});
