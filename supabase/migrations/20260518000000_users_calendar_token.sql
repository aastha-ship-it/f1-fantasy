-- changes.md §3 — per-user ICS calendar subscription feed.
--
-- Each user gets an opaque, unguessable token. The public ICS route
-- (/api/calendar/[token]) resolves the token via the service client and
-- emits the full F1 session calendar with a 30-min "lock your prediction"
-- alarm on every session. Nullable + minted lazily (a server action sets it
-- the first time the user opens the sync panel). Revocable by nulling it.

alter table public.users
  add column if not exists calendar_token text unique;

comment on column public.users.calendar_token is
  'Opaque token for the per-user ICS calendar feed (changes.md §3). Null until the user enables Calendar sync; null again to revoke.';
