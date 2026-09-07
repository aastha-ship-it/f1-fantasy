# PR-3 — Predict (list + picks) (390pt)

Source: `design/design_handoff_mobile/README.md` §3.1–3.2.
Canvas: `design/design_handoff_mobile/design/screens-mobile.jsx`
(`MobPredictListScreen` lines 259–394, `MobPredictScreen` lines 395–528).
Branch: `feat/mobile-pr3-predict`, stacked on `feat/mobile-pr2-screens`.

**Scope: presentation only.** No new queries, no server-action changes, no
schema changes. Every route renders byte-identical at ≥780px (`md:`) after
this PR — `plans/mobile-shots/baseline-1440/`, re-taken at PR-2's commit
`e033b23`, is the contract.

## Hard rules (unchanged from PR-1 / PR-2)

- One fork: `md` = 780px. Mobile values are base-level; today's desktop value
  is restored at `md:`. Never `min-[…]:`.
- Tokens from `globals.css` only. No new colours, no border-radius (avatars
  only). Titillium via
  `style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}` **plus an
  explicit `uppercase`** — the global `[style*="Boldonse"]` selector is
  case-sensitive and matches nothing (memory `display-font-selector-never-matches`).
  Every numeric `data-tabular`.
- 20px page gutter = `px-5` / `-mx-5`. Never add a `--spacing-*` token.
- Min tap target 44px. Nothing pinned over the tab bar.
- No `cn()`, no icon libs, no shadcn. Server components unless hooks are needed.
- `MobilePrimitives` are **mobile-tree only** — no `md:` classes, render only
  inside a `md:hidden` subtree.

## The structural patterns

PR-2's two, plus one addition this PR needs.

**A. Fork the classes** — one element, base = mobile, `md:` = today's value.
Mandatory for anything carrying form state or a test-bound accessible name.

**B. Fork the subtree** — `md:hidden` mobile markup beside the existing
markup, which takes `hidden md:block` / `md:grid` / `md:flex` **on itself**,
never on a new wrapper.

**B′. Contents-wrapped fork** — new this PR. When the mobile tree needs a
*different box shape* around elements the desktop must keep as direct
children, wrap them in `<div className="hidden md:contents">` (or
`className="… md:contents"`). `display: contents` removes the wrapper's own
box entirely at `md:`, so the children re-participate in the parent's layout
exactly as before and the 1440 pixel diff stays at zero. Used in exactly two
places, both in `driver-picker.tsx` (§3.2 and §3.4); both are called out in
comments at the call site.

Why B′ instead of plain B: the slot card's portrait/code/name block is a
**test-adjacent, state-driven** subtree (it re-renders from `picks`), and the
grid cell is a single `<button aria-label>` that must not be duplicated. B′
lets the desktop DOM stay byte-identical without duplicating either.

## Decisions taken before building

1. **`MobButton` accent text stays `var(--fg)`** — the owner's call, made
   this session, closing the flag PR-1 and PR-2 both carried. It is what the
   canvas draws. Recorded knowingly: at 13px that is ~3.3:1 against
   `--accent`, under AA for non-large text, and every pre-mobile CTA in the
   app uses `text-black`. `MobilePrimitives.TONES` is **not** touched by this
   PR. Consequence for §3.4: the lock-bar submit CTA — the one accent button
   on the picks screen — takes `var(--fg)` below the fork and restores
   `text-black` at `md:`, so the mobile screen is internally consistent with
   every other `MobButton` and the desktop is unchanged.
2. **`/dashboard/predict/round/[round]` is deferred.** The canvas has no
   artboard for it (the design goes list → picks directly) and the owner is
   producing one. It is not touched by this PR; see §7.
3. **The FP pace-check card is omitted from the mobile list.** See the
   disagreements table.

## Design-vs-data disagreements — report, do not invent

