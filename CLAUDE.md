# Project Memory

## Tech Stack Direction

Current stack:

- The app is a vanilla browser ES module app served by a small Node.js static server.
- Community data is local-first by default and can switch to Supabase when runtime config is present.
- Supabase/Postgres is the intended backend for shared community data, auth, row-level security, versions, stars, remixes, and trending.
- The Conway Life engine should stay framework-agnostic and portable.

Target stack:

- Use TypeScript incrementally, starting with pure logic and shared contracts: Life engine, pattern parsing, sharing, and community repository types.
- Move the app shell to Next.js/React only when Phase 2 Supabase acceptance criteria are stable and public SSR routes are the next product goal.
- Keep Supabase/Postgres as the primary backend unless a measured product need proves otherwise.
- Use Vercel/GitHub preview deployments when the Next.js migration begins.
- Use Tailwind CSS only if/when the UI is moved into componentized React/Next.js; plain CSS is fine for the current vanilla app.

Default decisions:

- Do not add Redux by default. Prefer local React state, reducers, context, or server-data tools until shared client state becomes genuinely hard to manage.
- Do not add Sass unless the project specifically needs Sass-only features.
- Do not add Webpack manually. Use Vite for a standalone SPA or Next.js' built-in bundling for the planned app-shell migration.
- Do not replace Supabase/Postgres with MongoDB or Firestore for the community platform; the product model is relational.
- Do not add Redis until profiling or real usage shows a need for caching, rate limiting, queues, or hot leaderboard data.
- Do not add Nest.js unless the project grows into a dedicated custom API service; prefer Next.js route handlers or Supabase Edge Functions first.

Execution priorities:

1. Reconcile Supabase migration drift and verify the backend contract against a real Supabase instance.
2. Introduce TypeScript gradually without blocking current tests.
3. Defer the Next.js/React migration until backend behavior and public-route requirements are settled.
