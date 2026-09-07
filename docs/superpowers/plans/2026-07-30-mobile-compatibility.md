# Mobile Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make F1 Fantasy phone-first — most of the friend group opens it in a mobile browser — without changing the desktop rendering at ≥1024px.

**Architecture:** A single fork at **780px**, expressed as a redefined Tailwind `md:` breakpoint. Below 780px a mobile tree renders; at/above it the existing desktop tree renders. Components that differ only in *layout* get two sibling trees fed by one server fetch (`md:hidden` / `hidden md:block`); components that share *behaviour* (the reveal's timing constants, the picker's submit/validation) keep one tree with a threaded variant instead. Navigation moves to a fixed bottom tab bar below 780px.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 (config-less, `@theme`) · Framer Motion 12 · Vitest + @testing-library/react (jsdom opt-in) · Playwright 1.59

## Global Constraints

- **Fork width is 780px, and it is spelled `md:`.** `--breakpoint-md: 780px` in `src/app/globals.css`. `md:` has zero existing call sites (`sm:` 34, `lg:` 64, `xl:` 17, `md:` 0), so redefining it is free. Never write `min-[780px]:` — a typo like `min-[78px]` compiles silently.
- **Never touch the `--spacing-*` namespace.** Defining `--spacing-xl` hijacks `p-xl`, `max-w-xl` and every `xl` utility. Semantic spacing stays under `--space-*`, referenced as `p-[var(--space-lg)]`.
- **The existing 64 `lg:` and 17 `xl:` utilities stay exactly as they are.** They are refinements *inside* the desktop tree, not a second fork. 780–1024px legitimately renders desktop tables with single-column heroes.
- **Desktop rendering at ≥1024px must be visually unchanged.** Every change is additive below `lg`, or a `md:`-guarded restoration of current values.
- **Reference colors as `var(--token)` only.** Tailwind v4 has no `bg-red-500`; use `bg-[color:var(--surface)]`.
- **Display font is set inline** as `style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}` so the global `[style*="Boldonse"]` selector matches. Keep that exact string. The face is Titillium Web; the variable name is intentionally still "Boldonse".
- **Numerics get `data-tabular`.** Mandatory for anything resembling a number.
- **No new left-border accent stripes >1px on cards.** The sanctioned exception is the existing 3px team-colour left edge on prediction rows / FP banner / FP override rows — preserve it where it already exists.
- **Earned motion only.** No decorative animation. The global `prefers-reduced-motion` block in `globals.css` zeroes all animation/transition durations; do not add motion that breaks when it does.
- **No schema, scoring, RLS, or lock-logic changes.** This plan does not touch `computeScores`, the `predictions_lock_guard` trigger, or any RLS policy, so the CLAUDE.md hard regression rule is not triggered.
- **`bun run test`, never `bun test`** (the latter runs Bun's native runner).
- **e2e needs env:** `bun --env-file=.env.local run e2e`. Integration/e2e require `supabase start` (API :54421).
- Out of scope: PWA / manifest / home-screen install, practice in the schema, multi-league.

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `src/lib/design/device.ts` | `isPhoneUA(ua)` — phone-vs-not UA classification. Pure, no DOM. |
| `src/lib/design/device.test.ts` | Unit tests for `isPhoneUA` against real UA strings. |
| `src/components/MobileTabBar.tsx` | Fixed bottom nav, 5 destinations, safe-area padded. Below `md` only. |
| `src/components/MobileTabBar.test.tsx` | jsdom render tests. |
| `src/app/dashboard/standings/driver-row.tsx` | Presentational driver-standings row, mobile + desktop variants. |
| `src/app/dashboard/league/league-row.tsx` | Presentational league row, mobile + desktop variants. |
| `tests/e2e/no-horizontal-overflow.spec.ts` | The regression net: no route may scroll horizontally on any device. |
| `tests/e2e/fork-audit.spec.ts` | Asserts exactly one tree renders at 779px and 781px. |

**Modified files**

| File | Change |
|---|---|
| `src/app/globals.css` | Add `@theme { --breakpoint-md: 780px; }`. |
| `src/app/layout.tsx` | Add `export const viewport` with `viewportFit: "cover"` + `themeColor`. |
| `src/components/TopBar.tsx` (104 ln) | Tab row `hidden md:flex`; compact 780–1024 band; slim mobile row. |
| `src/app/dashboard/standings/page.tsx` (880 ln) | Extract rows to `driver-row.tsx`; two trees; fix grids at 482, 592, 628, 733, 800. |
| `src/app/dashboard/league/page.tsx` (455 ln) | Extract rows to `league-row.tsx`; two trees; fix grid at 374. |
| `src/app/dashboard/page.tsx` (691 ln) | Prediction rows 560/648, stat strip 430, hero `minHeight` 308. |
| `src/app/dashboard/predict/driver-picker.tsx` (720 ln) | Compact slot rows, telemetry line, safe-area lock bar. |
| `src/app/reveal/[eventId]/page.tsx` | UA detect → `variant` prop. |
| `src/app/reveal/[eventId]/reveal-stage.tsx` (955 ln) | Thread `variant`; portrait podium; `StaticHero` portrait. |
| `src/app/admin/page.tsx` (528 ln) | Stacked action cards below `md`. |
| `playwright.config.ts` | Add `iPhone 14`, `Pixel 7`, `iPad Mini` projects. |
| ~10 further page/component files | Mechanical grid/width sweep — Tasks 10–11. |

`standings/page.tsx` and `league/page.tsx` are single ~800-line and ~455-line default exports with every row inlined, depending on locally-computed lookup maps (`winsByDriver`, `podiumsByDriver`, `leaderPts`, `driversByTeam`). Extracting presentational row components with explicit props is a precondition for the two-tree split, and is the targeted improvement this plan takes on in files it is already modifying. No unrelated refactoring.

---

# SLICE 1 — Foundation

Ships: navigation works on every screen at every width.

## Task 1: `isPhoneUA` device classification

**Files:**
- Create: `src/lib/design/device.ts`
- Test: `src/lib/design/device.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isPhoneUA(ua: string | null | undefined): boolean`. Task 14 imports this into `reveal/[eventId]/page.tsx`.

Classification rule: a phone is an iPhone/iPod, **or** Android carrying the `Mobile` token. iPads and Android tablets are deliberately **not** phones — they land in the desktop tree, matching the 780px fork. iPadOS 13+ "Request Desktop Website" sends a Macintosh UA and falls through to `false` naturally, which is the desired outcome.

- [ ] **Step 1: Write the failing test**

Create `src/lib/design/device.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPhoneUA } from "./device";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

describe("isPhoneUA", () => {
  it("treats iPhone as a phone", () => {
    expect(isPhoneUA(IPHONE_SAFARI)).toBe(true);
  });

  it("treats Android with the Mobile token as a phone", () => {
    expect(isPhoneUA(ANDROID_PHONE_CHROME)).toBe(true);
  });

  it("does NOT treat iPad as a phone even though its UA contains 'Mobile'", () => {
    expect(isPhoneUA(IPAD_SAFARI)).toBe(false);
  });

  it("does NOT treat an Android tablet (no Mobile token) as a phone", () => {
    expect(isPhoneUA(ANDROID_TABLET)).toBe(false);
  });

  it("does NOT treat iPad in desktop mode as a phone", () => {
    expect(isPhoneUA(IPAD_DESKTOP_MODE)).toBe(false);
  });

  it("does NOT treat desktop Chrome as a phone", () => {
    expect(isPhoneUA(DESKTOP_CHROME)).toBe(false);
  });

  it("defaults to the wide variant when the UA header is missing", () => {
    expect(isPhoneUA(null)).toBe(false);
    expect(isPhoneUA(undefined)).toBe(false);
    expect(isPhoneUA("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/design/device.test.ts`
Expected: FAIL — `Failed to resolve import "./device"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/design/device.ts`:

```ts
/**
 * Phone-vs-not classification from a User-Agent string.
 *
 * Used only by `/reveal/[eventId]`, where the two cinematic choreographies
 * must not both mount (two simultaneous Framer Motion timelines would burn
 * the frame budget the reveal needs). Every other screen branches in CSS at
 * the 780px `md:` fork, which resizes correctly and needs no UA sniffing.
 *
 * Tablets are deliberately NOT phones: the 780px fork puts them in the
 * desktop tree, so they get the wide cinematic. iPadOS 13+ "Request Desktop
 * Website" sends a Macintosh UA and falls through to false, which is correct.
 */
export function isPhoneUA(ua: string | null | undefined): boolean {
  if (!ua) return false;
  if (/iPad/i.test(ua)) return false;
  if (/iPhone|iPod/i.test(ua)) return true;
  // Android tablets omit the "Mobile" token; Android phones include it.
  return /Android/i.test(ua) && /Mobile/i.test(ua);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/design/device.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/device.ts src/lib/design/device.test.ts
git commit -m "feat(mobile): add isPhoneUA device classification"
```

---

## Task 2: 780px `md:` breakpoint + viewport metadata

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx:18-21`
- Test: `src/app/globals.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: the `md:` variant at 780px, used by every subsequent task. `viewportFit: "cover"`, which is what makes `env(safe-area-inset-bottom)` non-zero in Tasks 3 and 13.

The unit test here is a **token guard** — it prevents someone silently deleting or re-tuning the fork width, and nothing more. The behavioural assertion that `md:` actually flips at 779/781px lives in Task 6's `fork-audit.spec.ts`, which runs in a real browser.

- [ ] **Step 1: Write the failing test**

Create `src/app/globals.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");

describe("globals.css design tokens", () => {
  it("pins the mobile/desktop fork to 780px via the md breakpoint", () => {
    expect(css).toMatch(/--breakpoint-md:\s*780px/);
  });

  it("never defines a --spacing-* token (would hijack p-*/max-w-* utilities)", () => {
    expect(css).not.toMatch(/--spacing-[a-z0-9]+\s*:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/app/globals.test.ts`
Expected: FAIL on the first assertion — no `--breakpoint-md` in the file. The second assertion should already PASS.

- [ ] **Step 3: Write minimal implementation**

In `src/app/globals.css`, immediately **after** the closing `}` of the existing `@theme inline { … }` block, add:

```css
/*
 * Mobile/desktop fork. 780px, not Tailwind's default 768px: the desktop
 * TopBar needs ~1053px at full size and ~763px compacted, and the widest
 * content grid (admin, ~636px + padding) needs ~700px. 780 clears both.
 *
 * `md:` is safe to redefine — it had zero call sites in this codebase when
 * this was introduced (sm: 34, lg: 64, xl: 17, md: 0). Using a named
 * breakpoint instead of `min-[780px]:` means a typo can't silently compile.
 *
 * The existing lg:/xl: utilities are NOT a second fork — they are
 * refinements inside the desktop tree. 780–1024px renders desktop tables
 * with single-column heroes, which is intended.
 */
@theme {
  --breakpoint-md: 780px;
}
```

In `src/app/layout.tsx`, add `Viewport` to the type import and export a viewport config after `metadata`:

```tsx
import type { Metadata, Viewport } from "next";

// … existing display font + metadata …

export const metadata: Metadata = {
  title: "F1 Fantasy",
  description: "Private P1/P2/P3 prediction league",
};

/**
 * `viewportFit: "cover"` is required for env(safe-area-inset-*) to report
 * non-zero values on notched iPhones — the fixed bottom tab bar and the
 * predict lock bar both depend on it. Next already emits
 * width=device-width, initial-scale=1 by default.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2b1013",
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/app/globals.test.ts && bun run typecheck`
Expected: PASS — 2 tests; typecheck clean.

- [ ] **Step 5: Verify the breakpoint compiles**

Run: `bun run build`
Expected: build succeeds. Then confirm Tailwind emitted the new width:

```bash
grep -rho "min-width:\s*780px" .next/static/css/ | head -1
```

Expected: prints `min-width: 780px`. If it prints nothing, the `@theme` block was placed inside `@theme inline` or after a stray `}` — fix before continuing, because every later task depends on it.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/globals.test.ts
git commit -m "feat(mobile): pin md: breakpoint to 780px, add viewport-fit cover"
```

---

## Task 3: `MobileTabBar` component

**Files:**
- Create: `src/components/MobileTabBar.tsx`
- Test: `src/components/MobileTabBar.test.tsx`

**Interfaces:**
- Consumes: `TopBarTab` (the existing `Tab` union exported from `src/components/TopBar.tsx` as `TopBarTab`).
- Produces: `<MobileTabBar active={tab} />`. Task 5 renders it at 9 call sites.

Five destinations only — Calendar, Predict, Lobby, Reveal, Standings. League and Profile stay reachable from the slim mobile top row (Task 4). Takes `active` as a prop rather than calling `usePathname`, matching the existing `TopBar` convention and keeping the component a server component with no client boundary.

- [ ] **Step 1: Write the failing test**

Create `src/components/MobileTabBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileTabBar } from "./MobileTabBar";

