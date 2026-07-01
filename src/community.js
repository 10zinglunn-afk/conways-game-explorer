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

  return {
    id: creationId,
    title: cleanTitle,
    slug: `${slugify(cleanTitle) || 'life-build'}-${getIdSuffix(creationId)}`,
    description: String(description || '').trim(),
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
    currentVersion: {
      id: `version-${getIdSuffix(creationId)}`,
      rle: String(rle || 'x = 0, y = 0, rule = B3/S23\n!'),
      width: Number(width || 0),
      height: Number(height || 0),
      generation: Number(generation || 0),
      population: Number(population || 0),
      rule: 'B3/S23',
      settings: versionSettings,
      createdAt,
    },
    createdAt,
    updatedAt: createdAt,
    publishedAt: null,
  };
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
    title: `${source.title} Remix`,
    description: source.description,
    tags: source.tags,
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
      creations: Array.isArray(parsed.creations) ? parsed.creations : [],
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
