-- Public reads use an explicit published snapshot; private edits never silently
-- replace the version visitors are running.
alter table public.creations add column published_version_id uuid
  references public.creation_versions(id) on delete set null;
alter table public.creations add column published_metadata jsonb;
alter table public.creations add column import_key text;
alter table public.creations add column moderation_status text not null default 'visible'
  check (moderation_status in ('visible', 'hidden'));
create unique index creations_import_key on public.creations(owner_id, import_key)
  where import_key is not null;

update public.creations set published_version_id = current_version_id,
  published_metadata = jsonb_build_object('title', title, 'description', description,
    'tags', tags, 'attribution', attribution, 'tutorialReference', tutorial_reference,
    'previewConfig', preview_config, 'publishReadiness', publish_readiness)
where visibility = 'public';

alter table public.creations drop constraint creations_public_readiness_check;
alter table public.creations add constraint creations_public_snapshot_check check (
  (visibility = 'private' or (
    published_version_id is not null and published_at is not null
    and archived_at is null and published_metadata is not null
    and jsonb_typeof(published_metadata) = 'object'
    and jsonb_typeof(published_metadata->'title') = 'string'
    and jsonb_typeof(published_metadata->'description') = 'string'
    and length(btrim(published_metadata->>'title')) between 1 and 120
    and length(btrim(published_metadata->>'description')) between 20 and 2000
    and case when jsonb_typeof(published_metadata->'tags') = 'array'
      then jsonb_array_length(published_metadata->'tags') between 1 and 8 else false end
    and jsonb_typeof(published_metadata->'publishReadiness') = 'object'
    and published_metadata->'publishReadiness' @> '{"metadata":true,"board":true,"preview":true}'
    and jsonb_typeof(published_metadata->'previewConfig') = 'object'
    and case when jsonb_typeof(published_metadata->'previewConfig'->'cells') = 'array'
      then jsonb_array_length(published_metadata->'previewConfig'->'cells') > 0 else false end
  )) is true
);

-- Public URLs and profile URLs are global, case-insensitive identifiers.
alter table public.creations drop constraint if exists creations_owner_id_slug_key;
create unique index creations_slug_global_unique on public.creations(lower(slug));
alter table public.profiles add constraint profiles_username_format_check
  check (username = lower(username) and username ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and length(username) between 3 and 40);
create unique index profiles_username_global_unique on public.profiles(lower(username));

-- A creation may only point at one of its own versions. The original single
-- column foreign keys allowed another creation's version to become current or
-- public, which could disclose private RLE.
alter table public.creation_versions add constraint creation_versions_creation_id_id_key
  unique (creation_id, id);
alter table public.creations drop constraint if exists creations_current_version_fk;
alter table public.creations drop constraint if exists creations_published_version_id_fkey;
alter table public.creations add constraint creations_current_version_owned_fk
  foreign key (id, current_version_id)
  references public.creation_versions(creation_id, id) on delete no action
  deferrable initially deferred;
alter table public.creations add constraint creations_published_version_owned_fk
  foreign key (id, published_version_id)
  references public.creation_versions(creation_id, id) on delete no action
  deferrable initially deferred;

-- Raise the same board limit enforced by the editor and server validators.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.creation_versions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%width%600%'
  loop
    execute format('alter table public.creation_versions drop constraint %I', constraint_name);
  end loop;
end $$;
alter table public.creation_versions add constraint creation_versions_dimensions_check
  check (width between 1 and 2048 and height between 1 and 2048);
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.creation_versions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%octet_length(rle)%'
  loop
    execute format('alter table public.creation_versions drop constraint %I', constraint_name);
  end loop;
end $$;
alter table public.creation_versions add constraint creation_versions_rle_size_check
  check (octet_length(rle) between 1 and 5000000);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  author_id text references public.auth_users(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_creation_idx on public.comments(creation_id, created_at, id);

create table public.pattern_favorites (
  user_id text not null references public.auth_users(id) on delete cascade,
  pattern_id text not null check (length(pattern_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key(user_id, pattern_id)
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text references public.auth_users(id) on delete set null,
  creation_id uuid references public.creations(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 5 and 2000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.action_limits (
  bucket text primary key,
  hits integer not null,
  expires_at timestamptz not null
);
create index action_limits_expiry_idx on public.action_limits(expires_at);

create table public.recovery_keys (
  user_id text primary key references public.auth_users(id) on delete cascade,
  key_hash text not null,
  created_at timestamptz not null default now()
);

-- Guest projects are uploaded in bounded, resumable requests and become
-- visible to the owner only after atomic completion.
create table public.creation_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.auth_users(id) on delete cascade,
  import_key text not null,
  local_project_id text not null,
  captured_revision text not null,
  project jsonb not null check (jsonb_typeof(project) = 'object'),
  current_local_version_id text not null,
  total_version_count integer not null check (total_version_count between 1 and 10000),
  manifest_digest text not null check (manifest_digest ~ '^[a-f0-9]{64}$'),
  status text not null default 'uploading' check (status in ('uploading','complete')),
  creation_id uuid references public.creations(id) on delete cascade,
  version_mapping jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(owner_id, import_key)
);
create index creation_imports_expiry_idx on public.creation_imports(status, updated_at);

create table public.creation_import_manifest (
  import_id uuid not null references public.creation_imports(id) on delete cascade,
  batch_number integer not null check (batch_number >= 0),
  entries jsonb not null check (jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) between 1 and 40),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key(import_id, batch_number)
);

create table public.creation_import_versions (
  import_id uuid not null references public.creation_imports(id) on delete cascade,
  local_version_id text not null,
  total_bytes integer not null check (total_bytes between 1 and 5000000),
  content_digest text not null check (content_digest ~ '^[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  content bytea not null default ''::bytea,
  received_bytes integer not null default 0 check (received_bytes >= 0),
  complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(import_id, local_version_id),
  check (received_bytes <= total_bytes and octet_length(content) = received_bytes)
);
