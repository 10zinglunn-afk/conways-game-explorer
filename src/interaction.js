export function getLiveToolAction({ playing, alive }) {
  if (!playing && alive) return 'erase';
  return 'draw';
}

export function getNextTool({ currentTool, requestedTool }) {
  if (currentTool === 'stamp' && requestedTool === 'stamp') return 'draw';
  return requestedTool;
}

export function shouldHideStampPreview({ currentTool, requestedTool }) {
  return currentTool === 'stamp' && requestedTool === 'stamp';
}

export function getWheelZoomDelta({ deltaY }) {
  const sensitivity = deltaY > 0 ? 0.0032 : 0.0024;
  return Math.exp(-deltaY * sensitivity);
}
