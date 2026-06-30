-- Harden the first-pass community schema after Supabase security advisor review.
--
-- Views in Postgres run with definer privileges unless security_invoker is set.
-- Keep the public trending view subject to the caller's RLS-visible rows.
create or replace view public.trending_creations
with (security_invoker = true)
as
select
  c.*,
  (c.star_count * 8)
  + (c.clone_count * 13)
  + (c.view_count * 0.5)
  + greatest(0, 14 - (extract(epoch from (now() - coalesce(c.published_at, c.updated_at))) / 86400.0)) as score
from public.creations c
where c.visibility = 'public'
order by score desc, c.updated_at desc;

-- Pin search_path on the remaining trigger helper.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- These helpers are for triggers only, not public RPC use.
revoke execute on function public.refresh_star_count() from anon, authenticated;
revoke execute on function public.refresh_clone_count() from anon, authenticated;

-- Cloning is intentionally an authenticated RPC only.
revoke execute on function public.clone_creation(uuid, text, text) from anon;