| Canvas | Reality | What to build |
|---|---|---|
| `FP · PACE CHECK` card on the predict **list** | `loadPracticeForRound` is only called on `round/[round]/page.tsx`. The list page never loads practice data; adding it is a data-layer change the handoff's scope rule forbids. | **Omit.** The FP banner keeps living on the round page, one tap from the hero CTA. Owner-confirmed this session. |
| Hero `47 / PTS · P1 IN GROUP` | Real: `myTotalPoints`, `myRank`, `totalUsers`, `myPerfectCount`. | `{myTotalPoints}` display 32 accent; meta line `pts · P{myRank} in group`, or today's `pts · ranked once you score` when unranked, plus ` · {n} PP` when `myPerfectCount > 0` (the `PP` idiom the reveal artboards use). |
| Next-race card meta `R06 · MAY 4 · LOCKS 2d 14h` on one line | Our date is a weekend **range** (`formatDateRange` → `1 - 3 May`), and the next open session is whichever session unlocks first — often Qualifying, not the race. | Two mono lines: `R{NN} · {SESSION_LABEL} · {dateRange}` then `Locks {countdown}`. One line would wrap unpredictably beside the 44px track diagram. |
| Card eyebrow `● NEXT RACE · PICKS OPEN` | The hero can be a quali/sprint session. | `● Next session · Picks open` — today's desktop noun. |
| Next-race card always shows 3 slots | Sprint sessions take **P1 only** (`heroIsSprint`). | Slot grid is `grid-cols-3`, or `grid-cols-1` when the hero session is a sprint. Same rule the desktop hero already applies. |
| Revealed row `+18` turns `--success` at `>= 15` | We store `scores.perfect_bonus`. | `--success` + the `PERFECT` label when `score.perfect`; `--fg` + `PTS` otherwise. Real flag, not a points threshold. |
| Upcoming list sliced to 3 | Desktop already slices to 6. | Keep 6. The mobile tree must not show less data than the desktop tree (PR-2 precedent: the driver roster). |
| `ALL 24 ROUNDS →` style footer | No all-rounds route. | Omitted, as on the dashboard. Lists end on their last hairline. |
| Picks-screen slot omits a “change pick” affordance | `clearSlot` is the only non-toggle way to empty a slot, and it is an existing shipped control. | **Keep** the `Change pick` button, given a `min-h-[44px]` tap floor below the fork (it is an 11px text button today — under the floor at every width). Deviation from the canvas, deliberate. |
| Picks-screen grid `20 drivers` | Production roster is 22 active drivers in 2026. | Render `drivers.length`, whatever it is. The meta string already interpolates it. |
| Lock bar ground `var(--surface-2)` flat | Today's bar is `color-mix(--surface-2 92%, transparent)` + `backdrop-blur`. | Keep today's treatment at both widths. It is a shipped, deliberate effect and swapping it would be a desktop diff. |

## 1. `/dashboard/predict` — `src/app/dashboard/predict/page.tsx`

### 1.1 `<main>` (pattern A)

Today: `mx-auto w-full max-w-[1600px] px-6 py-10 pb-24 sm:px-8 md:pb-10 lg:px-12 xl:px-16`

Becomes the dashboard's exact string (`page.tsx:285`):
`mx-auto w-full max-w-[1600px] px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+24px)] md:px-8 md:py-10 md:pb-10 lg:px-12 xl:px-16`

Check at ≥780: `md:px-8` = 32 (was `sm:px-8` = 32) ✓, `md:py-10` = 40 ✓,
`md:pb-10` = 40 ✓, `lg:px-12`/`xl:px-16` untouched ✓. `sm:px-8` is dropped on
purpose — it only governed 640–779, which is mobile territory below the fork.

### 1.2 Desktop siblings get `hidden md:*` (pattern B)

- Heading `<section className="grid items-end gap-8 border-b … lg:grid-cols-[1.5fr_1fr]">` → `hidden md:grid`.
- Hero `<section className="mt-10 grid gap-8 overflow-hidden border … lg:grid-cols-[1fr_auto_360px]">` → `hidden md:grid`.
- Its empty-state `<section className="mt-10 border border-dashed …">` → `hidden md:block`.
- Revealed/upcoming `<section className="mt-12 grid gap-10 lg:grid-cols-2">` → `hidden md:grid`.

Nothing else on the page moves; `RoundList` is untouched.

### 1.3 The mobile tree

One `<div className="md:hidden">`, **first child of `<main>`** (the dashboard's
ordering — hidden desktop siblings contribute no box, so nothing above the
mobile tree can reintroduce a gap). Four new server components defined below
the default export, matching `dashboard/page.tsx`'s layout:

