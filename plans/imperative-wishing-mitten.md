# UI issues from `design/ui-issues.md` — diagnosis + fix plan

## Context

The user did a visual diff between the design canvas in `design/design-screenshots/` and the live implementation, captured highlighted bugs in `design/ui-issues.md`, and saved the implementation screenshots under `design/implementation-screenshots/`. Seven issues span six routes plus a cross-cutting accessibility problem (Red Bull Racing brand blue is invisible on dark surfaces). Some are pure CSS / layout fixes; two require new architecture (per-round entry routes for both predict and admin); one requires re-cropping two image assets.

This plan groups the fixes into three buckets sized by reach: **A. Surgical CSS/layout**, **B. New per-round routes**, **C. Asset + data fixes**. Doing them in that order produces visible improvement after every commit and lets the bigger architectural changes (Bucket B) build on the polished foundation.

## Bucket A — surgical CSS / layout fixes

**A1. `/join` text overlap (issue 1)**
- File: `src/app/join/page.tsx:39-51`
- Hero "LIGHTS / OUT." uses `fontSize: clamp(64px, 9vw, 128px)` + `lineHeight: 0.88`. The eyebrow above (`PRIVATE LEAGUE · INVITE-ONLY`) gets pulled into Boldonse's top padding (0.12em from globals.css `[style*="Boldonse"]`).
- Fix: bump `lineHeight` to `1.0` and add `marginTop: var(--space-md)` between eyebrow and `<h1>`. Or add `data-tight` to the `<h1>` and rely on data-tight's tighter padding-top (0.04em vs 0.12em). Prefer the explicit margin — avoids new selector behavior.

**A2. Red Bull blue accessibility (issues 3a + 4a)**
- File: `src/app/globals.css:33,48`
- Current: `--team-redbull: oklch(38% 0.16 265)` and `--team-redbull-hex: #1E2A6E`. Both very dark navy, near-invisible on `--bg` (oklch 16% 0.012 27).
- Fix: switch to Red Bull's lighter brand blue: `--team-redbull-hex: #3671C6` and `--team-redbull: oklch(58% 0.16 265)`. Audit Williams `#1868DB` too (borderline) — bump OKLCH to `oklch(58% 0.18 245)` and hex to `#1E5BCF` if it tests poorly. Also ensures the small avatar borders + 3px team-color top-border on the driver grid become visible.
- All places using `teamMeta(...)?.hex` for borders/text on dark surfaces will pick up the change. Livery watermark cars source from `/public/assets/cars/redbull.png` and aren't affected.

**A3. `/reveal/[eventId]` text overlap (issue 7a)**
- File: `src/app/reveal/[eventId]/reveal-stage.tsx:382-389`
- Cinematic hero `<motion.h1>` uses `lineHeight: 0.86` + `data-tight` + italic. "CHINA" descender clashes with "GRAND PRIX" ascender on the line below.
- Fix: bump to `lineHeight: 0.95` (still tight enough for cinematic feel) and add a tiny `marginBottom: 0.05em` between the visible word and the `<br/>`. Keep `data-tight` so padding stays minimal. Verify against `:reveal:[eventId].png` after.

**A4. `/dashboard/predict/[eventId]` slot card team badge contrast (issue 3a, also fixed by A2)**
- File: `src/app/dashboard/predict/driver-picker.tsx:256-266` (also `reveal-stage.tsx`, `standings/page.tsx`, `league/page.tsx` — anywhere `t.hex` is used as text color)
- After A2 the inline-style badge `border: 1px solid ${t.hex}; color: t.hex` becomes legible for RBR. No code change needed beyond A2 — this is a verification step.

## Bucket B — per-round entry routes (issues 2, 3d, 5, 6)

