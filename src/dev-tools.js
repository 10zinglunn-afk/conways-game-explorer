import {
  getCell,
  getPopulation,
  nextGeneration,
} from './life.js';

export function describePeriodClaim(board) {
  let candidate = cloneBoardLike(board);

  for (let period = 1; period <= 60; period += 1) {
    candidate = nextGeneration(candidate);

    if (boardsEqual(board, candidate)) {
      return period === 1
        ? 'Verified still life: the board returns after 1 generation.'
        : `Verified oscillator: the board returns after ${period} generations.`;
    }
  }

  return 'No exact repeat found within 60 generations. Try isolating a smaller pattern on a clear board.';
}

export function describeDriftClaim(board) {
  const original = normalizeLiveShape(board);

  if (original.coordinates.length === 0) {
    return 'No live cells to test for drift.';
  }

  if (original.coordinates.length > 80) {
    return 'Too many live cells for a clean drift check. Clear the board or isolate one spaceship.';
  }

  let candidate = cloneBoardLike(board);
  for (let i = 0; i < 4; i += 1) candidate = nextGeneration(candidate);

  const next = normalizeLiveShape(candidate);
  if (sameCoordinateList(original.coordinates, next.coordinates)) {
    const dx = next.minX - original.minX;
    const dy = next.minY - original.minY;

    if (dx === 0 && dy === 0) {
      return 'Shape repeats after 4 generations with no drift.';
    }

    return `Verified drift after 4 generations: translated by (${dx}, ${dy}).`;
  }

  return 'No matching translated shape after 4 generations.';
}

export function describePopulationSnapshot(board) {
  const population = getPopulation(board);
  const density = population / board.cells.length;

  return `Generation ${board.generation.toLocaleString()}: ${population.toLocaleString()} live cells, ${(density * 100).toFixed(2)}% density.`;
}

function cloneBoardLike(board) {
  return {
    width: board.width,
    height: board.height,
    generation: board.generation,
    cells: new Uint8Array(board.cells),
  };
}

function boardsEqual(left, right) {
  if (left.width !== right.width || left.height !== right.height) return false;

  for (let i = 0; i < left.cells.length; i += 1) {
    if (left.cells[i] !== right.cells[i]) return false;
  }

  return true;
}

function normalizeLiveShape(board) {
  const coordinates = [];
  let minX = Infinity;
  let minY = Infinity;

  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      if (!getCell(board, x, y)) continue;

      coordinates.push([x, y]);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
    }
  }

  if (coordinates.length === 0) {
    return { minX: 0, minY: 0, coordinates: [] };
  }

  return {
    minX,
    minY,
    coordinates: coordinates
      .map(([x, y]) => [x - minX, y - minY])
      .sort(([ax, ay], [bx, by]) => ay - by || ax - bx),
  };
}

function sameCoordinateList(left, right) {
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    if (left[i][0] !== right[i][0] || left[i][1] !== right[i][1]) return false;
  }

  return true;
}
