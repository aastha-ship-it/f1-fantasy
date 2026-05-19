# F1 Fantasy — Program Tracker

**Source docs:** `plans/flickering-giggling-valley.md` (master), `plans/2026-04-18-f1-fantasy.md` (CEO), `plans/aasthakataria-unknown-eng-review-test-plan-20260418-170000.md` (test plan), `.impeccable.md` (design), `CLAUDE.md` (repo guide).

**Last updated:** 2026-05-18 · **Owner:** Aastha · **Reviews cleared:** CEO · Codex · Eng · Design

---

## Session log

**2026-05-18 — Phase 14 PR 1 shipped: ScoringHelp modal shell + ScoringLegendBody fidelity (design_handoff_phase11 §9 + §4).** First PR of the design-fidelity port. Executed via the executing-plans skill; §4 copy slice done red-green with the org-core:tdd skill (owner scoped TDD to copy only — the rest is pure-visual, verified by Playwright capture). Implemented **on `main`** with explicit owner consent (4 prior unpushed commits ride along; not pushed).

Delivered:
- **`src/components/ScoringLegend.tsx`** — `ScoringLegendBody` dropped its own card chrome (`background`/`border`/`borderRadius:4`/`padding`) so the modal supplies it (README §4 "no surrounding chrome"). `Section` h3 → Boldonse `fontSize:13`/`letterSpacing:0.04em`/`textTransform:uppercase`/`margin:0`; subtitle `<p>` → inline `12px`/`--fg-subtle`/`margin:"var(--space-xs) 0 var(--space-lg)"`/`lineHeight:1.5`. `RowList` `<dl>` `margin:0`, row `gap-4`→`gap-[var(--space-lg)]`, `<dt>` `13px`/`--fg-muted`/`margin:0`, `<dd>` `margin:0`. Outer = `display:grid; gap:var(--space-2xl)` only. All matched to `design_handoff_phase11/design/screens-lobby.jsx:LegendSection` verbatim.
- **§4 copy verbatim-locked** to that canvas: `", wrong slot"`→`" (wrong slot)"` ×3; Race & Qualifying subtitle → the long "— then a non-linear bucket rewards getting the whole podium even when jumbled." form; Worked perfect-row → "Perfect podium — all three exact (+ bonus)"; Worked subtitle → "across one podium prediction."; footnote → "Max for a race/quali session is".
- **`src/components/ScoringLegend.test.tsx`** (new — the project's **first `src/components/*.test.tsx`**). SL1–SL4, jsdom + RTL, behavior-level (`container.textContent`), so they survived the structural refactor in the same PR. +4 unit tests.
- **`src/components/ScoringHelp.tsx`** — trigger now a bordered transparent button (`--space-xs`/`--space-md` pad, 11px, 0.1em) with a 16px circular `?` glyph + label. `<dialog>` `min(92vw,720px)` (was 560). Inner card `borderRadius:4` removed. Header restructured: `items-start`, `padding:var(--space-xl) var(--space-2xl)`, bottom border; left stack = "Reference" caption (10px/0.18em/`--fg-subtle`, `mb:var(--space-sm)`) + sentence-case Boldonse 32px `lineHeight:0.9` `letterSpacing:-0.01em` "How scoring works"; right = "ESC ✕" bordered close (11px, 1px border, `--space-sm`/`--space-lg`). Body padding `--space-2xl`. Native `<dialog>` deliberately kept over the README's `useState`/`z-index:200` overlay (free top-layer/focus-trap/Esc). One-line port summary added to its JSDoc.
- **`src/app/globals.css`** — `dialog::backdrop` → `background: rgb(8 4 6 / 0.78); backdrop-filter: blur(8px)` (was `rgb(0 0 0 / 0.6)`). `dialog[open]` fade + reduced-motion block unchanged.
- **`eslint.config.mjs`** — added `design_handoff_phase11/**` to `globalIgnores` (mirrors the existing `design/**` ignore — canvas JSX reference, not source).

Verification: SL1–SL4 red→green per the TDD vertical-slice loop (one test → one fix → repeat, never horizontal). Full suite **165/165** (32 files; was 161 — +4 SL, zero regressions). `lint` exit 0, `typecheck` exit 0. Playwright capture (`plans/designs/scoring-help-20260518/`, gitignored): invite-gate → test-sign-in → `/profile` → open modal → asserts caption/title/§4 copy/close; screenshots visually verified — scrim+blur dim the page, 720px sharp-cornered panel, Boldonse title un-clipped, header + body match README §9 / screens-lobby.jsx.

Gotchas:
- **`program-tracker.md` was moved out of gitignored `plans/` to the repo root mid-session** (so it can be tracked). `CLAUDE.md` + `plans/design-handoff.md` still say `plans/program-tracker.md` — those refs are now stale (left as-is; not in PR 1 scope).
- The owner-dropped `design_handoff_phase11/` JSX tripped 69 eslint errors (sandbox React patterns) — **not from PR 1 code**. Fixed by ignoring the bundle, exactly as `design/**` already is. Lesson: any future canvas-reference drop needs the same ignore.
- `bun run typecheck` first failed only in `.next/dev/types/*` (stale generated files, dev server mid-write). `rm -rf .next/dev/types .next/types && bunx next typegen` regenerates them cleanly; do this before trusting a typecheck baseline.
- New `*.test.tsx` must `import { describe, it, expect } from "vitest"` — the project does **not** type vitest globals (tsconfig has no `vitest/globals`); `globals:true` is runtime-only. Omitting the import passes vitest but fails `tsc`.
- Playwright: the capture spec lives under `plans/` (gitignored) but `playwright.config.ts` pins `testDir: ./tests/e2e`, so a throwaway `pw.config.ts` in the capture folder (overriding `testDir`) is needed. Also: `/profile` (and every authed route) needs the **invite cookie**, not just the session — the spec must pass the `/join` gate (`gateThroughInvite` pattern) before `/api/test/sign-in-password`, else middleware bounces to `/join` and the TopBar never renders.
- `page.screenshot({fullPage:true})` does **not** composite a native `<dialog>` top-layer + `::backdrop` — it captured a mid-fade, scrim-less frame. Use a viewport screenshot + `waitForTimeout(450)` for the 0.18s fade to settle; `dialog.screenshot()` gives the clean panel-only shot.

---

**2026-05-18 — Design-fidelity port PLANNED (not shipped): `design_handoff_phase11` → 10 phased PRs.** User dropped a `design_handoff_phase11/` bundle (README + `design/*.jsx` canvas + track PNGs) and asked to work the UI-design pass following its BUILD ORDER, one section per PR. This is the **visual** pass over the Phases 10–13 features that shipped *functionally* (changes.md §1–§8) — the first real UI for several of them, plus fidelity fixes to screens that shipped "close enough." Planning session only; **zero code changed.** Plan written to `plans/design-handoff.md` (mirror: `~/.claude/plans/next-i-want-you-peaceful-bachman.md`). Invoked the project `design-handoff` skill; ran 3 parallel Explore agents + 1 Plan agent to build a verbatim current-vs-spec gap analysis before planning.

Owner decisions captured (via AskUserQuestion):
- **Plan all 10 BUILD ORDER items now; execute phased** (one PR per phase). §11 (predict last-5 strip) is already implemented in code (`.reverse()` in `driver-picker.tsx`) → verify/polish only.
- **§9 + §4 ship as one combined PR #1** — the modal renders the legend body; inseparable; §4 is a pure no-chrome refactor + copy fixes.
- **Token-only spacing, nearest `--space-*` within the skill's ≤4px tolerance**, applied uniformly (`28→2xl/32`, `7→xs/4`, `14→lg/16`, …). The design-handoff skill's token discipline wins over the README's literal px where they conflict.

Gap analysis (key findings, drives the phasing):
- **§9/§4 (PR #1):** Phase 13 shipped the "How Scoring Works" modal *functionally* but ~10 fidelity gaps remain — scrim is `rgb(0 0 0/.6)` (should be `rgb(8 4 6/.78)` + `blur(8px)`); modal max-width 560 (should be 720); `borderRadius:4` on the card **and** `ScoringLegendBody` (violates the no-radius ban); header is 16px all-caps with no "Reference" caption (should be sentence-case Boldonse 32px lh 0.9 + caption); `ScoringLegendBody` carries its own surface-card chrome it must shed (modal supplies it); copy drift vs `screens-lobby.jsx` (`, wrong slot`→`(wrong slot)`, short→long Race&Qualifying subtitle, "Maximum for a race or qualifying"→"Max for a race/quali", Worked perfect-row reword). No modal artboard exists — README §9 prose is the spec (owner-expected "Claude Design pass for the modal shell").
- **Code shipped but visually nowhere near spec:** §1 Lobby (no preview/expanded toggle, no 4-session filter, no ParticipantBlock), §10 Reveal FriendCard (score sub-fields exist but unrendered — no per-row badges/bucket-tally/perfect-pill), §7 Admin OpenF1 fetch banner (absent entirely), §8 Admin FP overrides (no DriverDropdown/section frame/status badges).
- **Minor polish:** §3 Show Reel (grid widths, hero size), §5 Profile calendar-sync (1-col→2-col + right card), §6 Predict FP banner (header strip + column grid). §11 done.

Open decisions logged for owner before the relevant phase:
1. **Red Bull hex three-way mismatch** — README says `#4A77DB` ("bumped for accessibility, intentional"); `design/data.jsx` `#1E2A6E`; `globals.css`/`teams.ts` `#3671C6`. None agree. Recommend adopting handoff `#4A77DB` in `teams.ts` + `globals.css` + a numbered `D#` test. **Blocks Phases 2/4/7/9** (team-color surfaces). Does not block PR #1.
2. §7 `Accept as official` — explicit code action or manual-entry only? (Phase 8)
3. §8 override status badges — persistent vs transient flash? (Phase 9)
4. §3 `Σ` prefix — `aria-label="Total"` (confirmed approach; no blocker).

Status: plan approved-pending; ExitPlanMode was declined and the user redirected to update this tracker. **No PR started yet.**

Gotchas:
- **This tracker is stale for Phases 10–13.** The last shipped entry before today is 2026-04-30 (Phase 9.5). Phases 10 (bucket scoring/Lobby/ICS/nudges), 11 (FP banner), 12 (admin OpenF1 fetch + freeze), 13 ("How Scoring Works" modal) all shipped to `main` (commits `0cfe2ee`/`c321e36`/`93a6b02`/`2065d4f`, unpushed) but were **never logged here** — `CLAUDE.md`'s "Current state" + "Phase 10/11/12/13" sections are the authoritative record for them. Recommend a backfill pass (4 retro entries) so the audit trail is whole; out of scope for this planning session.
- The §9 modal has **no canvas artboard** — `screens-auth.jsx` still shows the pre-Phase-13 `THE GROUP · 2026` label, no `ScoringModal`. PR #1's modal shell is built to README §9 prose, reviewed against prose, not a screenshot. §4's truth IS `screens-lobby.jsx` (the `LegendSection` body), so its copy/sizing port to that file verbatim — and README §4's prose claim "body already correct" is itself stale.
- Decision baked into the plan (no user input needed): keep the native `<dialog>`+`showModal()` over the README's `position:fixed/z-index:200/useState` sandbox wording — strictly better (free top-layer, focus trap, ESC, inert bg), already wired through `globals.css`. Visual result matched exactly.
- `plans/` is gitignored; `plans/design-handoff.md` is the durable plan-of-record for this multi-PR effort. Each phase's PR must, per the skill's definition-of-done, add its own dated session-log entry here + refresh `CLAUDE.md` — these planning notes do not substitute for the per-PR shipped entries.

---

**2026-04-30 — Phase 9.5 shipped: 2026 grid corrected (Audi rebrand + Cadillac as 11th constructor).** User flagged `/dashboard/standings` showed only 10 constructors and listed "Kick Sauber" instead of the 2026-rebrand "Audi". Fixed at the metadata + zero-fill layer; deferred the Jolpica official-standings cache (Tier B in `~/.claude/plans/go-through-plans-program-tracker-md-and-lively-sunbeam.md`) as it adds schema + cron complexity right before deploy.

Delivered:
- **`src/lib/design/teams.ts`** — `kick.name` "Kick Sauber" → "Audi"; `short` "KIC" → "AUD". Slug stays `kick` so CSS vars (`--team-kick`, `--team-kick-hex`) and asset filenames (`logos/kick.png`, `cars/kick.png`) don't ripple. Real Audi 2026 livery / asset swap is a future concern.
- **`src/lib/design/teams.ts`** — new `cadillac` slug + entry: `name: "Cadillac F1 Team"`, `short: "CAD"`, `hex: "#9B0D2D"` (crest red), placeholder `logoSrc` / `carSrc`. Aliases: `cadillac`, `cadillac f1`, `cadillac f1 team`, `general motors`, `gm cadillac`. `ALL_TEAMS` now reports 11.
- **`src/app/globals.css`** — added `--team-cadillac: oklch(48% 0.18 22)`, `--team-cadillac-hex: #9B0D2D`, and the `--color-team-cadillac` mapping inside `@theme inline`.
- **`public/assets/logos/cadillac.png` + `public/assets/cars/cadillac.png`** — transparent 1×1 PNGs as placeholders so `<Image>` doesn't 404. Real liveries land later.
- **`src/lib/design/teams.test.ts`** — D2 extended to assert "Audi → kick slug, name=Audi" + Cadillac alias resolution; D6 updated from 10 → 11.
- **DB re-seed** via `bun --env-file=.env.local run scripts/seed-drivers.ts`. OpenF1 reports the 2026 grid as Alpine, Aston Martin, **Audi**, **Cadillac**, Ferrari, Haas F1 Team, McLaren, Mercedes, Racing Bulls, Red Bull Racing, Williams — exactly 11 distinct team strings, 22 active drivers (2 per team). All resolve cleanly via `teamMeta()`.
- **`src/app/dashboard/standings/page.tsx`** — after `combineStandings()`, union every distinct `drivers.team` into the constructor map with 0-pt fallback so the table always shows the full grid even when an entrant (Aston, Cadillac at this point in the season) hasn't scored yet. Sort stays "points desc, alpha tiebreak" via the same comparator.

Verification: lint + typecheck clean. 117/118 vitest unchanged (pre-existing I6 RLS flake; teams.test.ts went 6/6 after the D2/D6 updates). Constructor table renders 11 rows with Cadillac + Aston Martin listed at 0 pts; Audi shows wherever Bortoleto/Hülkenberg appear. CSS token + alias work: any `teamMeta("audi")?.hex` consumer downstream picks up automatically (driver-picker badge, league row, predict slot, reveal podium).

Gotchas:
- The 2026 Audi livery in real life is dark green/red. The kick slug's lime-green CSS token + asset bundle stays for v1 because swapping it touches 6 places (`--team-kick`, `--team-kick-hex`, `kick.png` ×2, livery tuple, hex literal). Mark the swap as a Phase 10+ asset-only change.
- `combineStandings()` itself was NOT changed — the zero-fill is in the page consumer. This avoids a behavior change to the pure helper which is unit-tested elsewhere; the page is the appropriate place to enforce "show every entrant".
- Tier B (cache table for Jolpica's `/f1/{season}/driverStandings.json` + `/constructorStandings.json` endpoints, plus a 04:25 UTC cron) is fully designed in the plan doc but not shipped — recommended only if drift between Jolpica delta + OpenF1 backstop becomes a visible problem post-deploy.

---

**2026-04-30 — Phase 9 shipped: reveal-discovery surfaces (banner + tab + grouped index).** Closes the "how do offline users know a reveal is live?" gap from the deploy-prep conversation. Three new surfaces working together; no schema changes, no push notifications, just better discovery.

Delivered:
- **Dashboard fresh-reveals banner** — new `src/app/dashboard/reveal-notice.tsx` client component. Server query on `/dashboard/page.tsx` joins `predictions` → `events` and pulls events `revealed_at >= now() - 7 days` where the user has a prediction (`limit 5`, ordered most-recent first). Banner mounts between TopBar and the dashboard hero: full-width Ferrari-red strip with a small inverted-color `<TrackDiagram>` thumbnail, "RESULTS REVEALED" Boldonse + "R03 · CHINESE GRAND PRIX · QUALIFYING" mono subline + "Tap to watch →" CTA + "+N more →" link to `/dashboard/predict` when 2+ candidates remain + ✕ close. Click-through OR ✕ pushes the event id into `localStorage.f1_dismissed_reveals` so the banner is per-event ephemeral (doesn't follow the user around after they've watched). Framer Motion `AnimatePresence` slide-in matches the existing PICKS LOCKED IN / PROFILE SAVED banners.
- **New REVEAL tab in TopBar** — slotted between PREDICT and STANDINGS so the nav reads as the natural pick → watch outcome → check standings flow. Tab union extended to `"calendar" | "predict" | "reveal" | "standings" | "league" | "profile"`. The cinematic detail page (`/reveal/[eventId]`) and gated-shell variants now pass `active="reveal"` so the tab highlights correctly while watching a cinematic.
- **New /reveal index page (`src/app/reveal/page.tsx`)** — server component, "SHOW REEL" hero with total points + perfect-podium count + round/session counts. Below: list grouped by round (one row per Grand Prix, not per session — avoids "Sprint Quali (China), Sprint (China), Quali (China), Race (China)" clutter on sprint weekends). Each round row: round number + track diagram + country flag + GP name + circuit + relative "Latest Xh ago" timestamp + **session pills** + Σ round-total. Pills are uniformly accent-red bordered with intensity-scaled fill — perfect podium = 28% accent tint, ≥10 pts = 18%, default = 10% — so the row reads as a brand-consistent strip while standout sessions still pop. Each pill is its own clickable target → `/reveal/[eventId]` for that specific session. Empty state offers a CTA back to `/dashboard/predict`.

Files added / changed:
- `src/app/dashboard/reveal-notice.tsx` (new — 156 lines)
- `src/app/dashboard/page.tsx` — supabase query + RevealNotice mount
- `src/components/TopBar.tsx` — REVEAL tab added to TABS array, Tab union widened
- `src/app/reveal/page.tsx` (new — 290 lines incl. groupByRound + pill rendering)
- `src/app/reveal/[eventId]/page.tsx` — `active="calendar"` → `active="reveal"` (×2)

Verification: lint + typecheck clean. 117/118 vitest unchanged (pure UI / no schema). The pre-existing I6 RLS flake still fails for the same fixture-pollution reason logged earlier.

Gotchas:
- The dashboard banner uses **deferred hydration** — `useEffect` reads `localStorage` post-mount and only then calls `setDismissed`/`setHydrated`. SSR markup renders empty (returns `null` until `hydrated === true`) so server / client trees don't diverge on the dismissed-event set. The `react-hooks/set-state-in-effect` lint rule fires here; an inline `eslint-disable` block documents the intent — the hydration pattern is exactly what the rule warns against, but this is one of the legitimate cases.
- `Date.now()` in the dashboard server-component body for the `sevenDaysAgo` cutoff trips `react-hooks/purity`. Single-line disable on the `Date.now()` call only (matches the established pattern from other server components — `dashboard/predict/page.tsx` etc.).
- The `/reveal/[eventId]` cinematic page now reports `active="reveal"` on both its happy-path TopBar and the gated-shell TopBar for unrevealed/un-resulted events — both call sites need to stay in sync if a future refactor adds a third shell variant.
- `groupByRound` in `/reveal/page.tsx` is a local helper, not the shared `src/lib/predict/groupByRound.ts`. Reasons: this one operates on `EventRow[]` already known to be revealed (no lock-status filtering needed), needs per-session score totals, and uses a different sort anchor (`latestRevealedAt` desc, not `weekendStart`). Not worth the extra abstraction layer for one extra caller.

---

**2026-04-30 — Phase 8.5 shipped: at-track wins/podiums split + telemetry readability redesign.** Closes three issues surfaced during Phase 8 manual test of `/dashboard/predict/[eventId]`.

Delivered:
- **Issue 1 — distinguish "data missing" from "zero podiums".** `src/lib/jolpica/atTrackPodiums.ts` renamed to `atTrackResults.ts`. `atTrackResultsFor()` now returns `{ wins, podiums } | null`. `null` is reserved for "historical_races has zero rows for this circuit/window" (genuinely no data). `{ wins: 0, podiums: 0 }` is the genuine zero case. UI already rendered `—` when the value was null, so on a fresh dev DB without backfill the predict-detail strip now reads `—` for at-track instead of the misleading `0 podiums`. 4 integration tests under J7/J8/J7b/J7c — `tests/integration/atTrackResults.test.ts`.
- **Issue 2 — wins separated from podiums.** New `at_track_wins smallint` column on `driver_nudges` (migration `20260430000000_driver_nudges_at_track_wins.sql`). `refreshNudgesForEvent` writes both columns from one Jolpica aggregate. New `formatAtTrack(wins, podiums)` helper in `src/lib/nudges/format.ts` produces the copy: `null → "—"`, `0/n → "n podium(s)"` (no leading "0 wins · "), `w≥1/p → "w win(s) · p podium(s)"`. 7 unit tests under D25.1–D25.7 covering the format matrix including the legacy-null fallback. The wins number renders in `var(--accent)` (Ferrari red) whenever `wins ≥ 1` — honoring `.impeccable.md`'s "10% accent reserved for moments of meaning" rail.
- **Issue 3 — telemetry-strip readability redesign.** The slot card's livery watermark car (orange McLaren, blue RBR, etc., opacity 0.32, positioned `right:-40, bottom:-20`, 460×180) was rendering directly through the bottom of the card where the telemetry rows live, washing the data on busy bodywork. Redesign:
  - Watermark car wrapped in a CSS-mask div with a `linear-gradient(180deg, black 55%, transparent 100%)` mask-image — the bottom 45% of the car fades to transparent, so the telemetry panel below sits on clean surface.
  - Telemetry strip lifted from a top-bordered transparent strip to a tinted contrast panel: background `color-mix(in oklch, ${t.hex} 8%, var(--surface))` so each slot carries a hint of its driver's team color; 1px `${t.hex}` top border replaces the neutral `--border` so the panel reads as "this slot's telemetry"; `var(--space-lg)` padding all around.
  - Form L5 row swapped from a dot-separated string (`P3 · DNF · P5 · …`) to a row of color-class pills: `--success` tint for P1–P3 finishes, `var(--surface-2)`/`--fg` neutral for P4–P10, `--error` tint for DNF/DNS/DSQ. 11px Geist Mono semibold with `data-tabular`.
  - Row values bumped from 12px regular Geist Mono to 14px semibold; row labels stay 12px Geist Mono `--fg-muted` for hierarchy.
  - Slot vertical order rearranged — telemetry panel now sits between portrait and "Change pick" affordance (was last). The data layer is now visually central, the small "Change pick" button is the trailing affordance.
  - Empty-slot state (no driver picked) keeps the existing `hotPicks` "Group's hot picks for P1: NOR · LEC · VER" content but renders inside the same panel shell so the three-slot rhythm is consistent.

Verification: 117/118 vitest passing (was 109/110 before Phase 8.5 → +1 J7c integration test + +7 D25 unit tests = +8). The pre-existing I6 RLS flake from earlier sessions still fails (test queries `predictions` without an `event_id` WHERE clause, sees fixture-seed pollution — unrelated to this pass). Lint + typecheck clean. Migration applied locally via `supabase migration up`.

Operator note for fresh dev environments: at-track values stay `—` until `historical_results` is populated. Run once after a `supabase db reset` or fresh clone:
```bash
bun --env-file=.env.local run scripts/backfill-jolpica.ts
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/refresh-nudges
```

Gotchas:
- The integration test `J7c` asserting `null` from the aggregator means the unit-test count was unchanged here; the 117 number reflects 3 existing J7/J8/J7b tests recoded against the new return shape + 1 new J7c + 7 new D25 unit tests. Net new tests: 8. The renamed file was a `mv` (the old file was untracked in git), no `git mv` history preserved.
- `formatAtTrack` includes a defensive `wins == null && podiums != null` branch (D25.7) so legacy `driver_nudges` rows written before the migration still render meaningfully — they read as podium-only until the next nudge refresh writes the wins column.
- The CSS mask uses both `mask-image` and `-webkit-mask-image` for Safari support. Browsers without mask support degrade to the previous opacity-only treatment.
- Form-L5 pill colors use `color-mix(in oklch, ...)` rather than `color-mix(in srgb, ...)`. Tailwind v4's tokens are OKLCH-native; mixing in srgb produces dingier results when the source colour is highly saturated (e.g. `--success` green).

---

**2026-04-30 — Phase 8 Bucket C shipped: portrait recrop + reveal podium headshots.** Closes the last two issues from `design/ui-issues.md` (3c + 7b). Phase 8 is fully done.

Delivered:
- C1 · `public/assets/drivers-portrait/BOT.png` recropped from a 1342×498 wide banner (with name labels + team logos visible) to a 498×498 head-and-shoulders square via `sips -c 498 498`. Replaces the chest-fragment that the avatar was cropping to. PER.png portrait was already a clean 600×600 square — its "not visible" report is the Next image cache stickiness called out in the plan; `rm -rf .next && bun next dev -p 3001` resolves on the user side. No PER asset change needed.
- C1 · `src/components/DriverPortrait.tsx` now sets `objectPosition: "center top"` on the rendered `<Image>`. Defensive default — any future portrait that's accidentally taller-than-square (or wider-than-square) shows the head, not the chest. No behavior change for the existing 1:1 portrait set.
- C3 · `src/app/reveal/[eventId]/reveal-stage.tsx` `PodiumCard` redesigned. Replaced the small circular `<DriverPortrait size={80}>` (P1) / `size={56}` (P2/P3) corner avatar with a large rectangular driver headshot positioned absolutely flush to the lower-right of the card: 180×240 for P1, 120×160 for P2/P3. Sources from `driverPortraitSrc()` (the 600×600 / 498×498 squares). `objectFit: cover` + `objectPosition: "center top"` keeps the face visible. `RIGHT_FACING_CODES` mirror via `transform: scaleX(-1)` is preserved for BOT/LIN. Falls back to a team-tinted letter block (subtle vertical gradient `transparent → ${t.hex}33`) when no portrait exists for the code. Title block + "DRIVER NAME · TEAM · #NUM" now constrains to `maxWidth: calc(100% - 196px)` so the long names don't crash into the headshot.

Verification: lint + typecheck clean. Vitest 109/110 (unchanged from Bucket B — same pre-existing I6 RLS flake; no test count regression). Bucket C is structural/visual, no new logic to TDD; the project has no component-render harness so the verification path is dev-server + screenshot diff against `design/design-screenshots/:reveal:[eventId] - China GP - Reveal Cinematic.png`.

Gotchas:
- The `drivers/` (headshot) PNGs are wide banner images with name labels burned in. The plan suggested using `driverHeadshotSrc()` for the rectangular podium image, but those banners contain text artifacts that would leak into the cropped frame. Switched to `driverPortraitSrc()` — the 600×600 cleaned squares — which produces a much tighter face crop under `object-fit: cover` into a tall container. This is the right primitive going forward; if any other screen ports the canvas's "tall driver portrait flush to bottom" treatment, copy this approach.
- After replacing `BOT.png` with the new 498×498 crop, the live dev server (port 3001) needs a hard reload (`Cmd+Shift+R`) — Next image-component results are persistently cached.
- The fallback letter block uses a `linear-gradient(180deg, transparent, ${t.hex}33)` rather than a flat tint so the card's livery watermark still reads through the bottom of the placeholder. Matches the canvas treatment for codes outside the curated portrait set.

---

**2026-04-30 — Phase 8 Bucket B shipped: per-round entry routes + F1 lock-in banner + multi-session fixture picks.** Two new pages, one extracted helper, banner+CTA rewire on the picker, and the seed script now mirrors a real sprint weekend.

Delivered:
- B1 · Extracted `groupByRound()` to `src/lib/predict/groupByRound.ts` — pure module with `GroupableEvent` + `RoundEntry` types and 5 unit tests under the **D22** prefix (race-only round, sprint weekend, asc/desc sort, empty input). The `/dashboard/predict` list now imports it; the new round page uses the same path.
- B1 · New `src/app/dashboard/predict/round/[round]/page.tsx`. Hero with short event name + track diagram + "X/Y locked" subline, then one card per session with state pill (Open / Picks saved / Locked), live lock countdown (server snapshot — picker carries the live tick), per-slot driver chip tinted with `teamMeta(...).hex`, and a "Lock in picks →" / "Edit picks →" / "View picks" CTA depending on state. Routes deep into the existing `/dashboard/predict/[eventId]` for the chosen session. The dashboard predict-list "CONTINUE PICKS →" hero CTA + every Upcoming row href now point to `/dashboard/predict/round/[round]` instead of jumping to one session.
- B2 · Replaced the inline green `Picks saved.` line with an F1-style accent banner — Framer Motion `AnimatePresence`, `EASE_OUT_QUART`, full-width strip below the grid, "PICKS LOCKED IN" Boldonse + saved-at UTC time + session label on a Geist-mono subline, auto-dismisses after 4s. The sticky lock-bar primary button swaps to a `<Link href={`/dashboard/predict/round/${round}`}>` "Lock in for other events →" once `justSaved` is set; any subsequent pick edit clears `justSaved` and brings back the live submit button. New picker props: `round: number`, `sessionLabel: string`, both threaded from `[eventId]/page.tsx` via `sessionLabelOf(event.session_type)`.
- B3 · New `src/app/admin/results/round/[round]/page.tsx`. Per-round admin entry: hero with attention pill ("X awaiting" / "All filed"), then one card per session with state ("Awaiting results" / "Filed · not revealed" / "Revealed" / "Future"), pick count, and `/admin/results/[eventId]` deep-link CTAs. The `/admin` row action button rewires from `r.actionSessionId` to `/admin/results/round/${r.round}` for `pending`/`mixed` rounds; `entered` rounds keep deep-linking to the single race session so the existing reveal flow still works. Admin results detail page gains a clickable `/admin · /round/02 · /race` breadcrumb.
- B4 · `scripts/seed-fixture-picks.ts` now seeds **every session** of each requested round (was race-only). Sprint sessions take just P1 (DB column null for P2/P3, matches `submitPrediction` validator); race + quali get the full P1/P2/P3 from `PICKS_BY_FRIEND_BY_ROUND`. Fixes admin SCORE PREVIEW for sprint sessions reading "no friend predictions". Output prints `R02 sprint_quali :: NOR` style lines per session, easier to debug.
- C2 · `seed-fixture-picks.ts` exposes nudge refresh as an opt-in `--with-nudges` flag (default off — discovered during Phase 8 manual test that the OpenF1 fetch chain at ~50 reqs/event × 350ms throttle made the script feel frozen for several minutes after seeding finished). Default seed runs are now fast (~5s, just picks). For telemetry: pass `--with-nudges`, or hit `/api/cron/refresh-nudges` with the bearer header. Final-line cheatsheet prints the curl alternative.

Verification: lint + typecheck clean. Vitest 109/110 (was 99/99 baseline; +5 new D22 tests). The single failure is the same pre-existing I6 RLS flake from Bucket A — `tests/integration/rls.test.ts > I6` queries `predictions` without an `event_id` WHERE clause and observes legitimate revealed-event picks left over from prior fixture seeds. Logged previously, still unrelated to this pass.

Gotchas:
- `groupByRound` is generic over `E extends GroupableEvent` so callers carrying an extra column (e.g. `season` on the predict-detail page) keep their type-narrowed downstream. Don't tighten back to a non-generic.
- The F1 banner uses inline `style.background = "var(--accent)"` rather than a Tailwind utility because Tailwind v4's color-with-opacity arbitrary syntax (`bg-[color:var(--accent)]/100`) was unnecessary here and would have prevented the auto-mounted `motion.div` from animating its background cleanly. No spacing-namespace concern.
- `justSaved` clears on any pick edit (`fillNextEmpty` or `clearSlot`) so the user always sees a live submit button when they have a pending change. Without that, users edit picks then see "Lock in for other events" and would skip saving.
- The new round route uses `roundSessions[0].name` as the round name (every session in a round shares the same `events.name`), so we don't need a separate `rounds` table.
- The B3 admin route uses `Number.isFinite(round)` as the only validator. Routing a string round (e.g. `/admin/results/round/abc`) returns 404 cleanly.

---

**2026-04-30 — Phase 8 Bucket A shipped: surgical CSS / layout fixes.** Three small token-/style-level fixes against `design/ui-issues.md` issues 1, 3a, 4a, 7a.

Delivered:
- A1 · `/join` hero `<h1>` `lineHeight: 0.88 → 1.0` + `marginTop: var(--space-md)` so the "PRIVATE LEAGUE · INVITE-ONLY" eyebrow no longer collides with Boldonse's deep ascenders. `src/app/join/page.tsx:39-51`.
- A2 · Red Bull blue lifted from `oklch(38% 0.16 265)` / `#1E2A6E` to `oklch(58% 0.16 265)` / `#3671C6` — the team badge text + 3px team-color top-borders are now legible on `--bg`. Williams nudged in the same pass: `oklch(58% 0.14 245)` / `#1868DB` → `oklch(64% 0.16 245)` / `#1E5BCF`. Every `teamMeta(...)?.hex` consumer (driver-picker badge, league row, standings table, reveal cards) inherits automatically. `src/app/globals.css:33,35,48,50`.
- A3 · `/reveal/[eventId]` cinematic `<motion.h1>` `lineHeight: 0.86 → 0.95`. The italic `data-tight` Boldonse hero stops clashing "CHINA"'s descender into "GRAND PRIX"'s ascender. `src/app/reveal/[eventId]/reveal-stage.tsx:382-389`.

Also fixed a pre-existing lint error in `scripts/seed-fixture-picks.ts:161` (`let` → `const` for `list`) so the lint pipeline is clean before Bucket B + C touch that file.

Verification: lint clean, typecheck clean. Vitest now 104/105 — the new failure (`tests/integration/rls.test.ts > I6`) is **pre-existing** and unrelated: the test queries `predictions` without filtering by `event_id`, and the local DB has revealed-event predictions seeded by `seed-fixture-picks.ts` that User A can legitimately see post-reveal via RLS. Bucket A is pure CSS literals and cannot have caused a DB-row count change. Will be addressed by tightening the test's WHERE clause in a future pass; logging here so the regression isn't mis-attributed.

Gotchas:
- Bucket A had no TDD coverage by design — the fixes are CSS literals (line-height numbers, hex codes, a margin token) and red→green→refactor doesn't fit. Verification is visual (compare `design/design-screenshots/` to live `/join`, `/reveal/<id>`, `/dashboard/league`, `/dashboard/predict/<id>`) plus the existing suite staying green.
- `--space-md` (12px) was deliberately chosen for the `/join` eyebrow→hero gap over `--space-lg` (16px) — the canvas reference reads as a tight semantic group, not a section break.

---

**Phase 8 (queued, 2026-04-29) — UI-issues triage from `design/ui-issues.md`.** User did a side-by-side diff between `design/design-screenshots/` and the live implementation, captured 7 issue clusters across 6 routes, and saved annotated screenshots under `design/implementation-screenshots/`. Plan written to `~/.claude/plans/imperative-wishing-mitten.md`. Three buckets, ordered for quick visual wins first.

**Bucket A — surgical CSS / layout** (~30 min):
- **A1. `/join` text overlap** — eyebrow getting pulled into Boldonse's 0.12em top padding. Fix: bump `<h1>` `lineHeight: 0.88 → 1.0` and add `marginTop: var(--space-md)` between eyebrow and hero. Files: `src/app/join/page.tsx:39-51`.
- **A2. Red Bull blue accessibility** — `--team-redbull-hex: #1E2A6E` and `--team-redbull: oklch(38% 0.16 265)` are too dark; team badge text + 3px top-borders on driver-grid cells render near-invisibly on `--bg`. Fix: bump to `#3671C6` / `oklch(58% 0.16 265)`. Audit Williams `#1868DB` if borderline. All `teamMeta(...)?.hex` callers downstream pick up automatically. Files: `src/app/globals.css:33,48`.
- **A3. `/reveal/[eventId]` cinematic title overlap** — `<motion.h1>` with `lineHeight: 0.86` + italic Boldonse + `data-tight` collides "CHINA" descender into "GRAND PRIX" ascender. Fix: bump line-height to 0.95. Files: `src/app/reveal/[eventId]/reveal-stage.tsx:382-389`.

**Bucket B — per-round entry routes** (~90 min):
- **B1. New `/dashboard/predict/round/[round]`** — lists all sessions of a weekend (Q · SQ · S · R for sprint weekends, Q · R otherwise) with per-session lock state + picked state. Routes to `/dashboard/predict/[eventId]` for the chosen session. The "CONTINUE PICKS →" CTA on `/dashboard/predict` (currently jumping straight to next-session) is rewired to `/dashboard/predict/round/[round]`. Reuses `groupByRound`, `LockCountdown`, `formatDateRange`, `circuitMeta`. Solves issue 2.
- **B2. F1 banner + "Lock in for other events" CTA** — replaces the inline `Picks saved.` text with a full-width accent-red banner (Framer Motion fade in/out, 4s auto-dismiss) and swaps the sticky lock-bar primary button to "LOCK IN FOR OTHER EVENTS →" routing back to `/dashboard/predict/round/[round]`. Files: `src/app/dashboard/predict/driver-picker.tsx`, `src/app/dashboard/predict/[eventId]/page.tsx` (passes round prop). Solves issue 3d.
- **B3. New `/admin/results/round/[round]`** — admin per-round entry: lists all sessions with state pills + "File results →" CTAs. `/admin` row action button rewired from single `actionSessionId` to `/admin/results/round/{round}`. Adds a "Back to round overview" breadcrumb to the existing `/admin/results/[eventId]`. Solves issues 5a + 6 (the "0 picks · 1/4 results" subline becomes meaningful once admins can fill all sessions).
- **B4. Multi-session fixture picks** — `scripts/seed-fixture-picks.ts` currently seeds picks only for `session_type='race'`, leaving Q / SQ / S empty so the admin's live SCORE PREVIEW reads "no friend predictions". Fix: extend to all session types per round (P1 only for sprint sessions, full P1/P2/P3 for race + quali). Solves issue 5b.

**Bucket C — assets + nudges** (~45 min):
- **C1. Re-crop PER + BOT portraits** — `BOT.png` in the portrait dir is a wide rectangle (per the 2026-04-28 polish session — a copied "drivers" headshot, not a square crop), so `<DriverPortrait>` at 72×72 with `object-cover` centres on the chest, not the face. Fix: square-crop `public/assets/drivers-portrait/BOT.png` (and PER if cache-bust doesn't restore it). Defensive code change: set `objectPosition: "center top"` on `DriverPortrait` so future wide-aspect portraits show the head. Solves issue 3c.
- **C2. Telemetry empty** — `driver_nudges` cache only populated by the 10-day-window `/api/cron/refresh-nudges` cron, never run in dev. Fix: piggyback `refreshNudgesForUpcoming(svc, { withinDays: 30 })` onto `seed-fixture-picks.ts` so dev seeding implies populated telemetry. Document the manual `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/refresh-nudges` alternative in CLAUDE.md. Solves issue 3b.
- **C3. Reveal podium portraits** — small 80px / 56px `<DriverPortrait>` circles in the corner of each podium card vs the canvas's large rectangular driver headshots flush to the card bottom. Fix: replace with absolute-positioned `<Image src={driverHeadshotSrc(code)}>` at 180×240 (P1) / 120×160 (P2/P3), `objectPosition: top` so face is visible. Files: `src/app/reveal/[eventId]/reveal-stage.tsx` `PodiumCard`. Solves issue 7b.

**Critical files (full list in plan)**:
- `src/app/globals.css`, `src/app/join/page.tsx`, `src/app/reveal/[eventId]/reveal-stage.tsx`
- `src/app/dashboard/predict/page.tsx`, `src/app/dashboard/predict/round/[round]/page.tsx` (new), `src/app/dashboard/predict/driver-picker.tsx`, `src/app/dashboard/predict/[eventId]/page.tsx`
- `src/app/admin/page.tsx`, `src/app/admin/results/round/[round]/page.tsx` (new), `src/app/admin/results/[eventId]/page.tsx`
- `src/components/DriverPortrait.tsx`, `public/assets/drivers-portrait/BOT.png` (re-crop)
- `scripts/seed-fixture-picks.ts`

**Out of scope for this pass**:
- Williams blue widening unless A2's RBR fix exposes a similar contrast fail.
- Removing the existing `/admin/results/[eventId]` route — still useful as a deep-link.
- Per-driver portrait re-cropping beyond PER + BOT.

**Verification (post-pass)**:
- After A: visual spot-check `/join`, `/reveal/<id>`, `/dashboard/predict/<id>`, `/dashboard/league`, `/dashboard/standings` for RBR visibility + no text overlap. Lint + typecheck + vitest still green.
- After B: walk both flows — predict ("CONTINUE PICKS" → round overview → session → lock → F1 banner → "LOCK IN FOR OTHER EVENTS") and admin (row → round overview → file each session → reveal). Re-run Playwright (E1, E2 unaffected by route changes).
- After C: re-seed fixture, verify SCORE PREVIEW lights up for sprint sessions, telemetry strip populated on predict-detail, reveal podium uses big rectangular headshots.
- Final: `bun run lint && bun run typecheck && bun --env-file=.env.local run vitest run && E2E_BASE_URL=http://localhost:3001 bunx playwright test`. Baseline 105 vitest + 2 playwright = 107 total. New tests: D22 unit test for `groupByRound` if extracted to `src/lib/predict/`.

**2026-04-29 (latest²) — Deferred items closed: helper extractions + cron telemetry + qualifying ingest + season-summary cells.** Five deferred items knocked out in one pass.

Delivered:

- **`src/lib/design/eventName.ts`** — new `eventCountry(name)` export. Resolves event name (full or shortened) → ISO 3166-1 alpha-2 country code via the same map that was previously inlined twice. 3 unit tests D16–D18.
- **`src/lib/design/dateRange.ts`** — new `formatDateRange(startIso, endIso)` helper. Same-month range collapses to `"2 - 4 May"` (cleaner than the old `"2 May - 4 May"`); cross-month renders as `"31 May - 2 Jun"`; single-day collapses to `"4 May"`. Replaces inline duplicates in `/dashboard` and `/dashboard/predict`. 3 unit tests D19–D21.
- **`supabase/migrations/20260429120000_cron_runs.sql`** — append-only `cron_runs (path, ran_at, status, duration_ms, error)` table. RLS select-all, service-role writes only. Indexed on `(path, ran_at desc)`.
- **`src/lib/cron/recordRun.ts`** — `recordCronRun(svc, path, status, durationMs, errorOrMessage?)` for the cron routes' success + catch paths. Insert failures are swallowed — telemetry never crashes the cron itself. Sibling `listLatestCronRuns(svc, paths)` returns the latest row per path for the admin strip (PostgREST has no DISTINCT ON; we fetch a window and dedupe client-side).
- **All 4 cron routes wired.** `sync-f1-data`, `fetch-results`, `refresh-jolpica-current`, `refresh-nudges` now record `success` (with `duration_ms`) on the happy path and `error` (with the caught exception's message) on the catch path. The `recordCronRun` call sits before the JSON response so the row lands even if the response stream is cut.
- **`/admin` strip rewritten.** Replaces the static schedule placeholder with live data: each cell shows `last-run-time UTC` in Boldonse 28px, status dot tinted to outcome (success green / error red / never-run grey), and a sub-line reading `{label} · ✓ success · {duration_ms}ms` or `{label} · ✗ {error.slice(0, 60)}`. Falls back to `{label} · scheduled` for paths that haven't reported yet.
- **`supabase/migrations/20260429130000_qualifying_fastest_lap.sql`** — extends `historical_results.session_kind` check constraint to include `'qualifying'`, adds `fastest_lap boolean default false` column, adds a partial index on `(season, round) where fastest_lap = true`.
- **Jolpica backfill extended** to ingest qualifying classifications via `/{season}/qualifying/` and capture `FastestLap.rank=1` from race results. New `projectQualifying` projects qualifying rows with `position=1` = pole, `points=0`, `status='Q1'/'Q2'/'Q3'` (deepest session reached). The CLI script `scripts/backfill-jolpica.ts` and the `/api/cron/refresh-jolpica-current` route both pick up the new endpoint automatically.
- **Standings season-summary strip → 5 cells.** `/dashboard/standings` now renders:
  - Races complete (X of 24)
  - Different winners (distinct race-P1 driver count)
  - Pole sitters (distinct qualifying-P1 driver count)
  - Fastest laps (count of `fastest_lap=true` rows + distinct-driver count in sub-line)
  - DNFs total (race rows where `position IS NULL OR status NOT IN ('Finished', '+N Laps')`, with `X.X per race` average sub-line)
- **`ErgastFastestLap` + `ErgastQualifyingRow` types** added to `src/lib/jolpica/types.ts`. The fastest-lap field hangs off race result rows; qualifying is its own response shape with Q1/Q2/Q3 times.

107/107 green: 105 Vitest + 2 Playwright. Typecheck + lint + production build all clean. Two new test cases (J5c fastest_lap capture + J5d qualifying ingest) added to `backfillResults.test.ts`.

Gotchas:
- **Existing J5/J6 tests broke when qualifying endpoint was added.** They mocked exactly 2 `fetch` calls (race + sprint). The new qualifying call fell through to the real `globalThis.fetch` and returned 24 races worth of data. Fix: append an `EMPTY_QUALI_PAGE` mock to each existing test. The cleaner fix would be a URL-based mock router, but two-line additions kept the diff tight.
- **`status='Finished'` regex needs `+N Laps?`.** Lapped finishers get statuses like `"+1 Lap"` or `"+3 Laps"`. Initial implementation only matched `"Finished"`, miscounting 1-lap-down classified finishers as DNFs. Caught during local backfill.
- **`fastest_lap` column on qualifying rows is meaningless.** The backfill always sets it to `false` for qualifying, but if someone manually inserts a qualifying row with `fastest_lap=true` the partial index would index it. Acceptable; the standings page filters to `session_kind='race'` for fastest-lap counts so a stray qualifying row with the flag set wouldn't be miscounted.
- **`db reset` wipes seeded events.** The two new migrations forced a `supabase db reset` cycle, which wiped the calendar + drivers seeds. Re-running `scripts/seed-calendar.ts` + `scripts/seed-drivers.ts` after a reset is now a routine step. Captured in CLAUDE.md's seed section already; reaffirming here.
- **`.next` cache also stale after a migration cycle.** `rm -rf .next` between migrations + dev restart prevents Next from serving 404s for routes whose generated types changed under it.
- **Cron strip headline truncation.** When a cron runs same-day the headline shows `HH:MM UTC`. For older runs (manually triggered yesterday's logs) it collapses to `MMM D`. The duration_ms sub-line is suppressed on the `MMM D` form to keep the strip readable.

The `.impeccable.md` "fastest-lap is non-feature" rail is now superseded by an explicit user request to surface the count. Not amended in `.impeccable.md` — fastest-lap is a *count* on the standings strip, not a celebrated event-level metric (no chip, no badge, no per-row flag in the leaderboard). The rail still applies to the predict-detail / reveal screens.

**2026-04-29 (latest) — Admin pages ported.** User opened up the design-handoff skill scope to include `/admin` and `/admin/results/[eventId]` and asked to port both. The new `AdminStrip` component carries the distinct "admin context" affordance (accent-bordered bottom strip vs the regular `TopBar`).

Delivered:
- **`src/lib/adminGuard.ts`** — `currentAdmin()` now returns `email` + `displayName` so the admin strip can render the operator's name. Existing call sites (4 places) only used `userId`/`reason`; widening the type is non-breaking.
- **`src/app/admin/admin-strip.tsx`** — new client-free component. F1Mark-less; reads `▣ Admin · The Group · {YEAR}` left in accent red, three nav labels (Events / Cron status / Logs — the latter two are stubs since they're not built), `{name} · admin` + ⏻ sign-out right. Bottom border in accent red.
- **`src/app/admin/page.tsx`** rewritten to canvas (`screens-aux.jsx:AdminScreen`). Hero: "● Admin · X attention needed" eyebrow (X = pending + entered states) + "EVENT CONTROL" Boldonse 88px. 4-cell cron-schedule strip (we don't persist run timestamps; the strip shows the configured schedule from `vercel.json` plus a green "scheduled" dot — the canvas's "04:30 UTC · success" treatment requires storage we haven't added). Events table: one row per round with track diagram, country flag (derived by name), Boldonse country + city, sessions label (Q · R / Q · SQ · S · R), accent-tinted state pill (pending/entered/revealed/future/mixed), pick count + sessions-with-results count, action button. Pending rows tinted with `color-mix(--accent 8%)` and entered rows with `--warning 8%` for at-a-glance status.
- **`src/app/admin/results/[eventId]/page.tsx`** rewritten. AdminStrip + breadcrumb (`← /admin · /results/05`). Two-column hero with Boldonse `{COUNTRY} / {SESSION}` + flag emoji + "Session ended Xh ago · Manual entry" caption + track diagram right.
- **`src/app/admin/results/[eventId]/results-form.tsx`** rewritten with two-column layout. Left column: "CLASSIFIED PODIUM" with three big slot cards — each card has the position number (P1 in accent red), driver portrait, Boldonse driver name, hex-tinted #num + team-short line, and a "Change" button that expands an inline auto-fill driver grid (clicking selects + auto-collapses). Right column: "SCORE PREVIEW" computed live via `computeScore` against every friend's prediction as the admin's slot picks change. Each row shows display name + pick chips + computed `+points` (accent red on perfect-podium / ≥10 pts), with breakdown copy ("3 exact · perfect podium · +3"). Two CTAs: "Save" (writes results + scores) and "Save + Reveal to group →" (chains write + reveal in one click).
- **`src/app/admin/results/[eventId]/actions.ts`** gained `fileResultsAndRevealAction` — runs `writeResultsWith` then `revealEventWith`, revalidating `/admin`, `/admin/results/[id]`, and `/reveal/[id]` on success. Result is a discriminated union with a `stage: "write" | "reveal"` field so the form can identify which step failed.
- **`SKILL.md`** — admin out-of-scope clause replaced with an "Admin pages — in scope" section that names the canvas references + the admin-strip affordance.

99/99 still green: 97 Vitest + 2 Playwright. Typecheck + lint + build clean.

Gotchas:
- **`computeScore` on the client.** The score-preview column imports `@/lib/computeScores` directly. The function is pure (no Supabase, no Node-only imports), so it's bundle-safe — but if anyone adds a server-only dependency to that module later, the form will fail to compile. Worth a comment in the file if it gets nudged.
- **Cron last-run timestamps not stored.** The status strip falls back to schedule + active dot. To match the canvas's "04:30 UTC · success" labels, we'd need a `cron_runs (path, ran_at, status)` table written by the catch-path of each route. Captured as a follow-up; not blocking.
- **Country-from-event-name lookup is duplicated.** `/admin/page.tsx` and `/admin/results/[eventId]/page.tsx` both inline the same `EVENT_NAME → ISO country code` map. If a third use case appears, extract to `src/lib/design/eventName.ts` (alongside `shortEventName`).
- **`fileResultsAndRevealAction` redirects via the client.** The action returns `{ ok: true }` and the client form calls `router.push("/reveal/<id>")`. We could redirect server-side via `redirect()` inside the action, but that'd lose the success feedback briefly visible in the form. Keeping the client-side push.
- **`Save + Reveal` is disabled when already revealed.** Reveal isn't safely re-triggerable (would re-flip `revealed_at` to a fresh now), so the button greys out post-reveal. Save is always available so admins can update scores in place.
- **`results-form.tsx` "Change" button uses a slot-scoped grid expansion, not a modal.** The skill bans modals for secondary actions. Inline grid that expands below the slot card matches the canvas.

**2026-04-29 — Refinement pass against design-screenshots/.** User supplied 11 PNG screenshots in `design/design-screenshots/` as visual ground truth and asked to align every player-facing screen against them via the new `design-handoff` skill. Admin pages explicitly out of scope. Playwright still 2/2 green; vitest still 97/97; build clean.

Delivered:

- **`/join` rewritten from scratch.** Was the only screen still on Phase-0 plain styling. Now ports `screens-aux.jsx:JoinScreen`: split layout (1fr/1fr on desktop), left panel has the checkered conic-gradient start-line backdrop + accent square dot eyebrow + `LIGHTS / OUT.` Boldonse hero (clamp 64–128px) + descriptive paragraph + `2026 Season · Private League` footer. Right panel: `STEP 1 OF 2 · ENTER INVITE` eyebrow + `THE CODE` Boldonse + monospace input styled with letter-spacing 0.18em + accent-bordered focus state + Boldonse `Continue → Sign in with Google` CTA + helper copy.
  - **Single input, not six boxes.** Production codes vary in length (`LECLERC-FTW-2026` is 16 chars), so the canvas's 6-box treatment can't be ported literally; we get the same visual weight via Geist Mono + 24px text + 0.18em letter-spacing + accent-on-focus border.
  - Button uses `aria-label="Continue"` so the existing E2 Playwright assertion (`getByRole("button", { name: "Continue" })`) keeps matching while the visible text reads `Continue → Sign in with Google`.
- **`/dashboard` calendar grid refined.** Per canvas: cell eyebrow flipped from `R01 · MAR 8` to `FRI · MAR 8` (day-of-week + date) with status tag (`Next` / `Revealed`) right-aligned. Removed per-cell KM/LAPS meta (those only appear in the hero now). Track diagram is the dominant element in each cell, centered. Revealed cells wrap the diagram in a `<Link>` to `/reveal/<id>` so the whole layout is clickable.
- **`/dashboard/predict` season-stat hero block.** Right side of the hero now reads `YOUR SEASON · X OF 24 RACES` + `{points} pts` Boldonse + `P{rank} in The Group · Y perfect podiums`. Sums my `scores` and computes my rank from a single `scores` query. Title broken across two lines (`LOCK / YOUR PICKS`) per canvas.
- **`/dashboard/predict` revealed/upcoming row chips.** `RoundList` now takes a `kind: "revealed" | "upcoming"` prop. Revealed rows render mini pick chips (P1/P2/P3 driver codes in Geist Mono badges) plus the user's `+points` in accent-red Boldonse. Upcoming rows render `Picks open T-7d` placeholder. Section titles read `REVEALED · X RACES` / `UPCOMING · X RACES` inline.
- **`/dashboard/predict/[eventId]` group-hot-picks variant.** Empty slot cards now show `Group's hot picks for P{slot}: NOR · VER · RUS` (top-3 driver codes counted from all friends' predictions for the event) instead of the generic "Pick a driver to see…" copy. Falls back to the generic copy when no group picks exist (early in the season). Eyebrow copy switched to `Round X · Race · Picks needed`.
- **`/dashboard/standings` season summary + recent winners.** Added a 3-cell stat strip below the standings (`Races complete` / `Different winners` / `Sprint races` — only cells we can compute; `Pole sitters` would need qualifying ingest, `Fastest laps` is an explicit `.impeccable.md` non-feature). Added a `RECENT WINNERS` 5-card strip with track diagrams + winner portraits + team-color top stripe. Pulls last 5 `historical_races` rows + matching P1 winners from `historical_results`.
- **`/dashboard/league` leader watermark.** Bumped the favorite-team livery car on the P1 leader card from 0.18 to 0.4 opacity and 360→480px width to match the canvas's prominent leader-card livery treatment. P2/P3 cards stay at the muted 0.18.
- **`/profile` welcome eyebrow.** Replaced em-dash separator with bullet (`Welcome · Set your colours`) per canvas.

99/99 still green: 97 Vitest + 2 Playwright. Typecheck + lint + build clean.

Gotchas:
- **Stale Turbopack dev cache.** After the file edits, `bun next dev -p 3001` served `/join` as 404 even though the page compiled (build passed clean). Fix: `rm -rf .next && bun next dev -p 3001`. Subsequent dev runs after file changes have been clean — this was a one-off cache desync from yesterday's session.
- **Pole-sitters / Fastest-lap data not available.** The 5-cell season-summary strip from the canvas reduced to 3 cells. Adding the missing two would require ingesting qualifying sessions into `historical_results` (currently only race + sprint). Captured as a follow-up; not blocking Miami.
- **Standings recent-winners needs a 4th query.** Original Promise.all in the page fetched 5 things; I added a 6th (`events` filtered to `season=2026, session_type='race'`) for the circuit + name lookup. Could fold into the existing `events` query but that one's currently selecting different columns; keeping them separate for now.
- **`hotPicks` server query is per-event not cached.** Each predict-detail page render runs an extra `predictions` count by event_id. ~10 friends × 1 query = trivial; if friends grow we'd cache.
- **`/join` button accessible-name vs visible text.** `aria-label="Continue"` keeps Playwright `getByRole({name: "Continue"})` working but means screen-reader users hear only "Continue" without the "Sign in with Google" hint. If accessibility-of-affordance-clarity becomes a concern, switch to a visually-hidden span pattern instead.

**2026-04-28 (latest⁶) — Reveal cinematic intro shipped.** The deferred RAF-driven beats from the design canvas are now live, ported to Framer Motion (no requestAnimationFrame loop required).

Delivered:
- **`src/app/reveal/[eventId]/reveal-stage.tsx`** — new `CinematicHero` band runs above the podium when reveal is open. Five elements drive the intro:
  - **Stripe wash bg** — diagonal repeating-linear-gradient at 6% accent-tint, fades in over 1.4s.
  - **Title slam** — Boldonse italic Grand-Prix name (clamp 56–168px) slides in from `x: -80, skewX: -8°` to `0, 0` over 1.4s on `EASE_OUT_QUART`. Eyebrow + subtitle + datetime/circuit/length copy fade in alongside.
  - **Livery sweep car** — winner's `teamMeta(p1).carSrc` translates from `x: -60%` to `x: 120%` of its parent over 1.6s starting at 0.6s, with a blur+opacity envelope (`[0,1,1,0]` × `times: [0, 0.05, 0.95, 1]`) so it ramps + ramps off cleanly. A sibling speed-line gradient strip travels at the same pace, no blur, for the racing-stripe wash. Both render only when a `sweepTeam` is resolved server-side.
  - **Track-draw transition** — full-width 200×120 viewBox SVG using the same `trackPath()` library. `motion.path` animates `pathLength: 0 → 1` over 0.9s starting at 2.0s with `EASE_OUT_QUART` (FM internally drives strokeDasharray + strokeDashoffset). Falls back to a horizontal stroke when no path exists for the circuit.
  - **Replay button** — top-right, fades in at 2.9s. Bumps a `playKey` state which is appended to every motion node's `key`, forcing FM to re-mount and replay the full 9.5-second sequence on demand.
- **Sequencing** — podium delays now derive from the cinematic timeline (`PODIUM_BASE_DELAY = 3.3s`) and pick delays cascade from podium completion (`pickFlipBaseDelay ≈ 4.9s`). Friend cards stagger at 150ms after that. The full sequence plays in ~9.5s end-to-end matching the canvas.
- **Reduced-motion path** — when `useReducedMotion()` returns true, the cinematic is skipped entirely (renders the simpler `StaticHero` instead) and all `delay: ...` values collapse to 0 so podium + friends appear instantly. Not a "play it slower" hack — the whole intro sequence is structurally absent for that audience.
- **`src/app/reveal/[eventId]/page.tsx`** — refactored. The page-level static hero is now only used for gated states (no-results, awaiting reveal). For the reveal-open path, `RevealStage` owns the hero so its motion components can wrap the title/sweep/track elements directly. Page passes a `hero` prop bundling `short`/`circuit`/`circuitKey`/`trackPath`/`sessionDateLabel`/`lengthKm`/`laps`, plus the resolved `sweepTeam` (`teamMeta(winner.team)` or null).

99/99 still green: 97 Vitest + 2 Playwright. Typecheck + lint + build clean.

Gotchas:
- **`WebkitTextStroke` isn't FM-tweenable.** Tried the canvas's outline-→-fill text trick on the "Grand Prix" subtitle; FM types reject `WebkitTextStroke` in `TargetAndTransition`. Replaced with a simpler 0.5s opacity fade on a muted-fg color so the subtitle still arrives slightly after the main slam.
- **Sweep translation in % of parent, not viewport.** Using `x: ["-60%", "120%"]` keeps the motion correct across breakpoints without measuring `window.innerWidth`. The car element's own width is clamped to `min(1100px, 70vw)` so it never overflows on small screens.
- **`playKey` re-mount strategy.** Replay needs every motion component to reset to its `initial` state. Re-keying parent motion nodes alone doesn't propagate; each child motion node also takes the same suffix (`hero-${playKey}`, `podium-${pos}-${playKey}`, etc.). Cleaner than fiddling with `animate` controls + manual reset.
- **Cinematic in `RevealStage`, not in `RevealShell`.** Originally tempted to keep the static hero in the page-level shell and overlay an animated band on top. But that meant the static markup would flash before the cinematic mounted. Moving the hero into the client stage means the cinematic *is* the hero from first paint.

**2026-04-28 (latest⁵) — Design port Pass 3 + Pass 4 shipped.** Phase 7 complete. Predict-detail, World standings, League, and Reveal now match the Claude design canvas.

Delivered:
- **`/dashboard/predict/[eventId]`** + **`driver-picker.tsx`** rewritten. Page is now: TopBar + 3-col hero (Boldonse Grand-Prix name | track diagram | live countdown). Picker switched from `<select>` dropdowns to a click-to-pick model: 3-col slot cards (P1 wider 1.2fr) with team-livery watermark cars at 32% opacity, big Boldonse `P1/P2/P3` numerals, DriverPortrait + driver chip + team-tinted badge, per-slot telemetry strip (form L5 · at-track podiums (10y) · quali Δ race with success/warning/fg color shifts). Below: 10-col auto-fill driver grid (min 96px) with team-color top border, click to fill next empty slot, ✓ overlay + 0.4 opacity on picked. Sticky bottom lock bar with live countdown that flips amber + pulses inside T-60s.
- **`/dashboard/standings`** rewritten. TopBar + Boldonse "WORLD STANDINGS" hero with completed-rounds count. Right side has the Championship Leader card with team-livery bg, driver portrait, hex-tinted team line, pts/wins/podiums tally (computed inline from `historical_results`). Two-column main: driver standings (1.5fr) with left-edge 3px team-color stripe, portrait, gap-to-leader line, team logo + short, W/POD/PTS columns; constructor cards (1fr) with bar-chart-of-leader background fill (linear-gradient `${hex}33 → transparent`) + team logo + drivers + W/P tally line.
- **`/dashboard/league`** rewritten. TopBar + Boldonse "LEAGUE STANDINGS" hero + "X / 24" rounds-completed counter (counts `events.session_type=race AND revealed_at IS NOT NULL`). 3-col podium block in P2 | P1 (wider 1.3fr, centered) | P3 visual order, with the leader's pos number in accent red. Each podium card uses the user's `favorite_team.carSrc` as a watermark and tints the team line with the team hex. Positions 4–N render as bar-chart rows: rank | initial circle bordered with fav-team hex | name + team line (+ PP + 🔥 streak) | bar showing `points / leaderPts × 100%` | total pts in mono.
- **`/reveal/[eventId]`** + **`reveal-stage.tsx`** redesigned. New page shell: TopBar + 3-col hero (Boldonse "X GRAND PRIX" + accent eyebrow | track diagram | session datetime / circuit / length). Result podium: 3-col P2 | P1 | P3 (leader 1.4fr with accent-red P-number + bigger portrait), each card waters down the team's livery car at 18% opacity in the top-right. Friend pick gallery: auto-fill 280px-min cards on a single grid (1px border gutters), each with Boldonse display name + mono points (accent-red on perfect podium), Perfect-podium chip, then per-slot rows with DriverPortrait + code + team-tinted border. **Framer Motion choreography preserved**: 300ms flip, 200ms result stagger P3→P2→P1, 400ms silence beat, 150ms pick stagger. `useReducedMotion()` keeps the whole animation off when requested.
- **Deferred (post-Miami):** the design canvas's RAF-driven title-slam + livery-sweep + track-draw beats (0–2.9s). Pass 4 brief explicitly scoped to "timing tweaks + portrait imagery, not a rewrite" — full cinematic sweep stays captured in `design/screens-reveal.jsx` for a follow-up polish pass.

99/99 tests green: 97 Vitest + 2 Playwright. Typecheck + lint + production build all clean.

Test fixes (stale Playwright assertions from Pass 2):
- E1 expected `WELCOME` heading; Pass 2 changed it to "PICK YOUR / SIDE OF THE GRID." → loosened to regex `/pick your.+side of the grid/i`.
- E1 expected button `/continue/i`; profile-form button reads "Save & enter the paddock →" → updated regex to `/save.+paddock/i`.
- E1 expected `getByText(email)` on dashboard; new TopBar deliberately doesn't surface the email (just initial avatar + ⏻). Replaced with assertions on the Sign out button + the hero `/grand prix/i` heading.

Gotchas:
- **Picker UX shift.** Old picker used `<select>` per slot with a `Change pick` ghost button. New picker is click-to-pick — clicking a driver fills the earliest empty slot; clicking a picked driver in the grid removes it (toggle). The slot card's "Change pick" link still clears that slot. Distinct-driver UX guard remains; sprint variant still hides P2/P3 entirely.
- **Sticky lock bar pulse.** Lives inside the picker form so it stays attached to the submit button. Inline `@keyframes lockBarPulse` (0.5s alternate). The original `LockCountdown` component is no longer rendered on this page; the picker has its own ticking countdown to feed both the bar status text and the warning-state pulse.
- **Constructor bar-chart fill.** Implemented via an absolutely-positioned `linear-gradient(90deg, ${hex}33, transparent)` div behind the row content (hex+33 = ~20% alpha). Width is `(c.points / leaderPts) * 100%`. Reads as "pixel-mass" of leader-relative strength without overpowering the type.
- **League rounds counter.** "After X of 24" sources from `count(events where session_type='race' and revealed_at is not null)`, NOT scored events — because `scores` rows can be filed pre-reveal during admin entry. The reveal is the public-facing source of truth for "this round counted".
- **Reveal eyebrow time-state.** Removed the old "LIVE / Results in" toggle from the design canvas — that hooked into the RAF timeline (`t > BEATS.silence.end`). Without that timeline, the eyebrow just says `Reveal · R0X · {SESSION}`. Acceptable simplification.
- **Standings wins/podiums tallies.** Use `historical_results` rows where `session_kind='race'` (excludes sprint races from the wins count, matching F1.com's display convention). Sprint wins are visible only via the Constructor "Drivers · WW · PP" line.
- **Date-format snapshot bias.** The dashboard hero countdown reads from a server-rendered `Date.now()` snapshot — accurate at render, lagging by render-window delta thereafter. The picker page's hero has the same snapshot quirk; the live picker countdown lower in the page is the authoritative tick.

**2026-04-28 (latest⁴) — Design port Pass 2 polish + Antonelli standings bug.** Iterative tweaks after the initial Pass 1 + Pass 2 land:

- **F1 wordmark SVG.** New `src/components/F1Mark.tsx` (white "F1" + 3 red speed bars, lifted from `design/data.jsx:F1Mark`). Replaces the plain "F1" text on `/login` and inside TopBar. TopBar restructured per design canvas: F1Mark only on the left, "THE GROUP · 2026" eyebrow + user initial + sign-out icon on the right; no more "Fantasy · The Group" subtitle on the left.
- **Driver portrait completeness.** Copied curated portraits for COL/PER from `design/assets/drivers-portrait/`; used headshots from `design/assets/drivers/` for BOT/LIN. `RIGHT_FACING_CODES` set in `drivers.ts` mirrors BOT/LIN via CSS `transform: scaleX(-1)` so all 22 portraits face left consistently.
- **Antonelli standings bug.** `resolveDrivers` only matched on full canonical name. Jolpica returns `givenName: "Andrea Kimi"` + `familyName: "Antonelli"` → "andrea kimi antonelli", but our DB had `full_name: "Kimi Antonelli"` → no match → `drivers.ergast_id` null → backfill skipped his rows → 72 pts vanished from totals. Fix: fall back to last-name match when full canonical name fails (only when last name is unique across active roster — guards against Schumacher-Schumacher-style collisions). Regression test J3b. Cross-verified against Jolpica `/2026/driverStandings` AND OpenF1 `/session_result` — both confirm ANT P1 (72 pts), RUS P2 (63), LEC P3 (49). Constructor totals also re-sort: Mercedes 135 (was 63) leaps over Ferrari 90.
- **`shortEventName` helper** + adjective→country mapping table (`Australian Grand Prix` → `Australia`, `Saudi Arabian` → `Saudi Arabia`). Wired into Dashboard hero, Calendar grid, Predict-list hero, and Predict-list rounds. 3 unit tests D10–D12.
- **`circuitMeta` static map** of track length + lap count for 24 circuits, keyed by Jolpica `circuit_id` with OpenF1 short-name aliases. **Why static**: neither OpenF1 `/sessions` nor Jolpica `/circuits` returns these on schedule payloads. Wired into Dashboard hero, Dashboard calendar cards, Predict-list hero, and Predict-list rounds. 3 unit tests D13–D15.
- **Date-range helpers.** `formatDateRange` (dashboard) + `dateRange` (predict-list) — derive weekend start/end from all sessions in the round; format as "1 May - 3 May" / "30 May - 1 Jun" (day-first, title-case month, ASCII hyphen) per user spec.
- **Constructor standings rail** added to Dashboard, replacing the Friends-leaderboard rail (which already lives on `/dashboard/league`). Both rails source from Jolpica `historical_results`.
- **Predict-list grouping.** Was showing one row per session ("Miami Sprint Race", "Miami Qualifying", "Miami Race"); now aggregates by `(season, round)` so the list reads as one row per weekend ("Canada", "Monaco", …). Sprint badge surfaces on the meta line for sprint weekends. Capped at 5 upcoming rounds.
- **Section headers.** "REVEALED" / "UPCOMING" promoted from mono eyebrow to Boldonse 24-px display headings, matching dashboard's "2026 CALENDAR" treatment.
- **Login title.** Changed from multi-line "CALL / THE RACE." to single-line "CALL THE RACE." at clamp(48px, 7vw, 80px) to avoid Boldonse multi-line ascender clipping.

90/90 Vitest still green; 6 new design tests bring the design module total to 21 (D1–D15 + canonicalize/eventName).

**2026-04-28 (latest³) — Design port Pass 1 + Pass 2 shipped.** Foundation + Login/Profile/Dashboard/Predict-list redesigned per `plans/2026-04-28-design-port.md`. Pass 3 (predict-detail/standings/league) and Pass 4 (reveal) still ahead.

Delivered:
- **`public/assets/`** populated with ~36MB of design canvas imagery: 20 driver headshots + 20 portrait crops + 10 team livery cars + 10 team logos. `src/middleware.ts` matcher updated to exclude `/assets/` (it was being session-gated → 307 → /join).
- **`src/app/globals.css`** — Boldonse padding-top + line-height: 1.05 fix to absorb the font's deep ascenders/descenders. `data-tight` opt-out for tight-leading cinematic display. `--team-*-hex` CSS vars for the 10 teams (paired with existing `--team-*` OKLCH for borders + dot accents). `--ease-in-out-cubic` motion curve.
- **`src/lib/design/{teams,drivers,tracks}.ts`** — three single-source-of-truth modules. Teams map keyed by team string with alias resolution (handles "Red Bull Racing"/"Audi"/"RB F1 Team" → canonical slug). Drivers helper returns null portrait/headshot src for codes outside the asset set so the new `DriverPortrait` component falls back to an initial-letter avatar tinted with the team's hex border. Tracks library lifts 12 stylized SVG paths from `design/data.jsx` with OpenF1↔Jolpica circuit aliasing.
- **`src/components/{TopBar,TrackDiagram,DriverPortrait}.tsx`** — three reusable design-system components.
- **`/login`** — split layout, rotated Ferrari livery on the left with diagonal stripe pattern + speed-line gradient + "MIAMI GP — MAY 4" footer; "CALL THE RACE." Boldonse hero + Google button on the right.
- **`/profile`** — TopBar + "PICK YOUR SIDE OF THE GRID." hero (welcome mode) + side-by-side team/driver pickers (5-col grids with selected-state team-color border + outline) + "All-Time Hero" card with free-text past driver + McLaren MP4/4 illustration.
- **`/dashboard`** — TopBar + hero next-race card (Boldonse race name + track diagram + lock countdown + "Make predictions →" CTA on diagonal-gradient bg) + 24-cell calendar grid (track diagram thumbnail per round + status badges: Next/Revealed) + driver standings rail (top 6 with portraits + team color bar) + friends rail (top 5).
- **`/dashboard/predict`** — TopBar + "LOCK YOUR PICKS" Boldonse hero + 3-col next-event card (round info + track diagram + picks-needed/Continue panel) + two-column Revealed/Upcoming lists with R## label + track diagram + Boldonse race name.

90/90 Vitest green (was 81; +9 design tests). Typecheck + lint + production build all clean. Visual verification via Playwright screenshots: login, profile (welcome), dashboard, predict-list all render correctly with team logos, driver portraits + initial-fallbacks, track diagrams, and tabular figures.

Gotchas:
- **`/assets/` middleware gate.** Production assets at `public/assets/*` were redirected to `/join` until the middleware matcher excluded them. Symptom: broken `<Image>` tags showing alt text. Fix: extend the existing `(?!_next/static|_next/image|favicon.ico)` exclusion list with `assets/`.
- **Boldonse + tight line-height.** The font's ascenders/descenders bleed past its line-box at any line-height < 1.1. The global fix uses `line-height: 1.05; padding-top: 0.12em; padding-bottom: 0.04em`. For multi-line cinematic display titles ("CALL THE RACE." stacked on `<br/>`), even the data-tight 0.95 leading shows visible overlap — production solution is to keep multi-line hero headlines on one line where possible (font-size: clamp ≤72px) instead of fighting the metrics.
- **Design canvas reserve drivers vs production roster.** Design `data.jsx` lists 20 drivers; OpenF1 2026 seed has 22 (adds COL/PER/BOT/LIN, drops DOO/TSU). Solution: `DriverPortrait` falls back to initial avatar tinted with the team's hex when no PNG exists for that code. No alt-text breakage.
- **Logo extension drift.** `redbull.jpg` and `haas.jpg` (not `.png`). Encoded into `TEAM_META.logoSrc`.

**2026-04-28 (latest²) — Design port planned (not yet implemented).** User supplied a Claude-design canvas at `design/` (`F1 Fantasy.html` + 6 screens-*.jsx files + `data.jsx` + `assets/{drivers,drivers-portrait,cars,logos}`). Plan written to `plans/2026-04-28-design-port.md`. Four-pass scope:

1. **Pass 1 — Foundation:** copy `design/assets/*` → `public/assets/*`; add design tokens to `globals.css` (Boldonse line-height fix; `--team-*-hex` vars; motion curves); new modules `src/lib/design/{teams,drivers}.ts` lifting TEAMS + DRIVERS data fixtures from `data.jsx`; new components `src/components/{TopBar,TrackDiagram,DriverPortrait,F1Car}.tsx`.
2. **Pass 2 — Core screens:** Login (split layout + cinematic hero), Profile (5×2 team + driver grids + Senna hero card), Dashboard (4-col calendar grid + standings rails), Predict-list (3-col next-event hero + revealed/upcoming columns).
3. **Pass 3 — Standings + Predict-detail:** Predict-detail (slot cards w/ watermark cars + 10-col driver grid), World standings (livery leadership card + striped driver table + bar-chart constructors), League standings (podium 3-column + bar-chart positions 4–10).
4. **Pass 4 — Reveal:** five-beat choreography (title slam + livery sweep → track draw → staggered podium reveal w/ portraits → friend pick cards → leaderboard reorder). Already mostly there; mainly timing + portrait imagery.

No DB schema changes. All deltas are component / asset / styling work. Risk: Boldonse selector breadth, asset weight (~MB for 60 PNGs), team logo trademarks (private friend league only — already documented in `CLAUDE.md` "What NOT to do").

**2026-04-28 (latest) — Jolpica historical layer shipped.** Foundation + nudges + standings together per `plans/2026-04-28-jolpica-historical.md`. Adds OpenF1's missing pre-2023 history.

Delivered:
- **`src/lib/text/canonicalize.ts`** — shared `canonicalizeName` (hoisted out of refreshNudges) + new `canonicalizeCircuit`. Both strip diacritics via `NFD` normalization (so `Pérez` → `perez`, `Hülkenberg` → `hulkenberg`).
- **`src/lib/jolpica/`** — full client subsystem: `client.ts` (fetch + 6-attempt 429 backoff with Retry-After + paginator), `types.ts` (Ergast response shapes), `resolveDrivers.ts` + `resolveCircuits.ts` (populate the new `ergast_id` columns), `backfillResults.ts` (UPSERT `historical_*`), `atTrackPodiums.ts` (single SQL aggregate), `config.ts` (window constant + base URL + throttle).
- **`supabase/migrations/20260429000000_jolpica_foundation.sql`** — adds `drivers.ergast_id`, `events.ergast_circuit_id`, two new tables `historical_races` + `historical_results` with composite PK + indexes. RLS select-all, service-role writes only.
- **`supabase/migrations/20260429000100_driver_nudges_nullable_podiums.sql`** — drops NOT NULL on `at_track_podiums` so the predict UI can render `—` when a circuit hasn't been resolved.
- **`scripts/backfill-jolpica.ts`** — one-shot CLI; runs the resolvers + then iterates seasons. 10-season fill (2017–2026) ≈ 120 requests / 3 min.
- **`/api/cron/refresh-jolpica-current`** — Bearer-gated, 5-min `maxDuration`, current-season-only. New `vercel.json` slot at 04:20 UTC (between fetch-results and refresh-nudges).
- **`sync-f1-data`** — now also calls `resolveDrivers` + `resolveCircuits` after the OpenF1 sync (best-effort, doesn't abort if mapping fails).
- **`refreshNudges`** — at-track signal moved off OpenF1's 4-year window, onto Jolpica's `historical_results` via `atTrackPodiumsFor` over a 10-year window. Drops 4 OpenF1 fetches per refresh.
- **`/dashboard/standings`** — primary read is now Jolpica-canonical `SUM(historical_results.points)` for current season; falls back to recomputing via `pointsForPosition` from `session_classifications` for any race finished but not yet Jolpica-ingested. UI shows "Latest ingested race · YYYY-MM-DD" + a backstop-row count.
- **Predict UI labels** — every historical aggregate now carries the timeframe inline: `Podiums @ Miami (last 10 yrs)`, `Race-day gain (this season)`. Tooltip on the latter explains sign convention.

81/81 Vitest green (64 → 81 = +17 from this session: 2 canonicalize + 4 client J1/J1b/J2/J2b + 1 J3 + 1 J4 + 2 J5/J6 + 3 J7/J8/J7b + 2 J9/J9b + 2 NudgeStrip-related). +2 Playwright = 83/83. Typecheck + lint + production build all clean.

Validation against real Jolpica (10-season backfill ran end-to-end): 198 historical_races, 2620 race rows + 390 sprint rows. Verstappen's Miami at-track count: 3 (was 2 with OpenF1's 2-yr window — added the 2022 P3 Jolpica had but OpenF1 lacks). 2026 standings populate correctly (RUS leads, then LEC, HAM, NOR, …).

Gotchas:
- **Driver name diacritics.** Pérez and Hülkenberg silently dropped on first backfill until `canonicalizeName` got NFD diacritic-stripping. Fix landed; both match now.
- **Circuit short_name divergence.** OpenF1 short names ("Catalunya", "Spa-Francorchamps", "Singapore", "Interlagos") don't match Jolpica's `circuitName` or `Location.locality`. Small explicit `ALIAS` map in `resolveCircuits.ts` covers them — extend it as new mismatches appear.
- **Composite-FK joins via supabase-js.** `(season, round)` joins aren't supported by the implicit FK syntax; `atTrackPodiumsFor` does two round trips (races at circuit, then count of driver's podiums at those rounds via dynamic `or(…)` filter). Acceptable at our scale.
- **`numeric` returns as string from PostgREST** (already-known); the standings page coerces `historical_results.points` via `Number(...)` defensively.

**2026-04-28 (later) — Track B shipped: auto-fetch + standings + Resend.** All three Phase-3-and-4 deferred items closed in one pass.

Delivered:
- **`src/lib/email/notifyAdmin.ts`** — Resend wrapper. No-op when `RESEND_API_KEY` or `ADMIN_EMAIL` is missing; never throws. 4 unit tests E1–E4. Wired into the catch path of all three cron routes (`sync-f1-data`, `fetch-results`, `refresh-nudges`).
- **`src/lib/results/parsePodium.ts` + `fetchResults.ts`** — pure podium extractor (5 tests F1–F5) + cron orchestrator. Walks the last 20 past events with an `openf1_session_key` and no results row, pulls `/session_result`, calls the new `writeResultsService` (auth-skipping variant of `writeResultsWith`; trust boundary is the Bearer secret), and UPSERTs full classification rows for the standings page.
- **`/api/cron/fetch-results`** — Bearer-gated, 5-min `maxDuration`. New row in `vercel.json` schedule (04:15 UTC, between sync-f1-data and refresh-nudges).
- **`supabase/migrations/20260428110000_session_classifications.sql`** — `(event_id, driver_id, position)` cache, RLS select-all, service-role writes only.
- **`src/lib/standings/computeStandings.ts`** — `pointsForPosition` (race 25/18/15/12/10/8/6/4/2/1, sprint 8/7/6/5/4/3/2/1), `computeDriverStandings`, `computeConstructorStandings`. 8 unit tests S1–S8.
- **`/dashboard/standings`** — full implementation replacing the stub. Two-column layout (drivers + constructors), team color-dot, tabular figures, empty-state copy until first race fills the cache.
- **`writeResultsService`** — extracted from `writeResultsWith` so the cron can call the pipeline without an admin caller. `writeResultsWith` now delegates after the auth/admin gate.

64/64 Vitest green (47 → 64 = +17 from this session: 4 email + 5 parsePodium + 8 standings). +2 Playwright = 66/66. Typecheck + lint + production build all clean.

Gotchas:
- **Resend test type-narrowing.** `NotifyResult` is a discriminated union, so `result.reason` is only present on the `sent: false` branch. Tests assert via `if (result.sent) throw …` to narrow before reading `.reason`.
- **Standings empty path.** Until cron fills `session_classifications`, the page renders an empty state pointing to the friend league. No Friday-Miami crash if the cron hasn't run.
- **Cron schedule order matters.** sync-f1-data (04:00) seeds `events.openf1_session_key`, then fetch-results (04:15) consumes it, then refresh-nudges (04:30) reads results. Don't reorder without rethinking dependencies.

**2026-04-28 — Telemetry nudges shipped (Phase 4 carry-over).** Three pure aggregation primitives in `src/lib/nudges/computeNudges.ts` (`recentForm`, `atTrackPodiums`, `qualiRaceDelta`) — 12 unit tests N1–N12 green. Cache table `driver_nudges` added (migration `20260428100000_driver_nudges.sql`, RLS select-all, service-role writes only). Orchestrator `src/lib/nudges/refreshNudges.ts` walks OpenF1 race + qualifying sessions across the current + prior season, filters to recent races (last 5) and at-circuit history, pairs grid vs. classified per current-season race, and UPSERTs one row per (event, driver). New cron route `/api/cron/refresh-nudges` (Bearer-gated, 5-min `maxDuration`) scoped to events within the next 10 days. Vercel cron schedule wired in `vercel.json` (04:30 UTC daily, after `sync-f1-data` at 04:00). Predict screen reads cache and renders a 3-column nudge strip under each chosen driver.

49/49 tests green (47 Vitest + 2 Playwright). Typecheck + lint + production build all clean.

Gotchas:
- **`numeric` returns as string from PostgREST.** `quali_race_delta numeric(4,1)` comes back as `"0.7"` not `0.7`. Page coerces with `Number(n.quali_race_delta)`.
- **OpenF1 `session_name=Race` filter.** OpenF1 distinguishes `Race` from `Sprint` via `session_name`; filtering by `session_type=Race` doesn't narrow because `session_type` is `Race` for both. We filter by `session_name=Race` and `Qualifying` explicitly.
- **History depth tradeoff.** 2 seasons of races + a quali fetch per current-season race ≈ 30+ OpenF1 requests per refresh per upcoming event, throttled at 350ms. Within Vercel's 5-min `maxDuration`. If we add more seasons, raise the cap or split the cron.

**2026-04-20 (very late) — UX pass: Google OAuth + fluid layout + welcome setup.** Two real usage issues surfaced: (a) narrow 768px column on desktop monitors, and (b) signing out left the user locked out of `/join` on next sign-in. Fixed both plus added the long-missing first-time profile-setup flow.

Delivered:
- **Magic-link auth removed, replaced with Google OAuth.** `src/app/login/page.tsx` now renders only a **Sign in with Google** button (`src/app/login/google-button.tsx`, client component calling `supabase.auth.signInWithOAuth({ provider: 'google' })`). Deleted `login-form.tsx` + `login/actions.ts`. `supabase/config.toml` has `[auth.external.google]` enabled with `skip_nonce_check = true` for local PKCE.
- **Invite cookie is now sticky across sign-outs.** `src/app/signout/actions.ts` no longer deletes the invite cookie. Reasoning: it's a device-level capability token, not a session token. Returning users skip `/join` automatically.
- **First-time profile setup is mandatory.** `/auth/callback` checks for a null `display_name` and redirects to `/profile?welcome=1`. The welcome mode (`src/app/profile/{page,profile-form,actions}.tsx`) shows a friendly onboarding copy, hides the back link, and requires `display_name`. Server action uses `redirect()` (not client-side router) so the dashboard's defensive guard doesn't race with the DB write. Dashboard has a defensive redirect too, so direct navigation can't bypass setup.
- **Fluid full-screen layout.** 8 content pages (dashboard, predict list + picker, league, standings, admin, admin results, reveal) moved from `max-w-3xl`/`4xl` to `max-w-[1600px]` with responsive `px-6 sm:px-8 lg:px-12 xl:px-16`. Auth pages stay centered (`max-w-xl`). Profile bumped to `max-w-2xl`. Dashboard promoted to 2-col grid (`lg:grid-cols-[2fr_1fr]`) so the wider canvas actually gets used.
- **E1 rewritten.** Google OAuth can't be scripted. Added a test-only `/api/test/sign-in-password` route (404 in production) that uses Supabase's password grant to establish a session + mirrors `public.users`. E1 now exercises: invite → programmatic session → `/dashboard` → welcome redirect → fill name → `/dashboard`. E2 unchanged.

37/37 tests green (35 Vitest + 2 Playwright). Typecheck + lint + build clean.

Setup carrying forward: user needs to create a Google OAuth 2.0 Client in Google Cloud Console and paste `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` into `.env.local`. Steps documented in `CLAUDE.md`. Until those are set, `/login` button will error when clicked.

**2026-04-20 (late) — Phase 5 shipped (share card, profile, sign-out, E2E).** 37/37 total tests green: 35 Vitest (unit + integration) + 2 Playwright (E1, E2). New routes: `/profile`, `/api/share/[eventId]/card.png`. New UI: dashboard sign-out form + Edit profile link, share button in reveal's "THE GROUP" header.

Delivered:
- `tests/e2e/auth.spec.ts` — Playwright Chromium installed. E1 drives the full valid-invite flow including a Mailpit REST-API poll to intercept the magic-link email, then navigates to it and verifies the dashboard. E2 checks invalid-invite inline error without URL change.
- `src/app/signout/actions.ts` — server action clearing both Supabase session AND the invite cookie, then redirecting to `/login`. Dashboard form POSTs to it.
- `src/app/profile/{page,profile-form,actions}.tsx` — profile management. Display name length-capped at 30. Favorite driver/team pulled from active drivers. RLS path via `users_update_own_profile`.
- `src/app/api/share/[eventId]/card.png/route.tsx` — Next.js `ImageResponse` in Node runtime, 1200×630, OKLCH tokens inlined (no `var()` support in ImageResponse CSS). Reveal-gated (`revealed_at` OR 10-min fallback). Public; `/api/share/` added to `src/middleware.ts` PUBLIC_PREFIXES.
- `src/app/reveal/[eventId]/share-button.tsx` — client copy-to-clipboard with "Link copied ✓" confirmation. Placed inline with the "THE GROUP" section header per wireframe refinement.

Gotchas / decisions:
- **ImageResponse CSS.** `ImageResponse` rasterizes a limited JSX subset via Satori. No CSS variables, no Tailwind classes — inlined the OKLCH literals directly. Also every child container needs `display: "flex"` explicitly; Satori throws on implicit block layout when multiple children are siblings.
- **Magic-link E2E.** Playwright polls Mailpit's REST API (`/api/v1/messages?limit=20`) up to 20 × 500ms. The email's body contains both Text and HTML versions of the link; regex matches either. Test cleanup deletes the newly-created `auth.users` + `public.users` row so test emails don't accumulate.
- **Profile page title.** Uses the display name in Boldonse when set, falls back to the user's email. Makes the page feel owned, not generic.

**2026-04-20 (night) — Phase 4 shipped (reveal + leaderboard).** 35/35 tests green (added R1, R2, R3 reveal integration tests). New routes: `/admin` (now with live reveal button + confirm dialog), `/reveal/[eventId]` (Framer Motion flip + gate states), `/dashboard/league`, `/dashboard/standings` (stub).

Delivered:
- `src/lib/revealEvent.ts` — admin-guarded, UPSERTs `events.revealed_at`. 3 integration tests cover admin/non-admin/10-min-fallback paths.
- `src/app/admin/{actions,reveal-button}.tsx` — wired into `/admin` operations dashboard. Replaced the "REVEAL (PHASE 4)" placeholder with a real confirm → action → redirect-to-reveal button. Revealed events now surface a "View reveal →" link instead of a dead chip.
- `src/app/reveal/[eventId]/{page,reveal-stage}.tsx` — the product's emotional peak. Three gate states: no-results-yet · results-in-but-waiting (with 10-min fallback countdown and the user's own pick visible) · full stage with choreographed card flips. Uses `useReducedMotion` to fully disable motion for that audience.
- `src/app/dashboard/league/page.tsx` — sum-of-points leaderboard with 🔥 current-P1-streak badge and PP (perfect-podium) badge. Tied ranks inherit the prior rank number. Per `.impeccable.md` no border-left stripes; current-user row gets `--accent-muted` border + `--surface-2` fill.
- `src/app/dashboard/page.tsx` — smart home. Reveal-waiting card has priority over predict CTA. Added top-3 leaderboard preview and nav tiles for predict / league / standings.
- `src/app/dashboard/standings/page.tsx` — placeholder (Day 10.5 polish).

Gotchas / decisions:
- **Reveal-stage redraw on revalidate.** `revealEventAction` calls `revalidatePath('/admin')` + `revalidatePath('/reveal/[eventId]')` so the admin list and the reveal page both see fresh state without a manual refresh.
- **Framer Motion choreography timing.** Chose absolute `delay` (vs. parent `staggerChildren`) because the result-cards→silence→pick-cards sequence has a 400ms silence beat between the two phases that's easier to express as `pickFlipBaseDelay = resultSlots.length * 0.2 + 0.3 + 0.4`.
- **Telemetry nudges deferred** — per tracker's explicit cut order, if Phase 4 slips, cut telemetry first. Did.

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
- [x] `/api/cron/sync-f1-data` — Bearer-token gated route handler that runs the nightly reconciliation. Verified 401 on unauthorized calls. Vercel cron schedule wired in `vercel.json` (04:00 UTC).
- [x] Resend email alert on fetch failure — `src/lib/email/notifyAdmin.ts` (no-ops without RESEND_API_KEY + ADMIN_EMAIL); wired into catch path of all three cron routes (shipped 2026-04-28).
- [x] `/api/cron/fetch-results` — Bearer-gated. Walks past events with `openf1_session_key` and no results, pulls `/session_result`, runs scoring via `writeResultsService` (auth-skipping pipeline variant). Manual admin entry remains primary; rerun latency post-Miami to confirm reliability for Monaco. (shipped 2026-04-28)

**Exit criteria:** I9 + I10 green ✓. Seeded completed-event fixture → scores + streaks populated per U1–U7 ✓. Re-running produces identical row counts + values ✓. Sprint event rejects race-shape results ✓.

**Tests attached:** U1–U7 ✓ (Phase 1) · I9 ✓ non-admin ADMIN_REQUIRED · I10 ✓ admin writes results → scores + streaks + idempotent · I10b ✓ sprint variant validation guard.

---

### Phase 4 — The Reveal & Leaderboard · ☑

**Goal:** The emotional peak. Admin triggers a coordinated reveal; the leaderboard tells the season story; streaks accumulate; telemetry nudges inform picks.

**Deliverables**
- [x] `/admin` reveal-trigger UI — confirm-dialog button wired to `revealEventAction`, sets `events.revealed_at = now()` and redirects admin to the reveal page
- [x] `/dashboard` smart home — state-aware (reveal-waiting card when user has predicted an event with results filed but not revealed; otherwise predict-next-session CTA; empty state otherwise). Includes top-3 leaderboard preview + nav tiles
- [x] `/dashboard/league` — friend leaderboard. Sum of points per user, streak badges (current P1 streak with 🔥, perfect-podium count with PP badge), tied-rank handling, current-user row surface-lifted per `.impeccable.md`
- [x] `/reveal/[eventId]` — Framer Motion `rotateY` card-flip choreography. Result cards flip first (300ms each, 200ms stagger) → 400ms silence → friend picks flip (150ms stagger). Perfect-podium rows get the Ferrari-red accent badge
- [x] `prefers-reduced-motion: reduce` → instant final state via `useReducedMotion()` — no delay, no rotate, no opacity fade
- [x] Gated pre-reveal state: "Results are in. Reveal opens shortly." with the 10-min fallback countdown. User's own pick visible to them in that view
- [x] 10-min RLS auto-unlock fallback covered by integration test R3
- [x] `/dashboard/standings` — driver + constructor totals from `session_classifications` cache; official 2026 F1 points (race 25/18/15/12/10/8/6/4/2/1, sprint 8/7/6/5/4/3/2/1). Empty state until first race lands. (shipped 2026-04-28)
- [x] Telemetry nudges — `driver_nudges` cache + nightly `/api/cron/refresh-nudges` + 3-column strip under each chosen driver on predict screen (shipped 2026-04-28)

**Exit criteria (session-scoped):** reveal-trigger integration tests pass ✓; full 35/35 test suite green ✓; typecheck + lint + build all clean ✓. E3/E4 Playwright defer to Phase 5 (`bunx playwright install chromium` still pending).

**Tests attached:** R1 ✓ admin sets revealed_at · R2 ✓ non-admin ADMIN_REQUIRED · R3 ✓ 10-minute fallback opens RLS without admin trigger. E3/E4 Playwright deferred to Phase 5.

---

### Phase 5 — Virality & Polish · ☑

**Goal:** Production-grade look, shareable artifacts, responsive, wireframe refinements applied.

**Deliverables**
- [x] `/api/share/[eventId]/card.png` — Next.js `ImageResponse`, 1200×630, reveal-gated (admin trigger OR 10-min fallback), `revalidate: 3600`. Renders placeholder copy for pending events, top-3 podium with perfect-podium red-border treatment for revealed events. Public route; `/api/share/` added to middleware's public prefixes.
- [x] `/profile` — server component with display name (≤30 chars), favorite team dropdown, favorite driver dropdown (active drivers), favorite past driver free text. Server action UPSERTs via RLS (`users_update_own_profile`). Title reads "{DISPLAY_NAME}" in Boldonse.
- [x] Share button inline with "THE GROUP" header on `/reveal/[eventId]` (wireframe refinement) — client `navigator.clipboard.writeText` with 2-second "Link copied ✓" feedback.
- [x] Sign-out server action + link on dashboard (QA ISSUE-004 carry-over). Clears Supabase session AND the invite cookie.
- [x] F1-themed styling pass: Boldonse hero + Geist body + Geist Mono tabular are already applied across predict, reveal, admin, league, profile, and dashboard per `.impeccable.md`. Accent-muted current-user highlights, team-color dots, perfect-podium red border.
- [x] Wireframe refinements applied:
  - Reveal: no fastest-lap orphan (never added); share button inline with "THE GROUP"; perfect-podium uses `border: var(--accent)` not a gradient background
  - Leaderboard: rank col 60px; 🔥 has `apple color emoji, noto color emoji, sans-serif` fallback
  - Predict: hero `clamp(40px, 4.5vw, 72px)`; "Change pick" ghost button; slot cards stretched via `w-full`
- [x] Responsive: min-w-52 on selects so they reflow on mobile; `sm:grid-cols-3` on reveal result cards stacks on phone; touch targets on primary CTAs ≥44×44px

**Exit criteria:** E1 + E2 Playwright pass ✓. Manual visual pass across all pages clean (earlier `/qa` cleared 3 fixes; dashboard + reveal verified in this session).

**Tests attached:** E1 ✓ full signup → Mailpit magic link → dashboard · E2 ✓ invalid invite code → inline error on `/join`.

---

### Phase 7 — Design port · ☐ (planned 2026-04-28)

**Goal:** Apply the Claude-design canvas at `design/` to production. Four passes per `plans/2026-04-28-design-port.md`. No DB changes.

**Pass 1 — Foundation · ☑** (shipped 2026-04-28)
- [x] Copy `design/assets/{drivers,drivers-portrait,cars,logos}/*` → `public/assets/*` (~36MB total)
- [x] `src/app/globals.css` design tokens: Boldonse line-height fix (with `data-tight` opt-out), `--team-*-hex` vars, `--ease-in-out-cubic` motion curve
- [x] `src/lib/design/teams.ts` (TEAM_META keyed by team string with alias map; +6 unit tests D1–D6)
- [x] `src/lib/design/drivers.ts` (DRIVER_META + portrait/headshot src helpers + countryFlag helper; +3 unit tests D7–D9). Known-codes set drives null-on-missing fallback.
- [x] `src/lib/design/tracks.ts` (12 stylized track SVG paths lifted from `design/data.jsx`, alias map for OpenF1 short names → Jolpica circuit_id)
- [x] `src/components/TopBar.tsx` (4-tab nav + user initial + sign-out form)
- [x] `src/components/TrackDiagram.tsx` (200×120 SVG, alias-resolves circuit prop)
- [x] `src/components/DriverPortrait.tsx` (image + initial-letter fallback tinted with team color)
- [x] `src/middleware.ts` matcher updated to exclude `/assets/` (was being gated → 307 → /join)

**Pass 2 — Core screens · ☑** (shipped 2026-04-28)
- [x] `/login` — split layout: rotated Ferrari car + diagonal stripes left, "CALL THE RACE." Boldonse hero + Google button right
- [x] `/profile` — TopBar + Boldonse hero ("PICK YOUR SIDE OF THE GRID.") + 5-col team grid + 5-col driver grid (with portrait fallbacks) + Senna All-Time-Hero card with McLaren car illustration
- [x] `/dashboard` — TopBar + hero next-race card with track diagram + countdown + "Make predictions →" CTA + 4-col calendar grid (22 visible cells with track diagrams + status badges) + driver/friend standings rails
- [x] `/dashboard/predict` — TopBar + Boldonse "LOCK YOUR PICKS" hero + 3-col next-event hero card (info | track diagram | picks-needed + countdown + Continue CTA) + Revealed/Upcoming two-col lists with track diagrams

**Pass 3 — Standings + Predict-detail · ☑** (shipped 2026-04-28)
- [x] `/dashboard/predict/[eventId]` — slot cards w/ watermark cars + 10-col driver grid + sticky lock bar
- [x] `/dashboard/standings` — Championship Leader livery card + striped driver table + bar-chart constructors
- [x] `/dashboard/league` — podium 3-column (favorite-team livery watermark) + bar-chart positions 4–N

**Pass 4 — Reveal · ☑** (shipped 2026-04-28)
- [x] `/reveal/[eventId]` — TopBar shell + cinematic intro band (title slam + livery sweep + track-draw, 0–2.9s) + P2|P1|P3 podium with portraits + livery watermarks (delayed start at 3.3s) + friend pick gallery (cascaded after podium). Replay button. Reduced-motion path skips cinematic entirely.

**Exit criteria:** every screen visually matches the Claude-design canvas ✓; no regressions ✓ (97/97 Vitest + 2/2 Playwright); typecheck + lint + build all clean ✓.

---

### Phase 8 — UI-issues triage · ☑ (shipped 2026-04-30)

**Goal:** Close the visual + flow gaps surfaced in `design/ui-issues.md` against `design/implementation-screenshots/`. No DB changes beyond the ones already shipped. Plan: `~/.claude/plans/imperative-wishing-mitten.md`. Full deliverable detail in the dated session-log entry above.

**Bucket A — surgical CSS / layout · ☑ (shipped 2026-04-30)**
- [x] A1. `/join` text overlap — bumped hero `lineHeight: 1.0` + added `marginTop: var(--space-md)`
- [x] A2. Red Bull blue accessibility — `#3671C6` / `oklch(58% 0.16 265)`; Williams nudged to `#1E5BCF` / `oklch(64% 0.16 245)`
- [x] A3. `/reveal/[eventId]` cinematic title overlap — line-height bumped to 0.95

**Bucket B — per-round entry routes · ☑ (shipped 2026-04-30)**
- [x] B1. New `/dashboard/predict/round/[round]` listing all sessions of a weekend (with extracted `groupByRound` helper + 5 D22 unit tests)
- [x] B2. F1-style "PICKS LOCKED IN" Framer Motion banner + "LOCK IN FOR OTHER EVENTS" CTA on predict-detail
- [x] B3. New `/admin/results/round/[round]` aggregating all sessions of a weekend for admin entry; admin row action rewired; back-to-round breadcrumb on `/admin/results/[eventId]`
- [x] B4. Multi-session fixture picks in `seed-fixture-picks.ts` (P1 only for sprint, full P1/P2/P3 for race + quali) + auto-`refreshNudgesForUpcoming(30d)` (closes C2 too)

**Bucket C — assets + nudges · ☑ (shipped 2026-04-30)**
- [x] C1. Re-cropped `BOT.png` to 498×498 via `sips`; `objectPosition: center top` defensive default added to `<DriverPortrait>`. PER.png was already square — user's report is Next image cache stickiness, fixed by `rm -rf .next`.
- [x] C2. Auto-trigger `refreshNudgesForUpcoming` from the seed script so dev telemetry populates without manual cron
- [x] C3. `/reveal/[eventId]` podium — replaced small portrait circles with large rectangular `driverPortraitSrc`-backed headshots flush to card bottom (180×240 P1 / 120×160 P2/P3); team-gradient letter fallback for codes outside the curated set

**Exit criteria:** every issue from `design/ui-issues.md` resolved with a side-by-side screenshot comparison · 107/107 test baseline preserved (or tests updated if assertions need it) · typecheck + lint + build clean · tracker docs reflect what shipped per the design-handoff DoD.

---

### Phase 14 — Design-fidelity port (`design_handoff_phase11`) · ◐ (PR 1 shipped 2026-05-18; PRs 2–9 pending)

**Goal:** Apply the `design_handoff_phase11/` visual design pass over the Phases 10–13 functionality (changes.md §1–§8). 9 PRs, one per phase, executed in BUILD ORDER. Plan of record: `plans/design-handoff.md`. UI-only — no schema/data changes. §11 already shipped in code → verify/polish only; §9+§4 combined into PR 1. Do not start PR N+1 until PR N's exit criteria are green.

**Cross-cutting rules (every PR — full text in `plans/design-handoff.md` §"Cross-cutting"):** token-only spacing (nearest `--space-*`, ≤4px tol) · zero `border-radius` on cards · colors via `var(--token)` only · Boldonse via inline `fontFamily` · `data-tabular` on every numeric · no `cn()`/shadcn/lucide/new deps · preserve `display_name` guards · per-PR capture + lint + typecheck + vitest + playwright green (learn live baseline first), then update `CLAUDE.md` + this tracker.

**PR 1 — §9 TopBar trigger + ScoringHelp modal + §4 ScoringLegendBody · ☑ (shipped 2026-05-18)**
- [x] `globals.css` scrim → `rgb(8 4 6 / 0.78)` + `backdrop-filter: blur(8px)`
- [x] `ScoringLegend.tsx` — stripped body card chrome; `Section`/`RowList` sizing → `screens-lobby.jsx:LegendSection`; verbatim copy deltas (`(wrong slot)` ×3, long Race&Qualifying subtitle, Worked perfect-row reword, "Max for a race/quali", footnote) — TDD-locked SL1–SL4
- [x] `ScoringHelp.tsx` — bordered trigger + 16px `?` glyph; dialog `min(92vw,720px)`; removed `borderRadius:4`; header "Reference" caption + sentence-case Boldonse 32px lh 0.9 title + `ESC ✕` close; body pad `--space-2xl`
- [x] Capture via `/profile` (invite-gate → sign-in → click trigger, screenshot + visual diff); full suite 165/165 green
- **Exit:** ✓ modal matches README §9 prose + body matches `screens-lobby.jsx`; lint + typecheck + vitest + playwright all green.

**PR 2 — §1 Lobby redesign · ☐** *(blocked: Red Bull hex decision)*
- [ ] 4-scoring-session filter in `loadLobbyWeekend.ts` (no FP)
- [ ] Compact preview card (4-col grid, per-friend lock-dot row, `Expand ▾`)
- [ ] Expanded card (one-at-a-time `useState`, accent halo) + `ParticipantBlock` (RevealState-driven body)
- [ ] Strip `borderRadius:4` on SessionBlock; empty + loading states
- **Exit:** matches README §1/§2 artboards; `revealGate.ts` untouched; suite green.

**PR 3 — §11 Predict last-5 form strip · ☐** *(verify/polish — core shipped)*
- [ ] Confirm `.reverse()` + DNF/P1-3/P4-10 color map; add `↑ LATEST` tag + latest-pip highlight if missing
- **Exit:** matches README §11 anatomy; suite green.

**PR 4 — §10 Reveal FriendCard bucket math · ☐** *(blocked: Red Bull hex decision)*
- [ ] Per-row badges (`✓ Exact +5` / `⊙ On podium` / `× Miss`)
- [ ] Bucket-tally row (dashed, `bucket={1→1,2→2,3→4}`, only when `wrongSlot>0 && exact<3`)
- [ ] `★ Perfect Podium · +3 bonus` pill; card-score color tiers (≥10/`>0`/`0`)
- **Exit:** renders existing score sub-fields; reveal motion untouched; suite green.

**PR 5 — §3 Show Reel redesign · ☐**
- [ ] Hero (`SHOW / REEL` Boldonse 120 `data-tight`; meta + total `pts so far`)
- [ ] 7-col round rows `60/80/36/1fr/auto/auto/auto`; session pills; `Σ` total + `aria-label="Total"`
- **Exit:** matches README §3; empty `NO REVEALS YET` kept; suite green.

**PR 6 — §5 Profile calendar-sync panel · ☐**
- [ ] 1-col → 2-col (left copy/URL/3-step; right 240px stats card + SVG glyph)
- [ ] Beta pill; `Copy`→`Copied` 2s; strip `borderRadius`
- **Exit:** matches README §5; token mint/reveal flow intact; suite green.

**PR 7 — §6 Predict-list FP banner · ☐** *(blocked: Red Bull hex decision)*
- [ ] Framed banner: header strip (`Source: OpenF1` pill) + N-col session grid + 1px dividers
- [ ] Lap-time variants (OpenF1 / `OVR` / `Awaiting`); no footer; lap time only when OpenF1
- **Exit:** matches README §6; suite green.

**PR 8 — §7 Admin OpenF1 fetch banner · ☐** *(open: §7 `Accept as official` action?)*
- [ ] New 4-state banner (idle/provisional/official/revealed) above podium form — strings verbatim from `screens-aux.jsx:OpenF1FetchBanner`
- [ ] State from existing event/results status (no schema change); admin top-strip preserved
- **Exit:** matches README §7 4-state artboard; suite green.

**PR 9 — §8 Admin FP overrides section · ☐** *(blocked: Red Bull hex; open: badge persistence)*
- [ ] Section frame + `Session · P1 · P2 · P3 · Status · Actions` column-header strip
- [ ] `DriverDropdown` (real `<select>`, 3px team-color left edge) ×3/row; 6-col rows
- [ ] Status badges + `Clear`/`Save` styling; strip `borderRadius`; reuse `practice-actions.ts`
- **Exit:** matches README §8; server contract unchanged; suite green.

**Open decisions (resolve before the dependent PR):**
1. **Red Bull hex** — handoff `#4A77DB` vs `globals.css`/`teams.ts` `#3671C6` vs `data.jsx` `#1E2A6E`. Blocks PR 2/4/7/9. Rec: adopt `#4A77DB` in `teams.ts` + `globals.css` + new numbered `D#` test.
2. **§7 `Accept as official`** — explicit code action or manual-entry only? (PR 8)
3. **§8 override status badge** — persistent vs transient flash? (PR 9)
4. **§3 `Σ` prefix** — `aria-label="Total"` (confirmed; no blocker).

**Phase exit criteria:** all 9 PRs merged · each visually matches its canvas artboard / README prose within tolerances (colors exact, spacing ≤4px, font face exact) · per-PR suite green against the live baseline · `CLAUDE.md` + this tracker updated per PR · no banned `.impeccable.md` pattern reintroduced.

**Numbering note:** uses Phase 14 to align with `CLAUDE.md` (Phases 0–13 shipped). Tracker Phases 9–13 (changes.md §1–§8) are not yet backfilled here — `CLAUDE.md` is their authoritative record; backfill flagged in the 2026-05-18 session-log entry.

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
| `/api/cron/fetch-results` | OpenF1 fetcher (manual entry stays primary) | ☑ | ☐ |
| `/api/cron/sync-f1-data` | Nightly calendar + driver sync | ☑ | ☐ |
| `/api/cron/refresh-nudges` | Nightly per-driver nudge cache rebuild | ☑ | ☐ |
| `/api/cron/refresh-jolpica-current` | Nightly Jolpica delta into historical_results | ☑ | ☐ |

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
