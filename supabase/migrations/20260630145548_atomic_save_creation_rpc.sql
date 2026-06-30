-- Save a creation and its first/current version in a single database transaction.
-- This replaces the prior client-side sequence of:
--   1. insert public.creations
--   2. insert public.creation_versions
--   3. update public.creations.current_version_id
--
-- SECURITY DEFINER keeps the operation atomic through one RPC while the
-- function itself pins ownership to auth.uid().
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
security definer
set search_path = public
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
