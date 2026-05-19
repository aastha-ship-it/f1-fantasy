-- design_handoff_phase11/ADDENDUM §C: persist the human-readable scoring
-- one-liner (wording locked to design/data.jsx) alongside the numeric
-- ScoreBreakdown fields. Nullable — old rows backfill on the next
-- writeResultsService run (scripts/recompute-all-scores.ts). Service-role
-- writes only; no RLS change (scores is already read-only to app users).

alter table public.scores
  add column if not exists breakdown text;
