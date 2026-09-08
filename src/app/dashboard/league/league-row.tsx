import { teamMeta } from "@/lib/design/teams";

export type LeagueRowProps = {
  rank: number;
  userId: string;
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

type DisplayNameUser = {
  display_name: string | null;
  email: string;
};

/**
 * Moved here from page.tsx so `toLeagueRowProps` (below) can be a single,
 * fully self-contained, unit-testable derivation — the row-shaping logic
 * that produces `LeagueRowProps` (name included) now lives in one place.
 * Behavior is byte-identical to the original page.tsx helper.
 */
export function displayName(u: DisplayNameUser, isMe: boolean): string {
  if (isMe) return "You";
  return u.display_name?.trim() || u.email.split("@")[0];
}

/** Structural shape of one row in page.tsx's `ranked`/`rest` arrays — kept
 * local (rather than importing page.tsx's types) so this module has no
 * dependency on the route file. */
type RankedRow = {
  rank: number;
  userId: string;
  points: number;
  perfects: number;
  user?: {
    display_name: string | null;
    email: string;
    favorite_team: string | null;
    favorite_driver: number | null;
  };
  streak?: { current_p1_streak: number } | null;
};

/**
 * The single per-row derivation path from a `RankedRow` (+ page-level
 * context) to `LeagueRowProps`. page.tsx's `rowsData` mapper calls this —
 * and nothing else builds `LeagueRowProps` — so there is exactly one place
 * that can regress the favTeam handling below.
 *
 * `favTeam` is intentionally the RAW free-form `favorite_team` string, not
 * a pre-resolved `teamMeta(...).slug`. `LeagueRowDesktop`/`LeagueRowMobile`
 * each call `teamMeta(p.favTeam)` themselves; `teamMeta("kick")` has no
 * identity alias in `TEAM_ALIASES` (unlike every other `TeamSlug` — see
 * `src/lib/design/teams.ts`), so round-tripping through the slug here would
 * silently drop Kick Sauber/Audi favourites to "No favorite team" at every
 * breakpoint, including desktop ≥1024px. `league-row.test.tsx` asserts on
 * this function directly to guard the exact line that regressed once.
 */
export function toLeagueRowProps(
  r: RankedRow,
  ctx: {
    leaderPts: number;
    currentUserId: string | null;
    driverCodeById: Map<number, string>;
  },
): LeagueRowProps {
  const isMe = r.userId === ctx.currentUserId;
  const name = displayName(r.user!, isMe);
  return {
    rank: r.rank,
    userId: r.userId,
    name,
    initial: name.charAt(0).toUpperCase(),
    points: r.points,
    pct: ctx.leaderPts > 0 ? (r.points / ctx.leaderPts) * 100 : 0,
    favTeam: r.user!.favorite_team,
    favDriverCode: r.user!.favorite_driver
      ? ctx.driverCodeById.get(r.user!.favorite_driver) ?? null
      : null,
    perfects: r.perfects,
    streak: r.streak?.current_p1_streak ?? 0,
    isMe,
  };
}

const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/**
 * Desktop "rest of the field" league row — five-column grid (rank / avatar /
 * name+meta / progress bar / points), lifted verbatim from page.tsx. Only its
 * home changed; the grid template, font sizes and combined team/driver/PP/
 * streak meta line are byte-for-byte the original.
 */
export function LeagueRowDesktop(p: LeagueRowProps) {
  const fav = p.favTeam ? teamMeta(p.favTeam) : null;
  return (
    <div
      className="grid items-center gap-6 border-b border-[color:var(--border)] px-6 py-4 last:border-b-0"
      style={{
        gridTemplateColumns:
          "60px 40px minmax(0,1fr) minmax(120px,200px) 80px",
        background: p.isMe ? "var(--surface-2)" : "transparent",
      }}
    >
      <span
        className="leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 24,
        }}
        data-tabular
      >
        {p.rank}
      </span>
      <span
        className="grid place-items-center rounded-full"
        style={{
          width: 36,
          height: 36,
          background: "var(--surface-2)",
          border: `1px solid ${fav?.hex ?? "var(--border)"}`,
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 14,
        }}
      >
        {p.initial}
      </span>
      <div className="min-w-0">
        <p className="truncate text-base">{p.name}</p>
        <p
          className="text-[10px] uppercase"
          style={{
            color: fav?.hex ?? "var(--fg-subtle)",
            letterSpacing: "0.1em",
          }}
          data-tabular
        >
          {fav ? `Team ${fav.name}` : "No favorite team"}
          {p.favDriverCode && ` · ${p.favDriverCode}`}
          {p.perfects > 0 && ` · ${p.perfects} PP`}
          {p.streak ? ` · 🔥 ${p.streak}` : ""}
        </p>
      </div>
      <div
        className="relative h-1.5"
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
      <span
        className="text-right"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 22,
        }}
        data-tabular
      >
        {p.points}
      </span>
    </div>
  );
}

