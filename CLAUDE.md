# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

**Phases 0–5 shipped + telemetry nudges + Track B + Jolpica historical layer + Design port Pass 1+2+3+4 + screenshot-driven refinement pass + admin pages port + qualifying ingest + cron telemetry + Phase 8 (UI-issues triage Buckets A + B + C) + Phase 8.5 (at-track wins/podiums split + telemetry readability redesign) + Phase 9 (reveal-discovery surfaces) + Phase 9.5 (2026 grid: Audi rebrand + Cadillac as 11th constructor — 2026-04-30) + Phase 10 (changes.md: new bucket scoring, Lobby tab, ICS calendar feed, scoring legend, telemetry order flip, next-round nudge coverage — 2026-05-18) + Phase 11 (changes.md §6: on-demand Free Practice form-guide banner on the predict round page + admin override — 2026-05-18) + Phase 12 (changes.md §7: admin "Fetch from OpenF1" button for scoring sessions + results.source freeze rule + reveal fallback 10m→1h — 2026-05-18) + Phase 13 (changes.md §8: scoring legend relocated to a global TopBar "How Scoring Works" modal — 2026-05-18) + Phase 14 PR 1 (design_handoff_phase11 §9+§4 visual-fidelity pass: ScoringHelp modal shell + ScoringLegendBody chrome/copy — 2026-05-18) + Phase 14 PR 2 (design_handoff_phase11 §1: Lobby preview/expand redesign + Red Bull hex → #4A77DB — 2026-05-19) + Phase 14 PR 3 (design_handoff_phase11 §11: Predict last-5 form-strip polish — 2026-05-19) + Phase 14 PR 4 (design_handoff_phase11 §10: Reveal FriendCard bucket math — per-row badges + bucket-tally + perfect pill — 2026-05-19) + Phase 14 PR 5 (design_handoff_phase11 §3: Show Reel /reveal index redesign — 2026-05-19) + Phase 14 PR 6 (design_handoff_phase11 §5: Profile calendar-sync 2-col panel — 2026-05-19) + Phase 14 PR 7 (design_handoff_phase11 §6: Predict-list FP banner reframe — 2026-05-19) + Phase 14 PR 8 (design_handoff_phase11 §7: admin OpenF1-fetch 4-state banner + Accept-as-official — 2026-05-19).** Auth is now Google OAuth (magic link removed), pages are fluid-width, first-time users go through a mandatory profile-setup welcome flow. Sign-out keeps the invite cookie sticky so returning users don't get kicked back to /join. **Vitest green:** 164 unit + 26 integration (integration requires local Supabase; 2 Playwright specs unchanged, E1 uses a test-only password sign-in endpoint to stand in for the unscriptable Google consent UI). Typecheck, lint, and production build all clean.

### Design system (Pass 1–4 shipped 2026-04-28)

All four design-port passes have shipped. Every authenticated screen — Login, Profile, Dashboard, Predict-list, Predict-detail, World standings, League, and Reveal — now matches the Claude design canvas at `design/`.

The reveal cinematic (`src/app/reveal/[eventId]/reveal-stage.tsx`) ports the canvas's 9.5-second timeline entirely to Framer Motion (no RAF loop): stripe wash bg → title slam (skew-in 0–1.4s) → livery sweep car (winner's team carSrc translating across the band 0.6–2.2s with blur+opacity envelope) → SVG track-draw via `motion.path pathLength` (2.0–2.9s) → P3 → P2 → P1 podium reveal (3.3s onward) → friend-pick cards cascading at 150ms stagger. A Replay button bumps a `playKey` that re-keys every motion node so the full sequence replays. `useReducedMotion()` swaps in a `StaticHero` and collapses all delays to 0 — the cinematic is structurally absent for that audience, not throttled.

Foundation modules in `src/lib/design/`:
- `teams.ts` — single source of truth for team metadata (slug, name, hex, livery, logoSrc, carSrc). Resolves free-form `drivers.team` strings via an alias table ("Red Bull Racing"/"Audi" → canonical slug). Exposes `teamMeta(team)`, `teamHex(team)`, `ALL_TEAMS`.
- `drivers.ts` — `driverPortraitSrc(code)` / `driverHeadshotSrc(code)` (return null for codes outside the design canvas asset set), `driverCountry(code)`, `countryFlag(iso)`.
- `tracks.ts` — 12 stylized SVG track paths lifted from the design canvas, alias-resolved between OpenF1 short names and Jolpica `circuit_id`.

