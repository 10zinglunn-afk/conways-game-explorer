// Backend-agnostic contract for a community repository (plan 2.8).
//
// Any implementation — local-first today, Supabase tomorrow — must pass this
// suite. It exercises ONLY the public async interface, so it makes no assumption
// about storage. Call it with a `makeRepo` factory that returns a fresh, empty
// repository (with a deterministic profile already saved where noted).
import test from 'node:test';
import assert from 'node:assert/strict';

const SAMPLE_RLE = 'x = 1, y = 1, rule = B3/S23\no!';

export function runCommunityRepositoryContract(label, makeRepo) {
  const fresh = async () => {
    const repo = await makeRepo();
    return repo;
  };

  const withProfile = async () => {
    const repo = await fresh();
    await repo.saveProfile({ email: 'user@example.com', displayName: 'User' });
    return repo;
  };

  test(`[${label}] saveProfile stores the profile`, async () => {
    const repo = await fresh();
    const profile = await repo.saveProfile({ email: 'ada@example.com', displayName: 'Ada Lovelace' });
    assert.equal(profile.username, 'ada-lovelace');
    assert.equal(repo.getState().profile.id, profile.id);
  });

  test(`[${label}] saveCreation creates a private draft and marks it active`, async () => {
    const repo = await withProfile();
    const draft = await repo.saveCreation({ title: 'Glider Clock', tags: 'glider, clock', rle: SAMPLE_RLE });
    assert.equal(draft.visibility, 'private');
    assert.equal(repo.getState().activeCreationId, draft.id);
    assert.equal(repo.findCreation(draft.id).id, draft.id);
  });

  test(`[${label}] createCreation and saveVersion keep one project with immutable snapshots`, async () => {
    const repo = await withProfile();
    const creation = await repo.createCreation({ title: 'Versioned', rle: SAMPLE_RLE });
    const updated = await repo.saveVersion(creation.id, {
      rle: 'x = 2, y = 1, rule = B3/S23\n2o!',
      width: 120,
      height: 80,
      population: 2,
      settings: { gridPreset: 'small', speed: 17, wrapping: false },
    });
    const versions = await repo.listVersions(creation.id);

    assert.equal(updated.id, creation.id);
    assert.equal(repo.getState().creations.length, 1);
    assert.equal(updated.currentVersion.versionNumber, 2);
    assert.equal(updated.currentVersion.parentVersionId, creation.currentVersion.id);
    assert.equal(updated.currentVersion.settings.speed, 17);
    assert.equal(updated.currentVersion.settings.wrapping, false);
    assert.deepEqual(versions.map((version) => version.versionNumber), [2, 1]);
    assert.equal((await repo.loadVersion(creation.id, creation.currentVersion.id)).rle, SAMPLE_RLE);
  });

  test(`[${label}] updateCreationMetadata edits mutable project fields without replacing versions`, async () => {
    const repo = await withProfile();
    const creation = await repo.createCreation({ title: 'Metadata', rle: SAMPLE_RLE });
    const updated = await repo.updateCreationMetadata(creation.id, {
      title: 'Metadata Updated',
      description: 'A durable description.',
      tags: ['logic', 'clock'],
      attribution: 'Based on a public-domain pattern.',
      tutorialReference: 'tutorial-glider-clock',
      previewConfig: { alt: 'A two-cell preview' },
      publishReadiness: { metadata: true },
    });

    assert.equal(updated.title, 'Metadata Updated');
    assert.deepEqual(updated.tags, ['logic', 'clock']);
    assert.equal(updated.attribution, 'Based on a public-domain pattern.');
    assert.equal(updated.currentVersion.id, creation.currentVersion.id);
    assert.equal((await repo.listVersions(creation.id)).length, 1);
  });

  test(`[${label}] restoreVersion appends a new snapshot instead of mutating history`, async () => {
    const repo = await withProfile();
    const creation = await repo.createCreation({ title: 'Restore', rle: SAMPLE_RLE });
    await repo.saveVersion(creation.id, {
      rle: 'x = 2, y = 1, rule = B3/S23\n2o!',
      width: 120,
      height: 80,
      population: 2,
      settings: { gridPreset: 'small' },
    });
    const restored = await repo.restoreVersion(creation.id, creation.currentVersion.id);
    const versions = await repo.listVersions(creation.id);

    assert.equal(restored.currentVersion.rle, SAMPLE_RLE);
    assert.equal(restored.currentVersion.versionNumber, 3);
    assert.equal(restored.currentVersion.parentVersionId, creation.currentVersion.id);
    assert.deepEqual(versions.map((version) => version.versionNumber), [3, 2, 1]);
  });

  test(`[${label}] unpublish, archive, and delete enforce the project lifecycle`, async () => {
    const repo = await withProfile();
    const creation = await repo.createCreation({ title: 'Lifecycle', rle: SAMPLE_RLE }, { publish: true });
    const unpublished = await repo.unpublishCreation(creation.id);
    const archived = await repo.archiveCreation(creation.id);

    assert.equal(unpublished.visibility, 'private');
    assert.equal(unpublished.publishedAt, null);
    assert.ok(archived.archivedAt);
    assert.equal(await repo.saveVersion(creation.id, { rle: SAMPLE_RLE }), null);
    assert.equal(await repo.deleteCreation(creation.id), true);
    assert.equal(repo.findCreation(creation.id), null);
    assert.equal(await repo.deleteCreation(creation.id), false);
  });

  test(`[${label}] saveCreation persists design settings metadata`, async () => {
    const repo = await withProfile();
    const draft = await repo.saveCreation({
      title: 'Styled build',
      rle: SAMPLE_RLE,
      width: 180,
      height: 120,
      settings: {
        width: 180,
        height: 120,
        liveCellColor: '#ff00aa',
        wrapping: false,
        renderStyle: 'glow',
      },
    });

    assert.equal(draft.currentVersion.settings.liveCellColor, '#ff00aa');
    assert.equal(draft.currentVersion.settings.wrapping, false);
    assert.equal(repo.findCreation(draft.id).currentVersion.settings.renderStyle, 'glow');
  });

  test(`[${label}] saveCreation with publish flag publishes immediately`, async () => {
    const repo = await withProfile();
    const creation = await repo.saveCreation({ title: 'Block', rle: SAMPLE_RLE }, { publish: true });
    assert.equal(creation.visibility, 'public');
    assert.ok(creation.publishedAt);
  });

  test(`[${label}] publishCreation publishes an existing draft by id`, async () => {
    const repo = await withProfile();
    const draft = await repo.saveCreation({ title: 'Draft', rle: SAMPLE_RLE });
    const published = await repo.publishCreation(draft.id);
    assert.equal(published.visibility, 'public');
    assert.equal(repo.findCreation(draft.id).visibility, 'public');
  });

  test(`[${label}] publishCreation returns null for an unknown id`, async () => {
    const repo = await withProfile();
    assert.equal(await repo.publishCreation('missing'), null);
  });

  test(`[${label}] toggleStar stars and unstars per profile`, async () => {
    const repo = await withProfile();
    const draft = await repo.saveCreation({ title: 'Build', rle: SAMPLE_RLE }, { publish: true });
    let starred = await repo.toggleStar(draft.id, 'profile-a');
    assert.equal(starred.starCount, 1);
    starred = await repo.toggleStar(draft.id, 'profile-a');
    assert.equal(starred.starCount, 0);
  });

  test(`[${label}] cloneCreation records lineage and increments the source clone count`, async () => {
    const repo = await withProfile();
    const profile = repo.getState().profile;
    const source = await repo.saveCreation({
      title: 'Signal Gate',
      rle: SAMPLE_RLE,
      settings: {
        liveCellColor: '#22c55e',
        wrapping: false,
      },
    }, { publish: true });
    const remix = await repo.cloneCreation(source.id, profile);
    assert.equal(remix.visibility, 'private');
    assert.equal(remix.remixedFromId, source.id);
    assert.equal(remix.rootCreationId, source.id);
    assert.equal(remix.currentVersion.settings.liveCellColor, '#22c55e');
    assert.equal(remix.currentVersion.settings.wrapping, false);
    assert.equal(repo.findCreation(source.id).cloneCount, 1);
  });

  test(`[${label}] listTrendingCreations returns only published creations`, async () => {
    const repo = await withProfile();
    await repo.saveCreation({ title: 'Private', rle: SAMPLE_RLE });
    const published = await repo.saveCreation({ title: 'Public', rle: SAMPLE_RLE }, { publish: true });
    const trending = await repo.listTrendingCreations();
    assert.deepEqual(trending.map((creation) => creation.id), [published.id]);
  });
}
