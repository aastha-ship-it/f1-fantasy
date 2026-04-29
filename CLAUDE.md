# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

**Phases 0–5 shipped + telemetry nudges + Track B + Jolpica historical layer + Design port Pass 1+2+3+4 + screenshot-driven refinement pass + admin pages port + qualifying ingest + cron telemetry + Phase 8 (UI-issues triage Buckets A + B + C) + Phase 8.5 (at-track wins/podiums split + telemetry readability redesign) + Phase 9 (reveal-discovery surfaces — dashboard banner + REVEAL tab + grouped /reveal index — 2026-04-30).** Auth is now Google OAuth (magic link removed), pages are fluid-width, first-time users go through a mandatory profile-setup welcome flow. Sign-out keeps the invite cookie sticky so returning users don't get kicked back to /join. **99/99 tests green:** 97 Vitest + 2 Playwright (E1 uses a test-only password sign-in endpoint to stand in for the unscriptable Google consent UI). Typecheck, lint, and production build all clean.

### Design system (Pass 1–4 shipped 2026-04-28)

All four design-port passes have shipped. Every authenticated screen — Login, Profile, Dashboard, Predict-list, Predict-detail, World standings, League, and Reveal — now matches the Claude design canvas at `design/`.

The reveal cinematic (`src/app/reveal/[eventId]/reveal-stage.tsx`) ports the canvas's 9.5-second timeline entirely to Framer Motion (no RAF loop): stripe wash bg → title slam (skew-in 0–1.4s) → livery sweep car (winner's team carSrc translating across the band 0.6–2.2s with blur+opacity envelope) → SVG track-draw via `motion.path pathLength` (2.0–2.9s) → P3 → P2 → P1 podium reveal (3.3s onward) → friend-pick cards cascading at 150ms stagger. A Replay button bumps a `playKey` that re-keys every motion node so the full sequence replays. `useReducedMotion()` swaps in a `StaticHero` and collapses all delays to 0 — the cinematic is structurally absent for that audience, not throttled.

Foundation modules in `src/lib/design/`:
- `teams.ts` — single source of truth for team metadata (slug, name, hex, livery, logoSrc, carSrc). Resolves free-form `drivers.team` strings via an alias table ("Red Bull Racing"/"Audi" → canonical slug). Exposes `teamMeta(team)`, `teamHex(team)`, `ALL_TEAMS`.
- `drivers.ts` — `driverPortraitSrc(code)` / `driverHeadshotSrc(code)` (return null for codes outside the design canvas asset set), `driverCountry(code)`, `countryFlag(iso)`.
- `tracks.ts` — 12 stylized SVG track paths lifted from the design canvas, alias-resolved between OpenF1 short names and Jolpica `circuit_id`.

Reusable components in `src/components/`:
- `TopBar.tsx` — used on every authenticated screen. 6 tabs (Calendar / Predict / Reveal / Standings / League / Profile) + user initial + sign-out.
- `TrackDiagram.tsx` — 200×120 SVG, alias-resolved, configurable size + stroke.
- `DriverPortrait.tsx` — image when asset exists, initial-letter avatar tinted with team hex when not.

Asset directory at `public/assets/{drivers,drivers-portrait,cars,logos}/` (~36MB). `src/middleware.ts` matcher excludes `/assets/` so they're served unauthenticated.

Boldonse line-height fix: a global `[style*="Boldonse"]` selector in `globals.css` adds 0.12em top padding + 1.05 line-height to absorb the font's deep ascenders. Use `data-tight` attribute to opt out (cinematic display titles).

Routes currently serving: `/`, `/join`, `/login` (split-layout cinematic Google button), `/auth/callback`, `/dashboard`, `/dashboard/predict`, `/dashboard/predict/round/[round]` (per-round session list), `/dashboard/predict/[eventId]`, `/dashboard/league`, `/dashboard/standings`, `/profile` (supports `?welcome=1`), `/admin`, `/admin/results/round/[round]` (per-round admin overview), `/admin/results/[eventId]`, `/reveal` (show-reel index, grouped by round), `/reveal/[eventId]`, `/api/cron/sync-f1-data` (Bearer-gated), `/api/cron/fetch-results` (Bearer-gated), `/api/cron/refresh-jolpica-current` (Bearer-gated), `/api/cron/refresh-nudges` (Bearer-gated), `/api/share/[eventId]/card.png` (public OG), `/api/test/sign-in-password` (non-prod only).

