export function getPatternBounds(coordinates) {
  if (coordinates.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of coordinates) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function normalizeCoordinates(coordinates) {
  const bounds = getPatternBounds(coordinates);

  return coordinates
    .map(([x, y]) => [x - bounds.minX, y - bounds.minY])
    .sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
}

export function getPresetGroup(groups, groupId) {
  return groups.find((group) => group.id === groupId) ?? null;
}

export function parseRle(input) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const headerIndex = lines.findIndex((line) => /x\s*=/.test(line) && /y\s*=/.test(line));

  if (headerIndex === -1) {
    throw new Error('RLE is missing a header like "x = 3, y = 3".');
  }

  const header = lines[headerIndex];
  const width = readHeaderNumber(header, 'x');
  const height = readHeaderNumber(header, 'y');
  const body = lines.slice(headerIndex + 1).join('').replace(/\s/g, '');
  const coordinates = [];
  let x = 0;
  let y = 0;
  let run = '';

  for (const token of body) {
    if (/\d/.test(token)) {
      run += token;
      continue;
    }

    const count = run ? Number(run) : 1;
    run = '';

    if (token === 'b') {
      x += count;
    } else if (token === 'o') {
      for (let i = 0; i < count; i += 1) {
        coordinates.push([x + i, y]);
      }
      x += count;
    } else if (token === '$') {
      y += count;
      x = 0;
    } else if (token === '!') {
      break;
    } else {
      throw new Error(`Unsupported RLE token: ${token}`);
    }
  }

  return {
    width,
    height,
    coordinates: normalizeCoordinates(coordinates),
  };
}

export function encodeRle(coordinates) {
  const normalized = normalizeCoordinates(coordinates);
  const bounds = getPatternBounds(normalized);
  const alive = new Set(normalized.map(([x, y]) => `${x},${y}`));
  const rows = [];

  if (normalized.length === 0) {
    return 'x = 0, y = 0, rule = B3/S23\n!';
  }

  for (let y = 0; y < bounds.height; y += 1) {
    let row = '';
    let current = null;
    let run = 0;

    for (let x = 0; x < bounds.width; x += 1) {
      const token = alive.has(`${x},${y}`) ? 'o' : 'b';

      if (token === current) {
        run += 1;
      } else {
        row += encodeRun(run, current);
        current = token;
        run = 1;
      }
    }

    row += encodeRun(run, current);
    rows.push(row.replace(/b+$/, ''));
  }

  return `x = ${bounds.width}, y = ${bounds.height}, rule = B3/S23\n${rows.join('$')}!`;
}

function readHeaderNumber(header, key) {
  const match = header.match(new RegExp(`${key}\\s*=\\s*(\\d+)`));

  if (!match) {
    throw new Error(`RLE header is missing ${key}.`);
  }

  return Number(match[1]);
}

function encodeRun(run, token) {
  if (!token || run === 0) return '';
  return `${run === 1 ? '' : run}${token}`;
}
