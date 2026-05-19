import { teamMeta } from "@/lib/design/teams";
import { DriverPortrait } from "@/components/DriverPortrait";
import { lapCell } from "@/lib/practice/lapCell";
import type { FpSession } from "@/lib/practice/loadPractice";

/**
 * Free Practice top-3 banner on the predict round page (changes.md §6 /
 * design_handoff_phase11 §6). Read-only signal to help users lock picks.
 *
 * Server-renderable; renders nothing when there's no FP data (no empty
 * state). Framed banner: a header strip + an N-column session grid (1 on
 * sprint weekends — OpenF1 only exposes FP1 — else 3). Per §6 there is **no
 * footer**. Lap cell is decided by the pure `lapCell` helper so the
 * absolute / +gap / OVR / Awaiting variants stay locked. Geist Mono +
 * `data-tabular` for every numeric; team-colour left border on rows is the
 * sanctioned prediction-card idiom (`.impeccable.md`).
 */
export function PracticeBanner({ sessions }: { sessions: FpSession[] }) {
  if (!sessions || sessions.length === 0) return null;
  const sprintWeekend = sessions.length <= 1;

  return (
    <section
      style={{
        marginBottom: "var(--space-3xl)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <header
        className="flex items-center justify-between"
        style={{
          padding: "var(--space-md) var(--space-xl)",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <div className="flex items-center" style={{ gap: "var(--space-md)" }}>
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 14,
              letterSpacing: "0.04em",
            }}
          >
            Free Practice · pace check
          </span>
          <span
            className="uppercase text-[color:var(--fg-subtle)]"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 9,
              letterSpacing: "0.14em",
              padding: "3px 8px",
              border: "1px solid var(--border)",
            }}
            data-tabular
          >
            Source: OpenF1
          </span>
        </div>
        <span
          className="text-[color:var(--fg-muted)]"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.06em",
          }}
          data-tabular
        >
          {sprintWeekend
            ? "Sprint weekend · FP1 only"
            : "Top-3 fastest · use to gauge form before locking"}
        </span>
      </header>

      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${sessions.length}, 1fr)`,
          gap: 1,
          background: "var(--border)",
        }}
      >
        {sessions.map((s) => {
          const leader = s.top3[0]?.lapSeconds ?? null;
          return (
            <div
              key={s.fpIndex}
              style={{
                background: "var(--surface)",
                padding: "var(--space-xl)",
              }}
            >
              <div
                className="flex items-baseline justify-between"
                style={{
                  marginBottom: "var(--space-md)",
                  paddingBottom: "var(--space-sm)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    fontSize: 13,
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </span>
                {s.startLabel && (
                  <span
                    className="uppercase text-[color:var(--fg-subtle)]"
                    style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                    }}
                    data-tabular
                  >
                    {s.startLabel.toUpperCase()}
                  </span>
                )}
              </div>

              <ul
                className="m-0 grid list-none p-0"
                style={{ gap: "var(--space-sm)" }}
              >
                {s.top3.map((p) => {
                  const t = teamMeta(p.team);
                  const cell = lapCell(
                    { pos: p.pos, lapSeconds: p.lapSeconds },
                    leader,
                    s.source,
                  );
                  return (
                    <li
                      key={p.pos}
                      className="grid items-center"
                      style={{
                        gridTemplateColumns: "32px auto 1fr auto",
                        gap: "var(--space-md)",
                        padding: "6px 10px",
                        background: "var(--surface-2)",
                        borderLeft: `3px solid ${t?.hex ?? "var(--border)"}`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: 20,
                          color: p.pos === 1 ? "var(--accent)" : "var(--fg)",
                        }}
                      >
                        P{p.pos}
                      </span>
                      <DriverPortrait code={p.code} team={p.team} size={28} />
                      <span
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: 14,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {p.code}
                      </span>
                      <span
                        className="text-right"
                        style={{
                          fontFamily:
                            "var(--font-mono), ui-monospace, monospace",
                          fontSize: 11,
                          color:
                            cell.kind === "awaiting"
                              ? "var(--fg-subtle)"
                              : "var(--fg-muted)",
                        }}
                        data-tabular
                      >
                        {cell.kind === "time" ? cell.text : "—"}
                        {cell.kind === "ovr" && (
                          <span
                            className="uppercase"
                            style={{
                              marginLeft: 6,
                              color: "var(--warning)",
                              fontSize: 9,
                              letterSpacing: "0.1em",
                            }}
                          >
                            OVR
                          </span>
                        )}
                        {cell.kind === "awaiting" && (
                          <span
                            className="uppercase"
                            style={{
                              marginLeft: 6,
                              color: "var(--fg-subtle)",
                              fontSize: 9,
                              letterSpacing: "0.1em",
                            }}
                          >
                            Awaiting
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
