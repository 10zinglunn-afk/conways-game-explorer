import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityRepository, createSupabaseCommunityRepository } from './community-repository.js';
import { runCommunityRepositoryContract } from './community-repository.contract.js';

runCommunityRepositoryContract('supabase', createContractSupabaseRepository);

test('createCommunityRepository requires Supabase config for the supabase backend', () => {
  assert.throws(
    () => createCommunityRepository({ backend: 'supabase' }),
    /Supabase backend is not configured/,
  );
});

test('createCommunityRepository selects the Supabase backend when a client is provided', () => {
  const repo = createCommunityRepository({ backend: 'supabase', client: createMinimalClient() });

  assert.equal(repo.backend, 'supabase');
  assert.equal(repo.requiresAuth, true);
  assert.equal(typeof repo.loadCommunityState, 'function');
  assert.equal(typeof repo.saveProfile, 'function');
});

test('createCommunityRepository creates a Supabase client from URL, anon key, and factory', () => {
  const client = createMinimalClient();
  const calls = [];
  const repo = createCommunityRepository({
    backend: 'supabase',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon-key',
    createClient(url, key) {
      calls.push({ url, key });
      return client;
    },
  });

  assert.equal(repo.backend, 'supabase');
  assert.deepEqual(calls, [{ url: 'https://example.supabase.co', key: 'anon-key' }]);
});

test('createSupabaseCommunityRepository exposes the repository contract methods', () => {
  const repo = createSupabaseCommunityRepository({ client: createMinimalClient() });

  assert.equal(typeof repo.getState, 'function');
  assert.equal(typeof repo.findCreation, 'function');
  assert.equal(typeof repo.setActiveCreation, 'function');
});

test('createSupabaseCommunityRepository wraps Supabase auth helpers', async () => {
  const client = createRecordingAuthClient();
  const repo = createSupabaseCommunityRepository({ client });
  const onChange = () => {};

  assert.deepEqual(await repo.getAuthSession(), { access_token: 'session-token' });
  assert.deepEqual(await repo.getAuthUser(), { id: 'user-1', email: 'ada@example.com' });
  assert.deepEqual(
    await repo.sendMagicLink('ada@example.com', { redirectTo: 'https://life.example.test/community' }),
    { user: null, session: null },
  );
  assert.equal(await repo.signOut(), null);
  assert.equal(repo.onAuthStateChange(onChange), client.subscriptionResponse);
  assert.deepEqual(client.operations, [
    { action: 'getSession' },
    { action: 'getUser' },
    {
      action: 'signInWithOtp',
      payload: {
        email: 'ada@example.com',
        options: { emailRedirectTo: 'https://life.example.test/community' },
      },
    },
    { action: 'signOut' },
    { action: 'onAuthStateChange', callback: onChange },
  ]);
});

