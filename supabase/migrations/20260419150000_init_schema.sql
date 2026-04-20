-- F1 Fantasy — initial schema
-- Reference: plans/flickering-giggling-valley.md §Data Model
--
-- Invariants enforced by this migration:
--   * No is_admin column on users — admin privilege lives in `admins` table
--     to avoid RLS self-reference recursion.
--   * events.lock_at is a stored generated column = session_start_at - 5s.
--     Single source of lock truth; never computed anywhere else.
--   * predictions has no stored `locked` column. Lock state is derived at
--     query time from lock_at, and enforced by a BEFORE trigger (separate
--     migration).
--   * scores uses explicit int columns (not jsonb) — easier to index/query
--     for the ~10-user friend-group scale.

-- Enums -----------------------------------------------------------------------

create type session_type as enum ('quali', 'race', 'sprint_quali', 'sprint_race');

-- Tables ----------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  favorite_team text,
  favorite_driver smallint,
  favorite_past_driver text,
  created_at timestamptz not null default now()
);
comment on table public.users is 'Application profile layered on auth.users. No is_admin column — see admins table.';

create table public.drivers (
  id smallint primary key,         -- OpenF1 driver_number
  code text not null,               -- 3-letter, e.g. VER, LEC
  full_name text not null,
  team text not null,
  active boolean not null default true,
  headshot_url text,
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  season smallint not null,
  round smallint not null,
  name text not null,
  circuit text not null,
  session_type session_type not null,
  session_start_at timestamptz not null,
  session_end_at timestamptz,
  -- Single source of lock truth. Maintained by a BEFORE INSERT/UPDATE trigger
  -- below (a STORED generated column is rejected by Postgres 17 because
  -- `timestamptz - interval` isn't provably immutable to its planner).
  lock_at timestamptz not null,
  revealed_at timestamptz,
  openf1_meeting_key integer,
  openf1_session_key integer unique,
  created_at timestamptz not null default now(),
  unique (season, round, session_type)
);
create index events_lock_at_idx on public.events (lock_at);
create index events_session_start_idx on public.events (session_start_at);

-- Maintain events.lock_at = session_start_at - 5s on every insert/update.
-- Mirrors a STORED generated column in behavior; trigger is the fallback
-- because Postgres 17 refuses the generated-column form (mutability check).
create or replace function public.events_set_lock_at()
returns trigger
language plpgsql
as $$
begin
  new.lock_at := new.session_start_at - interval '5 seconds';
  return new;
end;
$$;

create trigger events_set_lock_at_trg
  before insert or update of session_start_at on public.events
  for each row execute function public.events_set_lock_at();

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  p1_driver_id smallint not null references public.drivers(id),
  p2_driver_id smallint references public.drivers(id),    -- null for sprint*
  p3_driver_id smallint references public.drivers(id),    -- null for sprint*
  submitted_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index predictions_event_idx on public.predictions (event_id);

create table public.results (
  event_id uuid primary key references public.events(id) on delete cascade,
  p1_driver_id smallint not null references public.drivers(id),
  p2_driver_id smallint references public.drivers(id),
  p3_driver_id smallint references public.drivers(id),
  fetched_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  points integer not null,
  exact_matches smallint not null check (exact_matches between 0 and 3),
  slot_mismatches smallint not null check (slot_mismatches between 0 and 3),
  dnf_zeros smallint not null check (dnf_zeros between 0 and 3),
  perfect_bonus boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index scores_event_idx on public.scores (event_id);
create index scores_user_idx on public.scores (user_id);

create table public.user_streaks (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_p1_streak integer not null default 0,
  longest_p1_streak integer not null default 0,
  current_podium_streak integer not null default 0,
  total_perfect_podiums integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references public.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
comment on table public.admins is 'Admin privilege lives here, NOT on users. Self-referencing RLS via users is a known recursion footgun.';
