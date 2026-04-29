-- Jolpica-F1 historical layer foundation.
-- Reference: plans/2026-04-28-jolpica-historical.md
--
-- Adds:
--   * drivers.ergast_id           — Jolpica/Ergast canonical driver id (e.g., "max_verstappen")
--   * events.ergast_circuit_id    — Jolpica/Ergast circuit id (e.g., "miami")
--   * historical_races            — calendar metadata for past seasons (1950–present scoped at app layer)
--   * historical_results          — per-driver finishing data per (season, round, session_kind)
--
-- Read-everywhere, service-role-only writes. No FK to active `events`; historical
-- data lives in its own namespace so it can't pollute the predict/reveal loop.

-- 1. Identity columns -------------------------------------------------------

alter table public.drivers
  add column ergast_id text unique;

alter table public.events
  add column ergast_circuit_id text;
create index events_ergast_circuit_idx on public.events (ergast_circuit_id);

-- 2. Historical races -------------------------------------------------------

create table public.historical_races (
  season smallint not null,
  round smallint not null,
  name text not null,
  ergast_circuit_id text not null,
  race_date date not null,
  primary key (season, round)
);
create index historical_races_circuit_idx
  on public.historical_races (ergast_circuit_id);

alter table public.historical_races enable row level security;
create policy historical_races_select_all
  on public.historical_races for select using (true);

-- 3. Historical results -----------------------------------------------------

create table public.historical_results (
  season smallint not null,
  round smallint not null,
  session_kind text not null check (session_kind in ('race', 'sprint')),
  driver_id smallint not null references public.drivers(id) on delete cascade,
  position smallint,
  points numeric(5, 2) not null default 0,
  grid smallint,
  status text,
  primary key (season, round, session_kind, driver_id),
  foreign key (season, round) references public.historical_races (season, round)
);
create index historical_results_driver_idx
  on public.historical_results (driver_id);
create index historical_results_driver_season_idx
  on public.historical_results (driver_id, season);

alter table public.historical_results enable row level security;
create policy historical_results_select_all
  on public.historical_results for select using (true);
