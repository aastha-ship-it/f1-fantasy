# PR-B — `PracticeBanner` mobile fork (390pt)

Source: `design/design_handoff_mobile_addendum/README.md` §B.
Canvas: `design/design_handoff_mobile_addendum/design/screens-mobile.jsx`
(`MobPracticeBanner`, `MobFpRow`, `MOB_FP_NORMAL`, `MOB_FP_SPRINT`, lines
273–380), artboard **📱 Practice banner · Mobile 390 — normal weekend
(FP1·FP2·FP3) vs sprint weekend (FP1 only)**.
Branch: `feat/mobile-compatibility` (fifth commit; there are no PRs).

**Scope: presentation only.** No prop, type, query or server-action change;
`FpSession` / `FpPodiumEntry` / `lapCell()` / `loadPractice()` / `parsePractice()`
and the single call site are untouched. One fork, `md` = 780px. The 1440 render
is pixel-identical to the parent commit — measured, not asserted (§5).

## Files

| File | Change |
|---|---|
| `src/components/PracticeBanner.tsx` | The fork. Pattern A throughout, plus one B′ pair for the portrait. |
| `src/components/PracticeBanner.test.tsx` | PB3 widened to both row templates; PB4 + PB5 added. |

## 1. Technique — pattern A, and why nearly everything moved out of `style`

The banner's DOM shape barely changes across the fork, so this is pattern A
(fork the classes on one element) end to end, with a single pattern-B′
exception (§1.5). The mechanical consequence is that **every value that
differs across the fork had to leave the inline `style` object**: an inline
declaration wins over any `md:` class, so a forked `fontSize` left inline
would pin the mobile size at 1440. `fontFamily`, `letterSpacing` and computed
colours are identical at both widths and stayed inline.

Padding and margin forks are written with the **same utility on both sides**
(`pt-… md:pt-…`, never `pt-… md:py-…`). Tailwind sorts the shorter form
first, so a base longhand outlives an `md:` shorthand and silently survives
above the fork — the trap PR-3 §3 documented and PR-A hit on borders.

### 1.1 Section wrapper — the 48px PR-A left deliberately

`marginBottom: var(--space-3xl)` → `mb-0 md:mb-[var(--space-3xl)]`.

PR-A shipped the round page's `Sessions` section head with its own `mt-6`
(24px) — the gap the artboard draws. The banner's own 48px bottom margin sat
on top of it, so 390 showed 72px of air where the artboard has 24. The banner
is the half that was wrong: `<main>` is `flex flex-col` below the fork, so
the two margins do not collapse. Shrinking the section head instead would
have double-counted the fix.

### 1.2 Header — one row at `md:`, two lines below it

The desktop header is a single `flex justify-between` row. At 390 the
`Source: OpenF1` chip and the right-hand context line overlap. The fork drops
`flex` to `md:flex md:items-center md:justify-between`, leaving a plain block
whose two children stack; the context line takes `block mt-[6px] md:mt-0`.
`block` is inert at `md:` — a flex item is blockified anyway — so the desktop
box tree is unchanged.

| | base | `md:` (today) |
|---|---|---|
| header padding | `10px 14px 11px` | `var(--space-md) var(--space-xl)` |
| title | 12px | 14px |
| chip | 8px, `px-[7px]` | 9px, `px-[8px]` |
| context line | 9px, stacked, `mt-[6px]` | 11px, inline, `mt-0` |
| left group gap | 8px, `flex-wrap` | `var(--space-md)`, `flex-nowrap` |

### 1.3 Session block

