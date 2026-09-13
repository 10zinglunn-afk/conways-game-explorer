import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { createPostgresCommunityRepository } from './community-repository.mjs';
import { createPublicCommunity } from './public-community.mjs';
import { createCreationImports, digestImportValue } from './creation-imports.mjs';
import { createRecoveryKey, recoverAccount } from './account-security.mjs';
import { createBetterAuth } from './auth.mjs';

const connectionString = process.env.T2_DATABASE_URL;
const lifecycle = connectionString ? test : test.skip;
let pool;
before(() => { if (connectionString) pool = new Pool({ connectionString, max: 4 }); });
after(async () => { await pool?.end(); });

const glider = 'x = 40, y = 40, rule = B3/S23\nbob$2bo$3o!';
const block = 'x = 40, y = 40, rule = B3/S23\n2o$2o!';

lifecycle('fresh create, immutable publication, ownership, recovery, import, and deletion', async () => {
  const auth = createBetterAuth({ database: pool, env: {
    BETTER_AUTH_SECRET: 'disposable-test-secret-at-least-thirty-two-characters',
    BETTER_AUTH_URL: 'http://life.test', NODE_ENV: 'test',
  } });
  const signUp = await auth.handler(new Request('http://life.test/api/auth/sign-up/email', {
    method: 'POST', headers: { origin: 'http://life.test', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Auth User', email: 'auth@example.test', password: 'correct horse battery staple' }),
  }));
  assert.equal(signUp.status, 200);
  assert.equal((await pool.query('select count(*)::int as count from public.auth_users where email=$1', ['auth@example.test'])).rows[0].count, 1);
  const cookie = signUp.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const deletedAuthUser = await auth.handler(new Request('http://life.test/api/auth/delete-user', {
    method: 'POST', headers: { origin: 'http://life.test', cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'correct horse battery staple' }),
  }));
  assert.equal(deletedAuthUser.status, 200);
  assert.equal((await pool.query('select count(*)::int as count from public.auth_users where email=$1', ['auth@example.test'])).rows[0].count, 0);

  const first = await user('ada@example.test', 'Ada Lovelace', 'ada-lovelace');
  const second = await user('grace@example.test', 'Grace Hopper', 'grace-hopper');
  const repo = createPostgresCommunityRepository({ pool, userId: first.id });
  const draft = await repo.createCreation({ title: 'Glider clock', description: 'A glider used to verify immutable publication.',
    tags: ['logic'], rle: glider, width: 40, height: 40,
    settings: { gridPreset: 'custom', width: 40, height: 40 } });
  assert.equal(draft.versions.length, 1, 'fresh repositories create without a memory-cache warmup');
  const published = await repo.publishCreation(draft.id);
  const publishedVersionId = published.publishedVersionId;
  // Exercise the actual SQL boundary, bypassing API validation. CHECK must
  // reject UNKNOWN as well as false and must not coerce JSON values to strings.
  const metadata = (await pool.query('select published_metadata from public.creations where id=$1', [draft.id])).rows[0].published_metadata;
  for (const field of ['title', 'description', 'tags', 'publishReadiness', 'previewConfig']) {
    for (const invalid of [undefined, null, 123, true, []]) {
      const candidate = { ...metadata, [field]: invalid };
      if (invalid === undefined) delete candidate[field];
      await assert.rejects(pool.query('update public.creations set published_metadata=$1 where id=$2', [candidate, draft.id]),
        (error) => error.code === '23514', `${field} must reject ${JSON.stringify(invalid)}`);
    }
  }
  for (const candidate of [null, {}, { ...metadata, previewConfig: { cells: [] } },
    { ...metadata, publishReadiness: { metadata: true, preview: true } }]) {
    await assert.rejects(pool.query('update public.creations set published_metadata=$1 where id=$2', [candidate, draft.id]),
      (error) => error.code === '23514');
  }
  assert.deepEqual((await pool.query('select published_metadata from public.creations where id=$1', [draft.id])).rows[0].published_metadata, metadata);
  const privateEdit = await repo.saveVersion(draft.id, { rle: block, width: 40, height: 40,
    settings: { gridPreset: 'custom', width: 40, height: 40 },
    expectedCurrentVersionId: published.currentVersion.id });
  const publicCopy = await createPublicCommunity({ pool, userId: second.id }).get(draft.slug);
  assert.equal(publicCopy.currentVersion.id, publishedVersionId);
  assert.equal(publicCopy.currentVersion.rle, glider);
  assert.equal('versions' in publicCopy && publicCopy.versions.length, 1);
  const otherRepo = createPostgresCommunityRepository({ pool, userId: second.id });
  assert.equal((await otherRepo.loadVersion(draft.id, published.currentVersion.id)).id, publishedVersionId);
  assert.equal(await otherRepo.loadVersion(draft.id, privateEdit.currentVersion.id), null);
  await assert.rejects(repo.saveVersion(draft.id, { rle: block, width: 40, height: 40,
    settings: { gridPreset: 'custom', width: 40, height: 40 }, expectedCurrentVersionId: publishedVersionId }),
  (error) => error.status === 409 && error.code === 'STALE_VERSION');

  const imports = createCreationImports({ pool, userId: first.id });
  const contents = [glider, block];
  const entries = contents.map((content, index) => ({ localVersionId: `local-v${index + 1}`,
    parentLocalVersionId: index ? 'local-v1' : null, byteLength: Buffer.byteLength(content),
    digest: hash(content), width: 40, height: 40,
    generation: index, settings: { gridPreset: 'custom', width: 40, height: 40 } }));
  const started = await imports.start({ importKey: randomUUID(), localProjectId: 'local-project', capturedRevision: '7',
    project: { title: 'Imported history' }, currentLocalVersionId: 'local-v2', totalVersionCount: 2,
    manifestDigest: digestImportValue(entries) });
  await imports.putManifest(started.importId, 0, { entries, digest: digestImportValue(entries) });
  for (let index = 0; index < entries.length; index += 1) await imports.putVersion(started.importId,
    entries[index].localVersionId, { offset: 0, totalBytes: entries[index].byteLength, digest: entries[index].digest,
      data: contents[index], metadata: entries[index] });
  const retriedChunk = await imports.putVersion(started.importId, entries[0].localVersionId, {
    offset: 0, totalBytes: entries[0].byteLength, digest: entries[0].digest,
    data: contents[0], metadata: entries[0],
  });
  assert.equal(retriedChunk.complete, true);
  const completed = await imports.complete(started.importId);
  assert.equal(completed.imported, true);
  assert.equal(Object.keys(completed.mapping.versionIds).length, 2);
  assert.equal((await imports.complete(started.importId)).existing, true);
  assert.equal((await pool.query('select count(*)::int as count from public.creation_versions where creation_id=$1', [completed.creationId])).rows[0].count, 2);
  await assert.rejects(pool.query(`update public.creations set published_version_id=(select id from public.creation_versions
    where creation_id=$1 limit 1) where id=$2`, [completed.creationId, draft.id]));

  async function stageRevision(service, revision, history = entries) {
    const staged = await service.start({ importKey: randomUUID(), localProjectId: 'local-project', capturedRevision: revision,
      project: { title: 'Imported history', description: 'Retried local edits' },
      currentLocalVersionId: history.at(-1).localVersionId, totalVersionCount: history.length,
      manifestDigest: digestImportValue(history) });
    await service.putManifest(staged.importId, 0, { entries: history, digest: digestImportValue(history) });
    for (const entry of history) await service.putVersion(staged.importId, entry.localVersionId, {
      offset: 0, totalBytes: entry.byteLength, digest: entry.digest,
      data: entry.digest === hash(glider) ? glider : block, metadata: entry,
    });
    return staged;
  }
  const extended = [...entries, { ...entries[0], localVersionId: 'local-v3', parentLocalVersionId: 'local-v2' }];
  const retryA = await stageRevision(imports, '8', extended);
  const retryB = await stageRevision(imports, '8', extended);
  const reconciled = await Promise.all([imports.complete(retryA.importId), imports.complete(retryB.importId)]);
  for (const result of reconciled) {
    assert.equal(result.creationId, completed.creationId);
    assert.equal(result.mapping.versionIds['local-v1'], completed.mapping.versionIds['local-v1']);
    assert.equal(result.mapping.versionIds['local-v2'], completed.mapping.versionIds['local-v2']);
  }
  assert.equal((await pool.query('select count(*)::int as count from public.creation_versions where creation_id=$1', [completed.creationId])).rows[0].count, 3);
  assert.equal((await pool.query("select count(*)::int as count from public.creations where owner_id=$1 and title='Imported history'", [first.id])).rows[0].count, 1);
  const otherImports = createCreationImports({ pool, userId: second.id });
  const otherStage = await stageRevision(otherImports, '8', extended);
  const otherImport = await otherImports.complete(otherStage.importId);
  assert.notEqual(otherImport.creationId, completed.creationId, 'Local IDs must be scoped to their owner');
  await assert.rejects(otherImports.complete(retryA.importId), (error) => error.status === 404);
  // A transaction can start earlier but finish after another captured revision.
  // A subsequent retry must use the last committed mapping, not the latest BEGIN.
  const fourth = [...extended, { ...entries[1], localVersionId: 'local-v4', parentLocalVersionId: 'local-v3' }];
  const delayedStage = await stageRevision(imports, '10', fourth);
  const interveningStage = await stageRevision(imports, '9', extended);
  let resumeBegin;
  let notifyBegin;
  const beginObserved = new Promise((resolve) => { notifyBegin = resolve; });
  const beginReleased = new Promise((resolve) => { resumeBegin = resolve; });
  const delayedImports = createCreationImports({ userId: first.id, pool: {
    async connect() {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        async query(sql, values) {
          const result = await client.query(sql, values);
          if (sql === 'begin') { notifyBegin(); await beginReleased; }
          return result;
        },
      };
    },
  } });
  const delayedCompletion = delayedImports.complete(delayedStage.importId);
  await beginObserved;
  try { await imports.complete(interveningStage.importId); }
  finally { resumeBegin(); }
  await delayedCompletion;
  const followupStage = await stageRevision(imports, '11', fourth);
  const followup = await imports.complete(followupStage.importId);
  assert.equal(followup.creationId, completed.creationId);
  assert.equal(Object.keys(followup.mapping.versionIds).length, 4);

  // Even an existing future timestamp cannot outrank a later serialized commit.
  await pool.query("update public.creation_imports set completed_at=clock_timestamp()+interval '1 day' where id=$1", [followupStage.importId]);
  const afterClockShift = await stageRevision(imports, '12', fourth);
  await imports.complete(afterClockShift.importId);
  assert.equal((await pool.query(`select id from public.creation_imports
    where owner_id=$1 and local_project_id='local-project' and status='complete'
    order by completed_at desc limit 1`, [first.id])).rows[0].id, afterClockShift.importId);

  await repo.saveVersion(completed.creationId, { rle: block, width: 40, height: 40,
    settings: { gridPreset: 'custom', width: 40, height: 40 } });
  const staleRetry = await stageRevision(imports, '9', extended);
  await assert.rejects(imports.complete(staleRetry.importId), (error) => error.code === 'IMPORT_CONFLICT');

  const password = 'correct horse battery staple';
  const key = await createRecoveryKey(pool, first.id, password);
  await pool.query(`insert into public.auth_sessions(id,expires_at,token,user_id) values($1,now()+interval '1 day',$2,$3)`, [randomUUID(), randomUUID(), first.id]);
  const recovered = await recoverAccount(pool, { email: first.email, recoveryKey: key.recoveryKey, password: 'a newer secure password' });
  assert.notEqual(recovered.recoveryKey, key.recoveryKey);
  assert.equal((await pool.query('select count(*)::int as count from public.auth_sessions where user_id=$1', [first.id])).rows[0].count, 0);
  await assert.rejects(recoverAccount(pool, { email: first.email, recoveryKey: key.recoveryKey, password: 'another secure password' }));

  const otherCreation = await createPostgresCommunityRepository({ pool, userId: second.id }).createCreation({ title: 'Host',
    rle: block, width: 40, height: 40,
    settings: { gridPreset: 'custom', width: 40, height: 40 } });
  await pool.query('insert into public.comments(creation_id,author_id,body) values($1,$2,$3)', [otherCreation.id, first.id, 'Keep this useful comment.']);
  await pool.query('delete from public.auth_users where id=$1', [first.id]);
  assert.equal((await pool.query('select count(*)::int as count from public.creations where owner_id=$1', [first.id])).rows[0].count, 0);
  assert.equal((await pool.query('select author_id from public.comments where creation_id=$1', [otherCreation.id])).rows[0].author_id, null);
});

async function user(email, name, username) {
  const id = randomUUID(); const password = await hashPassword('correct horse battery staple');
  await pool.query('insert into public.auth_users(id,name,email) values($1,$2,$3)', [id, name, email]);
  await pool.query(`insert into public.auth_accounts(id,account_id,provider_id,user_id,password) values($1,$2,'credential',$3,$4)`, [randomUUID(), id, id, password]);
  await pool.query('insert into public.profiles(id,username,display_name) values($1,$2,$3)', [id, username, name]);
  return { id, email };
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
