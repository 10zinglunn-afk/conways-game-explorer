import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeShareLink, decodeShareLink } from './share.js';

const creation = {
  title: 'Glider Clock',
  description: 'A timing experiment.',
  tags: ['glider', 'clock'],
  ownerName: 'Grace Hopper',
  remixedFromId: null,
  currentVersion: { rle: 'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!' },
};

test('encodes a creation into a build hash on the given origin', () => {
  const link = encodeShareLink(creation, { origin: 'https://example.com/app/' });
  assert.equal(link.startsWith('https://example.com/app/#build='), true);
});

test('round-trips a creation through encode then decode', () => {
  const link = encodeShareLink(creation, { origin: 'https://example.com/' });
  const decoded = decodeShareLink(link);

  assert.equal(decoded.title, 'Glider Clock');
  assert.deepEqual(decoded.tags, ['glider', 'clock']);
  assert.equal(decoded.ownerName, 'Grace Hopper');
  assert.equal(decoded.rle, creation.currentVersion.rle);
});

test('decodes from a bare hash fragment', () => {
  const link = encodeShareLink(creation);
  const decoded = decodeShareLink(link);
  assert.equal(decoded.title, 'Glider Clock');
});

test('returns null when there is no build payload', () => {
  assert.equal(decodeShareLink('#mode=community'), null);
  assert.equal(decodeShareLink(''), null);
});

test('returns null for a malformed payload', () => {
  assert.equal(decodeShareLink('#build=not-json'), null);
});

test('returns null when the payload lacks an rle string', () => {
  const link = `#build=${encodeURIComponent(JSON.stringify({ title: 'No RLE' }))}`;
  assert.equal(decodeShareLink(link), null);
});
