/**
 * Systematic explainer for the point system (changes.md §4 + §5).
 *
 * Server-renderable (no client JS). `collapsible` wraps it in a native
 * <details> so it can sit unobtrusively on the Predict screen; the Lobby
 * tab renders it expanded.
 *
 * Design rules honoured: Geist Mono for every numeric, design tokens only,
 * no left-border accent stripes, no gradient text.
 */

type Row = { outcome: string; points: string; accent?: boolean };

const PODIUM_ROWS: Row[] = [
  { outcome: "Driver predicted in its exact slot", points: "+5 each" },
  { outcome: "Perfect podium — all three exact", points: "+3 bonus", accent: true },
  { outcome: "1 of your drivers on the podium, wrong slot", points: "1" },
  { outcome: "2 of your drivers on the podium, wrong slot", points: "2" },
  { outcome: "3 of your drivers on the podium, wrong slot", points: "4" },
  { outcome: "Driver finishes off the podium", points: "0" },
];

const WORKED: Row[] = [
  { outcome: "1 exact + 1 other on podium (wrong slot)", points: "5 + 1 = 6" },
  { outcome: "1 exact + 2 others on podium (wrong slot)", points: "5 + 2 = 7" },
  { outcome: "Perfect podium (3 exact + bonus)", points: "5×3 + 3 = 18", accent: true },
];

function Num({ children, accent }: { children: string; accent?: boolean }) {
  return (
    <span
      data-tabular
      style={{
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontWeight: 600,
        color: accent ? "var(--accent)" : "var(--fg)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function RowList({ rows }: { rows: Row[] }) {
  return (
    <dl style={{ display: "grid", gap: "var(--space-sm)" }}>
      {rows.map((r) => (
        <div
          key={r.outcome}
          className="flex items-baseline justify-between gap-4"
          style={{
            paddingBottom: "var(--space-sm)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <dt
            className="text-sm"
            style={{ color: "var(--fg-muted)" }}
          >
            {r.outcome}
          </dt>
          <dd>
            <Num accent={r.accent}>{r.points}</Num>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
}) {
  return (
    <section style={{ display: "grid", gap: "var(--space-md)" }}>
      <div>
        <h3
          style={{
            fontFamily: "var(--font-display), ui-sans-serif",
            fontSize: 14,
            letterSpacing: "0.02em",
          }}
        >
          {title.toUpperCase()}
        </h3>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          {subtitle}
        </p>
      </div>
      <RowList rows={rows} />
    </section>
  );
}

function Body() {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-xl)",
        padding: "var(--space-lg)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
      }}
    >
      <Section
        title="Race & Qualifying"
        subtitle="Predict the top three. Every driver scores independently."
        rows={PODIUM_ROWS}
      />
      <Section
        title="Worked examples"
        subtitle="How the pieces add up across a single podium prediction."
        rows={WORKED}
      />
      <Section
        title="Sprint & Sprint Qualifying"
        subtitle="Predict P1 only."
        rows={[
          { outcome: "Correct winner", points: "5" },
          { outcome: "Wrong winner", points: "0" },
        ]}
      />
      <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        “On the podium” means the driver finished top three — just not in the
        slot you predicted. A driver who finishes off the podium scores nothing
        for that slot. Maximum for a race or qualifying session is{" "}
        <Num accent>18</Num>.
      </p>
    </div>
  );
}

export function ScoringLegend({
  collapsible = false,
}: {
  collapsible?: boolean;
}) {
  if (!collapsible) return <Body />;
  return (
    <details
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
      }}
    >
      <summary
        className="cursor-pointer select-none px-4 py-3 text-sm"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif",
          letterSpacing: "0.02em",
        }}
      >
        HOW SCORING WORKS
      </summary>
      <div style={{ padding: "0 var(--space-xs) var(--space-xs)" }}>
        <Body />
      </div>
    </details>
  );
}
