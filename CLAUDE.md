# CLAUDE.md

Guidance for Claude Code when working in this repository. These instructions
override default behavior — follow them exactly.

## Project

F1 Fantasy is a private prediction league for a ~10-person friend group. Every
F1 session (qualifying, race, sprint quali, sprint), users lock in a P1/P2/P3
prediction. After the session runs, results fetch, scores compute, and an
**admin-triggered reveal** flips all friends' picks simultaneously on
`/reveal/[eventId]`.

The emotional peak is the reveal — everything else (leaderboard, predict flow,
standings) serves that Sunday-night showdown moment.

Non-goals: multi-league support, multi-tenant architecture, public
leaderboards. Single deployment, single friend pool, one admin.

## Current state

Phases 0–14 shipped. Auth is Google OAuth (magic link removed), pages are
fluid-width, first-time users go through a mandatory profile-setup welcome
flow, sign-out keeps the invite cookie sticky (returning users on the same
device skip `/join`).

**Shipped-feature history is not maintained here.** For what changed when, read
`git log` and `plans/program-tracker.md`. This file is evergreen guidance +
invariants only.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions, `src/` dir, `@/*` alias)
- **Supabase** — Auth (Google OAuth), Postgres with Row-Level Security. SSR +
  service clients in `src/lib/supabase/{server,client,service}.ts`
- **Tailwind v4** — config-less; tokens in `src/app/globals.css` via
  `@theme inline`. **No shadcn** — bespoke components in `src/components/`,
  there is no `src/components/ui/` primitive layer
- **Framer Motion 12** — reveal animation only (earned motion, not decorative)
- **Geist** font family + **Titillium Web** (display, Black 900 — the
  pre-2018 F1 broadcast face), loaded via `next/font/google` under the
  `--font-boldonse` CSS variable (name kept for call-site/selector stability)
- **OpenF1 API** — schedule (`/meetings` + `/sessions`) and results
  (`/session_result`). Manual admin-entry is the reliable primary path;
  auto-fetch is a convenience
- **Resend** — admin email alerts on cron failure
  (`src/lib/email/notifyAdmin.ts`); a safe no-op when `RESEND_API_KEY` /
  `ADMIN_EMAIL` are unset
- **Vercel** — deploy target (Hobby tier; daily-only cron)
- **Vitest** (unit + integration) + **Playwright** (E2E)

## Architecture — the 5 things you must know before writing code

### 1. `events.lock_at` is the single source of lock truth

Regular `timestamptz not null` column on `events`, maintained by a BEFORE
INSERT/UPDATE trigger (`events_set_lock_at_trg`) that sets
`lock_at := session_start_at - interval '5 seconds'`. Client countdown, server
action check, and the `predictions_lock_guard` trigger ALL derive from this one
column — no two-truth gray zone. The guard trigger rejects writes where
`now() > lock_at`; server actions check the same boundary first (fast fail).
Product rule: predictions lock at scheduled start regardless of actual session
delays (rain, red flags, safety car). Never compute `locked` anywhere else.

### 2. Reveal is admin-triggered, not auto-on-results-insert

