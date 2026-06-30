-- Supabase can add explicit anon grants for RPC exposure; make the view counter
-- signed-in only to match the Phase 2 auth model.
revoke execute on function public.increment_view(uuid) from anon;
