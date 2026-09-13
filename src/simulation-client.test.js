import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from './life.js';
import { createSimulationClient } from './simulation-client.js';

class FakeWorker {
  constructor() {
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(message) {
    this.messages.push(message);
    if (message.type === 'load') queueMicrotask(() => this.emit({ type: 'ready', epoch: message.epoch }));
  }

  emit(data) { this.onmessage?.({ data }); }
  terminate() { this.terminated = true; }
}

const snapshot = (generation, alive = 0) => {
  const board = createBoard(4, 4);
  board.generation = generation;
  board.cells[alive] = 1;
  board.population = 1;
  return board;
};

test('simulation client owns load input and accepts only the active request', async () => {
  const worker = new FakeWorker();
  const client = createSimulationClient({ workerFactory: () => worker });
  const source = snapshot(0, 1);
  await client.load(source);
  source.cells[1] = 0;
  const loaded = worker.messages[0].board;
  assert.equal(loaded.cells[1], 1);

  const first = client.advance(10);
  const firstRequest = worker.messages.at(-1);
  const second = client.advance(1);
  const secondRequest = worker.messages.at(-1);
  await assert.rejects(first, { name: 'AbortError' });
  worker.emit({ type: 'snapshot', epoch: client.epoch, requestId: firstRequest.requestId,
    completed: 10, done: true, board: snapshot(10, 2) });
  worker.emit({ type: 'snapshot', epoch: client.epoch, requestId: secondRequest.requestId,
    completed: 1, done: true, board: snapshot(1, 3) });
  const result = await second;
  assert.equal(result.generation, 1);
  assert.equal(result.cells[3], 1);
});

test('loading after an edit cancels prior work and discards its stale epoch', async () => {
  const worker = new FakeWorker();
  const client = createSimulationClient({ workerFactory: () => worker });
  await client.load(snapshot(0));
  const stale = client.advance(100);
  const staleRequest = worker.messages.at(-1);
  const reload = client.load(snapshot(0, 4));
  await assert.rejects(stale, { name: 'AbortError' });
  await reload;
  worker.emit({ type: 'snapshot', epoch: staleRequest.epoch, requestId: staleRequest.requestId,
    completed: 100, done: true, board: snapshot(100, 5) });
  const fresh = client.advance(1);
  const freshRequest = worker.messages.at(-1);
  worker.emit({ type: 'snapshot', epoch: freshRequest.epoch, requestId: freshRequest.requestId,
    completed: 1, done: true, board: snapshot(1, 4) });
  assert.equal((await fresh).cells[4], 1);
});

test('worker errors retain the last accepted snapshot and reject the active operation', async () => {
  const worker = new FakeWorker();
  const client = createSimulationClient({ workerFactory: () => worker });
  await client.load(snapshot(0));
  const advance = client.advance(1);
  const request = worker.messages.at(-1);
  worker.emit({ type: 'error', epoch: client.epoch, requestId: request.requestId,
    code: 'WORKER_ERROR', message: 'boom' });
  await assert.rejects(advance, { code: 'WORKER_ERROR' });
});
