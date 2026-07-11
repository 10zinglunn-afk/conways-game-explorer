import {
  createDesignSettings,
  serializeDesignSettings,
} from './design-settings.js';

export const COMMUNITY_STORAGE_KEY = 'life-logic-community-v1';

export function createCommunityState(overrides = {}) {
  return {
    profile: null,
    creations: [],
    activeCreationId: null,
    ...overrides,
  };
}

export function createProfile({
  email,
  displayName,
  avatarUrl = '',
  bio = '',
  githubUrl = '',
  linkedinUrl = '',
  now = () => new Date().toISOString(),
} = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(displayName || cleanEmail.split('@')[0] || 'Life Builder').trim();
  const username = slugify(cleanName) || `builder-${hashString(cleanEmail).slice(0, 6)}`;

  return {
    id: `profile-${hashString(cleanEmail || username)}`,
    email: cleanEmail,
    username,
    displayName: cleanName,
    avatarUrl: String(avatarUrl || '').trim(),
    bio: String(bio || '').trim(),
    githubUrl: String(githubUrl || '').trim(),
    linkedinUrl: String(linkedinUrl || '').trim(),
    createdAt: now(),
  };
}

export function createCreationDraft({
  id,
  profile,
  title,
  description = '',
  tags = [],
  rle,
  width,
  height,
  generation = 0,
  population = 0,
  thumbnail = '',
  parentCreation = null,
  settings = null,
  attribution = '',
  tutorialReference = '',
  previewConfig = {},
  publishReadiness = {},
  comments = [],
  now = () => new Date().toISOString(),
} = {}) {
  const createdAt = now();
  const creationId = id || `creation-${hashString(`${profile?.id || 'local'}:${title}:${rle}:${createdAt}`)}`;
  const cleanTitle = String(title || 'Untitled Life build').trim();
  const designInput = {
    ...(settings || {}),
  };

  if (!designInput.gridPreset && (designInput.width || designInput.height || width || height)) {
    designInput.gridPreset = 'custom';
  }
  if (designInput.width === undefined && width !== undefined) designInput.width = width;
  if (designInput.height === undefined && height !== undefined) designInput.height = height;

  const versionSettings = serializeDesignSettings(createDesignSettings(designInput));
  const normalizedComments = normalizeComments(comments);

  const currentVersion = {
    id: `version-${getIdSuffix(creationId)}`,
    versionNumber: 1,
    rle: String(rle || 'x = 0, y = 0, rule = B3/S23\n!'),
    width: Number(width || 0),
    height: Number(height || 0),
    generation: Number(generation || 0),
    population: Number(population || 0),
    rule: 'B3/S23',
    settings: versionSettings,
    parentVersionId: null,
    createdAt,
  };

  return {
    id: creationId,
    title: cleanTitle,
    slug: `${slugify(cleanTitle) || 'life-build'}-${getIdSuffix(creationId)}`,
    description: String(description || '').trim(),
    attribution: String(attribution || '').trim(),
    tutorialReference: String(tutorialReference || '').trim(),
    previewConfig: normalizeObject(previewConfig),
    publishReadiness: normalizeObject(publishReadiness),
    visibility: 'private',
    ownerId: profile?.id || 'profile-local',
    ownerName: profile?.displayName || 'Local Builder',
    thumbnail,
    tags: normalizeTags(tags),
    starCount: 0,
    cloneCount: 0,
    viewCount: 0,
    commentCount: normalizedComments.length,
    comments: normalizedComments,
    starredBy: [],
    remixedFromId: parentCreation?.id || null,
    rootCreationId: parentCreation?.rootCreationId || parentCreation?.id || creationId,
    currentVersion,
    versions: [currentVersion],
    createdAt,
    updatedAt: createdAt,
    publishedAt: null,
    archivedAt: null,
  };
}

export function createCreationVersion(creation, input = {}, {
  id,
  parentVersionId = creation?.currentVersion?.id || null,
  now = () => new Date().toISOString(),
} = {}) {
  if (!creation?.id) throw new Error('A creation is required to save a version.');
  const createdAt = now();
  const existingVersions = getCreationVersions(creation);
  const versionNumber = existingVersions.reduce(
    (highest, version) => Math.max(highest, Number(version.versionNumber || 0)),
    0,
  ) + 1;
  const settings = serializeDesignSettings(createDesignSettings({
    ...(creation.currentVersion?.settings || {}),
    ...(input.settings || {}),
    width: input.width ?? input.settings?.width ?? creation.currentVersion?.width,
    height: input.height ?? input.settings?.height ?? creation.currentVersion?.height,
  }));

  return {
    id: id || `version-${hashString(`${creation.id}:${versionNumber}:${input.rle}:${createdAt}`)}`,
    versionNumber,
    rle: String(input.rle || creation.currentVersion?.rle || 'x = 0, y = 0, rule = B3/S23\n!'),
    width: Number(input.width ?? settings.width),
    height: Number(input.height ?? settings.height),
    generation: Number(input.generation ?? 0),
    population: Number(input.population ?? 0),
    rule: String(input.rule || settings.rule || 'B3/S23'),
    settings,
    parentVersionId,
    createdAt,
  };
}

