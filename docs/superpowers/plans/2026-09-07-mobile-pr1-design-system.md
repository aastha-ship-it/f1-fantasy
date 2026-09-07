# PR-1 — Mobile design system (390pt)

Source: `design/design_handoff_mobile/README.md` §"The mobile design system (PR-1)".
Canvas reference: `design/design_handoff_mobile/design/screens-mobile.jsx` lines 1–127
(`MobEyebrow`, `MobSectionHead`, `MobButton`, `MobTopBar`, `MobTabBar`, `MobBleed`).
Branch: `feat/mobile-pr1-design-system` (stacked on `feat/mobile-compatibility`).

**Scope: chrome + primitives only. No screen changes.** Every authenticated route
renders byte-identical at ≥780px (`md:`) after this PR. Below `md`, only the top
bar and tab bar change; the new primitives ship unused and get adopted in PRs 2–6.

## Hard rules (from the handoff + CLAUDE.md)

- One fork: `md` = 780px. Mobile values are base-level; the current desktop value
  is restored at `md:`. Never `min-[…]:`.
- Tokens from `src/app/globals.css` only. No new colours. No border-radius (avatars
  are the only circles). Fonts: Titillium Web 900 via
  `style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}`, Geist, Geist Mono
  via `data-tabular`. Every numeric gets `data-tabular`.
