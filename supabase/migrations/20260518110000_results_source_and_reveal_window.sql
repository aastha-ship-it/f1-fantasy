-- changes.md §7 — admin-triggered OpenF1 result fetch for scoring sessions.
--
-- 1. results.source — distinguishes OpenF1-fetched from admin-entered rows.
--    The automatic/OpenF1 path must never modify a row once it is
--    source='admin' OR the event has been revealed (enforced in
--    writeResultsService via the pure isResultsFrozenForAuto predicate).
--    Admin manual entry always wins and stamps source='admin'.
--    Pre-prod: existing rows default to 'openf1' (no real data yet; the
--    revealed-freeze still protects anything already shown).
alter table public.results
  add column source text not null default 'openf1'
    check (source in ('openf1', 'admin'));

comment on column public.results.source is
  'Who wrote this row: ''openf1'' (auto/cron/admin-button fetch) or ''admin'' (manual entry). Auto-fetch never overwrites ''admin'' or a revealed event (changes.md §7).';

-- 2. Lengthen the predictions reveal fallback 10 min → 1 hour. Prompt
--    result-fetching (admin "Fetch from OpenF1" button) would otherwise
--    auto-spoil the curated Reveal cinematic ~10 min after each session.
--    Reveal stays admin-triggered; 1h is the forgot-to-reveal backstop.
--    Postgres can't alter a policy body — drop + recreate verbatim with the
--    new interval. (Regression-tracked: tests/integration RLS specs.)
drop policy preds_select on public.predictions;

create policy preds_select
  on public.predictions for select
  using (
    -- Own picks: always visible to self.
    auth.uid() = user_id
    -- Others' picks: only after admin reveal, or 1-hour results fallback.
    or exists (
      select 1 from public.events e
      where e.id = predictions.event_id
        and (
          (e.revealed_at is not null and now() >= e.revealed_at)
          or exists (
            select 1 from public.results r
            where r.event_id = e.id
              and r.fetched_at < now() - interval '1 hour'
          )
        )
    )
  );
