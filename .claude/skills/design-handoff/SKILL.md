---
name: design-handoff
description: |
  Use when the user asks to implement, port, or replicate a design from Claude (the design canvas) into the F1 Fantasy codebase. Triggers on prompts like "implement the design in plans/designs/<name>/", "port these screens", "build out the reveal screen from the canvas", or any time a `design/` or `plans/designs/` path is named as the source of UI work. Encodes the project's tokens, Tailwind v4 quirks, component conventions, absolute bans, and Playwright verification loop. Also use when redesigning an existing route/screen against a new canvas export.
---

# Design handoff — Claude design canvas → Claude Code implementation

## What this skill exists to fix

Designs created in the Claude design canvas live in a sandbox with shadcn/ui primitives, Tailwind defaults, system fonts, and arbitrary color values. When ported to this codebase, four classes of regression happen by default:

1. **Tokens get inlined as raw values.** `#E8002D` instead of `var(--accent)`. `Inter` instead of Geist. `12px` instead of `var(--space-md)`.
2. **Tailwind v4 namespace traps fire.** `--spacing-xl` accidentally hijacks `max-w-xl`. `space-y-*` silently doesn't work on tokens it doesn't know.
3. **Conventions drift.** Imported `cn()` utility appears. shadcn `<Button>` gets inlined. Client components multiply unnecessarily. `<div className="bg-red-500">` lands instead of `bg-[color:var(--accent)]`.
4. **One of the ten absolute bans gets reintroduced** — a left-border stripe, a gradient text, a generic 3-column icon grid.

This skill stops all four before code lands.

## When to use

Trigger when the user asks for any of:

- "Implement the design at `plans/designs/<name>/`" (or `design/<name>/`)
- "Port the canvas export for the reveal screen"
- "Build the standings page from the wireframe"
- "Redesign the predict screen using the new canvas at `<path>`"

If the user asks for new UI without a design reference, **do not invoke this skill** — that's a different conversation. Politely surface that the design rails in `.impeccable.md` apply but no canvas is being ported.

## Prerequisites — refuse to proceed without these

The user must place these in a single folder, conventionally `plans/designs/<screen-name>-<YYYYMMDD>/`:

1. **A design export** — `wireframe.html`, `canvas.jsx`, or `canvas.tsx`. Code from the Claude design canvas. This is the **structural** reference: hierarchy, composition, what-goes-where.
2. **A screenshot** — `screenshot.png` (or `screenshot-mobile.png`, `screenshot-desktop.png` if both). This is the **visual** ground truth: spacing, typography, accent placement, the things the export's hardcoded values will lie about after token translation.

If either is missing, stop and ask. Do not improvise.

The user is **not** required to write a per-screen brief. Intent comes through the prompt itself ("this is the reveal moment, it should breathe") or not at all. If intent matters and isn't supplied, ask one targeted question — don't request a document.

## Read-first reference materials

Before writing any code, read these in order:

1. **`CLAUDE.md`** — project-wide conventions, footguns, hard boundaries.
2. **`.impeccable.md`** — design rails. The brand personality, color philosophy (60-30-10), typography stack, motion rules, ten absolute bans. **This is authoritative for design decisions.**
3. **`src/app/globals.css`** — the actual token definitions. Colors, spacing, fonts. Read every CSS variable; the export will use different names for the same things.
4. **`src/components/TopBar.tsx`** — the canonical example of how this project writes components. Match its style: prop conventions, className idioms, no `cn()`, inline-style for Boldonse, `data-tabular` attribute for numerics.
5. **The existing implementation of the screen being redesigned** (if any). Find it under `src/app/**/page.tsx` or its colocated children. Preserve data hooks, server actions, types — only swap the markup and classes.
6. **`design/data.jsx`** — the canvas's static fixture file. When the canvas's `screens-*.jsx` references `TEAMS["McLaren"]`, `DRIVERS`, `CALENDAR`, `TRACKS`, `FRIENDS`, `MIAMI_RESULT`, or `MIAMI_PREDICTIONS` — those are defined here. Read it directly to get values rather than reverse-engineering them from the screen markup. The canvas's `F1Mark`, `F1Car`, `TrackDiagram`, `DriverPhoto`, `TeamLogo` JSX components are also defined here; the production equivalents already live under `src/components/` and `src/lib/design/` (see "Design library").

