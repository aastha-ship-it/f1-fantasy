import { teamMeta } from "@/lib/design/teams";
import { DriverPortrait } from "@/components/DriverPortrait";
import { lapCell } from "@/lib/practice/lapCell";
import type { FpSession } from "@/lib/practice/loadPractice";

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";
const MONO_FONT = "var(--font-mono), ui-monospace, monospace";

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
 *
 * Mobile fork (addendum §B) is pattern A throughout — every value that
 * differs across the 780px fork moved out of the inline `style` into a
 * `base md:` class pair, because an inline declaration wins over any
 * breakpoint. `fontFamily`, `letterSpacing` and computed colours are the
 * same at both widths and stay inline. Padding is always forked with the
 * *same* utility on both sides (`pt-… md:pt-…`, never `pt-… md:py-…`):
 * Tailwind sorts the shorter form first, so a base longhand would outlive
 * an `md:` shorthand and silently survive above the fork.
 */
export function PracticeBanner({ sessions }: { sessions: FpSession[] }) {
  if (!sessions || sessions.length === 0) return null;
  const sprintWeekend = sessions.length <= 1;

  return (
    // No bottom margin below the fork: on the round page the banner is
    // followed by the "Sessions" section head, whose own `mt-6` is the 24px
    // the artboard draws. Keeping `--space-3xl` here too would double-count
    // to 72px.
    <section
      className="mb-0 md:mb-[var(--space-3xl)]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      {/* Header — one `justify-between` row at `md:`, two stacked lines
          below it. At 390 the single row collides: the `Source: OpenF1`
          chip and the right-hand context line overlap. */}
      <header
        className="pt-[10px] pr-[14px] pb-[11px] pl-[14px] md:flex md:items-center md:justify-between md:pt-[var(--space-md)] md:pr-[var(--space-xl)] md:pb-[var(--space-md)] md:pl-[var(--space-xl)]"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <div className="flex flex-wrap items-center gap-[8px] md:flex-nowrap md:gap-[var(--space-md)]">
          <span
            className="uppercase text-[12px] md:text-[14px]"
            style={{
              fontFamily: DISPLAY_FONT,
              letterSpacing: "0.04em",
            }}
          >
            Free Practice · pace check
          </span>
          <span
            className="uppercase px-[7px] py-[3px] text-[8px] text-[color:var(--fg-subtle)] md:px-[8px] md:py-[3px] md:text-[9px]"
            style={{
              fontFamily: MONO_FONT,
              letterSpacing: "0.14em",
              border: "1px solid var(--border)",
            }}
            data-tabular
          >
            Source: OpenF1
          </span>
        </div>
        {/* `block` + `mt-[6px]` is the second line below the fork; at `md:`
            the margin goes back to 0 and the span is a flex item again,
            which blockifies it anyway — so `block` is inert there. */}
        <span
          className="mt-[6px] block text-[9px] text-[color:var(--fg-muted)] md:mt-0 md:text-[11px]"
          style={{
            fontFamily: MONO_FONT,
            letterSpacing: "0.06em",
          }}
          data-tabular
        >
          {sprintWeekend
            ? "Sprint weekend · FP1 only"
            : "Top-3 fastest · use to gauge form before locking"}
        </span>
      </header>

      {/*
        Session count is data-driven (1 on a sprint weekend, else 3), so the
        template cannot be a static Tailwind class. Keep the count in a CSS
        custom property and consume it only at `md:` — below the 780px fork
        the sessions stack one per row instead of being clipped by the
        section's `overflow: hidden`.
      */}
      <div
        className="grid grid-cols-1 md:[grid-template-columns:repeat(var(--fp-cols),1fr)]"
        style={
          {
            gap: 1,
            background: "var(--border)",
            "--fp-cols": sessions.length,
          } as React.CSSProperties
        }
      >
        {sessions.map((s) => {
          const leader = s.top3[0]?.lapSeconds ?? null;
          return (
            <div
              key={s.fpIndex}
              className="p-[12px] md:p-[var(--space-xl)]"
              style={{ background: "var(--surface)" }}
            >
              <div
                className="mb-[10px] flex items-baseline justify-between gap-[8px] md:mb-[var(--space-md)] md:gap-0"
                style={{
                  paddingBottom: "var(--space-sm)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {/* Full label ("Free Practice 1"), never abbreviated to FP1
                    — addendum §B "Things that will drift". */}
                <span
                  className="uppercase text-[12px] md:text-[13px]"
                  style={{
                    fontFamily: DISPLAY_FONT,
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </span>
                {s.startLabel && (
                  <span
                    className="uppercase text-[9px] text-[color:var(--fg-subtle)] md:text-[10px]"
                    style={{
                      fontFamily: MONO_FONT,
                      letterSpacing: "0.08em",
                    }}
                    data-tabular
                  >
                    {s.startLabel.toUpperCase()}
                  </span>
                )}
              </div>

              <ul className="m-0 grid list-none gap-[5px] p-0 md:gap-[var(--space-sm)]">
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
                      // minmax(0,1fr) for the code column so that under width
                      // pressure the *flexible* track shrinks — with a bare
                      // `1fr` the browser instead squeezes the `auto` portrait
                      // track (measured: 28px -> 0px at 375px, 28px -> 22.72px
                      // at 780px). Kept in BOTH templates: the two resolve
                      // identically whenever the flexible track has slack, so
                      // the original buys nothing at desktop while reinstating
                      // the squeeze across the whole 780-1023px band, which no
                      // e2e project covers.
                      className="grid grid-cols-[26px_auto_minmax(0,1fr)_auto] items-center gap-[10px] md:grid-cols-[32px_auto_minmax(0,1fr)_auto] md:gap-[var(--space-md)]"
                      style={{
                        padding: "6px 10px",
                        background: "var(--surface-2)",
                        borderLeft: `3px solid ${t?.hex ?? "var(--border)"}`,
                      }}
                    >
                      <span
                        className="text-[17px] md:text-[20px]"
                        style={{
                          fontFamily: DISPLAY_FONT,
                          color: p.pos === 1 ? "var(--accent)" : "var(--fg)",
                        }}
                      >
                        P{p.pos}
                      </span>
                      {/* B′ — `DriverPortrait` writes `size` to inline
                          width/height, which no class can override, so the
                          two sizes are two elements. `md:contents` erases
                          the desktop wrapper's box at the fork, leaving the
                          portrait a direct grid child exactly as today. */}
                      <div className="hidden md:contents">
                        <DriverPortrait code={p.code} team={p.team} size={28} />
                      </div>
                      <div className="shrink-0 md:hidden">
                        <DriverPortrait code={p.code} team={p.team} size={26} />
                      </div>
                      <span
                        className="text-[13px] md:text-[14px]"
                        style={{
                          fontFamily: DISPLAY_FONT,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {p.code}
                      </span>
                      <span
                        className="text-right text-[10px] md:text-[11px]"
                        style={{
                          fontFamily: MONO_FONT,
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
                            className="uppercase ml-[5px] text-[8px] md:ml-[6px] md:text-[9px]"
                            style={{
                              color: "var(--warning)",
                              letterSpacing: "0.1em",
                            }}
                          >
                            OVR
                          </span>
                        )}
                        {cell.kind === "awaiting" && (
                          <span
                            className="uppercase ml-[5px] text-[8px] md:ml-[6px] md:text-[9px]"
                            style={{
                              color: "var(--fg-subtle)",
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
