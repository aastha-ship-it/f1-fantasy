# Jolpica-F1 historical layer

**Date:** 2026-04-28 · **Owner:** Aastha · **Reviews cleared:** Grilled-design ✅
**Status:** Ready to implement (pending approval)

---

## Context

OpenF1 covers 2023→present. That's why nudges quote "Podiums @ Miami: 2" for Verstappen even though his real Miami podium count over 5+ years is higher. It's also why we have no historical results table to build career-stats / head-to-head from.

Ergast — the canonical historical F1 API since 1950 — was deprecated end of 2024. **Jolpica-F1** (api.jolpi.ca/ergast/f1/) is the open-source community successor: drop-in Ergast-compatible URLs, 1950→present coverage, free anonymous tier (500 req/hr), Apache 2.0, actively maintained.

Decision: keep OpenF1 for the live/active path, layer Jolpica in as a parallel historical source. Two clients, two responsibilities.

## Scope (PR 1 = "Foundation + nudges + standings")

**In scope:**
1. Jolpica HTTP client + types under `src/lib/jolpica/`.
2. Migration adding `drivers.ergast_id`, `events.ergast_circuit_id`, and two new tables `historical_races` + `historical_results`.
3. Identity mapper (drivers + circuits) folded into the existing `sync-f1-data` cron.
4. Backfill script `scripts/backfill-jolpica.ts` for last 10 seasons (2017–2026), ~70 requests.
5. Nightly delta cron `/api/cron/refresh-jolpica-current` at 04:20 UTC.
6. Refactor `refreshNudges` so `at_track_podiums` is sourced from Jolpica (10-yr window) instead of OpenF1 (4-yr window).
7. Rewrite `/dashboard/standings` to read Jolpica-canonical `historical_results.points`, with `session_classifications` as a sub-24h backstop.
8. UI label discipline: every historical aggregate carries an inline timeframe (`Podiums @ Miami (last 10 yrs)`, `Race-day gain (this season)`).

**Out of scope (deferred):**
- Career stats / head-to-head pages.
- Constructors as a first-class entity (we still join via `drivers.team` string).
- Authenticated Jolpica tier.
- Full 1950+ archive (only 10 seasons in PR 1).
- Generic `*_aliases` mapping tables.

## Architecture

```
                                        ┌────────────────────────────┐
        ACTIVE PATH (OpenF1)            │     HISTORICAL PATH (Jolpica)
                                        │
  /api/cron/sync-f1-data ──────────────►│ resolveDrivers() + resolveCircuits()
  04:00 UTC                              │   populates drivers.ergast_id +
        │                                │   events.ergast_circuit_id
        ▼                                │
  events, drivers tables                 │
        │                                │
        ▼                                │
  /api/cron/fetch-results ──────────────►│
  04:15 UTC                              │
        │                                │
        ▼                                │
  results, scores,                       │ /api/cron/refresh-jolpica-current
  session_classifications                │ 04:20 UTC ───────────────►
        │                                │   pulls current season from Jolpica
        │                                │   UPSERTs into historical_*
        │                                │           │
  /api/cron/refresh-nudges ─────────────►│           │
  04:30 UTC                              │           │
  reads at_track_podiums                 │           │
  from Jolpica (runtime)                 │           │
                                         │           ▼
                                         │  historical_races, historical_results
                                         │           │
                                         │           ▼
                                         │  /dashboard/standings reads from
                                         │  historical_results (primary) +
                                         │  session_classifications (<24h backstop)
```

## Migrations

### `supabase/migrations/20260429000000_jolpica_foundation.sql`

```sql
-- 1. Identity mapping columns
alter table public.drivers
  add column ergast_id text unique;

alter table public.events
  add column ergast_circuit_id text;
create index events_ergast_circuit_idx on public.events (ergast_circuit_id);

-- 2. Historical races (one row per (season, round) — calendar metadata)
create table public.historical_races (
  season smallint not null,
  round smallint not null,
  name text not null,
  ergast_circuit_id text not null,
  race_date date not null,
  primary key (season, round)
);
create index historical_races_circuit_idx
  on public.historical_races (ergast_circuit_id);

alter table public.historical_races enable row level security;
create policy historical_races_select_all
  on public.historical_races for select using (true);

-- 3. Historical results (one row per (season, round, session_kind, driver))
create table public.historical_results (
  season smallint not null,
  round smallint not null,
  session_kind text not null check (session_kind in ('race', 'sprint')),
  driver_id smallint not null references public.drivers(id) on delete cascade,
  position smallint,
  points numeric(5, 2) not null default 0,
  grid smallint,
  status text,
  primary key (season, round, session_kind, driver_id),
  foreign key (season, round) references public.historical_races (season, round)
);
create index historical_results_driver_idx
  on public.historical_results (driver_id);
create index historical_results_circuit_lookup_idx
  on public.historical_results (driver_id, season);

alter table public.historical_results enable row level security;
create policy historical_results_select_all
  on public.historical_results for select using (true);
```

## File-level changes

### New: `src/lib/jolpica/`

