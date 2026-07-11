-- Phase 1: durable creation metadata and immutable replay snapshots.

alter table public.creations
  add column attribution text not null default '',
  add column tutorial_reference text not null default '',
  add column preview_config jsonb not null default '{}'::jsonb,
  add column publish_readiness jsonb not null default '{}'::jsonb,
  add column archived_at timestamptz;

alter table public.creation_versions
  add column version_number integer,
  add column settings jsonb not null default jsonb_build_object(
    'gridPreset', 'medium',
    'width', 300,
    'height', 200,
    'wrapping', true,
    'speed', 10,
    'zoom', 1,
    'backgroundColor', '#07090f',
    'gridColor', '#334155',
    'liveCellColor', '#5eead4',
    'trailCellColor', '#38bdf8',
    'accentColor', '#2dd4bf',
    'selectionColor', '#fbbf24',
    'renderStyle', 'square',
    'trailIntensity', 'medium',
    'rule', 'B3/S23',
    'camera', jsonb_build_object('x', 0, 'y', 0)
  );

create or replace function community_private.valid_creation_tags(tags text[])
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select cardinality(tags) <= 8
    and coalesce(bool_and(length(tag) between 1 and 32 and tag ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), true)
  from unnest(tags) tag;
$$;

revoke execute on function community_private.valid_creation_tags(text[])
  from public, anon;
grant execute on function community_private.valid_creation_tags(text[])
  to authenticated, service_role;

with numbered as (
  select id, row_number() over (partition by creation_id order by created_at, id)::integer as number
  from public.creation_versions
)
update public.creation_versions version
set version_number = numbered.number
from numbered
where numbered.id = version.id;

update public.creation_versions
set width = greatest(1, least(600, width)),
    height = greatest(1, least(600, height)),
    generation = greatest(0, generation),
    population = greatest(0, least(population, greatest(1, least(600, width)) * greatest(1, least(600, height)))),
    rule = case when rule ~ '^B[0-8]*/S[0-8]*$' then rule else 'B3/S23' end,
    rle = case when octet_length(rle) = 0 then E'x = 0, y = 0, rule = B3/S23\n!' else rle end;

alter table public.creation_versions
  alter column version_number set not null,
  alter column version_number set default 1;

alter table public.creations
  add constraint creations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 1 and 100),
  add constraint creations_title_length check (length(btrim(title)) between 1 and 120),
  add constraint creations_description_length check (length(description) <= 2000),
  add constraint creations_attribution_length check (length(attribution) <= 500),
  add constraint creations_tutorial_reference_length check (length(tutorial_reference) <= 500),
  add constraint creations_tags_valid check (community_private.valid_creation_tags(tags)),
  add constraint creations_preview_config_object check (jsonb_typeof(preview_config) = 'object'),
  add constraint creations_publish_readiness_object check (jsonb_typeof(publish_readiness) = 'object');

alter table public.creation_versions
  add constraint creation_versions_number_positive check (version_number > 0),
  add constraint creation_versions_dimensions check (width between 1 and 600 and height between 1 and 600),
  add constraint creation_versions_generation check (generation >= 0),
  add constraint creation_versions_population check (population between 0 and width * height),
  add constraint creation_versions_rule_format check (rule ~ '^B[0-8]*/S[0-8]*$'),
  add constraint creation_versions_rle_size check (octet_length(rle) between 1 and 200000),
  add constraint creation_versions_settings_shape check (
    jsonb_typeof(settings) = 'object'
    and settings ?& array[
      'wrapping', 'speed', 'zoom', 'backgroundColor', 'gridColor',
      'liveCellColor', 'trailCellColor', 'accentColor', 'selectionColor',
      'renderStyle', 'trailIntensity', 'camera'
    ]
    and jsonb_typeof(settings -> 'wrapping') = 'boolean'
    and (settings ->> 'speed')::numeric between 1 and 40
    and (settings ->> 'zoom')::numeric between 0.18 and 3.6
    and settings ->> 'renderStyle' in ('square', 'rounded', 'glow', 'dot')
    and settings ->> 'trailIntensity' in ('off', 'low', 'medium', 'high')
    and settings ->> 'backgroundColor' ~ '^#[0-9a-fA-F]{6}$'
    and settings ->> 'gridColor' ~ '^#[0-9a-fA-F]{6}$'
    and settings ->> 'liveCellColor' ~ '^#[0-9a-fA-F]{6}$'
    and settings ->> 'trailCellColor' ~ '^#[0-9a-fA-F]{6}$'
    and settings ->> 'accentColor' ~ '^#[0-9a-fA-F]{6}$'
    and settings ->> 'selectionColor' ~ '^#[0-9a-fA-F]{6}$'
    and jsonb_typeof(settings -> 'camera') = 'object'
    and jsonb_typeof(settings -> 'camera' -> 'x') = 'number'
    and jsonb_typeof(settings -> 'camera' -> 'y') = 'number'
  );

