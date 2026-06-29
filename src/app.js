import {
  cellIndex,
  clearBoard,
  createBoard,
  createRandomBoard,
  getPopulation,
  nextGeneration,
  placePattern,
  wrap,
} from './life.js';
import { presets } from './presets.js';

const WORLD_WIDTH = 300;
const WORLD_HEIGHT = 200;
const BASE_CELL_SIZE = 10;
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 3.6;

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d', { alpha: false });

const elements = {
  playToggle: document.querySelector('#play-toggle'),
  playLabel: document.querySelector('#play-label'),
  step: document.querySelector('#step'),
  clear: document.querySelector('#clear'),
  randomize: document.querySelector('#randomize'),
  speed: document.querySelector('#speed'),
  speedLabel: document.querySelector('#speed-label'),
  zoom: document.querySelector('#zoom'),
  zoomLabel: document.querySelector('#zoom-label'),
  presets: document.querySelector('#presets'),
  presetCount: document.querySelector('#preset-count'),
  generation: document.querySelector('#generation'),
  population: document.querySelector('#population'),
  density: document.querySelector('#density'),
  boardSize: document.querySelector('#board-size'),
  activeNote: document.querySelector('#active-note'),
  toolButtons: document.querySelectorAll('[data-tool]'),
};

const state = {
  board: createBoard(WORLD_WIDTH, WORLD_HEIGHT),
  trail: new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT),
  playing: false,
  speed: 10,
  zoom: 1,
  panX: 0,
  panY: 0,
  tool: 'draw',
  pointer: {
    active: false,
    mode: 'draw',
    lastCell: null,
    lastX: 0,
    lastY: 0,
  },
  lastTick: 0,
  accumulator: 0,
};

function resizeCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function centerWorld() {
  const cellSize = getCellSize();
  state.panX = (window.innerWidth - state.board.width * cellSize) / 2;
  state.panY = (window.innerHeight - state.board.height * cellSize) / 2;
}

function getCellSize() {
  return BASE_CELL_SIZE * state.zoom;
}

function screenToCell(clientX, clientY) {
  const cellSize = getCellSize();
  return {
    x: Math.floor((clientX - state.panX) / cellSize),
    y: Math.floor((clientY - state.panY) / cellSize),
  };
}

function setZoom(nextZoom, anchorX = window.innerWidth / 2, anchorY = window.innerHeight / 2) {
  const previousCellSize = getCellSize();
  const worldX = (anchorX - state.panX) / previousCellSize;
  const worldY = (anchorY - state.panY) / previousCellSize;

  state.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));

  const nextCellSize = getCellSize();
  state.panX = anchorX - worldX * nextCellSize;
  state.panY = anchorY - worldY * nextCellSize;
  elements.zoom.value = Math.round(state.zoom * 100);
  elements.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function paintCell(cellX, cellY, alive) {
  const x = wrap(cellX, state.board.width);
  const y = wrap(cellY, state.board.height);
  const index = cellIndex(state.board, x, y);
  const nextValue = alive ? 1 : 0;

  if (state.board.cells[index] === nextValue) return;

  state.board.cells[index] = nextValue;
  state.trail[index] = alive ? 255 : 120;
  updateStats();
}

function applyToolAt(clientX, clientY) {
  const cell = screenToCell(clientX, clientY);
  const key = `${wrap(cell.x, state.board.width)},${wrap(cell.y, state.board.height)}`;

  if (state.pointer.lastCell === key) return;

  if (state.pointer.mode === 'draw') paintCell(cell.x, cell.y, true);
  if (state.pointer.mode === 'erase') paintCell(cell.x, cell.y, false);

  state.pointer.lastCell = key;
}

function stepSimulation() {
  const previousCells = state.board.cells;
  const next = nextGeneration(state.board);

  for (let i = 0; i < state.trail.length; i += 1) {
    if (next.cells[i]) {
      state.trail[i] = previousCells[i] ? Math.max(state.trail[i], 210) : 255;
    } else if (previousCells[i]) {
      state.trail[i] = Math.max(state.trail[i], 140);
    } else {
      state.trail[i] = Math.floor(state.trail[i] * 0.84);
    }
  }

  state.board = next;
  updateStats();
}

