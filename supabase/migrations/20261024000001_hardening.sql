-- =====================================================================
-- KRIVA — hardening (Supabase security advisor)
-- =====================================================================
-- Pin search_path on helper functions
alter function public.touch_updated_at() set search_path = public;
alter function public.is_privileged() set search_path = public;

-- Trigger function: never callable through the API (triggers still fire)
do $$
begin
  revoke all on function public.orders_history() from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.orders_history() from anon, authenticated;
  end if;
end;
$$;

-- Note: public.is_admin() stays executable by anon/authenticated on purpose —
-- the catalogue RLS policies call it, and it only reveals whether the caller
-- is an owner.