describe("MobileTabBar", () => {
  it("renders exactly the five primary destinations", () => {
    render(<MobileTabBar active="calendar" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard",
      "/dashboard/predict",
      "/dashboard/lobby",
      "/reveal",
      "/dashboard/standings",
    ]);
  });

  it("marks only the active destination with aria-current", () => {
    render(<MobileTabBar active="predict" />);
    const current = screen.getAllByRole("link", { current: "page" });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("href", "/dashboard/predict");
  });

  it("is hidden at and above the md fork", () => {
    const { container } = render(<MobileTabBar active="calendar" />);
    expect(container.firstElementChild?.className).toContain("md:hidden");
  });

  it("pads for the iOS home indicator", () => {
    const { container } = render(<MobileTabBar active="calendar" />);
    const nav = container.firstElementChild as HTMLElement;
    expect(nav.style.paddingBottom).toContain("safe-area-inset-bottom");
  });

  it("labels tabs that are not in its five with no active link", () => {
    // League/Profile live in the top row, so nothing here is current.
    render(<MobileTabBar active="profile" />);
    expect(screen.queryAllByRole("link", { current: "page" })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/MobileTabBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./MobileTabBar"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/MobileTabBar.tsx`:

```tsx
import Link from "next/link";
import type { TopBarTab } from "@/components/TopBar";

/**
 * Fixed bottom navigation, below the 780px fork only.
 *
 * Five destinations, thumb-reachable one-handed during a race. League and
 * Profile are reachable from the slim mobile top row (see TopBar) rather
 * than crowding six or seven targets across a 375px screen.
 *
 * Deliberately NOT rendered on the two immersive routes:
 *   - /dashboard/predict/[eventId] — the lock bar owns the bottom edge
 *   - /reveal/[eventId]            — the cinematic is chrome-free
 * TopBar is per-page with no nested layout, so that is simply an omission
 * at those call sites.
 */
const TABS: { id: TopBarTab; label: string; href: string; glyph: string }[] = [
  { id: "calendar", label: "Calendar", href: "/dashboard", glyph: "⚑" },
  { id: "predict", label: "Predict", href: "/dashboard/predict", glyph: "◉" },
  { id: "lobby", label: "Lobby", href: "/dashboard/lobby", glyph: "▦" },
  { id: "reveal", label: "Reveal", href: "/reveal", glyph: "◈" },
  { id: "standings", label: "Standings", href: "/dashboard/standings", glyph: "≣" },
];

export function MobileTabBar({ active }: { active: TopBarTab }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[color:var(--border)] backdrop-blur md:hidden"
      style={{
        background: "color-mix(in oklch, var(--surface-2) 92%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className="flex min-h-[52px] flex-col items-center justify-center gap-1 pt-2 pb-1"
            style={{
              color: isActive ? "var(--fg)" : "var(--fg-subtle)",
              boxShadow: isActive
                ? "inset 0 2px 0 0 var(--accent)"
                : undefined,
            }}
          >
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
              {t.glyph}
            </span>
            <span
              className="uppercase"
              data-tabular
              style={{ fontSize: 9, letterSpacing: "0.1em" }}
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/MobileTabBar.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/MobileTabBar.tsx src/components/MobileTabBar.test.tsx
git commit -m "feat(mobile): add fixed bottom MobileTabBar"
```

---

## Task 4: Fork `TopBar` — hide tabs below `md`, compact 780–1024

**Files:**
- Modify: `src/components/TopBar.tsx:47-78`
- Test: `src/components/TopBar.test.tsx` (create)

**Interfaces:**
- Consumes: `MobileTabBar` is a sibling, not a child — `TopBar`'s signature is unchanged (`active`, `displayName`, `email`).
- Produces: no API change. All 11 existing call sites keep compiling.

The measured desktop nav needs **~1053px**: 55px wordmark + 607px tabs (48 chars × 8.64px mono+tracking, `px-3`×7, `gap-1`×6) + 263px right cluster + 128px gaps/padding. At 780px it must shed ~290px, achieved by: `?`-glyph-only ScoringHelp (−139), `px-3`→`px-1.5` (−84), `gap-8`→`gap-4` (−32), tracking `0.12em`→`0.06em` (−35) → ~763px. `lg:` restores every full-size value, so ≥1024px is unchanged.

`TopBar` imports `signOutAction`, a `"use server"` module that cannot be imported into jsdom — the test mocks it.

- [ ] **Step 1: Write the failing test**

Create `src/components/TopBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// TopBar imports a "use server" action, which jsdom cannot evaluate.
vi.mock("@/app/signout/actions", () => ({ signOutAction: async () => {} }));

import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("hides the tab row below the md fork and shows it at/above", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    const list = screen.getByRole("list");
    expect(list.className).toContain("hidden");
    expect(list.className).toContain("md:flex");
  });

  it("keeps all seven destinations for the desktop tree", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    const hrefs = screen
      .getByRole("list")
      .querySelectorAll("a");
    expect(hrefs).toHaveLength(7);
  });

  it("still exposes Profile and Sign out on mobile, outside the tab row", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    const profile = screen.getByRole("link", { name: "Profile" });
    const signOut = screen.getByRole("button", { name: "Sign out" });
    // Neither may live inside the md-only tab row.
    expect(screen.getByRole("list").contains(profile)).toBe(false);
    expect(screen.getByRole("list").contains(signOut)).toBe(false);
  });

  it("shows the scoring-help label only from lg up, glyph always", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    const label = screen.getByText("How Scoring Works");
    expect(label.className).toContain("hidden");
    expect(label.className).toContain("lg:inline");
  });

  it("uses the initial of the display name for the avatar", () => {
    render(<TopBar active="profile" displayName="Aastha" email="a@b.test" />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveTextContent("A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/TopBar.test.tsx`
Expected: FAIL — the tab `<ul>` currently has `flex flex-1` with no `hidden`/`md:flex`, and `How Scoring Works` has no responsive class.

- [ ] **Step 3: Write minimal implementation**

In `src/components/TopBar.tsx`, change the container and tab list. Replace the `<div className="mx-auto flex w-full max-w-[1600px] items-center gap-8 …">` opening tag with:

```tsx
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-6 py-4 sm:px-8 lg:gap-8 lg:px-12 xl:px-16">
```

Replace the `<ul>` opening tag with:

```tsx
        <ul className="hidden flex-1 items-center gap-1 text-xs uppercase tracking-[0.06em] md:flex lg:tracking-[0.12em]">
```

Replace both `<Link>` `className` strings inside the tab `map` so the horizontal padding tightens in the compact band:

```tsx
                className={
                  t.id === active
                    ? "border-b-2 border-[color:var(--accent)] px-1.5 pb-3 -mb-4 pt-3 text-[color:var(--fg)] lg:px-3"
                    : "border-b-2 border-transparent px-1.5 pb-3 -mb-4 pt-3 text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-muted)] lg:px-3"
                }
```

Add `ml-auto` to the right-hand cluster so it stays flush right once the tab row is hidden:

```tsx
        <div className="ml-auto flex items-center gap-4">
```

Then in `src/components/ScoringHelp.tsx`, wrap the trigger's text label so only the `?` glyph shows below `lg`. Replace the bare `How Scoring Works` text node at the end of the `<button>` with:

```tsx
        <span className="hidden lg:inline">How Scoring Works</span>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/components/TopBar.test.tsx src/components/ScoringLegend.test.tsx && bun run typecheck`
Expected: PASS. `ScoringLegend.test.tsx` is included to confirm the ScoringHelp edit did not disturb the legend body.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopBar.tsx src/components/TopBar.test.tsx src/components/ScoringHelp.tsx
git commit -m "feat(mobile): fork TopBar at md, compact nav in 780-1024 band"
```

---

## Task 5: Wire `MobileTabBar` into the nine non-immersive routes

**Files:**
- Modify: `src/app/dashboard/page.tsx:221`, `src/app/dashboard/predict/page.tsx:242`, `src/app/dashboard/predict/round/[round]/page.tsx:137`, `src/app/dashboard/lobby/shared.tsx:36`, `src/app/dashboard/standings/page.tsx:429`, `src/app/dashboard/league/page.tsx:141`, `src/app/reveal/page.tsx:172`, `src/app/profile/page.tsx:72`, `src/app/dashboard/predict/[eventId]/page.tsx:185`

**Interfaces:**
- Consumes: `MobileTabBar` from Task 3, `active` values already passed to the adjacent `TopBar`.
- Produces: nothing new.

Of the eleven `<TopBar>` call sites, **nine get the tab bar and two do not**:

- **Omitted:** `src/app/reveal/[eventId]/page.tsx:195` and `:229` — the cinematic is chrome-free. These are the only omissions.
- **Included, with a caveat:** `src/app/dashboard/predict/[eventId]/page.tsx:185` gets the bar. It will overlap the fixed lock bar until Task 13 offsets the lock bar above it. That overlap is expected between this task and Task 13 — do not skip the bar here to avoid it.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/mobile-nav.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}

const INVITE_CODE = requireEnv("INVITE_CODE");

async function signIn(page: Page) {
  await page.goto("/join");
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/);
  const email = `test+nav-${Date.now()}@f1fantasy.test`;
  const resp = await page.request.post("/api/test/sign-in-password", {
    data: { email, password: "test-password-12345" },
  });
  expect(resp.ok(), `sign-in: ${resp.status()}`).toBeTruthy();
  // First-time users are forced through profile setup.
  await page.goto("/profile?welcome=1");
  await page.getByLabel("Your name (required)").fill("Nav Test");
  await page.getByRole("button", { name: /save.+paddock/i }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
}

test.describe("mobile navigation", () => {
  test("bottom tab bar is present on browse routes", async ({ page }) => {
    await signIn(page);
    for (const route of [
      "/dashboard",
      "/dashboard/predict",
      "/dashboard/lobby",
      "/dashboard/standings",
      "/reveal",
    ]) {
      await page.goto(route);
      const bar = page.getByRole("navigation", { name: "Primary" });
      await expect(bar, `${route} should have the tab bar`).toBeVisible();
    }
  });

  test("exactly one nav is visible at a given width", async ({ page }) => {
    await signIn(page);
    await page.goto("/dashboard/standings");
    const tabBar = page.getByRole("navigation", { name: "Primary" });
    const topTabs = page.getByRole("list").first();

    await page.setViewportSize({ width: 375, height: 700 });
    await expect(tabBar).toBeVisible();
    await expect(topTabs).toBeHidden();

    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(tabBar).toBeHidden();
    await expect(topTabs).toBeVisible();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `supabase start` (if not running), then:
`bun --env-file=.env.local run e2e tests/e2e/mobile-nav.spec.ts`
Expected: FAIL — no element with accessible name "Primary".

- [ ] **Step 3: Write minimal implementation**

At each of the nine files listed above: add the import and render the bar as a sibling immediately after the closing `/>` or `</TopBar>` of the existing `TopBar`, passing the same `active` value. Example for `src/app/dashboard/standings/page.tsx`:

```tsx
import { MobileTabBar } from "@/components/MobileTabBar";
```

```tsx
      <TopBar
        active="standings"
        displayName={myDisplayName}
        email={email}
      />
      <MobileTabBar active="standings" />
```

The `active` values by file: `dashboard/page.tsx` → `"calendar"`; `predict/page.tsx`, `predict/round/[round]/page.tsx`, `predict/[eventId]/page.tsx` → `"predict"`; `lobby/shared.tsx` → `"lobby"`; `standings/page.tsx` → `"standings"`; `league/page.tsx` → `"league"`; `reveal/page.tsx` → `"reveal"`; `profile/page.tsx` → `"profile"`.

Then give every page room for the bar so the last row is never occluded. In each of the nine files, add `pb-24 md:pb-0` to the `<main>` element that currently ends in `py-10` (or `py-12` on profile):

```tsx
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 pb-24 sm:px-8 md:pb-10 lg:px-12 xl:px-16">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --env-file=.env.local run e2e tests/e2e/mobile-nav.spec.ts`
Expected: PASS — 2 tests × 4 device projects once Task 6 adds them; for now 2 tests on `chromium`.

- [ ] **Step 5: Commit**

```bash
git add src/app tests/e2e/mobile-nav.spec.ts
git commit -m "feat(mobile): render MobileTabBar on the nine browse routes"
```

---

# SLICE 2 — Stop the overflow

Ships: no route overflows on any device, guarded by CI.

## Task 6: Device projects + the overflow regression net

**Files:**
- Modify: `playwright.config.ts:15-20`
- Create: `tests/e2e/no-horizontal-overflow.spec.ts`
- Create: `tests/e2e/fork-audit.spec.ts`

**Interfaces:**
- Consumes: the `signIn` helper pattern from Task 5.
- Produces: the assertion every remaining task in this slice is verified against. **This task is expected to end RED** — that is its purpose. Tasks 7–11 turn it green.

`scrollWidth <= clientWidth` on the scrolling element is the single check that catches every unprefixed fixed-px grid in the codebase. The spec also reports the widest offending elements, so a failure is actionable rather than just red.

- [ ] **Step 1: Add the device projects**

In `playwright.config.ts`, replace the `projects` array:

```ts
  projects: [
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "iPhone 14", use: { ...devices["iPhone 14"] } },
    { name: "Pixel 7", use: { ...devices["Pixel 7"] } },
    { name: "iPad Mini", use: { ...devices["iPad Mini"] } },
  ],
```

If Playwright reports an unknown device descriptor, print the registry and substitute the nearest name — the viewport is what matters (390×664 phone, 412×915 phone, 744×1133 tablet):

```bash
bun -e 'import {devices} from "@playwright/test"; console.log(Object.keys(devices).join("\n"))' | grep -iE "iphone 14|pixel 7|ipad mini"
```

- [ ] **Step 2: Write the failing test**

Create `tests/e2e/no-horizontal-overflow.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}

const INVITE_CODE = requireEnv("INVITE_CODE");

/** Routes reachable without a seeded event. Dynamic routes are followed below. */
const STATIC_ROUTES = [
  "/dashboard",
  "/dashboard/predict",
  "/dashboard/lobby",
  "/dashboard/league",
  "/dashboard/standings",
  "/reveal",
  "/profile",
];

async function signIn(page: Page) {
  await page.goto("/join");
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/);
  const email = `test+ovf-${Date.now()}@f1fantasy.test`;
  const resp = await page.request.post("/api/test/sign-in-password", {
    data: { email, password: "test-password-12345" },
  });
  expect(resp.ok(), `sign-in: ${resp.status()}`).toBeTruthy();
  await page.goto("/profile?welcome=1");
  await page.getByLabel("Your name (required)").fill("Overflow Test");
  await page.getByRole("button", { name: /save.+paddock/i }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
}

/**
 * The single assertion that catches every unprefixed fixed-px grid.
 * 1px tolerance absorbs sub-pixel rounding on fractional-DPR devices.
 */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  const { scrollWidth, clientWidth, culprits } = await page.evaluate(() => {
    const el = document.scrollingElement as HTMLElement;
    const limit = el.clientWidth;
    const culprits = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter((e) => e.getBoundingClientRect().right > limit + 1)
      .slice(0, 6)
      .map((e) => {
        const r = e.getBoundingClientRect();
        const cls =
          typeof e.className === "string" ? e.className.slice(0, 90) : "";
        return `${e.tagName.toLowerCase()}${cls ? "." + cls : ""} right=${Math.round(r.right)}`;
      });
    return { scrollWidth: el.scrollWidth, clientWidth: limit, culprits };
  });

  expect(
    scrollWidth,
    `${label} scrolls horizontally (${scrollWidth} > ${clientWidth}). Widest offenders:\n  ${culprits.join("\n  ")}`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe("no horizontal overflow", () => {
  test("unauthenticated routes", async ({ page }) => {
    for (const route of ["/", "/join"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page, route);
    }
  });

  test("authenticated static routes", async ({ page }) => {
    await signIn(page);
    for (const route of STATIC_ROUTES) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page, route);
    }
  });

  test("dynamic routes reached by following real links", async ({ page }) => {
    await signIn(page);
    // Round detail — follow the first round link on /dashboard/predict.
    await page.goto("/dashboard/predict");
    const round = page.locator('a[href*="/dashboard/predict/round/"]').first();
    if (await round.count()) {
      await round.click();
      await page.waitForURL(/\/dashboard\/predict\/round\//);
      await expectNoHorizontalOverflow(page, page.url());

      // Session detail — follow the first event link from the round page.
      const event = page
        .locator('a[href*="/dashboard/predict/"]')
        .filter({ hasNotText: /round/i })
        .first();
      if (await event.count()) {
        await event.click();
        await expectNoHorizontalOverflow(page, page.url());
      }
    } else {
      test.skip(true, "no events seeded — run scripts/seed-calendar.ts");
    }
  });
});
```

Create `tests/e2e/fork-audit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

/**
 * Behavioural proof that the 780px fork is where we think it is. The unit
 * test in src/app/globals.test.ts only guards the token value; this asserts
 * the browser actually flips at the boundary.
 */
test.describe("780px fork boundary", () => {
  test.use({ viewport: { width: 779, height: 900 } });

  test("md: utilities are inactive at 779px and active at 781px", async ({
    page,
  }) => {
    await page.goto("/join");
    const probe = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "hidden md:block";
      document.body.appendChild(el);
      const at779 = getComputedStyle(el).display;
      return { at779 };
    });
    expect(probe.at779, "md:block must NOT apply at 779px").toBe("none");

    await page.setViewportSize({ width: 781, height: 900 });
    const at781 = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".hidden.md\\:block")!;
      return getComputedStyle(el).display;
    });
    expect(at781, "md:block must apply at 781px").toBe("block");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts`
Expected: FAIL on `iPhone 14` and `Pixel 7` for `/dashboard`, `/dashboard/league`, `/dashboard/standings`, and likely `/dashboard/predict`. The failure message names the offending elements. `fork-audit.spec.ts` should PASS (Task 2 landed the breakpoint). Record the failing route list — it is the worklist for Tasks 7–11.

- [ ] **Step 4: Commit the red test**

```bash
git add playwright.config.ts tests/e2e/no-horizontal-overflow.spec.ts tests/e2e/fork-audit.spec.ts
git commit -m "test(mobile): add device projects + horizontal-overflow regression net"
```

---

## Task 7: Extract and fork the driver-standings row

**Files:**
- Create: `src/app/dashboard/standings/driver-row.tsx`
- Modify: `src/app/dashboard/standings/page.tsx:614-758`
- Test: `src/app/dashboard/standings/driver-row.test.tsx` (create)

**Interfaces:**
- Consumes: `teamMeta` from `@/lib/design/teams`, `DriverPortrait` from `@/components/DriverPortrait`, `driverCountry`/`countryFlag` from `@/lib/design/drivers`.
- Produces:
  ```ts
  export type DriverRowProps = {
    pos: number; code: string; fullName: string; team: string;
    points: number; wins: number; podiums: number;
    gap: string; country: string | null; isLeader: boolean;
  };
  export function DriverStandingsRowDesktop(p: DriverRowProps): JSX.Element;
  export function DriverStandingsRowMobile(p: DriverRowProps): JSX.Element;
  ```
  Task 8 mirrors this shape for league.

The desktop row is lifted **verbatim** — same `gridTemplateColumns: "32px 56px minmax(0,1fr) 84px 48px 48px 64px"`, same `fontSize` values, same 3px team edge. Only its home changes. The mobile row is a `<details>` with a 4-column `<summary>`; expansion needs no client JS, so `page.tsx` stays a server component.

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/standings/driver-row.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DriverStandingsRowDesktop,
  DriverStandingsRowMobile,
  type DriverRowProps,
} from "./driver-row";

const VER: DriverRowProps = {
  pos: 1, code: "VER", fullName: "Max Verstappen", team: "Red Bull",
  points: 287, wins: 7, podiums: 11, gap: "LEADER",
  country: "Netherlands", isLeader: true,
};
const NOR: DriverRowProps = {
  pos: 2, code: "NOR", fullName: "Lando Norris", team: "McLaren",
  points: 241, wins: 4, podiums: 9, gap: "+46",
  country: "United Kingdom", isLeader: false,
};

describe("DriverStandingsRowMobile", () => {
  it("shows position, name and points in the collapsed summary", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    const summary = screen.getByRole("group").querySelector("summary")!;
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("NOR");
    expect(summary).toHaveTextContent("241");
  });

  it("keeps wins, podiums and gap out of the summary but in the row", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    const summary = screen.getByRole("group").querySelector("summary")!;
    expect(summary).not.toHaveTextContent("PODIUMS");
    expect(screen.getByText("PODIUMS")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("+46")).toBeInTheDocument();
  });

  it("needs no client JS — expansion is a native details element", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    expect(screen.getByRole("group").tagName).toBe("DETAILS");
  });

  it("renders tabular numerics", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    expect(screen.getByText("241")).toHaveAttribute("data-tabular");
  });

  it("marks the leader", () => {
    render(<DriverStandingsRowMobile {...VER} />);
    expect(screen.getByText("LEADER")).toBeInTheDocument();
  });
});