If any of these files have moved or been renamed, read what exists and adapt.

## Component layer reality

**This project has no `src/components/ui/` primitive layer.** The full bespoke component inventory is:

- `src/components/DriverPortrait.tsx`
- `src/components/F1Mark.tsx`
- `src/components/TopBar.tsx`
- `src/components/TrackDiagram.tsx`

Everything else is screen-level markup, colocated with the route under `src/app/`. **Do not** introduce shadcn, Radix, Headless UI, or any other primitive library. **Do not** create generic `Button.tsx` / `Card.tsx` / `Input.tsx` files preemptively.

When the design export uses a primitive (e.g., `<Button variant="primary">`), inline the markup directly using the project's class patterns. **Only** extract a new component into `src/components/` when:

- The same composition appears across **3 or more** screens, AND
- The composition is non-trivial (multiple semantic elements, conditional states), AND
- A name for it is obvious (e.g., `LockBar`, `PodiumCard`, `ResultRow`).

When you extract one, model it on `TopBar.tsx`: file-level JSDoc with a design canvas reference, explicit prop types, terse className patterns, no external deps unless already used elsewhere.

## Design library — read first

Beyond the component layer, this project has a **`src/lib/design/`** directory with single-source-of-truth modules every redesigned screen has used since Pass 1. **Reading these and using them is non-negotiable.** Hardcoding values they expose is a regression.

| Module | Exports | Use when |
|---|---|---|
| `src/lib/design/teams.ts` | `teamMeta(team)` → `{slug, name, short, hex, livery, logoSrc, carSrc}` · `teamHex(team)` · `ALL_TEAMS` · `TeamMeta` type | Anywhere a team name, color, logo, or livery car appears. Resolves free-form DB strings ("Red Bull Racing"/"Audi"/"RB F1 Team") through an alias map. |
| `src/lib/design/drivers.ts` | `driverPortraitSrc(code)` · `driverHeadshotSrc(code)` · `isPortraitRightFacing(code)` · `driverCountry(code)` · `countryFlag(country)` | Driver imagery + nationality. Returns `null` for codes outside the curated portrait set so `<DriverPortrait>` can fall back to the initial-letter avatar tinted with team hex. |
| `src/lib/design/tracks.ts` | `trackPath(circuit)` → SVG path data (or `null`) | `<TrackDiagram circuit={…}>` already calls this. Direct use only when you need the raw `d` attribute (e.g. `motion.path` in the reveal cinematic). |
| `src/lib/design/circuits.ts` | `circuitMeta(key)` → `{lengthKm, laps}` | Hero-card "5.412 KM · 57 LAPS" copy. Static map keyed by Jolpica `circuit_id`, alias-resolved from OpenF1 short names. |
| `src/lib/design/eventName.ts` | `shortEventName(name)` | Strip "Grand Prix" suffix and map adjective forms ("Australian" → "Australia", "Saudi Arabian" → "Saudi Arabia"). Calendar cards say "Australia", never "Australian Grand Prix". |

**Hard rule:** if you're about to write `var(--team-mclaren-hex)` directly into a className, hardcode a circuit alias, or write a `name.replace(/Grand Prix/, "")` regex inline — you skipped this section. Go read it.

These helpers are **the canonical pattern**. If a port wants behavior they don't cover, extend the helper rather than inlining around it; tests for each live in `src/lib/design/*.test.ts` (numbered `D1–D15`) and a new helper should add a new numbered test.

## Token translation — apply before writing any code

Read the design export and prepare a translation map. Every value below on the **left** is a smell that must be rewritten to the **right** before code is committed.

### Colors

