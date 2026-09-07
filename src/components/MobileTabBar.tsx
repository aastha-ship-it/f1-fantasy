import Link from "next/link";
import type { TopBarTab } from "@/components/TopBar";

/**
 * Fixed bottom navigation, below the 780px fork only.
 *
 * Five destinations, thumb-reachable one-handed during a race: League,
 * Predict, Lobby, Reveal, Standings. Calendar is the landing page and is
 * reached via the F1 wordmark → /dashboard (TopBar, no responsive class,
 * visible at every width), so it does not need a tab here. Profile is
 * reachable from the slim mobile top row (see TopBar) rather than crowding
 * a sixth target across a 375px screen.
 *
 * Deliberately NOT rendered on exactly one immersive route: /reveal/[eventId]
 * (both TopBar call sites there) — the cinematic is chrome-free. TopBar is
 * per-page with no nested layout, so that is simply an omission at that call
 * site.
 *
 * /dashboard/predict/[eventId] renders this bar AND that page's own fixed
 * lock bar. The overlap is resolved — not here, but at the lock bar, which
 * offsets itself above this one by
 * `bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px))] md:bottom-0`
 * (see `driver-picker.tsx`). Do not "fix" it by dropping the bar from that
 * route: the tab bar is the only navigation below the fork.
 *
 * The bar's height is therefore load-bearing for another component. That is
 * why the tap target's min-height reads `var(--tabbar-item-h)` (globals.css)
 * instead of a literal — the lock bar's offset derives from the same pair of
 * variables, so growing the target cannot silently re-cover the submit
 * button. Guarded end-to-end by "the predict submit button is clickable, not
 * covered by the tab bar" in tests/e2e/mobile-nav.spec.ts.
 *
 * Styling is the mobile handoff's `MobTabBar`
 * (design/design_handoff_mobile/design/screens-mobile.jsx): 60px tall on a
 * SOLID `--surface-2` (no blur — the bar sits on opaque content and the
 * translucency only cost a compositor layer), glyph 15 / label 8, 5px
 * between them, accent inset on the active tab.
 */
const TABS: { id: TopBarTab; label: string; href: string; glyph: string }[] = [
  { id: "league", label: "League", href: "/dashboard/league", glyph: "▲" },
  { id: "predict", label: "Predict", href: "/dashboard/predict", glyph: "◉" },
  { id: "lobby", label: "Lobby", href: "/dashboard/lobby", glyph: "▦" },
  { id: "reveal", label: "Reveal", href: "/reveal", glyph: "◈" },
  { id: "standings", label: "Standings", href: "/dashboard/standings", glyph: "≣" },
];

export function MobileTabBar({ active }: { active: TopBarTab }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[color:var(--border)] bg-[color:var(--surface-2)] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className="flex min-h-[var(--tabbar-item-h)] flex-col items-center justify-center"
            style={{
              // 5px is off Tailwind's 4pt scale, so it stays inline rather
              // than inviting a `gap-[5px]` arbitrary value nobody can grep.
              gap: 5,
              color: isActive ? "var(--fg)" : "var(--fg-subtle)",
              boxShadow: isActive
                ? "inset 0 2px 0 0 var(--accent)"
                : undefined,
            }}
          >
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
              {t.glyph}
            </span>
            <span
              className="uppercase"
              data-tabular
              style={{ fontSize: 8, letterSpacing: "0.1em" }}
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