function loadPreset(preset) {
  const nextBoard = clearBoard(state.board);
  const bounds = getPatternBounds(preset.coordinates);
  const originX = Math.floor(state.board.width / 2 - bounds.width / 2);
  const originY = Math.floor(state.board.height / 2 - bounds.height / 2);

  state.board = placePattern(nextBoard, preset.coordinates, originX, originY);
  state.trail.fill(0);

  for (let i = 0; i < state.board.cells.length; i += 1) {
    if (state.board.cells[i]) state.trail[i] = 255;
  }

  elements.activeNote.textContent = preset.note;
  updateStats();
}

function getPatternBounds(coordinates) {
  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  return {
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
  };
}

function randomSoup() {
  state.board = createRandomBoard(WORLD_WIDTH, WORLD_HEIGHT, 0.18);
  state.trail.fill(0);

  for (let i = 0; i < state.board.cells.length; i += 1) {
    if (state.board.cells[i]) state.trail[i] = 230;
  }

  elements.activeNote.textContent = 'Random soup: turbulence first, then islands, oscillators, and debris.';
  updateStats();
}

function clearWorld() {
  state.board = clearBoard(state.board);
  state.trail.fill(0);
  elements.activeNote.textContent = 'The world is empty. Draw a seed or load a preset.';
  updateStats();
}

function render() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const cellSize = getCellSize();
  const worldWidth = state.board.width * cellSize;
  const worldHeight = state.board.height * cellSize;

  ctx.fillStyle = '#07090f';
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.max(width, height));
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(0.48, '#0a0f18');
  gradient.addColorStop(1, '#05070c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(state.panX, state.panY);

  ctx.fillStyle = '#080d14';
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  drawGrid(cellSize, worldWidth, worldHeight);
  drawCells(cellSize);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, worldWidth - 1, worldHeight - 1);

  ctx.restore();

  drawTorusHints(width, height);
}

function drawGrid(cellSize, worldWidth, worldHeight) {
  if (cellSize < 5) return;

  const alpha = Math.min(0.16, Math.max(0.04, (cellSize - 4) / 80));
  ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();

  const startX = Math.max(0, Math.floor(-state.panX / cellSize) - 1);
  const endX = Math.min(state.board.width, Math.ceil((window.innerWidth - state.panX) / cellSize) + 1);
  const startY = Math.max(0, Math.floor(-state.panY / cellSize) - 1);
  const endY = Math.min(state.board.height, Math.ceil((window.innerHeight - state.panY) / cellSize) + 1);

  for (let x = startX; x <= endX; x += 1) {
    const px = x * cellSize;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, worldHeight);
  }

  for (let y = startY; y <= endY; y += 1) {
    const py = y * cellSize;
    ctx.moveTo(0, py);
    ctx.lineTo(worldWidth, py);
  }

  ctx.stroke();
}