| Don't write | Write instead |
|---|---|
| `#E8002D`, `#FF1801`, `red-500`, `red-600` | `bg-[color:var(--accent)]`, `text-[color:var(--accent)]`, `border-[color:var(--accent)]` |
| `#0a0a0a`, `bg-black`, `bg-zinc-950` | `bg-[color:var(--bg)]` |
| `#1a1a1a`, `bg-zinc-900`, card surface | `bg-[color:var(--surface)]` |
| `bg-zinc-800`, hover/elevated surface | `bg-[color:var(--surface-2)]` |
| `#fff`, `text-white` | `text-[color:var(--fg)]` |
| `text-zinc-400`, `text-gray-400` | `text-[color:var(--fg-muted)]` |
| `text-zinc-500`, `text-gray-500` | `text-[color:var(--fg-subtle)]` |
| `border-zinc-800`, `border-gray-800` | `border-[color:var(--border)]` |
| `text-green-500` (correct pick) | `text-[color:var(--success)]` |
| `text-yellow-500`, `text-amber-500` (lock warning) | `text-[color:var(--warning)]` |
| `text-red-500` for errors | `text-[color:var(--error)]` (note: distinct from `--accent`) |
| Hardcoded team color hex | `var(--team-mclaren)` … `var(--team-vcarb)` (full list in globals.css) |

Tailwind v4's color shortcuts (`bg-red-500`) **do not exist** in this project's theme. Always use `bg-[color:var(--token)]` arbitrary syntax.

**Adding a new color token:** declare the OKLCH variable in `:root` of `globals.css`, then map it inside the `@theme inline { --color-<name>: var(--<name>); }` block. Tailwind v4 reads this map to generate the `text-<name>` / `bg-<name>` utilities. The `--space-*` scale is deliberately *not* mapped — see "Spacing — the namespace trap" for why.

### Spacing — the namespace trap

`--space-*` is the project's spacing scale. It is **deliberately not** `--spacing-*` because Tailwind v4's `--spacing-xl` would hijack `max-w-xl`, `gap-xl`, `p-xl`, `h-xl`, etc. Reference space tokens in one of two ways:

```tsx
// Inline style for one-offs
<div style={{ padding: "var(--space-lg)" }}>

// Tailwind arbitrary value (preferred when stackable)
<div className="p-[var(--space-lg)] gap-[var(--space-md)]">
```

Do **not** use Tailwind's default `p-4`, `gap-2`, `space-y-6` etc. and assume they map to the design — they map to Tailwind's default 4px-step scale, which is *coincidentally* close but drifts from the design at larger sizes.

The full scale: `--space-xs` 4px, `--space-sm` 8px, `--space-md` 12px, `--space-lg` 16px, `--space-xl` 24px, `--space-2xl` 32px, `--space-3xl` 48px, `--space-4xl` 64px.

### Typography

Three faces, three roles, one trap.

| Role | Font | How to apply |
|---|---|---|
| Display (hero text, P1/P2/P3 callouts, event names) | Boldonse | **Inline style** `style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}`. The `[style*="Boldonse"]` global CSS selector applies the line-height fix automatically. Do not use a `font-display` class without the inline style — the CSS selector won't match. |
| Body (running text, labels) | Geist Sans | Default — already the body font. No class needed. |
| Tabular (scores, timers, positions, driver numbers) | Geist Mono | Add `data-tabular` attribute to the element. The global rule applies `font-variant-numeric: tabular-nums; font-family: var(--font-mono)`. |

**Boldonse line-height trap:** Boldonse has dramatic ascenders/descenders that clip into siblings at `line-height < 1.1`. The global CSS handles this for any element with Boldonse in its inline style. For full-bleed cinematic hero text where you *want* tight leading, add `data-tight` to opt into the alternate spacing.

**Multi-line Boldonse hero gotcha:** even at `data-tight` 0.95 leading, multi-line cinematic display titles (e.g. `"CALL THE RACE."` stacked with `<br/>`) show visible ascender overlap. Production solution: keep multi-line hero headlines on **one logical line** at clamp ≤72px instead of fighting the metrics. The reveal cinematic does break "GRAND PRIX" onto a second muted line, but that's two short tokens at 88–168px — workable. Avoid three-line stacks.

