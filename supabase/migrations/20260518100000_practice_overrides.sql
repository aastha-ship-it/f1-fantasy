-- changes.md §6 — Free Practice results banner.
--
-- The predict round page shows FP1/FP2/FP3 top-3 fetched live from OpenF1
-- (on-demand, HTTP-cached — no cron, no events/enum changes). This table is
-- the admin override: when a row exists for an FP slot it takes precedence
-- over the live fetch (covers OpenF1 being late, down, wrong, or the session
-- cancelled). Absent → fall back to the live fetch.
--
-- Drivers only (no lap times) — admin entry stays fast; the fastest-lap time
-- column in the banner is populated only when data comes from OpenF1.
--
-- Written exclusively via the service client behind the admin guard (same
-- trust boundary as `results`); no RLS policy is added, so the default
-- deny-all keeps it server-only.

create table public.practice_overrides (
  season smallint not null,
  round smallint not null,
  fp_index smallint not null check (fp_index between 1 and 3),
  p1_driver_id smallint not null references public.drivers(id),
  p2_driver_id smallint not null references public.drivers(id),
  p3_driver_id smallint not null references public.drivers(id),
  updated_at timestamptz not null default now(),
  primary key (season, round, fp_index)
);

comment on table public.practice_overrides is
  'Admin override for the Free Practice banner (changes.md §6). Presence of a row wins over the live OpenF1 fetch for that (season, round, fp_index).';
