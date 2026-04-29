-- Allow `at_track_podiums` to be null so the predict UI can render `—`
-- when the Jolpica circuit-mapping isn't resolved (rather than a misleading 0).

alter table public.driver_nudges
  alter column at_track_podiums drop not null,
  alter column at_track_podiums drop default;
