import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { toNodeHandler } from 'better-auth/node';
import { magicLink } from 'better-auth/plugins';

export function createPostgresPool({ env = process.env } = {}) {
  if (!env.DATABASE_URL) return null;

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: Number(env.DATABASE_POOL_MAX || 5),
    idleTimeoutMillis: Number(env.DATABASE_IDLE_TIMEOUT_MS || 30_000),
    // Better Auth receives the raw pg Pool and addresses its tables by their
    // model names. Search its private schema first while leaving application
    // queries fully-qualified as public.* or auth.*.
    options: '-c search_path=auth,public',
  });

  pool.on('error', (error) => {
    console.error('PostgreSQL pool error:', error.message);
  });

  return pool;
}

export function createBetterAuth({
  env = process.env,
  database = createPostgresPool({ env }),
  sendMagicLink,
} = {}) {
  if (!database) return null;

  if (!env.BETTER_AUTH_SECRET) {
    throw new Error('Better Auth is configured but BETTER_AUTH_SECRET is missing.');
  }

  const baseURL = env.BETTER_AUTH_URL
    || `http://${env.HOST || '127.0.0.1'}:${env.PORT || '5173'}`;
  const trustedOrigins = [
    baseURL,
    ...(env.BETTER_AUTH_TRUSTED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];

  return betterAuth({
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins,
    user: {
      modelName: 'auth_users',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    session: {
      modelName: 'auth_sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
      },
    },
    account: {
      modelName: 'auth_accounts',
      fields: {
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    verification: {
      modelName: 'auth_verifications',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    plugins: [magicLink({
      storeToken: 'hashed',
      async sendMagicLink(payload, context) {
        if (sendMagicLink) {
          await sendMagicLink(payload, context);
          return;
        }

        if (env.NODE_ENV !== 'production' && env.BETTER_AUTH_LOG_LINKS !== '0') {
          console.log(`[better-auth] Magic link for ${payload.email}: ${payload.url}`);
          return;
        }

        throw new Error(
          'Magic-link delivery is not configured. Provide a sendMagicLink implementation.',
        );
      },
    })],
  });
}

export function createBetterAuthHandler(options = {}) {
  const auth = createBetterAuth(options);
  return auth ? toNodeHandler(auth) : null;
}
