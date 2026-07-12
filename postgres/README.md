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

## Cloudflare Workers + Hyperdrive

Production runs as a Cloudflare Worker. Hyperdrive provides the pooled
PostgreSQL connection; its connection string is exposed only as the Worker
binding, never to the browser. The Worker config intentionally has no
database identifier committed. Create the Hyperdrive config, then add its
generated ID to `wrangler.jsonc`:

```jsonc
"hyperdrive": [{
  "binding": "HYPERDRIVE",
  "id": "your-hyperdrive-id"
}]
```

Set these Cloudflare Worker secrets with Wrangler, after signing in:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_API_KEY
```

`BETTER_AUTH_API_KEY` enables the Better Auth Dash plugin and stays
server-only. Rotate any key that was pasted into a chat or terminal history
before adding it. Set `BETTER_AUTH_URL` to the final Worker URL (or custom
domain) as a non-secret Worker variable after the first deployment.

Magic links are logged only by the development server. Production sign-in
stays safely disabled until an email sender is configured; set
`BETTER_AUTH_LOG_LINKS=0` in production and provide the `sendMagicLink`
integration before inviting real users.
