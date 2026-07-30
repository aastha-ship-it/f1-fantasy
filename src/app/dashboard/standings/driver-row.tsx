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
 * Mobile driver-standings row — four columns you actually scan (position,
 * portrait, name, points) with everything else behind a native <details>.
 * <details> deliberately over a client component: zero JS, free keyboard
 * and screen-reader semantics, and page.tsx stays a server component.
 */
export function DriverStandingsRowMobile(p: DriverRowProps) {
  const t = teamMeta(p.team);
  return (
    <details
      className="border-b border-[color:var(--border)]"
      style={{ background: p.isLeader ? "var(--surface-2)" : "transparent" }}
    >
      <summary
        className="relative grid cursor-pointer list-none items-center gap-3 py-3 pl-3 pr-4 [&::-webkit-details-marker]:hidden"
        style={{ gridTemplateColumns: "28px 40px minmax(0,1fr) auto" }}
      >
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-0 w-[3px]"
          style={{ background: t?.hex ?? "var(--fg-subtle)" }}
        />
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

      <div className="relative">
        {/* Second segment of the team-colour edge — <summary>'s stripe only
            covers the always-visible slot, so the expanded <dl> panel (only
            rendered into the disclosure-content region while open) needs its
            own segment to keep the edge running down the full expanded row,
            not just alongside the collapsed summary. */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-2 w-[3px]"
          style={{ background: t?.hex ?? "var(--fg-subtle)" }}
        />
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
      </div>
    </details>
  );
}