test('saveProfile upserts a profile using the authenticated Supabase user id', async () => {
  const client = createRecordingClient({
    user: { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@example.com' },
    profileRow: {
      id: '00000000-0000-4000-8000-0000000000a1',
      username: 'ada-lovelace',
      display_name: 'Ada Lovelace',
      avatar_url: '',
      bio: '',
      github_url: '',
      linkedin_url: '',
      created_at: '2026-06-29T12:00:00.000Z',
    },
  });
  const repo = createSupabaseCommunityRepository({ client, now: () => '2026-06-29T12:00:00.000Z' });

  const profile = await repo.saveProfile({ email: 'ada@example.com', displayName: 'Ada Lovelace' });

  assert.equal(profile.id, '00000000-0000-4000-8000-0000000000a1');
  assert.equal(profile.email, 'ada@example.com');
  assert.equal(repo.getState().profile.id, profile.id);
  assert.deepEqual(client.operations, [
    {
      table: 'profiles',
      action: 'upsert',
      payload: {
        id: '00000000-0000-4000-8000-0000000000a1',
        username: 'ada-lovelace',
        display_name: 'Ada Lovelace',
        avatar_url: '',
        bio: '',
        github_url: '',
        linkedin_url: '',
        is_public: true,
      },
    },
  ]);
});

test('saveCreation calls an atomic save_creation RPC and hydrates the saved version', async () => {
  const client = createRecordingClient({
    user: { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@example.com' },
    profileRow: {
      id: '00000000-0000-4000-8000-0000000000a1',
      username: 'ada-lovelace',
      display_name: 'Ada Lovelace',
      avatar_url: '',
      bio: '',
      github_url: '',
      linkedin_url: '',
      created_at: '2026-06-29T12:00:00.000Z',
    },
  });
  const ids = [
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
  ];
  const repo = createSupabaseCommunityRepository({
    client,
    now: () => '2026-06-29T12:00:00.000Z',
    createId: () => ids.shift(),
  });
  await repo.saveProfile({ email: 'ada@example.com', displayName: 'Ada Lovelace' });

  const creation = await repo.saveCreation({
    title: 'Glider Clock',
    description: 'A tiny oscillator',
    tags: 'glider, clock',
    rle: 'x = 1, y = 1, rule = B3/S23\no!',
    width: 1,
    height: 1,
    generation: 8,
    population: 1,
  });

  assert.equal(creation.id, '10000000-0000-4000-8000-000000000001');
  assert.equal(creation.currentVersion.id, '20000000-0000-4000-8000-000000000001');
  assert.equal(repo.getState().activeCreationId, creation.id);
  assert.equal(repo.findCreation(creation.id).title, 'Glider Clock');
  assert.deepEqual(client.operations.slice(1), [
    {
      action: 'rpc',
      functionName: 'save_creation',
      payload: {
        creation_id: '10000000-0000-4000-8000-000000000001',
        creation_slug: 'glider-clock-000000000001',
        creation_title: 'Glider Clock',
        creation_description: 'A tiny oscillator',
        creation_tags: ['glider', 'clock'],
        creation_visibility: 'private',
        creation_published_at: null,
        version_id: '20000000-0000-4000-8000-000000000001',
        version_rle: 'x = 1, y = 1, rule = B3/S23\no!',
        version_width: 1,
        version_height: 1,
        version_generation: 8,
        version_population: 1,
        version_rule: 'B3/S23',
      },
    },
    {
      table: 'creation_versions',
      action: 'select',
    },
  ]);
});

test('publishCreation marks a Supabase creation public and updates the cache', async () => {
  const { repo, client } = await createProfiledRepo();
  const draft = await repo.saveCreation({ title: 'Draft', rle: 'x = 1, y = 1, rule = B3/S23\no!' });

  const published = await repo.publishCreation(draft.id);

  assert.equal(published.visibility, 'public');
  assert.equal(published.publishedAt, '2026-06-29T12:00:00.000Z');
  assert.equal(repo.findCreation(draft.id).visibility, 'public');
  assert.deepEqual(client.operations.at(-1), {
    table: 'creations',
    action: 'update',
    payload: {
      visibility: 'public',
      published_at: '2026-06-29T12:00:00.000Z',
      updated_at: '2026-06-29T12:00:00.000Z',
    },
    eq: ['id', draft.id],
  });
});

test('toggleStar inserts and deletes stars for the authenticated Supabase user', async () => {
  const { repo, client } = await createProfiledRepo();
  const creation = await repo.saveCreation({ title: 'Signal', rle: 'x = 1, y = 1, rule = B3/S23\no!' }, { publish: true });

  const starred = await repo.toggleStar(creation.id, 'ignored-local-profile');
  const unstarred = await repo.toggleStar(creation.id, 'ignored-local-profile');

  assert.equal(starred.starCount, 1);
  assert.deepEqual(starred.starredBy, ['00000000-0000-4000-8000-0000000000a1']);
  assert.equal(unstarred.starCount, 0);
  assert.deepEqual(unstarred.starredBy, []);
  assert.deepEqual(client.operations.slice(-2), [
    {
      table: 'stars',
      action: 'insert',
      payload: {
        profile_id: '00000000-0000-4000-8000-0000000000a1',
        creation_id: creation.id,
      },
    },
    {
      table: 'stars',
      action: 'delete',
      match: {
        profile_id: '00000000-0000-4000-8000-0000000000a1',
        creation_id: creation.id,
      },
    },
  ]);
});

test('cloneCreation calls the clone RPC and caches the private remix', async () => {
  const { repo, client } = await createProfiledRepo();
  const source = await repo.saveCreation({ title: 'Signal Gate', rle: 'x = 1, y = 1, rule = B3/S23\no!' }, { publish: true });
  const profile = repo.getState().profile;

  const remix = await repo.cloneCreation(source.id, profile);

  assert.equal(remix.visibility, 'private');
  assert.equal(remix.ownerId, profile.id);
  assert.equal(remix.ownerName, profile.displayName);
  assert.equal(remix.remixedFromId, source.id);
  assert.equal(remix.rootCreationId, source.id);
  assert.equal(remix.currentVersion.id, '40000000-0000-4000-8000-000000000001');
  assert.equal(remix.currentVersion.rle, source.currentVersion.rle);
  assert.equal(repo.findCreation(source.id).cloneCount, 1);
  assert.equal(repo.getState().activeCreationId, remix.id);
  assert.deepEqual(client.operations.find((operation) =>
    operation.action === 'rpc' && operation.functionName === 'clone_creation'
  ), {
    action: 'rpc',
    functionName: 'clone_creation',
    payload: {
      source_id: source.id,
      new_slug: 'signal-gate-remix-000000000002',
      new_title: 'Signal Gate Remix',
    },
  });
});

test('loadCommunityState hydrates the authenticated profile, owned creations, versions, and stars', async () => {
  const { repo, client } = await createProfiledRepo();
  const creation = await repo.saveCreation({
    title: 'Returning Build',
    rle: 'x = 1, y = 1, rule = B3/S23\no!',
    width: 1,
    height: 1,
    generation: 12,
    population: 1,
  }, { publish: true });
  await repo.toggleStar(creation.id);

  const returningRepo = createSupabaseCommunityRepository({
    client,
    now: () => '2026-06-29T12:00:00.000Z',
  });
  const state = await returningRepo.loadCommunityState();

  assert.equal(state.profile.id, '00000000-0000-4000-8000-0000000000a1');
  assert.deepEqual(state.creations.map((item) => item.id), [creation.id]);
  assert.equal(state.activeCreationId, creation.id);
  assert.equal(state.creations[0].currentVersion.id, creation.currentVersion.id);
  assert.equal(state.creations[0].currentVersion.generation, 12);
  assert.deepEqual(state.creations[0].starredBy, ['00000000-0000-4000-8000-0000000000a1']);
  assert.equal(state.creations[0].starCount, 1);
});

test('listTrendingCreations includes current-user star state for fresh Supabase caches', async () => {
  const { repo, client } = await createProfiledRepo();
  const creation = await repo.saveCreation({
    title: 'Starred Public Build',
    rle: 'x = 1, y = 1, rule = B3/S23\no!',
  }, { publish: true });
  await repo.toggleStar(creation.id);

  const freshRepo = createSupabaseCommunityRepository({
    client,
    now: () => '2026-06-29T12:00:00.000Z',
  });
  const trending = await freshRepo.listTrendingCreations();
  const unstarred = await freshRepo.toggleStar(creation.id);

  assert.deepEqual(trending[0].starredBy, ['00000000-0000-4000-8000-0000000000a1']);
  assert.equal(unstarred.starCount, 0);
  assert.deepEqual(unstarred.starredBy, []);
});

test('listTrendingCreations reads public creations from the Supabase trending view', async () => {
  const { repo, client } = await createProfiledRepo();
  await repo.saveCreation({ title: 'Private', rle: 'x = 1, y = 1, rule = B3/S23\no!' });
  const published = await repo.saveCreation({ title: 'Public', rle: 'x = 1, y = 1, rule = B3/S23\no!' }, { publish: true });

  const trending = await repo.listTrendingCreations();

  assert.deepEqual(trending.map((creation) => creation.id), [published.id]);
  assert.ok(client.operations.some((operation) =>
    operation.table === 'trending_creations' && operation.action === 'select'
  ));
});

function createMinimalClient() {
  return {
    auth: {
      async getUser() {
        return { data: { user: { id: '00000000-0000-4000-8000-000000000001', email: 'ada@example.com' } }, error: null };
      },
    },
  };
}

function createRecordingAuthClient() {
  const operations = [];
  const subscriptionResponse = {
    data: {
      subscription: {
        unsubscribe() {
          operations.push({ action: 'unsubscribe' });
        },
      },
    },
  };

  return {
    operations,
    subscriptionResponse,
    auth: {
      async getSession() {
        operations.push({ action: 'getSession' });
        return { data: { session: { access_token: 'session-token' } }, error: null };
      },
      async getUser() {
        operations.push({ action: 'getUser' });
        return { data: { user: { id: 'user-1', email: 'ada@example.com' } }, error: null };
      },
      async signInWithOtp(payload) {
        operations.push({ action: 'signInWithOtp', payload });
        return { data: { user: null, session: null }, error: null };
      },
      async signOut() {
        operations.push({ action: 'signOut' });
        return { error: null };
      },
      onAuthStateChange(callback) {
        operations.push({ action: 'onAuthStateChange', callback });
        return subscriptionResponse;
      },
    },
  };
}

async function createProfiledRepo() {
  const client = createRecordingClient({
    user: { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@example.com' },
    profileRow: {
      id: '00000000-0000-4000-8000-0000000000a1',
      username: 'ada-lovelace',
      display_name: 'Ada Lovelace',
      avatar_url: '',
      bio: '',
      github_url: '',
      linkedin_url: '',
      created_at: '2026-06-29T12:00:00.000Z',
    },
  });
  const ids = [
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
  ];
  const repo = createSupabaseCommunityRepository({
    client,
    now: () => '2026-06-29T12:00:00.000Z',
    createId: () => ids.shift(),
  });

  await repo.saveProfile({ email: 'ada@example.com', displayName: 'Ada Lovelace' });

  return { repo, client };
}

function createContractSupabaseRepository() {
  const client = createRecordingClient({
    user: { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@example.com' },
    profileRow: {
      id: '00000000-0000-4000-8000-0000000000a1',
      username: 'ada-lovelace',
      display_name: 'Ada Lovelace',
      avatar_url: '',
      bio: '',
      github_url: '',
      linkedin_url: '',
      created_at: '2026-06-29T12:00:00.000Z',
    },
  });
  const ids = [
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
  ];

  return createSupabaseCommunityRepository({
    client,
    now: () => '2026-06-29T12:00:00.000Z',
    createId: () => ids.shift(),
  });
}

function createRecordingClient({ user, profileRow }) {
  const operations = [];
  const rows = {
    profiles: new Map([[profileRow.id, profileRow]]),
    creations: new Map(),
    creation_versions: new Map(),
    stars: new Map(),
  };

  return {
    operations,
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
    },
    from(table) {
      return {
        insert(payload) {
          operations.push({ table, action: 'insert', payload });
          const row = {
            ...payload,
            star_count: payload.star_count || 0,
            clone_count: payload.clone_count || 0,
            view_count: payload.view_count || 0,
            created_at: '2026-06-29T12:00:00.000Z',
            updated_at: '2026-06-29T12:00:00.000Z',
          };
          if (payload.id) {
            rows[table]?.set(payload.id, row);
          }
          if (table === 'stars') {
            rows.stars.set(`${payload.profile_id}:${payload.creation_id}`, row);
            const creation = rows.creations.get(payload.creation_id);
            rows.creations.set(payload.creation_id, { ...creation, star_count: Number(creation.star_count || 0) + 1 });
          }

          return {
            select() {
              return {
                async single() {
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        delete() {
          return {
            match(match) {
              operations.push({ table, action: 'delete', match });
              if (table === 'stars') {
                rows.stars.delete(`${match.profile_id}:${match.creation_id}`);
                const creation = rows.creations.get(match.creation_id);
                rows.creations.set(match.creation_id, { ...creation, star_count: Math.max(0, Number(creation.star_count || 0) - 1) });
              }
              return { data: null, error: null };
            },
          };
        },
        select() {
          operations.push({ table, action: 'select' });
          const getRows = () => {
            if (table === 'trending_creations') {
              return [...rows.creations.values()]
                .filter((creation) => creation.visibility === 'public')
                .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
            }
            return [...(rows[table]?.values() || [])];
          };

          return {
            eq(column, value) {
              const matches = getRows().filter((row) => row[column] === value);
              return {
                async single() {
                  return { data: matches[0] || null, error: matches[0] ? null : { message: 'No rows found' } };
                },
                async maybeSingle() {
                  return { data: matches[0] || null, error: null };
                },
                then(resolve, reject) {
                  return Promise.resolve({ data: matches, error: null }).then(resolve, reject);
                },
              };
            },
            async limit(count) {
              return { data: getRows().slice(0, count), error: null };
            },
          };
        },
        update(payload) {
          return {
            eq(column, value) {
              operations.push({ table, action: 'update', payload, eq: [column, value] });
              const existing = rows[table]?.get(value) || {};
              const row = { ...existing, ...payload, updated_at: '2026-06-29T12:00:00.000Z' };
              rows[table]?.set(value, row);

              return {
                select() {
                  return {
                    async single() {
                      return { data: row, error: null };
                    },
                  };
                },
              };
            },
          };
        },
        upsert(payload) {
          operations.push({ table, action: 'upsert', payload });
          const row = {
            ...(rows[table]?.get(payload.id) || profileRow),
            ...payload,
          };
          rows[table]?.set(payload.id, row);

          return {
            select() {
              return {
                async single() {
                  return { data: row, error: null };
                },
              };
            },
          };
        },
      };
    },
    async rpc(functionName, payload) {
      operations.push({ action: 'rpc', functionName, payload });
      if (functionName === 'save_creation') {
        const creation = {
          id: payload.creation_id,
          owner_id: user.id,
          slug: payload.creation_slug,
          title: payload.creation_title,
          description: payload.creation_description,
          tags: payload.creation_tags,
          visibility: payload.creation_visibility,
          remixed_from_id: null,
          root_creation_id: payload.creation_id,
          current_version_id: payload.version_id,
          star_count: 0,
          clone_count: 0,
          view_count: 0,
          created_at: '2026-06-29T12:00:00.000Z',
          updated_at: '2026-06-29T12:00:00.000Z',
          published_at: payload.creation_published_at,
        };
        rows.creations.set(creation.id, creation);
        rows.creation_versions.set(payload.version_id, {
          id: payload.version_id,
          creation_id: creation.id,
          rle: payload.version_rle,
          width: payload.version_width,
          height: payload.version_height,
          generation: payload.version_generation,
          population: payload.version_population,
          rule: payload.version_rule,
          parent_version_id: null,
          created_at: '2026-06-29T12:00:00.000Z',
        });

        return { data: creation, error: null };
      }

      if (functionName !== 'clone_creation') return { data: null, error: { message: 'Unknown RPC' } };

      const source = rows.creations.get(payload.source_id);
      const sourceVersion = rows.creation_versions.get(source.current_version_id);
      const remix = {
        id: '30000000-0000-4000-8000-000000000001',
        owner_id: user.id,
        slug: payload.new_slug,
        title: payload.new_title,
        description: source.description,
        tags: source.tags,
        visibility: 'private',
        remixed_from_id: source.id,
        root_creation_id: source.root_creation_id || source.id,
        current_version_id: '40000000-0000-4000-8000-000000000001',
        star_count: 0,
        clone_count: 0,
        view_count: 0,
        created_at: '2026-06-29T12:00:00.000Z',
        updated_at: '2026-06-29T12:00:00.000Z',
        published_at: null,
      };
      rows.creations.set(remix.id, remix);
      rows.creation_versions.set(remix.current_version_id, {
        ...sourceVersion,
        id: remix.current_version_id,
        creation_id: remix.id,
      });
      rows.creations.set(source.id, { ...source, clone_count: Number(source.clone_count || 0) + 1 });

      return { data: remix, error: null };
    },
  };
}
