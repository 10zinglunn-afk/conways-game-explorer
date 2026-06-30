-- Keep public RPC names stable while moving privileged bodies out of the
-- exposed public schema. The public wrappers are SECURITY INVOKER; the private
-- helpers still validate auth.uid() before performing cross-owner writes.

create schema if not exists community_private;

revoke all on schema community_private from public, anon, authenticated, service_role;
grant usage on schema community_private to authenticated, service_role;

create or replace function community_private.clone_creation(source_id uuid, new_slug text, new_title text)
returns public.creations
language plpgsql
security definer
set search_path = public, pg_temp
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

create or replace function community_private.increment_view(target uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.creations
     set view_count = view_count + 1
   where id = target
     and visibility = 'public';
$$;

revoke execute on function community_private.clone_creation(uuid, text, text) from public, anon;
revoke execute on function community_private.increment_view(uuid) from public, anon;
grant execute on function community_private.clone_creation(uuid, text, text) to authenticated, service_role;
grant execute on function community_private.increment_view(uuid) to authenticated, service_role;

create or replace function public.clone_creation(source_id uuid, new_slug text, new_title text)
returns public.creations
language sql
security invoker
set search_path = public, community_private, pg_temp
as $$
  select * from community_private.clone_creation(source_id, new_slug, new_title);
$$;

create or replace function public.increment_view(target uuid)
returns void
language sql
security invoker
set search_path = public, community_private, pg_temp
as $$
  select community_private.increment_view(target);
$$;

-- save_creation only writes rows owned by auth.uid(), so it can run as invoker
-- and let the table grants/RLS policies enforce the same ownership checks.
create or replace function public.save_creation(
  creation_id uuid,
  creation_slug text,
  creation_title text,
  creation_description text,
  creation_tags text[],
  creation_visibility text,
  creation_published_at timestamptz,
  version_id uuid,
  version_rle text,
  version_width integer,
  version_height integer,
  version_generation integer,
  version_population integer,
  version_rule text
)
returns public.creations
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  visibility_value text := coalesce(creation_visibility, 'private');
  published_at_value timestamptz;
  saved public.creations;
  saved_version public.creation_versions;
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  if visibility_value not in ('private', 'public') then
    raise exception 'invalid creation visibility';
  end if;

  if visibility_value = 'public' then
    published_at_value := coalesce(creation_published_at, now());
  end if;

  insert into public.creations (
    id,
    owner_id,
    slug,
    title,
    description,
    tags,
    visibility,
    root_creation_id,
    published_at
  )
  values (
    creation_id,
    caller,
    creation_slug,
    creation_title,
    coalesce(creation_description, ''),
    coalesce(creation_tags, '{}'),
    visibility_value,
    creation_id,
    published_at_value
  )
  returning * into saved;

  insert into public.creation_versions (
    id,
    creation_id,
    rle,
    width,
    height,
    generation,
    population,
    rule
  )
  values (
    version_id,
    saved.id,
    coalesce(version_rle, ''),
    coalesce(version_width, 0),
    coalesce(version_height, 0),
    coalesce(version_generation, 0),
    coalesce(version_population, 0),
    coalesce(version_rule, 'B3/S23')
  )
  returning * into saved_version;

  update public.creations
     set current_version_id = saved_version.id
   where id = saved.id
  returning * into saved;

  return saved;
end;
$$;

revoke execute on function public.clone_creation(uuid, text, text) from public, anon;
revoke execute on function public.increment_view(uuid) from public, anon;
grant execute on function public.clone_creation(uuid, text, text) to authenticated, service_role;
grant execute on function public.increment_view(uuid) to authenticated, service_role;

revoke execute on function public.save_creation(
  uuid,
  text,
  text,
  text,
  text[],
  text,
  timestamptz,
  uuid,
  text,
  integer,
  integer,
  integer,
  integer,
  text
) from public, anon;

grant execute on function public.save_creation(
  uuid,
  text,
  text,
  text,
  text[],
  text,
  timestamptz,
  uuid,
  text,
  integer,
  integer,
  integer,
  integer,
  text
) to authenticated, service_role;
