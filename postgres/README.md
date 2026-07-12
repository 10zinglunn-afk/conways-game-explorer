# Better Auth + PostgreSQL

The active cloud backend is a server-only PostgreSQL connection. Better Auth
stores users, sessions, accounts, and magic-link verification records in the
`auth` schema. Community tables live in `public` and are accessed through
parameterized server repository methods.

For local development, install PostgreSQL or create a disposable hosted
database, then set:

```bash
export DATABASE_URL='postgres://user:password@host:5432/database'
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
export BETTER_AUTH_URL='http://127.0.0.1:5173'
```

Apply the authored migration:

```bash
npm run db:migrate
npm run dev
```

Magic links are logged by the development server until an email sender is
configured. Set `BETTER_AUTH_LOG_LINKS=0` in production and provide the
`sendMagicLink` integration before enabling sign-in for real users.