**B1. New route `/dashboard/predict/round/[round]`**
- New files: `src/app/dashboard/predict/round/[round]/page.tsx`
- Lists all sessions for the requested season+round in chronological order (sprint_quali → sprint_race → quali → race for sprint weekends; quali → race otherwise). Each row shows session label, lock-countdown / picked-state / locked-state, and a CTA routing to `/dashboard/predict/[eventId]` for that specific session. Page uses `TopBar`, hero with race name + track diagram, list of session cards.
- Reuse: `groupByRound()` logic in `src/app/dashboard/predict/page.tsx:66-107` (already in this file — extract to `src/lib/predict/groupByRound.ts` or import as-is). Use `formatDateRange`, `circuitMeta`, `shortEventName`, `sessionLabel`, `LockCountdown`.
- Update the `/dashboard/predict` "CONTINUE PICKS →" CTA at `src/app/dashboard/predict/page.tsx:500` from `href={`/dashboard/predict/${nextEvent.id}`}` to `href={`/dashboard/predict/round/${nextEvent.round}`}`. Update Revealed/Upcoming row hrefs (`page.tsx:526-543`) to also route to `/round/[round]` instead of jumping to a single session.
- Solves issue 2: clicking "Continue picks" reveals all 4 sessions of the weekend; user picks the session they want to lock for.