export function appendCreationVersion(creation, input, options = {}) {
  const version = createCreationVersion(creation, input, options);
  return {
    ...creation,
    currentVersion: version,
    versions: [...getCreationVersions(creation), version],
    updatedAt: version.createdAt,
  };
}

export function updateCreationMetadata(creation, patch = {}, { now = () => new Date().toISOString() } = {}) {
  return {
    ...creation,
    ...(patch.title === undefined ? {} : { title: String(patch.title || '').trim() }),
    ...(patch.description === undefined ? {} : { description: String(patch.description || '').trim() }),
    ...(patch.tags === undefined ? {} : { tags: normalizeTags(patch.tags) }),
    ...(patch.attribution === undefined ? {} : { attribution: String(patch.attribution || '').trim() }),
    ...(patch.tutorialReference === undefined ? {} : { tutorialReference: String(patch.tutorialReference || '').trim() }),
    ...(patch.previewConfig === undefined ? {} : { previewConfig: normalizeObject(patch.previewConfig) }),
    ...(patch.publishReadiness === undefined ? {} : { publishReadiness: normalizeObject(patch.publishReadiness) }),
    updatedAt: now(),
  };
}

export function restoreCreationVersion(creation, versionId, options = {}) {
  const source = getCreationVersions(creation).find((version) => version.id === versionId);
  if (!source) return null;
  return appendCreationVersion(creation, source, {
    ...options,
    parentVersionId: source.id,
  });
}

export function archiveCreation(creation, { now = () => new Date().toISOString() } = {}) {
  const archivedAt = now();
  return {
    ...creation,
    visibility: 'private',
    publishedAt: null,
    archivedAt,
    updatedAt: archivedAt,
  };
}

export function getCreationVersions(creation) {
  const versions = Array.isArray(creation?.versions) ? creation.versions : [];
  const withCurrent = creation?.currentVersion
    && !versions.some((version) => version.id === creation.currentVersion.id)
    ? [...versions, creation.currentVersion]
    : versions;
  return withCurrent
    .map((version, index) => ({
      ...version,
      versionNumber: Number(version.versionNumber || index + 1),
      parentVersionId: version.parentVersionId || null,
    }))
    .sort((left, right) => left.versionNumber - right.versionNumber);
}

export function publishCreation(creation, { now = () => new Date().toISOString() } = {}) {
  const publishedAt = creation.publishedAt || now();

  return {
    ...creation,
    visibility: 'public',
    publishedAt,
    updatedAt: publishedAt,
  };
}

export function unpublishCreation(creation, { now = () => new Date().toISOString() } = {}) {
  return {
    ...creation,
    visibility: 'private',
    publishedAt: null,
    updatedAt: now(),
  };
}

export function toggleStar(creation, profileId) {
  if (!profileId) return creation;

  const starredBy = new Set(creation.starredBy || []);

  if (starredBy.has(profileId)) {
    starredBy.delete(profileId);
  } else {
    starredBy.add(profileId);
  }

  return {
    ...creation,
    starredBy: [...starredBy].sort(),
    starCount: starredBy.size,
  };
}

export function cloneCreation(source, {
  id,
  profile,
  now = () => new Date().toISOString(),
} = {}) {
  return createCreationDraft({
    id,
    profile,
    title: createRemixTitle({ sourceTitle: source.title, profile }),
    description: source.description,
    tags: source.tags,
    attribution: source.attribution,
    tutorialReference: source.tutorialReference,
    previewConfig: source.previewConfig,
    publishReadiness: source.publishReadiness,
    rle: source.currentVersion?.rle,
    width: source.currentVersion?.width,
    height: source.currentVersion?.height,
    generation: source.currentVersion?.generation,
    population: source.currentVersion?.population,
    thumbnail: source.thumbnail,
    settings: source.currentVersion?.settings,
    parentCreation: source,
    now,
  });
}

