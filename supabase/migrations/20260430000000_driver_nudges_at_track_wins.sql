-- Phase 8.5 — split wins out of at-track podiums.
--
-- The predict-detail telemetry strip historically read "2 podiums". To make
-- a P1-heavy track-record visually distinct, we now render "1 win · 2 podiums"
-- (with the wins clause suppressed when wins=0). The producer
-- (refreshNudgesForEvent) writes both columns from a single Jolpica aggregate.
--
-- Nullable on purpose, matching the new "null = data missing" semantics for
-- at_track_podiums — the aggregator returns null when historical_races has
-- zero rows for the circuit/window so the UI can render "—" rather than a
-- misleading "0".

alter table public.driver_nudges
  add column if not exists at_track_wins smallint;

comment on column public.driver_nudges.at_track_wins is
  'Driver wins (P1) at this circuit over the JOLPICA_HISTORY_WINDOW_YEARS lookback. Null when no historical data available.';