Reusable components in `src/components/`:
- `TopBar.tsx` — used on every authenticated screen. 7 tabs (Calendar / Predict / Lobby / Reveal / Standings / League / Profile) + a global **"How Scoring Works"** modal trigger (`ScoringHelp` client island, native `<dialog>`, mobile-visible — replaced the old "The Group · {season}" label) + user initial + sign-out. `ScoringLegend.tsx` now exports only `ScoringLegendBody` (the point-system content), rendered inside that modal. *(Phase 14 PR 1 restyled the shell to design_handoff_phase11 §9: bordered `?`-glyph trigger, 720px no-radius card, "Reference" caption + Boldonse "How scoring works" title + "ESC ✕" close, scrim `rgb(8 4 6 / .78)` + `blur(8px)` in `globals.css`; `ScoringLegendBody` dropped its own card chrome and its copy/sizing now match the §4 `screens-lobby.jsx` canvas verbatim.)*
- `TrackDiagram.tsx` — 200×120 SVG, alias-resolved, configurable size + stroke.
- `DriverPortrait.tsx` — image when asset exists, initial-letter avatar tinted with team hex when not.

Asset directory at `public/assets/{drivers,drivers-portrait,cars,logos}/` (~36MB). `src/middleware.ts` matcher excludes `/assets/` so they're served unauthenticated.

Boldonse line-height fix: a global `[style*="Boldonse"]` selector in `globals.css` adds 0.12em top padding + 1.05 line-height to absorb the font's deep ascenders. Use `data-tight` attribute to opt out (cinematic display titles).

Routes currently serving: `/`, `/join`, `/login` (split-layout cinematic Google button), `/auth/callback`, `/dashboard`, `/dashboard/predict`, `/dashboard/predict/round/[round]` (per-round session list), `/dashboard/predict/[eventId]`, `/dashboard/lobby` (weekend lock roster + progressive pick reveal), `/dashboard/lobby/round/[round]`, `/dashboard/league`, `/dashboard/standings`, `/profile` (supports `?welcome=1`; has Google-Calendar ICS sync panel), `/admin`, `/admin/results/round/[round]` (per-round admin overview), `/admin/results/[eventId]`, `/reveal` (show-reel index, grouped by round), `/reveal/[eventId]`, `/api/cron/sync-f1-data` (Bearer-gated), `/api/cron/fetch-results` (Bearer-gated), `/api/cron/refresh-jolpica-current` (Bearer-gated), `/api/cron/refresh-nudges` (Bearer-gated), `/api/calendar/[token]` (public, per-user opaque token — ICS feed), `/api/share/[eventId]/card.png` (public OG), `/api/test/sign-in-password` (non-prod only).

### Two-source data identity (Jolpica + OpenF1)

