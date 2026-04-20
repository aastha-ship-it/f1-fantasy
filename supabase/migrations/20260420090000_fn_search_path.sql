-- Pin search_path on our two trigger functions.
--
-- Supabase Studio's security linter flags functions with a mutable search_path
-- because a compromised user could set the session search_path to trick the
-- function into resolving unqualified object names (e.g. `events`) to attacker
-- tables in a different schema. Pinning to `public, pg_temp` closes this off.

alter function public.reject_locked_prediction() set search_path = public, pg_temp;
alter function public.events_set_lock_at() set search_path = public, pg_temp;
