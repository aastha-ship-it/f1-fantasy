import { teamMeta } from "@/lib/design/teams";
import { formatLapTime } from "@/lib/practice/formatLapTime";
import type { FpSession } from "@/lib/practice/loadPractice";

/**
 * Free Practice top-3 banner on the predict round page (changes.md §6).
 *
 * Read-only signal to help users lock predictions. Server-renderable.
 * Renders nothing when there's no FP data (no empty state). Matches the
 * existing P1/P2/P3 team-coloured chip idiom; Geist Mono + data-tabular for
 * all numerics; no left-border stripe, no gradient text (.impeccable.md).
 * Sprint weekends naturally show only FP1 (it's all OpenF1 exposes).
 */
export function PracticeBanner({ sessions }: { sessions: FpSession[] }) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <section
      className="mt-8"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "var(--space-lg)",
      }}
    >
      <h2
        className="mb-1"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif",
          fontSize: 14,
          letterSpacing: "0.02em",
        }}
      >
        FREE PRACTICE — FORM GUIDE
      </h2>
      <p className="mb-4 text-xs" style={{ color: "var(--fg-subtle)" }}>
        Fastest three per session. A signal for your picks — not scored.
      </p>

      <div style={{ display: "grid", gap: "var(--space-md)" }}>
        {sessions.map((s) => (
          <div
            key={s.fpIndex}
            className="flex flex-wrap items-center gap-3"
          >
            <span
              className="w-10 shrink-0 text-xs uppercase"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                color: "var(--fg-subtle)",
                letterSpacing: "0.1em",
              }}
              data-tabular
            >
              {s.label}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {s.top3.map((e) => {
                const t = teamMeta(e.team);
                return (
                  <span
                    key={e.pos}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs"
                    style={{
                      background: t?.hex
                        ? `${t.hex}22`
                        : "var(--surface-2)",
                      border: t?.hex
                        ? `1px solid ${t.hex}66`
                        : "1px solid var(--border)",
                      color: "var(--fg)",
                    }}
                  >
                    <span
                      className="text-[10px] uppercase"
                      style={{ letterSpacing: "0.1em" }}
                      data-tabular
                    >
                      P{e.pos}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-boldonse), ui-sans-serif",
                      }}
                    >
                      {e.code}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{
                        fontFamily:
                          "var(--font-mono), ui-monospace, monospace",
                        color: "var(--fg-muted)",
                      }}
                      data-tabular
                    >
                      {formatLapTime(e.lapSeconds)}
                    </span>
                  </span>
                );
              })}
              {s.source === "admin" && (
                <span
                  className="text-[10px] uppercase"
                  style={{
                    color: "var(--fg-subtle)",
                    letterSpacing: "0.1em",
                  }}
                  data-tabular
                >
                  admin
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
