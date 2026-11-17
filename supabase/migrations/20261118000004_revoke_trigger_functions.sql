-- Trigger functions run automatically from their triggers; nobody needs to
-- call them through the API. Remove the default EXECUTE grant (flagged by
-- Supabase's security advisor). Triggers keep working: Postgres doesn't
-- check EXECUTE on a trigger function when the trigger fires.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_role() from public, anon, authenticated;
revoke execute on function public.visits_sync_site() from public, anon, authenticated;
revoke execute on function public.guard_locked_month() from public, anon, authenticated;
revoke execute on function public.jobs_stamp_completion() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Membership checks are used inside access rules for signed-in users only.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_member() from public, anon;
revoke execute on function public.is_finance() from public, anon;
