import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCreationComment,
  createCommunityState,
  createCreationDraft,
  createCreationPreviewConfig,
  createOwnerScopedSlug,
  createProfile,
  createRemixTitle,
  cloneCreation,
  getTrendingCreations,
  getCreationPublishReadiness,
  publishCreation,
  toggleStar,
} from './community.js';

test('creates a stable local profile from email and display name', () => {
  const profile = createProfile({
    email: ' Ada@Example.COM ',
    displayName: 'Ada Lovelace',
    now: () => '2026-06-29T12:00:00.000Z',
  });

  assert.equal(profile.id, 'profile-318ee3f0');
  assert.equal(profile.email, 'ada@example.com');
  assert.equal(profile.username, 'ada-lovelace');
  assert.equal(profile.displayName, 'Ada Lovelace');
});

test('creates private drafts with a share payload version', () => {
  const profile = createProfile({
    email: 'grace@example.com',
    displayName: 'Grace Hopper',
    now: () => '2026-06-29T12:00:00.000Z',
  });
  const draft = createCreationDraft({
    id: 'creation-test',
    profile,
    title: 'Glider Clock',
    description: 'A timing experiment.',
    tags: 'glider, clock, logic',
    rle: 'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!',
    width: 300,
    height: 200,
    generation: 42,
    population: 5,
    now: () => '2026-06-29T12:30:00.000Z',
  });

  assert.equal(draft.visibility, 'private');
  assert.equal(draft.slug, 'glider-clock-test');
  assert.deepEqual(draft.tags, ['glider', 'clock', 'logic']);
  assert.equal(draft.currentVersion.rle.includes('bo$2bo$3o!'), true);
  assert.equal(draft.currentVersion.generation, 42);
});

test('names remixes as the player version of the source design', () => {
  assert.equal(
    createRemixTitle({
      sourceTitle: 'Gosper glider gun',
      profile: { displayName: 'Tenzing' },
    }),
    "Tenzing's version of Gosper glider gun",
  );
});

test('names remixes with possessive names that already end in s', () => {
  assert.equal(
    createRemixTitle({
      sourceTitle: 'Pulsar',
      profile: { username: 'jess' },
    }),
    "jess' version of Pulsar",
  );
});

test('creation drafts persist Dev Studio design settings', () => {
  const profile = createProfile({
    email: 'theme@example.com',
    displayName: 'Theme Builder',
    now: () => '2026-06-30T12:00:00.000Z',
  });
  const draft = createCreationDraft({
    id: 'creation-themed',
    profile,
    title: 'Neon gun',
    rle: 'x = 1, y = 1, rule = B3/S23\no!',
    width: 120,
    height: 90,
    settings: {
      width: 120,
      height: 90,
      liveCellColor: '#ff00aa',
      wrapping: false,
      renderStyle: 'glow',
    },
  });

  assert.equal(draft.currentVersion.settings.width, 120);
  assert.equal(draft.currentVersion.settings.height, 90);
  assert.equal(draft.currentVersion.settings.liveCellColor, '#ff00aa');
  assert.equal(draft.currentVersion.settings.wrapping, false);
  assert.equal(draft.currentVersion.settings.renderStyle, 'glow');
});

test('publishes a creation without mutating the original draft', () => {
  const state = createCommunityState();
  const profile = createProfile({ email: 'user@example.com', displayName: 'User' });
  const draft = createCreationDraft({
    id: 'creation-one',
    profile,
    title: 'Block',
    description: 'A stable four-cell still life for beginners.',
    tags: ['still-life'],
    rle: 'x = 2, y = 2, rule = B3/S23\n2o$2o!',
    width: 2,
    height: 2,
  });

  const published = publishCreation(draft, { now: () => '2026-06-29T13:00:00.000Z' });

  assert.equal(state.creations.length, 0);
  assert.equal(draft.visibility, 'private');
  assert.equal(published.visibility, 'public');
  assert.equal(published.publishedAt, '2026-06-29T13:00:00.000Z');
  assert.equal(published.canonicalUrl, '/c/block-one');
  assert.equal(
    publishCreation(published, { now: () => '2026-06-30T13:00:00.000Z' }).publishedAt,
    published.publishedAt,
  );
});

