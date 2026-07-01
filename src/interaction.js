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

export function shouldKeepPointerActiveAfterApply({ pointerMode }) {
  return pointerMode === 'draw' || pointerMode === 'erase' || pointerMode === 'stamp';
}

export function getToolAfterWorkspaceChange({ currentTool }) {
  return currentTool === 'stamp' ? 'draw' : currentTool;
}

export function getToolStatusMessage({ tool, selectedPresetName }) {
  if (tool === 'stamp') {
    return selectedPresetName
      ? `Stamp on: ${selectedPresetName}. Click the board to place copies until you turn Stamp off.`
      : 'Choose a pattern, then turn Stamp on to place repeated copies.';
  }

  return 'Draw mode: drag from empty cells to paint; drag from live cells while paused to erase.';
}

export function getHapticPattern(action) {
  const patterns = {
    stampToggle: [12],
    stampPlace: [8],
    copy: [6, 24, 6],
    save: [10],
  };

  return patterns[action] || [];
}

export function getWheelZoomDelta({ deltaY }) {
  const sensitivity = deltaY > 0 ? 0.0032 : 0.0024;
  return Math.exp(-deltaY * sensitivity);
}
