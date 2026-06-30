import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseCommunityRepository } from './community-repository.js';
import { runCommunityRepositoryContract } from './community-repository.contract.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_TEST_EMAIL = process.env.SUPABASE_TEST_EMAIL;
const SUPABASE_TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD || 'SupabaseLiveContract1!';

const LIVE_ENV_PRESENT = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!LIVE_ENV_PRESENT) {
  test('supabase live repository contract', { skip: 'Set SUPABASE_URL and SUPABASE_ANON_KEY to run live Supabase contract tests.' }, () => {});
} else if (!SUPABASE_TEST_EMAIL) {
  test('supabase live repository contract', { skip: 'Set SUPABASE_TEST_EMAIL to a disposable address on a non-reserved domain.' }, () => {});
} else {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const adminClient = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    : null;
  const trackedRepos = [];

  const existingPublicCreations = await countVisiblePublicCreations(client);
  if (existingPublicCreations > 0) {
    test('supabase live repository contract', {
      skip: `The live contract requires an empty/disposable Community database; found ${existingPublicCreations} visible public creations.`,
    }, () => {});
  } else {
    const { user, createdByAdmin } = await signInTestUser(client, adminClient);
    await cleanupUserCreations(client, user.id);

    after(async () => {
      await cleanupTrackedRepos(trackedRepos);
      await cleanupUserCreations(client, user.id);
      await client.auth.signOut();
      if (createdByAdmin) {
        await deleteAdminTestUser(adminClient, user.id);
      }
    });

    runCommunityRepositoryContract('supabase-live', async () => {
      await cleanupTrackedRepos(trackedRepos);
      await cleanupUserCreations(client, user.id);

      const repo = createSupabaseCommunityRepository({
        client,
        now: () => new Date().toISOString(),
      });
      trackedRepos.push({ client, repo });
      return repo;
    });
  }
}

async function signInTestUser(client, adminClient) {
  const credentials = {
    email: SUPABASE_TEST_EMAIL,
    password: SUPABASE_TEST_PASSWORD,
  };

  const signInAttempt = await client.auth.signInWithPassword(credentials);
  if (!signInAttempt.error && signInAttempt.data?.user) {
    return { user: signInAttempt.data.user, createdByAdmin: false };
  }

  if (adminClient) {
    const user = await createAdminTestUser(adminClient, credentials);
    const retry = await client.auth.signInWithPassword(credentials);
    if (retry.error || !retry.data?.user) {
      const reason = retry.error?.message || 'admin-created test user was not returned after sign-in';
      throw new Error(`Unable to sign in Supabase admin-created test user: ${reason}`);
    }

    return { user: retry.data.user || user, createdByAdmin: true };
  }

  const signUpAttempt = await client.auth.signUp(credentials);
  if (signUpAttempt.error) {
    throw new Error(`Unable to create Supabase test user: ${signUpAttempt.error.message}`);
  }

  const retry = await client.auth.signInWithPassword(credentials);
  if (retry.error || !retry.data?.user) {
    const reason = retry.error?.message || 'test user was not returned after sign-up';
    throw new Error(`Unable to sign in Supabase test user: ${reason}`);
  }

  return { user: retry.data.user, createdByAdmin: false };
}

async function createAdminTestUser(adminClient, { email, password }) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Unable to create Supabase admin test user: ${error.message}`);
  }

  return data.user;
}

async function deleteAdminTestUser(adminClient, userId) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  assert.ifError(error);
}

async function cleanupTrackedRepos(trackedRepos) {
  const activeRepos = trackedRepos.splice(0);
  for (const { client, repo } of activeRepos) {
    const profileId = repo.getState().profile?.id;
    if (profileId) {
      await cleanupUserCreations(client, profileId);
    }
  }
}

async function cleanupUserCreations(client, ownerId) {
  const { error } = await client
    .from('creations')
    .delete()
    .eq('owner_id', ownerId);
  assert.ifError(error);
}

async function countVisiblePublicCreations(client) {
  const { count, error } = await client
    .from('creations')
    .select('id', { count: 'exact', head: true })
    .eq('visibility', 'public');
  assert.ifError(error);
  return count || 0;
}