/**
 * Mobile "rest of the field" league row — 390pt fork
 * (design_handoff_mobile §6.2, canvas
 * `screens-mobile-b.jsx:MobLeagueScreen`).
 *
 * Five-column 62px summary (position / initial avatar / name + progress bar
 * / points / disclosure glyph) with the rest behind a native <details>.
 * <details> deliberately over a client component: zero JS, free keyboard and
 * screen-reader semantics, and page.tsx stays a server component.
 *
 * MOBILE TREE ONLY — no `md:` classes, same contract as `MobilePrimitives`.
 * Rendered exclusively from `LeagueMobile`, inside a `md:hidden` subtree.
 *
 * The progress bar moved OUT of the expanded panel and into the summary row:
 * the artboard puts it under the name where it is always visible, which is
 * also the only place it does any work — a bar you have to tap to see cannot
 * be compared against the row above it.
 */
export function LeagueRowMobile(p: LeagueRowProps) {
  const fav = p.favTeam ? teamMeta(p.favTeam) : null;
  const hex = fav?.hex ?? "var(--fg-subtle)";
  return (
    <details
      className="group"
      style={{ background: p.isMe ? "var(--surface-2)" : "transparent" }}
    >
      <summary
        className="grid cursor-pointer list-none items-center gap-2.5 border-b border-[color:var(--border)] px-5 group-open:border-b-0 group-open:bg-[color:var(--surface-2)] [&::-webkit-details-marker]:hidden"
        style={{
          height: 62,
          gridTemplateColumns: "24px 28px minmax(0,1fr) auto 14px",
        }}
      >
        <span
          className="leading-none"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 16,
          }}
          data-tabular
        >
          {p.rank}
        </span>
        <span
          className="grid place-items-center rounded-full"
          style={{
            width: 26,
            height: 26,
            background: "var(--surface-2)",
            border: `1px solid ${fav?.hex ?? "var(--border)"}`,
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 10,
          }}
        >
          {p.initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate" style={{ fontSize: 13, fontWeight: 500 }}>
            {p.name}
          </span>
          <span
            aria-hidden
            className="mt-[7px] block h-1"
            style={{ background: "var(--bg)" }}
          >
            <span
              className="block h-full"
              style={{ width: `${p.pct}%`, background: hex }}
            />
          </span>
        </span>
        <span data-tabular style={{ fontSize: 16 }}>
          {p.points}
        </span>
        {/* Two glyphs swapped by `group-open:`, identical to the standings
            sibling in `../standings/driver-row.tsx` on purpose; the two
            mobile disclosure rows must read the same. Must live INSIDE
            <summary> — only the first <summary> lands in <details>'s
            always-visible slot. */}
        <span
          aria-hidden
          className="leading-none group-open:hidden"
          data-tabular
          style={{ fontSize: 11, color: "var(--fg-subtle)" }}
        >
          +
        </span>
        <span
          aria-hidden
          className="hidden leading-none group-open:inline"
          data-tabular
          style={{ fontSize: 11, color: "var(--fg-subtle)" }}
        >
          −
        </span>
      </summary>

      <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-2)] px-5 pb-3.5">
        <dl
          className="grid gap-x-4 gap-y-2 pt-1"
          style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}
        >
          <Stat label="TEAM" value={fav ? fav.name.toUpperCase() : "—"} />
          <Stat label="DRIVER" value={p.favDriverCode ?? "—"} />
          <Stat
            label="PERFECT PODIUMS"
            value={String(p.perfects)}
            tabularValue
          />
          {p.streak > 0 && (
            <div className="flex items-baseline justify-between gap-2">
              <dt
                className="uppercase text-[color:var(--fg-subtle)]"
                style={{ fontSize: 9, letterSpacing: "0.1em" }}
              >
                P1 STREAK
              </dt>
              <dd data-tabular style={{ fontSize: 12 }}>
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

function Stat({
  label,
  value,
  tabularValue,
}: {
  label: string;
  value: string;
  /** Set only when `value` is numeric — Geist Mono is mandatory for
   * numerics, not for non-numeric labels/values like team or driver code. */
  tabularValue?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt
        className="uppercase text-[color:var(--fg-subtle)]"
        style={{ fontSize: 9, letterSpacing: "0.1em" }}
      >
        {label}
      </dt>
      <dd
        className="min-w-0 truncate"
        style={{ fontSize: 12 }}
        data-tabular={tabularValue || undefined}
      >
        {value}
      </dd>
    </div>
  );
}
