import { cloneBoard } from './life.js';

export function createSimulationClient({ workerFactory } = {}) {
  const worker = workerFactory?.() || new Worker(new URL('./simulation-worker.js', import.meta.url), { type: 'module' });
  let epoch = 0;
  let requestId = 0;
  let loadedEpoch = null;
  let loading = null;
  let active = null;
  let disposed = false;

  worker.onmessage = ({ data }) => {
    if (disposed || !data || data.epoch !== epoch) return;
    if (data.type === 'ready' && loading?.epoch === data.epoch) {
      loadedEpoch = data.epoch;
      loading.resolve(data.epoch);
      loading = null;
      return;
    }
    if (data.type === 'error') {
      const error = simulationError(data.message || 'Simulation failed.', data.code || 'SIMULATION_ERROR');
      if (loading?.epoch === data.epoch) {
        loading.reject(error);
        loading = null;
      }
      if (active?.id === data.requestId) {
        active.reject(error);
        active = null;
      }
      return;
    }
    if (data.type !== 'snapshot' || active?.id !== data.requestId) return;
    if (!isBoardSnapshot(data.board)) {
      active.reject(simulationError('Simulation returned an invalid board.', 'INVALID_SNAPSHOT'));
      active = null;
      return;
    }
    active.onSnapshot?.(data.board, { completed: data.completed, done: data.done });
    if (data.done) {
      active.resolve(data.board);
      active = null;
    }
  };
  worker.onerror = (event) => {
    const error = simulationError(event?.message || 'Simulation worker stopped unexpectedly.', 'WORKER_ERROR');
    loading?.reject(error);
    loading = null;
    active?.reject(error);
    active = null;
    loadedEpoch = null;
  };

  function cancelActive(message = 'Simulation cancelled.') {
    if (!active) return;
    const cancelled = active;
    active = null;
    worker.postMessage({ type: 'cancel', epoch, requestId: cancelled.id });
    cancelled.reject(abortError(message));
  }

  return {
    get epoch() { return epoch; },
    get isLoaded() { return loadedEpoch === epoch; },
    async load(board, { wrapping = true } = {}) {
      if (disposed) throw simulationError('Simulation client has been disposed.', 'DISPOSED');
      cancelActive('Simulation replaced.');
      loading?.reject(abortError('Simulation load replaced.'));
      epoch += 1;
      loadedEpoch = null;
      const snapshot = cloneBoard(board);
      const promise = new Promise((resolve, reject) => { loading = { epoch, resolve, reject }; });
      worker.postMessage({ type: 'load', epoch, board: snapshot, wrapping: Boolean(wrapping) }, [snapshot.cells.buffer]);
      return promise;
    },
    advance(count, { onSnapshot } = {}) {
      if (disposed) return Promise.reject(simulationError('Simulation client has been disposed.', 'DISPOSED'));
      if (loadedEpoch !== epoch) return Promise.reject(simulationError('Load a board before advancing.', 'NOT_LOADED'));
      cancelActive('Simulation replaced by a newer request.');
      const id = requestId += 1;
      return new Promise((resolve, reject) => {
        active = { id, resolve, reject, onSnapshot };
        worker.postMessage({ type: 'advance', epoch, requestId: id, count });
      });
    },
    cancel() { cancelActive(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelActive('Simulation client disposed.');
      loading?.reject(abortError('Simulation client disposed.'));
      loading = null;
      worker.terminate?.();
    },
  };
}

function isBoardSnapshot(board) {
  return Number.isInteger(board?.width) && Number.isInteger(board?.height)
    && board.width > 0 && board.height > 0
    && Number.isInteger(board?.generation) && board.generation >= 0
    && Number.isInteger(board?.population) && board.population >= 0
    && board.cells instanceof Uint8Array && board.cells.length === board.width * board.height;
}

function simulationError(message, code) {
  return Object.assign(new Error(message), { code });
}

function abortError(message) {
  return Object.assign(new Error(message), { name: 'AbortError', code: 'ABORTED' });
}