- Min tap target 44px. Nothing pinned over the tab bar.
- Page gutter is 20px = Tailwind `px-5` / `-mx-5` (Tailwind's default 0.25rem scale).
  Do **not** add a `--spacing-*` token (namespace trap).
- No `cn()`, no icon libs, no shadcn. Server components unless hooks are needed.

## 1. Tokens — `src/app/globals.css`

| Token | Before | After | Why |
|---|---|---|---|
| `--tabbar-item-h` | `52px` | `60px` | Handoff: tab bar is 60px + safe-area. `--tabbar-h` stays `calc(var(--tabbar-item-h) + 1px)`; the predict lock bar and (PR-2) profile save bar derive from it, so the e2e guard stays valid by construction. |

Update the comment block above it (it cites "52px … Task 12"). Nothing else in
`globals.css` changes.

## 2. `MobileTabBar` — `src/components/MobileTabBar.tsx`

Restyle to the canvas `MobTabBar`; structure, hrefs, `aria-current`, `md:hidden`
and `pb-[env(safe-area-inset-bottom,0px)]` all unchanged.

| Property | Before | After |
|---|---|---|
| Background | `color-mix(... var(--surface-2) 92%, transparent)` + `backdrop-blur` | solid `var(--surface-2)` (class `bg-[color:var(--surface-2)]`, drop `backdrop-blur` and the inline `background`) |
| Item layout | `gap-1 pt-2 pb-1` | centered column, `gap: 5px` (inline style, no `gap-1.25` guesswork), no extra padding — `min-h-[var(--tabbar-item-h)]` gives the 60px |
| Glyph | 16px | 15px |
| Label | 9px / `0.1em` | 8px / `0.1em`, still `uppercase` + `data-tabular` |
| Active | `var(--fg)` + `inset 0 2px 0 0 var(--accent)` | unchanged |
| Inactive | `var(--fg-subtle)` | unchanged |

Update the JSDoc's size references. Keep the load-bearing comment about the lock bar.

## 3. `TopBar` — `src/components/TopBar.tsx` (mobile row only)

Base = the canvas `MobTopBar`; `md:` = today's classes verbatim. The `<nav>`
stays `sticky top-0 z-30 border-b`.

| Element | Base (<780) | `md:` restoration |
|---|---|---|
| `<nav>` bg | `bg-[color:var(--bg)]` (solid) | `md:bg-[color:var(--bg)]/85 md:backdrop-blur` |
| Inner row | `h-[52px] px-5 gap-3` (no vertical padding) | `md:h-auto md:px-8 md:py-4 md:gap-4 lg:gap-8 lg:px-12 xl:px-16` — note today's base `px-6` is only visible <640 (`sm:px-8` covers 640–779), so `md:px-8` reproduces every ≥780 value exactly |
| Wordmark | `F1Mark height={16}` | `F1Mark height={22}`. F1Mark takes a numeric prop, so render both inside the one `<Link>`: `<span className="flex md:hidden"><F1Mark height={16}/></span><span className="hidden md:flex"><F1Mark height={22}/></span>` |
| Nav `<ul>` | `hidden` | `md:flex` (unchanged) |
| Right cluster | `ml-auto flex items-center gap-3` | `md:gap-4` |
| ScoringHelp `?` | 32×32 box, see §4 | today's pill |
| Avatar `<Link>` | `size-8 rounded-full border text-xs bg-[color:var(--surface-2)]` + Titillium inline style (12px = `text-xs`) | `md:size-9 md:text-sm md:bg-transparent`. Active/inactive border colours unchanged. |
| Sign-out `⏻` | **kept**, restyled as a 32×32 bordered box (`size-8 border border-[color:var(--border)] flex items-center justify-center`) so it is a 44px-adjacent target matching the `?` | `md:size-auto md:border-0` restoring today's bare glyph |

**Deliberate deviation, flagged for review:** the canvas mobile top bar has no
sign-out control, but `/profile` has no sign-out either — the `⏻` in `TopBar` is
the only sign-out affordance in the app, and `TopBar.test.tsx` locks "still exposes
Profile and Sign out on mobile". PR-1 keeps it in the mobile row. Recommendation:
PR-2 (Profile) adds a sign-out row to the mobile profile screen and then drops `⏻`
from the mobile top bar to match the canvas.

## 4. `ScoringHelp` trigger — `src/components/ScoringHelp.tsx`

Only the `<button>` changes; the `<dialog>` is untouched (SH1 test covers it).

- Move `padding` off `style` and onto classes (inline padding cannot be reached by a
  breakpoint — same fix SH1 made for the dialog). Base: `size-8 p-0 justify-center`
  (32×32 box). `md:`: `md:size-auto md:px-[var(--space-md)] md:py-[var(--space-xs)]`.
  Keep `border: 1px solid var(--border)`, `background: transparent`, `fontSize: 11`,
  `letterSpacing: 0.1em` inline — those are the same at both widths. Base colour is
  `var(--fg-muted)` per canvas (`text-[color:var(--fg-muted)] md:text-[color:var(--fg-subtle)]`).
- The 16px circled glyph `<span>` becomes `hidden md:inline-flex`; add a sibling plain
  `?` span `md:hidden` (mono 12px via `data-tabular`, `fontSize: 12`).
- `aria-label="How scoring works"`, `aria-haspopup="dialog"`, and the `lg:inline`
  visible label are unchanged (TopBar tests assert all three).

## 5. Shared mobile primitives — new `src/components/MobilePrimitives.tsx`

One module, six small server components, modelled on `TopBar.tsx` style (JSDoc with
canvas reference, explicit prop types, no `cn()`). **Contract:** these are for the
mobile tree only — render them inside a `md:hidden` subtree (or a mobile-only
route). They carry no `md:` classes of their own. Used 11–21× each across the
mobile artboards, which clears the skill's "3+ screens" extraction bar.

| Export | Canvas | Renders |
|---|---|---|
| `MobEyebrow({ children, color?, className? })` | `MobEyebrow` | `<p data-tabular className="uppercase text-[color:var(--fg-subtle)]" style={{ fontSize: 9, letterSpacing: "0.16em" }}>`; `color` overrides via inline style (e.g. `var(--accent)`). |
| `MobSectionHead({ title, meta?, className? })` | `MobSectionHead` | `<div className="mb-3 flex items-baseline justify-between gap-3">` — title `<h2>` Titillium inline-style, `fontSize: 16, lineHeight: 1`; meta `<p data-tabular>` mono 9 / `0.1em` / uppercase / `var(--fg-subtle)`. |
| `MobBleed({ children, className? })` | `MobBleed` | `<div className="-mx-5">` — cancels the 20px page gutter. `className` appends (callers add `border-y`, backgrounds, `overflow-hidden`). |
| `MobHairlineGrid({ cols, children, className? })` | the `gap: 1, background: var(--border)` grid | `<div className="grid gap-px bg-[color:var(--border)]" style={{ gridTemplateColumns: \`repeat(${cols}, minmax(0,1fr))\` }}>`. Children must paint their own `bg-[color:var(--surface)]`; document it. `cols` is an integer 2–5. Bordered variant via `className="border border-[color:var(--border)]"` from the caller. |
| `MobDisclosureRow({ summary, children, open?, minHeight?, panelClassName?, className? })` | lobby session rows / standings rows / league rows (`+`/`−`, expanded = `surface-2` + accent stripe) | Native `<details className="group border-b border-[color:var(--border)]">` (zero JS, matches `DriverStandingsRowMobile`). `<summary>` = `relative grid cursor-pointer list-none items-center gap-3 px-5 [&::-webkit-details-marker]:hidden` with `style={{ minHeight }}` (default 60; callers pass 52–68), grid `minmax(0,1fr) auto`, `group-open:bg-[color:var(--surface-2)] group-open:shadow-[inset_3px_0_0_0_var(--accent)]`. Trailing glyph: `<span aria-hidden data-tabular className="group-open:hidden" style={{fontSize:11,color:"var(--fg-subtle)"}}>+</span><span aria-hidden data-tabular className="hidden group-open:inline">−</span>`. Panel `<div className="bg-[color:var(--surface-2)] px-5 pb-4">` (lobby overrides to `surface` via `panelClassName`). `summary` is a ReactNode the caller lays out (they own the inner columns). `open` maps to the `open` attribute for SSR-expanded rows. |
| `MobButton({ children, tone?, size?, href?, type?, disabled?, className?, ...button props })` | `MobButton` | `<Link>` when `href` is given, else `<button>`. Shared classes: `grid w-full place-items-center uppercase` + Titillium inline style `fontSize: 13, letterSpacing: "0.04em"`. `size`: `"full"` → `h-[52px]` (default), `"paired"` → `h-[46px]`. `tone`: `accent` → `bg-[color:var(--accent)] text-[color:var(--fg)]`; `ghost` → `border border-[color:var(--border)] text-[color:var(--fg-muted)]`; `surface` → `bg-[color:var(--surface-2)] border border-[color:var(--border)] text-[color:var(--fg)]`. `disabled:opacity-40`. |

The accent stripe on `MobDisclosureRow` is an `inset` box-shadow, not a `border-left`,
and marks "the one row that matters" — this is the handoff's sanctioned idiom, and
is the same mechanism the tab bar's active state already uses.

**Flag for review:** the canvas puts `var(--fg)` on the accent button; every existing
accent CTA in the app uses `text-black`. At 13px bold, fg-on-accent is ~3.3:1 (below
AA for non-large text). PR-1 follows the canvas; one-line change if you'd rather
keep `text-black`.

## 6. Tests

- New `src/components/MobilePrimitives.test.tsx` (jsdom), numbered `MP1…`:
  - MP1 `MobBleed` carries `-mx-5`.
  - MP2 `MobHairlineGrid` sets `gap-px`, border background, and `repeat(n, minmax(0,1fr))`.
  - MP3 `MobDisclosureRow` renders `<details>/<summary>`, hides the native marker,
    has `minHeight ≥ 44`, swaps `+`/`−` via `group-open`, and applies the accent
    inset shadow (not a `border-left`) on open.
  - MP4 `MobButton` renders `<a>` with `href`, `<button>` otherwise; 52px default,
    46px paired; each tone maps to its tokens; every colour is a `var(--…)`.
  - MP5 `MobSectionHead` title uses the Titillium inline-style string and meta is
    `data-tabular`.
  - MP6 no primitive emits a `rounded-*` class or `borderRadius` style.
- `MobileTabBar.test.tsx`: add MT-N assertions — solid `bg-[color:var(--surface-2)]`,
  no `backdrop-blur`, glyph 15 / label 8, item `min-h-[var(--tabbar-item-h)]`.
- `TopBar.test.tsx`: add assertions — row is `h-[52px] px-5` at base with
  `md:h-auto md:px-8 md:py-4`; nav bg solid at base with `md:bg-…/85 md:backdrop-blur`;
  avatar `size-8 … md:size-9`; both F1Mark spans (`md:hidden` / `hidden md:flex`);
  sign-out still present. Existing six tests must stay green unmodified.
- `ScoringHelp.test.tsx`: add SH2 — trigger `padding` is not inline; base `size-8`,
  `md:size-auto md:px-[var(--space-md)] md:py-[var(--space-xs)]`; circled glyph
  `hidden md:inline-flex`; plain `?` `md:hidden`; `aria-label` intact.
- e2e: no new specs; `mobile-nav`, `predict-lock-bar`, `no-horizontal-overflow`,
  `fork-audit`, `admin-mobile`, `reveal-portrait`, `auth` all stay green.

## 7. Verification (before/after, this PR)

1. Baseline **before any edit**: 1440×900 full-page + 390×844 screenshots of
   `/dashboard`, `/dashboard/predict`, `/dashboard/predict/round/[r]`, one
   `/dashboard/predict/[eventId]`, `/dashboard/lobby`, `/dashboard/standings`,
   `/dashboard/league`, `/reveal`, `/profile`, `/admin` into the scratchpad.
2. After: re-capture. **1440 must be 0 diff pixels on every route.** 390 differs
   only in the top bar band and the tab bar band; compare against the 📱 artboards'
   chrome (52px bar: wordmark 16, `?` 32×32, avatar 32 circle on `surface-2`; 60px
   tab bar on `surface-2`, glyph 15, label 8).
3. `scrollWidth === clientWidth` at 375 / 390 / 412 on every route above.
4. `bun run lint && bun run typecheck && bun run test`, then
   `bun --env-file=.env.local run e2e` (all four device projects).

## 8. Out of scope (later PRs)

Any page-level use of the primitives; the profile save bar; moving sign-out into
`/profile`; the admin strip (PR-6); `TrackDiagram`/`ScoringHelp` modal changes.
