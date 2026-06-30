// Repository seam for community data.
//
// The UI talks only to this async interface, never to the storage backend. The
// first implementation below is local-first (localStorage); a Supabase-backed
// implementation can satisfy the same contract later without UI changes. The
// methods are async on purpose: localStorage resolves immediately, but Supabase
// will not, and keeping the shape async now means the swap needs no `await`
// churn through the app.
import {
  COMMUNITY_STORAGE_KEY,
  createCommunityState,
  createCreationDraft,
  createProfile,
  getTrendingCreations,
  incrementCloneCount,
  replaceCreation,
  loadCommunityState as readStoredState,
  saveCommunityState as writeStoredState,
  publishCreation as applyPublish,
  toggleStar as applyStarToggle,
  cloneCreation as buildRemix,
} from './community.js';

// Backend selection (plan 2.5). Default is local; `supabase` is reserved for the
// Phase 2 implementation and throws a clear error until it exists and is
// configured, rather than silently falling back.
export function createCommunityRepository({ backend = 'local', ...options } = {}) {
  if (backend === 'local') return createLocalCommunityRepository(options);

  if (backend === 'supabase') {
    return createSupabaseCommunityRepository(options);
  }

  throw new Error(`Unknown community backend "${backend}".`);
}

export async function migrateLocalState(localRepo, cloudRepo) {
  if (!localRepo || !cloudRepo) {
    throw new Error('Both local and cloud community repositories are required.');
  }

  const localState = await localRepo.loadCommunityState();
  const creationMap = {};
  const migratedCreations = [];

  if (!localState.profile) {
    return {
      profile: null,
      creationMap,
      migratedCreations,
      cleared: false,
    };
  }

  const profile = await cloudRepo.saveProfile(toProfileInput(localState.profile));

  for (const creation of localState.creations) {
    const saved = await cloudRepo.saveCreation(toCreationInput(creation));
    let migrated = saved;

    if (creation.visibility === 'public') {
      const published = await cloudRepo.publishCreation(saved.id);
      migrated = { ...saved, ...published };
    }

    creationMap[creation.id] = migrated.id;
    migratedCreations.push(migrated);
  }

  const canClearLocalState = typeof localRepo.clearCommunityState === 'function';
  if (canClearLocalState) {
    await localRepo.clearCommunityState();
  }

  return {
    profile,
    creationMap,
    migratedCreations,
    cleared: canClearLocalState,
  };
}

