import {
  cellIndex,
  createBoard,
  nextGeneration,
} from './life.js';

export const introTitle = 'THE GAME OF LIFE';

const LETTER_HEIGHT = 7;
const LETTER_SPACING = 1;
const WORD_SPACING = 3;
const TYPE_INTERVAL = 72;
const LIFE_STEP_INTERVAL = 105;
const LIFE_PLAY_DURATION = 4000;

const glyphs = {
  A: [
    '01110',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001',
  ],
  E: [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '11111',
  ],
  F: [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '10000',
  ],
  G: [
    '01111',
    '10000',
    '10000',
    '10111',
    '10001',
    '10001',
    '01110',
  ],
  H: [
    '10001',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001',
  ],
  I: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '11111',
  ],
  L: [
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '11111',
  ],
  M: [
    '10001',
    '11011',
    '10101',
    '10101',
    '10001',
    '10001',
    '10001',
  ],
  O: [
    '01110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110',
  ],
  T: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
  ],
  V: [
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01010',
    '00100',
  ],
};

export function getIntroVisibleText(visibleCount) {
  return introTitle.slice(0, Math.max(0, Math.min(introTitle.length, visibleCount)));
}

export function createIntroBoard(text = introTitle) {
  const normalized = text.toUpperCase();
  const width = getTextWidth(normalized);
  const board = createBoard(Math.max(1, width), LETTER_HEIGHT);
  let cursorX = 0;

  for (const char of normalized) {
    if (char === ' ') {
      cursorX += WORD_SPACING;
      continue;
    }

    const glyph = glyphs[char];
    if (!glyph) continue;

    for (let y = 0; y < glyph.length; y += 1) {
      for (let x = 0; x < glyph[y].length; x += 1) {
        if (glyph[y][x] === '1') {
          board.cells[cellIndex(board, cursorX + x, y)] = 1;
        }
      }
    }

    cursorX += glyph[0].length + LETTER_SPACING;
  }

  return board;
}

export function mountLandingIntro({
  layer,
  canvas,
  prompt,
  startButton,
  onComplete = () => {},
  now = () => performance.now(),
  raf = (callback) => requestAnimationFrame(callback),
} = {}) {
  if (!layer || !canvas || !prompt) {
    onComplete();
    return { start: () => {}, destroy: () => {} };
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  const state = {
    phase: 'typing',
    visibleCount: 0,
    board: createIntroBoard(''),
    lastTypeAt: 0,
    lastStepAt: 0,
    startedAt: 0,
    completed: false,
    destroyed: false,
  };

  function resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * pixelRatio);
    canvas.height = Math.floor(window.innerHeight * pixelRatio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function start() {
    if (state.phase !== 'ready' || state.completed) return;

    if (navigator.vibrate) navigator.vibrate(35);
    state.phase = 'running';
    state.board = createIntroBoard(introTitle);
    state.startedAt = now();
    state.lastStepAt = state.startedAt;
    prompt.textContent = 'RUNNING LIFE';
    if (startButton) startButton.disabled = true;
    layer.classList.add('intro-layer--running');
  }

  function complete() {
    if (state.completed) return;

    state.completed = true;
    layer.classList.add('intro-layer--complete');
    onComplete();
    window.setTimeout(() => {
      layer.hidden = true;
    }, 900);
  }

  function tick(timestamp) {
    if (state.destroyed) return;

    if (state.phase === 'typing') {
      if (timestamp - state.lastTypeAt >= TYPE_INTERVAL) {
        state.visibleCount += 1;
        state.lastTypeAt = timestamp;
        state.board = createIntroBoard(getIntroVisibleText(state.visibleCount));
      }

      if (state.visibleCount >= introTitle.length) {
        state.phase = 'ready';
        prompt.textContent = 'START';
        if (startButton) startButton.disabled = false;
        layer.classList.add('intro-layer--ready');
      }
    }

    if (state.phase === 'running') {
      while (timestamp - state.lastStepAt >= LIFE_STEP_INTERVAL) {
        state.board = nextGeneration(state.board);
        state.lastStepAt += LIFE_STEP_INTERVAL;
      }

      if (timestamp - state.startedAt >= LIFE_PLAY_DURATION) complete();
    }

    draw(ctx, canvas, state);
    raf(tick);
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      start();
    }
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', handleKeydown);
  layer.addEventListener('click', start);
  if (startButton) startButton.addEventListener('click', start);
  raf(tick);

  return {
    start,
    destroy() {
      state.destroyed = true;
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeydown);
      layer.removeEventListener('click', start);
      if (startButton) startButton.removeEventListener('click', start);
    },
  };
}

function getTextWidth(text) {
  let width = 0;

  for (const char of text) {
    if (char === ' ') {
      width += WORD_SPACING;
      continue;
    }

    const glyph = glyphs[char];
    if (glyph) width += glyph[0].length + LETTER_SPACING;
  }

  return Math.max(0, width - LETTER_SPACING);
}

function draw(ctx, canvas, state) {
  const width = window.innerWidth;
  const height = window.innerHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx, width, height);
  drawBoard(ctx, state.board, width, height, state.phase);
}

function drawBackground(ctx, width, height) {
  const cell = 18;

  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, Math.max(width, height));
  gradient.addColorStop(0, 'rgba(17, 24, 39, 0.96)');
  gradient.addColorStop(0.58, 'rgba(8, 13, 23, 0.96)');
  gradient.addColorStop(1, 'rgba(5, 7, 12, 1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.075)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += cell) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y <= height; y += cell) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(94, 234, 212, 0.06)';
  for (let y = 0; y < height; y += cell * 2) {
    for (let x = (y / cell) % 4 === 0 ? 0 : cell; x < width; x += cell * 6) {
      ctx.fillRect(x + 5, y + 5, cell - 9, cell - 9);
    }
  }
}

function drawBoard(ctx, board, width, height, phase) {
  const maxCellWidth = width * 0.72 / board.width;
  const maxCellHeight = height * 0.2 / board.height;
  const cellSize = Math.max(4, Math.min(14, Math.floor(Math.min(maxCellWidth, maxCellHeight))));
  const boardWidth = board.width * cellSize;
  const boardHeight = board.height * cellSize;
  const originX = Math.floor((width - boardWidth) / 2);
  const originY = Math.floor(height * 0.39 - boardHeight / 2);
  const inset = Math.max(1, Math.floor(cellSize * 0.12));

  ctx.save();
  ctx.shadowBlur = phase === 'running' ? 18 : 11;
  ctx.shadowColor = 'rgba(94, 234, 212, 0.62)';

  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      if (!board.cells[y * board.width + x]) continue;

      const px = originX + x * cellSize;
      const py = originY + y * cellSize;
      const shimmer = phase === 'running' && (x + y) % 3 === 0;
      ctx.fillStyle = shimmer ? '#e7fffb' : '#5eead4';
      ctx.fillRect(px + inset, py + inset, cellSize - inset * 2, cellSize - inset * 2);
    }
  }

  ctx.restore();
}
