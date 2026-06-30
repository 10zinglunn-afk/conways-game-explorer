-- Postgres grants EXECUTE on new functions to PUBLIC by default. Lock down the
-- SECURITY DEFINER functions, then explicitly grant only the intended RPCs.
revoke execute on function public.refresh_star_count() from public;
revoke execute on function public.refresh_clone_count() from public;
revoke execute on function public.clone_creation(uuid, text, text) from public;
revoke execute on function public.increment_view(uuid) from public;

grant execute on function public.clone_creation(uuid, text, text) to authenticated;
grant execute on function public.increment_view(uuid) to authenticated;