export function createSupabaseCommunityRepository({
  client: providedClient,
  supabaseUrl,
  supabaseAnonKey,
  createClient,
  now = () => new Date().toISOString(),
  createId = createUuid,
} = {}) {
  const client = resolveSupabaseClient({
    client: providedClient,
    supabaseUrl,
    supabaseAnonKey,
    createClient,
  });

  let state = createCommunityState();

  const find = (creationId) =>
    state.creations.find((creation) => creation.id === creationId) || null;

  const loadVersionRow = async (versionId) => {
    if (!versionId) return null;

    const { data, error } = await client
      .from('creation_versions')
      .select()
      .eq('id', versionId)
      .maybeSingle();

    assertSupabaseOk(error);
    return data;
  };

  const hydrateCreation = async (row, { version = null, ownerName = null, starredBy = null } = {}) => {
    const cached = find(row.id);
    const versionRow = version || cached?.currentVersion || await loadVersionRow(row.current_version_id);
    const resolvedOwnerName = ownerName
      || cached?.ownerName
      || (state.profile?.id === row.owner_id ? state.profile.displayName : 'Community Builder');

    return fromCreationRow(row, {
      version: versionRow,
      ownerName: resolvedOwnerName,
      starredBy: starredBy || cached?.starredBy || [],
    });
  };

  const selectRowsBy = async (table, column, value) => {
    const { data, error } = await client
      .from(table)
      .select()
      .eq(column, value);

    assertSupabaseOk(error);
    return data || [];
  };

  const loadCurrentUserStarIds = async (userId) => {
    const rows = await selectRowsBy('stars', 'profile_id', userId);
    return new Set(rows.map((row) => row.creation_id).filter(Boolean));
  };

  return {
    backend: 'supabase',
    requiresAuth: true,

    getState() {
      return state;
    },

    async getAuthSession() {
      const { data, error } = await client.auth.getSession();
      assertSupabaseOk(error);
      return data?.session || null;
    },

    async getAuthUser() {
      const { data, error } = await client.auth.getUser();
      assertSupabaseOk(error);
      return data?.user || null;
    },

    async sendMagicLink(email, { redirectTo } = {}) {
      const payload = { email };
      if (redirectTo) {
        payload.options = { emailRedirectTo: redirectTo };
      }

      const { data, error } = await client.auth.signInWithOtp(payload);
      assertSupabaseOk(error);
      return data || null;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      assertSupabaseOk(error);
      return null;
    },

    onAuthStateChange(callback) {
      return client.auth.onAuthStateChange(callback);
    },

    async loadCommunityState() {
      const user = await getSupabaseUser(client);
      const { data: profileRow, error: profileError } = await client
        .from('profiles')
        .select()
        .eq('id', user.id)
        .maybeSingle();
      assertSupabaseOk(profileError);

      if (!profileRow) {
        state = createCommunityState();
        return state;
      }

      const profile = fromProfileRow(profileRow, user.email);
      const starredCreationIds = await loadCurrentUserStarIds(user.id);
      const creationRows = await selectRowsBy('creations', 'owner_id', user.id);
      const creations = await Promise.all(creationRows.map((row) => hydrateCreation(row, {
        ownerName: profile.displayName,
        starredBy: starredCreationIds.has(row.id) ? [user.id] : [],
      })));

      state = createCommunityState({
        profile,
        creations,
        activeCreationId: creations[0]?.id || null,
      });
      return state;
    },

    async saveProfile(input) {
      const user = await getSupabaseUser(client);
      const draft = createProfile({
        ...input,
        email: input?.email || user.email,
        now,
      });
      const payload = toProfileRow({ ...draft, id: user.id });
      const { data, error } = await client
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      assertSupabaseOk(error);

      const profile = fromProfileRow(data, input?.email || user.email);
      state = { ...state, profile };
      return profile;
    },

    async saveCreation(input, { publish = false } = {}) {
      if (!state.profile) {
        throw new Error('Create a Supabase profile before saving creations.');
      }

      const draft = createCreationDraft({
        ...input,
        id: createId(),
        profile: state.profile,
        now,
      });
      const creationInput = publish ? applyPublish(draft, { now }) : draft;

      const version = { ...creationInput.currentVersion, id: createId() };
      const { data, error } = await client.rpc(
        'save_creation',
        toSaveCreationRpcPayload(creationInput, version),
      );
      assertSupabaseOk(error);

      const creation = await hydrateCreation(data, {
        ownerName: state.profile.displayName,
      });
      state = {
        ...state,
        creations: replaceCreation(state.creations, creation),
        activeCreationId: creation.id,
      };
      return creation;
    },

    async publishCreation(creationId) {
      const existing = find(creationId);
      if (!existing) return null;

      const publishedAt = existing.publishedAt || now();
      const { data, error } = await client
        .from('creations')
        .update({
          visibility: 'public',
          published_at: publishedAt,
          updated_at: publishedAt,
        })
        .eq('id', creationId)
        .select()
        .single();
      assertSupabaseOk(error);

      const creation = fromCreationRow(data, {
        version: existing.currentVersion,
        ownerName: existing.ownerName,
        starredBy: existing.starredBy,
      });
      state = {
        ...state,
        creations: replaceCreation(state.creations, creation),
        activeCreationId: creation.id,
      };
      return creation;
    },

    async toggleStar(creationId) {
      const target = find(creationId);
      if (!target) return null;

      const user = await getSupabaseUser(client);
      const starredBy = new Set(target.starredBy || []);
      const wasStarred = starredBy.has(user.id);

      if (wasStarred) {
        const { error } = await client
          .from('stars')
          .delete()
          .match({ profile_id: user.id, creation_id: creationId });
        assertSupabaseOk(error);
        starredBy.delete(user.id);
      } else {
        const { error } = await client
          .from('stars')
          .insert({ profile_id: user.id, creation_id: creationId });
        assertSupabaseOk(error);
        starredBy.add(user.id);
      }

      const creation = {
        ...target,
        starredBy: [...starredBy].sort(),
        starCount: Math.max(0, Number(target.starCount || 0) + (wasStarred ? -1 : 1)),
      };
      state = { ...state, creations: replaceCreation(state.creations, creation) };
      return creation;
    },

    async cloneCreation(creationId, profile = state.profile) {
      const source = find(creationId);
      if (!source || !profile) return null;

      const draft = buildRemix(source, {
        id: createId(),
        profile,
        now,
      });
      const { data, error } = await client.rpc('clone_creation', {
        source_id: creationId,
        new_slug: draft.slug,
        new_title: draft.title,
      });
      assertSupabaseOk(error);

      const remix = await hydrateCreation(data, {
        ownerName: profile.displayName,
      });
      const countedSource = incrementCloneCount(source);
      state = {
        ...state,
        creations: replaceCreation(replaceCreation(state.creations, countedSource), remix),
        activeCreationId: remix.id,
      };
      return remix;
    },

    async listTrendingCreations({ limit = 20 } = {}) {
      const user = await getSupabaseUser(client);
      const starredCreationIds = await loadCurrentUserStarIds(user.id);
      const { data, error } = await client
        .from('trending_creations')
        .select()
        .limit(limit);
      assertSupabaseOk(error);

      const creations = await Promise.all((data || []).map((row) => hydrateCreation(row, {
        starredBy: starredCreationIds.has(row.id) ? [user.id] : [],
      })));
      state = {
        ...state,
        creations: creations.reduce(
          (nextCreations, creation) => replaceCreation(nextCreations, creation),
          state.creations,
        ),
      };
      return creations;
    },

    findCreation(creationId) {
      return find(creationId);
    },

    setActiveCreation(creationId) {
      state = { ...state, activeCreationId: creationId };
      return state;
    },
  };
}

