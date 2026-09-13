import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from './life.js';
import {
  boardToRle, boardFromRle, stampInto, createBoardHistory, transformSelection,
  copySelection, pasteSelection,
} from './board-tools.js';

test('saving an experiment preserves empty margins and actual cell positions', () => {
  const board = createBoard(1024, 1024);
  stampInto(board, [[0, 0], [3, 4], [31, 2]], 480, 220);
  assert.deepEqual(boardFromRle(boardToRle(board)).cells, board.cells);
  assert.deepEqual(boardFromRle(boardToRle(createBoard(64, 64))).cells, createBoard(64, 64).cells);
});

test('undo and redo preserve independent snapshots, including grid size', () => {
  const history = createBoardHistory();
  const board = createBoard(64, 64);
  history.record(board);
  board.cells[10] = 1;
  const previous = history.undo(board);
  assert.equal(previous.cells[10], 0);
  assert.equal(history.redo(previous).cells[10], 1);
});

test('rotating a selected object leaves cells outside the selection untouched', () => {
  const board = createBoard(64, 64);
  stampInto(board, [[0, 0], [1, 0], [2, 0]], 20, 20);
  board.cells[0] = 1;
  const result = transformSelection(board, { x: 20, y: 20, width: 3, height: 1 }, { rotation: 90 });
  assert.equal(result.board.cells[0], 1);
  assert.equal(result.board.cells[20 * 64 + 21], 0);
  assert.equal(result.board.cells[22 * 64 + 20], 1);
});

test('selection transforms retain rectangular empty margins and paste geometry', () => {
  const board = createBoard(64, 64);
  stampInto(board, [[0, 0], [2, 1]], 20, 20);
  const selection = { x: 20, y: 20, width: 4, height: 3 };
  const rotated = transformSelection(board, selection, { rotation: 90 });
  assert.deepEqual(rotated.rect, { x: 20, y: 20, width: 3, height: 4 });
  assert.equal(rotated.board.cells[20 * 64 + 22], 1);
  assert.equal(rotated.board.cells[22 * 64 + 21], 1);

  const clipboard = copySelection(board, selection);
  const pasted = pasteSelection(board, clipboard, 40, 40, { rotation: 90, flipX: true });
  assert.deepEqual(pasted.rect, { x: 40, y: 40, width: 3, height: 4 });
  assert.equal(pasted.board.cells[40 * 64 + 40], 1);
  assert.equal(pasted.board.cells[42 * 64 + 41], 1);
});

test('history applies one combined entry and byte budget across undo and redo', () => {
  const history = createBoardHistory({ maxBytes: 128, maxEntries: 2 });
  const first = createBoard(8, 8);
  const second = createBoard(8, 8);
  second.cells[1] = 1;
  const third = createBoard(8, 8);
  third.cells[2] = 1;
  history.record(first);
  history.record(second);
  assert.equal(history.entryCount, 2);
  assert.equal(history.byteSize, 128);
  const previous = history.undo(third);
  assert.equal(previous.cells[1], 1);
  assert.equal(history.byteSize <= 128, true);
  assert.equal(history.redo(previous).cells[2], 1);
});

test('decodes a full 2048-square board without creating a coordinate pattern', () => {
  const body = `${Array.from({ length: 2048 }, () => '2048o').join('$')}!`;
  const board = boardFromRle(`x = 2048, y = 2048, rule = B3/S23\n${body}`);
  assert.equal(board.cells.length, 2048 * 2048);
  assert.equal(board.cells[0], 1);
  assert.equal(board.cells.at(-1), 1);
});

test('full-board RLE retains placement margins and declared geometry', () => {
  const board = createBoard(48, 32);
  board.cells[23 * board.width + 37] = 1;
  const restored = boardFromRle(boardToRle(board));
  assert.equal(restored.width, 48);
  assert.equal(restored.height, 32);
  assert.equal(restored.cells[23 * restored.width + 37], 1);
  assert.equal(restored.cells[0], 0);
});