**Tabular numerics are mandatory** anywhere a number lives: scores, timers, driver numbers, lap counts, leaderboard ranks, countdown digits, season labels, "T-24h" style strings. The exception is body prose where a number appears mid-sentence ("won 3 races") — leave that as body Geist Sans.

### Conditional classNames — no `cn()`

This codebase does not use `clsx`, `cn`, or `tailwind-merge`. The pattern is inline ternaries returning full className strings:

```tsx
className={
  isActive
    ? "border-b-2 border-[color:var(--accent)] text-[color:var(--fg)]"
    : "border-b-2 border-transparent text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-muted)]"
}
```

Or template literals where most classes are shared:

```tsx
className={`flex size-9 items-center justify-center rounded-full border ${
  isActive ? "border-[color:var(--accent)]" : "border-[color:var(--border)]"
}`}
```

Do not introduce `cn()` solely to port the design. If the canvas export uses it, strip it during translation.

### Server vs client components

Default to **server components** (no `"use client"` directive). Add `"use client"` only when the component genuinely needs:

- React hooks (`useState`, `useEffect`, `useTransition`)
- Browser APIs (`window`, `document`, IntersectionObserver, etc.)
- Event handlers on interactive elements not handled by server actions

Form submissions use **server actions** (see `signOutAction` import in `TopBar.tsx`). Don't reach for client-side `onSubmit` + `fetch` when a server action will do.

The convention is colocated `actions.ts` next to the page file, action functions returning a discriminated-union `{ ok: true } | { ok: false, error: 'KIND', message: string }` for client cards to render, and `redirect()` called *inside* the action (not via `useRouter`) so server-side guards don't race with the response. Example: `src/app/dashboard/predict/actions.ts` → `submitPrediction` → returns `SubmitPredictionResult`. The picker's `useTransition` consumes that and renders feedback.

If the design canvas export is full of `useState`, audit each use — most can become server-rendered with the data already on the page, or escalated to a smaller client island.

**`react-hooks/purity` lint trap:** `Date.now()` inside a server-component render body trips this lint rule. The pattern when you genuinely need a request-time snapshot (e.g. hero countdown computed server-side) is a single-line disable directly above the call:
```ts
// eslint-disable-next-line react-hooks/purity
const nowMs = Date.now();
```
The dashboard, predict-list, predict-detail, and reveal pages all use this pattern. The authoritative ticking countdown lives in the client picker; the server snapshot is only the initial paint.

### Icons

No `lucide-react` import. The current pattern is **inline SVG** (`F1Mark`, `TrackDiagram`) or **single-character glyphs** (`⏻` for sign-out in `TopBar`). If the canvas uses `<ChevronRight />` etc., either:

- Replace with an inline SVG path (preferred for anything appearing more than once),
- Or, if it's a one-off, a unicode glyph like `›` or `→`.

Do not add a new icon library dependency.

### Backdrop blur, opacity, and modifier syntax

The codebase uses Tailwind v4's color-with-opacity modifier on arbitrary values:

```tsx
className="bg-[color:var(--bg)]/85 backdrop-blur"
```

Match this pattern. Don't reach for `rgba()` literals.

## State coverage — apply by default

The canvas export almost always shows the happy state only. Without being asked, ensure the implementation covers:

| State | Default behavior |
|---|---|
| **Loading** | Skeleton blocks using `bg-[color:var(--surface-2)]` with subtle pulse animation, sized to the real content's footprint. No spinners. |
| **Empty** | Teach, don't apologize. "Season starts March 8. Here's last year's winner." not "No data yet." Match the brand voice from `.impeccable.md`. |
| **Error** | Inline message in `text-[color:var(--error)]`, retry action where applicable. No toast for screen-level errors. |
| **Long content** | Tabular layouts must not reflow when content lengthens. Use `truncate`, `line-clamp-2`, or `min-w-0` on flex children as needed. |

