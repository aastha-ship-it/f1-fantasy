/**
 * Recent Winners section (design_handoff_standings § PR-2).
 *
 * 5-up grid of 4-zone `<WinnerCard>`s replacing the previous flat
 * trophy-banner cards. The four fixed-height zones (header / GP name /
 * track / winner block) anchor the 1 px hairline divider at the same
 * y-coordinate on every card regardless of GP-name wrap or track aspect
 * ratio — the structural point of this redesign.
 *
 * Server-renderable, no client state. Data shape is pre-resolved in
 * page.tsx (no driver lookups here).
 */
import { TrackDiagram } from "@/components/TrackDiagram";
import { DriverPortrait } from "@/components/DriverPortrait";

export type WinnerCardDatum = {
  /** 1..24 — rendered zero-padded as `R{nn}` */
  round: number;
  /** Short event name, e.g. "Australia" or "Saudi Arabia" — CSS uppercases */
  gp: string;
  /** Pre-formatted server-side, e.g. "Mar 8" — CSS uppercases */
  date: string;
  /** Country flag emoji, e.g. "🇦🇺" — empty string if unmapped */
  flag: string;
  /** ISO-3 country code, e.g. "AUS" — falls back to "—" if unmapped */
  cc: string;
  /** Winner driver code, e.g. "PIA" */
  code: string;
  /** Winner last name, e.g. "Piastri" — CSS uppercases */
  lastName: string;
  /** Canonical team name from `drivers.team`, e.g. "McLaren" (used by
   *  `<DriverPortrait>` for the initial-letter avatar fallback color). */
  team: string;
  /** Team short code, e.g. "MCL" */
  teamShort: string;
  /** Team accent hex, e.g. "#FF8000" */
  teamHex: string;
  /** Jolpica circuit_id / OpenF1 short name — passed to TrackDiagram */
  track: string | null;
};

export function RecentWinners({ winners }: { winners: WinnerCardDatum[] }) {
  if (winners.length === 0) return null;
  return (
    <section className="mt-12">
      <header
        className="flex items-baseline justify-between"
        style={{ marginBottom: 20 }}
      >
        <h2
          className="m-0 uppercase"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 24,
            letterSpacing: "-0.01em",
          }}
        >
          RECENT WINNERS
        </h2>
        <p
          className="m-0 uppercase text-[color:var(--fg-subtle)]"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
          }}
          data-tabular
        >
          {`Last ${winners.length} round${winners.length === 1 ? "" : "s"} · most recent →`}
        </p>
      </header>

      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${winners.length}, 1fr)`,
          gap: 12,
        }}
      >
        {winners.map((w) => (
          <WinnerCard key={w.round} {...w} />
        ))}
      </div>
    </section>
  );
}

function WinnerCard({
  round,
  gp,
  date,
  flag,
  cc,
  code,
  lastName,
  team,
  teamShort,
  teamHex,
  track,
}: WinnerCardDatum) {
  const roundLabel = `R${String(round).padStart(2, "0")}`;
  return (
    <article
      style={{
        position: "relative",
        background: "var(--surface)",
        borderBottom: `3px solid ${teamHex}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Livery wash — decorative, never crosses below the divider visually */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(ellipse 80% 60% at 100% 0%, ${teamHex}22, transparent 70%)`,
        }}
      />

      {/* Zone 1 — header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "14px 16px 0", gap: 8, height: 28, position: "relative" }}
      >
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--fg-subtle)",
          }}
          data-tabular
        >
          {roundLabel}
        </span>
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--fg-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          data-tabular
        >
          {flag ? <span aria-hidden>{flag}</span> : null}
          {cc}
        </span>
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "var(--fg-subtle)",
          }}
          data-tabular
        >
          {date}
        </span>
      </div>

      {/* Zone 2 — GP name */}
      <div
        style={{ padding: "10px 16px 0", minHeight: 46, position: "relative" }}
      >
        <h3
          className="m-0 uppercase"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 18,
            lineHeight: 1.1,
            letterSpacing: "-0.005em",
          }}
        >
          {gp}
        </h3>
      </div>

      {/* Zone 3 — track */}
      <div
        style={{
          padding: "14px 16px 16px",
          height: 130,
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          position: "relative",
        }}
      >
        <TrackDiagram
          circuit={track}
          stroke="var(--fg-muted)"
          height={90}
          strokeWidth={1.5}
        />
      </div>

      {/* Divider — flex child so it always lands at the same y */}
      <div
        aria-hidden
        style={{
          height: 1,
          background: "var(--border)",
          margin: "0 16px",
          position: "relative",
        }}
      />

      {/* Zone 4 — winner block */}
      <div
        className="flex items-center"
        style={{
          padding: "12px 16px 14px",
          gap: 12,
          position: "relative",
        }}
      >
        <DriverPortrait code={code} team={team} size={48} />
        <div className="flex flex-col">
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 9,
              letterSpacing: "0.16em",
              color: teamHex,
              fontWeight: 600,
            }}
          >
            ★ Winner
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 17,
              letterSpacing: "0.005em",
              lineHeight: 1.05,
            }}
          >
            {lastName}
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.06em",
              color: "var(--fg-muted)",
            }}
            data-tabular
          >
            {teamShort}
          </span>
        </div>
      </div>
    </article>
  );
}
