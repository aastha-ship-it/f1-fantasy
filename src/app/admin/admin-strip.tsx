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
    /*
      Forks at md (pattern A). Below it the strip is the handoff's 46px mono
      row (§6.3): `▣ ADMIN · THE GROUP` accent left, the admin's name right,
      nothing else. `md:` restores today's row verbatim — the accent bottom
      border that makes admin context unmistakable, the transparent ground,
      the nav tabs and the sign-out glyph. Two notes on the equivalences:
      `px-6 sm:px-8` resolved to px-8 at every width >= md (sm fires at 640),
      so `md:px-8` is byte-identical there; and `flex-wrap md:flex-nowrap`
      resolved to nowrap at every width >= md, so dropping both leaves the
      desktop row exactly as it was. `letterSpacing` is inline on each child
      and therefore unforkable — the artboard's 0.12em vs today's 0.14em is
      not worth changing the 1440 render for.
    */
    <nav className="border-b border-[color:var(--border)] bg-[color:var(--surface)] md:border-[color:var(--accent)] md:bg-transparent">
      <div className="mx-auto flex h-[46px] w-full max-w-[1600px] items-center justify-between gap-3 px-5 text-[9px] uppercase md:h-auto md:gap-6 md:px-8 md:py-4 md:text-xs lg:px-12 xl:px-16">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-[color:var(--accent)]"
          style={{ letterSpacing: "0.14em" }}
          data-tabular
        >
          <span aria-hidden>▣</span>
          {/* One <span>, not a bare text node plus a second span: in a flex
              row a text node becomes an anonymous flex ITEM, so splitting the
              season off would add a third item and an extra `gap-2` to the
              desktop strip. */}
          <span>
            Admin · The Group
            <span className="hidden md:inline"> · {CURRENT_SEASON}</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-6 text-[color:var(--fg-subtle)] md:flex">
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
            className="min-w-0 truncate text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.14em" }}
            data-tabular
          >
            {displayName ?? "Admin"}
            <span className="hidden md:inline"> · admin</span>
          </span>
          {/* Sign-out is desktop-only, matching PR-2's ruling for `TopBar`:
              on a phone it lives on /profile, reachable from the "Back to
              dashboard" link at the foot of this page. */}
          <form action={signOutAction} className="hidden md:block">
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
