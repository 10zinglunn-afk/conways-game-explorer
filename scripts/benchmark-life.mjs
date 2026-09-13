import os from 'node:os';
import { createBoard, createLifeStepper } from '../src/life.js';

const sizes = [[300, 200], [600, 600], [1200, 1200], [2048, 2048]];
const densities = [['sparse', 0.005], ['dense', 0.35]];
const wrappings = [['bounded', false], ['wrapped', true]];

function seededBoard(width, height, density, seed) {
  const board = createBoard(width, height);
  let state = seed >>> 0;
  for (let index = 0; index < board.cells.length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    board.cells[index] = state / 0x1_0000_0000 < density ? 1 : 0;
  }
  return board;
}

function median(values) {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

console.log(JSON.stringify({
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  cpu: os.cpus()[0]?.model || 'unknown',
  logicalCpus: os.cpus().length,
}));

for (const [width, height] of sizes) {
  for (const [densityName, density] of densities) {
    for (const [edgeName, wrapping] of wrappings) {
      const samples = [];
      const generations = width >= 1200 ? 3 : 8;
      const sampleCount = width >= 2048 ? 5 : 7;
      for (let sample = 0; sample < sampleCount; sample += 1) {
        const board = seededBoard(width, height, density, 42 + sample * 7919 + width * 31 + (wrapping ? 1 : 0));
        const stepper = createLifeStepper(board, { wrapping });
        stepper.step();
        const start = performance.now();
        for (let generation = 0; generation < generations; generation += 1) stepper.step();
        samples.push((performance.now() - start) / generations);
      }
      console.log(JSON.stringify({ width, height, density: densityName, edges: edgeName,
        generationsPerSample: generations, medianMsPerGeneration: Number(median(samples).toFixed(2)) }));
    }
  }
}
