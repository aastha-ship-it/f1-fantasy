# PR-2 — Chrome, Calendar, Profile, Login, Join (390pt)

Source: `design/design_handoff_mobile/README.md` §2.1–2.4.
Canvas: `design/design_handoff_mobile/design/screens-mobile.jsx` (`MobDashboardScreen`,
lines 129–258) and `screens-mobile-c.jsx` (`MobProfileScreen`, `MobLoginScreen`,
`MobJoinScreen`).
Branch: `feat/mobile-pr2-screens`, stacked on `feat/mobile-pr1-design-system`.

**Scope: presentation only.** No new queries, no server-action changes, no schema
changes. Every route renders byte-identical at ≥780px (`md:`) after this PR — the
1440 baseline in `plans/mobile-shots/baseline-1440/` was re-taken at PR-1's commit
`661878f` and is the contract.

## Hard rules (unchanged from PR-1)

- One fork: `md` = 780px. Mobile values are base-level; today's desktop value is
  restored at `md:`. Never `min-[…]:`.
- Tokens from `globals.css` only. No new colours, no border-radius (avatars only).
  Titillium via `style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}`,
  every numeric `data-tabular`.
- 20px page gutter = `px-5` / `-mx-5`. Never add a `--spacing-*` token.
- Min tap target 44px. Nothing pinned over the tab bar.
- No `cn()`, no icon libs, no shadcn. Server components unless hooks are needed.
- Primitives from `src/components/MobilePrimitives.tsx` are **mobile-tree only** —
  they carry no `md:` classes, so they may only be rendered inside a `md:hidden`
  subtree.

## The two structural patterns

Everything below uses one of exactly two patterns. Pick per element, and say which
in a comment when it is not obvious.