If the screen has explicit state requirements that differ (e.g., the predict screen's lock-countdown urgency states in `.impeccable.md`), follow the spec there exactly.

## Absolute bans — zero tolerance

These are from `.impeccable.md`. If the canvas export contains any of them, **strip them during translation** — do not port them through.

1. `border-left:` / `border-right:` with `width > 1px` on cards or list items.
2. Gradient text (`background-clip: text` with a gradient).
3. Generic 3-column feature grid with icons-in-colored-circles.
4. Purple/violet/indigo gradient backgrounds.
5. Uniform bubbly border-radius on every element.
6. Decorative blobs, floating circles, wavy SVG dividers.
7. Emoji as structural design elements (decorative emoji in copy is fine — `⏻` as a sign-out glyph is fine; emoji used as section icons is not).
8. Cookie-cutter section rhythm (hero → 3 features → testimonials → pricing → CTA).
9. Modals for secondary actions — use inline drawers, sheets on mobile, or full pages.
10. Sparkline decorations.

If the user explicitly asks for one of these and won't be talked out of it, comply with a one-line note in the PR description that the project's guardrails were overridden at user request.

## Asset pipeline

Pass 1 of the design port copied ~36MB of imagery from `design/assets/` to **`public/assets/{drivers,drivers-portrait,cars,logos}/`**. Conventions:

- New images go under `public/assets/<category>/` with **lowercased filenames** (`mclaren.png`, not `McLaren.png`). Driver assets use the **uppercase 3-letter code** (`VER.png`, `NOR.png`) since they're keyed by `drivers.code`.
- Logo extension drift is real: `redbull.jpg` and `haas.jpg` are JPG; the rest are PNG. Encoded into `TEAM_META.logoSrc` — don't assume PNG.
- `src/middleware.ts` matcher excludes `/assets/` so they're served unauthenticated. If a new image appears as broken alt text after a port, the matcher is the suspect: any new top-level public path needs an exclusion.
- The curated portrait set is a subset of the active roster (20 of 22 drivers in 2026). `DriverPortrait` falls back to an initial-letter avatar tinted with team hex when no PNG exists for a code. `RIGHT_FACING_CODES` in `drivers.ts` mirrors BOT/LIN via `transform: scaleX(-1)` so all 22 portraits face left consistently.
- **Don't import `design/assets/` paths directly into `src/`.** Always copy to `public/assets/` first; Next won't serve files outside `public/`.

## Motion conventions

**Framer Motion** (`framer-motion` v12) is the chosen runtime. The reveal cinematic in `src/app/reveal/[eventId]/reveal-stage.tsx` is the canonical reference for any port that involves motion.

Patterns to match:

- **Reduced-motion gate:** every `"use client"` component that animates calls `useReducedMotion()` from FM at the top, then either renders a `StaticHero`-style fallback or collapses all `delay`s to 0. Reduced motion is **structurally absent**, not throttled — don't run a slower version.
- **`EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const`** is the project's signature curve. Used for slams, fades, and the lock-countdown pulse alternative. Decorative ease-ins (`easeIn`, `easeInOut`) are wrong defaults here.
- **Beat-based delay sequencing** — express choreography as constants at the top (`TITLE_DUR = 1.4`, `SWEEP_DELAY = 0.6`, `PODIUM_BASE_DELAY = 3.3`) so the timeline is readable at a glance, not buried in inline `delay: 1.2` literals.
- **Replay button = `playKey` re-mount** — store a `playKey` in client state, append it to every motion node's `key={...}`, and bump it on click. FM internally re-runs `initial → animate` whenever the key changes.
- **No `requestAnimationFrame` loops.** FM's `motion.path pathLength`, `times` arrays, and `useTransform` cover everything we need. The canvas's reveal example uses RAF; we deliberately don't.
- **Motion is earned, not decorative.** `.impeccable.md` says only animate on real state changes (lock countdown, reveal flip, submit feedback). Stripping a hover scale or a card-mount fade-in is correct.

If the canvas implies motion the production code can't reach with these primitives, surface it as a question rather than reaching for RAF or GSAP.

## Canvas fixture → DB mapping

The canvas runs against in-file fixtures. Production runs against Supabase. When porting, translate fixture references to live queries:

| Canvas fixture (`design/data.jsx`) | Production source |
|---|---|
| `FRIENDS` (id, name, team, driver, points, perfectPodiums) | `public.users` (id, email, display_name, favorite_team, favorite_driver) + `public.scores` (sum points, count perfect_bonus) + `public.user_streaks` |
| `MIAMI_PREDICTIONS` (`{[friendId]: {picks, pts, breakdown, perfect}}`) | `public.predictions` (filtered by event_id) joined to `public.scores` for points |
| `MIAMI_RESULT` (podium array) | `public.results` (single row per event) plus `public.session_classifications` for full classification |
| `CALENDAR` (round, name, flag, city, date, status, track) | `public.events` filtered to `session_type='race'`. `circuit` field maps to `tracks.ts` slug; `flag`/`city`/`track` aren't stored — derive from helpers (`countryFlag(driverCountry(…))`, `circuitMeta`, `shortEventName`). |
| `DRIVERS` (id=code, first, last, num, team, country) | `public.drivers` (active=true). `id` field in DB is the OpenF1 `driver_number`; `code` is the 3-letter abbrev. The canvas uses `code` as the key. |
| `TEAMS` map (slug → {name, hex, livery, …}) | `src/lib/design/teams.ts` — design-only, **no DB equivalent**. Use `teamMeta(driverRow.team)` to resolve. |
| `MIAMI_RESULT.fastestLap` | Not stored. Skip; fastest-lap tracking is an explicit `.impeccable.md` non-feature. |

Two-source identity rule (from `CLAUDE.md`): **never join historical OpenF1 data on `driver_number` directly** — F1 reassigns numbers between seasons. Use `drivers.full_name` (canonicalize via `src/lib/text/canonicalize.ts`) for OpenF1, `drivers.ergast_id` for Jolpica `historical_results`.

## Shared formatters

Don't reinvent these — import them:

- **`src/lib/sessionLabel.ts`** — `sessionLabel(session_type)` ("Race" / "Qualifying" / "Sprint" / "Sprint Qualifying") and `formatLocal(iso | Date)` (locale-aware date+time).
- **`shortEventName(name)`** — strip "Grand Prix" + adjective→country (in `src/lib/design/eventName.ts`).
- **`circuitMeta(key)`** — `{lengthKm, laps}` for the "5.412 KM · 57 LAPS" copy.
- **Date-range derivation** — both dashboard hero and predict-list hero compute weekend `start`/`end` from all sessions in the round and format as `"1 May - 3 May"` / `"30 May - 1 Jun"` (day-first, title-case month, ASCII hyphen). The helper isn't extracted yet (each page has its own `formatDateRange` / `dateRange`); when porting a third use case, extract to `src/lib/design/dateRange.ts` and update the others.
- **Lock countdown** — `src/app/dashboard/predict/lock-countdown.tsx` is the canonical client-side ticking countdown with three phases (normal / warning / closed) and the 2Hz pulse at T-60s. The driver-picker has its own embedded countdown in the sticky lock bar; the predict list and dashboard hero use a server-side snapshot via `formatDelta`. Match the existing pattern for the page being redesigned.

## Verification loop

This project has Playwright wired for E2E only (no visual snapshots). Use it to capture an implementation screenshot and diff against the reference manually.

**Port note:** dev runs on **`:3001`** in this environment — port 3000 is held by an unrelated Docker container. The `playwright.config.ts` `webServer` block defaults to 3000, so every Playwright invocation needs `E2E_BASE_URL=http://localhost:3001`.

After the implementation compiles cleanly:

1. **Run the dev server** in the background:
   ```bash
   bun --env-file=.env.local run next dev -p 3001 &
   # confirm reachable:
   until curl -sf -o /dev/null http://localhost:3001/join; do sleep 1; done
   ```
   If `EADDRINUSE :::3001` fires, a prior dev process is still bound — `lsof -nP -i :3001 -sTCP:LISTEN` to find the PID, kill it, retry.

2. **Capture the rendered screen** with a one-off Playwright script. Place at `plans/designs/<screen-name>-<YYYYMMDD>/_capture.spec.ts`:
   ```ts
   import { test } from "@playwright/test";
   test("capture", async ({ page }) => {
     // Mint a session (see "Authenticated screen capture" below)
     const resp = await page.request.post("/api/test/sign-in-password", {
       data: { email: "kataria.astha@gmail.com", password: "fixture-pwd-12345" },
     });
     if (!resp.ok()) throw new Error(`sign-in failed: ${resp.status()}`);

     await page.goto("/<route>");
     await page.screenshot({
       path: "plans/designs/<screen-name>-<YYYYMMDD>/implementation.png",
       fullPage: true,
     });
   });
   ```
   Run with: `E2E_BASE_URL=http://localhost:3001 bunx playwright test plans/designs/<screen-name>-<YYYYMMDD>/_capture.spec.ts`. Both the spec and the resulting `implementation.png` should be gitignored — see "Asset pipeline" below for the patterns.

### Authenticated screen capture

`/api/test/sign-in-password` exists specifically because Google OAuth can't be scripted. POST `{email, password}`:
- 404 in production (so it can't be a backdoor on a deployed site).
- Creates the auth user if it doesn't exist (`fixture-pwd-12345` is the seed-script convention).
- Mirrors `auth.users` → `public.users` so RLS policies and FKs resolve.
- If `email === ADMIN_EMAIL`, mirrors into `public.admins` (the same self-heal `/auth/callback` performs in real OAuth).
- Sets the Supabase session cookies on the response — every subsequent request in the same Playwright/browser context is signed in.

**Critical: set `display_name` before screenshotting any authenticated route other than `/profile`.** Five pages (dashboard, predict-detail, standings, league, reveal) defensively redirect to `/profile?welcome=1` when `display_name` is null. Either:
- Update the row directly: `psql "$DATABASE_URL" -c "update public.users set display_name='Test' where email='…';"`
- Or extend the test sign-in payload (the route doesn't currently set display_name; for now, post-step SQL is the path).

For multi-friend reveal demos, use `scripts/seed-reveal-fixture.ts` as a template — it creates 4 fake users, sets `display_name` + favorites, and inserts predictions for a target event by toggling `session_replication_role = 'replica'` to bypass the lock-guard trigger.

3. **Place implementation.png next to screenshot.png** in the same folder. Compare side by side. Acceptable tolerances:
   - Colors: **exact** (use the inspector if uncertain — token values must match).
   - Spacing: **within ~4px** (one `--space-xs` step).
   - Typography: **face must match exactly**; sizes within ~2px.
   - Content density: must match — no extra rows, no missing labels.

4. **Iterate** until the diff is acceptable. Common drift points:
   - Boldonse not loading → check `font-family` inline style and the global CSS selector matches.
   - Spacing slightly off → check `--space-*` vs Tailwind's default `p-*` scale.
   - Wrong red appearing → check whether `--accent` (Ferrari brand red) or `--error` (error red) was intended; they're distinct OKLCH hues.

5. **Run the full check before declaring done**:
   ```bash
   bun run lint
   bun run typecheck
   bun --env-file=.env.local run vitest run
   E2E_BASE_URL=http://localhost:3001 bunx playwright test
   ```
   The baseline at last check (2026-04-29) was **99/99 green** (97 Vitest + 2 Playwright). The number moves up as the codebase grows — run the full suite *first* to learn the live baseline before declaring any number a regression. Note: `bun run test` runs Bun's *native* runner, not Vitest. Always go through `vitest run` directly or `bun run test` (which is wired through Vitest in `package.json`).

## Definition of done

- The new/redesigned screen renders correctly at the relevant route.
- `implementation.png` and reference `screenshot.png` are visually equivalent within the tolerances above.
- All four verification commands pass clean.
- No new dependencies introduced unless explicitly justified in a comment.
- No file under `src/components/ui/` was created (this folder doesn't exist by design).
- No `cn()` import, no shadcn primitives, no `lucide-react`.
- All numerics carry `data-tabular`.
- Boldonse-using elements use the inline-style pattern.
- All colors reference `var(--token)` — zero hex literals or Tailwind color shortcuts in the new code.
- Spacing references `var(--space-*)` — zero raw pixel values for spacing.
- States covered: loading, empty, error, long-content (or noted as N/A with reason).
- One-line summary in the implementation: which design canvas it ports, which route it lives at, what was deliberately changed during translation.
- **Tracker docs updated.** Both `CLAUDE.md` (current state section) and `plans/program-tracker.md` (new dated session-log entry under the existing format) reflect what shipped. Stale test counts replaced. Gotchas captured under a "Gotchas:" subhead. The user's standing instruction is to keep these current — landing code without the tracker entry breaks the audit trail.
- **Display-name guard preserved.** If the redesigned route is one of dashboard, predict-detail, standings, league, or reveal — the `if (!display_name) redirect("/profile?welcome=1")` server-side guard must still be in place. Don't strip it during translation.

## Common failure modes — ranked by frequency

1. **Tailwind colors leaked through.** `bg-red-500` instead of `bg-[color:var(--accent)]`. Grep the diff for `-500\|-600\|-700\|-800\|-900` Tailwind suffixes; they're almost always wrong.
2. **Spacing was kept as `p-4` / `gap-6`.** Looks fine but drifts from the design system. Convert to `--space-*`.
3. **Boldonse rendering wrong line-height.** Either the inline style was replaced with a class, or Boldonse wasn't applied at all and Geist Sans is being used.
4. **A `useState` was kept on a server-renderable component.** Triggers `"use client"` cascade and breaks data fetching patterns elsewhere on the page.
5. **`--spacing-xl` defined accidentally.** Hijacks `max-w-xl`. If something becomes weirdly narrow or wide after a port, this is the cause.
6. **`cn()` import added.** Strip it.
7. **An absolute ban reintroduced.** Most often #1 (left-border stripe) and #2 (gradient text). Read the diff against the bans list before committing.
8. **Tabular numerics missing.** Scores or timers in proportional Geist Sans look fine when static and jitter the moment they update. Audit every numeric.
9. **Display-name guard stripped.** Pages with `if (!display_name) redirect('/profile?welcome=1')` need that guard preserved during a port. It's the only thing keeping fresh-OAuth users (and test-sign-in users) from reaching half-set-up screens. Symptom: clicking "Reveal to group" navigates to `/profile` instead of `/reveal/<id>`.
10. **`design/lib` helpers re-implemented inline.** Hardcoded team hex, hand-rolled `name.replace(/Grand Prix/, "")`, or `circuit === "Sakhir" ? "..." : "..."` ladder mean the agent skipped the "Design library — read first" section. Symptom: standings show wrong team color for Mercedes after the Antonelli fix, or "Sakhir" doesn't match "bahrain" track diagram.

## What's out of scope for this skill

- Backend changes (data fetching, server actions, schema). The skill is UI-only. If the design implies new data shapes, surface that as a question, don't infer.
- Motion choreography beyond the rules in `.impeccable.md`. Static designs can't specify motion; ask for verbal direction or copy from the reveal-choreography spec already in `.impeccable.md`.
- Pixel-perfect cross-browser rendering. Aim for visually indistinguishable in Chrome (the dev target). Other browsers should be functional but may have minor font hinting differences.
- Mobile-specific layouts not present in the canvas export. If the export is desktop-only and the user wants mobile, ask for a mobile screenshot before guessing.

### Admin pages — in scope (added 2026-04-29)

`/admin` and `/admin/results/[eventId]` are now part of the design port. References:
- `design/screens-aux.jsx:AdminScreen` and `:AdminResultsScreen`
- `design/design-screenshots/:admin - Event control + system status.png`
- `design/design-screenshots/:admin:results:[eventId] - Any GP - Manual Entry.png`

Admin pages share the production design language but with one distinct affordance: a **top strip with accent-bordered bottom** (instead of the standard `TopBar`) so admin context is visually unmistakable. The strip carries `▣ Admin · The Group · 2026` left in accent red and `Aastha · admin` (or the current admin's display name) right.

## Test conventions

When extending `src/lib/design/*`, mirror the existing numbered-test pattern in `src/lib/design/*.test.ts` (`D1`–`D15` so far). Each test gets a numeric prefix in its describe/it name so the tracker's "tests attached" lines stay grep-able. New helpers should add new numbered tests rather than appending un-numbered cases.