`p-[12px] md:p-[var(--space-xl)]`. Head row: `gap-[8px] md:gap-0`,
`mb-[10px] md:mb-[var(--space-md)]`; label 12→13px, `startLabel` 9→10px. Its
`paddingBottom` is `var(--space-sm)` at both widths (the artboard's 8) and
stayed inline.

### 1.4 Top-3 row

`grid-cols-[26px_auto_minmax(0,1fr)_auto] md:grid-cols-[32px_auto_minmax(0,1fr)_auto]`,
`gap-[10px] md:gap-[var(--space-md)]`. `P{pos}` 17→20px, code 13→14px, lap
cell 10→11px, `OVR`/`Awaiting` tag `ml-[5px] text-[8px]` → `ml-[6px]
text-[9px]`. Row padding (`6px 10px`) and the sanctioned 3px team-colour left
edge are identical at both widths and stayed inline.

`minmax(0,1fr)` is kept in **both** templates, for the reason the original
in-file comment gives: a bare `1fr` lets the browser squeeze the `auto`
portrait track instead (28px → 0 at 375). Restoring the bare form at `md:`
would reinstate the squeeze across the 780–1023px band, which no e2e project
covers.

### 1.5 The portrait — pattern B′

`DriverPortrait` writes `size` to inline `width`/`height`, which no class can
reach, so 26 and 28 are two elements: `hidden md:contents` around the 28 and
`shrink-0 md:hidden` around the 26. `md:contents` erases the desktop
wrapper's box at the fork, leaving the portrait a direct grid child exactly
as today. This is the idiom `driver-picker.tsx` already uses twice (72/52 and
48/40) — copied rather than invented.

The `!important`-class alternative was rejected: it would have kept one
element but broken the codebase's single existing answer to this problem.

## 2. Tests

PB1 already covered the addendum's acceptance assertion (1) — blocks stack at
base while `--fp-cols` still equals `sessions.length` at `md:` — and still
passes untouched. Assertion (2) was discharged by PR-A's `slots.test.ts`
PS1–PS6. So the two tests added here lock what **PR-B** introduces:

- **PB3 (widened)** — both row templates are classes, base `26px` and
  `md:` `32px`, neither carrying a bare `1fr`.
- **PB4** — the fork is in classes, not inline style: no inline
  `marginBottom` or `padding`; `mb-0 md:mb-[var(--space-3xl)]`; header is not
  `flex` at base but is at `md:`; all four padding sides forked with the same
  utility on both sides; context line `block mt-[6px] md:mt-0`.
- **PB5** — both portrait trees present, `28px` under `hidden md:contents`
  and `26px` under `md:hidden`.

**Guards proven discriminating**, PR-A's protocol: four ablations, each
failing exactly one test and nothing else. (A1 inline `marginBottom` → PB4.
A2 header keeps `flex` at base → PB4. A3 single 28px portrait → PB5.
A4 row template reverted to `32px` only → PB3.) All restored; the file
diffs identical to pre-ablation.

## 3. Deviations from the spec — deliberate, and why

**§B.2 asks for the full label ("Free Practice 1", not "FP1"). Not done.**
The component already renders `s.label` verbatim and adds no abbreviation —
which is all the "Things that will drift" entry actually forbids. The string
is produced in the **data layer**: `loadPractice.ts:143` and `:179` both
write `` label: `FP${idx}` ``. Changing it is out of this PR's declared scope
("no data-layer changes") and would alter the **desktop** render, breaking
the 0-diff-at-1440 contract. It is a two-line change needing its own commit
and a fresh baseline — same category as the `dateRange.ts` bug in §4.

## 4. Known, not fixed here

Unchanged from PR-A's list — `dateRange.ts`'s local-month/UTC-day mismatch,
the `/join` "8 friends" copy, the `[style*="Boldonse"]` selector that matches
nothing, `ALL_TEAMS` being 11 — plus §3 above.

## 5. Verification results (as built)

Dev server :3001, Supabase local :54421. Baselines captured by stashing
`src`, shooting, and unstashing — the checked-in baseline was stale
(perishable, trap 1) and was rewritten from HEAD before every compare.

| Check | Result |
|---|---|
| `bun run lint` | 0 errors (3 pre-existing warnings, `.superpowers/**/measure.mjs`) |
| `bun run typecheck` | clean |
| Unit (`vitest run --exclude 'tests/integration/**'`) | **311 passed / 51 files** (309 + PB4 + PB5) |
| Round 6 (sprint, 1 FP block) @1440 | **0 diff pixels** |
| Round 15 (normal, 3 FP blocks) @1440 | **0 diff pixels** |
| Main harness, every route @1440 | **0 diff pixels** |
| `scrollWidth === clientWidth` @375/390/412 | round 6 ✓, round 15 ✓ |
| Chip counts @390, round 6 | sprint_quali 1 · sprint 1 · quali 3 · race 3 |
| e2e | **74 passed / 0 failed / 18 skipped** — the PR-A baseline, unmoved |

### Fixture note — how the normal-weekend shape was reached

Round 6 (Miami) is the only local round with FP data, and it is the *sprint*
shape (`sessions.length === 1`). §B.4 case 1 had no fixture. It was produced
by seeding three `practice_overrides` rows on round 15 (Italian GP, the last
past normal weekend):

```sql
insert into practice_overrides (season, round, fp_index, p1_driver_id, p2_driver_id, p3_driver_id)
select 2026, 15, i,
  (select id from drivers where code='NOR'),
  (select id from drivers where code='PIA'),
  (select id from drivers where code='LEC')
from generate_series(1,3) i
on conflict do nothing;
```

That renders three stacked blocks, the `Top-3 fastest · …` header line, and
the `ovr` lap cell on all nine rows. **The rows were deleted after the
shots** — a fake override beats real OpenF1 data for that round, so leaving
it would poison the next session's captures. Re-run the SQL above to
reproduce.

Coverage this leaves open, stated rather than papered over: the **`awaiting`**
lap cell has no visual fixture at any width (it needs a session mid-running
with a missing lap, which neither OpenF1 nor `practice_overrides` can stage
locally), and neither does a **mixed** block (some `time`, some `awaiting`)
as `MOB_FP_NORMAL` draws. Both are covered by `lapCell.test.ts` only. The
`awaiting` branch is structurally identical to `ovr` — same wrapper, two
different constants — and `ovr` was verified on screen.