**A. Fork the classes** — one element, base = mobile, `md:` = today's value. Use
when the DOM shape is the same at both widths, and **always** when the element is
form state or a test anchor (a duplicated `<input name>` double-submits, and a
duplicated accessible name breaks Playwright's strict mode).

**B. Fork the subtree** — `<div className="md:hidden">` mobile markup next to the
existing desktop markup, which gets `hidden md:block` (or `md:grid`/`md:flex` to
match its current display). Use when the two layouts are genuinely different
trees. Put the visibility class on the **existing element**, never on a new
wrapper around it — a new wrapper changes the desktop box and breaks the pixel
diff.

Pattern B duplicates DOM but never state: the duplicated controls are
`type="button"` handlers reading the same React state, so both trees stay in sync
and only the visible one is in the a11y tree.

## Decisions this PR closes (flagged in PR-1)

1. **Sign-out moves to the mobile profile screen.** `/profile` gets a full-width
   ghost sign-out control below Calendar sync, posting to the existing
   `signOutAction` (presentation, not a data change). `TopBar`'s `⏻` form then
   becomes `hidden md:block`. Tests move with it (§7).
2. **Accent button text stays `var(--fg)`**, as the canvas draws it and as PR-1
   shipped it. Recorded for the record: at 13px that is ~3.3:1 against
   `--accent`, under AA for non-large text, and every pre-mobile CTA in the app
   uses `text-black` instead. Changing it is one line in `MobilePrimitives.tsx`
   (`TONES.accent`) and would then apply to every mobile screen at once. Not
   changing it here because it is a design-system-wide call, not a PR-2 call.

## Design-vs-data disagreements — report, do not invent

The canvas draws numbers this app does not have at these call sites. Do **not**
add queries to satisfy them.

| Canvas | Reality | What to build |
|---|---|---|
| Hero `2 of 3 / slots picked` | `/dashboard` never reads the user's predictions for the next session. | Right-hand block of the hero divider renders `sessionLabel(event.session_type)` on one line, `Round NN` under it, mono 9 upper right-aligned. Same shape, real data. |
| Calendar row state `SPRINT` | `raceCalendar` is filtered to `session_type='race'`, so a round's sprint sessions are not loaded. | Three states only: `Next` (accent), `✓ Revealed` (subtle), `—`. |
| Footer row `ALL 24 ROUNDS →` | There is no all-rounds route, and the list already renders every round. | Omit the row. The list ends on its last round's hairline. |
| Section meta `5 done · 1 next · 18 to go` | Derivable. | `{doneCount} done · 1 next · {rest} to go` — the mobile head says "to go" per canvas; the desktop head keeps today's "upcoming" string verbatim. |
| Join: 6-cell code grid | Production codes are variable length (`LECLERC-FTW-2026` is 16 chars) — already documented in `join-form.tsx`. | One 56px mono field with the cell treatment (surface ground, accent border once non-empty). Helper copy stays today's, not the canvas's "6 characters". |
| Profile identity row with an `EDIT` chip | The display name is a required input and an e2e anchor. | The input **is** the name in the row (borderless, display 16px). The `EDIT` chip is a `<label htmlFor="display_name">` so tapping it focuses the input; it carries `aria-hidden` so it does not concatenate into the input's accessible name. |
| Profile all-time hero: static `Senna · MP4/4` + McLaren car | Ours is a free-text input. | Keep the input, mobile-sized. The `F1Car` watermark uses the **currently selected favourite team's** `carSrc` (`teamMeta(favTeam)?.carSrc`), rendered only when a team is selected. Real data, no new query. |
| Calendar sync fake URL | Ours is minted on demand. | Unchanged behaviour; only the layout stacks. |

## 1. `TopBar` — `src/components/TopBar.tsx`

One change: the sign-out `<form>` becomes `hidden md:block`. Nothing else moves —
the 52px row, the forked wordmark, the avatar and the `?` box all stay as PR-1
left them. Replace the "PR-2 should move sign-out into the mobile profile screen"
comment with one saying it now lives there, and name the route.

## 2. `/dashboard` — `src/app/dashboard/page.tsx`

`<main>` forks (pattern A): base `px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+24px)]`,
restored at `md:px-8 md:py-10 md:pb-10` plus today's `sm:px-8 lg:px-12 xl:px-16`.
Verify against today's string — every class today's `<main>` resolves to at ≥780
must still be there.

Then pattern B for the three blocks. Existing `NextRaceHero`, the calendar
`<section>` and the standings `<section>` get `hidden md:block` on themselves
(the standings section is `grid gap-8 lg:grid-cols-2` today → `hidden md:grid`).
New mobile siblings, in a single `md:hidden` subtree, all inside the same `<main>`:

**Hero** — `MobBleed` with `-mt-5` to cancel the main's top padding, `border-y`,
`overflow-hidden`, `relative`, `px-5 pt-5 pb-6`, background
`linear-gradient(160deg, #1a0608 0%, var(--surface) 70%)` (the canvas's literal —
it is the same one-off gradient the desktop hero already inlines, so it is not a
new token).
- Track art: absolutely positioned `right: 12, top: 14`, `opacity: 0.2`,
  `pointer-events-none`, `<TrackDiagram circuit={…} height={?}>` sized so the
  drawn width is ~170 (`TrackDiagram` derives width from `height × ratio`; pass
  `height` and check the rendered width at 390 — **inset only, never a negative
  offset**).
- `MobEyebrow color="var(--accent)"` with a 5px accent dot: `● Next race · Round NN`.
- `<h1>` Titillium 46 / `lineHeight: 0.9`, `{short}` then `<br/>GRAND PRIX`
  (muted second line, as the desktop hero does).
- Meta: mono 10 / `0.08em` / `--fg-muted`, two lines — date range + circuit, then
  `{lengthKm} KM · {laps} LAPS` when `circuitMeta` resolves. Reuse
  `formatDateRange` and `circuitMeta`; do not re-derive.
- Divider `border-t` + `pt-4`, then a flex row: left `MobEyebrow` "Picks lock in"
  over the countdown in mono 30 (`lockCountdown`, `data-tabular`); right the
  session-label block from the disagreements table.
- `<MobButton href="/dashboard/predict">Make predictions →</MobButton>`.
- Empty state: when there is no `nextOpen`, the mobile tree renders the same
  "Quiet week / NO OPEN SESSIONS" copy as `EmptyHero`, in the bleed frame.

**Calendar** — `MobSectionHead title="{season} Calendar" meta="…"` then `MobBleed`
with `border-t`, one row per race: 68px, `grid` `34px 64px minmax(0,1fr) auto`,
`gap-3`, `px-5`, `border-b`. Next row = `bg-[color:var(--surface-2)]` +
`shadow-[inset_3px_0_0_0_var(--accent)]`; past-and-unrevealed rows `opacity-60`.
Columns: `R06` mono 11 (accent when next), `<TrackDiagram height={30} strokeWidth={1.6}>`,
name (Titillium 15, `truncate`, `min-w-0`) over circuit (mono 9 upper subtle),
then right-aligned date (mono 11 muted) over state (mono 8 `0.12em`).
Revealed rows keep today's behaviour of linking to `/reveal/{id}` — wrap the row
in the `<Link>` rather than only the diagram, since a 68px row is the tap target.

**Championship** — `MobSectionHead title="Championship" meta="After Round NN"`,
then a **zero-JS segmented control**: two `sr-only` radios (`name="champ"`,
`defaultChecked` on drivers) as the first two children of the container, then the
two 40px labels in a `grid-cols-2` bordered strip, then the two panels. Active
segment and panel visibility come from `peer-checked/drivers:` and
`peer-checked/constructors:` variants (Tailwind v4 named peers; both inputs must
precede the labels and panels as siblings). Active label =
`bg-[color:var(--surface-2)]` + `shadow-[inset_0_-2px_0_0_var(--accent)]`,
inactive `--fg-subtle`. This keeps the page a server component — do not add
`"use client"` to the dashboard.
Panels are `MobBleed` row lists, 60px rows, `grid` `24px 36px minmax(0,1fr) 3px auto`:
position (Titillium 16, accent for P1), `<DriverPortrait size={32}>` /
constructor logo 26, name + team short in team hex (mono 9), the 3px team-hex
bar, points mono 16. Both lists come from the existing `driverStandings` /
`constructorStandings` — take the first 5 for mobile. Empty-state copy is today's
("Standings populate after the first race.").

## 3. `/profile`

### `page.tsx`
`<main>` forks like the dashboard's, with enough bottom padding to clear **both**
the pinned save bar and the tab bar: base
`pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+96px)] md:pb-12`.
The heading block forks by classes (pattern A): mobile eyebrow is the
`MobEyebrow`-equivalent 9px, `<h1>` 36 / `0.9`; `md:` restores today's
`clamp(40px, 7vw, 72px)` and the 12-unit bottom margin. The "Signed in as …"
paragraph is `hidden md:block` on mobile — the email is in the identity row.

### `profile-form.tsx`
Client component already; keep it one form.

- **Identity row** (`md:hidden`, but it hosts the shared input — see below):
  `border`, `bg-[color:var(--surface)]`, `p-[14px]`, flex `gap-[14px]`, 46px
  avatar circle on `--surface-2` with a 1px border in the selected team's hex
  (`var(--border)` when none), initial in Titillium 18. Then the input, then the
  `EDIT` label chip.
- **The display-name input forks by classes, it is not duplicated.** One
  `<input id="display_name" name="display_name">`. Base: transparent, no border,
  full width, Titillium 16, `p-0`; `md:` restores today's
  `border … bg-[color:var(--surface)] px-5 py-4 text-2xl max-w-md`. Its `<label>`
  keeps the exact text `Your name (required)` / `Display name` and becomes
  `sr-only md:mb-3 md:block …` so `getByLabel` still resolves at every width.
  The helper paragraph under it is `hidden md:block`.
  On mobile the email sits under the input inside the identity row (mono 9 subtle).
- **Favourite team / driver** — pattern B. Mobile: `MobHairlineGrid cols={5}`
  with `border`; tiles `bg-[color:var(--surface)]` (selected `--surface-2` +
  `shadow-[inset_0_0_0_1px_<hex>]`), `min-h-[68px]` for teams (logo 26 + `short`
  mono 8) and `min-h-[78px]` for drivers (`DriverPortrait size={34}` + code
  Titillium 11). Both stay `<button type="button" aria-pressed>` driven by the
  existing `favTeam` / `favDriverId` state. Drivers: `drivers.slice(0, 20)` as
  today — the canvas's 10 is a fixture artefact, and cutting the roster in half
  on mobile would be a functional regression.
- **All-time hero** — mobile card per the disagreements table: `border`,
  `bg-[color:var(--surface)]`, `p-4`, `relative overflow-hidden`, the input at
  Titillium 22, helper mono 10. Watermark `F1Car` at `opacity-30`,
  `right: -60, bottom: -8`, width 280, inside the `overflow-hidden` card, only
  when `favTeam` resolves. The input is the same shared element (pattern A) — one
  `favorite_past_driver` control, forked classes.
- **Save bar** — pattern A on today's footer row. Base:
  `fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px))] z-20 border-t border-[color:var(--border)] bg-[color:var(--bg)] px-5 py-3`;
  `md:` restores `md:static md:z-auto md:border-0 md:bg-transparent md:p-0` plus
  today's `flex flex-wrap items-center justify-between gap-4`. The single submit
  button forks to `h-[52px] w-full grid place-items-center` at base with today's
  `md:h-auto md:w-auto md:px-10 md:py-4` restored. **One submit button only** —
  a second one with the same accessible name breaks the e2e click in strict mode.
  Error text stays in the bar, `text-xs md:text-sm`.
- **Sign out** — new, `md:hidden`, directly under Calendar sync and above the
  save bar's spacer: a `<form action={signOutAction}>` wrapping
  `<MobButton type="submit" tone="ghost">Sign out</MobButton>`. Import
  `signOutAction` from `@/app/signout/actions`. Accessible name must be exactly
  `Sign out` so the e2e anchor is unchanged in wording, only in location.
  `profile-form.tsx` is a client component and a `"use server"` action may be
  passed to `action=` from one — that is the same pattern `TopBar` uses.

### `calendar-sync.tsx`
Pattern B, sharing `pending` / `result` / `copied` state. Existing `<section>`
becomes `hidden md:grid` (its current classes otherwise untouched). New mobile
sibling: `MobSectionHead title="Calendar sync" meta="Beta"`, then a `border`
`bg-[color:var(--surface)]` `p-4` card holding
(1) a flex row of the existing 34px calendar SVG + the copy at 12px/1.5,
including the real `{eventCount} events · {sessionCount} sessions`,
(2) once revealed, the URL row on `--surface-2` (mono 9, `truncate`, accent
`COPY` button — a real `<button>`, min 44px tall tap target even though the
canvas draws it as text), and
(3) `<MobButton tone="surface">` running the same `reveal()` — copy
`Add to Google Calendar` before reveal, matching the canvas. The three numbered
steps are `hidden md:block` (the canvas drops them on mobile).

## 4. `/login` — `src/app/login/page.tsx`

No chrome, no tab bar; `<main>` is `min-h-dvh`. The desktop split is `lg:`, so
below `md` we add a mobile tree and leave the ≥780 render untouched.

- Existing livery `<section>` is already `hidden … lg:flex` — do not touch it.
- Existing form `<section>` gets `hidden md:flex` (it is `flex` today) so it
  disappears below the fork.
- New `md:hidden` mobile tree, `flex min-h-dvh flex-col`:
  - **300px band**: `relative overflow-hidden bg-[#0a0608] border-b`, `grid place-items-center`.
    Diagonal stripe overlay (`repeating-linear-gradient(115deg, transparent 0 40px, rgba(232,0,45,0.05) 40px 42px)`),
    the Ferrari `next/image` at width 520 rotated `-8deg` with the existing
    drop-shadow, a bottom-to-`#0a0608` gradient over it, `F1Mark height={18}` +
    `Fantasy · The Group` eyebrow at `top-5 left-5`, and the round meta at
    `bottom-4 left-5`. Keep today's meta string verbatim — it is hardcoded copy
    on desktop too, and changing it is not this PR's business.
  - Body `flex-1 px-5 pt-7 pb-6 flex flex-col`: eyebrow `Sign in to predict`,
    `<h1 data-tight>` Titillium 54 / `0.88` reading `CALL<br/>THE RACE.`,
    paragraph 14/1.55 muted, then `mt-auto` holding `<GoogleSignInButton>` and
    the invite line (mono 9, centred).
  - `GoogleSignInButton` forks by classes (pattern A — it is one client island,
    do not duplicate it): base `h-[54px] w-full rounded-none border bg-[color:var(--surface)] text-sm`,
    `md:` restores today's `md:h-auto md:rounded md:px-6 md:py-3`. Its accessible
    name (`Sign in with Google`) must not change.

## 5. `/join` — `src/app/join/page.tsx` + `join-form.tsx`

Same shape: existing left hero `<section>` and right form `<section>` get
`hidden md:flex`, plus a new `md:hidden` tree:

- `relative overflow-hidden flex min-h-dvh flex-col` with the 115deg stripe
  overlay at `rgba(232,0,45,0.04)`.
- Header `px-5 pt-6`: `F1Mark height={18}` + `Invite only` eyebrow.
- Body `flex-1 px-5 pt-9 pb-6 flex flex-col`: `<h1 data-tight>` Titillium 56 /
  `0.86` reading `YOU NEED<br/>A CODE.`, paragraph 14/1.55 muted (keep the
  existing "ask Aastha" helper copy somewhere — it is the only recovery path).
- The form is one `<JoinForm>` instance, forked by classes: base gives the input
  `h-[56px] w-full` on `--surface` with the accent border once non-empty (today's
  `borderColor` ternary already does this) and mono 22 with `0.18em`; `md:`
  restores today's `md:h-auto md:px-5 md:py-5 md:text-2xl`. Label stays exactly
  `Invite code`, button `aria-label="Continue"` stays. Visible button text may
  read `Join the group →` below `md` (`md:hidden` span + `hidden md:inline`
  span for today's text) — the aria-label is what the tests bind to.
- Bottom `mt-auto grid gap-3`: the submit button (52px full-width at base) and
  the `Already a member? Sign in` line linking to `/login`.

## 6. Tests

- `TopBar.test.tsx` — TB-F5 becomes "sign-out is desktop-only": the `<form>`
  carries `hidden md:block`. The older "still exposes Profile and Sign out on
  mobile" test loses its sign-out half (the avatar half stays) and gains a
  comment pointing at the profile screen. Keep every other assertion.
- New `src/app/profile/profile-form.test.tsx` (jsdom), numbered `PF1…`:
  - PF1 one `input[name="display_name"]` in the document (the fork is classes,
    not a duplicate), and its label text is unchanged.
  - PF2 the save row is `fixed` + `bottom-[calc(var(--tabbar-h)…)]` at base and
    `md:static` at `md:`; exactly one `type="submit"`.
  - PF3 a `Sign out` submit exists inside a form and its wrapper is `md:hidden`.
  - PF4 mobile team/driver grids are `md:hidden` and the desktop ones
    `hidden md:block`; both render all 10 teams / the same driver count.
  - PF5 no `rounded-*` outside the avatar, no hex literal in a className.
  Mock `@/app/signout/actions` and `./actions` the way `TopBar.test.tsx` mocks
  the server action.
- `src/app/dashboard/page.test.tsx` is not viable (async server component with
  Supabase) — the dashboard's guard is the pixel diff plus the existing e2e.
- e2e:
  - `auth.spec.ts` — the post-save assertion `getByRole("button", { name: "Sign out" })`
    now fails on the phone projects. Replace with the TopBar avatar link
    (`getByRole("link", { name: "Profile" })`) plus today's hero-heading check,
    and add a comment saying sign-out moved to `/profile`.
  - `mobile-nav.spec.ts` — new test: at 375px, `/profile` exposes a visible
    `Sign out` button, and `/dashboard` does not.
  - Everything else (`fork-audit`, `no-horizontal-overflow`, `predict-lock-bar`,
    `admin-mobile`, `reveal-portrait`) must stay green unmodified. Note
    `no-horizontal-overflow`'s "dashboard hero art stays inside the viewport"
    runs at 375 where the desktop hero is now `display:none`: its `wrap`/`diag`
    lookup will find nothing and the test must not silently pass on a rotted
    anchor. **Update it** to look for the mobile hero's diagram below the fork,
    or to assert at a ≥780 viewport — decide by reading it, and say which.

## 7. Verification

1. `bun run lint && bun run typecheck && bun run test` (Vitest baseline before
   this PR: 283 passing).
2. Dev server on `:3001`, then
   `MODE=compare OUT_DIR=plans/mobile-shots/out/pr2 bun --env-file=.env.local run playwright test --config plans/mobile-shots/playwright.config.ts`.
   **All 13 routes must be 0 diff pixels at 1440**, and `overflow.json` must show
   `sw === cw` at 375 / 390 / 412 everywhere. The baseline now includes `/join`
   and `/login`, which PR-1's did not.
3. `E2E_BASE_URL=http://localhost:3001 bun --env-file=.env.local run e2e --workers=1`
   across all four device projects.
4. Eyeball the new `@390` shots against the 📱 artboards for dashboard, profile,
   login and join.

## 8. Out of scope

Predict list/detail (PR-3), lobby (PR-4), reveal (PR-5), standings/league/admin
(PR-6). The `--tabbar-*` tokens, `MobilePrimitives`, `MobileTabBar` and
`ScoringHelp` are PR-1's and stay as they are.
