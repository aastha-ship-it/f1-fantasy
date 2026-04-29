-- Telemetry nudges cache — nightly cron precomputes per-driver hints for the
-- upcoming weekend so the predict screen reads from a single table instead of
-- fanning out to OpenF1 on every page view.
--
-- Reference: plans/flickering-giggling-valley.md §7.2 Telemetry nudges
--
-- Stored shape mirrors `lib/nudges/computeNudges.ts` outputs:
--   * recent_form     — pre-rendered "P1 · P4 · DNF · …" string (≤5 entries)
--   * at_track_podiums — int count of podium finishes at this circuit
--   * quali_race_delta — float, positive = gains places race-vs-grid; null = unknown
--
-- Read by everyone (predictions screen). Written only by service-role (cron).

create table public.driver_nudges (
  event_id uuid not null references public.events(id) on delete cascade,
  driver_id smallint not null references public.drivers(id) on delete cascade,
  recent_form text not null default '—',
  at_track_podiums smallint not null default 0,
  quali_race_delta numeric(4, 1),
  refreshed_at timestamptz not null default now(),
  primary key (event_id, driver_id)
);
create index driver_nudges_event_idx on public.driver_nudges (event_id);

alter table public.driver_nudges enable row level security;

create policy driver_nudges_select_all
  on public.driver_nudges for select
  using (true);
