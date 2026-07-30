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
 * /dashboard/predict/[eventId] DOES render this bar and currently overlaps
 * that page's fixed lock bar — a known interim state, not a bug to "fix" by
 * removing the bar here. Task 13 resolves the overlap by offsetting the lock
 * bar above this one.
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
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[color:var(--border)] backdrop-blur pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      style={{
        background: "color-mix(in oklch, var(--surface-2) 92%, transparent)",
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
