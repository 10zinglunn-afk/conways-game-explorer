import { forEachRleCell } from '../src/patterns.js';

export const PRIVATE_RLE_BYTES_MAX = 5_000_000;
export const PUBLIC_RLE_BYTES_MAX = 200_000;
export const PUBLIC_LIVE_CELLS_MAX = 200_000;

export function validateVersionInput(input, { publication = false } = {}) {
  const rle = String(input?.rle || '');
  const bytes = new TextEncoder().encode(rle).byteLength;
  const byteLimit = publication ? PUBLIC_RLE_BYTES_MAX : PRIVATE_RLE_BYTES_MAX;
  if (!bytes || bytes > byteLimit) {
    throw validationError(publication
      ? 'Published RLE must be between 1 byte and 200 KB.'
      : 'Private RLE must be between 1 byte and 5 MB.');
  }

  let parsed;
  try {
    parsed = forEachRleCell(rle, () => {});
  } catch (error) {
    throw validationError(error.message, 'INVALID_RLE');
  }
  if (publication && parsed.population > PUBLIC_LIVE_CELLS_MAX) {
    throw validationError('Published patterns may contain at most 200,000 live cells.');
  }

  const width = integer(input?.width ?? input?.settings?.width ?? parsed.width);
  const height = integer(input?.height ?? input?.settings?.height ?? parsed.height);
  if (width !== parsed.width || height !== parsed.height) {
    throw validationError('RLE dimensions, version dimensions, and settings dimensions must agree.');
  }
  for (const [key, expected] of [['width', width], ['height', height]]) {
    if (input?.settings?.[key] !== undefined && integer(input.settings[key]) !== expected) {
      throw validationError('RLE dimensions, version dimensions, and settings dimensions must agree.');
    }
  }
  const generation = integer(input?.generation ?? 0);
  if (generation < 0) throw validationError('Generation must be a non-negative integer.');

  return {
    ...input,
    rle,
    width,
    height,
    generation,
    population: parsed.population,
    rule: parsed.rule,
    settings: input?.settings && typeof input.settings === 'object' && !Array.isArray(input.settings)
      ? input.settings : {},
  };
}

function integer(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw validationError('Version dimensions and counters must be integers.');
  return number;
}

function validationError(message, code = 'VERSION_VALIDATION_FAILED') {
  return Object.assign(new Error(message), { status: 422, code });
}
