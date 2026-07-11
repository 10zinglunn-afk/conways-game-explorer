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
  return currentTool === 'stamp' || currentTool === 'pan' ? 'draw' : currentTool;
}

export function getToolStatusMessage({ tool, selectedPresetName, stampSummary = '' }) {
  if (tool === 'stamp') {
    const summaryCopy = stampSummary ? ` ${stampSummary}.` : '';
    return selectedPresetName
      ? `Stamp on: ${selectedPresetName}.${summaryCopy} Click the board to place copies until you turn Stamp off.`
      : 'Choose a pattern, then turn Stamp on to place repeated copies.';
  }

  if (tool === 'pan') {
    return 'Pan mode: drag the board to move around, then switch back to Draw when you want to edit cells.';
  }

  return 'Draw mode: drag from empty cells to paint; drag from live cells while paused to erase.';
}

export function getStampCta({ active }) {
  return active
    ? {
        label: 'Turn Stamp Off',
        tone: 'danger',
        ariaLabel: 'Turn Stamp mode off',
      }
    : {
        label: 'Stamp',
        tone: 'neutral',
        ariaLabel: 'Turn on Stamp mode',
      };
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

export function getWheelAction({ deltaX = 0, deltaY = 0, ctrlKey = false, metaKey = false }) {
  if (ctrlKey || metaKey) {
    return {
      type: 'zoom',
      zoomDelta: getWheelZoomDelta({ deltaY }),
    };
  }

  return {
    type: 'pan',
    panX: -deltaX,
    panY: -deltaY,
  };
}