export function createRemixTitle({ sourceTitle, profile } = {}) {
  const owner = String(profile?.displayName || profile?.username || 'My').trim() || 'My';
  const suffix = owner.toLowerCase().endsWith('s') ? "'" : "'s";
  return `${owner}${suffix} version of ${String(sourceTitle || 'Untitled design').trim() || 'Untitled design'}`;
}

export function addCreationComment(creation, {
  profileId = 'profile-local',
  authorName = 'Life Builder',
  body,
  now = () => new Date().toISOString(),
} = {}) {
  const cleanBody = String(body || '').trim();
  if (!cleanBody) return creation;

  const createdAt = now();
  const comment = {
    id: `comment-${hashString(`${creation.id}:${profileId}:${cleanBody}:${createdAt}`)}`,
    profileId,
    authorName: String(authorName || 'Life Builder').trim(),
    body: cleanBody,
    createdAt,
  };
  const comments = [...normalizeComments(creation.comments), comment];

  return {
    ...creation,
    comments,
    commentCount: comments.length,
    updatedAt: createdAt,
  };
}

export function getTrendingCreations(creations, { now = () => new Date() } = {}) {
  const nowDate = now();
  const timestamp = nowDate instanceof Date ? nowDate.getTime() : new Date(nowDate).getTime();

  return creations
    .filter((creation) => creation.visibility === 'public')
    .map((creation) => ({
      creation,
      score: getTrendingScore(creation, timestamp),
    }))
    .sort((left, right) => right.score - left.score || right.creation.updatedAt.localeCompare(left.creation.updatedAt))
    .map(({ creation }) => creation);
}

export function loadCommunityState(storage = window.localStorage, key = COMMUNITY_STORAGE_KEY) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return createCommunityState();

    const parsed = JSON.parse(raw);
    return createCommunityState({
      profile: parsed.profile || null,
      creations: Array.isArray(parsed.creations) ? parsed.creations.map(normalizeCreation) : [],
      activeCreationId: parsed.activeCreationId || null,
    });
  } catch {
    return createCommunityState();
  }
}

export function saveCommunityState(state, storage = window.localStorage, key = COMMUNITY_STORAGE_KEY) {
  storage.setItem(key, JSON.stringify(createCommunityState(state)));
}

export function replaceCreation(creations, nextCreation) {
  const index = creations.findIndex((creation) => creation.id === nextCreation.id);

  if (index === -1) return [nextCreation, ...creations];

  return creations.map((creation) => (creation.id === nextCreation.id ? nextCreation : creation));
}

export function incrementCloneCount(creation) {
  return {
    ...creation,
    cloneCount: Number(creation.cloneCount || 0) + 1,
  };
}

function getTrendingScore(creation, nowTimestamp) {
  const publishedTimestamp = new Date(creation.publishedAt || creation.updatedAt || 0).getTime();
  const ageDays = Math.max(0, (nowTimestamp - publishedTimestamp) / 86_400_000);
  const freshness = Math.max(0, 14 - ageDays);

  return (
    Number(creation.starCount || 0) * 8
    + Number(creation.cloneCount || 0) * 13
    + Number(creation.viewCount || 0) * 0.5
    + freshness
  );
}

function normalizeTags(tags) {
  const source = Array.isArray(tags) ? tags : String(tags || '').split(',');
  const seen = new Set();

  for (const tag of source) {
    const normalized = slugify(tag);
    if (normalized) seen.add(normalized);
    if (seen.size >= 8) break;
  }

  return [...seen];
}

function normalizeComments(comments) {
  if (!Array.isArray(comments)) return [];

  return comments
    .map((comment) => ({
      id: String(comment.id || `comment-${hashString(comment.body || '')}`),
      profileId: String(comment.profileId || 'profile-local'),
      authorName: String(comment.authorName || 'Life Builder').trim(),
      body: String(comment.body || '').trim(),
      createdAt: String(comment.createdAt || new Date().toISOString()),
    }))
    .filter((comment) => comment.body);
}

function normalizeCreation(creation) {
  const versions = getCreationVersions(creation);
  const currentVersion = versions.find((version) => version.id === creation.currentVersion?.id)
    || versions.at(-1)
    || creation.currentVersion;
  return {
    attribution: '',
    tutorialReference: '',
    previewConfig: {},
    publishReadiness: {},
    archivedAt: null,
    ...creation,
    currentVersion,
    versions,
  };
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function getIdSuffix(id) {
  return String(id || '').split('-').filter(Boolean).at(-1) || hashString(String(id)).slice(0, 4);
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashString(value) {
  let hash = 2166136261;

  for (const char of String(value || 'life')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) ^ 0x8f7b2c22).toString(16).padStart(8, '0');
}
