import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

export async function limitAction(pool, bucket, maximum = 60) {
  if (Math.random() < 0.02) await pool.query(`delete from public.action_limits where expires_at < now() - interval '5 minutes'`);
  const result = await pool.query(`insert into public.action_limits(bucket,hits,expires_at)
    values($1,1,now()+interval '1 minute') on conflict(bucket) do update set
      hits=case when action_limits.expires_at < now() then 1 else action_limits.hits+1 end,
      expires_at=case when action_limits.expires_at < now() then now()+interval '1 minute' else action_limits.expires_at end
    returning hits`, [bucket]);
  if (result.rows[0].hits > maximum) throw Object.assign(new Error('Too many attempts. Please wait a minute and try again.'), {
    status: 429, code: 'RATE_LIMITED', retryAfter: 60,
  });
}

const digest = (value) => createHash('sha256').update(value).digest('hex');
const freshKey = () => randomBytes(32).toString('hex').match(/.{8}/g).join('-');
const canonicalKey = (value) => String(value || '').trim().toLowerCase().replaceAll('-', '');

export async function createRecoveryKey(pool, userId, password) {
  const account = await pool.query(`select password from public.auth_accounts
    where user_id=$1 and provider_id='credential'`, [userId]);
  if (!account.rows[0]?.password || !await verifyPassword({ hash: account.rows[0].password, password: String(password || '') })) {
    throw Object.assign(new Error('Check your password and try again.'), { status: 400 });
  }
  const key = freshKey();
  await pool.query(`insert into public.recovery_keys(user_id,key_hash) values($1,$2)
    on conflict(user_id) do update set key_hash=excluded.key_hash,created_at=now()`, [userId, digest(canonicalKey(key))]);
  return { recoveryKey: key };
}

export async function recoverAccount(pool, { email, recoveryKey, password }) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw Object.assign(new Error('Choose a password with 12 to 128 characters.'), { status: 422 });
  }
  const key = canonicalKey(recoveryKey);
  const invalid = () => Object.assign(new Error('The email or recovery key is incorrect.'), { status: 400 });
  if (!/^[0-9a-f]{64}$/.test(key)) throw invalid();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(`select k.user_id,k.key_hash from public.recovery_keys k
      join public.auth_users u on u.id=k.user_id where u.email=$1 for update of k`, [String(email || '').trim().toLowerCase()]);
    const row = result.rows[0];
    const submitted = Buffer.from(digest(key));
    const expected = Buffer.from(row?.key_hash || '0'.repeat(64));
    if (!timingSafeEqual(submitted, expected) || !row) throw invalid();
    const newKey = freshKey();
    const passwordHash = await hashPassword(password);
    await client.query(`update public.auth_accounts set password=$1,updated_at=now()
      where user_id=$2 and provider_id='credential'`, [passwordHash, row.user_id]);
    await client.query('delete from public.auth_sessions where user_id=$1', [row.user_id]);
    await client.query('update public.recovery_keys set key_hash=$1,created_at=now() where user_id=$2', [digest(canonicalKey(newKey)), row.user_id]);
    await client.query('commit');
    return { recoveryKey: newKey };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