`events.revealed_at` gates the RLS policy that makes other friends' predictions
queryable. Workflow: results land → admin sees "Results in" → clicks "Reveal to
group" → `UPDATE events SET revealed_at = now()`. Only then do other users'
predictions become visible. Fallback: if admin forgets, RLS auto-unlocks
**1 hour** after `results.fetched_at` (lengthened from 10 min so the admin
"Fetch from OpenF1" button can't auto-spoil the cinematic). This solves the
"solo reveal" problem — without a gate, each friend hits `/reveal` at a
different time and experiences the animation alone.

### 3. Admin privilege lives in `admins`, not `users`

Separate `admins` table with `user_id` FK. Check via
`EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())`. Do NOT add an
`is_admin` column to `users` — RLS policies self-referencing `users` is a known
recursion footgun. Bootstrap is self-healing: set `ADMIN_EMAIL` in `.env.local`
and `/auth/callback` UPSERTs that user into `public.admins` on every sign-in
(so `supabase db reset` is a non-event). Never ship a UI for granting admin.

### 4. Score computation in app code, not a DB trigger

`src/lib/computeScores.ts` runs from the server path that writes `results`
(both the OpenF1 cron fetcher AND the admin manual-entry endpoint, via
`writeResultsService`). Pure, unit-tested. Idempotent via
`INSERT … ON CONFLICT (user_id, event_id) DO UPDATE`.

**Scoring rule:** Race/Quali =
`5×exact + wrongSlotBucket(onPodiumWrongSlot) + (allThreeExact ? +3 : 0)`,
where `wrongSlotBucket = {1→1, 2→2, 3→4}` (non-linear, exported alongside the
pure `slotOutcome`). A predicted driver not in the classified P1/P2/P3 scores
**0 for that slot** (DNF rule — never "right driver wrong slot" unless the
driver is on the podium). Max race/quali = 18 pts. Sprint events score P1 only
(exact = 5 else 0; max 5). Recompute retroactively with
`bun --env-file=.env.local run scripts/recompute-all-scores.ts` (idempotent).

### 5. Invite-code gate + Google OAuth

`/join` gates entry via a shared `INVITE_CODE`. The invite cookie is a
device-level capability token (HMAC'd with the service-role key); it sticks
across sign-outs so returning devices skip `/join`. Past the gate, `/login`
shows a single Sign-in-with-Google button; Supabase returns via
`/auth/callback`, which: (1) exchanges the code, (2) mirrors `auth.users` →
`public.users`, (3) self-heals `admins` if `ADMIN_EMAIL` matches, (4) if
`display_name` is null → `/profile?welcome=1` (required profile setup),
(5) else → `?next` (default `/dashboard`). The dashboard has a defensive guard
re-redirecting null-`display_name` users back to welcome — never remove it.
No email allowlist (trust-based for the friend group; rotate `INVITE_CODE` if
leaked).

## Two-source data identity (Jolpica + OpenF1)

OpenF1 keys results by `driver_number`, which F1 reassigns between seasons
(#1 follows the WDC). **Never join historical OpenF1 data on `driver_number`** —
the same number maps to different humans across years. Two stable identifiers:

- **`drivers.full_name`** + `src/lib/text/canonicalize.ts:canonicalizeName`
  (strips diacritics, lowercases, collapses whitespace) — used by
  `refreshNudges` to remap each OpenF1 session's `driver_number → our id`.
- **`drivers.ergast_id`** (text, unique, nullable) — Jolpica/Ergast canonical
  id; populated by `resolveDrivers(svc, season)` in the nightly sync; used by
  all `historical_results` joins.

Same pattern for circuits: OpenF1's `events.circuit` short name and Jolpica's
`events.ergast_circuit_id` coexist, with a small alias map in
`resolveCircuits.ts` for the cases neither name nor locality matches.

## Subsystems (design intent + where the code lives)

- **Jolpica historical layer** (`src/lib/jolpica/`) — 429-backoff fetch
  wrapper, `ergast_id`/circuit resolvers, idempotent `backfillResults`
  (`historical_races` + `historical_results`), pure `atTrackPodiumsFor`
  aggregate. One-time backfill (idempotent, ~3 min):
  `bun --env-file=.env.local run scripts/backfill-jolpica.ts`
  (scoped: `--season 2024` / `--from 2017 --to 2026`). Required for
  predict-detail at-track telemetry to show real numbers (else "—").
- **Standings** (`/dashboard/standings`) — Jolpica-canonical for the current
  season's race+sprint points (`src/lib/standings/computeStandings.ts`, official
  2026 points), falling back to recomputing from `session_classifications` for
  races not yet ingested by the next Jolpica delta. Empty until the first race
  weekend.
- **Telemetry nudges** — predict screen surfaces three signals under each
  chosen driver: last-5 form, at-circuit podium count (10-yr Jolpica window),
  season grid→race delta. Pure aggregation in
  `src/lib/nudges/computeNudges.ts`; cache table `driver_nudges`; rebuilt by
  `src/lib/nudges/refreshNudges.ts` via `/api/cron/refresh-nudges` (events
  within 10 days **plus every session of the next upcoming round**, idempotent).
  **Invariant:** last-5 form renders oldest→newest (latest rightmost) — the
  flip is render-side in `driver-picker.tsx`; the stored string stays
  most-recent-first.
- **Auto-fetch results + freeze** — `src/lib/results/fetchResults.ts` /
  `fetchResultForEvent` walk past events with an `openf1_session_key` and no
  `results` row, pull `/session_result`, run the scoring pipeline, and UPSERT
  `session_classifications`. Reachable from the `/api/cron/fetch-results` cron
  AND the admin "Fetch from OpenF1" button. **Freeze rule** (pure,
  unit-tested `src/lib/results/freezeResults.ts:isResultsFrozenForAuto`): the
  OpenF1 path (`source='openf1'`) must NOT modify a row once it is
  `source='admin'` **or** the event is revealed — it returns
  `{ok:true,scoresUpdated:0,frozen:true}` instead of overwriting. Admin manual
  entry passes `source='admin'` and always wins. Before reveal an `openf1` row
  may still be refreshed (provisional → official).
- **Free Practice banner** — on `/dashboard/predict/round/[round]`, top-3 of
  each completed FP. **Practice is deliberately NOT in the schema** (the
  `session_type` enum and `syncCalendar` filter stay scoring-only — practice
  rows would pollute predict/lobby/standings/RLS/lock). On-demand, best-effort
  (`src/lib/practice/loadPractice.ts`, ~15 min Next Data Cache; an OpenF1
  outage yields no banner, never a broken page). `practice_overrides`
  (service-role, no RLS) beats the live fetch when present; editor on
  `/admin/results/round/[round]`.
- **ICS calendar feed** — per-user opaque `users.calendar_token` minted lazily
  by `enableCalendarSyncAction`; public `/api/calendar/[token]` (in
  `PUBLIC_PREFIXES`) emits a VCALENDAR of current+next-season sessions with a
  30-min `VALARM`. No new Google OAuth scopes. Profile has the subscribe panel.
- **Reveal cinematic** (`src/app/reveal/[eventId]/reveal-stage.tsx`) — the
  canvas timeline ported entirely to Framer Motion (no RAF): title slam →
  livery sweep → SVG track-draw → P3→P2→P1 podium → friend-card cascade.
  Replay bumps a `playKey` that re-keys every motion node. `useReducedMotion()`
  swaps in a `StaticHero` and collapses delays to 0 — the cinematic is
  structurally absent for that audience, not throttled.

## Design system

The authoritative visual language is `.impeccable.md` at the project root. Hard
rules future Claude must respect:

- **Fonts:** Titillium Web 900 (display — via inline
  `style={{fontFamily:"var(--font-boldonse), ui-sans-serif"}}` so the global
  `[style*="Boldonse"]` display selector matches; the var/selector name is
  intentionally still "Boldonse" even though the face is Titillium Web),
  Geist Sans (body), Geist Mono (tabular — mandatory for all numerics; add
  `data-tabular`).
- **Palette:** OKLCH tokens, neutrals tinted toward F1-red (27°). Ferrari-red
  accent reserved for ~10% use (lock pulse, perfect-podium badge, primary CTA).
  Reference colors via `var(--token)` only; Tailwind v4 has no `bg-red-500` —
  use `bg-[color:var(--token)]`.
- **Banned:** `border-left/right` accent stripes >1px on cards; gradient text;
  generic 3-col icon-in-circle grids; uniform bubbly radius; decorative blobs.
  (Sanctioned exception: the 3px team-colour left edge on prediction-row /
  FP-banner / FP-override rows.)
- **Earned motion** only — animate on real state changes
  (lock countdown, reveal flip, submit feedback), never decorative.
- The global `.font-display, [style*="Boldonse"]` selector in `globals.css`
  sets the display defaults: weight 900, `line-height:0.98`,
  `letter-spacing:-0.01em`, `text-transform:uppercase` (no padding fix —
  Titillium Web has clean ascenders, unlike the old Boldonse). `data-tight`
  is the tighter cinematic variant (`0.9` / `-0.025em`; reveal + Show Reel
  hero only). Inline `font-size`/`line-height`/`letter-spacing` at call
  sites still win over these defaults.

Foundation: `src/lib/design/teams.ts` (single source of team
slug/name/hex/livery/logo/car; alias-resolves free-form `drivers.team`),
`drivers.ts` (portrait/headshot/country/flag — null outside the asset set →
initial-letter avatar), `tracks.ts` (`trackImg`/`trackRatio` → country
silhouette PNG drawn via CSS `mask-image` so it recolours by
`backgroundColor`; legacy `trackPath` SVG kept as fallback; alias-resolved
on both ergast id + OpenF1 short-name). Bespoke components: `TopBar`,
`TrackDiagram`, `DriverPortrait`, `ScoringHelp`/`ScoringLegend`. Assets in
`public/assets/{drivers,drivers-portrait,cars,logos,tracks}/`;
`src/middleware.ts`
excludes `/assets/` so they serve unauthenticated.

## Routes serving

`/`, `/join`, `/login`, `/auth/callback`, `/dashboard`,
`/dashboard/predict`, `/dashboard/predict/round/[round]`,
`/dashboard/predict/[eventId]`, `/dashboard/lobby`,
`/dashboard/lobby/round/[round]`, `/dashboard/league`,
`/dashboard/standings`, `/profile` (supports `?welcome=1`; ICS panel),
`/admin`, `/admin/results/round/[round]`, `/admin/results/[eventId]`,
`/reveal`, `/reveal/[eventId]`, `/api/cron/{sync-f1-data,fetch-results,
refresh-jolpica-current,refresh-nudges}` (Bearer-gated),
`/api/calendar/[token]` (public, per-user token), `/api/share/[eventId]/card.png`
(public OG), `/api/test/sign-in-password` (non-prod only).

## Common commands

**Gotcha:** `bun test` runs Bun's native runner — always use `bun run test`.

```bash
bun dev                  # Next dev server on :3000
bun run test             # Vitest unit + integration (NOT `bun test`)
bun run test <file>      # single file ·  bun run test:watch
bun run e2e              # Playwright ·  bun run e2e:ui
bun run lint             # eslint  ·  bun run typecheck  # tsc --noEmit

# Supabase — ports shifted +100 (another app owns the defaults)
supabase start           # API :54421 · DB :54422 · Studio :54423 · Mailpit :54424
supabase stop | status | db reset
supabase migration new <name>

# Integration tests need DATABASE_URL + service key from .env.local:
bun --env-file=.env.local run vitest run tests/integration

# Seed / one-off (require .env.local)
bun --env-file=.env.local run scripts/seed-calendar.ts   # 2026 schedule
bun --env-file=.env.local run scripts/seed-drivers.ts    # current drivers
bun --env-file=.env.local run scripts/backfill-jolpica.ts
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/refresh-nudges
```

Local Google OAuth needs real credentials (`GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` in `.env.local`, then `supabase stop && supabase start`);
redirect URI `http://127.0.0.1:54421/auth/v1/callback`. Without them the
sign-in button errors. `/api/test/sign-in-password` (non-prod) stands in for
the unscriptable Google consent UI in E2E.

## Testing approach

Tests colocate with features: `src/**/*.test.ts` (unit — score compute,
prediction validation, invite code, pure helpers), `tests/integration/*.test.ts`
(Supabase-local — RLS, triggers, cron fetcher, admin path),
`tests/e2e/*.spec.ts` (Playwright). Run `bun run test`; integration requires
`supabase start`.

**Regression rule (hard):** any change to `computeScore`, the prediction lock
trigger, or RLS policies MUST add a regression test. These silently break if
untested.

## Environment variables

See `.env.example`. Local values live in `.env.local` (gitignored):

```
NEXT_PUBLIC_SUPABASE_URL          # http://127.0.0.1:54421 locally
NEXT_PUBLIC_SUPABASE_ANON_KEY     # publishable key (sb_publishable_…)
SUPABASE_SERVICE_ROLE_KEY         # secret key (sb_secret_…), server-only
DATABASE_URL                      # direct pg conn for seeds + integration tests
INVITE_CODE                       # /join gate; HMAC'd into the invite cookie
CRON_SECRET                       # verifies Vercel cron calls
RESEND_API_KEY / ADMIN_EMAIL / RESEND_FROM   # optional admin alerts;
                                  # ADMIN_EMAIL also self-heals admins on signin
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET      # local OAuth
```

## Footguns

- **Cron auth:** `/api/cron/*` is exempt from invite+session middleware (see
  `PUBLIC_PREFIXES` in `src/middleware.ts`) because Vercel cron has no cookies.
  Every cron handler MUST verify `Authorization: Bearer ${CRON_SECRET}` itself
  (middleware won't); missing/wrong → 401. CLI seed scripts and cron share
  `src/lib/sync/` — change logic in one place.
- **Supabase redirect allowlist:** `additional_redirect_urls` must be a
  `**`-suffixed allowlist. The dev server is HTTP on `127.0.0.1:3000`; without
  `http://127.0.0.1:3000/**` (+ `localhost`) in the allowlist Supabase silently
  strips `emailRedirectTo` and the middleware bounces the user to `/join`.
  Revisit before prod deploy.
- **Tailwind v4 `--spacing-*` namespace trap:** defining `--spacing-xl` hijacks
  `p-xl` AND `max-w-xl` AND every `xl` utility. The semantic scale lives under
  a separate `--space-*` namespace, referenced explicitly
  (`p-[var(--space-lg)]`); never assume `p-4` maps to the design.
- **Vitest + local Supabase:** integration tests share one DB instance, so
  `vitest.config.ts` sets `test.fileParallelism: false` (a `beforeEach` reset
  in one file races fatally against another). Don't enable file parallelism
  without per-file schemas. (Vitest 4 types reject
  `poolOptions.threads.singleThread` — use `fileParallelism:false`.)
- **OpenF1 quirks:** Bahrain (meeting 1282) and Saudi Arabia (1283) 2026 are
  `is_cancelled` — `session_result` 404s; `seed-calendar.ts` + the latency
  script handle it. Pre-season testing meetings appear in `/meetings?year=`
  but have no scoring sessions — `seed-calendar.ts` filters
  `/testing|pre[-\s]?season/i`. OpenF1 rate-limits rapid requests —
  `seed-calendar.ts` throttles 350 ms with 429 backoff.

## What NOT to do

- Don't add an `is_admin` column on `users`. Use the `admins` table.
- Don't compute `locked` anywhere except from `events.lock_at`.
- Don't let RLS leak predictions before `revealed_at` (or the 1-hour results
  fallback). The reveal IS the product.
- Don't auto-refresh a running race's results into the UI mid-session. Results
  only land post-session.
- Don't add left-border accent stripes to cards (except the sanctioned 3px
  team-colour prediction-row idiom). Use tinted surface-lift / subtle borders.
- Don't import F1 team logos from formula1.com without thought (trademarks).
  Default to color-dot + 3-letter code (see `.impeccable.md`).

## graphify

Knowledge graph at `graphify-out/`.

- ALWAYS read `graphify-out/GRAPH_REPORT.md` before reading source files,
  grepping, or answering codebase questions — it's the primary map.
- If `graphify-out/wiki/index.md` exists, navigate it instead of raw files.
- For cross-module "how does X relate to Y", prefer `graphify query`,
  `graphify path "A" "B"`, or `graphify explain "concept"` over grep.
- After modifying code, run `graphify update .` (AST-only, no API cost).

## plans/

`plans/` is gitignored — the owner's local planning artifacts (program
tracker, master plan, dated session logs). If you need historical scope
context not in the code or git history, ask the owner.
