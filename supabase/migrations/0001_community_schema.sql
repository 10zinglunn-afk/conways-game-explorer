-- Conway Life Logic — community schema, RLS, counter integrity, trending.
--
-- Greenfield: authored to match docs/community-platform-plan.md. Not yet applied
-- to a live project. Apply with `supabase db push` (or paste into the SQL editor)
-- once a project exists. Mirrors the local repository contract in
-- src/community-repository.contract.js.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- profiles: 1:1 with auth.users. id IS the authenticated user id, so every RLS
-- policy can key on auth.uid().
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique,
  display_name text not null,
  avatar_url   text not null default '',
  bio          text not null default '',
  github_url   text not null default '',
  linkedin_url text not null default '',
  is_public    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- creations: mutable metadata for a build. Counters are denormalized and only
-- ever written by the SECURITY DEFINER functions below, never by clients.
create table public.creations (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles (id) on delete cascade,
  slug               text not null,
  title              text not null,
  description        text not null default '',
  tags               text[] not null default '{}',
  visibility         text not null default 'private' check (visibility in ('private', 'public')),
  current_version_id uuid, -- FK added after creation_versions exists
  remixed_from_id    uuid references public.creations (id) on delete set null,
  root_creation_id   uuid,
  star_count         integer not null default 0,
  clone_count        integer not null default 0,
  view_count         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  published_at       timestamptz,
  unique (owner_id, slug),
  check (cardinality(tags) <= 8)
);

-- creation_versions: immutable snapshots. The local embedded `currentVersion`
-- maps to a row here; creations.current_version_id points at the latest.
create table public.creation_versions (
  id                uuid primary key default gen_random_uuid(),
  creation_id       uuid not null references public.creations (id) on delete cascade,
  rle               text not null,
  width             integer not null default 0,
  height            integer not null default 0,
  generation        integer not null default 0,
  population        integer not null default 0,
  rule              text not null default 'B3/S23',
  parent_version_id uuid references public.creation_versions (id) on delete set null,
  created_at        timestamptz not null default now(),
  check (length(rle) <= 200000) -- payload size cap (plan 2.7)
);

alter table public.creations
  add constraint creations_current_version_fk
  foreign key (current_version_id) references public.creation_versions (id) on delete set null;

-- stars: one row per profile + creation. Source of truth for star_count.
create table public.stars (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  creation_id uuid not null references public.creations (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, creation_id)
);

-- remixes: lineage. Source of truth for clone_count on the source creation.
create table public.remixes (
  source_creation_id uuid not null references public.creations (id) on delete cascade,
  remix_creation_id  uuid not null references public.creations (id) on delete cascade,
  created_at         timestamptz not null default now(),
  primary key (source_creation_id, remix_creation_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index creations_public_idx       on public.creations (visibility, published_at desc);
create index creations_owner_idx        on public.creations (owner_id);
create index creations_tags_idx         on public.creations using gin (tags);
create index creation_versions_creation on public.creation_versions (creation_id);
create index stars_creation_idx         on public.stars (creation_id);
create index remixes_source_idx         on public.remixes (source_creation_id);

-- ---------------------------------------------------------------------------
-- Counter integrity (plan 2.3)
-- Triggers run SECURITY DEFINER so they can update the denormalized count on a
-- creation the acting user does not own (the clone problem) without granting
-- clients direct write access to count columns.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_star_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.creation_id, old.creation_id);
begin
  update public.creations c
     set star_count = (select count(*) from public.stars s where s.creation_id = target)
   where c.id = target;
  return null;
end;
$$;

create trigger stars_maintain_count
  after insert or delete on public.stars
  for each row execute function public.refresh_star_count();

create or replace function public.refresh_clone_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.source_creation_id, old.source_creation_id);
begin
  update public.creations c
     set clone_count = (select count(*) from public.remixes r where r.source_creation_id = target)
   where c.id = target;
  return null;
end;
$$;

create trigger remixes_maintain_count
  after insert or delete on public.remixes
  for each row execute function public.refresh_clone_count();

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger creations_touch_updated_at
  before update on public.creations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Atomic clone (plan 2.3): validates the source is public, creates the