create unique index creation_versions_number_unique
  on public.creation_versions (creation_id, version_number);
create index creations_owner_updated_idx
  on public.creations (owner_id, updated_at desc)
  where archived_at is null;
create index creations_slug_idx on public.creations (slug);
create index creation_versions_history_idx
  on public.creation_versions (creation_id, version_number desc);

create or replace function public.create_creation(
  creation_id uuid,
  creation_slug text,
  creation_title text,
  creation_description text,
  creation_tags text[],
  creation_attribution text,
  creation_tutorial_reference text,
  creation_preview_config jsonb,
  creation_publish_readiness jsonb,
  creation_visibility text,
  creation_published_at timestamptz,
  version_id uuid,
  version_rle text,
  version_width integer,
  version_height integer,
  version_generation integer,
  version_population integer,
  version_rule text,
  version_settings jsonb
)
returns public.creations
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  visibility_value text := coalesce(creation_visibility, 'private');
  saved public.creations;
  saved_version public.creation_versions;
begin
  if caller is null then raise exception 'authentication required'; end if;
  if visibility_value not in ('private', 'public') then raise exception 'invalid creation visibility'; end if;

  insert into public.creations (
    id, owner_id, slug, title, description, tags, attribution,
    tutorial_reference, preview_config, publish_readiness, visibility,
    root_creation_id, published_at
  ) values (
    creation_id, caller, creation_slug, creation_title, coalesce(creation_description, ''),
    coalesce(creation_tags, '{}'), coalesce(creation_attribution, ''),
    coalesce(creation_tutorial_reference, ''), coalesce(creation_preview_config, '{}'),
    coalesce(creation_publish_readiness, '{}'), visibility_value, creation_id,
    case when visibility_value = 'public' then coalesce(creation_published_at, now()) end
  ) returning * into saved;

  insert into public.creation_versions (
    id, creation_id, version_number, rle, width, height, generation,
    population, rule, settings
  ) values (
    version_id, saved.id, 1, version_rle, version_width, version_height,
    version_generation, version_population, version_rule, version_settings
  ) returning * into saved_version;

  update public.creations set current_version_id = saved_version.id
  where id = saved.id returning * into saved;
  return saved;
end;
$$;

create or replace function public.save_creation_version(
  target_creation_id uuid,
  new_version_id uuid,
  version_rle text,
  version_width integer,
  version_height integer,
  version_generation integer,
  version_population integer,
  version_rule text,
  version_settings jsonb,
  requested_parent_version_id uuid default null
)
returns public.creations
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  saved public.creations;
  saved_version public.creation_versions;
  next_number integer;
