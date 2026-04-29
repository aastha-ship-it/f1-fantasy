-- Extend historical_results for the standings season-summary cells:
--   * 'qualifying' added to session_kind constraint → pole sitters
--   * fastest_lap boolean → "X fastest laps" tally
--
-- DNFs total uses the existing `status` text column (no schema change) —
-- count rows where position is null OR status is not in the finisher set.

alter table public.historical_results
  drop constraint if exists historical_results_session_kind_check;

alter table public.historical_results
  add constraint historical_results_session_kind_check
  check (session_kind in ('race', 'sprint', 'qualifying'));

alter table public.historical_results
  add column if not exists fastest_lap boolean not null default false;

-- Index supports "fastest laps per season" + "fastest lap per round" queries
-- that the standings page issues. Partial index keeps it tiny — only the few
-- rows where fastest_lap is true.
create index if not exists historical_results_fastest_lap_idx
  on public.historical_results (season, round)
  where fastest_lap = true;
