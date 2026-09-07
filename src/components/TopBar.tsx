import Link from "next/link";
import { F1Mark } from "@/components/F1Mark";
import { ScoringHelp } from "@/components/ScoringHelp";
import { signOutAction } from "@/app/signout/actions";

/**
 * Top navigation bar — used on every authenticated screen.
 *
 * Design canvas reference: `design/screens-auth.jsx:TopBar`. Layout:
 *   F1Mark | nav tabs ............................. season label · user · ⏻
 *
 * Below the 780px fork this collapses to the mobile handoff's `MobTopBar`
 * (design/design_handoff_mobile/design/screens-mobile.jsx): a flat 52px row,
 * solid `--bg`, 20px gutter, 16px wordmark, and 32×32 boxes on the right.
 * Every one of those is a BASE-level class with the current desktop value
 * restored at `md:` — at and above 780px this component must still resolve to
 * exactly what it did before the mobile pass (note today's base `px-6` was
 * only ever visible below 640, since `sm:px-8` covered 640–779, so `md:px-8`
 * reproduces every >=780 value verbatim).
 */

type Tab =
  | "calendar"
  | "predict"
  | "lobby"
  | "reveal"
  | "standings"
  | "league"
  | "profile";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "calendar", label: "Calendar", href: "/dashboard" },
  { id: "predict", label: "Predict", href: "/dashboard/predict" },
  { id: "lobby", label: "Lobby", href: "/dashboard/lobby" },
  { id: "reveal", label: "Reveal", href: "/reveal" },
  { id: "standings", label: "Standings", href: "/dashboard/standings" },
  { id: "league", label: "League", href: "/dashboard/league" },
  { id: "profile", label: "Profile", href: "/profile" },
];

export function TopBar({
  active,
  displayName,
  email,
}: {
  active: Tab;
  displayName?: string | null;
  email?: string | null;
}) {
  const initial = (displayName?.trim() || email?.trim() || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <nav className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--bg)] md:bg-[color:var(--bg)]/85 md:backdrop-blur">
      <div className="mx-auto flex h-[52px] w-full max-w-[1600px] items-center gap-3 px-5 md:h-auto md:gap-4 md:px-8 md:py-4 lg:gap-8 lg:px-12 xl:px-16">
        <Link
          href="/dashboard"
          aria-label="F1 Fantasy"
          className="flex items-center text-[color:var(--fg)]"
        >
          {/* F1Mark sizes off a numeric prop, not CSS, so the fork is two
              mutually exclusive spans rather than one responsive class. */}
          <span className="flex md:hidden">
            <F1Mark height={16} />
          </span>
          <span className="hidden md:flex">
            <F1Mark height={22} />
          </span>
        </Link>

        <ul className="hidden flex-1 items-center gap-1 text-xs uppercase tracking-[0.06em] md:flex lg:tracking-[0.12em]">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={t.href}
                className={
                  t.id === active
                    ? "border-b-2 border-[color:var(--accent)] px-1.5 pb-3 -mb-4 pt-3 text-[color:var(--fg)] lg:px-3"
                    : "border-b-2 border-transparent px-1.5 pb-3 -mb-4 pt-3 text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-muted)] lg:px-3"
                }
                data-tabular
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3 md:gap-4">
          <ScoringHelp />
          <Link
            href="/profile"
            aria-label="Profile"
            className={`flex size-8 items-center justify-center rounded-full border bg-[color:var(--surface-2)] text-xs md:size-9 md:bg-transparent md:text-sm ${
              active === "profile"
                ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                : "border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--fg-muted)]"
            }`}
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            {initial}
          </Link>
          {/* Sign-out is desktop-only as of PR-2. The mobile affordance now
              lives on /profile (a full-width ghost submit under Calendar
              sync, see src/app/profile/profile-form.tsx) — which is where
              the canvas puts it and where a destructive action belongs on a
              phone, rather than one thumb-width from the avatar link.
              Only the <form> carries the fork: the button's own base classes
              are inert below `md:` but its `md:size-auto md:border-0`
              restoration is what keeps the >=780 render byte-identical, so
              they stay exactly as PR-1 left them. */}
          <form action={signOutAction} className="hidden md:block">
            <button
              type="submit"
              className="inline-flex size-8 items-center justify-center border border-[color:var(--border)] text-xs uppercase tracking-[0.12em] text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-muted)] md:size-auto md:border-0"
              data-tabular
              aria-label="Sign out"
            >
              ⏻
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

export type TopBarTab = Tab;
