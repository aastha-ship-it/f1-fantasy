# F1 Fantasy — Program Tracker

**Source docs:** `plans/flickering-giggling-valley.md` (master), `plans/2026-04-18-f1-fantasy.md` (CEO), `plans/aasthakataria-unknown-eng-review-test-plan-20260418-170000.md` (test plan), `.impeccable.md` (design), `CLAUDE.md` (repo guide).

**Last updated:** 2026-04-19 · **Owner:** Aastha · **Reviews cleared:** CEO · Codex · Eng · Design

---

## Session log

**2026-04-20 (evening) — Phase 3 shipped.** 32/32 tests green (added I9 non-admin block, I10 admin-writes-results pipeline, I10b sprint-variant validation). Typecheck + lint + build all clean. New routes: `/admin`, `/admin/results/[eventId]`, `/api/cron/sync-f1-data`.

Delivered:
- `src/lib/writeResults.ts` — pipeline orchestrator. Caller auth check, admin check via `isAdmin(svc, uid)`, event lookup, sprint-vs-race shape validation, UPSERT `results` on `event_id`, walk every prediction for the event (service-role read bypasses RLS), `computeScore` per prediction, UPSERT `scores` on `(user_id, event_id)`. Final pass: `recomputeStreaksFor(userId)` walks the user's entire scoring history in chronological order and UPSERTs fresh streak counters — makes the whole chain idempotent end-to-end.
- `src/lib/adminGuard.ts` — `isAdmin(svc, uid)` + `currentAdmin()` helper for server components.
- `src/lib/supabase/service.ts` — service-role client factory (server-only; throws if imported into Edge).
- `src/app/admin/page.tsx` — operations list bucketing sessions into "Awaiting results" / "Ready to reveal" (Phase 4 trigger lands there) / "Revealed".
- `src/app/admin/results/[eventId]/{page,actions,results-form}.tsx` — admin form. Non-admins see a 403-style copy.
- `src/lib/sync/{syncCalendar,syncDrivers,openf1}.ts` — refactored the existing seed-script logic into importable functions so both the CLI scripts AND the cron route call the same code path.
- `src/app/api/cron/sync-f1-data/route.ts` — `Bearer $CRON_SECRET` gated handler, runs both syncs, returns JSON summary. Verified 401 on missing/wrong token.
- `src/middleware.ts` — added `/api/cron/` to PUBLIC_PREFIXES so Vercel cron (no user cookies) isn't bounced to /join before the route's token check runs.

Gotchas solved:
- **Supabase builder overload.** `.update().select("id", { count: "exact", head: true })` is rejected by the JS client's TS types. Switched to `.select("id")` and used `data?.length` for the deactivation count.
- **Streak idempotency.** Naive "increment on each score-write" double-counts if results are re-filed. Solution: on every score write, re-derive the user's streak counters by walking ALL their scores + events + predictions + results in chronological order. Pure function of DB state.

**2026-04-20 (PM) — Phase 2 shipped + small refactor.** Initial page had defaulted to the earliest unlocked session, which is Miami sprint_quali (correctly P1-only) — but the user wanted access to the main race's 3-slot picker. Split predict into a list route at `/dashboard/predict` (upcoming sessions grouped by round) and a picker at `/dashboard/predict/[eventId]`. 29/29 tests green (U1-U12, I1-I8, I5b, I8b, I8c). Typecheck clean, lint clean, build clean, all four routes serving (`/`, `/join`, `/login`, `/auth/callback`, `/dashboard`, `/dashboard/predict`).

Delivered:
- `src/lib/submitPrediction.ts` — pure pipeline: auth → event lookup → lock fast-fail → active-driver validation → UPSERT idempotent (on `(user_id, event_id)`). Trigger-based LOCKED rejection translated from the DB error string so racing-past-the-fast-fail surfaces the same error code.
- `src/app/dashboard/predict/actions.ts` — thin server-action wrapper calling `submitPredictionWith(cookieBoundClient)`.
- `src/app/dashboard/predict/lock-countdown.tsx` — client component, ticks every 250ms, three phases (normal / warning / closed) with tabular figures and 2Hz opacity pulse gated by `prefers-reduced-motion`.
- `src/app/dashboard/predict/driver-picker.tsx` — 3-slot (or 1-slot for sprints) picker, dropdown per slot, "Change pick" ghost button, sticky lock bar, distinct-driver validation UI, swap-on-conflict behavior.
- `src/app/dashboard/predict/page.tsx` — server component: fetches next unlocked event, active drivers, user's existing pick via RLS-scoped client.
- Dashboard CTA linking to `/dashboard/predict`.

