-- Phase 2: make public visibility represent a fully validated publication.
-- Application code performs detailed RLE parsing; these checks are the final
-- database boundary that prevents incomplete metadata or readiness flags from
-- becoming public through any future server path.

update public.creations
   set visibility = 'private',
       published_at = null,
       publish_readiness = '{}'::jsonb
 where visibility = 'public'
   and (
     length(btrim(description)) < 20
     or cardinality(tags) < 1
     or exists (
       select 1
         from unnest(tags) as tag
        where length(tag) > 32
           or tag !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     )
     or current_version_id is null
     or not (publish_readiness @> '{"metadata": true, "board": true, "preview": true}'::jsonb)
     or not (
       preview_config @> '{"version": 1}'::jsonb
       and coalesce(jsonb_typeof(preview_config->'camera'->'frame') = 'object', false)
       and coalesce(jsonb_typeof(preview_config->'cells') = 'array', false)
       and coalesce(length(btrim(preview_config->>'altText')), 0) > 0
     )
   );

create or replace function public.creation_tags_are_valid(candidate text[])
returns boolean
language sql
immutable
strict
as $$
  select cardinality(candidate) <= 8
     and not exists (
       select 1
         from unnest(candidate) as tag
        where length(tag) > 32
           or tag !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     );
$$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'creations_slug_format_check'
       and conrelid = 'public.creations'::regclass
  ) then
    alter table public.creations
      add constraint creations_slug_format_check
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 140);
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'creations_public_readiness_check'
       and conrelid = 'public.creations'::regclass
  ) then
    alter table public.creations
      add constraint creations_public_readiness_check
      check (
        visibility = 'private'
        or (
          archived_at is null
          and published_at is not null
          and length(btrim(description)) between 20 and 2000
          and cardinality(tags) between 1 and 8
          and public.creation_tags_are_valid(tags)
          and current_version_id is not null
          and publish_readiness @> '{"metadata": true, "board": true, "preview": true}'::jsonb
          and preview_config @> '{"version": 1}'::jsonb
          and coalesce(jsonb_typeof(preview_config->'camera'->'frame') = 'object', false)
          and case
            when jsonb_typeof(preview_config->'cells') = 'array'
              then jsonb_array_length(preview_config->'cells') > 0
            else false
          end
          and coalesce(length(btrim(preview_config->>'altText')), 0) between 1 and 300
        )
      );
  end if;
end $$;

drop index if exists creations_public_idx;
create index creations_public_idx
  on public.creations(published_at desc, id)
  where visibility = 'public' and archived_at is null;
