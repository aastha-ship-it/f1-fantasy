import Link from "next/link";
import { F1Mark } from "@/components/F1Mark";
import { signOutAction } from "@/app/signout/actions";

/**
 * Top navigation bar — used on every authenticated screen.
 *
 * Design canvas reference: `design/screens-auth.jsx:TopBar`. Layout:
 *   F1Mark | nav tabs ............................. season label · user · ⏻
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

const CURRENT_SEASON = new Date().getUTCFullYear();

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
    <nav className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-8 px-6 py-4 sm:px-8 lg:px-12 xl:px-16">
        <Link
          href="/dashboard"
          aria-label="F1 Fantasy"
          className="flex items-center text-[color:var(--fg)]"
        >
          <F1Mark height={22} />
        </Link>

        <ul className="flex flex-1 items-center gap-1 text-xs uppercase tracking-[0.12em]">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={t.href}
                className={
                  t.id === active
                    ? "border-b-2 border-[color:var(--accent)] px-3 pb-3 -mb-4 pt-3 text-[color:var(--fg)]"
                    : "border-b-2 border-transparent px-3 pb-3 -mb-4 pt-3 text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-muted)]"
                }
                data-tabular
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          <span
            className="hidden text-xs uppercase tracking-[0.1em] text-[color:var(--fg-subtle)] sm:inline"
            data-tabular
          >
            The Group · {CURRENT_SEASON}
          </span>
          <Link
            href="/profile"
            aria-label="Profile"
            className={`flex size-9 items-center justify-center rounded-full border text-sm ${
              active === "profile"
                ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                : "border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--fg-muted)]"
            }`}
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            {initial}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.12em] text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-muted)]"
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