**`MobPredictHero`**
```
<MobEyebrow>Predict · {season} Season</MobEyebrow>
flex items-end justify-between gap-3 mt-2.5
  h1  Titillium 40 / 0.9, uppercase, m-0:  Your<br/>picks
  right, text-right:
    Titillium 32 / 1, var(--accent), data-tabular:  {myTotalPoints}
    mono 9 / 0.1em upper subtle mt-1:  pts · P{n} in group[ · {k} PP]
```

**`MobNextRaceCard`** — `mt-5 border border-[color:var(--accent)] bg-[color:var(--surface-2)] p-[18px]`
```
<MobEyebrow color="var(--accent)">  ● (5px accent square span) Next session · Picks open
flex items-center justify-between gap-3 mt-3
  left (min-w-0):  Titillium 26 / 0.95 uppercase {shortEventName(name)}
                   mono 10 / 0.06em muted mt-1.5, two lines (see disagreements)
  <TrackDiagram circuit={ergast_circuit_id ?? circuit} height={44} stroke="var(--accent)" />
grid gap-2 mt-4, cols = heroIsSprint ? 1 : 3
  slot, min-h-[96px], centred col, gap-1.5, p-2.5
    filled:  border 1px {teamHex}, bg --surface, mono 9 "P{n}",
             <DriverPortrait size={32}>, Titillium 14 {code}
    empty:   1px dashed --border, transparent, mono 9 centred "Tap / to pick"
mt-3.5  <MobButton href={`/dashboard/predict/round/${round}`}>Finish picks →</MobButton>
```
No-`nextEvent` fallback: same frame, dashed border, `<MobEyebrow>Nothing open</MobEyebrow>`
and today's copy verbatim — *"No open sessions right now. Check back when the
next event opens."*

**`MobRevealedRows`** — `mt-7`, `<MobSectionHead title="Revealed" meta={`${n} rounds`} />`
then `<MobBleed className="border-t border-[color:var(--border)]">`, one
`<Link>` per round: `grid [minmax(0,1fr) auto] gap-3 items-center px-5 pt-3 pb-3.5 border-b`
- left: mono 9 `R{NN} · {dateRange}` / Titillium 15 uppercase truncate name /
  chip row `mt-2 gap-[5px]` — mono 9, `px-1.5 py-[3px]`, `1px solid {teamHex}`,
  `color: {teamHex}`, text `{i+1} {code}`. No pick → today's `No pick` chip.
- right: mono 20 `+{points}` (`--success` when `score.perfect`, else `--fg`;
  `—` and `--fg-subtle` when unscored) over mono 8 `PERFECT`/`PTS`.
- `href` keeps today's logic (`/reveal/{id}` when a primary session exists).
- Empty → today's `No reveals yet.` at 12px muted.

**`MobUpcomingRows`** — `mt-6`, `<MobSectionHead title="Upcoming" meta="Picks open T-7d" />`
then a bled list of `h-[52px]` `<Link>` rows,
`grid [34px 48px minmax(0,1fr) auto] gap-3 items-center px-5 border-b`, mono 10
subtle: `R{NN}` · `<TrackDiagram height={22} strokeWidth={1.4} stroke="var(--fg-subtle)">` ·
Titillium 13 muted truncate name · `formatDateRange(weekendStart, weekendStart)`
(→ `4 May`; the full range does not fit the last column at 52px).
Same 6-round slice and same `nextEvent` exclusion as the desktop list.

## 2. `/dashboard/predict/[eventId]` — `src/app/dashboard/predict/[eventId]/page.tsx`

### 2.1 `<main>` (pattern A)
Identical string swap to §1.1.