describe("DriverStandingsRowDesktop", () => {
  it("keeps the dense seven-column grid", () => {
    const { container } = render(<DriverStandingsRowDesktop {...NOR} />);
    const li = container.querySelector("li")!;
    expect(li.style.gridTemplateColumns).toBe(
      "32px 56px minmax(0,1fr) 84px 48px 48px 64px",
    );
  });

  it("shows every column inline", () => {
    render(<DriverStandingsRowDesktop {...NOR} />);
    expect(screen.getByText("241")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/app/dashboard/standings/driver-row.test.tsx`
Expected: FAIL — `Failed to resolve import "./driver-row"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/dashboard/standings/driver-row.tsx`. Copy the existing `<li>` from `page.tsx:623-758` into `DriverStandingsRowDesktop` unchanged, swapping `s.driver.*`/`wins`/`pods`/`gap`/`country` for the props. Then add the mobile row:

```tsx
import { DriverPortrait } from "@/components/DriverPortrait";
import { countryFlag } from "@/lib/design/drivers";
import { teamMeta } from "@/lib/design/teams";

export type DriverRowProps = {
  pos: number;
  code: string;
  fullName: string;
  team: string;
  points: number;
  wins: number;
  podiums: number;
  gap: string;
  country: string | null;
  isLeader: boolean;
};

/**
 * Mobile driver-standings row — four columns you actually scan (position,
 * portrait, name, points) with everything else behind a native <details>.
 * <details> deliberately over a client component: zero JS, free keyboard
 * and screen-reader semantics, and page.tsx stays a server component.
 */
export function DriverStandingsRowMobile(p: DriverRowProps) {
  const t = teamMeta(p.team);
  return (
    <details
      className="relative border-b border-[color:var(--border)]"
      style={{ background: p.isLeader ? "var(--surface-2)" : "transparent" }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-2 bottom-2 w-[3px]"
        style={{ background: t?.hex ?? "var(--fg-subtle)" }}
      />
      <summary
        className="grid cursor-pointer list-none items-center gap-3 py-3 pl-3 pr-4 [&::-webkit-details-marker]:hidden"
        style={{ gridTemplateColumns: "28px 40px minmax(0,1fr) auto" }}
      >
        <span
          className="leading-none"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 18,
            color: p.isLeader ? "var(--accent)" : "var(--fg)",
          }}
          data-tabular
        >
          {p.pos}
        </span>
        <DriverPortrait code={p.code} team={p.team} size={40} />
        <span className="min-w-0">
          <span
            className="block truncate leading-none"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 15,
            }}
          >
            {p.code}
          </span>
          <span className="block truncate text-[10px] text-[color:var(--fg-subtle)]">
            {p.fullName}
          </span>
        </span>
        <span
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 20,
          }}
          data-tabular
        >
          {p.points}
        </span>
      </summary>

      <dl
        className="grid gap-x-4 gap-y-2 px-3 pb-4 pl-3"
        style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}
      >
        {[
          ["GAP", p.gap],
          ["WINS", String(p.wins)],
          ["PODIUMS", String(p.podiums)],
          ["TEAM", t?.name ?? p.team],
          ["COUNTRY", p.country ? countryFlag(p.country) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt
              className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.1em" }}
              data-tabular
            >
              {label}
            </dt>
            <dd className="text-sm" data-tabular>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
```

In `page.tsx`, hoist the per-row derivation into one mapped array so the two trees cannot disagree, then render both:

```tsx
              {(() => {
                const rows: DriverRowProps[] = driverStandings.map((s, idx) => ({
                  pos: idx + 1,
                  code: s.driver.code,
                  fullName: s.driver.full_name,
                  team: s.driver.team,
                  points: s.points,
                  wins: winsByDriver.get(s.driver.id) ?? 0,
                  podiums: podiumsByDriver.get(s.driver.id) ?? 0,
                  gap: idx === 0 ? "LEADER" : `+${leaderPts - s.points}`,
                  country: driverCountry(s.driver.code),
                  isLeader: idx === 0,
                }));
                return (
                  <>
                    <div className="md:hidden">
                      {rows.map((r) => (
                        <DriverStandingsRowMobile key={r.code} {...r} />
                      ))}
                    </div>
                    <ol className="hidden md:block">
                      {rows.map((r) => (
                        <DriverStandingsRowDesktop key={r.code} {...r} />
                      ))}
                    </ol>
                  </>
                );
              })()}
```

Add `DriverRowProps` to the import from `./driver-row`. Deriving `rows` once is the point: a second `.map` with its own inline expressions is exactly how the two trees drift.

Also add `md:` guards to the three sibling fixed grids: line 482 `grid-cols-[1fr_auto]` → `grid-cols-1 md:grid-cols-[1fr_auto]`; line 592 `lg:grid-cols-[1.5fr_1fr]` needs no change; line 800 `gridTemplateColumns: "32px 32px minmax(0,1fr) auto"` → drop the second `32px` below `md` by moving it to a `md:`-guarded class.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/app/dashboard/standings/ && bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts --project="iPhone 14" --grep "authenticated static"`
Expected: unit PASS (7 tests); `/dashboard/standings` no longer listed among overflow failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/standings/
git commit -m "feat(mobile): fork driver standings into mobile details rows"
```

---

## Task 8: Extract and fork the league row

**Files:**
- Create: `src/app/dashboard/league/league-row.tsx`
- Modify: `src/app/dashboard/league/page.tsx:360-430`
- Test: `src/app/dashboard/league/league-row.test.tsx` (create)

**Interfaces:**
- Consumes: `teamMeta`, `displayName` (currently local to `page.tsx:23` — export it or duplicate the 3-line helper into the row module).
- Produces:
  ```ts
  export type LeagueRowProps = {
    rank: number; name: string; initial: string; points: number;
    pct: number; favTeam: string | null; favDriverCode: string | null;
    perfects: number; streak: number; isMe: boolean;
  };
  export function LeagueRowDesktop(p: LeagueRowProps): JSX.Element;
  export function LeagueRowMobile(p: LeagueRowProps): JSX.Element;
  ```

Summary: rank / avatar / name / points. Expanded: the `pct` progress bar, favourite team, favourite driver, perfect podiums, 🔥 streak. The 🔥 glyph keeps the font scoping introduced in commit `93212e1` — apply the emoji font to the glyph only, never the whole row.

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/league/league-row.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeagueRowMobile, type LeagueRowProps } from "./league-row";

const ME: LeagueRowProps = {
  rank: 2, name: "You", initial: "Y", points: 96, pct: 82,
  favTeam: "McLaren", favDriverCode: "NOR", perfects: 1, streak: 3,
  isMe: true,
};

describe("LeagueRowMobile", () => {
  it("summarises rank, name and points only", () => {
    render(<LeagueRowMobile {...ME} />);
    const summary = screen.getByRole("group").querySelector("summary")!;
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("You");
    expect(summary).toHaveTextContent("96");
    expect(summary).not.toHaveTextContent("PERFECT");
  });

  it("exposes the deferred stats when expanded", () => {
    render(<LeagueRowMobile {...ME} />);
    expect(screen.getByText("PERFECT PODIUMS")).toBeInTheDocument();
    expect(screen.getByText("MCLAREN")).toBeInTheDocument();
    expect(screen.getByText("NOR")).toBeInTheDocument();
  });

  it("scopes the emoji font to the flame glyph only", () => {
    const { container } = render(<LeagueRowMobile {...ME} />);
    const flame = screen.getByText("🔥", { exact: false });
    expect(flame.style.fontFamily).toMatch(/emoji/i);
    expect(container.querySelector("details")!.style.fontFamily).toBe("");
  });

  it("omits the streak block entirely at zero", () => {
    render(<LeagueRowMobile {...ME} streak={0} />);
    expect(screen.queryByText("🔥", { exact: false })).toBeNull();
  });

  it("uses a native details element", () => {
    render(<LeagueRowMobile {...ME} />);
    expect(screen.getByRole("group").tagName).toBe("DETAILS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/app/dashboard/league/league-row.test.tsx`
Expected: FAIL — unresolved import.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/dashboard/league/league-row.tsx`. Lift the existing `<div>` row from `page.tsx:369-430` into `LeagueRowDesktop` unchanged — it keeps `gridTemplateColumns: "60px 40px minmax(0,1fr) minmax(120px,200px) 80px"` verbatim — swapping `r.*`/`fav`/`favDriverCode` for props. Then add the mobile row:

```tsx
import { teamMeta } from "@/lib/design/teams";

export type LeagueRowProps = {
  rank: number;
  name: string;
  initial: string;
  points: number;
  pct: number;
  favTeam: string | null;
  favDriverCode: string | null;
  perfects: number;
  streak: number;
  isMe: boolean;
};

const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export function LeagueRowMobile(p: LeagueRowProps) {
  const fav = p.favTeam ? teamMeta(p.favTeam) : null;
  return (
    <details
      className="border-b border-[color:var(--border)] last:border-b-0"
      style={{ background: p.isMe ? "var(--surface-2)" : "transparent" }}
    >
      <summary
        className="grid cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"
        style={{ gridTemplateColumns: "28px 36px minmax(0,1fr) auto" }}
      >
        <span
          className="leading-none"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 18,
          }}
          data-tabular
        >
          {p.rank}
        </span>
        <span
          className="grid place-items-center rounded-full"
          style={{
            width: 32,
            height: 32,
            background: "var(--surface-2)",
            border: `1px solid ${fav?.hex ?? "var(--border)"}`,
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 13,
          }}
        >
          {p.initial}
        </span>
        <span className="min-w-0 truncate text-sm">{p.name}</span>
        <span
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 20,
          }}
          data-tabular
        >
          {p.points}
        </span>
      </summary>

      <div className="px-4 pb-4">
        <div
          className="relative mb-3 h-1.5"
          style={{ background: "var(--bg)" }}
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${p.pct}%`,
              background: fav?.hex ?? "var(--fg-subtle)",
            }}
          />
        </div>
        <dl
          className="grid gap-x-4 gap-y-2"
          style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}
        >
          <Stat label="TEAM" value={fav ? fav.name.toUpperCase() : "—"} />
          <Stat label="DRIVER" value={p.favDriverCode ?? "—"} />
          <Stat label="PERFECT PODIUMS" value={String(p.perfects)} />
          {p.streak > 0 && (
            <div className="flex items-baseline justify-between gap-2">
              <dt
                className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                style={{ letterSpacing: "0.1em" }}
                data-tabular
              >
                P1 STREAK
              </dt>
              <dd className="text-sm" data-tabular>
                {/* Emoji font scoped to the glyph only — commit 93212e1.
                    Applying it to the row would swap the whole row's face. */}
                <span aria-hidden style={{ fontFamily: EMOJI_FONT }}>
                  🔥
                </span>{" "}
                {p.streak}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt
        className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.1em" }}
        data-tabular
      >
        {label}
      </dt>
      <dd className="text-sm" data-tabular>
        {value}
      </dd>
    </div>
  );
}
```

In `page.tsx`, export the local `displayName` helper (`page.tsx:23`) so the row module can reuse it, then derive `rows` once and render both trees — the same hoist-then-render shape as Task 7, so the two trees cannot drift:

```tsx
              {(() => {
                const rows: LeagueRowProps[] = rest.map((r) => {
                  const fav = teamMeta(r.user!.favorite_team);
                  const name = displayName(r.user!, r.userId === me);
                  return {
                    rank: r.rank,
                    name,
                    initial: name.charAt(0).toUpperCase(),
                    points: r.points,
                    pct: leaderPts > 0 ? (r.points / leaderPts) * 100 : 0,
                    favTeam: fav?.slug ?? null,
                    favDriverCode: r.user!.favorite_driver
                      ? driverCodeById.get(r.user!.favorite_driver) ?? null
                      : null,
                    perfects: r.perfects,
                    streak: r.streak?.current_p1_streak ?? 0,
                    isMe: r.userId === me,
                  };
                });
                return (
                  <>
                    <div className="md:hidden">
                      {rows.map((r) => (
                        <LeagueRowMobile key={r.rank} {...r} />
                      ))}
                    </div>
                    <div className="hidden md:block">
                      {rows.map((r) => (
                        <LeagueRowDesktop key={r.rank} {...r} />
                      ))}
                    </div>
                  </>
                );
              })()}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/app/dashboard/league/ && bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts --project="iPhone 14" --grep "authenticated static"`
Expected: unit PASS (5 tests); `/dashboard/league` clears.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/league/
git commit -m "feat(mobile): fork league table into mobile details rows"
```

---

## Task 9: Dashboard prediction rows, stat strip, hero

**Files:**
- Modify: `src/app/dashboard/page.tsx:304-308`, `:430`, `:560`, `:648`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

Four independent fixes in one file. The prediction rows at 560/648 use `grid-cols-[40px_44px_1fr_4px_56px]` with `gap-4` and `px-5` — 228px of fixed width before content, which survives 375px but leaves the driver name ~90px. Tighten below `md` rather than restructure.

- [ ] **Step 1: Write the failing test**

The regression net from Task 6 already covers this. Confirm the current failure and record the offenders:

Run: `bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts --project="iPhone 14" --grep "authenticated static"`
Expected: FAIL naming `/dashboard` with the offending element list.

- [ ] **Step 2: Write the implementation**

`:304-308` — hero: drop the fixed min-height on phones.

```tsx
      className="grid items-stretch overflow-hidden border border-[color:var(--border)] lg:grid-cols-[1.3fr_1fr]"
      style={{
        background: "linear-gradient(105deg, #1a0608 0%, var(--surface) 60%)",
      }}
```

…and move the height to a class so it only applies from `md` up: add `md:min-h-[360px]` to the same element's `className`.

`:430` — stat strip: `sm:grid-cols-2 lg:grid-cols-4` already degrades to 1 column; add `grid-cols-2` at base so four stats read as a 2×2 block rather than a 4-tall stack:

```tsx
      className="grid grid-cols-2 gap-px overflow-hidden border border-[color:var(--border)] bg-[color:var(--border)] lg:grid-cols-4"
```

`:560` and `:648` — prediction rows: tighten the fixed columns and gap below `md`, restore at `md`.

```tsx
                className="grid grid-cols-[28px_36px_1fr_3px_44px] items-center gap-2 border-b border-[color:var(--border)] px-3 py-3 last:border-b-0 md:grid-cols-[40px_44px_1fr_4px_56px] md:gap-4 md:px-5 md:py-3.5"
```

Apply the same replacement at `:648`, whose base template is `[40px_48px_1fr_4px_56px]` → `[28px_40px_1fr_3px_44px]` with the `md:` restoration to `[40px_48px_1fr_4px_56px]`.

- [ ] **Step 3: Run test to verify it passes**

Run: `bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts --project="iPhone 14" --project="Pixel 7" --grep "authenticated static"`
Expected: `/dashboard` clears.

- [ ] **Step 4: Verify desktop is unchanged**

Run: `bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts --project="Desktop Chrome"`
Expected: PASS. Then load `/dashboard` at 1440px and confirm the hero is still 360px tall, the stat strip is 4-across, and prediction rows still use the wider column set.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "fix(mobile): tighten dashboard rows, stat strip and hero below md"
```

---

## Task 10: Sweep the remaining player screens

**Files:**
- Modify: `src/app/reveal/page.tsx:177-178`, `src/app/dashboard/predict/page.tsx:309`, `src/app/dashboard/predict/[eventId]/page.tsx:192`, `src/app/reveal/[eventId]/page.tsx:231`, `src/app/dashboard/predict/round/[round]/page.tsx:254`, `src/app/dashboard/lobby/lobby-view.tsx:72`, `src/app/dashboard/lobby/lobby-sessions.tsx:91`, `src/app/dashboard/lobby/round/[round]/page.tsx`, `src/app/dashboard/reveal-notice.tsx:100`, `src/app/login/page.tsx:45`, `src/app/profile/profile-form.tsx:289,368`, `src/app/profile/calendar-sync.tsx:133`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

Three mechanical patterns, applied per site:

1. **Unprefixed fixed-px `gridTemplateColumns`** → make the base template fluid, restore the fixed one at `md`. Sites: `predict/round/[round]/page.tsx:254` and `lobby/round/[round]/page.tsx` (`"minmax(0,1.4fr) minmax(0,1fr) auto"` → `"minmax(0,1fr) auto"` at base).
2. **Fixed-width decorative art** → contain it. `login/page.tsx:45`'s `w-[1100px] max-w-none` becomes `w-full max-w-[1100px] md:w-[1100px] md:max-w-none`.
3. **`whitespace-nowrap` on content that can exceed the viewport** → drop below `md`. Sites: `lobby-sessions.tsx:91`, `calendar-sync.tsx:133`, `league/page.tsx:327`. Replace with `md:whitespace-nowrap`.

`predict/page.tsx:309`'s `lg:grid-cols-[1fr_auto_360px]` already collapses; verify only. Profile swatch grids at 289/368 are already `grid-cols-3 sm:grid-cols-5` — verify only.

- [ ] **Step 1: Confirm current failures**

Run: `bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts --project="iPhone 14"`
Expected: FAIL listing the remaining routes. Work the list.

- [ ] **Step 2: Apply the three patterns**

**The governing rule for this task: an inline `style={{ gridTemplateColumns }}` cannot carry a breakpoint.** Every responsive grid fix therefore means deleting the inline style and moving the template into a Tailwind `grid-cols-[…]` arbitrary value, where spaces become underscores.

Pattern 1 — `src/app/dashboard/predict/round/[round]/page.tsx:254`. Before:

```tsx
                <div
                  className="grid items-center gap-6"
                  style={{
                    gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) auto",
                  }}
                >
```

After — inline style deleted, mobile-safe base, desktop template restored at `md`:

```tsx
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:gap-6">
```

Apply the identical transform at `src/app/dashboard/lobby/round/[round]/page.tsx`, which carries the same template.

Pattern 2 — `src/app/login/page.tsx:45`:

```tsx
            className="h-auto w-full max-w-[1100px] md:w-[1100px] md:max-w-none"
```

Pattern 3 — replace bare `whitespace-nowrap` with `md:whitespace-nowrap` at `lobby-sessions.tsx:91`, `calendar-sync.tsx:133`, and `league/page.tsx:327`.

- [ ] **Step 3: Run test to verify it passes**

Run: `bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts`
Expected: PASS on all four projects, all three tests. This is the slice's exit condition.

- [ ] **Step 4: Commit**

```bash
git add src/app
git commit -m "fix(mobile): eliminate horizontal overflow across player screens"
```

---

## Task 11: Shared components with zero responsive coverage

**Files:**
- Modify: `src/components/PracticeBanner.tsx`, `src/components/TrackDiagram.tsx`, `src/components/ScoringLegend.tsx`
- Test: `src/components/ScoringLegend.test.tsx` (existing — must stay green)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

These three have **zero** `sm:`/`md:`/`lg:`/`xl:` prefixes today. `ScoringHelp`'s dialog shell is already fluid (`width: min(92vw, 720px)`, `maxHeight: 85vh`, `overflow: auto`) — only its `var(--space-2xl)` inner padding is generous at 375px.

- [ ] **Step 1: Write the failing test**

Add to `src/components/ScoringLegend.test.tsx`:

```tsx
  it("keeps worked-example tables inside a 375px viewport", () => {
    const { container } = render(<ScoringLegendBody />);
    const wide = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (e) => /grid-cols-\[|whitespace-nowrap/.test(e.className || ""),
    );
    for (const el of wide) {
      expect(
        el.className,
        `${el.tagName} needs a mobile-safe base before its md: variant`,
      ).toMatch(/(^|\s)(grid-cols-1|md:)/);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/ScoringLegend.test.tsx`
Expected: FAIL if any legend row carries an unguarded fixed grid.

- [ ] **Step 3: Write the implementation**

**`ScoringLegend.tsx`** — every fixed `grid-cols-[…]` gets a single-column base and an `md:` restoration. For example a worked-example row currently reading `className="grid grid-cols-[1fr_auto_auto]"` becomes:

```tsx
        className="grid grid-cols-1 gap-1 md:grid-cols-[1fr_auto_auto] md:gap-3"
```

**`ScoringHelp.tsx`** — the dialog shell is already fluid; only the inner padding is generous at 375px. Replace the two inline `padding: "var(--space-xl) var(--space-2xl)"` declarations (header at `:88`, and the body wrapper) with classes so the breakpoint applies, deleting the `padding` key from each `style` object:

```tsx
            className="flex items-start justify-between p-[var(--space-lg)] md:px-[var(--space-2xl)] md:py-[var(--space-xl)]"
```

**`PracticeBanner.tsx`** — the FP row grid gets a single-column base. **Preserve the sanctioned 3px team-colour left edge** — it is one of the three explicitly allowed exceptions to the no-accent-stripe rule, so do not remove it while restructuring:

```tsx
      className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_auto] md:gap-4"
```

**`TrackDiagram.tsx`** — the country silhouette is drawn via CSS `mask-image` so it recolours by `backgroundColor`. Add `max-w-full` and `h-auto` to the masked element so it scales instead of forcing width:

```tsx
      className="h-auto max-w-full"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test && bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts`
Expected: full unit suite PASS; overflow net PASS on all four projects.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "fix(mobile): add responsive coverage to shared components"
```

---

# SLICE 3 — Predict quality

Ships: the highest-frequency screen is good on a phone.

## Task 12: Compact slot rows + one-line telemetry

**Files:**
- Modify: `src/app/dashboard/predict/driver-picker.tsx:190-250`, `:380-450`, `:518`
- Test: `src/app/dashboard/predict/driver-picker.test.ts` (existing — extend)

**Interfaces:**
- Consumes: nothing new. `fillNextEmpty`, the submit action, `formatLockDelta`, and the distinct-driver validation are **untouched** — this is layout only, which is why predict keeps one tree rather than two.
- Produces: nothing new.

Three `min-h-[320px]` cards in a `1.2fr 1fr 1fr` grid put "THE GRID" ~1000px below the fold. Below `md` they become ~96px full-width rows. The `minmax(96px, 1fr)` driver grid at 518 already lands on a clean 3-across at 375px — leave the template, raise the tap target. **Invariant: last-5 form renders oldest→newest (latest rightmost); the flip stays render-side, the stored string stays most-recent-first.**

- [ ] **Step 1: Write the failing test**

Append to `src/app/dashboard/predict/driver-picker.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("driver-picker mobile layout", () => {
  const src = readFileSync(
    resolve(__dirname, "driver-picker.tsx"),
    "utf8",
  );

  it("does not force a three-column slot grid at every width", () => {
    expect(src).not.toMatch(/gridTemplateColumns:\s*isSprint\s*\?\s*"1fr"\s*:\s*"1\.2fr 1fr 1fr"/);
  });

  it("guards the 320px slot-card floor behind md", () => {
    expect(src).not.toMatch(/className="[^"]*\bmin-h-\[320px\]/);
    expect(src).toMatch(/md:min-h-\[320px\]/);
  });

  it("gives the driver grid a 44px minimum tap target", () => {
    expect(src).toMatch(/min-h-\[44px\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/app/dashboard/predict/driver-picker.test.ts`
Expected: FAIL on all three assertions.

- [ ] **Step 3: Write the implementation**

Slot grid at `:190-198` — move the template into classes so a breakpoint applies:

```tsx
      <section
        className={`mt-10 grid border border-[color:var(--border)] ${
          isSprint ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr]"
        }`}
        style={{ gap: 1, background: "var(--border)" }}
      >
```

Slot card at `:208-212`:

```tsx
            <div
              key={slot}
              className="relative flex min-h-[96px] flex-col gap-2 overflow-hidden p-4 md:min-h-[320px] md:gap-5 md:p-7"
```

P-numeral at `:246-252` — replace the inline `fontSize: isP1 ? 96 : 64` with a clamp so it scales with the row:

```tsx
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    fontSize: isP1
                      ? "clamp(40px, 12vw, 96px)"
                      : "clamp(32px, 10vw, 64px)",
                    lineHeight: 0.85,
                  }}
```

Car watermark at `:222-224` — it cannot read at 96px tall; hide below `md`:

```tsx
                  className="pointer-events-none absolute hidden md:block"
```

Telemetry `<dl>` at `:380-450` — wrap the three `<div>` rows so they collapse to one mono line below `md`. Give the `<dl>` `className="flex flex-row flex-wrap gap-x-3 gap-y-1 text-[11px] md:flex-col md:gap-3 md:text-sm"` and add `md:justify-between` to each row while keeping the `<dt>`/`<dd>` pairs intact. The `title=` tooltip at `:436` is unreachable on touch — replace it with a visible `<dt>` suffix:

```tsx
                      <dt className="text-xs">
                        Quali Δ Race{" "}
                        <span className="text-[color:var(--fg-subtle)] md:hidden">
                          (grid→finish)
                        </span>
                      </dt>
```

Driver grid button at `:530-533` — raise the tap target:

```tsx
                  className="relative flex min-h-[44px] w-full flex-col items-center gap-1.5 px-2 py-3 text-center disabled:cursor-not-allowed"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/app/dashboard/predict/ && bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts --project="iPhone 14"`
Expected: PASS. Then load `/dashboard/predict/[eventId]` at 375px and confirm "THE GRID" heading is within ~350px of the top of `<main>`, and at 1440px confirm the three cards are unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/predict/
git commit -m "feat(mobile): compact predict slot rows and telemetry line"
```

---

## Task 13: Safe-area lock bar, stacked above the tab bar

**Files:**
- Modify: `src/app/dashboard/predict/driver-picker.tsx:638-700`
- Modify: `src/app/dashboard/predict/[eventId]/page.tsx:190`
- Test: `tests/e2e/predict-lock-bar.spec.ts` (create)

**Interfaces:**
- Consumes: `MobileTabBar` height (52px content + safe-area) from Task 3.
- Produces: nothing new.

The lock bar is `fixed inset-x-0 bottom-0` with no safe-area inset. On `/dashboard/predict/[eventId]` it now shares the bottom edge with the tab bar, so it sits **above** it: `bottom: calc(52px + env(safe-area-inset-bottom, 0px))` below `md`, `bottom: 0` from `md`. The page needs bottom padding equal to both bars so the last driver row is never occluded.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/predict-lock-bar.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}
const INVITE_CODE = requireEnv("INVITE_CODE");

async function signInAndOpenPredict(page: Page): Promise<boolean> {
  await page.goto("/join");
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/);
  await page.request.post("/api/test/sign-in-password", {
    data: { email: `test+lock-${Date.now()}@f1fantasy.test`, password: "test-password-12345" },
  });
  await page.goto("/profile?welcome=1");
  await page.getByLabel("Your name (required)").fill("Lock Test");
  await page.getByRole("button", { name: /save.+paddock/i }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
  await page.goto("/dashboard/predict");
  const round = page.locator('a[href*="/dashboard/predict/round/"]').first();
  if (!(await round.count())) return false;
  await round.click();
  const event = page.locator('a[href*="/dashboard/predict/"]').filter({ hasNotText: /round/i }).first();
  if (!(await event.count())) return false;
  await event.click();
  return true;
}

test("lock bar does not occlude the tab bar or the last driver", async ({ page }) => {
  const ok = await signInAndOpenPredict(page);
  test.skip(!ok, "no events seeded — run scripts/seed-calendar.ts");

  const lockBar = page.getByTestId("lock-bar-status");
  await expect(lockBar).toBeVisible();

  const barBox = (await lockBar.locator("xpath=ancestor::div[1]").boundingBox())!;
  const tabBar = page.getByRole("navigation", { name: "Primary" });

  if (await tabBar.isVisible()) {
    const tabBox = (await tabBar.boundingBox())!;
    // Lock bar must sit entirely above the tab bar — no overlap.
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(tabBox.y + 1);
  }

  // The last driver button must be scrollable into view, not trapped behind chrome.
  const lastDriver = page.locator('ul li button[aria-label]').last();
  await lastDriver.scrollIntoViewIfNeeded();
  await expect(lastDriver).toBeInViewport();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --env-file=.env.local run e2e tests/e2e/predict-lock-bar.spec.ts --project="iPhone 14"`
Expected: FAIL — the lock bar overlaps the tab bar at `bottom: 0`.

- [ ] **Step 3: Write the implementation**

`driver-picker.tsx:638-643` — offset above the tab bar below `md`, and pad for the home indicator:

```tsx
      <div
        className="fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom,0px))] z-20 border-t border-[color:var(--border)] backdrop-blur md:bottom-0"
        style={{
          background: "color-mix(in oklch, var(--surface-2) 92%, transparent)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
```

`:644` — stack status over button below `md`:

```tsx
        <div className="mx-auto flex w-full max-w-[1600px] flex-col items-stretch gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:px-8 md:py-5 lg:px-12 xl:px-16">
```

Both CTA elements (`:679` `Link` and `:692` `button`) get full-width-on-mobile and a comfortable target:

```tsx
              className="min-h-[48px] w-full px-8 py-4 text-center text-sm uppercase text-black transition-colors md:w-auto"
```

`predict/[eventId]/page.tsx:190` — reserve room for both bars:

```tsx
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 pb-[220px] sm:px-8 md:pb-[140px] lg:px-12 xl:px-16">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --env-file=.env.local run e2e tests/e2e/predict-lock-bar.spec.ts && bun --env-file=.env.local run e2e tests/e2e/no-horizontal-overflow.spec.ts`
Expected: PASS on all projects.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/predict/ tests/e2e/predict-lock-bar.spec.ts
git commit -m "fix(mobile): stack lock bar above tab bar with safe-area inset"
```

---

# SLICE 4 — Reveal portrait

Ships: the emotional peak lands on the surface most people use.

## Task 14: Thread the `variant` prop from a UA check

**Files:**
- Modify: `src/app/reveal/[eventId]/page.tsx`
- Modify: `src/app/reveal/[eventId]/reveal-stage.tsx:73-160`
- Test: `src/app/reveal/[eventId]/reveal-stage.test.ts` (existing — extend)

**Interfaces:**
- Consumes: `isPhoneUA` from Task 1.
- Produces: `RevealVariant = "portrait" | "wide"`, accepted by `RevealStage` and forwarded to `PodiumCard` and `StaticHero`. Task 15 consumes it.

CSS branching is wrong here specifically: both choreographies would mount and both Framer timelines would run, doubling animation work on the screen with the tightest frame budget. Image bandwidth would *not* double (shared URLs → one fetch), but CPU would. The route is auth-gated and dynamic, so reading `headers()` costs nothing and adds no cache-vary problem.

**The timing constants at `reveal-stage.tsx:57-70` stay a single shared source of truth.** Phone and desktop viewers must finish together — friends watch the same reveal at the same time, and a drift there is the one bug nobody would catch in review.

- [ ] **Step 1: Write the failing test**

Append to `src/app/reveal/[eventId]/reveal-stage.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("reveal variant plumbing", () => {
  const stage = readFileSync(resolve(__dirname, "reveal-stage.tsx"), "utf8");
  const page = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

  it("accepts a variant prop", () => {
    expect(stage).toMatch(/variant\s*[:?]/);
    expect(stage).toMatch(/"portrait"\s*\|\s*"wide"/);
  });

  it("derives the variant from the UA on the server", () => {
    expect(page).toMatch(/isPhoneUA/);
    expect(page).toMatch(/headers\(\)/);
  });

  it("keeps exactly one set of timing constants", () => {
    // A second PODIUM_STAGGER means the two timelines can drift apart.
    const matches = stage.match(/const PODIUM_STAGGER/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/app/reveal/`
Expected: FAIL on the first two assertions; the third already passes.

- [ ] **Step 3: Write the implementation**

`reveal-stage.tsx` — add the type and the prop, defaulting to `"wide"` so nothing else breaks:

```tsx
export type RevealVariant = "portrait" | "wide";
```

In the `RevealStage` props object add `variant = "wide"` and forward it to `StaticHero` and every `PodiumCard`. Add a local derived flag right after the existing `const reduce = useReducedMotion() ?? false;` at `:105`:

```tsx
  const isPortrait = variant === "portrait";
```

`page.tsx` — derive it. Both `<RevealStage>`/`<TopBar>` render paths at `:195` and `:229` need the value, so compute it once near the top of the component:

```tsx
import { headers } from "next/headers";
import { isPhoneUA } from "@/lib/design/device";

// …inside the async page component, before the early returns:
  const variant = isPhoneUA((await headers()).get("user-agent"))
    ? "portrait"
    : "wide";
```

…then pass `variant={variant}` to `<RevealStage>`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/app/reveal/ && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/reveal/
git commit -m "feat(reveal): thread portrait/wide variant from a server UA check"
```

---

## Task 15: Portrait podium — three full-bleed stacked bands

**Files:**
- Modify: `src/app/reveal/[eventId]/reveal-stage.tsx:180-190`, `:520-560`, `:615-745`
- Test: `tests/e2e/reveal-portrait.spec.ts` (create)

**Interfaces:**
- Consumes: `RevealVariant` from Task 14.
- Produces: nothing new.

Each podium card is *already* portrait-shaped — team-tinted top band carrying a giant `P{n}`, driver portrait filling below, code/team footer. Full-bleed is its natural form. Only the container template and the type/art scale change; the `PODIUM_BASE_DELAY` → `PODIUM_STAGGER` → `PODIUM_DUR` sequence is untouched, so P3→P2→P1 still lands on the same beats.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/reveal-portrait.spec.ts`:

```ts
import { test, expect, devices } from "@playwright/test";

const PHONE_UA = devices["iPhone 14"].userAgent;

test.describe("reveal portrait choreography", () => {
  test("stacks the podium and mounts exactly one timeline", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      ...devices["iPhone 14"],
      userAgent: PHONE_UA,
    });
    const page = await ctx.newPage();
    // /reveal lists revealed events; skip cleanly when none exist.
    await page.goto("/reveal");
    const first = page.locator('a[href^="/reveal/"]').first();
    test.skip(!(await first.count()), "no revealed event — reveal one via /admin");
    await first.click();
    await page.waitForURL(/\/reveal\/[^/]+$/);

    // Exactly one podium container — not one per variant.
    const podiums = page.locator("[data-podium]");
    await expect(podiums).toHaveCount(1);

    // Cards stack: each card's left edge is identical.
    const cards = page.locator("[data-podium-card]");
    await expect(cards).toHaveCount(3);
    const lefts = await cards.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().left)),
    );
    expect(new Set(lefts).size, "portrait cards must share a left edge").toBe(1);

    // Nothing overflows.
    const { sw, cw } = await page.evaluate(() => {
      const el = document.scrollingElement as HTMLElement;
      return { sw: el.scrollWidth, cw: el.clientWidth };
    });
    expect(sw).toBeLessThanOrEqual(cw + 1);
    await ctx.close();
  });

  test("wide UA keeps the three-across podium", async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices["Desktop Chrome"] });
    const page = await ctx.newPage();
    await page.goto("/reveal");
    const first = page.locator('a[href^="/reveal/"]').first();
    test.skip(!(await first.count()), "no revealed event");
    await first.click();
    const cards = page.locator("[data-podium-card]");
    await expect(cards).toHaveCount(3);
    const lefts = await cards.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().left)),
    );
    expect(new Set(lefts).size, "wide cards must sit side by side").toBe(3);
    await ctx.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --env-file=.env.local run e2e tests/e2e/reveal-portrait.spec.ts --project="Desktop Chrome"`
Expected: FAIL — no `[data-podium]` / `[data-podium-card]` hooks yet.

- [ ] **Step 3: Write the implementation**

Podium container at `:180-190` — add the test hook and fork the template:

```tsx
        <div
          data-podium
          className="grid gap-px"
          style={{
            gridTemplateColumns:
              isSprint || isPortrait ? "1fr" : "1fr 1fr 1fr",
            background: "var(--border)",
          }}
        >
```

`PodiumCard` — accept `variant` and add the hook plus portrait scaling. At `:620`:

```tsx
  const topBandH = isPortrait ? (isP1 ? 104 : 92) : isP1 ? 160 : 140;
```

At `:622-628`:

```tsx
    <div
      data-podium-card
      className="relative flex h-full flex-col overflow-hidden"
      style={{
        background: "var(--surface)",
        minHeight: isPortrait ? (isP1 ? 260 : 230) : cardMinH,
      }}
    >
```

P-numeral at `:660-668`:

```tsx
            fontSize: isPortrait
              ? isP1
                ? "clamp(72px, 22vw, 144px)"
                : "clamp(60px, 18vw, 120px)"
              : isP1
                ? 144
                : 120,
```

Car watermark at `:643-656` and driver portrait at `:681-692` — contain them so they cannot force width:

```tsx
              width: 460,
              maxWidth: "100%",
              height: "auto",
```

Footer driver code at `:723-729`:

```tsx
                fontSize: isPortrait ? (isP1 ? 26 : 22) : isP1 ? 32 : 26,
```

Livery sweep at `:335-341` — widen the `vw` term so the sweep still reads in portrait:

```tsx
              width: isPortrait ? "min(1100px, 150vw)" : "min(1100px, 70vw)",
```

`StaticHero` at `:522-560` — this is the `prefers-reduced-motion` path, and it must get the same portrait treatment or reduced-motion phone users get a hero sized for a desktop. Change its signature and its one clamped headline; the `lg:grid-cols-[1.4fr_1fr]` at `:524` stays as-is:

```tsx
function StaticHero({
  hero,
  variant = "wide",
}: {
  hero: RevealHero;
  variant?: RevealVariant;
}) {
  const isPortrait = variant === "portrait";
```

…and at `:541`, widen the `vw` term so the headline fills a narrow screen instead of sitting at its 48px floor:

```tsx
            fontSize: isPortrait
              ? "clamp(40px, 13vw, 96px)"
              : "clamp(48px, 7vw, 96px)",
```

Then pass it through at the call site (`:156`): `<StaticHero hero={hero} variant={variant} />`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --env-file=.env.local run e2e tests/e2e/reveal-portrait.spec.ts && bun run test src/app/reveal/`
Expected: PASS both projects.

- [ ] **Step 5: Verify the cinematic by hand**

With a revealed event, on a real iPhone or the `iPhone 14` project:
1. P3 → P2 → P1 slam in bottom-of-stack order on the same ~180ms stagger.
2. Replay re-keys every motion node (bump `playKey`) and replays cleanly.
3. Enable Reduce Motion in OS settings → `StaticHero` renders, no animation, layout intact.
4. Total runtime matches a desktop viewer's within ~0.2s.

- [ ] **Step 6: Commit**

```bash
git add src/app/reveal/ tests/e2e/reveal-portrait.spec.ts
git commit -m "feat(reveal): full-bleed stacked podium bands in portrait"
```

---

# SLICE 5 — Admin actions

Ships: a race weekend can be run from a phone.

## Task 16: Stacked admin action cards

**Files:**
- Modify: `src/app/admin/page.tsx:247`, `:352`, `:396`
- Modify: `src/app/admin/admin-strip.tsx:30`
- Test: `tests/e2e/admin-mobile.spec.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

The `:352`/`:396` template `32px 80px 32px minmax(0,1fr) 100px 96px 140px minmax(0,1fr) 200px` needs ~636px plus padding. Below `md` each session becomes a stacked card: label, results status, then full-width **Fetch from OpenF1** and **Reveal to group**. The reveal tap is the Sunday-evening action the whole product gates on — it must never need a laptop.

`ADMIN_EMAIL` must match the test sign-in email for the admin routes to be reachable; `/api/test/sign-in-password` already self-heals `public.admins` for that address.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/admin-mobile.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}
const INVITE_CODE = requireEnv("INVITE_CODE");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

test.describe("admin on mobile", () => {
  test("session list and reveal action fit a phone", async ({ page }) => {
    test.skip(!ADMIN_EMAIL, "ADMIN_EMAIL not set — cannot reach /admin");
    await page.goto("/join");
    await page.getByLabel("Invite code").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/login/);
    const resp = await page.request.post("/api/test/sign-in-password", {
      data: { email: ADMIN_EMAIL, password: "test-password-12345" },
    });
    expect(resp.ok(), `admin sign-in: ${resp.status()}`).toBeTruthy();

    await page.goto("/admin");
    const { sw, cw } = await page.evaluate(() => {
      const el = document.scrollingElement as HTMLElement;
      return { sw: el.scrollWidth, cw: el.clientWidth };
    });
    expect(sw, "/admin must not scroll horizontally").toBeLessThanOrEqual(cw + 1);

    // Any reveal control present must be a comfortable tap target.
    const reveal = page.getByRole("button", { name: /reveal to group/i }).first();
    if (await reveal.count()) {
      const box = (await reveal.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --env-file=.env.local run e2e tests/e2e/admin-mobile.spec.ts --project="iPhone 14"`
Expected: FAIL — `/admin` scrolls horizontally.

- [ ] **Step 3: Write the implementation**

`admin/page.tsx:352` and `:396` — convert the inline template to responsive classes (an inline `gridTemplateColumns` cannot carry a breakpoint) and stack below `md`:

```tsx
                  className="grid grid-cols-1 items-start gap-2 md:grid-cols-[32px_80px_32px_minmax(0,1fr)_100px_96px_140px_minmax(0,1fr)_200px] md:items-center md:gap-4"
```

Delete the corresponding `style={{ gridTemplateColumns: "…" }}`. Wrap each cell that only makes sense in a table context with a mobile label, e.g. the status cell gains `<span className="text-[10px] uppercase text-[color:var(--fg-subtle)] md:hidden" data-tabular>Status</span>`.

`:247` — give `<main>` room for the tab bar: add `pb-24 md:pb-10`.

`admin-strip.tsx:30` — wrap below `md`:

```tsx
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs uppercase sm:px-8 md:flex-nowrap md:gap-6 lg:px-12 xl:px-16">
```

Make the action buttons full-width below `md` in `reveal-button.tsx` and the OpenF1 fetch control: add `min-h-[44px] w-full md:w-auto`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --env-file=.env.local run e2e tests/e2e/admin-mobile.spec.ts --project="iPhone 14" --project="Pixel 7"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/ tests/e2e/admin-mobile.spec.ts
git commit -m "feat(mobile): stack admin session list into action cards"
```

---

## Task 17: Contain the manual results forms

**Files:**
- Modify: `src/app/admin/results/[eventId]/results-form.tsx:241`, `:274`, `:368`, `:471`
- Modify: `src/app/admin/results/round/[round]/page.tsx:182`, `:261`
- Modify: `src/app/admin/results/round/[round]/practice-overrides-form.tsx`
- Modify: `src/app/admin/results/[eventId]/page.tsx:170`, `:195`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

**Deliberately not restructured.** `results-form.tsx` is the most intricate form in the app and the one place a layout bug silently corrupts scoring for everyone. It gets horizontal-scroll containment and an honest note, nothing more. Manual results entry stays a laptop job by design.

- [ ] **Step 1: Write the failing test**

Extend `tests/e2e/admin-mobile.spec.ts`:

```ts
  test("results entry is contained, not clipped", async ({ page }) => {
    test.skip(!ADMIN_EMAIL, "ADMIN_EMAIL not set");
    await page.goto("/join");
    await page.getByLabel("Invite code").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/login/);
    await page.request.post("/api/test/sign-in-password", {
      data: { email: ADMIN_EMAIL, password: "test-password-12345" },
    });
    await page.goto("/admin");
    const entry = page.locator('a[href*="/admin/results/"]').first();
    test.skip(!(await entry.count()), "no events seeded");
    await entry.click();

    // The PAGE must not scroll sideways…
    const { sw, cw } = await page.evaluate(() => {
      const el = document.scrollingElement as HTMLElement;
      return { sw: el.scrollWidth, cw: el.clientWidth };
    });
    expect(sw, "page must not scroll horizontally").toBeLessThanOrEqual(cw + 1);

    // …but a wide grid inside its own scroller is fine and expected.
    const scrollers = page.locator(".overflow-x-auto");
    expect(await scrollers.count()).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --env-file=.env.local run e2e tests/e2e/admin-mobile.spec.ts --project="iPhone 14"`
Expected: FAIL — the page itself scrolls sideways and there is no `.overflow-x-auto` scroller.

- [ ] **Step 3: Write the implementation**

Wrap each of the three fixed grids in `results-form.tsx` (`:274`, `:368`, `:471`) and the one in `practice-overrides-form.tsx` in its own scroller, so the wide content scrolls inside the card rather than the page:

This is a pure wrapper insertion — the grid element and every one of its children stay byte-identical. At `:274`, for instance, the existing `<div style={{ gridTemplateColumns: "60px 64px minmax(0,1fr) auto" }}>` and its entire subtree are moved inside a new scroller, unedited:

```tsx
            <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <div
                style={{ gridTemplateColumns: "60px 64px minmax(0,1fr) auto" }}
                /* …the pre-existing element, unchanged… */
              >
                {/* …its pre-existing children, unchanged… */}
              </div>
            </div>
```

The negative margin plus matching padding lets the scroller bleed to the card edge so the content is not double-inset. Repeat for `:368` (`"repeat(auto-fill, minmax(120px, 1fr))"`), `:471` (`"minmax(0,1fr) 56px"`), and the equivalent grid in `practice-overrides-form.tsx`. **Do not change any template value** — the point of this task is that the form's layout is left alone.

`:241` — the outer `lg:grid-cols-[1.3fr_1fr]` needs no change. Add the honest note once, at the top of the form, below `md` only:

```tsx
      <p
        className="mb-4 border border-[color:var(--border)] p-3 text-xs text-[color:var(--fg-muted)] md:hidden"
        style={{ background: "var(--surface)" }}
      >
        Manual entry is laid out for a larger screen. Tables below scroll
        sideways. Fetching from OpenF1 and revealing work fine here.
      </p>
```

Add `pb-24 md:pb-10` to the `<main>` at `results/[eventId]/page.tsx:170` and `results/round/[round]/page.tsx:182`. Convert the inline `gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) auto"` at `round/[round]/page.tsx:261` to responsive classes as in Task 10.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --env-file=.env.local run e2e tests/e2e/admin-mobile.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full suite**

```bash
bun run lint && bun run typecheck && bun run test
bun --env-file=.env.local run e2e
```

Expected: all green across `Desktop Chrome`, `iPhone 14`, `Pixel 7`, `iPad Mini`.

- [ ] **Step 6: Refresh the knowledge graph and commit**

```bash
graphify update .
git add -A
git commit -m "feat(mobile): contain admin results forms in horizontal scrollers"
```

---

## Final verification

- [x] `bun run lint && bun run typecheck && bun run test` — all green. *(2026-09-07: lint 0 errors / 3 warnings in an evidence script; typecheck clean; vitest 284/285 — the one failure, `rls.test.ts` I6, is an unscoped `select("user_id")` that also sees legitimately-revealed rows from other events and fails identically on `main`.)*
- [x] `bun --env-file=.env.local run e2e` — all four device projects green, including `no-horizontal-overflow`, `fork-audit`, `mobile-nav`, `predict-lock-bar`, `reveal-portrait`, `admin-mobile`, and the pre-existing `auth.spec.ts`. *(2026-09-07: 70 passed / 18 skipped / 0 failed, `--workers=1`; the 18 skips are `reveal-portrait` on the three mobile projects, Desktop-Chrome-only by design.)*
- [x] **Fork audit by hand:** at 779px and 781px exactly one nav is visible and one content tree renders. At 744px (iPad Mini) the compact desktop nav does not overflow and all 7 tabs are reachable. *(2026-09-07: 779 → tab bar only, 0/13 `hidden md:*` visible; 781 → top nav only, 13/13 visible, 0/1 `md:hidden` visible. The real iPad Mini is 768 (< 780 fork) so it correctly gets the tab bar; the compact nav was verified in its actual 780–1024 band instead: `ul` scrollWidth == clientWidth and all 7 tabs inside the viewport at 781, 800, 1024. At 768 the 5 tab-bar targets plus the wordmark and Profile links in TopBar make all 7 destinations reachable.)*
- [x] **Desktop unchanged:** load `/dashboard`, `/dashboard/standings`, `/dashboard/league`, `/dashboard/predict/[eventId]` and `/reveal/[eventId]` at 1440px and compare against `main`. Any visual difference at ≥1024px is a bug in this plan's execution. *(2026-09-07: full-page screenshots of the branch on :3000 vs a `main` worktree on :3001, 0 diff pixels on all five routes.)*
- [ ] **Real hardware** — the two things emulators lie about:
  1. `env(safe-area-inset-bottom)` under the tab bar and the lock bar on a notched iPhone in Safari.
  2. `dvh` behaviour as the URL bar collapses on scroll, on both iOS Safari and Android Chrome.
- [ ] **Reveal, both variants** on a real phone and a real desktop: one timeline mounts, P3→P2→P1 reads, Replay works, Reduce Motion gives `StaticHero`.

## Known risk

The compact nav occupies ~763px of its ~1053px natural width in the 780–1024px band. It fits arithmetically, but it is the tightest thing in this plan. If it reads badly on a real iPad, the fallback is to scroll-snap the tab row within that band rather than compress further — do **not** shrink the touch targets below 44px to buy space.
