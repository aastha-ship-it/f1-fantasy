# PR-A — `/dashboard/predict/round/[round]` mobile (390pt)

Source: `design/design_handoff_mobile_addendum/README.md` §A.
Canvas: `design/design_handoff_mobile_addendum/design/screens-mobile.jsx`
(`MobPredictRoundScreen`, lines 503–600), artboard
**📱 Predict · Round 06 sessions · Mobile 390**.
Branch: `feat/mobile-compatibility` (fourth commit; there are no PRs).

**Scope: presentation only.** No query, prop, type or server-action changes.
One fork, `md` = 780px: mobile values base-level, today's restored at `md:`.
The 1440 render is pixel-identical to the parent commit — that is the contract,
and it was measured, not asserted (§6).

This screen had **no artboard at all** before the addendum; PR-3 deferred it
(see that plan's §7) and it was the only page the whole mobile program had not
touched.

## Files

| File | Change |
|---|---|
| `src/app/dashboard/predict/round/[round]/page.tsx` | the fork |
| `src/lib/predict/slots.ts` | **new** — pure slot-shape helper, extracted |
| `src/lib/predict/slots.test.ts` | **new** — PS1–PS6 |
| `src/app/dashboard/predict/round/[round]/page.test.ts` | **new** — PR1–PR7 fork guards |

## 1. The layout, top to bottom

### 1.1 `<main>` (pattern A)

Was `px-6 py-10 pb-24 sm:px-8 md:pb-10 lg:px-12 xl:px-16`; now PR-3 §1.1's
string verbatim, plus `flex flex-col md:block` (see §2):

`mx-auto flex w-full max-w-[1600px] flex-col px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+24px)] md:block md:px-8 md:py-10 md:pb-10 lg:px-12 xl:px-16`

At ≥780: `md:px-8` = 32 (was `sm:px-8` = 32), `md:py-10`/`md:pb-10` = 40, `lg`/`xl`
untouched, `md:block` restores the block box. `sm:px-8` is dropped on purpose —
it only governed 640–779, which is below the fork.

### 1.2 Breadcrumb (pattern B)

Mobile: one mono-9 / 0.12em line, `← PREDICT · ROUND 06` left,
`LOBBY →` in `var(--accent)` right. Desktop `<p>` keeps today's
`/dashboard/predict · /round/06 · View the Lobby →` verbatim, gated
`hidden … md:block`.

This duplicates two hrefs. Checked against all three e2e specs that traverse
this route: they match `a[href^="/dashboard/predict/"]` **with the trailing
slash**, which neither `/dashboard/predict` nor a `/round/` href satisfies, so
no locator gains a second match.

### 1.3 Hero (patterns A + B′)

- Eyebrow keeps the page's own three-part string. `text-[9px] md:text-xs`,
  `tracking-[0.16em] md:tracking-[0.18em]`, dot `size-[5px] md:size-2`.
- h1 `text-[length:36px] md:text-[length:clamp(48px,6vw,76px)]`,
  `tracking-[-0.01em] md:tracking-[-0.015em]`.
- Meta line `text-[9px] tracking-[0.08em] md:text-xs md:tracking-[0.04em]`,
  `mt-3 md:mt-4`.
- Hero loses its bottom hairline and `pb-8` below the fork (the artboard has
  neither); both restored at `md:`.

**Font size and tracking moved out of the inline styles.** An inline
`fontSize` beats every `md:text-*`, so leaving `fontSize: "clamp(48px,6vw,76px)"`
inline would have pinned the desktop hero at its phone size. PR4 guards this.

**Track diagram** (§A.2): a second, `height={54}` instance sits beside the h1,
`md:hidden`, inside a `md:contents` wrapper so the `<h1>` returns to being a
direct child at the fork. The existing `size={300}` instance keeps its
`hidden … lg:flex` gate — it is not deleted. `height` and `size` are different
props, so one element genuinely cannot serve both widths.

### 1.4 Session rows

Section: `-mx-5`, `border-t border-b border-l-0 border-r-0`, `gap-0`,
transparent ground; `md:mx-0 md:mt-10 md:gap-px md:border-l md:border-r
md:bg-[color:var(--border)]` restores today's bordered 1px-gap grid. Border
widths are written **per side** — a base `border` shorthand sorts before an
`md:` longhand and outlives it (CLAUDE.md footgun; PR6 guards it).

A `md:hidden` `MobSectionHead title="Sessions" meta="{n} · picks required"`
sits above it.

Each session keeps its **single** `<Link>` (pattern A on the link's own
classes: `block … md:grid`, `px-5 pt-3.5 pb-4 md:px-6 md:pt-5 md:pb-5`,
`md:hover:` instead of `hover:` so the mobile emphasis is not clobbered).
Inside it:

- a new `md:hidden` three-block stack — status line → title row (label + meta |
  `LOCKS IN` + countdown) → chip row (chips + right-aligned CTA);
- the three existing divs, untouched, wrapped in **`hidden md:contents`**
  (pattern B′) so they remain the grid's direct children at ≥780.

Row emphasis, mobile only: open-and-unfilled gets `bg-[color:var(--surface-2)]`
+ `shadow-[inset_3px_0_0_0_var(--accent)]` (an inset shadow, not a
`border-left` — the sanctioned idiom); locked rows `opacity-70`. All reset at
`md:`.

## 2. The banner ordering conflict

The artboard puts the practice banner **after** the hero; this page has always
rendered it **before** (it predates the hero). Moving it in source would move
it on desktop too and break the 0-diff contract.

Resolved with flex order, not a DOM move: `<main>` is `flex flex-col` below the
fork with explicit `order-1..5` on its children, and `md:block` at it. `order`
is inert under `display: block`, so every `order-*` is a no-op at ≥780. The
banner's wrapper is `md:contents`, which erases its box at the fork so
`<PracticeBanner>`'s own `<section>` is again a direct child of `<main>`.
PR3 guards both halves.

## 3. Extraction — `src/lib/predict/slots.ts`

The inline `isSprint ? [p1] : [p1,p2,p3]` ternary became
`isSprintSession` / `slotCount` / `slotDriverIds` / `allSlotsFilled`.
Behaviour-preserving, the same idiom as PR-3's `orderRecentForm`.

Reason: the addendum's second required assertion is "a sprint-weekend session
row renders one pick chip, a race row renders three", and this route is an
async server component that cannot be render-tested. Extracting makes the count
provable (PS1–PS6), and both chip rows now map the *same* array, so one test
covers both trees (PR1).

## 4. Deviations from the canvas — deliberate, and why

| Canvas | Shipped | Why |
|---|---|---|
| CTA `PICK →` / `EDIT →` | mobile only; desktop keeps `Lock in picks →` / `Edit picks →` | §A.4 specifies the short set. `Edit picks →` does not fit beside three chips at 390. Desktop strings are unchanged, so 1440 is unaffected. |
| Session time `SAT 16:30 IST` | the page's existing `formatLocal()` → `12 SEPT 2026, 7:30 PM` | A weekday+timezone form would be a new formatter, i.e. more than presentation. Measured: it fits on one line at 375/390/412. |
| Locked clock `—` | mobile `—`, desktop `Locked` | The label directly above already reads "Locked"; `formatDelta`'s own "Locked" repeated under it at 17px stutters. `formatDelta` itself is untouched. |
| Empty chip ground | `var(--surface-2)` per the canvas JSX | README §A.4 omits it; the reference implementation sets it. |

## 5. Known, not fixed here

- **The banner still has its desktop `marginBottom: var(--space-3xl)` and its
  desktop header at 390**, so there is a 48px gap above `SESSIONS` where the
  artboard has 24, and the header's two blocks collide. Both are **PR-B**, which
  forks `PracticeBanner` — the artboard's 24 is the section head's own
  `mt-6`, so PR-B takes the banner's mobile bottom margin to 0.
- `formatDateRange`'s local-month/UTC-day bug (PR-3 §9) is untouched.

## 6. Verification results (as built)

| Check | Result |
|---|---|
| `bun run lint` | 0 errors (3 pre-existing warnings, all in `.superpowers/`) |
| `bun run typecheck` | clean |
| Unit (`npx vitest run --exclude 'tests/integration/**'`) | **309 passed** / 51 files (296 before + PS1–PS6 + PR1–PR7) |
| Integration | 25 pass, 1 fail — the pre-existing `rls.test.ts` I6 fixture failure. Not chased. |
| e2e, 4 device projects, `--workers=1` | **74 passed, 0 failed**, 18 skipped (all `reveal-portrait`) |
| Pixel diff @1440, 13 routes | **0 diff pixels**; baseline re-taken at the parent commit immediately before the compare |
| Overflow net @375/390/412, 13 routes | `scrollWidth === clientWidth` everywhere |

**Round 6 was shot separately.** The main harness discovers whatever round the
predict list links first — locally round 16, the Spanish GP, a plain 2-session
race weekend. The **sprint** shape the artboard draws (4 sessions; sprint rows
carrying ONE chip) was therefore in neither the 1440 diff nor the 390 shots.
`plans/mobile-shots/prA-round6.{spec,config}.ts` (gitignored under `plans/`)
shoots any round by `SHOT_ROUND`; round 6 (Miami: sprint_quali · sprint_race ·
quali · race) is 0-diff at 1440 and clean at all three phone widths, and the
spec reads the live DOM for chip counts:
`[{SPRINT QUALIFYING,1},{SPRINT,1},{QUALIFYING,3},{RACE,3}]`.

**The filled and emphasis states were shot too.** The harness only ever reaches
this page with empty slots, so the team-coloured chip (`color-mix` ground, 1px
team-hex border, code in Titillium 12) and the `EDIT →` CTA never rendered. A
pick was inserted for the fixture user on round 16 quali; that state is also
0-diff at 1440. The open-and-unfilled emphasis row (surface lift + 3px inset
accent edge) renders on round 16's race row.

**First round-6 run was void and re-taken.** It omitted the invite gate, so
both baseline and compare screenshotted `/join` and "matched" trivially. The
spec now calls `gateThroughInvite` and asserts it reached `/round/N` with a
`<main>` before shooting.

**Guards proven discriminating.** PR2, PR6 and PR7 were ablated rather than
trusted (`hidden md:contents` → `hidden md:block`; per-side borders →
shorthand; drop `md:shadow-none`). Each failed alone, and only its own test
failed. All restored.