OpenF1 keys results by `driver_number` which F1 reassigns between seasons (#1 follows the WDC). **Never** join historical OpenF1 data on `driver_number` directly — the same number maps to different humans across years. Two stable identifiers in our schema:

- **`drivers.full_name`** + `src/lib/text/canonicalize.ts:canonicalizeName` — strips diacritics, lowercases, collapses whitespace. Used by `refreshNudges` to remap each OpenF1 session's `driver_number → our_id`.
- **`drivers.ergast_id`** (text, unique, nullable) — Jolpica/Ergast canonical id (`max_verstappen`, `norris`). Populated by `resolveDrivers(svc, season)` in the nightly sync. Used by all `historical_results` joins.

Same pattern for circuits: OpenF1's `events.circuit` short name (e.g. "Sakhir") and Jolpica's `events.ergast_circuit_id` (e.g. "bahrain") coexist; a small alias map in `resolveCircuits.ts` covers the few cases where neither circuitName nor locality matches.

### Jolpica historical layer (shipped 2026-04-28)

Lives entirely under `src/lib/jolpica/`:

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

`src/lib/results/fetchResults.ts` walks past events with an `openf1_session_key` and no `results` row, pulls `/session_result` from OpenF1, and runs the scoring pipeline via the new `writeResultsService` (admin-check-bypass; trust boundary is the `Bearer CRON_SECRET` on `/api/cron/fetch-results`). Manual admin entry stays the primary path — auto-fetch is a convenience. Also UPSERTs full classification rows into `session_classifications` for the standings page. **Phase 12:** the per-event core is extracted as `fetchResultForEvent` and is also reachable via the admin "Fetch from OpenF1" button; both honour the `results.source`/revealed freeze (see Phase 12 section).

### Standings (Track B, shipped 2026-04-28)

`/dashboard/standings` reads from `session_classifications` (migration `20260428110000`) and computes driver + constructor totals via `src/lib/standings/computeStandings.ts` using official 2026 F1 points (race 25/18/15/12/10/8/6/4/2/1, sprint 8/7/6/5/4/3/2/1). Empty state until the first race weekend fills the cache.

### Resend admin alerts (Track B, shipped 2026-04-28)

`src/lib/email/notifyAdmin.ts` is a thin Resend wrapper. Configured via `RESEND_API_KEY` + `ADMIN_EMAIL` (+ optional `RESEND_FROM`). Safe to call without configuration — returns `{sent: false, reason}` instead of throwing. Wired into the catch path of all three cron routes.

### Telemetry nudges (Phase 4 carry-over, shipped 2026-04-28)

Predict screen surfaces three signals under each chosen driver: last-5 form (`P1 · P4 · DNF · P2 · P3`), at-circuit podium count, and average grid→race delta for the season. Pure aggregation lives in `src/lib/nudges/computeNudges.ts` (12 unit tests). Cache table: `driver_nudges (event_id, driver_id, recent_form, at_track_podiums, quali_race_delta)` — see `supabase/migrations/20260428100000_driver_nudges.sql`. Filled by `src/lib/nudges/refreshNudges.ts` which walks OpenF1 `/sessions` + `/session_result` for the current and prior season. Cron at `/api/cron/refresh-nudges` rebuilds nudges for any event within the next 10 days **plus every session of the next upcoming round, however far away** (so a user picking for the next race weekend always has telemetry even when it's >10 days out). The window∪next-round union/dedupe/order is the pure, unit-tested `selectNudgeEventIds` helper (tests N14–N16). Idempotent. Vercel schedule wired in `vercel.json` (04:30 UTC daily, 30min after `sync-f1-data`). Last-5 form renders oldest→newest (latest rightmost) — the flip is render-side in `driver-picker.tsx`, the stored string stays most-recent-first.

### Phase 10 — changes.md (shipped 2026-05-18)

Six changes from `changes.md`, resolved interactively (decisions captured in the plan at `~/.claude/plans/`):

1. **New bucket scoring** (`src/lib/computeScores.ts`, 12 unit tests). Race/Quali: `5×exact + wrongSlotBucket(onPodiumWrongSlot) + (allThreeExact ? +3 : 0)`, where `wrongSlotBucket` is non-linear `{1→1, 2→2, 3→4}`; a driver off the podium scores 0. Sprint Quali/Race unchanged (P1 exact = 5 else 0). `ScoreBreakdown` columns reused (`slot_mismatches` now = on-podium-wrong-slot count). Apply retroactively with `bun --env-file=.env.local run scripts/recompute-all-scores.ts` (idempotent; re-runs `writeResultsService` over every `results` row). **Regression rule still applies** — `computeScores.test.ts` + the `admin-results` integration test track this.
2. **Lobby tab** (`/dashboard/lobby` + `/round/[round]`, `src/app/dashboard/lobby/**`, `src/lib/lobby/**`). Weekend-scoped: per session, a full participant lock-status roster (boolean only — never picks pre-reveal). Quali & Race additionally run a **progressive pick reveal** off the *scheduled* clock with fixed durations (Quali 60m, Race 90m): P3 picks at +1/3, P2 at +2/3, **P1 never shown here** (it belongs to the Reveal cinematic — once the session window ends a "P1 & results in the Reveal" CTA appears). Sprint sessions show roster only. **Security boundary:** the all-or-nothing `preds_select` RLS is *not* changed; Lobby data is served by `src/lib/lobby/loadLobby.ts` via the **service client**, which enforces slot gating in app code (`src/lib/lobby/revealGate.ts`, pure + unit-tested) and never reads P1 into the response. Cross-linked with Predict.
3. **Telemetry order flip** — see Telemetry nudges section above.
4. **ScoringLegend** (`src/components/ScoringLegend.tsx`) — systematic explainer of the new ruleset. *(Phase 13 / changes.md §8: relocated — `ScoringLegendBody` now renders inside the global TopBar "How Scoring Works" modal; the old Lobby + Predict-detail render sites and the `collapsible <details>` wrapper were removed.)*
5. **ICS calendar feed** — per-user opaque `users.calendar_token` (migration `20260518000000`, minted lazily by `enableCalendarSyncAction` in `profile/actions.ts`). Public route `/api/calendar/[token]` (added to `PUBLIC_PREFIXES`) emits a VCALENDAR (`src/lib/calendar/buildIcs.ts`, pure + 6 tests) of all current+next-season sessions, each with a 30-min `VALARM`. Stable `UID = {event.id}@f1-fantasy`. Profile page has the subscribe panel (`calendar-sync.tsx`). No new Google OAuth scopes.
6. **Next-round nudge coverage** — see Telemetry nudges section above.

Shared fixed-duration constants live in `src/lib/sessionDuration.ts` (Quali 60m, Race 90m; sprint values used only as ICS DTEND fallback).

### Phase 11 — Free Practice banner (changes.md §6, shipped 2026-05-18)

A "FREE PRACTICE — FORM GUIDE" banner on `/dashboard/predict/round/[round]`
(between the weekend hero and the session list) showing FP1/FP2/FP3 top-3 to
help users lock picks. **Practice is deliberately NOT in the schema** (the
`session_type` enum and `syncCalendar` filter stay scoring-only — practice
rows in `events` would pollute predict/lobby/standings/RLS/lock).

- **On-demand, no cron.** `src/lib/practice/loadPractice.ts` fetches OpenF1
  `/sessions?meeting_key` then `/session_result` + `/drivers` per completed
  FP, cached ~15 min via Next's Data Cache (`fetchJson` gained an optional,
  backward-compatible `init` arg carrying `{ next: { revalidate: 900 } }`).
  Each FP appears automatically ≤15 min after it ends; **best-effort** —
  every fetch is wrapped so an OpenF1 outage yields no banner, never a broken
  predict round page (the critical path).
- **Why not the results pipeline?** FP is read-only decoration; Quali/Race
  results are authoritative (drive `computeScores`, gate the reveal) and stay
  on the deliberate admin/cron path. Asymmetry is intentional.
- **Admin override wins.** `practice_overrides (season, round, fp_index,
  p1/p2/p3_driver_id)` (migration `20260518100000`, service-role only, no
  RLS). When a slot has a row it beats the live fetch (OpenF1 late/wrong/
  cancelled). Editor on `/admin/results/round/[round]`
  (`practice-overrides-form.tsx` + `practice-actions.ts`, gated by
  `currentAdmin()`). Drivers only — lap time shows only for OpenF1-sourced
  rows, `—` on an override.
- **Pure + tested:** `formatLapTime` (M:SS.mmm) and `parsePractice`
  (top-3 by position, cross-year-safe `driver_number → drivers.id` via
  `canonicalizeName`) — TDD'd, 11 unit tests. Driver mapping reuses the
  `refreshNudges.loadDriverMap` pattern; chip styling matches the existing
  P1/P2/P3 idiom (`teamMeta` hex, Geist Mono `data-tabular`).

### Phase 12 — admin OpenF1 result fetch + freeze (changes.md §7, shipped 2026-05-18)

Results for the 4 scoring session types can now be pulled from OpenF1
**on demand by the admin** (one click), not just the nightly cron.

- **Trigger = admin "Fetch from OpenF1" button** on `/admin/results/[eventId]`
  (`fetchFromOpenF1Action`, `currentAdmin()`-gated → `fetchResultForEvent`).
  No new cron (Vercel Hobby is daily-only); the 04:15 UTC `fetch-results`
  cron stays as a backstop. `fetchResultForEvent` is the extracted per-event
  OpenF1→`parsePodium`→`writeResultsService` helper, shared by the cron loop
  and the button.
- **`results.source` ('openf1'|'admin')** (migration `20260518110000`).
  Freeze rule (pure, unit-tested `src/lib/results/freezeResults.ts`
  `isResultsFrozenForAuto`): the OpenF1 path (`source='openf1'`) must NOT
  modify a row once it is `source='admin'` **or** the event is revealed —
  `writeResultsService` returns `{ok:true,scoresUpdated:0,frozen:true}`
  instead of overwriting. Admin manual entry passes `source='admin'` and
  always wins (the override). Before reveal an `openf1` row may still be
  refreshed (provisional → official).
- **Reveal stays admin-triggered.** The `preds_select` results fallback was
  lengthened **10 min → 1 hour** (same migration) so prompt fetching can't
  auto-spoil the curated cinematic; 1h is the forgot-to-reveal backstop.
  Composes with the admin-button trigger (the admin controls when
  `fetched_at` is stamped). The admin must run the reveal within 1h of
  fetching, else picks auto-unlock.
- Regression-tracked: `freezeResults.test.ts` (6 unit) + `results-source`
  integration (S1–S5) + the updated `reveal.test.ts` R3 (1h boundary).

### Phase 13 — "How Scoring Works" modal (changes.md §8, shipped 2026-05-18)

The scoring explainer is now a single global entry point. The shared
`TopBar` "The Group · {season}" label is replaced by a **"How Scoring
Works"** trigger (`src/components/ScoringHelp.tsx`, `"use client"` island,
mobile-visible) that opens a native `<dialog>` (`showModal`; backdrop +
focus-trap + Esc free; backdrop-click + ✕ close) rendering
`ScoringLegendBody`. Removed from the Lobby tab and Predict detail screen;
the `ScoringLegend({collapsible})` wrapper is deleted (no callers). TopBar
stays a server component (the trigger is the only client bit); the season
indicator is dropped (still shown on League/Standings). Dialog scrim + a
light reduced-motion-safe fade live in `globals.css`. Pure UI relocation —
no logic/test changes.

