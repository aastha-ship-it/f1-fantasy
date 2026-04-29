-- Cron-run telemetry. Each cron route appends one row at end-of-handler
-- (success or caught error) so the admin dashboard can render
-- "04:30 UTC · ✓ success" instead of just the configured schedule.
--
-- Table is append-only. The admin page reads MAX(ran_at) per path; old
-- rows can be pruned on a separate cadence (not implemented yet).

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  ran_at timestamptz not null default now(),
  status text not null check (status in ('success', 'error')),
  duration_ms integer,
  error text
);

create index if not exists cron_runs_path_ran_at_idx
  on public.cron_runs (path, ran_at desc);

alter table public.cron_runs enable row level security;

-- All authenticated users can read (admin dashboard render). Service role
-- writes; no public writes.
create policy cron_runs_select on public.cron_runs
  for select
  using (true);
