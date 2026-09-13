import { createBoard, cloneBoard } from './life.js';
import { forEachRleCell } from './patterns.js';

export function boardToRle(board) {
  const rows = [];
  for (let y = 0; y < board.height; y += 1) {
    const offset = y * board.width;
    let end = board.width - 1;
    while (end >= 0 && !board.cells[offset + end]) end -= 1;
    let row = '';
    let x = 0;
    while (x <= end) {
      const alive = board.cells[offset + x];
      let count = 1;
      while (x + count <= end && board.cells[offset + x + count] === alive) count += 1;
      row += `${count > 1 ? count : ''}${alive ? 'o' : 'b'}`;
      x += count;
    }
    rows.push(row);
  }
  while (rows.length && !rows.at(-1)) rows.pop();
  const body = rows.join('$').replace(/\${2,}/g, (run) => `${run.length}$`);
  return `x = ${board.width}, y = ${board.height}, rule = B3/S23\n${body}!`;
}

export function boardFromRle(rle, { generation = 0, width, height } = {}) {
  const parsed = forEachRleCell(rle, () => {});
  const targetWidth = width ?? parsed.width;
  const targetHeight = height ?? parsed.height;
  if (targetWidth < parsed.width || targetHeight < parsed.height) {
    throw new Error('Target board cannot crop the declared RLE dimensions.');
  }
  const board = createBoard(targetWidth, targetHeight);
  forEachRleCell(rle, (x, y) => { board.cells[y * board.width + x] = 1; });
  board.generation = generation;
  return board;
}

export function liveCoordinates(board, rect = null) {
  const coordinates = [];
  const area = rect || { x: 0, y: 0, width: board.width, height: board.height };
  for (let y = Math.max(0, area.y); y < Math.min(board.height, area.y + area.height); y += 1) {
    for (let x = Math.max(0, area.x); x < Math.min(board.width, area.x + area.width); x += 1) {
      if (board.cells[y * board.width + x]) coordinates.push([x, y]);
    }
  }
  return coordinates;
}

export function stampInto(board, coordinates, originX, originY, { erase = false } = {}) {
  for (const [dx, dy] of coordinates) {
    const x = Math.round(originX + dx);
    const y = Math.round(originY + dy);
    if (x >= 0 && y >= 0 && x < board.width && y < board.height) board.cells[y * board.width + x] = erase ? 0 : 1;
  }
  return board;
}

export function transformSelection(board, rect, options) {
  const selected = liveCoordinates(board, rect).map(([x, y]) => [x - rect.x, y - rect.y]);
  const next = cloneBoard(board);
  stampInto(next, selected, rect.x, rect.y, { erase: true });
  const { coordinates: transformed, width, height } = transformRectangleCoordinates(selected, rect, options);
  stampInto(next, transformed, rect.x, rect.y);
  return { board: next, rect: { x: rect.x, y: rect.y, width, height } };
}

export function copySelection(board, rect) {
  const coordinates = liveCoordinates(board, rect).map(([x, y]) => [x - rect.x, y - rect.y]);
  return { width: rect.width, height: rect.height, coordinates };
}

export function pasteSelection(board, clipboard, originX, originY, options = {}) {
  const { coordinates, width, height } = transformRectangleCoordinates(
    clipboard?.coordinates || [],
    clipboard || { width: 0, height: 0 },
    options,
  );
  const next = cloneBoard(board);
  stampInto(next, coordinates, originX, originY);
  return { board: next, rect: { x: originX, y: originY, width, height } };
}

function transformRectangleCoordinates(coordinates, rect, { rotation = 0, flipX = false } = {}) {
  const sourceWidth = Math.max(0, Math.floor(rect.width));
  const sourceHeight = Math.max(0, Math.floor(rect.height));
  const turns = ((Math.round(rotation / 90) % 4) + 4) % 4;
  let width = sourceWidth;
  let height = sourceHeight;
  let transformed = coordinates.map(([x, y]) => [x, y]);
  if (turns === 1) {
    transformed = coordinates.map(([x, y]) => [sourceHeight - 1 - y, x]);
    [width, height] = [sourceHeight, sourceWidth];
  } else if (turns === 2) {
    transformed = coordinates.map(([x, y]) => [sourceWidth - 1 - x, sourceHeight - 1 - y]);
  } else if (turns === 3) {
    transformed = coordinates.map(([x, y]) => [y, sourceWidth - 1 - x]);
    [width, height] = [sourceHeight, sourceWidth];
  }
  if (flipX) transformed = transformed.map(([x, y]) => [width - 1 - x, y]);
  return { coordinates: transformed, width, height };
}

export function createBoardHistory({ maxBytes = 24 * 1024 * 1024, maxEntries = 40 } = {}) {
  const undo = [];
  const redo = [];
  let nextOrder = 0;
  let totalBytes = 0;
  function push(stack, board) {
    const entry = { board: cloneBoard(board), order: nextOrder += 1 };
    stack.push(entry);
    totalBytes += entry.board.cells.byteLength;
    trim();
  }
  function clear(stack) {
    for (const entry of stack) totalBytes -= entry.board.cells.byteLength;
    stack.length = 0;
  }
  function trim() {
    while ((undo.length + redo.length > maxEntries || totalBytes > maxBytes) && undo.length + redo.length > 1) {
      const stack = !redo.length || (undo.length && undo[0].order < redo[0].order) ? undo : redo;
      const [entry] = stack.splice(0, 1);
      totalBytes -= entry.board.cells.byteLength;
    }
  }
  return {
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
    get byteSize() { return totalBytes; },
    get entryCount() { return undo.length + redo.length; },
    record(board) { push(undo, board); clear(redo); },
    undo(board) {
      if (!undo.length) return null;
      const previous = undo.pop();
      totalBytes -= previous.board.cells.byteLength;
      push(redo, board);
      return previous.board;
    },
    redo(board) {
      if (!redo.length) return null;
      const next = redo.pop();
      totalBytes -= next.board.cells.byteLength;
      push(undo, board);
      return next.board;
    },
    clear() { clear(undo); clear(redo); },
  };
}