### Phase 14 — design-fidelity port (`design_handoff_phase11`, in progress)

Visual pass over the Phases 10–13 features. 9 PRs, one per phase, in BUILD
ORDER. Plan of record: `plans/design-handoff.md`; trackable phase breakdown +
session log in `plans/program-tracker.md` "Phase 14". UI-only.

**PR 1 — §9 + §4 (shipped 2026-05-18).** `ScoringHelp.tsx` modal shell rebuilt
to README §9 prose (no canvas artboard exists for it): bordered transparent
trigger with a 16px circular `?` glyph, native `<dialog>` kept (top-layer /
focus-trap / Esc beat a `useState` overlay), 720px card with **no
border-radius**, header = "Reference" caption + sentence-case Boldonse 32px
`line-height:0.9` "How scoring works" + "ESC ✕" bordered close, body padding
`--space-2xl`. `globals.css` `dialog::backdrop` → `rgb(8 4 6 / 0.78)` +
`backdrop-filter: blur(8px)`. `ScoringLegend.tsx` `ScoringLegendBody` dropped
its own surface/border/radius chrome (the modal supplies it) and `Section`/
`RowList` now match `design_handoff_phase11/design/screens-lobby.jsx`
`LegendSection` (Boldonse 13/0.04em headings, 12px subtitles, tokenized
margins). §4 copy is now verbatim-locked to that canvas — TDD'd via
`src/components/ScoringLegend.test.tsx` (**SL1–SL4**, jsdom + RTL; the
project's first `src/components/*.test.tsx`). Token-only spacing throughout
(28→`--space-2xl`, 7→`--space-xs`, 14→`--space-lg`, ≤4px tolerance).
Gotcha: the owner-dropped `design_handoff_phase11/` JSX bundle is now eslint-
ignored (mirrors the existing `design/**` ignore — canvas reference, not
source).

**PR 2 — §1 Lobby redesign (shipped 2026-05-19).** Each scoring session is a
compact preview card by default (4-col grid: Boldonse label + server-
preformatted time, `phaseLine` status, per-friend lock dots, `N/M LOCKED ·
Expand ▾`); tapping one expands it (one at a time) into a 3-column
`ParticipantBlock` grid. `lobby-view.tsx` stays a **server component**
(hero + `formatLocal`/`formatDateRange` run server-side, zero hydration);
the expand/collapse `useState` lives in a small client island
`lobby-sessions.tsx` that receives the session time already formatted as a
string — SSR and hydration render identically. *(Gotcha lesson: a naive
"add `use client` to the whole view" caused a hydration mismatch because
`formatLocal` is timezone-aware — server UTC vs browser TZ. The
server-component + client-island split with a server-preformatted
`timeLabel` string is the fix; never recompute locale/TZ-sensitive strings
in a component that both SSRs and hydrates.)* Phase-line copy + tone are
unit-locked (`src/lib/lobby/phaseLine.ts`, PL1–PL5). `loadLobbyWeekend`
gained a defensive `session_type` allowlist (FP isn't in the schema) and
its gated `LobbySlotPick` now also carries `lastName` + `team` (same
reveal-authorised data class — never P1) so the mini-card can show the
DriverPortrait + team-colour border. **Red Bull livery hex is now
`#4A77DB`** (`teams.ts` + `globals.css --team-redbull`/`-hex`), bumped for
dark-bg accessibility per the handoff; regression-locked by `teams.test.ts`
D26. (Supersedes the Phase 8 A2 `#3671C6` and the older `#1E2A6E`.)

**PR 3 — §11 Predict last-5 form-strip (shipped 2026-05-19).** The
recent-form pip colour is now a pure `src/lib/nudges/formColor.ts`
`formPillColor(token)` (extracted from an inline copy in
`driver-picker.tsx`), unit-locked **L5-1..L5-4**: DNF/DNS/DSQ/— →
`--error`, P1–P3 → `--success`, P4–P10 → `--fg`, else → `--fg-subtle`
(fixes a latent `--fg-muted` regression on the "else" bucket). The strip
itself (`driver-picker.tsx`, predict-detail telemetry panel) now matches
README §11 anatomy: pips are colour-of-text only (no per-pip bg tint),
Geist Mono 11px 600, `min-width:24` centred, `padding:2px 5px`; the latest
(rightmost) pip gets a `var(--surface-2)` + `1px var(--border)` box; a tiny
`↑ LATEST` tag (Geist Mono 8px 0.1em `--fg-subtle`) sits at the right edge.
The most-recent-first→`.reverse()` flip (changes.md §2) was already correct
and is unchanged. (Note: the canonical file is
`src/app/dashboard/predict/driver-picker.tsx`, shared by the `[eventId]`
route — the plan's `…/[eventId]/driver-picker.tsx` path was stale.)

**PR 4 — §10 Reveal FriendCard bucket math (shipped 2026-05-19).** The §4
scoring rule is now single-sourced: `computeScores.ts` exports
`wrongSlotBucket(n)` ({0→0,1→1,2→2,3→4}) and a new pure
`slotOutcome(pick, actual, pos)` → `"exact" | "onPodium" | "miss"`;
`computeScore` was refactored to consume `slotOutcome` (behaviour-preserving
— the 12 original scoring tests stay green as the gate), and the reveal
`FriendCard` reads the *same* helpers so points and badges can never
disagree (kills the design-handoff failure-mode of re-deriving the rule
inline). `FriendCard` (`reveal-stage.tsx`) now takes the actual `result`
and renders, per README §10: per-row badges (`✓ Exact +5` `--success` /
`⊙ On podium` `--warning` / `× Miss` `--fg-subtle`); a dashed
`--surface-2` bucket-tally row (`{n} on podium (wrong slot) bucket` /
`+{wrongSlotBucket(n)}` `--warning`) only when `slot_mismatches>0 &&
exact_matches<3`; a `★ Perfect Podium · +3 bonus` pill (replaces the old
"Perfect podium"); and the card score as Boldonse 32px coloured by tier
(`≥10 → --success`, `>0 → --fg`, `0 → --fg-subtle`). Reveal motion
choreography untouched (`FriendCard` is plain markup inside the existing
`FlipCard` motion wrapper). Helper coverage: `computeScores.test.ts` +4
(wrongSlotBucket + slotOutcome exact/onPodium/miss).

**PR 5 — §3 Show Reel redesign (shipped 2026-05-19).** `/reveal` index
(`src/app/reveal/page.tsx`, server component) tightened to the canvas
(`screens-lobby.jsx` ShowReelScreen): hero caption Geist Mono 11px/0.18em;
title `Show`/`Reel` Boldonse `clamp(56px,9vw,120px)` `data-tight`
`line-height:0.86` `-0.025em`; subtext 14px/1.6/maxW420; right meta Geist
Mono 11px/0.12em (verbatim `{r} rounds · {s} sessions · {p} perfect
podium` — always plural rounds/sessions, singular podium); big total
Boldonse `clamp(40,5vw,56)` **`--accent`** + `pts so far` Geist Mono 16px.
Round rows: 7-col `60px 80px 36px 1fr auto auto auto`, `TrackDiagram`
80px, flag 24px, GP Boldonse 20px/1.05/0.005em, `Latest …` 0.12em, session
pills `padding:6px 12px`, round total `Σ +{n}` Boldonse 22px (`≥10 →
--accent` else `--fg`, `min-width:80`, `aria-label="Total"`). Empty
`NO REVEALS YET` block unchanged. Session-pill accent fill % extracted to
pure `src/lib/reveal/pillFill.ts` (perfect→28 / ≥10→18 / else→10),
unit-locked **SR1–SR3**.

**PR 6 — §5 Profile calendar-sync panel (shipped 2026-05-19).**
`src/app/profile/calendar-sync.tsx` rebuilt to the canvas
(`screens-auth.jsx`): 2-col `grid 1fr auto` (`gap`/`padding`
`--space-2xl`, no border-radius). Left = `Sync to Google Calendar`
Boldonse 16/0.04em + `Beta · uses your Google account` pill (Geist Mono
9/0.14em, `--surface-2`/`--border`/`--fg-subtle`); body copy with bold
`30 minutes before`; on reveal the ICS URL field (`--surface-2`, Geist
Mono 11, truncate, accent `Copy`→`Copied` 2s) + 3-step decimal `<ol>`
(accent "Other calendars → From URL" link kept functional, `Add calendar`
in `--fg`). Right = 240px-min `--surface-2` card: 44px calendar+clock SVG
(rect + accent clock), stats `{events} events · {sessions} sessions /
30-min lock alarms` (Geist Mono 10/0.14em), `Show my calendar link` CTA
(Geist Mono 11/600, `--accent`/#000) → `enableCalendarSyncAction`
(mint-if-absent then reveal). **Real counts:** `profile/page.tsx` now
counts the exact `events` set the ICS feed covers (`season in [year,
year+1]`) → distinct `(season,round)` = events, total = sessions, passed
as props (no schema change). The dead `hasToken` prop was dropped (per §5
the CTA copy never branches on it). Pure-visual PR — no new unit tests
(decided with owner); verified by Playwright (initial + revealed) +
182/182 suite green.

**PR 7 — §6 Predict-list FP banner (shipped 2026-05-19).**
`src/components/PracticeBanner.tsx` rebuilt to the canvas
(`screens-aux.jsx` FpResultsBanner): framed `--surface` section (1px
`--border`, **no border-radius**, `overflow:hidden`); header strip
(`--surface-2`, bottom-bordered) = `Free Practice · pace check` Boldonse
14/0.04em + `Source: OpenF1` micro-pill + right copy
`Top-3 fastest · use to gauge form before locking` (→
`Sprint weekend · FP1 only` when `sessions.length<=1`); body =
`repeat(N,1fr)` grid (1px `--border` dividers); per column a header
(label Boldonse 13 + server-formatted session time) and 3 podium rows
(grid `32px auto 1fr auto`, `--surface-2`, **3px team-colour left
border** — sanctioned prediction-row idiom, P1 label `--accent`,
`DriverPortrait` 28). Lap cell is the pure
`src/lib/practice/lapCell.ts` (unit-locked **FP-L1..FP-L4**): leader →
absolute `formatLapTime`, non-leader → `+gap`, admin override → `OVR`
(`--warning`), OpenF1-no-time → `Awaiting` (`--fg-subtle`). Per README
§6 the old footer/legend strip is **removed**. `FpSession` gained a
server-formatted `startLabel` (TZ-safe — formatted in `loadPractice`
from the OpenF1 `date_start`, never recomputed client-side; null only if
no OpenF1 session). The banner now mounts **above** the weekend hero on
`/dashboard/predict/round/[round]` (was below). Verified live: FP1/FP2
OpenF1 cells + a seeded FP3 override → OVR.

**PR 8 — §7 Admin OpenF1-fetch banner (shipped 2026-05-19).** New
`src/app/admin/results/[eventId]/openf1-banner.tsx` (client island)
mounted **above** the manual-entry form, per canvas `screens-aux.jsx`
`OpenF1FetchBanner`: a 4-state banner (idle / provisional / official /
revealed) — tone radial-gradient wash `.05`, 3-col `auto 1fr auto`,
status dot + tag, Boldonse 18 title, sub copy **verbatim** from the
canvas, Geist Mono CTAs. State is the pure
`src/lib/results/bannerState.ts` `openF1BannerState({revealed,
hasResults, source})` (unit-locked **BS1–BS4**: revealed wins → no
results = idle → `source='admin'` = official → else provisional),
derived server-side in `page.tsx` (results query extended with `source,
fetched_at` — columns already exist, no schema change). CTAs reuse
existing actions (`fetchFromOpenF1Action` for Fetch/Refetch,
`revealEventAction` for Reveal, "Edit manually" anchors `#manual-entry`)
plus a **new** `acceptAsOfficialAction` (currentAdmin()-gated; flips a
provisional row `source` `openf1`→`admin` without touching the podium →
frozen via the Phase-12 rule; revealed/already-official/no-row are
no-ops). **Honesty note:** the canvas's `meta`/`sub` strings embed
fabricated demo data ("6h ago", "session_key 9621", "cron in 4h 12m") —
tag/title/instructional sub are rendered verbatim, but the meta line is
**server-derived from real `fetched_at`/`revealed_at`** and the
fabricated time clauses are dropped (truth over fixture, per the PR 5/6/7
precedent). Freeze consequence of `acceptAsOfficial` is already covered
by `results-source` S1–S5 + `freezeResults`.

Design context (fonts, palette, principles, anti-patterns) lives in `.impeccable.md` at the project root.

`plans/` is gitignored — it holds the project owner's local planning artifacts (program tracker, master plan, dated session logs). If you need historical scope context that isn't reflected in the current code or commit history, ask the project owner.

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

Fallback: if admin forgets, RLS auto-unlocks **1 hour** after `results.fetched_at` (was 10 min — lengthened in Phase 12 so the admin "Fetch from OpenF1" button can't auto-spoil the cinematic). See the RLS block in the plan for the exact policy.

This solves the "solo reveal" problem — without a trigger, each friend hits `/reveal` at a different time and experiences the animation alone.

### 3. Admin privilege lives in `admins`, not `users`

Separate `admins` table with `user_id` FK. Check via `EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())`. Do NOT add an `is_admin` column to `users` — Supabase RLS policies self-referencing `users` is a known recursion footgun.

Admin bootstrap: `INSERT INTO admins (user_id) VALUES ('<your uuid>');` in the Supabase SQL editor after first login. Never ship a UI for granting admin.

### 4. Score computation in app code, not a DB trigger

`lib/computeScores.ts` runs from the server path that writes `results` (both the OpenF1 cron fetcher AND the admin manual-entry endpoint call it). Pure function, unit-tested in isolation. Pseudocode is in the plan.

Idempotent via `INSERT ... ON CONFLICT (user_id, event_id) DO UPDATE`. Safe to re-run.

**Scoring (Phase 10 / changes.md §4):** Race/Quali = `5×exact + wrongSlotBucket(onPodiumWrongSlot) + (allThreeExact ? +3 : 0)`, `wrongSlotBucket = {1→1, 2→2, 3→4}`. A predicted driver not in the classified P1/P2/P3 scores 0 for that slot (DNF rule — never "right driver wrong slot" unless the driver is on the podium). Max per race/quali event: 18 pts. Sprint events only score P1 (exact = 5, else 0; max 5 pts). See the Phase 10 section above for the recompute script.

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
- Don't let RLS leak predictions before `revealed_at` (or the 1-hour results fallback). The reveal IS the product.
- Don't auto-refresh a running race's results into the UI mid-session. Results only land post-session.
- Don't add left-border stripes to cards for visual accent. Use tinted surface-lift or subtle borders.
- Don't import F1 team logos from formula1.com without a second thought — trademarks. OK for the private friend league, risky if it ever opens up. Default to color-dot + 3-letter code pattern (see `.impeccable.md`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