### Two-source data identity (Jolpica + OpenF1)

OpenF1 keys results by `driver_number` which F1 reassigns between seasons (#1 follows the WDC). **Never** join historical OpenF1 data on `driver_number` directly — the same number maps to different humans across years. Two stable identifiers in our schema:

- **`drivers.full_name`** + `src/lib/text/canonicalize.ts:canonicalizeName` — strips diacritics, lowercases, collapses whitespace. Used by `refreshNudges` to remap each OpenF1 session's `driver_number → our_id`.
- **`drivers.ergast_id`** (text, unique, nullable) — Jolpica/Ergast canonical id (`max_verstappen`, `norris`). Populated by `resolveDrivers(svc, season)` in the nightly sync. Used by all `historical_results` joins.

Same pattern for circuits: OpenF1's `events.circuit` short name (e.g. "Sakhir") and Jolpica's `events.ergast_circuit_id` (e.g. "bahrain") coexist; a small alias map in `resolveCircuits.ts` covers the few cases where neither circuitName nor locality matches.

### Jolpica historical layer (shipped 2026-04-28)

Built per `plans/2026-04-28-jolpica-historical.md`. Lives entirely under `src/lib/jolpica/`:

- `client.ts` — fetch wrapper with 6-attempt 429 backoff (Retry-After-aware), pagination iterator
- `resolveDrivers.ts` + `resolveCircuits.ts` — populate `ergast_id` columns
- `backfillResults.ts` — UPSERTs `historical_races` + `historical_results` (race + sprint, idempotent)
- `atTrackPodiumsFor.ts` — pure SQL aggregate, single Postgres round-trip per driver

Schema additions in `supabase/migrations/20260429000000_jolpica_foundation.sql` + `20260429000100_driver_nudges_nullable_podiums.sql`.

**Cron sequence (UTC)**: `04:00 sync-f1-data` (calendar/drivers + ergast_id mapper) → `04:15 fetch-results` (OpenF1 hot path) → `04:20 refresh-jolpica-current` (Jolpica delta into `historical_results`) → `04:30 refresh-nudges` (reads `historical_results` for at-track signal).

**Initial backfill** (last 10 seasons, ~120 Jolpica requests, ~3 min):

```bash
bun --env-file=.env.local run scripts/backfill-jolpica.ts
# or scoped:
bun --env-file=.env.local run scripts/backfill-jolpica.ts --season 2024
bun --env-file=.env.local run scripts/backfill-jolpica.ts --from 2017 --to 2026
```

**Standings page** is now Jolpica-canonical for the current season's race + sprint points; falls back to recomputing from `session_classifications` for races finished but not yet ingested by the next Jolpica delta. UI shows "Latest ingested race · YYYY-MM-DD" + a backstop-row count when applicable.

**Nudges** at-track-podium signal now sources from `historical_results` over a 10-year window (was OpenF1 4-year window). Predict UI labels include the timeframe inline: `Podiums @ Miami (last 10 yrs)`, `Race-day gain (this season)`. Constant: `JOLPICA_HISTORY_WINDOW_YEARS` in `src/lib/jolpica/config.ts`.

### Auto-fetch results (Track B, shipped 2026-04-28)

`src/lib/results/fetchResults.ts` walks past events with an `openf1_session_key` and no `results` row, pulls `/session_result` from OpenF1, and runs the scoring pipeline via the new `writeResultsService` (admin-check-bypass; trust boundary is the `Bearer CRON_SECRET` on `/api/cron/fetch-results`). Manual admin entry stays the primary path — auto-fetch is a convenience. Also UPSERTs full classification rows into `session_classifications` for the standings page.

### Standings (Track B, shipped 2026-04-28)

`/dashboard/standings` reads from `session_classifications` (migration `20260428110000`) and computes driver + constructor totals via `src/lib/standings/computeStandings.ts` using official 2026 F1 points (race 25/18/15/12/10/8/6/4/2/1, sprint 8/7/6/5/4/3/2/1). Empty state until the first race weekend fills the cache.

### Resend admin alerts (Track B, shipped 2026-04-28)

`src/lib/email/notifyAdmin.ts` is a thin Resend wrapper. Configured via `RESEND_API_KEY` + `ADMIN_EMAIL` (+ optional `RESEND_FROM`). Safe to call without configuration — returns `{sent: false, reason}` instead of throwing. Wired into the catch path of all three cron routes.

### Telemetry nudges (Phase 4 carry-over, shipped 2026-04-28)

Predict screen surfaces three signals under each chosen driver: last-5 form (`P1 · P4 · DNF · P2 · P3`), at-circuit podium count, and average grid→race delta for the season. Pure aggregation lives in `src/lib/nudges/computeNudges.ts` (12 unit tests). Cache table: `driver_nudges (event_id, driver_id, recent_form, at_track_podiums, quali_race_delta)` — see `supabase/migrations/20260428100000_driver_nudges.sql`. Filled by `src/lib/nudges/refreshNudges.ts` which walks OpenF1 `/sessions` + `/session_result` for the current and prior season. Cron at `/api/cron/refresh-nudges` rebuilds nudges for any event within the next 10 days; idempotent. Vercel schedule wired in `vercel.json` (04:30 UTC daily, 30min after `sync-f1-data`).

See `plans/program-tracker.md` for the live phase-by-phase status. See `plans/flickering-giggling-valley.md` for the authoritative plan.

### Planning artifacts (read before writing any code)

All planning artifacts are in `plans/`:

| File | What it contains |
|---|---|
| `plans/program-tracker.md` | **Live status board.** Which phases are done, exit-criteria checkboxes, what's in flight. Check this first. |
| `plans/flickering-giggling-valley.md` | **The master plan.** Data model, RLS policies, scoring pseudocode, 29-path test plan, screen-level design decisions, wireframe refinements. |
| `plans/2026-04-18-f1-fantasy.md` | CEO plan — scope decisions, 10x vision, what was accepted vs deferred vs skipped. Context on WHY the scope looks the way it does. |
| `plans/aasthakataria-unknown-eng-review-test-plan-20260418-170000.md` | Test plan artifact consumed by `/qa` and `/qa-only`. Critical paths, interactions to verify, edge cases per page. |
| `plans/designs/reveal-20260419/wireframe.html` | Reveal screen reference composition |
| `plans/designs/leaderboard-20260419/wireframe.html` | Leaderboard reference composition |
| `plans/designs/predict-20260419/wireframe.html` | Predict screen reference composition (includes lock-countdown hero) |

Design Context (fonts, palette, principles, anti-patterns) is in `.impeccable.md` at the project root.

### Viewing wireframes during dev

The wireframes are self-contained HTML (Google Fonts via CDN, inline CSS, no build step):

```bash
# Open any wireframe directly in your browser
open "plans/designs/reveal-20260419/wireframe.html"
open "plans/designs/leaderboard-20260419/wireframe.html"
open "plans/designs/predict-20260419/wireframe.html"
```

### Scaffold done — what's actually installed

- **Next.js 16.2.4** (App Router, TypeScript, `src/` dir, `@/*` import alias)
- **Tailwind v4** — tokens live in `src/app/globals.css` via `@theme inline`, not in `tailwind.config.js` (v4 is config-less)
- **Supabase JS + SSR** (`@supabase/supabase-js`, `@supabase/ssr`) — clients in `src/lib/supabase/{server,client}.ts`
- **Vitest** for unit + integration (`src/**/*.test.ts`, `tests/integration/**/*.test.ts`)
- **Playwright** configured in `playwright.config.ts`, Chromium installed. Run `bunx playwright test` for E2E. Specs in `tests/e2e/*.spec.ts`.
- **Framer Motion 12**, **Geist font**
- **shadcn/ui** — NOT YET initialized. Adding it in Phase 2 when Button/Input/Dialog are needed. Run `bunx shadcn@latest init` then.
- **Resend** — deferred. Phase 3 logs fetch failures to console/DB until it's wired.

## Project

F1 Fantasy is a private prediction league for a ~10-person friend group. Every F1 session (qualifying, race, sprint quali, sprint), users lock in a P1/P2/P3 prediction. After the session runs, results fetch, scores compute, and an admin-triggered reveal flips all friends' picks simultaneously on `/reveal/[eventId]`.

The emotional peak is the reveal — everything else (leaderboard, predict flow, standings) serves that Sunday-night showdown moment.

Non-goals: multi-league support, multi-tenant architecture, public leaderboards. Single deployment, single friend pool, one admin.

## Stack

- **Next.js 15** (App Router, TypeScript, Server Actions)
- **Supabase** — Auth (magic link), Postgres with Row-Level Security
- **Vercel** — deploy target (Hobby tier unless Day-1 OpenF1 latency test forces an upgrade)
- **Tailwind CSS + shadcn/ui** — re-themed, never stock aesthetic
- **Framer Motion** — reveal animation only (earned motion, not decorative)
- **OpenF1 API** — schedule (`/meetings` + `/sessions`) and results (`/session_result`). Manual admin-entry is the reliable primary path; auto-fetch is a convenience pending latency verification.
- **Resend** — email alerts on failed result fetch (admin notification)
- **Vitest + Playwright** — unit/integration + E2E

## Common commands

**Important gotcha:** `bun test` invokes Bun's *native* test runner (not what we want). Always use `bun run test` to route through Vitest.

```bash
# Dev loop
bun dev                             # Next.js dev server on :3000
bun run test                        # Vitest unit + integration (NOT `bun test`)
bun run test <file>                 # single test file
bun run test:watch                  # watch mode
bun run e2e                         # Playwright E2E suite
bun run e2e:ui                      # Playwright UI for debugging

# Types & lint
bun run lint                        # eslint
bun run typecheck                   # tsc --noEmit

# Supabase — ports shifted +100 (stockly-app owns the defaults)
supabase start                      # API :54421 · DB :54422 · Studio :54423 · Mailpit :54424
supabase stop
supabase status                     # print local URLs + keys
supabase db reset                   # re-apply migrations + seed
supabase migration new <name>       # new migration file

# Integration tests need the DATABASE_URL and service role key from .env.local
bun --env-file=.env.local run vitest run tests/integration

# Seed + one-off scripts (require .env.local)
bun run latency                     # measure OpenF1 publish latency
bun --env-file=.env.local run scripts/seed-calendar.ts  # 2026 schedule
bun --env-file=.env.local run scripts/seed-drivers.ts   # current drivers

# Historical at-track data — required for predict-detail telemetry to show
# real "1 win · 2 podiums" numbers. Run once after `supabase db reset` or
# a fresh clone; idempotent. Without it, at-track values render as "—".
bun --env-file=.env.local run scripts/backfill-jolpica.ts
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3001/api/cron/refresh-nudges
```

### Google OAuth setup (one-time per environment)

Local sign-in requires real Google OAuth credentials. Without them the **Sign in with Google** button throws an error from Supabase.

1. Go to Google Cloud Console → APIs & Services → Credentials → **Create Credentials → OAuth 2.0 Client ID**.
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://127.0.0.1:54421/auth/v1/callback` (local Supabase)
     - `https://<project>.supabase.co/auth/v1/callback` (prod, once deployed)
2. Copy the Client ID + Secret.
3. Paste into `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```
4. `supabase stop && supabase start` to pick up the new config.
5. For prod: Supabase dashboard → Auth → Providers → Google → paste Client ID + Secret.

The local Supabase config already has `[auth.external.google]` enabled with `skip_nonce_check = true` (required for local dev with PKCE).

### Admin bootstrap

Recommended: set `ADMIN_EMAIL=<your-email>` in `.env.local`. The `/auth/callback` route auto-UPSERTs that user into `public.admins` on every sign-in. That makes the bootstrap self-healing — a `supabase db reset` (which wipes `public.admins`) becomes a non-event; next sign-in restores admin.

Manual fallback (if you don't want to set the env var): paste your uuid into Studio's SQL editor:

```sql
insert into public.admins (user_id) values ('<your-uuid-here>');
```

Never ship a UI for granting admin — this stays DB-side / env-side forever.

## Architecture — the 5 things you need to know before writing code

### 1. `events.lock_at` is the single source of lock truth

Regular `timestamptz not null` column on `events`, maintained by a BEFORE INSERT/UPDATE trigger (`events_set_lock_at_trg`) that sets `lock_at := session_start_at - interval '5 seconds'`. Client countdown, server action check, and `predictions_lock_guard` trigger ALL derive from this one column — no two-truth 5-second gray zone.

*(We tried a STORED GENERATED column first; Postgres 17 rejects `timestamptz - interval` as non-immutable. The trigger is behaviorally equivalent and documented in `supabase/migrations/20260419150000_init_schema.sql`.)*

DB trigger `predictions_lock_guard` on `predictions` BEFORE INSERT/UPDATE rejects writes where `now() > lock_at`. Server actions check the same boundary before hitting DB (fast fail). Product rule: predictions lock at scheduled start regardless of actual session delays (rain, red flags, safety car).

### 2. Reveal is admin-triggered, not auto-on-results-insert

`events.revealed_at` gates the RLS policy that makes other friends' predictions queryable. Workflow: results land → admin sees "Results in" → clicks "Reveal to group" → `UPDATE events SET revealed_at = now()`. Only then do other users' predictions become visible.

Fallback: if admin forgets, RLS auto-unlocks 10 minutes after `results.fetched_at`. See the RLS block in the plan for the exact policy.

This solves the "solo reveal" problem — without a trigger, each friend hits `/reveal` at a different time and experiences the animation alone.

### 3. Admin privilege lives in `admins`, not `users`

Separate `admins` table with `user_id` FK. Check via `EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())`. Do NOT add an `is_admin` column to `users` — Supabase RLS policies self-referencing `users` is a known recursion footgun.

Admin bootstrap: `INSERT INTO admins (user_id) VALUES ('<your uuid>');` in the Supabase SQL editor after first login. Never ship a UI for granting admin.

### 4. Score computation in app code, not a DB trigger

`lib/computeScores.ts` runs from the server path that writes `results` (both the OpenF1 cron fetcher AND the admin manual-entry endpoint call it). Pure function, unit-tested in isolation. Pseudocode is in the plan.

Idempotent via `INSERT ... ON CONFLICT (user_id, event_id) DO UPDATE`. Safe to re-run.

**DNF rule:** if a predicted driver is not in the classified P1/P2/P3, that slot scores 0. Not "right driver wrong slot" — just zero. Otherwise exact=5, slot_match=2, perfect_podium=+3. Max per race event: 18 pts. Sprint events only score P1 (max 5 pts).

### 5. Invite-code gate + Google OAuth

`/join` gates entry via a shared invite code in `INVITE_CODE` env var. The invite cookie is a **device-level capability token** (HMAC'd with the service-role key). It sticks across sign-outs so returning users on the same browser never see `/join` again — only new devices do.

Past the gate, `/login` shows a single **Sign in with Google** button. Supabase handles the OAuth round-trip and returns via `/auth/callback`, which:
1. Exchanges the code for a session
2. Mirrors `auth.users` → `public.users` (first-login hook)
3. Self-heals `admins` if `ADMIN_EMAIL` matches
4. If `display_name` is null → redirects to `/profile?welcome=1` for required profile setup
5. Otherwise → redirects to `?next` (default `/dashboard`)

The dashboard has a **defensive guard** that redirects anyone with a null `display_name` back to `/profile?welcome=1`, so users can't skip profile setup by navigating directly.

No email allowlist — anyone with a Gmail account + the invite code can sign in. Trust-based for the friend group. Rotate `INVITE_CODE` if leaked publicly; existing sessions stay valid.

## Testing approach

100% coverage of 29 identified paths specced in planning (12 unit + 13 integration + 4 E2E). Tests colocate with features:

- `lib/*.test.ts` — unit tests (score compute, prediction validation, invite code validation)
- `tests/integration/*.test.ts` — Supabase-local integration (RLS, triggers, cron fetcher, admin path)
- `tests/e2e/*.spec.ts` — Playwright (join flow, predict→reveal flow, reduced-motion path)

Integration tests require `supabase start` running. CI spins up local Supabase before the test job.

**Regression rule:** any change to `computeScore`, prediction lock trigger, or RLS policies MUST add a regression test. These are the parts that silently break if untested.

## Design system

The authoritative visual language is in `.impeccable.md` at the project root. Key rules future Claude must respect:

- **Fonts:** Boldonse (display), Geist Sans (body), Geist Mono (tabular — mandatory for all numerics — scores, timers, positions, driver numbers)
- **Palette:** OKLCH tokens, neutrals tinted toward F1-red hue (27°). Ferrari-red accent reserved for 10% use (lock pulse, perfect-podium badge, primary CTA only)
- **No `border-left` accent stripes on cards.** AI-slop pattern, explicitly banned
- **No gradient text.** Solid colors only
- **Earned motion:** animate only on real state changes (lock countdown, reveal flip, submit feedback). Never decorative
- **Tabular figures everywhere numbers live** so scores/times/positions don't jitter between states

See `.impeccable.md` for the full palette, 5 principles, screen-level decisions, and anti-patterns.

## Environment variables

See `.env.example` for the template. Local dev values are already in `.env.local` (gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=       # http://127.0.0.1:54421 locally
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase 'publishable' key (sb_publishable_...)
SUPABASE_SERVICE_ROLE_KEY=      # Supabase 'secret' key (sb_secret_...), server-only
DATABASE_URL=                   # direct pg connection for seeds + integration tests
INVITE_CODE=                    # shared secret for /join gate; HMAC'd into the invite cookie
CRON_SECRET=                    # verifies Vercel cron calls
# Optional — admin email alerts on cron failure (no-op if either is missing)
RESEND_API_KEY=                 # re_... from resend.com
ADMIN_EMAIL=                    # destination for cron failure alerts; also self-heals admins on signin
RESEND_FROM=                    # optional; defaults to "F1 Fantasy <noreply@f1-fantasy.app>"
```

### Vitest + local Supabase

Integration tests share the local Supabase instance, so test *files* must run sequentially — `beforeEach(resetTestData)` races fatally against in-flight tests in another file otherwise. `vitest.config.ts` sets `test.fileParallelism: false`. Tests within one file already sequence via `beforeEach`, so this is the minimum needed. Don't try to enable file parallelism for integration tests without first giving each file its own schema/namespace.

Vitest 4's config TS types reject `poolOptions.threads.singleThread` (runtime accepts it; types don't expose it). Use `fileParallelism: false` instead.

### Cron endpoints

`/api/cron/*` is **exempted from the invite + session middleware** (see `PUBLIC_PREFIXES` in `src/middleware.ts`) because Vercel cron requests have no user cookies. Every route under `/api/cron/` must verify `Authorization: Bearer ${process.env.CRON_SECRET}` inside the handler — the middleware will not do it for you. A missing or wrong token returns 401.

To trigger a sync locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  'http://localhost:3000/api/cron/sync-f1-data'
# Optional: ?season=2027
```

CLI seed scripts and the cron endpoint share the same lib functions in `src/lib/sync/`. If you change the sync logic, update one place; both paths benefit.

### Supabase local config footguns

- **`additional_redirect_urls` must be a `**`-suffixed allowlist.** Default local config only allows `https://127.0.0.1:3000` (HTTPS, exact path). Dev server is HTTP on `127.0.0.1:3000/auth/callback` — without the allowlist, Supabase silently strips `emailRedirectTo` and falls back to `site_url`, which sends the magic-link code to the root and the middleware bounces it to `/join`. Current config allows `http://127.0.0.1:3000/**`, `http://localhost:3000/**`, `https://127.0.0.1:3000/**`. Revisit before prod deploy.
- **Tailwind v4's `--spacing-*` namespace is shared across every size utility.** If you define `--spacing-xl` in `@theme`, you change `p-xl` AND `max-w-xl` AND `w-xl` AND every other utility named `xl`. For a semantic scale, keep tokens under a separate namespace (we use `--space-*`) and reference them explicitly.

### OpenF1 data quirks to remember

- Both Bahrain (meeting_key 1282) and Saudi Arabia (1283) 2026 are flagged `is_cancelled: true`. `session_result` 404s for cancelled sessions. The `seed-calendar.ts` filter + the latency script both handle this.
- Pre-season testing meetings appear as meetings in `/meetings?year=2026` but have no scoring sessions. `seed-calendar.ts` filters on `/testing|pre[-\s]?season/i` so the round counter isn't bumped by them.
- OpenF1 rate-limits on rapid sequential requests; `seed-calendar.ts` throttles 350ms between meeting fetches with exponential backoff on 429s.

## What NOT to do

- Don't add an `is_admin` column on `users`. Use the `admins` table.
- Don't compute `locked` anywhere except from `events.lock_at`. No derived fields across the app.
- Don't let RLS leak predictions before `revealed_at` (or the 10-min fallback). The reveal IS the product.
- Don't auto-refresh a running race's results into the UI mid-session. Results only land post-session.
- Don't add left-border stripes to cards for visual accent. Use tinted surface-lift or subtle borders.
- Don't import F1 team logos from formula1.com without a second thought — trademarks. OK for the private friend league, risky if it ever opens up. Default to color-dot + 3-letter code pattern (see `.impeccable.md`).
