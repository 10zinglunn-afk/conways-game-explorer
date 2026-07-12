# Cloudflare deployment

This project deploys as one Cloudflare Worker: it serves the static Game of
Life app, Better Auth routes, and the authenticated community API from the
same origin. PostgreSQL stays external; Cloudflare Hyperdrive pools and
caches connections to it.

## First-time setup

1. Create a PostgreSQL database (Neon is a good starter choice), copy its
   direct (non-pooled) connection string, and apply the existing migration
   with `DATABASE_URL=... npm run db:migrate`.
2. Authenticate the local CLI with `npx wrangler login`.
3. Create Hyperdrive using the database connection string:

   ```bash
   npx wrangler hyperdrive create conways-postgres --connection-string="$DATABASE_URL" --caching-disabled
   ```

4. Copy the returned Hyperdrive ID into the `hyperdrive` binding shown in
   [postgres/README.md](../postgres/README.md).
5. Create the required Worker secret. Do not put it in `wrangler.jsonc`:

   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET
   ```

   `BETTER_AUTH_API_KEY` is optional and only needed when enabling Better Auth
   Infrastructure Dash features.

6. Deploy:

   ```bash
   npm run deploy:worker
   ```

7. Set `BETTER_AUTH_URL` to the deployment URL (or your custom domain) in
   the Worker dashboard and deploy once more.

## Local Worker preview

Use the Node server for the existing local-first experience:

```bash
npm run dev
```

To test the Cloudflare runtime after configuring local secrets/bindings, use:

```bash
npm run dev:worker
```

The generated `worker-assets/` directory is intentionally ignored by Git.