| File | Responsibility |
|---|---|
| `client.ts` | `jolpicaFetch<T>(path, params)` — base URL `https://api.jolpi.ca/ergast/f1`, 4 req/sec throttle, retry on 429 with `Retry-After` header (reuse the pattern from `src/lib/sync/openf1.ts`), pagination iterator for `MRData.total > limit` cases. |
| `types.ts` | Ergast response shapes: `MRDataResponse`, `RaceTable`, `Result`, `Driver`, `Circuit`, `StandingsTable`. |
| `resolveDrivers.ts` | `resolveDrivers(svc, season)` — fetch `/{season}/drivers`, match each Jolpica driver to our `drivers.full_name` via `canonicalizeName()` (already in `src/lib/nudges/refreshNudges.ts`, export it from a new shared utility), UPDATE `drivers.ergast_id` where matched. |
| `resolveCircuits.ts` | `resolveCircuits(svc, season)` — fetch `/{season}/circuits`, match each Jolpica circuit to our `events.circuit` (OpenF1 `circuit_short_name`) via a normalizer, UPDATE `events.ergast_circuit_id` where matched. |
| `backfillResults.ts` | `backfillSeason(svc, season)` — fetch `/{season}/results.json?limit=100` (paginated) + `/{season}/sprint/results.json?limit=100`, UPSERT into `historical_races` + `historical_results`. Idempotent. |
| `atTrackPodiums.ts` | `atTrackPodiumsFor(svc, driverId, ergastCircuitId, windowYears, beforeRaceDate)` — single SQL query against `historical_results` JOIN `historical_races`. Pure DB read after backfill; no network. |
| `config.ts` | `JOLPICA_HISTORY_WINDOW_YEARS = 10`, `JOLPICA_THROTTLE_MS = 250` (4 req/sec). |
| `client.test.ts`, `resolveDrivers.test.ts`, `resolveCircuits.test.ts`, `backfillResults.test.ts`, `atTrackPodiums.test.ts` | Mocked-fetch tests via `vi.spyOn(globalThis, 'fetch')`. |

### Shared utility: `src/lib/text/canonicalize.ts`

Hoist `canonicalizeName` out of `refreshNudges.ts` to a shared module. Re-export from `refreshNudges.ts` for backwards compatibility (and to keep N13 test green).

Add a sibling `canonicalizeCircuit(name)` that lowercases + strips punctuation + collapses whitespace. Used by `resolveCircuits` to compare OpenF1 short names to Jolpica circuit names.

### New: `src/app/api/cron/refresh-jolpica-current/route.ts`

Bearer-gated, `maxDuration: 300`, calls `backfillSeason(svc, currentSeason)` only. Notify-admin on catch.

### Modified: `src/app/api/cron/sync-f1-data/route.ts`

