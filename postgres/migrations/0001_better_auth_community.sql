-- Better Auth + PostgreSQL foundation.
-- The database is private to the server; authorization lives in repository
-- transactions and API handlers rather than browser-facing RLS/Data API calls.

create extension if not exists pgcrypto;
create schema if not exists auth;

-- Better Auth core tables. Column names are mapped to snake_case in
-- server/auth.mjs so the schema remains easy to inspect with SQL.
create table if not exists auth.auth_users (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth.auth_sessions (
  id text primary key default gen_random_uuid()::text,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references auth.auth_users(id) on delete cascade
);

create index if not exists auth_sessions_user_idx on auth.auth_sessions(user_id);
create index if not exists auth_sessions_expires_idx on auth.auth_sessions(expires_at);

create table if not exists auth.auth_accounts (
  id text primary key default gen_random_uuid()::text,
  account_id text not null,
  provider_id text not null,
  user_id text not null references auth.auth_users(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, account_id)
);

create index if not exists auth_accounts_user_idx on auth.auth_accounts(user_id);

create table if not exists auth.auth_verifications (
  id text primary key default gen_random_uuid()::text,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_verifications_identifier_idx
  on auth.auth_verifications(identifier);
create index if not exists auth_verifications_expires_idx
  on auth.auth_verifications(expires_at);

create table if not exists public.profiles (
  id text primary key references auth.auth_users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text not null default '',
  bio text not null default '',
  github_url text not null default '',
  linkedin_url text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.creations (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references auth.auth_users(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  attribution text not null default '',
  tutorial_reference text not null default '',
  preview_config jsonb not null default '{}'::jsonb,
  publish_readiness jsonb not null default '{}'::jsonb,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  current_version_id uuid,
  remixed_from_id uuid references public.creations(id) on delete set null,
  root_creation_id uuid,
  star_count integer not null default 0,
  clone_count integer not null default 0,
  view_count integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique(owner_id, slug),
  check (length(btrim(title)) between 1 and 120),
  check (length(description) <= 2000),
  check (length(attribution) <= 500),
  check (length(tutorial_reference) <= 500),
  check (cardinality(tags) <= 8),
  check (jsonb_typeof(preview_config) = 'object'),
  check (jsonb_typeof(publish_readiness) = 'object')
);

create table if not exists public.creation_versions (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  version_number integer not null,
  rle text not null,
  width integer not null,
  height integer not null,
  generation integer not null default 0,
  population integer not null default 0,
  rule text not null default 'B3/S23',
  settings jsonb not null default '{}'::jsonb,
  parent_version_id uuid references public.creation_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(creation_id, version_number),
  check (version_number > 0),
  check (width between 1 and 600 and height between 1 and 600),
  check (generation >= 0),
  check (population between 0 and width * height),
  check (rule ~ '^B[0-8]*/S[0-8]*$'),
  check (octet_length(rle) between 1 and 200000),
  check (jsonb_typeof(settings) = 'object')
);

alter table public.creations
  add constraint creations_current_version_fk
  foreign key(current_version_id) references public.creation_versions(id)
  on delete set null;

create table if not exists public.stars (
  profile_id text not null references auth.auth_users(id) on delete cascade,
  creation_id uuid not null references public.creations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(profile_id, creation_id)
);

create table if not exists public.remixes (
  source_creation_id uuid not null references public.creations(id) on delete cascade,
  remix_creation_id uuid not null references public.creations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(source_creation_id, remix_creation_id)
);

create index if not exists creations_public_idx on public.creations(visibility, published_at desc);
create index if not exists creations_owner_updated_idx on public.creations(owner_id, updated_at desc);
create index if not exists creations_slug_idx on public.creations(slug);
create index if not exists creations_tags_idx on public.creations using gin(tags);
create index if not exists creation_versions_history_idx
  on public.creation_versions(creation_id, version_number desc);
create index if not exists stars_creation_idx on public.stars(creation_id);
create index if not exists remixes_source_idx on public.remixes(source_creation_id);

create or replace function public.touch_creation_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists creations_touch_updated_at on public.creations;
create trigger creations_touch_updated_at
before update on public.creations
for each row execute function public.touch_creation_updated_at();

create or replace function public.refresh_star_count()
returns trigger language plpgsql as $$
declare target uuid := coalesce(new.creation_id, old.creation_id);
begin
  update public.creations
     set star_count = (select count(*) from public.stars where creation_id = target)
   where id = target;
  return null;
end;
$$;

drop trigger if exists stars_maintain_count on public.stars;
create trigger stars_maintain_count
after insert or delete on public.stars
for each row execute function public.refresh_star_count();

create or replace function public.refresh_clone_count()
returns trigger language plpgsql as $$
declare target uuid := coalesce(new.source_creation_id, old.source_creation_id);
begin
  update public.creations
     set clone_count = (select count(*) from public.remixes where source_creation_id = target)
   where id = target;
  return null;
end;
$$;

drop trigger if exists remixes_maintain_count on public.remixes;
create trigger remixes_maintain_count
after insert or delete on public.remixes
for each row execute function public.refresh_clone_count();

create or replace view public.trending_creations as
select c.*,
  (c.star_count * 8) + (c.clone_count * 13) + (c.view_count * 0.5)
  + greatest(0, 14 - extract(epoch from (now() - coalesce(c.published_at, c.updated_at))) / 86400.0) as score
from public.creations c
where c.visibility = 'public' and c.archived_at is null
order by score desc, c.updated_at desc;
