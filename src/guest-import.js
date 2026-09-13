const encoder = new TextEncoder();
export const IMPORT_MANIFEST_MAX_ENTRIES = 40;
export const IMPORT_MANIFEST_MAX_BYTES = 20_000_000;

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(value, cryptoImpl = globalThis.crypto) {
  const digest = await cryptoImpl.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function importGuestCreation(creation, cloudRepo, localRepo, { chunkBytes = 700_000, deferCleanup = false } = {}) {
  const snapshot = await localRepo.captureImportSnapshot(creation.id);
  const versions = [...(snapshot.creation.versions || [snapshot.creation.currentVersion])]
    .sort((left, right) => left.versionNumber - right.versionNumber);
  const manifest = [];
  for (const version of versions) {
    const rle = String(version.rle || '');
    manifest.push({
      localVersionId: version.id,
      parentLocalVersionId: version.parentVersionId || null,
      byteLength: encoder.encode(rle).byteLength,
      digest: await sha256(rle),
      settings: version.settings || null,
      createdAt: version.createdAt || null,
      metadata: {
        width: version.width, height: version.height, generation: version.generation,
        population: version.population, rule: version.rule || 'B3/S23', versionNumber: version.versionNumber,
      },
    });
  }
  const manifestDigest = await sha256(canonicalJson(manifest));
  const started = await cloudRepo.startImport({
    importKey: snapshot.importKey,
    localProjectId: snapshot.creation.id,
    capturedRevision: snapshot.revision,
    project: {
      title: snapshot.creation.title, description: snapshot.creation.description, tags: snapshot.creation.tags,
      attribution: snapshot.creation.attribution || '', tutorialReference: snapshot.creation.tutorialReference || '',
      previewConfig: snapshot.creation.previewConfig || {}, remixedFromId: snapshot.creation.remixedFromId || null,
      rootCreationId: snapshot.creation.rootCreationId || null,
    },
    currentLocalVersionId: snapshot.creation.currentVersion.id,
    totalVersionCount: manifest.length,
    manifestDigest,
  });
  if (!started.imported && started.status !== 'complete') {
    for (const [batch, entries] of packManifestBatches(manifest).entries()) {
      await cloudRepo.putImportManifest(started.importId, batch, { entries, digest: await sha256(canonicalJson(entries)) });
    }
    for (let index = 0; index < versions.length; index += 1) {
      const version = versions[index];
      const entry = manifest[index];
      const bytes = encoder.encode(String(version.rle || ''));
      for (let offset = 0; offset < bytes.length || offset === 0; offset += chunkBytes) {
        const data = new TextDecoder().decode(bytes.slice(offset, Math.min(bytes.length, offset + chunkBytes)));
        await cloudRepo.putImportVersion(started.importId, version.id, {
          offset, totalBytes: bytes.length, digest: entry.digest, data, metadata: entry.metadata,
        });
        if (!bytes.length) break;
      }
    }
  }
  const result = started.imported || started.status === 'complete' ? started : await cloudRepo.completeImport(started.importId);
  if (!result.creation && result.mapping?.cloudProjectId && cloudRepo.loadCommunityState) await cloudRepo.loadCommunityState();
  const readable = result.creation
    || cloudRepo.findCreation?.(result.mapping?.cloudProjectId)
    || await cloudRepo.getCreation?.(result.mapping?.cloudProjectId);
  if (!readable) throw Object.assign(new Error('Imported project was not readable after completion.'), { code: 'IMPORT_NOT_READABLE' });
  const committed = await localRepo.commitImportedSnapshot(snapshot.creation.id, snapshot, result.mapping, { retain: deferCleanup });
  return { ...result, snapshot, creation: readable, localRemoved: committed.removed, changedDuringImport: !committed.removed };
}

export function packManifestBatches(entries, {
  maxEntries = IMPORT_MANIFEST_MAX_ENTRIES,
  maxBytes = IMPORT_MANIFEST_MAX_BYTES,
} = {}) {
  const batches = [];
  let batch = [];
  let bytes = 0;
  for (const entry of entries) {
    const entryBytes = Number(entry?.byteLength || 0);
    if (!Number.isFinite(entryBytes) || entryBytes < 1 || entryBytes > maxBytes) {
      throw new Error('An import version exceeds the manifest batch byte limit.');
    }
    if (batch.length && (batch.length >= maxEntries || bytes + entryBytes > maxBytes)) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(entry);
    bytes += entryBytes;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export async function migrateGuestProjects(localRepo, cloudRepo, options = {}) {
  const localState = await localRepo.loadCommunityState();
  const results = [];
  for (const creation of localState.creations) results.push(await importGuestCreation(creation, cloudRepo, localRepo, options));
  return { migratedCreations: results.map((result) => result.creation), results };
}