After `syncCalendar` + `syncDrivers`, call `resolveDrivers(svc, season)` + `resolveCircuits(svc, season)`. Same try/catch boundary; failures continue (mapper failure shouldn't abort the calendar sync).

### Modified: `src/lib/nudges/refreshNudges.ts`

Replace the OpenF1-driven `at_track_podiums` block with a call to `atTrackPodiumsFor(svc, driverId, event.ergast_circuit_id, JOLPICA_HISTORY_WINDOW_YEARS, event.session_start_at)`. Keep the existing OpenF1 calls for `recent_form` and `quali_race_delta`. Drop `trackSlice` and the at-track race-result fetches from `raceFetchList` — those lookups are no longer needed.

If `event.ergast_circuit_id` is null (mapper failed for this circuit), set `at_track_podiums = null` so the UI renders `—` rather than misleading 0. Update the column type in `driver_nudges` migration… actually the column is already `smallint not null default 0` from `20260428100000_driver_nudges.sql`. **Add a follow-up migration** `20260429000100_driver_nudges_nullable_podiums.sql` to drop the NOT NULL.

### Modified: `src/app/dashboard/predict/driver-picker.tsx`

`NudgeStrip` labels change:
- `Podiums @ {circuit}` → `Podiums @ {circuit} (last 10 yrs)`
- `Race-day gain` → `Race-day gain (this season)`

Use a new shared helper `formatTimeframe(kind)` → `'last 10 yrs' | 'this season'`. Co-locate with the strip or in `src/lib/jolpica/config.ts`.

### Modified: `src/app/dashboard/standings/page.tsx`

Replace the current `session_classifications` read with:

```ts
// 1. Primary: Jolpica-canonical
const { data: histRows } = await supabase
  .from("historical_results")
  .select("driver_id, points, season, round")
  .eq("session_kind", "race")  // exclude sprints from WDC/WCC? — see decision below
  .gte("season", currentSeason);  // current season only for now

// 2. Backstop: races finished but not yet in Jolpica (lag <24h)
//    Filter session_classifications down to events whose (season, round)
//    isn't represented in histRows yet, then recompute via pointsForPosition.

// 3. UI: small "Updated X hours ago · standings reflect races up to round Y" note.
```

**Sprint inclusion in WDC/WCC**: F1 awards points for both sprint and race. Standings need both. UPDATE: include `session_kind in ('race','sprint')`.

### New: `scripts/backfill-jolpica.ts`

```ts
// Run: bun --env-file=.env.local run scripts/backfill-jolpica.ts
//      bun --env-file=.env.local run scripts/backfill-jolpica.ts --season 2024
import { backfillSeason } from "@/lib/jolpica/backfillResults";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const start = Number(process.argv.find((a, i) => process.argv[i-1] === '--from')) || 2017;
const end = Number(process.argv.find((a, i) => process.argv[i-1] === '--to')) || new Date().getUTCFullYear();
const svc = createSupabaseServiceClient();
for (let season = start; season <= end; season++) {
  const summary = await backfillSeason(svc, season);
  console.log(season, summary);
}
```

### Modified: `vercel.json`

Insert one new entry between `fetch-results` and `refresh-nudges`:

```json
{ "path": "/api/cron/refresh-jolpica-current", "schedule": "20 4 * * *" }
```

## Tests

| Test ID | What it covers |
|---|---|
| J1 | `jolpicaFetch` retries 429 with Retry-After header |
| J2 | `jolpicaFetch` paginates when `MRData.total > limit` |
| J3 | `resolveDrivers` matches by canonicalized full_name; unmatched drivers leave `ergast_id` null |
| J4 | `resolveCircuits` matches OpenF1 short_name to Jolpica circuitName via canonicalizer |
| J5 | `backfillSeason` UPSERTs idempotently — running twice produces identical row counts |
| J6 | `backfillSeason` writes both race + sprint rows with correct `session_kind` |
| J7 | `atTrackPodiumsFor` returns 0 when no rows in window; correct count when matches exist |
| J8 | `atTrackPodiumsFor` excludes races on/after `beforeRaceDate` (so we don't include the race we're predicting for) |
| J9 | Standings prefers Jolpica data, falls back to session_classifications for fresh races |
| J10 | (UI snapshot) NudgeStrip renders timeframe suffix on at-track-podiums label |

All mocked-fetch unit tests. No integration test against live Jolpica (per "no live network in CI").

## Verification (post-implementation)

1. **Migrations apply cleanly:**
   ```bash
   supabase db reset
   ```

2. **Tests green:**
   ```bash
   bun --env-file=.env.local run vitest run    # 65 + ~10 new = ~75
   bun run typecheck && bun run lint && bun run build
   ```

3. **Run one-shot backfill locally:**
   ```bash
   bun --env-file=.env.local run scripts/backfill-jolpica.ts --from 2017 --to 2026
   # ~70 Jolpica requests, ~3 minutes with throttle
   ```

4. **Sanity-check the data:**
   ```bash
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54422 -U postgres -d postgres -c \
     "select count(*), min(season), max(season) from historical_races;"
   # expect: 10-season worth of races, ~22*10=220 rows-ish
   ```

5. **Trigger the new cron:**
   ```bash
   curl -s -H "Authorization: Bearer local-dev-cron-secret" \
     http://localhost:3001/api/cron/refresh-jolpica-current | jq
   ```

6. **Verify nudge improvement** — refresh-nudges, then DB query:
   ```sql
   select d.code, dn.recent_form, dn.at_track_podiums, dn.quali_race_delta
   from driver_nudges dn
   join drivers d on d.id = dn.driver_id
   join events e on e.id = dn.event_id
   where e.name='Miami Grand Prix' and e.session_type='sprint_quali'
     and d.code in ('VER','NOR','LEC','HAM');
   ```
   Expect `at_track_podiums` for VER ≥ 3 (Miami P2 2023, P1 2024, plus any in 2017-2022 era — there shouldn't be more pre-2022 since Miami only debuted 2022).

7. **Standings page** at `http://localhost:3001/dashboard/standings` shows real WDC/WCC numbers from `historical_results`.

## Risks

| Risk | Mitigation |
|---|---|
| Jolpica name mismatch (e.g., "Carlos Sainz Jr." vs "Carlos Sainz") leaves `ergast_id` null | `resolveDrivers` logs every unmatched name; operator reviews log + can ALTER manually. Future improvement: fall back to last-name matching. |
| Circuit name mismatch (OpenF1 "Sakhir" vs Jolpica "bahrain"/"Bahrain International Circuit") | `canonicalizeCircuit` normalizer + a small explicit alias map for known mismatches. Document the map in code comments. |
| 10-season backfill fails partway and leaves partial data | Backfill is idempotent (UPSERT). Operator re-runs from the failed season. Script logs progress per-season. |
| Future schema drift in Jolpica's response shape | Mocked-fetch tests use small fixtures; periodic manual re-capture catches drift. notifyAdmin on cron failure surfaces real-world breakage same-day. |
| Sprint-points double-counting in standings | Test J9 covers; the SUM groups by driver_id over `session_kind in ('race','sprint')` exactly once. |

## Documentation updates

After implementation lands:
- `CLAUDE.md` — add a "Two-source identity" section explaining drivers.ergast_id + canonicalize.ts.
- `plans/program-tracker.md` — log the session, mark new cron + page as built.
- `.env.example` — no new env vars (anonymous Jolpica tier).
