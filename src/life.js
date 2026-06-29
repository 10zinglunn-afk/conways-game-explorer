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

export function countNeighbors(board, x, y) {
  let count = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      if (getCell(board, x + dx, y + dy)) count += 1;
    }
  }

  return count;
}

export function nextGeneration(board) {
  const next = createBoard(board.width, board.height);
  next.generation = board.generation + 1;

  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      const alive = getCell(board, x, y);
      const neighbors = countNeighbors(board, x, y);
      const survives = alive && (neighbors === 2 || neighbors === 3);
      const born = !alive && neighbors === 3;
      next.cells[cellIndex(next, x, y)] = survives || born ? 1 : 0;
    }
  }

  return next;
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
