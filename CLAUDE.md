# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

**Phases 0–5 shipped (2026-04-20).** Auth + schema + RLS + predict loop + admin results pipeline + reveal stage + friend leaderboard + profile + OG share card + sign-out all live. **37/37 tests green:** 35 Vitest (12 unit, 23 integration incl. I1–I10, R1–R3, regression guards) + 2 Playwright E2E (E1 full signup, E2 invalid invite). Typecheck, lint, and production build all clean.

Routes currently serving: `/`, `/join`, `/login`, `/auth/callback`, `/dashboard`, `/dashboard/predict`, `/dashboard/predict/[eventId]`, `/dashboard/league`, `/dashboard/standings` (stub), `/profile`, `/admin`, `/admin/results/[eventId]`, `/reveal/[eventId]`, `/api/cron/sync-f1-data` (Bearer-token gated), `/api/share/[eventId]/card.png` (public OG image).

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
```

### Admin bootstrap

Recommended: set `ADMIN_EMAIL=<your-email>` in `.env.local`. The `/auth/callback` route auto-UPSERTs that user into `public.admins` on every magic-link sign-in. That makes the bootstrap self-healing — a `supabase db reset` (which wipes `public.admins`) becomes a non-event; next sign-in restores admin.

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

### 5. Invite-code gate + magic-link auth

`/join` gates entry via a shared invite code in `INVITE_CODE` env var. Past the gate, users enter email → Supabase magic-link auth → auto-create `users` row on first login → profile setup.

No email allowlist. Trust-based for the friend group. Rotate `INVITE_CODE` if leaked publicly — existing sessions stay valid.

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
CRON_SECRET=                    # verifies Vercel cron calls (unused until Phase 3)
# RESEND_API_KEY — deferred; Phase 3 currently logs to console instead
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