begin
  select * into saved from public.creations
  where id = target_creation_id and owner_id = auth.uid()
  for update;
  if not found then raise exception 'creation not found'; end if;
  if saved.archived_at is not null then raise exception 'archived creation cannot be versioned'; end if;
  if requested_parent_version_id is not null and not exists (
    select 1 from public.creation_versions
    where id = requested_parent_version_id and creation_id = saved.id
  ) then
    raise exception 'parent version does not belong to creation';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_number
  from public.creation_versions where creation_id = saved.id;

  insert into public.creation_versions (
    id, creation_id, version_number, rle, width, height, generation,
    population, rule, settings, parent_version_id
  ) values (
    new_version_id, saved.id, next_number, version_rle, version_width,
    version_height, version_generation, version_population, version_rule,
    version_settings, coalesce(requested_parent_version_id, saved.current_version_id)
  ) returning * into saved_version;

  update public.creations set current_version_id = saved_version.id
  where id = saved.id returning * into saved;
  return saved;
end;
$$;

create or replace function public.restore_creation_version(
  target_creation_id uuid,
  source_version_id uuid,
  new_version_id uuid
)
returns public.creations
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  source public.creation_versions;
begin
  select version.* into source
  from public.creation_versions version
  join public.creations creation on creation.id = version.creation_id
  where version.id = source_version_id
    and version.creation_id = target_creation_id
    and creation.owner_id = auth.uid();
  if not found then raise exception 'version not found'; end if;

  return public.save_creation_version(
    target_creation_id, new_version_id, source.rle, source.width, source.height,
    source.generation, source.population, source.rule, source.settings, source.id
  );
end;
$$;

-- Preserve replay metadata when cloning through the private atomic helper.
create or replace function community_private.clone_creation(source_id uuid, new_slug text, new_title text)
returns public.creations
language plpgsql
security definer
set search_path = public, community_private, pg_temp
as $$
declare
  caller uuid := auth.uid();
  source public.creations;
  src_ver public.creation_versions;
  remix public.creations;
  new_ver public.creation_versions;
begin
  if caller is null then raise exception 'authentication required'; end if;
  select * into source from public.creations where id = source_id;
  if not found or source.visibility <> 'public' or source.archived_at is not null then
    raise exception 'source creation is not available for cloning';
  end if;
  select * into src_ver from public.creation_versions where id = source.current_version_id;

  insert into public.creations (
    owner_id, slug, title, description, tags, attribution, tutorial_reference,
    preview_config, publish_readiness, visibility, remixed_from_id, root_creation_id
  ) values (
    caller, new_slug, new_title, source.description, source.tags, source.attribution,
    source.tutorial_reference, source.preview_config, source.publish_readiness,
    'private', source.id, coalesce(source.root_creation_id, source.id)
  ) returning * into remix;

  insert into public.creation_versions (
    creation_id, version_number, rle, width, height, generation, population,
    rule, settings, parent_version_id
  ) values (
    remix.id, 1, src_ver.rle, src_ver.width, src_ver.height, src_ver.generation,
    src_ver.population, src_ver.rule, src_ver.settings, src_ver.id
  ) returning * into new_ver;
  update public.creations set current_version_id = new_ver.id where id = remix.id returning * into remix;
  insert into public.remixes (source_creation_id, remix_creation_id) values (source.id, remix.id);
  return remix;
end;
$$;

revoke execute on function community_private.clone_creation(uuid, text, text)
  from public, anon;
grant execute on function community_private.clone_creation(uuid, text, text)
  to authenticated, service_role;

revoke execute on function public.create_creation(
  uuid, text, text, text, text[], text, text, jsonb, jsonb, text,
  timestamptz, uuid, text, integer, integer, integer, integer, text, jsonb
) from public, anon;
revoke execute on function public.save_creation_version(
  uuid, uuid, text, integer, integer, integer, integer, text, jsonb, uuid
) from public, anon;
revoke execute on function public.restore_creation_version(uuid, uuid, uuid) from public, anon;

grant execute on function public.create_creation(
  uuid, text, text, text, text[], text, text, jsonb, jsonb, text,
  timestamptz, uuid, text, integer, integer, integer, integer, text, jsonb
) to authenticated, service_role;
grant execute on function public.save_creation_version(
  uuid, uuid, text, integer, integer, integer, integer, text, jsonb, uuid
) to authenticated, service_role;
grant execute on function public.restore_creation_version(uuid, uuid, uuid)
  to authenticated, service_role;