### 2.2 Hero
Existing `<section className="grid items-end gap-8 border-b … lg:grid-cols-[1.4fr_1fr_1fr]">`
→ `hidden md:grid`. New `md:hidden` sibling **before** it:
```
<MobEyebrow>Round {NN} · {SESSION_LABEL} · Picks needed</MobEyebrow>
flex items-end justify-between gap-2 mt-2.5
  h1 Titillium 36 / 0.9 uppercase: {short}<br/><span muted>GRAND PRIX</span>
  <TrackDiagram circuit height={54} stroke="var(--fg-muted)" />
mt-4 border bg-[color:var(--surface)] px-4 py-3.5 flex items-center justify-between
  left:  <MobEyebrow>Locks in</MobEyebrow> + mono 26 / 1.1 mt-1 {lockCountdown}
  right: mono 9 / 0.08em upper subtle, leading-[1.6], text-right,
         session date over session time (two lines)
```
The two-line date needs a local `formatLocalParts(iso) → {day, time}` beside
today's `formatLocal` in the same file — presentation-only, no shared helper
(one call site; the skill's rule is to extract on the **third** use).

Countdown here is the existing server snapshot. The live one stays in the
picker's lock bar; the canvas draws both.

## 3. `driver-picker.tsx` — pattern A dominates

756-line client component. Every change below is a class/style fork on an
existing element; **no element is duplicated**, with the two contents-wrapped
exceptions in §3.2 and §3.4.

General technique: any inline `fontSize` that differs between the two widths
moves to `text-[Npx] md:text-[Mpx]` classes; `fontFamily` / `letterSpacing` /
computed colours stay inline. Any paired padding fork is written **per side**
(`pt-*`/`pb-*` … `md:pt-*`/`md:pb-*`), never `p-* … md:p-*` — Tailwind sorts
the shorthand before the longhand, so a base longhand would beat an `md:`
shorthand and silently survive above the fork.

### 3.1 Form + slot section
- `<form>` bottom padding: unchanged. 8rem ≥ the mobile lock bar's ~101px.
- Slot `<section>`: move `gap`/`background` out of the inline style so they can
  fork. Base `gap-2.5 bg-transparent`, `md:gap-px md:bg-[color:var(--border)]`
  (10px cards-with-borders on mobile, 1px hairline grid at desktop).
- Slot card: add base `border border-[color:var(--border)] md:border-0`.
  `min-h-[96px] md:min-h-[320px]` and `p-4 md:p-7` already match the canvas.

### 3.2 Slot card interior (pattern B′)
Canvas puts `P{n}` and the driver block on **one row**; the desktop stacks
them. Wrap the existing header row and the driver/empty block in
`<div className="relative flex items-center gap-3.5 md:contents">` — at `md:`
the wrapper's box vanishes and both children are direct flex-column children
of the card again, byte-identical.
- Header row gains `shrink-0 md:shrink`; the `Picked` / `Tap a driver` span
  becomes `hidden md:inline` (the canvas drops it).
- `P{n}` clamp minimums lift to the canvas's sizes: `clamp(52px, 12vw, 96px)`
  for P1 and `clamp(40px, 10vw, 64px)` otherwise. At ≥780 `12vw ≥ 93.6` and
  `10vw ≥ 78`, so both clamps resolve exactly as today above the fork — the
  minimum only bites below ~433px.
- Portrait 72 → 52: the existing `<DriverPortrait size={72}>` gets a
  `<div className="hidden md:contents">` wrapper (B′) and a `md:hidden`
  sibling at `size={52}`. `size` is a number prop written to inline
  `width`/`height`, so a class fork cannot reach it.
- Code `fontSize: 28` → `text-[20px] md:text-[28px]`; full name
  `text-sm` → `text-xs md:text-sm`; team pill `text-[10px]` → `text-[9px] md:text-[10px]`.
- Empty prompt keeps today's copy; add the canvas's accent
  `Tap to pick →` line under it as a `md:hidden` mono 9 span.
- `Change pick`: `min-h-[44px] flex items-center md:min-h-0 md:block`.

### 3.3 Telemetry panel
The tinted ground and team-hex top border are desktop-only (the canvas draws a
plain hairline on the card ground). Inline values can't fork, so the two
computed colours move to CSS custom properties on the element
(`--tele-tint`, `--tele-edge`) and the classes do the forking:
```
bg-transparent md:bg-[var(--tele-tint)]
border-t border-[color:var(--border)] md:border-t-[color:var(--tele-edge)]
mt-3.5 md:mt-auto
px-0 pt-3 pb-0  md:px-[var(--space-lg)] md:pt-[var(--space-lg)] md:pb-[var(--space-lg)]
```
- `Telemetry` eyebrow: `text-[9px] md:text-[10px]`.
- `<dl>`: base becomes the canvas's vertical stack —
  `flex flex-col gap-[7px] text-[10px]`, keeping `md:flex-col md:gap-3 md:text-base`.
  (Today's base is `flex-row flex-wrap gap-x-3 gap-y-1 text-[11px]`.)
- Rows gain `justify-between` at base (`md:justify-between` then restates the
  same value — byte-identical above the fork).
- `<dt>`: `text-[9px] uppercase tracking-[0.06em] text-[color:var(--fg-subtle)]`
  + `md:text-xs md:normal-case md:tracking-normal md:text-[color:var(--fg-muted)]`
  (muted is what it inherits from the `<dl>` today).
- Form pips: inline `fontSize: 11` / `minWidth: 24` → `text-[9px] md:text-[11px] min-w-[22px] md:min-w-6`.
- **Invariant preserved:** `orderRecentForm` still renders oldest→newest with
  the latest pip on `--surface-2` + border. The flip stays render-side; the
  stored string stays most-recent-first. No change to that code path.
- Hot-picks / no-nudge fallbacks unchanged.

### 3.4 THE GRID
- Head `<div className="mb-4 flex items-baseline justify-between">` → `hidden md:flex`,
  with a `md:hidden` `<MobSectionHead title="The Grid" meta={`2026 · ${drivers.length} drivers`} />`
  before it (pattern B).
- `<ul>`: `gridTemplateColumns` leaves the inline style for
  `grid-cols-4 md:[grid-template-columns:repeat(auto-fill,minmax(96px,1fr))]`;
  `gap: 1` / `background` stay inline (same at both widths). Bleed with
  `-mx-5 md:mx-0`. Borders per side so the mobile list has hairline top/bottom
  only: `border-t border-b border-l-0 border-r-0 md:border-l md:border-r`.
- Cell `<button>` (single element — it carries `aria-label`, `aria-pressed`
  and is the anchor three e2e specs click):
  `min-h-[92px] gap-[5px] px-1 pt-2.5 pb-3 md:min-h-[44px] md:gap-1.5 md:px-2 md:pt-3 md:pb-3`.
- Portrait 48 → 40 via the same B′ pair as §3.2, **inside** the one button.
- Code `fontSize: 14` → `text-[13px] md:text-[14px]`; `#{d.id}` →
  `text-[8px] md:text-[10px]`.
- `borderTop: 3px {teamHex}`, the `✓` badge and the picked-opacity rule are
  already the canvas's — untouched.

### 3.5 Picks-locked banner
Stacks below the fork so it cannot overflow at 390:
`flex-col items-start gap-2 px-5 py-3.5 md:flex-row md:items-center md:gap-6 md:px-8 md:py-4`
(today's `px-6 sm:px-8` → 32px at ≥640; `md:px-8` carries the same 32 above the
fork). Display size `text-[18px] md:text-[22px]` off the inline style.
`text-black` stays — this banner is not a `MobButton` and its ground is the
accent fill at full width, where the canvas has no counterpart.

### 3.6 Lock bar — the most constrained element on the branch
`predict-lock-bar.spec.ts` pins this DOM: from `[data-testid="lock-bar-status"]`,
`ancestor::div[1]` **must** be the inner row and `ancestor::div[2]` **must** be
the `position: fixed` container. **Add no wrapper anywhere between the fixed
container, the row, and the status `<p>`.**

- Fixed container: unchanged, including
  `bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px))] md:bottom-0`
  and its comment. This is the offset the README says must survive.
- Inner row: base `gap-2.5 px-5 pt-3 pb-3.5`, restoring
  `md:gap-6 md:px-8 md:pt-5 md:pb-5 lg:px-12 xl:px-16`. The desktop-parity test
  asserts `columnGap: 24px`, `paddingTop/Bottom: 20px` and
  `paddingLeft/Right: 32/48/64` at 800/1024/1440 — all satisfied.
  `md:flex-row md:items-center md:justify-between` and the base
  `flex-col items-stretch` are unchanged (the phone test asserts
  `flexDirection: column` at 390).
- Status `<p>`: `text-xs sm:text-sm` → `text-[10px] md:text-sm` (≥780 stays
  14px, exactly today's `sm:text-sm`), plus `font-mono md:font-sans` for the
  canvas's mono treatment below the fork. Copy, `data-testid` and the
  `data-phase` warning span are untouched.
- Submit `<button>` and the just-saved `<Link>`: `min-h-[48px] w-full px-8 py-4 text-center text-sm`
  → `h-[52px] w-full px-5 flex items-center justify-center text-[13px] md:h-auto md:min-h-[48px] md:block md:px-8 md:py-4 md:text-sm`.
  `md:block` restores `display:block` + `text-center`. Height 52 keeps both
  `toBeLessThanOrEqual(60)` assertions green and clears the 44px floor.
  The inline `color` moves to classes so decision 1 can apply below the fork:
  enabled → `text-[color:var(--fg)] md:text-black`; disabled →
  `text-[color:var(--fg-muted)]` at both widths (today's value). Background
  stays inline.

## 4. Tests

- **New** `src/app/dashboard/predict/driver-picker.test.tsx` (jsdom), numbered
  `DP1…`, mocking `submit` the way `TopBar.test.tsx` mocks its action:
  - DP1 exactly one `[data-testid="submit-picks"]` and one
    `[data-testid="lock-bar-status"]` in the document (the fork is classes,
    not duplicates), and the status `<p>`'s parent's parent is the element
    carrying `fixed` — the same two-hop the e2e xpath walks.
  - DP2 exactly one `<button aria-label>` per driver in THE GRID; count ===
    `drivers.length` (no mobile duplicate of the grid cell).
  - DP3 both B′ pairs are well-formed: for each slot with a driver and each
    grid cell, one portrait wrapper is `hidden md:contents` and its sibling is
    `md:hidden` — asserted structurally, so deleting one half fails.
  - DP4 the grid `<ul>` is `grid-cols-4` + `-mx-5` at base and carries the
    `md:` restores; no `rounded-*` anywhere in the picker outside the portrait.
  - DP5 form-pip order is still oldest→newest with the last pip carrying the
    `--surface-2` treatment (the standing invariant, re-locked because §3.3
    rewrites every class on that row).
- `src/app/dashboard/predict/driver-picker.test.ts` (existing) — read it
  first; extend rather than replace if it already covers a case above.
- **e2e — the visibility trap.** Three specs navigate with
  `page.locator('a[href*="/dashboard/predict/round/"]').first()` and
  `a[href^="/dashboard/predict/"]`. Once the desktop list is `display:none`
  below the fork and the mobile list exists, `.first()` resolves to a **hidden**
  link at one width or the other whichever DOM order we choose, and `.click()`
  times out. Fix in all three by scoping to visible links
  (`a[href*="…"]:visible`), with a comment naming the fork as the reason:
  - `tests/e2e/predict-lock-bar.spec.ts` → `openFirstUnlockedEvent`
  - `tests/e2e/no-horizontal-overflow.spec.ts` → "dynamic routes reached by following real links"
  - `tests/e2e/mobile-nav.spec.ts` → "the predict submit button is clickable…"
- **e2e — the rotted-anchor trap.** `mobile-nav.spec.ts` finds the hero CTA by
  `getByRole("link", { name: /continue picks/i })` at 390px and **silently
  skips** when it finds nothing. The mobile CTA reads `Finish picks →` per the
  canvas, so that locator would match nothing and the test would pass
  vacuously. Broaden to `/(continue|finish) picks/i` **and** replace the silent
  `test.skip` with a check that distinguishes "no session seeded" (no
  `a[href*="/dashboard/predict/round/"]` on the page at all) from "the anchor
  rotted" (rounds exist but no CTA → hard failure).
- `fork-audit`, `admin-mobile`, `reveal-portrait`, `auth` must stay green
  unmodified.

## 5. Verification

1. `bun run lint && bun run typecheck`, then unit-only
   `npx vitest run --exclude 'tests/integration/**'` (baseline after PR-2:
   291 passing) and `bun --env-file=.env.local run vitest run tests/integration`
   (25 pass / 1 pre-existing `rls.test.ts` I6 fixture failure — do not chase).
   `bun run test` does **not** load `.env.local`.
2. Dev server on `:3001`. Baseline and compare **back to back, with no
   DB-touching command between them** — `/dashboard/lobby` and
   `/dashboard/league` render `public.users`, so any e2e or integration run in
   between makes those two routes diff by thousands of pixels (cost PR-2 two
   false failures). Run the suites *after* the compare.
3. **All 13 routes 0 diff pixels at 1440**, and `overflow.json` shows
   `sw === cw` at 375 / 390 / 412 everywhere.
4. `E2E_BASE_URL=http://localhost:3001 bun --env-file=.env.local run e2e --workers=1`
   across all four device projects.
5. Eyeball the new `@390` shots for `/dashboard/predict` and the picks screen
   against the 📱 artboards.
6. `graphify update .`, then the tracker docs (`CLAUDE.md` current state +
   `plans/program-tracker.md` session log).

## 6. Out of scope

Lobby (PR-4), reveal (PR-5), standings/league/admin (PR-6). `MobilePrimitives`,
`MobileTabBar`, `ScoringHelp`, the `--tabbar-*` tokens and `TopBar` are PR-1's
and PR-2's and are not touched.

## 7. Deferred — `/dashboard/predict/round/[round]`

No 📱 artboard exists; the owner is producing one. Until then the round page
keeps today's desktop layout at phone widths. Consequences to carry forward:

- It is the destination of the mobile hero CTA (`Finish picks →`), so the
  first tap out of the redesigned list lands on an un-redesigned screen.
- It is the only place the FP practice banner renders, which is why omitting
  the FP card from the list (above) is a defensible deferral rather than a
  feature loss.
- Its `<main>` still carries `px-6 py-10 pb-24 sm:px-8 md:pb-10 lg:px-12 xl:px-16`;
  when the artboard lands, the §1.1 string swap applies to it verbatim.
- Its session rows are `a[href^="/dashboard/predict/"]` — the `:visible`
  scoping added in §4 already anticipates that page forking too.

## 8. Verification results (as built)

| Check | Result |
|---|---|
| `bun run lint` | 0 errors (3 pre-existing warnings, all in `.superpowers/`) |
| `bun run typecheck` | clean |
| Unit (`npx vitest run --exclude 'tests/integration/**'`) | **296 passed** / 49 files (291 before + DP1–DP5) |
| Integration (`bun --env-file=.env.local run vitest run tests/integration`) | 25 pass, 1 fail — the pre-existing `rls.test.ts` I6 fixture failure the PR-2 handoff documented. Not chased. |
| e2e, 4 device projects, `--workers=1` | **74 passed, 0 failed**, 18 skipped (all `reveal-portrait`, pre-existing fixture guards) |
| Pixel diff @1440, 13 routes | **0 diff pixels**, baseline re-taken at the parent commit immediately before the compare |
| Overflow net @375/390/412, 13 routes | `scrollWidth === clientWidth` everywhere |

**Filled-slot desktop parity.** The capture harness only ever reaches the picks
screen with *empty* slots, and §3.2/§3.3 — both `md:contents` pairs, the
telemetry panel's custom-property fork — only exist on a filled slot. So the
filled state was captured separately (`plans/mobile-shots/pr3-filled.spec.ts`,
gitignored under `plans/`): sign in, click three grid cells, mask the
countdowns, shoot at 390 and 1440. Stashing `src` and re-running produced a
**byte-identical** `picks-filled@1440.png` (sha256
`8c626c67…95eb` both sides). That is the real proof the B′ forks are inert
above the fork.

**Guards proven discriminating.** DP1 and DP3 were ablated rather than trusted:
deleting the grid's `md:hidden` portrait half fails DP3 only; wrapping the
lock-bar status `<p>` in one extra `<div>` fails DP1 only. Both restored.

**`driver_nudges` had to be populated** (`/api/cron/refresh-nudges`) before the
telemetry rows rendered at all locally — an empty cache falls through to the
"Pick a driver to see form…" copy, which would have let §3.3 ship unseen.

## 9. Found, not fixed — `formatDateRange` mixes local month with UTC day

`src/lib/design/dateRange.ts` reads the month with
`toLocaleDateString(undefined, { month: "short" })` (**local**) and the day with
`getUTCDate()` (**UTC**). In any timezone ahead of UTC, a weekend starting late
in the evening lands in the next local month while keeping the UTC day number.

Round 20 (Mexico City, `session_start_at = 2026-10-31T21:00:00Z`) in
`Asia/Calcutta` therefore renders **`31 NOV`** — a date that does not exist.
The desktop upcoming list has shipped the same defect as `31 - 1 NOV` since the
helper landed; PR-3 did not introduce it, and the mobile Upcoming row only made
it obvious.

Not fixed here on purpose: the helper feeds the dashboard hero, the predict
list and the round page, so correcting it changes the **desktop** render and
would break this PR's one safety net — the 0-diff 1440 contract — while the
change has nothing to do with the mobile port. It is a one-line fix
(`{ month: "short", timeZone: "UTC" }`, matching the helper's own UTC-based
docstring examples) plus a numbered test in `src/lib/design/dateRange.test.ts`
and a fresh baseline. Owner's call whether that rides in its own commit.
