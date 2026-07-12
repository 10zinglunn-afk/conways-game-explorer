import { randomUUID } from 'node:crypto';
import {
  archiveCreation as applyArchive,
  createCommunityState,
  createCreationDraft,
  createCreationVersion,
  createProfile,
  cloneCreation as buildRemix,
  publishCreation as applyPublish,
  replaceCreation,
  restoreCreationVersion as applyRestoreVersion,
  unpublishCreation as applyUnpublish,
  updateCreationMetadata as applyMetadataUpdate,
} from '../src/community.js';

export function createPostgresCommunityRepository({
  pool,
  userId,
  now = () => new Date().toISOString(),
  createId = randomUUID,
} = {}) {
  if (!pool || typeof pool.connect !== 'function') {
    throw new Error('PostgreSQL community repository requires a pg Pool.');
  }
  if (!userId) throw new Error('PostgreSQL community repository requires an authenticated user id.');

  let state = createCommunityState();
  const find = (creationId) => state.creations.find((creation) => creation.id === creationId) || null;

  const loadCreation = async (client, creationId, { includeVersions = false, publicOnly = false } = {}) => {
    const visibilityClause = publicOnly
      ? 'and c.visibility = \'public\' and c.archived_at is null'
      : 'and (c.owner_id = $2 or (c.visibility = \'public\' and c.archived_at is null))';
    const params = publicOnly ? [creationId] : [creationId, userId];
    const result = await client.query(`
      select c.*, p.display_name as owner_name,
             v.id as version_id, v.version_number, v.rle, v.width, v.height,
             v.generation, v.population, v.rule, v.settings, v.parent_version_id,
             v.created_at as version_created_at
        from public.creations c
        left join public.profiles p on p.id = c.owner_id
        left join public.creation_versions v on v.id = c.current_version_id
       where c.id = $1 ${visibilityClause}
    `, params);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    const versions = includeVersions
      ? (await client.query(`
          select * from public.creation_versions
           where creation_id = $1
           order by version_number asc
        `, [creationId])).rows.map(fromVersionRow)
      : null;
    return fromCreationRow(row, { versions });
  };

  const loadOwnedCreation = (client, creationId, options = {}) => loadCreation(client, creationId, {
    ...options,
    publicOnly: false,
  }).then((creation) => creation && creation.ownerId === userId ? creation : null);

  const withTransaction = async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await callback(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  };

  const remember = (creation) => {
    if (!creation) return null;
    state = {
      ...state,
      creations: replaceCreation(state.creations, creation),
      activeCreationId: creation.id,
    };
    return creation;
  };

  const createCreation = async (input, { publish = false } = {}) => {
    if (!state.profile) throw new Error('Save a PostgreSQL profile before saving creations.');
    const id = createId();
    const draft = createCreationDraft({ ...input, id, profile: state.profile, now });
    const creation = publish ? applyPublish(draft, { now }) : draft;
    const version = normalizeVersionForDatabase({
      ...creation.currentVersion,
      id: createId(),
    });

    return remember(await withTransaction(async (client) => {
      await client.query(`
        insert into public.creations (
          id, owner_id, slug, title, description, tags, attribution,
          tutorial_reference, preview_config, publish_readiness, visibility,
          remixed_from_id, root_creation_id, published_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `, [
        id, userId, creation.slug, creation.title, creation.description,
        creation.tags, creation.attribution, creation.tutorialReference,
        creation.previewConfig, creation.publishReadiness, creation.visibility,
        creation.remixedFromId, creation.rootCreationId, creation.publishedAt,
      ]);
      await client.query(`
        insert into public.creation_versions (
          id, creation_id, version_number, rle, width, height, generation,
          population, rule, settings
        ) values ($1,$2,1,$3,$4,$5,$6,$7,$8,$9)
      `, [version.id, id, version.rle, version.width, version.height,
        version.generation, version.population, version.rule, version.settings]);
      await client.query(
        'update public.creations set current_version_id = $1 where id = $2',
        [version.id, id],
      );
      return loadOwnedCreation(client, id, { includeVersions: true });
    }));
  };

  return {
    backend: 'postgres',
    requiresAuth: true,

    getState() {
      return state;
    },

    async loadCommunityState() {
      const client = await pool.connect();
      try {
        const profileResult = await client.query(
          'select p.*, u.email from public.profiles p join public.auth_users u on u.id = p.id where p.id = $1',
          [userId],
        );
        const profile = profileResult.rows[0] ? fromProfileRow(profileResult.rows[0]) : null;
        if (!profile) {
          state = createCommunityState();
          return state;
        }

        const creationsResult = await client.query(
          'select id from public.creations where owner_id = $1 order by updated_at desc',
          [userId],
        );
        const creations = [];
        for (const row of creationsResult.rows) {
          const creation = await loadOwnedCreation(client, row.id, { includeVersions: true });
          if (creation) creations.push(creation);
        }
        state = createCommunityState({ profile, creations, activeCreationId: creations[0]?.id || null });
        return state;
      } finally {
        client.release();
      }
    },

    async saveProfile(input) {
      const userResult = await pool.query(
        'select id, email, name, image from public.auth_users where id = $1',
        [userId],
      );
      if (!userResult.rows[0]) throw new Error('Authenticated Better Auth user was not found.');
      const user = userResult.rows[0];
      const draft = createProfile({
        ...input,
        email: input?.email || user.email,
        displayName: input?.displayName || user.name,
        avatarUrl: input?.avatarUrl || user.image || '',
        now,
      });
      const profile = { ...draft, id: userId };
      const result = await pool.query(`
        insert into public.profiles (
          id, username, display_name, avatar_url, bio, github_url, linkedin_url
        ) values ($1,$2,$3,$4,$5,$6,$7)
        on conflict (id) do update set
          username = excluded.username,
          display_name = excluded.display_name,
          avatar_url = excluded.avatar_url,
          bio = excluded.bio,
          github_url = excluded.github_url,
          linkedin_url = excluded.linkedin_url
        returning *
      `, [profile.id, profile.username, profile.displayName, profile.avatarUrl,
        profile.bio, profile.githubUrl, profile.linkedinUrl]);
      state = { ...state, profile: fromProfileRow({ ...result.rows[0], email: user.email }) };
      return state.profile;
    },

    createCreation,
    saveCreation: createCreation,

    async saveVersion(creationId, input) {
      return remember(await withTransaction(async (client) => {
        const existing = await loadOwnedCreation(client, creationId, { includeVersions: true });
        if (!existing || existing.archivedAt) return null;
        const version = normalizeVersionForDatabase(createCreationVersion(existing, input, {
          id: createId(),
          now,
        }));
        return appendVersionRows(client, existing, version, userId);
      }));
    },

    async updateCreationMetadata(creationId, patch) {
      return remember(await withTransaction(async (client) => {
        const existing = await loadOwnedCreation(client, creationId, { includeVersions: true });
        if (!existing) return null;
        const next = applyMetadataUpdate(existing, patch, { now });
        await client.query(`
          update public.creations set title = $1, description = $2, tags = $3,
            attribution = $4, tutorial_reference = $5, preview_config = $6,
            publish_readiness = $7, updated_at = $8
           where id = $9 and owner_id = $10
        `, [next.title, next.description, next.tags, next.attribution,
          next.tutorialReference, next.previewConfig, next.publishReadiness,
          next.updatedAt, creationId, userId]);
        return loadOwnedCreation(client, creationId, { includeVersions: true });
      }));
    },

    async listVersions(creationId) {
      const result = await pool.query(`
        select v.* from public.creation_versions v
        join public.creations c on c.id = v.creation_id
        where v.creation_id = $1 and c.owner_id = $2
        order by v.version_number desc
      `, [creationId, userId]);
      return result.rows.map(fromVersionRow);
    },

    async loadVersion(creationId, versionId) {
      const result = await pool.query(`
        select v.* from public.creation_versions v
        join public.creations c on c.id = v.creation_id
        where v.creation_id = $1 and v.id = $2
          and (c.owner_id = $3 or (c.visibility = 'public' and c.archived_at is null))
      `, [creationId, versionId, userId]);
      return result.rows[0] ? fromVersionRow(result.rows[0]) : null;
    },

    async restoreVersion(creationId, versionId) {
      return remember(await withTransaction(async (client) => {
        const existing = await loadOwnedCreation(client, creationId, { includeVersions: true });
        if (!existing || existing.archivedAt) return null;
        const restored = applyRestoreVersion(existing, versionId, { id: createId(), now });
        if (!restored) return null;
        const version = normalizeVersionForDatabase(restored.currentVersion);
        return appendVersionRows(client, existing, version, userId);
      }));
    },

    async publishCreation(creationId) {
      return remember(await updateLifecycle(
        creationId,
        (creation) => applyPublish(creation, { now }),
        { rejectArchived: true },
      ));
    },

    async unpublishCreation(creationId) {
      return remember(await updateLifecycle(
        creationId,
        (creation) => applyUnpublish(creation, { now }),
        { rejectArchived: true },
      ));
    },

    async archiveCreation(creationId) {
      return remember(await updateLifecycle(creationId, (creation) => applyArchive(creation, { now })));
    },

    async deleteCreation(creationId) {
      const result = await pool.query(
        'delete from public.creations where id = $1 and owner_id = $2 returning id',
        [creationId, userId],
      );
      if (!result.rowCount) return false;
      state = {
        ...state,
        creations: state.creations.filter((creation) => creation.id !== creationId),
        activeCreationId: state.activeCreationId === creationId ? null : state.activeCreationId,
      };
      return true;
    },

    async toggleStar(creationId) {
      return remember(await withTransaction(async (client) => {
        const target = await loadCreation(client, creationId, { publicOnly: true });
        if (!target) return null;
        const existing = await client.query(
          'select 1 from public.stars where profile_id = $1 and creation_id = $2',
          [userId, creationId],
        );
        if (existing.rowCount) {
          await client.query('delete from public.stars where profile_id = $1 and creation_id = $2', [userId, creationId]);
        } else {
          await client.query('insert into public.stars(profile_id, creation_id) values ($1,$2)', [userId, creationId]);
        }
        const updated = await loadCreation(client, creationId, { publicOnly: true });
        return {
          ...updated,
          starredBy: existing.rowCount ? [] : [userId],
        };
      }));
    },

    async cloneCreation(creationId) {
      if (!state.profile) await this.loadCommunityState();
      if (!state.profile) return null;
      const cloned = await withTransaction(async (client) => {
        const source = await loadCreation(client, creationId, { publicOnly: true });
        if (!source) return null;
        const remixId = createId();
        const draft = buildRemix(source, { id: remixId, profile: state.profile, now });
        const version = normalizeVersionForDatabase({ ...draft.currentVersion, id: createId() });
        await client.query(`
          insert into public.creations (
            id, owner_id, slug, title, description, tags, attribution,
            tutorial_reference, preview_config, publish_readiness,
            visibility, remixed_from_id, root_creation_id
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'private',$11,$12)
        `, [remixId, userId, draft.slug, draft.title, draft.description, draft.tags,
          draft.attribution, draft.tutorialReference, draft.previewConfig,
          draft.publishReadiness, source.id, source.rootCreationId || source.id]);
        await client.query(`
          insert into public.creation_versions (
            id, creation_id, version_number, rle, width, height, generation,
            population, rule, settings, parent_version_id
          ) values ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [version.id, remixId, version.rle, version.width, version.height,
          version.generation, version.population, version.rule, version.settings,
          null]);
        await client.query('update public.creations set current_version_id = $1 where id = $2', [version.id, remixId]);
        await client.query('insert into public.remixes(source_creation_id, remix_creation_id) values ($1,$2)', [source.id, remixId]);
        return {
          remix: await loadOwnedCreation(client, remixId, { includeVersions: true }),
          source: await loadCreation(client, source.id, { publicOnly: true }),
        };
      });
      if (!cloned) return null;
      if (cloned.source) {
        state = {
          ...state,
          creations: replaceCreation(state.creations, cloned.source),
        };
      }
      return remember(cloned.remix);
    },

    async listTrendingCreations({ limit = 20 } = {}) {
      const result = await pool.query(
        'select id from public.trending_creations limit $1',
        [Math.max(1, Math.min(100, Number(limit) || 20))],
      );
      const client = await pool.connect();
      try {
        const creations = [];
        for (const row of result.rows) {
          const creation = await loadCreation(client, row.id, { publicOnly: true });
          if (creation) creations.push(creation);
        }
        state = {
          ...state,
          creations: creations.reduce((all, creation) => replaceCreation(all, creation), state.creations),
        };
        return creations;
      } finally {
        client.release();
      }
    },

    findCreation: find,
    setActiveCreation(creationId) {
      state = { ...state, activeCreationId: creationId };
      return state;
    },
  };

  async function updateLifecycle(creationId, transform, { rejectArchived = false } = {}) {
    return withTransaction(async (client) => {
      const existing = await loadOwnedCreation(client, creationId, { includeVersions: true });
      if (!existing || (rejectArchived && existing.archivedAt)) return null;
      const next = transform(existing);
      await client.query(`
        update public.creations set visibility = $1, published_at = $2,
          archived_at = $3, updated_at = $4
         where id = $5 and owner_id = $6
      `, [next.visibility, next.publishedAt, next.archivedAt, next.updatedAt, creationId, userId]);
      return loadOwnedCreation(client, creationId, { includeVersions: true });
    });
  }
}

async function appendVersionRows(client, existing, version, userId) {
  const locked = await client.query(
    'select id from public.creations where id = $1 and owner_id = $2 and archived_at is null for update',
    [existing.id, userId],
  );
  if (!locked.rowCount) return null;
  const latest = await client.query(
    'select coalesce(max(version_number), 0) + 1 as next_number from public.creation_versions where creation_id = $1',
    [existing.id],
  );
  const versionNumber = Number(latest.rows[0].next_number);
  await client.query(`
    insert into public.creation_versions (
      id, creation_id, version_number, rle, width, height, generation,
      population, rule, settings, parent_version_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  `, [version.id, existing.id, versionNumber, version.rle, version.width,
    version.height, version.generation, version.population, version.rule,
    version.settings, version.parentVersionId]);
  await client.query(
    'update public.creations set current_version_id = $1, updated_at = $2 where id = $3',
    [version.id, version.createdAt, existing.id],
  );
  const result = await client.query('select * from public.creations where id = $1', [existing.id]);
  const creation = await loadCreationForOwner(client, result.rows[0], userId);
  return creation;
}

async function loadCreationForOwner(client, row, userId) {
  const result = await client.query(`
    select c.*, p.display_name as owner_name,
           v.id as version_id, v.version_number, v.rle, v.width, v.height,
           v.generation, v.population, v.rule, v.settings, v.parent_version_id,
           v.created_at as version_created_at
      from public.creations c
      left join public.profiles p on p.id = c.owner_id
      left join public.creation_versions v on v.id = c.current_version_id
     where c.id = $1 and c.owner_id = $2
  `, [row.id, userId]);
  if (!result.rows[0]) return null;
  const versions = await client.query(
    'select * from public.creation_versions where creation_id = $1 order by version_number asc',
    [row.id],
  );
  return fromCreationRow(result.rows[0], { versions: versions.rows.map(fromVersionRow) });
}

function normalizeVersionForDatabase(version) {
  const width = Math.max(1, Math.min(600, Number(version.width || version.settings?.width || 1)));
  const height = Math.max(1, Math.min(600, Number(version.height || version.settings?.height || 1)));
  return {
    ...version,
    width,
    height,
    generation: Math.max(0, Number(version.generation || 0)),
    population: Math.max(0, Math.min(width * height, Number(version.population || 0))),
    settings: version.settings || {},
  };
}

function fromProfileRow(row) {
  return {
    id: row.id,
    email: row.email || '',
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || '',
    bio: row.bio || '',
    githubUrl: row.github_url || '',
    linkedinUrl: row.linkedin_url || '',
    createdAt: row.created_at,
  };
}

function fromVersionRow(row) {
  return {
    id: row.id,
    versionNumber: Number(row.version_number || 1),
    rle: row.rle,
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    generation: Number(row.generation || 0),
    population: Number(row.population || 0),
    rule: row.rule || 'B3/S23',
    settings: row.settings || {},
    parentVersionId: row.parent_version_id || null,
    createdAt: row.created_at,
  };
}

function fromCreationRow(row, { versions = null } = {}) {
  const currentVersion = row.version_id
    ? fromVersionRow({
      id: row.version_id,
      version_number: row.version_number,
      rle: row.rle,
      width: row.width,
      height: row.height,
      generation: row.generation,
      population: row.population,
      rule: row.rule,
      settings: row.settings,
      parent_version_id: row.parent_version_id,
      created_at: row.version_created_at,
    })
    : null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description || '',
    attribution: row.attribution || '',
    tutorialReference: row.tutorial_reference || '',
    previewConfig: row.preview_config || {},
    publishReadiness: row.publish_readiness || {},
    visibility: row.visibility,
    ownerId: row.owner_id,
    ownerName: row.owner_name || 'Community Builder',
    thumbnail: '',
    tags: row.tags || [],
    starCount: Number(row.star_count || 0),
    cloneCount: Number(row.clone_count || 0),
    viewCount: Number(row.view_count || 0),
    starredBy: [],
    remixedFromId: row.remixed_from_id || null,
    rootCreationId: row.root_creation_id || row.id,
    currentVersion,
    versions: versions || (currentVersion ? [currentVersion] : []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
  };
}
