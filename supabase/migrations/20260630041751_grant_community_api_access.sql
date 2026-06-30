-- Supabase projects created after the 2026 Data API grant change do not expose
-- newly-created tables/functions automatically. Keep object grants next to RLS
-- so API reachability and row visibility are reviewed together.

grant usage on schema public to anon, authenticated, service_role;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.creations from anon, authenticated;
revoke all on table public.creation_versions from anon, authenticated;
revoke all on table public.stars from anon, authenticated;
revoke all on table public.remixes from anon, authenticated;
revoke all on table public.trending_creations from anon, authenticated;

grant select on table public.profiles to anon;
grant select on table public.creations to anon;
grant select on table public.creation_versions to anon;
grant select on table public.stars to anon;
grant select on table public.remixes to anon;
grant select on table public.trending_creations to anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.creations to authenticated;
grant select, insert on table public.creation_versions to authenticated;
grant select, insert, delete on table public.stars to authenticated;
grant select on table public.remixes to authenticated;
grant select on table public.trending_creations to authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.creations to service_role;
grant select, insert, update, delete on table public.creation_versions to service_role;
grant select, insert, update, delete on table public.stars to service_role;
grant select, insert, update, delete on table public.remixes to service_role;
grant select on table public.trending_creations to service_role;

revoke execute on function public.refresh_star_count() from public, anon, authenticated, service_role;
revoke execute on function public.refresh_clone_count() from public, anon, authenticated, service_role;
revoke execute on function public.touch_updated_at() from public, anon, authenticated, service_role;
revoke execute on function public.clone_creation(uuid, text, text) from public, anon;
revoke execute on function public.increment_view(uuid) from public, anon;

grant execute on function public.clone_creation(uuid, text, text) to authenticated, service_role;
grant execute on function public.increment_view(uuid) to authenticated, service_role;

-- Recreate policies with explicit target roles and wrapped auth.uid() calls.
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

create policy profiles_read on public.profiles
  for select
  to anon, authenticated
  using (is_public or id = (select auth.uid()));

create policy profiles_insert_self on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists creations_read on public.creations;
drop policy if exists creations_insert_own on public.creations;
drop policy if exists creations_update_own on public.creations;
drop policy if exists creations_delete_own on public.creations;

create policy creations_read on public.creations
  for select
  to anon, authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()));

create policy creations_insert_own on public.creations
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy creations_update_own on public.creations
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy creations_delete_own on public.creations
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists creation_versions_read on public.creation_versions;
drop policy if exists creation_versions_insert_own on public.creation_versions;

create policy creation_versions_read on public.creation_versions
  for select
  to anon, authenticated
  using (exists (
    select 1 from public.creations c
    where c.id = creation_id
      and (c.visibility = 'public' or c.owner_id = (select auth.uid()))
  ));

create policy creation_versions_insert_own on public.creation_versions
  for insert
  to authenticated
  with check (exists (
    select 1 from public.creations c
    where c.id = creation_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists stars_read on public.stars;
drop policy if exists stars_insert_own on public.stars;
drop policy if exists stars_delete_own on public.stars;

create policy stars_read on public.stars
  for select
  to anon, authenticated
  using (true);

create policy stars_insert_own on public.stars
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.creations c where c.id = creation_id and c.visibility = 'public')
  );

create policy stars_delete_own on public.stars
  for delete
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists remixes_read on public.remixes;

create policy remixes_read on public.remixes
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.creations source
      where source.id = source_creation_id
        and (source.visibility = 'public' or source.owner_id = (select auth.uid()))
    )
    and exists (
      select 1 from public.creations remix
      where remix.id = remix_creation_id
        and (remix.visibility = 'public' or remix.owner_id = (select auth.uid()))
    )
  );