function drawCells(cellSize) {
  const inset = cellSize > 8 ? 1 : 0;
  const startX = Math.max(0, Math.floor(-state.panX / cellSize) - 1);
  const endX = Math.min(state.board.width, Math.ceil((window.innerWidth - state.panX) / cellSize) + 1);
  const startY = Math.max(0, Math.floor(-state.panY / cellSize) - 1);
  const endY = Math.min(state.board.height, Math.ceil((window.innerHeight - state.panY) / cellSize) + 1);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = y * state.board.width + x;
      const trail = state.trail[index];
      const alive = state.board.cells[index] === 1;

      if (!alive && trail < 8) continue;

      if (alive) {
        ctx.shadowColor = 'rgba(94, 234, 212, 0.58)';
        ctx.shadowBlur = cellSize > 5 ? Math.min(14, cellSize * 0.8) : 0;
        ctx.fillStyle = trail > 245 ? '#e7fffb' : '#5eead4';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(56, 189, 248, ${trail / 760})`;
      }

      ctx.fillRect(
        x * cellSize + inset,
        y * cellSize + inset,
        Math.max(1, cellSize - inset * 2),
        Math.max(1, cellSize - inset * 2),
      );
    }
  }

  ctx.shadowBlur = 0;
}

function drawTorusHints(width, height) {
  ctx.save();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('wrapped edges: north touches south, west touches east', 24, height - 24);
  ctx.restore();
}

function updateStats() {
  const population = getPopulation(state.board);
  const density = population / state.board.cells.length;

  elements.generation.textContent = state.board.generation.toLocaleString();
  elements.population.textContent = population.toLocaleString();
  elements.density.textContent = `${(density * 100).toFixed(2)}%`;
  elements.boardSize.textContent = `${state.board.width} x ${state.board.height}`;
}

function updatePlayButton() {
  elements.playLabel.textContent = state.playing ? 'Pause' : 'Play';
  elements.playToggle.querySelector('.button-icon').textContent = state.playing ? 'Ⅱ' : '▶';
  elements.playToggle.setAttribute('aria-label', state.playing ? 'Pause simulation' : 'Play simulation');
}

function setTool(tool) {
  state.tool = tool;

  for (const button of elements.toolButtons) {
    const active = button.dataset.tool === tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-checked', String(active));
  }
}

function renderPresets() {
  elements.presetCount.textContent = `${presets.length}`;
  elements.presets.innerHTML = '';

  for (const preset of presets) {
    const button = document.createElement('button');
    button.className = 'preset';
    button.type = 'button';
    button.innerHTML = `
      <span class="preset-name">${preset.name}</span>
      <span class="preset-note">${preset.note}</span>
    `;
    button.addEventListener('click', () => loadPreset(preset));
    elements.presets.append(button);
  }
}

function bindEvents() {
  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    state.pointer.active = true;
    state.pointer.mode = event.button === 1 || event.altKey ? 'pan' : state.tool;
    state.pointer.lastCell = null;
    state.pointer.lastX = event.clientX;
    state.pointer.lastY = event.clientY;

    if (state.pointer.mode !== 'pan') applyToolAt(event.clientX, event.clientY);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.pointer.active) return;

    if (state.pointer.mode === 'pan') {
      state.panX += event.clientX - state.pointer.lastX;
      state.panY += event.clientY - state.pointer.lastY;
      state.pointer.lastX = event.clientX;
      state.pointer.lastY = event.clientY;
      return;
    }

    applyToolAt(event.clientX, event.clientY);
  });

  canvas.addEventListener('pointerup', (event) => {
    canvas.releasePointerCapture(event.pointerId);
    state.pointer.active = false;
    state.pointer.lastCell = null;
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * 0.002);
      setZoom(state.zoom * factor, event.clientX, event.clientY);
      return;
    }

    state.panX -= event.deltaX;
    state.panY -= event.deltaY;
  }, { passive: false });

  elements.playToggle.addEventListener('click', () => {
    state.playing = !state.playing;
    updatePlayButton();
  });

  elements.step.addEventListener('click', () => {
    stepSimulation();
  });

  elements.clear.addEventListener('click', () => {
    clearWorld();
  });

  elements.randomize.addEventListener('click', () => {
    randomSoup();
  });

  elements.speed.addEventListener('input', () => {
    state.speed = Number(elements.speed.value);
    elements.speedLabel.textContent = `${state.speed} gen/s`;
  });

  elements.zoom.addEventListener('input', () => {
    setZoom(Number(elements.zoom.value) / 100);
  });

  for (const button of elements.toolButtons) {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  }

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) return;

    if (event.key === ' ') {
      event.preventDefault();
      state.playing = !state.playing;
      updatePlayButton();
    }
    if (event.key === '.') stepSimulation();
    if (event.key === '1') setTool('draw');
    if (event.key === '2') setTool('erase');
    if (event.key === '3') setTool('pan');
  });
}

function loop(timestamp) {
  if (!state.lastTick) state.lastTick = timestamp;
  const delta = timestamp - state.lastTick;
  state.lastTick = timestamp;

  if (state.playing) {
    state.accumulator += delta;
    const interval = 1000 / state.speed;

    while (state.accumulator >= interval) {
      stepSimulation();
      state.accumulator -= interval;
    }
  } else {
    for (let i = 0; i < state.trail.length; i += 1) {
      if (!state.board.cells[i] && state.trail[i] > 0) state.trail[i] = Math.floor(state.trail[i] * 0.98);
    }
  }

  render();
  requestAnimationFrame(loop);
}

function boot() {
  resizeCanvas();
  centerWorld();
  renderPresets();
  updateStats();
  updatePlayButton();
  bindEvents();
  randomSoup();
  requestAnimationFrame(loop);
}

boot();