**B2. `/dashboard/predict/[eventId]` lock-in feedback redesign (issue 3d)**
- File: `src/app/dashboard/predict/driver-picker.tsx:120-126,~145, post-submit feedback section`
- Replace the inline green `Picks saved.` with an F1-style banner: full-width strip below the hero, `bg-[color:var(--accent)]` with white text, Boldonse "PICKS LOCKED IN" + small mono subline `Saved at HH:MM UTC · {SESSION_LABEL}`, fades in/out via Framer Motion (4s auto-dismiss).
- After successful submit, change the sticky lock-bar primary button from "LOCK IN PICKS →" to "LOCK IN FOR OTHER EVENTS →" routing to `/dashboard/predict/round/[round]` (computed from the event's round, available on the page-level data). Keep the "Change pick" affordance enabled so users can edit + re-submit.
- New small client state: `justSaved: boolean` in DriverPicker. Banner mounts when `justSaved && feedback.kind === 'ok'`. Round number passed as new prop from `[eventId]/page.tsx`.
- Use existing `EASE_OUT_QUART` constant + Framer Motion already imported across the project. No new dep.

**B3. New route `/admin/results/round/[round]`**
- New file: `src/app/admin/results/round/[round]/page.tsx`
- Per-round admin entry: lists all sessions of the round with their state (Awaiting / Filed · Not revealed / Revealed). Each session card has a "File results →" or "Edit results" CTA routing to `/admin/results/[eventId]` for that session.
- Update `/admin` event-row action button at `src/app/admin/page.tsx` to route to `/admin/results/round/{r.round}` (not the single `actionSessionId`) when state is `pending` or `mixed`. Keep `Reveal to group` action for `entered` state pointing to the existing flow.
- Add a "Back to round overview" link at the top of `/admin/results/[eventId]` so admins can navigate between sessions without bouncing through `/admin`.
- Solves issue 5a: admins can fill all sessions of a weekend in one place. The "X picks · Y/N results" subline at `/admin` (issue 6) becomes meaningful — picks count reflects all sessions.

**B4. Score preview empty when fixture friends have no picks for the session (issue 5b)**
- File: `scripts/seed-fixture-picks.ts`
- Currently seeds picks only for the race session of each round (the script looks up `session_type='race'`). For sprint weekends like China + Miami the four other sessions (Q / SQ / S) have zero predictions, so the admin's live SCORE PREVIEW reads "No friend predictions for this session yet."
- Fix: extend the script to seed picks for **all session types** of each requested round. Race + quali get full P1/P2/P3; sprint_quali and sprint_race only get P1 (the existing schema already enforces this — `submitPrediction` validates sprint slots). Pick variants per friend per session can re-use the existing `PICKS_BY_FRIEND_BY_ROUND` data with a small tweak: only the P1 entry is used for sprint sessions.
- Also: print a one-liner at the end with the trigger-cron command so admins know to populate `driver_nudges` for telemetry.

## Bucket C — assets + nudges (issues 3b, 3c, 7b)

**C1. Re-crop PER + BOT portraits (issue 3c)**
- Files: `public/assets/drivers-portrait/PER.png`, `public/assets/drivers-portrait/BOT.png`
- BOT.png is a wide rectangle (the "drivers" headshot copied into the portrait directory per the 2026-04-28 polish session). When `<DriverPortrait>` renders it at `size={72}` with `rounded-full object-cover`, it crops to a 72×72 square at the centre — but the centre of a wide rectangle is the chest, not the face. Result: avatar shows a torso fragment.
- PER.png is a head-and-shoulders portrait but apparently still rendering empty in the user's grid (per impl screenshot 2). Likely a `Next/Image` cache stickiness; clearing `.next` and reloading should fix. If not, swap for the headshot `public/assets/drivers/PER.png` (square head crop) too.
- Fix:
  1. Replace `public/assets/drivers-portrait/BOT.png` with a properly-cropped square head crop. Source: take `public/assets/drivers/BOT.png` (the wide one) and crop to a 1:1 square centred on the face.
  2. Verify PER renders after `rm -rf .next && bun next dev -p 3001`. If still broken, replace with a square crop the same way.
  3. As a defensive code change, set `objectPosition: "center top"` on `<DriverPortrait>`'s `<Image>` style. This makes any future wide-aspect portrait show the head, not the chest. Keep portraits 1:1 ideally — but the styling becomes resilient.
- File touched for the code change: `src/components/DriverPortrait.tsx:24-39`.

**C2. Telemetry empty (issue 3b)**
- Root cause: `driver_nudges` cache is populated only by `/api/cron/refresh-nudges`, which scopes to events within the next 10 days. In a fresh dev environment the user has never triggered it, so all nudges rows are empty.
- Fix: piggyback nudge population on the seed step. After `scripts/seed-fixture-picks.ts` finishes inserting predictions, call `refreshNudgesForUpcoming(svc, { withinDays: 30 })` (function in `src/lib/nudges/refreshNudges.ts`) so any event close to "now" gets cached. Adds ~30s to seed runtime (OpenF1 throttling at 350ms × ~50 fetches), acceptable for dev.
- Document the trigger-cron alternative in CLAUDE.md's "Common commands" section: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/refresh-nudges`.

**C3. Reveal podium driver portraits (issue 7b)**
- File: `src/app/reveal/[eventId]/reveal-stage.tsx:~520-550` (the `PodiumCard` component)
- Current: small circular `<DriverPortrait size={80}>` for P1 / `size={56}` for P2/P3 in the top-right of each podium card.
- Canvas: large rectangular driver headshot, ~50% of the card's height, rendered as a tall image flush to the bottom of the card with the team's livery showing through.
- Fix: replace the `<DriverPortrait>` call inside `PodiumCard` with a direct `<Image src={driverHeadshotSrc(driver.code)}>` rendered at `width=180 height=240` (P1) / `120×160` (P2/P3) absolutely-positioned in the lower-right of the card, layered above the livery watermark car. Use `objectFit: cover` and `objectPosition: top` so the face is visible. Falls back to the initial-letter avatar (existing fallback path) when no headshot exists.
- The `RIGHT_FACING_CODES` mirror trick stays — apply the `transform: scaleX(-1)` to BOT/LIN headshots if used here too.

## Critical files

- `src/app/globals.css` — RBR + Williams color overhaul (A2)
- `src/app/join/page.tsx` — hero spacing fix (A1)
- `src/app/reveal/[eventId]/reveal-stage.tsx` — line-height + podium portraits (A3, C3)
- `src/app/dashboard/predict/page.tsx` — CTA + row hrefs to per-round route (B1)
- `src/app/dashboard/predict/round/[round]/page.tsx` — **new** (B1)
- `src/app/dashboard/predict/driver-picker.tsx` — F1 banner + button text swap (B2)
- `src/app/dashboard/predict/[eventId]/page.tsx` — pass round prop to picker (B2)
- `src/app/admin/page.tsx` — row action route swap (B3)
- `src/app/admin/results/round/[round]/page.tsx` — **new** (B3)
- `src/app/admin/results/[eventId]/page.tsx` — back-to-round breadcrumb (B3)
- `src/components/DriverPortrait.tsx` — `object-position: center top` (C1)
- `public/assets/drivers-portrait/BOT.png` — re-crop (C1)
- `public/assets/drivers-portrait/PER.png` — re-crop only if cache-bust doesn't fix (C1)
- `scripts/seed-fixture-picks.ts` — multi-session picks + nudge refresh (B4, C2)
- `CLAUDE.md` — current-state line + trigger-cron note
- `plans/program-tracker.md` — new dated session entry per the design-handoff skill DoD

## Reuse from existing helpers

- `teamMeta` / `teamHex` (`src/lib/design/teams.ts`) — already used everywhere `t.hex` lands
- `groupByRound` from `src/app/dashboard/predict/page.tsx:66` — extract or duplicate-in-place for the new round routes
- `LockCountdown` (`src/app/dashboard/predict/lock-countdown.tsx`) — reuse on the per-round predict route
- `sessionLabel`, `formatLocal` (`src/lib/sessionLabel.ts`)
- `formatDateRange` (`src/lib/design/dateRange.ts`)
- `circuitMeta`, `shortEventName`, `eventCountry`, `countryFlag` (`src/lib/design/*`)
- `refreshNudgesForUpcoming` (`src/lib/nudges/refreshNudges.ts`) — call from seed-fixture-picks
- `RevealStage` Framer Motion patterns (`EASE_OUT_QUART`, `useReducedMotion`, `playKey`) — reuse for the post-lock-in F1 banner

## Verification

After each bucket:

1. **Bucket A**: visual spot-check via dev server. Reload `/join`, `/reveal/<id>`, `/dashboard/predict/<id>`, `/dashboard/league`, `/dashboard/standings`. RBR-team rows should now have visible top-border + readable `Red Bull Racing` badge text. `lint && typecheck && vitest run` should remain green.
2. **Bucket B**: walk the predict flow — `/dashboard/predict` → click "CONTINUE PICKS →" → land on `/dashboard/predict/round/<n>` → list all sessions → click into one → lock picks → see F1 banner → click "LOCK IN FOR OTHER EVENTS →" → return to round overview. Walk admin flow — `/admin` → click "File results" on a pending row → land on `/admin/results/round/<n>` → fill all 4 sessions in sequence → reveal. Re-run Playwright (E1, E2 should still pass since none of the changed routes touch invite/auth assertions).
3. **Bucket C**: re-seed fixture (`bun --env-file=.env.local run scripts/seed-fixture-picks.ts`), verify SCORE PREVIEW lights up for sprint sessions, verify telemetry strip shows real data on predict-detail. Compare `/reveal/<id>` podium to canvas — large rectangular headshots flush to card bottom.
4. **Final**: `bun run lint && bun run typecheck && bun --env-file=.env.local run vitest run && E2E_BASE_URL=http://localhost:3001 bunx playwright test`. Baseline 105 vitest + 2 playwright = 107 total. New tests: D22 unit test for the round route's session-bucketing helper if extracted.

## Out of scope / explicitly deferred

- Williams blue audit beyond a single-token bump (test against AA contrast and only widen the change if it fails).
- Cron last-run timestamps populating organically (the wiring shipped 2026-04-29; will fill in as crons run in dev).
- Per-driver portrait re-cropping beyond PER + BOT (LIN renders fine because LIN.png is square enough).
- Removing the existing `/admin/results/[eventId]` route — it's still useful as a deep-link, just no longer the primary entry point.

---

**Estimated reach**: A — 30 min, B — 90 min (two new routes + flow rewires), C — 45 min (asset crop is operator action; nudge refresh wiring is small). Total ~2.5 hours for the full pass.
