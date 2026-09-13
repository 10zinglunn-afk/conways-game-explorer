# Better Auth + PostgreSQL

The active cloud backend is a server-only PostgreSQL connection. Better Auth
stores users, sessions, and password-account records in the `public.auth_*`
tables. Community tables also live in `public` and are
accessed through parameterized server repository methods. Keeping the custom
Better Auth tables in `public` avoids a PostgreSQL startup `search_path`
setting, which hosted pooler endpoints can reject.

For local development, install PostgreSQL or create a disposable hosted
database, then set:

```bash
export DATABASE_URL='postgres://user:password@host:5432/database'
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
export BETTER_AUTH_URL='http://127.0.0.1:5173'
```

Apply the authored migrations, including the Phase 2 publish-readiness and
accessible-preview constraints:

```bash
npm run db:migrate
npm run dev
```

## Cloudflare Workers + Hyperdrive

Production runs as a Cloudflare Worker. Hyperdrive provides the pooled
PostgreSQL connection; its connection string is exposed only as the Worker
binding, never to the browser. Use the provider's direct (non-pooled)
connection string because Hyperdrive owns pooling. Disable Hyperdrive's query
cache for this authenticated application so session and profile reads are
always fresh. Add its generated ID to `wrangler.jsonc`:

```jsonc
"hyperdrive": [{
  "binding": "HYPERDRIVE",
  "id": "your-hyperdrive-id"
}]
```

Set these Cloudflare Worker secrets with Wrangler, after signing in:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
```

`BETTER_AUTH_API_KEY` is optional: it enables the Better Auth Dash plugin and
stays server-only when you create a Better Auth Infrastructure project. Rotate
any key that was pasted into a chat or terminal history before adding it. Set
`BETTER_AUTH_URL` to the final Worker URL (or custom domain) as a non-secret
Worker variable after the first deployment.

## Account model

Production uses Better Auth's built-in email-and-password flow. Passwords are
hashed with Better Auth's scrypt implementation and stored only in
`public.auth_accounts`; the browser communicates only with same-origin
`/api/auth/*` endpoints and never receives a database credential.

This project intentionally does **not** enable email verification or password
reset yet, because those flows require a transactional email sender. Invite
only users who can retain their password until that sender is introduced.
