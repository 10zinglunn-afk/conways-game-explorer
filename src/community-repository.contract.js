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
    const source = await repo.saveCreation({ title: 'Signal Gate', rle: SAMPLE_RLE }, { publish: true });
    const remix = await repo.cloneCreation(source.id, profile);
    assert.equal(remix.visibility, 'private');
    assert.equal(remix.remixedFromId, source.id);
    assert.equal(remix.rootCreationId, source.id);
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
