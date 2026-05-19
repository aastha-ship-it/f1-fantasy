/**
 * Systematic explainer for the point system (changes.md §4 + §5 + §8).
 *
 * `ScoringLegendBody` is pure presentational JSX (no hooks / no server-only
 * imports) so it renders fine inside the client `ScoringHelp` modal. It is
 * the single source of the scoring content, surfaced via the global
 * "How Scoring Works" TopBar modal.
 *
 * Design rules honoured: Geist Mono for every numeric, design tokens only,
 * no left-border accent stripes, no gradient text.
 */

type Row = { outcome: string; points: string; accent?: boolean };

const PODIUM_ROWS: Row[] = [
  { outcome: "Driver predicted in its exact slot", points: "+5 each" },
  { outcome: "Perfect podium — all three exact", points: "+3 bonus", accent: true },
  { outcome: "1 of your drivers on the podium (wrong slot)", points: "1" },
  { outcome: "2 of your drivers on the podium (wrong slot)", points: "2" },
  { outcome: "3 of your drivers on the podium (wrong slot)", points: "4" },
  { outcome: "Driver finishes off the podium", points: "0" },
];

const WORKED: Row[] = [
  { outcome: "1 exact + 1 other on podium (wrong slot)", points: "5 + 1 = 6" },
  { outcome: "1 exact + 2 others on podium (wrong slot)", points: "5 + 2 = 7" },
  { outcome: "Perfect podium — all three exact (+ bonus)", points: "5×3 + 3 = 18", accent: true },
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
    <dl style={{ display: "grid", gap: "var(--space-sm)", margin: 0 }}>
      {rows.map((r) => (
        <div
          key={r.outcome}
          className="flex items-baseline justify-between gap-[var(--space-lg)]"
          style={{
            paddingBottom: "var(--space-sm)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <dt style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>
            {r.outcome}
          </dt>
          <dd style={{ margin: 0 }}>
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
    <section>
      <h3
        style={{
          fontFamily: "var(--font-display), ui-sans-serif",
          fontSize: 13,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 12,
          color: "var(--fg-subtle)",
          margin: "var(--space-xs) 0 var(--space-lg)",
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>
      <RowList rows={rows} />
    </section>
  );
}

export function ScoringLegendBody() {
  return (
    <div style={{ display: "grid", gap: "var(--space-2xl)" }}>
      <Section
        title="Race & Qualifying"
        subtitle="Predict the top three. Every driver scores independently — then a non-linear bucket rewards getting the whole podium even when jumbled."
        rows={PODIUM_ROWS}
      />
      <Section
        title="Worked examples"
        subtitle="How the pieces add up across one podium prediction."
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
      <p
        style={{
          fontSize: 12,
          color: "var(--fg-subtle)",
          lineHeight: 1.5,
        }}
      >
        “On the podium” means the driver finished top three — just not in the
        slot you predicted. A driver who finishes off the podium scores nothing
        for that slot. Max for a race/quali session is{" "}
        <Num accent>18</Num>.
      </p>
    </div>
  );
}

