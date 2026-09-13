export function createBoard(width, height, fill = false) {
  return {
    width,
    height,
    generation: 0,
    cells: new Uint8Array(width * height).fill(fill ? 1 : 0),
  };
}

export function cloneBoard(board) {
  return {
    width: board.width,
    height: board.height,
    generation: board.generation,
    cells: new Uint8Array(board.cells),
  };
}

export function wrap(value, size) {
  return ((value % size) + size) % size;
}

export function cellIndex(board, x, y) {
  return wrap(y, board.height) * board.width + wrap(x, board.width);
}

export function getCell(board, x, y) {
  return board.cells[cellIndex(board, x, y)] === 1;
}

export function getCellBounded(board, x, y) {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return false;
  return board.cells[y * board.width + x] === 1;
}

export function setCell(board, x, y, alive) {
  const next = cloneBoard(board);
  next.cells[cellIndex(next, x, y)] = alive ? 1 : 0;
  return next;
}

export function toggleCell(board, x, y) {
  const next = cloneBoard(board);
  const index = cellIndex(next, x, y);
  next.cells[index] = next.cells[index] ? 0 : 1;
  return next;
}

export function countNeighbors(board, x, y, { wrapping = true } = {}) {
  let count = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const alive = wrapping
        ? getCell(board, x + dx, y + dy)
        : getCellBounded(board, x + dx, y + dy);
      if (alive) count += 1;
    }
  }

  return count;
}

export function nextGeneration(board, options = {}) {
  return createLifeStepper(board, options).step();
}

// The interactive runtime retains this stepper in a dedicated Worker. Two cell
// buffers and a one-cell halo avoid allocation and modulo in the inner loop.
// Empty 32x32 regions are skipped; their adjacent regions still run so births
// across tile/world edges obey exactly the same B3/S23 rules.
export function createLifeStepper(seed, { wrapping = true } = {}) {
  const { width, height } = seed;
  const stride = width + 2;
  const tileSize = 32;
  const columns = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);
  let cells = new Uint8Array(seed.cells);
  let next = new Uint8Array(cells.length);
  const halo = new Uint8Array((width + 2) * (height + 2));
  let active = new Uint8Array(columns * rows);
  let following = new Uint8Array(active.length);
  const candidates = new Uint8Array(active.length);
  let generation = seed.generation || 0;
  let population = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (cells[y * width + x]) {
        active[Math.floor(y / tileSize) * columns + Math.floor(x / tileSize)] = 1;
        population += 1;
      }
    }
  }

  return {
    snapshot() { return { width, height, generation, population, cells: new Uint8Array(cells) }; },
    step() {
      for (let y = 0; y < height; y += 1) {
        const source = y * width;
        const target = (y + 1) * stride + 1;
        halo.set(cells.subarray(source, source + width), target);
        if (wrapping) {
          halo[target - 1] = cells[source + width - 1];
          halo[target + width] = cells[source];
        }
      }
      if (wrapping) {
        halo.set(halo.subarray(height * stride, (height + 1) * stride), 0);
        halo.set(halo.subarray(stride, stride * 2), (height + 1) * stride);
      }
      candidates.fill(0);
      for (let ty = 0; ty < rows; ty += 1) {
        for (let tx = 0; tx < columns; tx += 1) {
          if (!active[ty * columns + tx]) continue;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              let x = tx + dx;
              let y = ty + dy;
              if (wrapping) {
                x = (x + columns) % columns;
                y = (y + rows) % rows;
              } else if (x < 0 || y < 0 || x >= columns || y >= rows) continue;
              candidates[y * columns + x] = 1;
            }
          }
        }
      }
      next.fill(0);
      following.fill(0);
      population = 0;
      for (let ty = 0; ty < rows; ty += 1) {
        for (let tx = 0; tx < columns; tx += 1) {
          const tile = ty * columns + tx;
          if (!candidates[tile]) continue;
          const endY = Math.min(height, (ty + 1) * tileSize);
          const endX = Math.min(width, (tx + 1) * tileSize);
          for (let y = ty * tileSize; y < endY; y += 1) {
            let index = y * width + tx * tileSize;
            let h = (y + 1) * stride + tx * tileSize + 1;
            for (let x = tx * tileSize; x < endX; x += 1, index += 1, h += 1) {
              const neighbors = halo[h - stride - 1] + halo[h - stride] + halo[h - stride + 1]
                + halo[h - 1] + halo[h + 1]
                + halo[h + stride - 1] + halo[h + stride] + halo[h + stride + 1];
              if (neighbors === 3 || (halo[h] === 1 && neighbors === 2)) {
                next[index] = 1;
                following[tile] = 1;
                population += 1;
              }
            }
          }
        }
      }
      [cells, next] = [next, cells];
      [active, following] = [following, active];
      generation += 1;
      // Borrowed until the next step. snapshot() returns an owned copy.
      return { width, height, generation, population, cells };
    },
  };
}

export function placePattern(board, coordinates, originX, originY) {
  const next = cloneBoard(board);

  for (const [x, y] of coordinates) {
    next.cells[cellIndex(next, originX + x, originY + y)] = 1;
  }

  return next;
}

export function clearBoard(board) {
  return createBoard(board.width, board.height);
}

export function getPopulation(board) {
  let count = 0;

  for (const cell of board.cells) {
    count += cell;
  }

  return count;
}

export function createRandomBoard(width, height, density = 0.18, random = Math.random) {
  const board = createBoard(width, height);

  for (let i = 0; i < board.cells.length; i += 1) {
    board.cells[i] = random() < density ? 1 : 0;
  }

  return board;
}