test('reports every publish-readiness issue without mutating the draft', () => {
  const draft = createCreationDraft({
    id: 'creation-empty',
    title: '',
    description: 'Too short',
    tags: [],
    rle: 'x = 0, y = 0, rule = B3/S23\n!',
  });

  const readiness = getCreationPublishReadiness(draft);

  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.checks, { metadata: false, board: false, preview: false });
  assert.deepEqual(readiness.issues.map((issue) => issue.field), ['description', 'tags', 'board']);
  assert.throws(() => publishCreation(draft), { name: 'PublishValidationError' });
  assert.equal(draft.visibility, 'private');
});

test('accepts complete publish metadata and a non-empty valid board', () => {
  const draft = createCreationDraft({
    id: 'creation-ready',
    title: 'Glider Clock',
    description: 'A compact clock that emits a repeating glider signal.',
    tags: ['glider', 'logic'],
    rle: 'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!',
  });

  assert.deepEqual(getCreationPublishReadiness(draft), {
    ready: true,
    issues: [],
    checks: { metadata: true, board: true, preview: true },
  });
});

test('generates a deterministic framed preview with accessible fallback text', () => {
  const creation = createCreationDraft({
    id: 'creation-preview',
    title: 'Preview Glider',
    description: 'A deterministic glider preview for public cards.',
    tags: ['glider'],
    rle: 'x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!',
    settings: { backgroundColor: '#112233', liveCellColor: '#abcdef' },
  });

  const first = createCreationPreviewConfig(creation);
  const second = createCreationPreviewConfig(creation);

  assert.deepEqual(first, second);
  assert.equal(first.version, 1);
  assert.equal(first.camera.mode, 'fit-pattern');
  assert.equal(first.cells.length, 5);
  assert.deepEqual(first.colors, { background: '#112233', live: '#abcdef' });
  assert.match(first.altText, /Preview of Preview Glider: 5 live cells/);
});

test('preserves a selected current-view camera frame when publishing', () => {
  const draft = createCreationDraft({
    id: 'creation-framed',
    title: 'Framed line',
    description: 'A long line with a deliberately cropped default view.',
    tags: ['line'],
    rle: 'x = 10, y = 1, rule = B3/S23\n10o!',
    previewConfig: { camera: { mode: 'current-view', frame: { x: 2, y: 0, width: 4, height: 1 } } },
  });

  const published = publishCreation(draft);

  assert.deepEqual(published.previewConfig.camera, {
    mode: 'current-view',
    frame: { x: 2, y: 0, width: 4, height: 1 },
  });
  assert.match(published.previewConfig.altText, /4 of 10 live cells/);
  assert.equal(published.publishReadiness.preview, true);
});

test('allocates deterministic owner-scoped slug collisions', () => {
  assert.equal(createOwnerScopedSlug('Glider Clock', []), 'glider-clock');
  assert.equal(createOwnerScopedSlug('Glider Clock', ['glider-clock']), 'glider-clock-2');
  assert.equal(
    createOwnerScopedSlug('Glider Clock', ['glider-clock', 'glider-clock-2', 'glider-clock-4']),
    'glider-clock-3',
  );
});

test('stars and unstars creations per profile', () => {
  let creation = {
    id: 'creation-one',
    starCount: 0,
    starredBy: [],
  };

  creation = toggleStar(creation, 'profile-a');
  assert.equal(creation.starCount, 1);
  assert.deepEqual(creation.starredBy, ['profile-a']);

  creation = toggleStar(creation, 'profile-a');
  assert.equal(creation.starCount, 0);
  assert.deepEqual(creation.starredBy, []);
});