function resolveSupabaseClient({ client, supabaseUrl, supabaseAnonKey, createClient } = {}) {
  if (client) return client;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase backend is not configured. Provide a client or both supabaseUrl and supabaseAnonKey.',
    );
  }

  if (typeof createClient !== 'function') {
    throw new Error(
      'Supabase backend is not configured. Provide createClient to construct the Supabase client.',
    );
  }

  const createdClient = createClient(supabaseUrl, supabaseAnonKey);
  if (!createdClient) {
    throw new Error('Supabase backend is not configured. createClient did not return a client.');
  }

  return createdClient;
}

async function getSupabaseUser(client) {
  const { data, error } = await client.auth.getUser();
  assertSupabaseOk(error);

  if (!data?.user?.id) {
    throw new Error('Sign in before using the Supabase community backend.');
  }

  return data.user;
}

function assertSupabaseOk(error) {
  if (error) {
    throw new Error(error.message || 'Supabase request failed.');
  }
}

function toProfileInput(profile) {
  return {
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl || '',
    bio: profile.bio || '',
    githubUrl: profile.githubUrl || '',
    linkedinUrl: profile.linkedinUrl || '',
  };
}

function toCreationInput(creation) {
  const version = creation.currentVersion || {};

  return {
    title: creation.title,
    description: creation.description || '',
    tags: creation.tags || [],
    rle: version.rle,
    width: version.width,
    height: version.height,
    generation: version.generation,
    population: version.population,
    thumbnail: creation.thumbnail || '',
  };
}

function toProfileRow(profile) {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl,
    bio: profile.bio,
    github_url: profile.githubUrl,
    linkedin_url: profile.linkedinUrl,
    is_public: true,
  };
}

function fromProfileRow(row, email = '') {
  return {
    id: row.id,
    email,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || '',
    bio: row.bio || '',
    githubUrl: row.github_url || '',
    linkedinUrl: row.linkedin_url || '',
    createdAt: row.created_at,
  };
}

function toSaveCreationRpcPayload(creation, version) {
  return {
    creation_id: creation.id,
    creation_slug: creation.slug,
    creation_title: creation.title,
    creation_description: creation.description,
    creation_tags: creation.tags,
    creation_visibility: creation.visibility,
    creation_published_at: creation.publishedAt,
    version_id: version.id,
    version_rle: version.rle,
    version_width: version.width,
    version_height: version.height,
    version_generation: version.generation,
    version_population: version.population,
    version_rule: version.rule,
  };
}

