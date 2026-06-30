# Project Memory

## Preferred Tech Stack

The project should evolve toward:

- TypeScript for safer shared logic and contracts.
- Next.js/React for the app shell when public SSR/community pages become the next goal.
- Supabase/Postgres for auth, database, RLS, creations, versions, stars, remixes, and trending.
- Tailwind CSS only after or during a componentized React/Next.js UI migration.
- Vercel/GitHub preview deployments once the Next.js phase starts.

Avoid adding these by default:

- Redux, until client state complexity clearly requires it.
- Sass, unless Sass-specific features are needed.
- Webpack, because Vite or Next.js should handle bundling.
- MongoDB or Firestore, because the community data model is relational.
- Redis, until profiling or real usage shows a caching/rate-limit/queue need.
- Nest.js, unless a dedicated custom API service becomes necessary.

Immediate priorities:

1. Keep the Life engine framework-agnostic.
2. Stabilize Supabase migration history and real backend contract testing.
3. Add TypeScript incrementally.
4. Move to Next.js/React later, when public SSR routes justify it.