-- caller-owned private creation + version, and records lineage (which fires the
-- clone_count trigger). SECURITY DEFINER so the lineage insert and cross-owner
-- count update are allowed; the function itself enforces the access rules.
-- ---------------------------------------------------------------------------
create or replace function public.clone_creation(source_id uuid, new_slug text, new_title text)
returns public.creations
language plpgsql
security definer
set search_path = public
as $$
declare
  caller   uuid := auth.uid();
  source   public.creations;
  src_ver  public.creation_versions;
  remix    public.creations;
  new_ver  public.creation_versions;
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  select * into source from public.creations where id = source_id;
  if not found or source.visibility <> 'public' then
    raise exception 'source creation is not available for cloning';
  end if;

  select * into src_ver from public.creation_versions where id = source.current_version_id;

  insert into public.creations (owner_id, slug, title, description, tags, visibility,
                                remixed_from_id, root_creation_id)
  values (caller, new_slug, new_title, source.description, source.tags, 'private',
          source.id, coalesce(source.root_creation_id, source.id))
  returning * into remix;

  insert into public.creation_versions (creation_id, rle, width, height, generation, population, rule)
  values (remix.id, coalesce(src_ver.rle, ''), coalesce(src_ver.width, 0), coalesce(src_ver.height, 0),
          coalesce(src_ver.generation, 0), coalesce(src_ver.population, 0), coalesce(src_ver.rule, 'B3/S23'))
  returning * into new_ver;

  update public.creations set current_version_id = new_ver.id where id = remix.id
  returning * into remix;

  insert into public.remixes (source_creation_id, remix_creation_id)
  values (source.id, remix.id);

  return remix;
end;
$$;

-- View-count bump (plan 2.4), rate-limited by callers.
create or replace function public.increment_view(target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.creations set view_count = view_count + 1
  where id = target and visibility = 'public';
$$;

-- ---------------------------------------------------------------------------
-- Trending (plan 2.4): same weighting as the local engine.
-- ---------------------------------------------------------------------------
create or replace view public.trending_creations as
select
  c.*,
  (c.star_count * 8)
  + (c.clone_count * 13)
  + (c.view_count * 0.5)
  + greatest(0, 14 - (extract(epoch from (now() - coalesce(c.published_at, c.updated_at))) / 86400.0)) as score
from public.creations c
where c.visibility = 'public'
order by score desc, c.updated_at desc;

-- ---------------------------------------------------------------------------
-- Row level security (plan 2.3)
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.creations         enable row level security;
alter table public.creation_versions enable row level security;
alter table public.stars             enable row level security;
alter table public.remixes           enable row level security;

-- profiles
create policy profiles_read on public.profiles
  for select using (is_public or id = auth.uid());
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- creations
create policy creations_read on public.creations
  for select using (visibility = 'public' or owner_id = auth.uid());
create policy creations_insert_own on public.creations
  for insert with check (owner_id = auth.uid());
create policy creations_update_own on public.creations
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy creations_delete_own on public.creations
  for delete using (owner_id = auth.uid());

-- creation_versions: readable when the parent creation is readable; insert when
-- the caller owns the parent creation.
create policy creation_versions_read on public.creation_versions
  for select using (exists (
    select 1 from public.creations c
    where c.id = creation_id and (c.visibility = 'public' or c.owner_id = auth.uid())
  ));
create policy creation_versions_insert_own on public.creation_versions
  for insert with check (exists (
    select 1 from public.creations c
    where c.id = creation_id and c.owner_id = auth.uid()
  ));

-- stars: read public; users star/unstar only their own row, and only public creations.
create policy stars_read on public.stars
  for select using (true);
create policy stars_insert_own on public.stars
  for insert with check (
    profile_id = auth.uid()
    and exists (select 1 from public.creations c where c.id = creation_id and c.visibility = 'public')
  );
create policy stars_delete_own on public.stars
  for delete using (profile_id = auth.uid());

-- remixes: lineage is written only by clone_creation() (SECURITY DEFINER, which
-- bypasses RLS). No direct client insert policy is granted.
create policy remixes_read on public.remixes
  for select using (true);
