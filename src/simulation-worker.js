import { createLifeStepper } from './life.js';

let engine = null;
let epoch = 0;
let operation = 0;

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'load') {
      epoch = data.epoch;
      operation += 1;
      engine = createLifeStepper(data.board, { wrapping: data.wrapping });
      self.postMessage({ type: 'ready', epoch });
      return;
    }
    if (data.type === 'cancel' && data.epoch === epoch) {
      operation += 1;
      return;
    }
    if (data.type !== 'advance' || data.epoch !== epoch || !engine) return;
    const token = ++operation;
    const target = Math.min(100_000, Math.max(1, Math.floor(data.count)));
    let completed = 0;
    let lastSnapshot = performance.now();
    function chunk() {
      if (token !== operation) return;
      const start = performance.now();
      do {
        engine.step();
        completed += 1;
      } while (completed < target && performance.now() - start < 10);
      const now = performance.now();
      if (completed === target || now - lastSnapshot >= 50) {
        const board = engine.snapshot();
        self.postMessage({ type: 'snapshot', epoch, requestId: data.requestId,
          completed, done: completed === target, board }, [board.cells.buffer]);
        lastSnapshot = now;
      }
      if (completed < target) setTimeout(chunk, 0);
    }
    chunk();
  } catch (error) {
    self.postMessage({ type: 'error', epoch: data?.epoch ?? epoch,
      requestId: data?.requestId, code: 'WORKER_ERROR', message: error?.message || 'Simulation failed.' });
  }
};