test('clones a public creation with remix lineage', () => {
  const profile = createProfile({ email: 'clone@example.com', displayName: 'Clone User' });
  const source = {
    id: 'creation-source',
    title: 'Signal Gate',
    description: 'Published machine.',
    tags: ['gate'],
    ownerId: 'profile-source',
    ownerName: 'Source User',
    visibility: 'public',
    cloneCount: 0,
    starCount: 2,
    viewCount: 3,
    currentVersion: {
      id: 'version-source',
      rle: 'x = 1, y = 1, rule = B3/S23\no!',
      width: 1,
      height: 1,
      generation: 0,
      population: 1,
      rule: 'B3/S23',
    },
    createdAt: '2026-06-29T12:00:00.000Z',
    updatedAt: '2026-06-29T12:00:00.000Z',
    publishedAt: '2026-06-29T12:00:00.000Z',
    remixedFromId: null,
    rootCreationId: 'creation-source',
    starredBy: ['profile-source'],
  };

  const remix = cloneCreation(source, {
    id: 'creation-remix',
    profile,
    now: () => '2026-06-29T14:00:00.000Z',
  });

  assert.equal(remix.visibility, 'private');
  assert.equal(remix.title, "Clone User's version of Signal Gate");
  assert.equal(remix.remixedFromId, 'creation-source');
  assert.equal(remix.rootCreationId, 'creation-source');
  assert.equal(remix.currentVersion.rle, source.currentVersion.rle);
  assert.equal(remix.starCount, 0);
});

test('clones preserve source design settings for remix drafts', () => {
  const profile = createProfile({ email: 'clone@example.com', displayName: 'Clone User' });
  const source = createCreationDraft({
    id: 'creation-source',
    profile,
    title: 'Styled source',
    rle: 'x = 1, y = 1, rule = B3/S23\no!',
    settings: {
      width: 180,
      height: 120,
      liveCellColor: '#22c55e',
      wrapping: false,
    },
  });

  const remix = cloneCreation(source, {
    id: 'creation-remix',
    profile,
    now: () => '2026-06-30T14:00:00.000Z',
  });

  assert.equal(remix.currentVersion.settings.liveCellColor, '#22c55e');
  assert.equal(remix.currentVersion.settings.wrapping, false);
});

test('comments increase comment count without mutating original creation', () => {
  const creation = createCreationDraft({
    id: 'creation-commented',
    title: 'Commented',
    rle: 'x = 1, y = 1, rule = B3/S23\no!',
  });

  const commented = addCreationComment(creation, {
    profileId: 'profile-a',
    authorName: 'Ada',
    body: 'This remix chain is readable.',
    now: () => '2026-06-30T20:00:00.000Z',
  });

  assert.equal(creation.commentCount, 0);
  assert.equal(commented.commentCount, 1);
  assert.equal(commented.comments[0].authorName, 'Ada');
  assert.equal(commented.comments[0].body, 'This remix chain is readable.');
});

test('trending favors recent public creations with activity', () => {
  const creations = [
    {
      id: 'quiet',
      title: 'Quiet',
      visibility: 'public',
      starCount: 1,
      cloneCount: 0,
      viewCount: 0,
      publishedAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'active',
      title: 'Active',
      visibility: 'public',
      starCount: 3,
      cloneCount: 2,
      viewCount: 10,
      publishedAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    },
    {
      id: 'draft',
      title: 'Draft',
      visibility: 'private',
      starCount: 99,
      cloneCount: 99,
      viewCount: 99,
      publishedAt: null,
      updatedAt: '2026-06-29T00:00:00.000Z',
    },
  ];

  const trending = getTrendingCreations(creations, {
    now: () => new Date('2026-06-29T12:00:00.000Z'),
  });

  assert.deepEqual(trending.map((creation) => creation.id), ['active', 'quiet']);
});
