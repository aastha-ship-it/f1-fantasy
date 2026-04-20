-- Row-Level Security policies
-- Reference: plans/flickering-giggling-valley.md §Data Model RLS block
--
-- Core rules:
--   * users: select all (friend group trusts each other), update own profile only
--   * admins: select-all OK; NO insert/update/delete policies — service-role only
--   * predictions: users always see their own; others' picks visible only after
--     events.revealed_at is set OR 10-min fallback after results.fetched_at
--   * predictions: user can insert/update their own (subject to lock trigger)
--   * results, scores, user_streaks, events, drivers: service-role writes only

-- Enable RLS on every user-facing table --------------------------------------

alter table public.users enable row level security;
alter table public.drivers enable row level security;
alter table public.events enable row level security;
alter table public.predictions enable row level security;
alter table public.results enable row level security;
alter table public.scores enable row level security;
alter table public.user_streaks enable row level security;
alter table public.admins enable row level security;

-- users -----------------------------------------------------------------------

create policy users_select_all
  on public.users for select
  using (true);

create policy users_insert_self
  on public.users for insert
  with check (auth.uid() = id);

create policy users_update_own_profile
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- drivers (read-only to authenticated users) ---------------------------------

create policy drivers_select_all
  on public.drivers for select
  using (true);

-- events (read-only) ---------------------------------------------------------

create policy events_select_all
  on public.events for select
  using (true);

-- predictions ----------------------------------------------------------------
--
-- NOTE: We use ONE combined SELECT policy with explicit OR, not two separate
-- PERMISSIVE policies. Through PostgREST + the new-format JWT path,
-- multiple PERMISSIVE SELECT policies do not reliably OR together — only the
-- first matching policy appeared to fire in integration tests. Merging into
-- one policy with explicit OR keeps the query semantics predictable.

create policy preds_select
  on public.predictions for select
  using (
    -- Own picks: always visible to self.
    auth.uid() = user_id
    -- Others' picks: only after admin reveal, or 10-min results fallback.
    or exists (
      select 1 from public.events e
      where e.id = predictions.event_id
        and (
          (e.revealed_at is not null and now() >= e.revealed_at)
          or exists (
            select 1 from public.results r
            where r.event_id = e.id
              and r.fetched_at < now() - interval '10 minutes'
          )
        )
    )
  );

create policy preds_insert_own
  on public.predictions for insert
  with check (auth.uid() = user_id);

create policy preds_update_own
  on public.predictions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- results (read-only to app users, service role writes) ----------------------

create policy results_select_all
  on public.results for select
  using (true);

-- scores (read-only to app users) --------------------------------------------

create policy scores_select_all
  on public.scores for select
  using (true);

-- user_streaks (read-only to app users) --------------------------------------

create policy streaks_select_all
  on public.user_streaks for select
  using (true);

-- admins: select OK, NO write policies → service-role only -------------------

create policy admins_select_all
  on public.admins for select
  using (true);
