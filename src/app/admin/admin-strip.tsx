import Link from "next/link";
import { signOutAction } from "@/app/signout/actions";

/**
 * Admin top strip — distinct from the player TopBar so admin context is
 * visually unmistakable. Bottom border in accent red. Lifted from
 * `design/screens-aux.jsx:AdminScreen`.
 */
type Tab = "events" | "cron" | "logs";

const TABS: { id: Tab; label: string; href?: string }[] = [
  { id: "events", label: "Events", href: "/admin" },
  // Cron status + Logs aren't built yet; render as disabled labels for parity
  // with the canvas without dead links to nowhere.
  { id: "cron", label: "Cron status" },
  { id: "logs", label: "Logs" },
];

const CURRENT_SEASON = new Date().getUTCFullYear();

export function AdminStrip({
  current,
  displayName,
}: {
  current: Tab;
  displayName: string | null;
}) {
  return (
    <nav className="border-b border-[color:var(--accent)]">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-6 px-6 py-4 text-xs uppercase sm:px-8 lg:px-12 xl:px-16">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-[color:var(--accent)]"
          style={{ letterSpacing: "0.14em" }}
          data-tabular
        >
          <span aria-hidden>▣</span>
          Admin · The Group · {CURRENT_SEASON}
        </Link>

        <ul className="flex items-center gap-6 text-[color:var(--fg-subtle)]">
          {TABS.map((t) =>
            t.href ? (
              <li key={t.id}>
                <Link
                  href={t.href}
                  className={
                    t.id === current
                      ? "text-[color:var(--fg)]"
                      : "text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-muted)]"
                  }
                  style={{ letterSpacing: "0.14em" }}
                  data-tabular
                >
                  {t.label}
                </Link>
              </li>
            ) : (
              <li key={t.id}>
                <span
                  className="text-[color:var(--fg-subtle)] opacity-60"
                  style={{ letterSpacing: "0.14em" }}
                  data-tabular
                  title="Not built yet"
                >
                  {t.label}
                </span>
              </li>
            ),
          )}
        </ul>

        <div className="flex items-center gap-4">
          <span
            className="text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.14em" }}
            data-tabular
          >
            {displayName ?? "Admin"} · admin
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-muted)]"
              style={{ letterSpacing: "0.14em" }}
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
