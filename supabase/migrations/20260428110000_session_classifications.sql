-- Full per-session classifications. Powers /dashboard/standings (driver +
-- constructor totals) and is the same data we'd use to enrich nudges later.
--
-- Filled by the OpenF1 fetch-results cron alongside the podium UPSERT.
-- Service-role writes only; read-open to authenticated users.

create table public.session_classifications (
  event_id uuid not null references public.events(id) on delete cascade,
  driver_id smallint not null references public.drivers(id) on delete cascade,
  position smallint,
  fetched_at timestamptz not null default now(),
  primary key (event_id, driver_id)
);
create index session_classifications_event_idx
  on public.session_classifications (event_id);

alter table public.session_classifications enable row level security;

create policy session_classifications_select_all
  on public.session_classifications for select
  using (true);
