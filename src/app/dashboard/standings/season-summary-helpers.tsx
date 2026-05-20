/**
 * Season summary — five tile primitives (design_handoff_standings § PR-1).
 *
 * Pure presentational components, server-renderable. The helpers take
 * pre-resolved data (driver codes + team hexes already looked up by the
 * caller) so they never need access to the drivers map. Match the design
 * canvas anatomy verbatim — no border-radius anywhere, every numeric is
 * Geist Mono `data-tabular`, only S05 deviates from default `valueColor`.
 */
import type { ReactNode } from "react";

type Hex = string;

export type ChipDatum = {
  code: string;
  count: number;
  hex: Hex;
};

export type FlRoundDatum = {
  /** Round label, e.g. "R01" */
  r: string;
  /** Driver 3-letter code, e.g. "PIA" */
  code: string;
  /** Team accent hex, e.g. "#FF8000" */
  hex: Hex;
};

/* ---------- StatTile shell ---------- */

export function StatTile({
  index,
  label,
  value,
  valueSuffix,
  valueColor,
  children,
}: {
  index: number;
  label: string;
  value: string;
  valueSuffix?: string;
  valueColor?: string;
  children: ReactNode;
}) {
  const chip = `S${String(index).padStart(2, "0")}`;
  return (
    <div
      style={{
        background: "var(--surface)",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 184,
      }}
    >
      <div
        className="flex items-start justify-between"
        style={{ gap: 12 }}
      >
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--fg-subtle)",
            margin: 0,
          }}
          data-tabular
        >
          {label}
        </p>
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: "0.12em",
            padding: "2px 6px",
            border: "1px solid var(--border)",
            color: "var(--fg-subtle)",
          }}
          data-tabular
        >
          {chip}
        </span>
      </div>

      <div
        className="flex items-baseline"
        style={{ gap: 8 }}
      >
        <span
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 56,
            lineHeight: 0.9,
            color: valueColor ?? "var(--fg)",
          }}
          data-tabular
        >
          {value}
        </span>
        {valueSuffix ? (
          <span
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 13,
              color: "var(--fg-subtle)",
              letterSpacing: "0.06em",
            }}
            data-tabular
          >
            {valueSuffix}
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: "auto" }}>{children}</div>
    </div>
  );
}

/* ---------- ProgressPips (S01) ---------- */

export function ProgressPips({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const pips = Array.from({ length: total }, (_, i) => i);
  return (
    <div className="flex flex-wrap" style={{ gap: 2 }}>
      {pips.map((i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 6,
            height: 12,
            background:
              i < done ? "var(--accent)" : "var(--surface-2)",
            border: i < done ? "none" : "1px solid var(--border)",
          }}
        />
      ))}
    </div>
  );
}

/* ---------- DriverChips (S02 + S03) ---------- */

export function DriverChips({ chips }: { chips: ChipDatum[] }) {
  if (chips.length === 0) {
    return (
      <p
        className="text-[color:var(--fg-subtle)]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.06em",
          margin: 0,
        }}
        data-tabular
      >
        —
      </p>
    );
  }
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {chips.map((c) => (
        <span
          key={c.code}
          className="inline-flex items-center"
          style={{
            gap: 4,
            padding: "3px 8px",
            border: `1px solid ${c.hex}`,
            background: `color-mix(in oklch, ${c.hex} 12%, transparent)`,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--fg)",
            }}
            data-tabular
          >
            {c.code}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 10,
              color: "var(--fg-subtle)",
            }}
            data-tabular
          >
            ×{c.count}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ---------- FastestLapRow (S04) ---------- */

export function FastestLapRow({ rounds }: { rounds: FlRoundDatum[] }) {
  if (rounds.length === 0) {
    return (
      <p
        className="text-[color:var(--fg-subtle)]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.06em",
          margin: 0,
        }}
        data-tabular
      >
        —
      </p>
    );
  }
  return (
    <div className="flex" style={{ gap: 4 }}>
      {rounds.map((r, i) => (
        <div
          key={`${r.r}-${i}`}
          className="flex flex-col"
          style={{
            flex: 1,
            padding: "4px 5px",
            background: "var(--surface-2)",
            borderTop: `2px solid ${r.hex}`,
          }}
        >
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 8,
              letterSpacing: "0.08em",
              color: "var(--fg-subtle)",
            }}
            data-tabular
          >
            {r.r}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--fg)",
            }}
            data-tabular
          >
            {r.code}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- RateGauge (S05) ---------- */

export function RateGauge({
  value,
  max,
  suffix,
}: {
  value: number;
  max: number;
  suffix: string;
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <div
        style={{
          height: 6,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: "var(--warning)",
          }}
        />
      </div>
      <p
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 11,
          color: "var(--fg-muted)",
          letterSpacing: "0.04em",
          margin: 0,
        }}
        data-tabular
      >
        {value.toFixed(1)} {suffix}
      </p>
    </div>
  );
}
