import test from 'node:test';
import assert from 'node:assert/strict';
import { importGuestCreation, packManifestBatches } from './guest-import.js';

const creation = { id: 'local-1', title: 'Glider', description: 'A useful glider pattern.', tags: ['motion'], currentVersion: { id: 'v1', versionNumber: 1, rle: 'x = 1, y = 1, rule = B3/S23\no!', width: 1, height: 1, population: 1 } };

test('staged import uploads a manifest and commits only the captured revision', async () => {
  const calls = [];
  const cloud = {
    startImport: async (input) => (calls.push(['start', input]), { importId: 'i1' }),
    putImportManifest: async (...args) => calls.push(['manifest', ...args]),
    putImportVersion: async (...args) => calls.push(['version', ...args]),
    completeImport: async () => ({ creation: { id: 'cloud-1' }, mapping: { cloudProjectId: 'cloud-1' } }),
  };
  const local = {
    captureImportSnapshot: async () => ({ creation, revision: 3, importKey: 'key-1' }),
    commitImportedSnapshot: async (_id, snapshot, mapping) => ({ removed: snapshot.revision === 3, mapping }),
  };
  const result = await importGuestCreation(creation, cloud, local);
  assert.deepEqual(calls.map(([type]) => type), ['start', 'manifest', 'version']);
  assert.equal(result.localRemoved, true);
});

test('staged import retains a project edited during upload', async () => {
  const cloud = { startImport: async () => ({ importId: 'i1' }), putImportManifest: async () => {}, putImportVersion: async () => {}, completeImport: async () => ({ creation: { id: 'cloud-1' }, mapping: {} }) };
  const local = { captureImportSnapshot: async () => ({ creation, revision: 3, importKey: 'key' }), commitImportedSnapshot: async () => ({ removed: false }) };
  const result = await importGuestCreation(creation, cloud, local);
  assert.equal(result.changedDuringImport, true);
});

test('manifest batches honour both their entry and byte limits', () => {
  const entries = Array.from({ length: 5 }, (_, index) => ({ localVersionId: `v${index}`, byteLength: 5_000_000 }));
  const batches = packManifestBatches(entries);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map((batch) => batch.length), [4, 1]);
  assert.throws(() => packManifestBatches([{ localVersionId: 'too-large', byteLength: 20_000_001 }]), /byte limit/);
});