function fromCreationRow(row, { version = null, ownerName = 'Community Builder', starredBy = [] } = {}) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description || '',
    visibility: row.visibility,
    ownerId: row.owner_id,
    ownerName,
    thumbnail: '',
    tags: row.tags || [],
    starCount: Number(row.star_count || 0),
    cloneCount: Number(row.clone_count || 0),
    viewCount: Number(row.view_count || 0),
    starredBy,
    remixedFromId: row.remixed_from_id || null,
    rootCreationId: row.root_creation_id || row.id,
    currentVersion: fromVersionRow(version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at || null,
  };
}

function fromVersionRow(row) {
  return {
    id: row?.id || null,
    rle: row?.rle || 'x = 0, y = 0, rule = B3/S23\n!',
    width: Number(row?.width || 0),
    height: Number(row?.height || 0),
    generation: Number(row?.generation || 0),
    population: Number(row?.population || 0),
    rule: row?.rule || 'B3/S23',
    createdAt: row?.created_at,
  };
}

function createUuid() {
  return globalThis.crypto?.randomUUID?.() || `00000000-0000-4000-8000-${Date.now()}`;
}

export function createLocalCommunityRepository({
  storage = globalThis.localStorage,
  key = COMMUNITY_STORAGE_KEY,
  now = () => new Date().toISOString(),
} = {}) {
  let state = readStoredState(storage, key);

  const persist = () => writeStoredState(state, storage, key);
  const find = (creationId) =>
    state.creations.find((creation) => creation.id === creationId) || null;

  return {
    backend: 'local',
    requiresAuth: false,

    // Synchronous snapshot of the in-memory cache, for rendering.
    getState() {
      return state;
    },

    async getAuthSession() {
      return null;
    },

    async getAuthUser() {
      return null;
    },

    async sendMagicLink() {
      throw new Error('Supabase backend is not configured for community auth.');
    },

    async signOut() {
      return null;
    },

    onAuthStateChange() {
      return createNoopAuthSubscription();
    },

    // Re-read the backend and refresh the cache.
    async loadCommunityState() {
      state = readStoredState(storage, key);
      return state;
    },

    async saveProfile(input) {
      const profile = createProfile({ ...input, now });
      state = { ...state, profile };
      persist();
      return profile;
    },

    async saveCreation(input, { publish = false } = {}) {
      const draft = createCreationDraft({ ...input, profile: state.profile, now });
      const creation = publish ? applyPublish(draft, { now }) : draft;
      state = {
        ...state,
        creations: replaceCreation(state.creations, creation),
        activeCreationId: creation.id,
      };
      persist();
      return creation;
    },

    async publishCreation(creationId) {
      const target = find(creationId);
      if (!target) return null;

      const published = applyPublish(target, { now });
      state = {
        ...state,
        creations: replaceCreation(state.creations, published),
        activeCreationId: published.id,
      };
      persist();
      return published;
    },

    async toggleStar(creationId, profileId) {
      const target = find(creationId);
      if (!target) return null;

      const next = applyStarToggle(target, profileId);
      state = { ...state, creations: replaceCreation(state.creations, next) };
      persist();
      return next;
    },

    async cloneCreation(creationId, profile) {
      const source = find(creationId);
      if (!source) return null;

      const remix = buildRemix(source, { profile, now });
      const countedSource = incrementCloneCount(source);
      state = {
        ...state,
        creations: replaceCreation(replaceCreation(state.creations, countedSource), remix),
        activeCreationId: remix.id,
      };
      persist();
      return remix;
    },

    async listTrendingCreations() {
      return getTrendingCreations(state.creations, { now: () => new Date(now()) });
    },

    // Local UI concerns: looking up and tracking the open creation. These stay
    // synchronous because they never touch remote data.
    findCreation(creationId) {
      return find(creationId);
    },

    setActiveCreation(creationId) {
      state = { ...state, activeCreationId: creationId };
      persist();
      return state;
    },

    async clearCommunityState() {
      state = createCommunityState();
      persist();
      return state;
    },
  };
}

function createNoopAuthSubscription() {
  const subscription = {
    unsubscribe() {},
  };

  return {
    unsubscribe: subscription.unsubscribe,
    data: { subscription },
  };
}
