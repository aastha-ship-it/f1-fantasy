import Image from "next/image";
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
  /**
   * Driver's DB row id — the desktop row's "#" subtitle historically showed
   * `s.driver.id`, not the standings position. Optional so callers/fixtures
   * that don't care about that byte-for-byte detail (e.g. tests) can omit
   * it; falls back to `pos` when absent.
   */
  id?: number;
  /**
   * Season poles / fastest laps — the mobile row's four-tile split panel
   * (design_handoff_mobile §6.1). Optional because the desktop row does not
   * render them and fixtures predate them; both default to 0.
   */
  poles?: number;
  fastestLaps?: number;
};

/**
 * Desktop driver-standings row — dense seven-column grid (pos / portrait /
 * driver / team / wins / podiums / points), lifted verbatim from page.tsx.
 * Only its home changed; template string, font sizes and the 3px
 * team-colour edge are byte-for-byte the original.
 */
export function DriverStandingsRowDesktop(p: DriverRowProps) {
  const t = teamMeta(p.team);
  return (
    <li
      className="relative grid items-center gap-3 border-b border-[color:var(--border)] py-3.5 pl-3"
      style={{
        gridTemplateColumns: "32px 56px minmax(0,1fr) 84px 48px 48px 64px",
        background: p.isLeader ? "var(--surface-2)" : "transparent",
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-2 bottom-2 w-[3px]"
        style={{ background: t?.hex ?? "var(--fg-subtle)" }}
      />
      <span
        className="leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 22,
          color: p.isLeader ? "var(--accent)" : "var(--fg)",
        }}
        data-tabular
      >
        {p.pos}
      </span>
      <DriverPortrait code={p.code} team={p.team} size={48} />
      <div className="min-w-0">
        <p
          className="truncate"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 16,
            letterSpacing: "0.02em",
          }}
        >
          {p.fullName}
        </p>
        <p
          className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.08em" }}
          data-tabular
        >
          #{p.id ?? p.pos}
          {p.country && ` · ${countryFlag(p.country)}`} · {p.gap}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {t && (
          <Image
            src={t.logoSrc}
            alt={t.name}
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
            unoptimized
          />
        )}
        <span
          className="text-[11px]"
          style={{
            color: t?.hex ?? "var(--fg-muted)",
            letterSpacing: "0.06em",
            fontWeight: 600,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
          }}
        >
          {t?.short ?? p.team.slice(0, 3).toUpperCase()}
        </span>
      </div>
      <span
        className="text-right text-sm"
        style={{
          color: p.wins > 0 ? "var(--fg)" : "var(--fg-subtle)",
        }}
        data-tabular
      >
        {p.wins}
      </span>
      <span
        className="text-right text-sm"
        style={{
          color: p.podiums > 0 ? "var(--fg)" : "var(--fg-subtle)",
        }}
        data-tabular
      >
        {p.podiums}
      </span>
      <span
        className="text-right"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 22,
        }}
        data-tabular
      >
        {p.points}
      </span>
    </li>
  );
}

/**
 * Mobile driver-standings row — 390pt fork (design_handoff_mobile §6.1,
 * canvas `screens-mobile-b.jsx:MobWorldStandingsScreen`).
 *
 * Six-column 60px summary (position / portrait / name+team / team edge /
 * points / disclosure glyph) with the season splits behind a native
 * <details>. <details> deliberately over a client component: zero JS, free
 * keyboard and screen-reader semantics, and the page stays a server
 * component.
 *
 * MOBILE TREE ONLY — carries no `md:` classes, same contract as
 * `MobilePrimitives`. It is rendered exclusively from `StandingsMobile`,
 * which lives inside a `md:hidden` subtree.
 *
 * The expanded panel is the artboard's four-tile split (Wins · Podiums ·
 * Poles · Fast lap), which replaced the previous GAP/WINS/PODIUMS/TEAM/
 * COUNTRY list: team and country moved up into the always-visible summary
 * line, and GAP is gone because the artboard does not draw it. `poles` and
 * `fastestLaps` are derived in page.tsx from the SAME `historical_results`
 * rows the season-summary strip already aggregates — no new query.
 */
export function DriverStandingsRowMobile(p: DriverRowProps) {
  const t = teamMeta(p.team);
  const hex = t?.hex ?? "var(--fg-subtle)";
  return (
    <details className="group">
      <summary
        className="grid cursor-pointer list-none items-center gap-2.5 border-b border-[color:var(--border)] px-5 group-open:border-b-0 group-open:bg-[color:var(--surface-2)] [&::-webkit-details-marker]:hidden"
        style={{
          height: 60,
          gridTemplateColumns: "24px 34px minmax(0,1fr) 3px auto 14px",
        }}
      >
        <span
          className="leading-none"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 16,
            color: p.isLeader ? "var(--accent)" : "var(--fg)",
          }}
          data-tabular
        >
          {p.pos}
        </span>
        <DriverPortrait code={p.code} team={p.team} size={30} />
        <span className="min-w-0">
          <span
            className="block truncate"
            style={{ fontSize: 13, fontWeight: 500 }}
          >
            {p.fullName}
          </span>
          <span
            className="mt-0.5 block truncate uppercase"
            data-tabular
            style={{ fontSize: 9, letterSpacing: "0.1em", color: hex }}
          >
            {t?.short ?? p.team.slice(0, 3).toUpperCase()}
            {p.country && ` · ${p.country}`}
          </span>
        </span>
        {/* 3px team-colour edge — the sanctioned exception in CLAUDE.md, and
            a grid CELL here rather than an absolutely-positioned stripe: the
            artboard puts it between the name and the points, not on the row
            edge, so it needs a track of its own. */}
        <span
          aria-hidden
          className="block"
          style={{ width: 3, height: 24, background: hex }}
        />
        <span data-tabular style={{ fontSize: 16 }}>
          {p.points}
        </span>
        {/* Two glyphs swapped by `group-open:`, matching MobDisclosureRow —
            `+`/`−` is what the artboards draw. Inside <summary> on purpose:
            only the first <summary> lands in <details>'s always-visible
            slot, so a marker outside it would vanish while collapsed. */}
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

      <dl
        className="grid gap-px border-b border-[color:var(--border)] bg-[color:var(--surface-2)] px-5 pb-4"
        style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}
      >
        {(
          [
            ["Wins", p.wins],
            ["Podiums", p.podiums],
            ["Poles", p.poles ?? 0],
            ["Fast lap", p.fastestLaps ?? 0],
          ] as const
        ).map(([label, value]) => (
          // `flex-col-reverse`, not a dd-then-dt source order: `dl > div`
          // is only valid HTML with its <dt> first, and the artboard draws
          // the numeral above its label. Order in the DOM, reversed in the
          // box.
          <div
            key={label}
            className="flex flex-col-reverse border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-2.5"
          >
            <dt
              className="mt-1 uppercase text-[color:var(--fg-subtle)]"
              data-tabular
              style={{ fontSize: 8, letterSpacing: "0.1em" }}
            >
              {label}
            </dt>
            <dd className="m-0" data-tabular style={{ fontSize: 18 }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