Gotcha fixed during Phase 2:
- **Vitest file parallelism vs. local Supabase.** Two integration test files sharing one DB ran in parallel, and each file's `beforeEach(resetTestData)` raced with the other's in-flight tests — so 8/23 tests started failing once `predictions.test.ts` joined `rls.test.ts`. Set `test.fileParallelism: false` in `vitest.config.ts`. Runs single-threaded now. (`poolOptions.threads.singleThread` is rejected by Vitest 4's config TS types — fileParallelism alone suffices.)
- **React purity rule.** `Date.now()` called in a server component triggers `react-hooks/purity` lint error. Moved the "is closed" check from server render into the picker's client-side effect (it already ticks via `useEffect` for the countdown anyway).

**2026-04-20 — Auth flow manually verified end-to-end.** `/join` → invite cookie set → `/login` → magic link arrives in Mailpit → click → `/auth/callback` exchanges code → session cookie set → lands on `/dashboard` with the seeded next-session card. Admin row inserted for Aastha (`4f6cc62f-0194-44c9-8a69-c271ca6f1ff5`). Two follow-up fixes:
- **Supabase redirect allowlist.** `supabase/config.toml` originally had only `https://127.0.0.1:3000` in `additional_redirect_urls`, so Auth silently stripped our HTTP `emailRedirectTo` and fell back to bare site_url. Fixed by adding `http://127.0.0.1:3000/**`, `http://localhost:3000/**`, `https://127.0.0.1:3000/**`.
- **Tailwind v4 spacing hijack.** Aliasing our custom `--space-*` tokens into `--spacing-*` in `@theme inline` collapsed `max-w-xl` to 24px (among other width utilities). Tailwind v4's `--spacing-*` namespace is shared across every size-based utility — removed the aliases; use `var(--space-lg)` or `p-[var(--space-lg)]` directly when semantic names are needed.

**2026-04-19 — Phases 0 + 1 shipped.** 23/23 tests green (12 unit U1-U12 + 11 integration: I6, I7, I8 plus 5 regression guards). Build clean, typecheck clean, lint clean.

Gotchas discovered and documented:
- **Generated column rejected.** Postgres 17 refuses `timestamptz - interval '5 seconds'` in a STORED generated column (mutability check). Migration falls back to a BEFORE INSERT/UPDATE trigger on `events` that maintains `lock_at` — behaviorally equivalent. See `supabase/migrations/20260419150000_init_schema.sql`.
- **Multiple PERMISSIVE SELECT policies don't reliably OR through PostgREST.** Two separate policies (`preds_select_own_always` + `preds_select_others_after_reveal`) — matched in raw SQL, but through the Supabase JS client, only the first-listed policy fired. Collapsed into a single `preds_select` policy with explicit OR. Integration test I7 caught this.
- **OpenF1 data shape:** Bahrain and Saudi 2026 both flagged `is_cancelled: true`. Pre-season testing rounds appear in `/meetings`. Seed script handles both. Rate-limited aggressively; seeder throttles 350ms with exponential backoff on 429.
- **`bun test` ≠ Vitest.** `bun test` runs Bun's native test runner. Use `bun run test` to route through Vitest.
- **Local Supabase ports shifted +100** (DB :54422, API :54421, Studio :54423) to coexist with `stockly-app`.

Follow-ups queued for Phase 2+:
- Admin bootstrap row in `public.admins` (blocked on Aastha's first real magic-link sign-in)
- `bunx playwright install chromium` (deferred to Phase 5)
- `bunx shadcn@latest init` (deferred to Phase 2 when Dialog/Button are needed)
- Vercel preview deploy (deferred to Phase 6)
- Rerun `bun run latency` after Miami for a real cron-strategy decision

---

## Mission

Private P1/P2/P3 prediction league for ~5–10 F1-fan friends. Season-long championship whose emotional peak is the **admin-triggered reveal** where everyone's locked picks flip simultaneously on `/reveal/[eventId]`.

## Hard deadline

**Miami GP weekend — Friday qualifying, 2026-05-02.** First usable weekend. Slip = next usable weekend is Monaco (2026-05-25).

- Today: 2026-04-19
- Phases 0–5 must be exit-criteria-complete before Phase 6 (Ship) begins. Phase 6 itself needs to land before Friday qual.
- Cut order if slipping (in Phase 4/5 only): telemetry nudges → share-card PNG → streak tracker. **Never cut the reveal animation or the test suite.**

## Current status

**Phase 0 complete. Phase 1 complete. Phase 2 not started.**

Next.js 16 + Supabase local stack are live. All Phase 0–1 automated tests are green (23/23 so far: U1–U12 + I6/I7/I8 plus regression guards).

- Working directory: Next.js 16.2.4 app scaffolded (TypeScript, Tailwind v4, App Router, `src/` dir, `bun` package manager)
- Local Supabase running on shifted ports (+100 from default) to coexist with `stockly-app`: API `:54421`, DB `:54422`, Studio `:54423`. See `supabase/config.toml`.
- Schema, RLS policies, and both triggers applied via three migrations in `supabase/migrations/`.
- Calendar seeded: 24 meetings · 56 scoring events (sprint_quali + sprint_race + quali + race). Bahrain and Saudi Arabia 2026 both flagged `is_cancelled` by OpenF1 — seeder correctly skipped them.
- Drivers seeded: 22 active, from OpenF1 session `11253` (Japanese GP).
- Auth gate live: `/join` → invite cookie (HMAC of `INVITE_CODE` with service-role as secret) → `/login` → magic link → `/auth/callback` → mirrors user into `public.users`. Middleware enforces both cookies on every non-public path.
- `lib/computeScores.ts`, `lib/validatePrediction.ts`, `lib/validateInviteCode.ts` implemented and unit-tested.

**Phase 0 latency-gate outcome:** INCONCLUSIVE with useful bound. Most-recent non-cancelled race is Japan (21d old) — results ARE present for it, but we can't measure first-appearance latency from such an old session. Cron strategy: **manual admin entry primary** for Miami; rerun `bun run latency` post-Miami to refine and decide whether to wire auto-fetch for Monaco.

---

## Phase tracker

Six phases, executed in order. Each phase has a goal, deliverables, exit criteria (what must be true to advance), and attached tests. Do not start Phase N+1 until Phase N's exit criteria are green.

### Phase 0 — Foundation & Gates · ☑

**Goal:** Greenfield to a running dev loop with invite-gated auth and a settled cron strategy.

**Deliverables**
- [x] `scripts/openf1-latency.ts` run → cron strategy chosen (manual-primary; rerun post-Miami)
- [x] `bunx create-next-app@latest` with TypeScript + Tailwind v4 (Next.js 16.2.4, React 19)
- [x] Local Supabase running (ports +100 to avoid clashes); env vars wired in `.env.local`; Resend deferred
- [x] Vitest + Playwright installed; F1-themed Tailwind theme in place via `globals.css` + `@theme inline`
- [x] `/join` invite-code gate + `/login` magic-link flow end-to-end (HMAC-signed invite cookie + Supabase OTP)
- [ ] Vercel preview deploy (deferred to Phase 6 per session plan)

**Exit criteria (session-1 scope):** a stranger with the invite code can reach an empty dashboard via magic link in local dev. Cron strategy documented. ✓

**Tests attached:** U11 (wrong code) · U12 (correct code) — both ✓ green

**Gate decision — cron strategy** (blocks Phase 3 auto-fetch wiring):
- Latency < 30 min → one-shot cron at `session_end + 30m`
- Latency < 4h → hourly cron for ~4h post-session
- Midnight-only refresh → skip auto-fetch, manual admin entry only
- **CURRENT DECISION:** inconclusive data (most-recent non-cancelled race is 21d old). Ship Miami with manual-only; rerun after first real race to refine.

---

### Phase 1 — Data Foundation · ☑

**Goal:** Schema, RLS, and seeded calendar/drivers in place. Lock boundary is unbreakable.

**Deliverables**
- [x] All tables per master plan: `users`, `drivers`, `events`, `predictions`, `results`, `scores`, `user_streaks`, `admins`
- [x] `events.lock_at` maintained by BEFORE trigger (Postgres 17 refused the STORED generated-column form due to an over-strict immutability check; trigger is behaviorally equivalent and documented in the migration)
- [x] RLS policies live: users select-all / update-own · predictions select-own-always + select-others-after-reveal (with 10-min fallback) · `admins` service-role-only writes · **no `users.is_admin` column exists** (I8 regression test guards this)
- [x] `predictions_lock_guard` trigger (BEFORE INSERT/UPDATE → reject if `now() > lock_at`)
- [x] `scripts/seed-calendar.ts` with throttle + pre-season-testing filter — 24 meetings / 56 scoring events seeded for 2026
- [x] `scripts/seed-drivers.ts` — 22 active drivers seeded from latest OpenF1 race session
- [x] `admins` bootstrap row for Aastha (`4f6cc62f-0194-44c9-8a69-c271ca6f1ff5`, granted 2026-04-20)

**Exit criteria:** 24 race weekends seeded ✓ · I6/I7/I8 pass against local Supabase ✓ (5/5 green).

**Tests attached:** I6 (RLS hides picks pre-result) ✓ · I7 (RLS shows after reveal) ✓ · I8 (no `is_admin` column exists — regression) ✓ · I8b (non-admin can't INSERT into `admins`) ✓ · I8c (non-admin UPDATE on `admins` returns 0 rows via RLS) ✓

---

### Phase 2 — Prediction Loop · ☑

**Goal:** Friends can pick P1/P2/P3, watch the countdown, and submit before the lock bell.

**Deliverables**
- [x] `/dashboard/predict` lists all upcoming scoring sessions grouped by round (sprint_quali → sprint_race → quali → race per weekend), "Picks in" badge when user has already submitted for a session
- [x] `/dashboard/predict/[eventId]` is the actual picker — 3-slot for race/quali, P1-only for sprint_quali/sprint_race
- [x] Lock countdown hero with urgency treatment at T-60s (amber, 2Hz pulse, banner per `.impeccable.md` §Lock Countdown)
- [x] Submit auto-disables at T-0, closed-state banner shows; late submits are server-rejected too
- [x] `submitPredictionWith(client, input)` fast-fails on `now() >= lock_at` before hitting the DB; DB trigger is the ultimate guard
- [x] Timezone-aware countdown via `Intl.DateTimeFormat`
- [x] Sprint variant hides P2/P3 entirely (not empty placeholders)
- [x] Duplicate-driver-across-slots UI guard (distinct picks enforced in picker + test I5b)
- [x] Dashboard CTA "Lock in your picks →" linking to `/dashboard/predict`

**Exit criteria:** A pick submitted before lock lands ✓ · submit at T-4s and T+1s are both rejected ✓ · double-submit idempotent ✓.

**Tests attached:** U8 ✓ · U9 ✓ · U10 ✓ (from Phase 1) · I1 ✓ happy-path · I2 ✓ past-lock fast-fail · I3 ✓ session-started rejection · I4 ✓ unauthenticated · I5 ✓ UPSERT idempotent · I5b ✓ sprint-extra-slots validation guard.

---

### Phase 3 — Results & Scoring · ☑

**Goal:** Results land (auto if viable, manual always), scores compute, DNF rule enforced, idempotent.

**Deliverables**
- [x] `lib/computeScores.ts` — DNF-aware, sprint-aware, pure function (Phase 1)
- [x] `lib/writeResults.ts` — admin-guarded pipeline: UPSERT `results` → iterate predictions → UPSERT `scores` → recompute `user_streaks` per affected user (idempotent, walks history in chronological order)
- [x] `/admin` operations dashboard — past sessions bucketed by results status (awaiting / ready-to-reveal / revealed)
- [x] `/admin/results/[eventId]` — admin-gated manual entry form (three driver dropdowns, 1 for sprints) wired to `fileResultsAction`
- [x] `src/lib/sync/{syncCalendar,syncDrivers,openf1}.ts` — shared sync primitives, refactored out of the CLI scripts so CLI + cron share code
- [x] `/api/cron/sync-f1-data` — Bearer-token gated route handler that runs the nightly reconciliation. Verified 401 on unauthorized calls. Vercel cron config deferred to Phase 6.
- [ ] Resend email alert on fetch failure — **deferred** per session-1 decision; `/api/cron/sync-f1-data` currently console-logs errors and returns 500 JSON
- [ ] `/api/cron/fetch-results` — **skipped** per Phase 0 latency gate (manual admin entry is primary path; rerun latency after Miami race to revisit)

**Exit criteria:** I9 + I10 green ✓. Seeded completed-event fixture → scores + streaks populated per U1–U7 ✓. Re-running produces identical row counts + values ✓. Sprint event rejects race-shape results ✓.

**Tests attached:** U1–U7 ✓ (Phase 1) · I9 ✓ non-admin ADMIN_REQUIRED · I10 ✓ admin writes results → scores + streaks + idempotent · I10b ✓ sprint variant validation guard.

---

### Phase 4 — The Reveal & Leaderboard · ☐

**Goal:** The emotional peak. Admin triggers a coordinated reveal; the leaderboard tells the season story; streaks accumulate; telemetry nudges inform picks.

**Deliverables**
- [ ] `/admin` reveal-trigger UI — "Results in → Reveal to group" button that sets `events.revealed_at`
- [ ] `/dashboard` smart home — state-aware (upcoming → predict card, post-session pending → reveal-waiting card, else leaderboard)
- [ ] `/dashboard/standings` — driver + constructor standings from nightly OpenF1 sync
- [ ] `/dashboard/league` — friend leaderboard, streak badges, per-user breakdown on click
- [ ] Telemetry nudges: `driver_nudges` cache + nightly prep cron + display on all 3 slots of predict screen
- [ ] `/reveal/[eventId]` — Framer Motion rotateY flip choreography (result cards 300ms ea / 200ms stagger → 400ms beat → friend picks 150ms stagger)
- [ ] `prefers-reduced-motion: reduce` → instant final state
- [ ] 10-min RLS auto-unlock fallback tested (admin-forgot path)

**Exit criteria:** E3 + E4 pass. Admin can trigger reveal and the group sees the coordinated animation. Pre-trigger, friends see "Results are in. Reveal opens shortly." screen.

**Tests attached:** E3 (predict → lock → reveal flow) · E4 (reduced-motion path)

---

### Phase 5 — Virality & Polish · ☐

**Goal:** Production-grade look, shareable artifacts, responsive, wireframe refinements applied.

**Deliverables**
- [ ] `/api/share/[eventId]/card.png` — Next.js OG ImageResponse, 1200×630, reveal-gated, `revalidate: 3600`
- [ ] `/profile` — display name, favorite team, favorite driver, favorite past driver
- [ ] F1-themed styling pass across all screens per `.impeccable.md`
- [ ] Wireframe refinements applied:
  - Reveal: cut fastest-lap orphan · share button inline with "THE GROUP" header · perfect-podium red border (not gradient background)
  - Leaderboard: rank column 80→60px · emoji font-stack fallback for 🔥
  - Predict: hero `clamp(40px, 4.5vw, 72px)` · "Change pick" → ghost button · telemetry on all 3 slots
- [ ] Responsive tuning (desktop + phone, touch targets ≥44×44px)
- [ ] Visual QA against the three reference wireframes in `plans/designs/`

**Exit criteria:** E1 + E2 pass. Manual visual pass against all three wireframes signs off.

**Tests attached:** E1 (full signup flow) · E2 (invalid invite code negative path)

---

### Phase 6 — Ship · ☐

**Goal:** Friends playing live.

**Deliverables**
- [ ] Full 29-path test suite green against seeded completed-event fixture
- [ ] Failover drill — simulate OpenF1 outage, verify manual admin path carries the whole flow end-to-end
- [ ] Friend emails collected (5–10) · invite code shared in group chat
- [ ] Vercel production deploy
- [ ] Production smoke test: `/join` → magic link → predict a real upcoming event
- [ ] Nightly `sync-f1-data` cron confirmed active

**Exit criteria:** Miami Friday qual opens with friends submitting real predictions. Post-race Sunday, the reveal plays for the group.

**Tests:** all 29 paths must be passing.

---

## Screens tracker (11 routes)

| Route | Purpose | Built | QA’d |
|---|---|---|---|
| `/join` | Invite-code gate | ☐ | ☐ |
| `/login` | Magic-link email | ☐ | ☐ |
| `/profile` | First-time setup | ☐ | ☐ |
| `/dashboard` | State-aware home | ☐ | ☐ |
| `/dashboard/standings` | Driver + constructor standings | ☐ | ☐ |
| `/dashboard/league` | Friend leaderboard + streaks | ☐ | ☐ |
| `/dashboard/predict` | P1/P2/P3 picker + lock countdown | ☐ | ☐ |
| `/event/[id]` | Event detail | ☐ | ☐ |
| `/reveal/[eventId]` | Cinematic flip — **the product** | ☐ | ☐ |
| `/api/share/[eventId]/card.png` | OG image | ☐ | ☐ |
| `/admin/results/[eventId]` | Manual result entry | ☐ | ☐ |
| `/admin` (reveal trigger) | Admin dashboard | ☐ | ☐ |
| `/api/cron/fetch-results` | OpenF1 fetcher (if latency allows) | ☐ | ☐ |
| `/api/cron/sync-f1-data` | Nightly calendar + driver sync | ☐ | ☐ |

---

## Test coverage tracker — 29 paths

**Coverage target: 100%. Nothing skipped. All must pass before Miami deploy.**

### Unit — 12 paths (`lib/*.test.ts`)
- [ ] U1 Exact podium → 18 pts, perfect_bonus
- [ ] U2 All three wrong → 0 pts
- [ ] U3 P1 exact only → 5 pts
- [ ] U4 Right driver wrong slot ×3 → 6 pts
- [ ] U5 DNF on P1, P2 exact, P3 slot-wrong → 7 pts
- [ ] U6 Sprint P1 exact → 5 pts
- [ ] U7 Sprint P1 DNF → 0 pts
- [ ] U8 Invalid driver_id → ValidationError
- [ ] U9 Sprint sent with P2/P3 → throws
- [ ] U10 Race sent without P2/P3 → throws
- [ ] U11 Wrong invite code → InviteCodeError
- [ ] U12 Correct invite code → passes

### Integration — 13 paths (Supabase local, `tests/integration/*.test.ts`)
- [ ] I1 submitPrediction happy path
- [ ] I2 submit at T-4s → trigger rejects 409
- [ ] I3 submit at T+1s → trigger rejects
- [ ] I4 submit unauthenticated → 401
- [ ] I5 Double-submit → UPSERT, single row
- [ ] I6 RLS: A cannot SELECT B pre-result → 0 rows
- [ ] I7 RLS: after reveal, A sees B → visible
- [ ] I8 RLS: self-escalate `is_admin=true` on users row → rejected (bomb — column shouldn’t exist; test guards against regression to that pattern)
- [ ] I9 `/admin/results` as non-admin → 403
- [ ] I10 `/admin/results` as admin → results + scores written
- [ ] I11 OpenF1 200 → results + scores written
- [ ] I12 OpenF1 500 → retry logged, no scores
- [ ] I13 OpenF1 malformed JSON → Resend email sent

### E2E — 4 paths (Playwright, `tests/e2e/*.spec.ts`)
- [ ] E1 Valid join → magic link → profile → dashboard
- [ ] E2 Invalid join code → error, no auth
- [ ] E3 Predict → lock → reveal animation plays
- [ ] E4 `prefers-reduced-motion` → instant reveal

**Regression rule:** any change to `computeScore`, prediction lock trigger, or RLS policies must add a regression test.

---

## Scope tracker

### In scope for Miami (locked)
- Core loop: predict → lock → results → reveal → leaderboard
- Magic-link auth behind shared invite code
- Admin manual-entry fallback + Resend alerting
- Shareable leaderboard PNG (`/api/share/[eventId]/card.png`)
- Streak tracker (`user_streaks`)
- Reveal animation (Framer Motion card flip)
- Telemetry nudges (Day 10.5)

### Deferred (revisit post-Miami)
- Group-chat bot (Telegram/Discord/WhatsApp)
- Confidence tier (2x locked-in pick) — revisit 3–4 races in
- "Why" field on predictions
- Comments/reactions on predictions
- Profile avatars / photo uploads
- Historical season browsing (2025 and earlier)

### Explicit non-goals
- Multi-league / multi-tenant
- Public leaderboards
- Mobile app (web-only, responsive)
- Email allowlist (trust-based friend group)
- UI for granting admin

---

## Architecture invariants (do not violate)

1. **`events.lock_at` is the single source of lock truth** — generated column (`session_start_at - interval '5 seconds'`). Client, server action, and DB trigger all derive from it.
2. **Admin privilege lives in `admins` table, not a `users.is_admin` column** (Supabase RLS self-reference is a footgun).
3. **Score computation is in `lib/computeScores.ts`, not a DB trigger** — pure function, unit-tested, idempotent via `ON CONFLICT (user_id, event_id) DO UPDATE`.
4. **Reveal is admin-triggered** (`events.revealed_at`), with 10-min RLS fallback after `results.fetched_at` if admin forgets.
5. **Predictions lock at scheduled start regardless of actual session delays** (weather, red flags).
6. **DNF rule:** pick not in classified P1/P2/P3 → 0 pts for that slot, no partial credit.

## Scoring reference

- Race / quali (P1/P2/P3): exact = 5, slot-match = 2, perfect-podium bonus = +3. Max 18.
- Sprint (P1 only): exact = 5, DNF = 0. Max 5.

---

## Design invariants (from `.impeccable.md`)

- **Fonts:** Boldonse (display) · Geist Sans (body) · Geist Mono (tabular — mandatory for all numerics).
- **Palette:** OKLCH, neutrals tinted to F1-red hue (27°). Accent red = 10% of pixels only (lock pulse, perfect-podium badge, primary CTA).
- **Bans:** no `border-left` accent stripes on cards · no gradient text · no decorative motion · no icons-in-colored-circles three-column grid.
- **Reveal choreography:** result cards flip first (300ms, 200ms stagger) → ~400ms silence beat → friend picks flip (150ms stagger) → subtle leaderboard rank-change.
- **Wireframe refinements to apply at build time** (from design review):
  - Reveal: cut fastest-lap orphan, move share button inline with "THE GROUP" header.
  - Leaderboard: rank col 80px → 60px, emoji font-stack fallback for 🔥.
  - Predict: shrink hero to `clamp(40px, 4.5vw, 72px)`, convert "Change pick" to ghost button, show telemetry on all 3 slots, sprint variant hides P2/P3 entirely.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|
| OpenF1 publish latency too slow for Vercel Hobby daily-only cron | M | M | Phase 0 latency script. Fallback = admin manual entry (always primary-reliable) | ☐ unverified |
| Admin forgets to trigger reveal | M | L | 10-min RLS auto-unlock after `results.fetched_at` | in plan |
| Clock skew at lock boundary | L | M | Server clock + DB trigger are authoritative, 5s margin | in plan |
| Supabase RLS recursion (classic `is_admin` trap) | M | H | `admins` as separate table, service-role-only writes | in plan |
| Mid-season calendar change (cancelled race) | L | L | Nightly reconciliation cron UPSERTs on `openf1_session_key` | in plan |
| Invite code leaked publicly | L | L | Rotate `INVITE_CODE` env var; existing sessions stay valid | in plan |
| F1 team logo trademark (if product opens beyond friends) | L | L | Default to color-dot + 3-letter code; logos optional enhancement | in plan |
| Scope slip eats reveal polish | M | H | Cut order: telemetry → share-card → streak. Reveal + tests are untouchable | discipline |

---

## Open questions (to resolve before Phase 6)

1. Domain — `vercel.app` subdomain vs custom? (resolve before Phase 6 deploy)
2. Invite list — collect the 5–10 friend emails (resolve during Phase 6)
3. Admin bootstrap — run `INSERT INTO admins (user_id) VALUES ('<aastha-uuid>');` after first magic-link login (during Phase 1)
4. Resend API key — sign up for free tier (before Phase 3)

---

## Success criteria

- [ ] All invited friends logged in + submitted a Miami prediction by Friday qual (2026-05-02)
- [ ] Results land within 2h of session end; scores compute automatically
- [ ] Reveal animation plays cleanly for everyone post-race
- [ ] At least one "lol" moment in the group chat Sunday night
- [ ] After Miami, clear signal on what to build next for Monaco (2026-05-25)

---

## Review gates — all cleared

| Review | Status | Key outcomes |
|---|---|---|
| CEO (`/plan-ceo-review`) | ✅ EXPANSION | 6 proposals · 3 accepted (share card, streaks, reveal anim) · 1 deferred · 2 skipped |
| Codex outside voice | ✅ CLEAR | 16 issues raised · 7 resolved (cron-defer, admins table, `lock_at`, reveal gating) · 9 N/A at friend-group scale |
| Eng (`/plan-eng-review`) | ✅ CLEAR | 3 arch fixes · 29-path test plan · 60s-warning/5s-hard-lock accepted |
| Design (`/plan-design-review`) | ✅ CLEAR | Score 5→8/10 · 3 wireframes rendered · 8 interaction states specced · 6 screen refinements queued |

**Unresolved: 0. Ready to implement.**
