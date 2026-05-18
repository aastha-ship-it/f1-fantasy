import Link from "next/link";
import { TrackDiagram } from "@/components/TrackDiagram";
import { ScoringLegend } from "@/components/ScoringLegend";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { formatDateRange } from "@/lib/design/dateRange";
import { formatLocal } from "@/lib/sessionLabel";
import type { LobbyWeekend, LobbySession } from "@/lib/lobby/loadLobby";

/**
 * Lobby — weekend lock roster + progressive pick reveal (changes.md §1).
 * Presentational only; all gating happened in loadLobbyWeekend.
 */

function phaseLabel(s: LobbySession): string {
  if (!s.progressive) return "Lock status only";
  if (s.sessionOver) return "P3 + P2 revealed · P1 in the Reveal";
  if (s.showP2) return "P3 + P2 revealed";
  if (s.showP3) return "P3 revealed";
  return "Picks hidden — revealing as the session runs";
}

function SessionBlock({ s }: { s: LobbySession }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
      }}
    >
      <header
        className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 24,
              letterSpacing: "0.005em",
            }}
          >
            {s.label.toUpperCase()}
          </h2>
          <p
            className="mt-1 text-[11px] uppercase text-[color:var(--fg-muted)]"
            style={{ letterSpacing: "0.06em" }}
            data-tabular
          >
            {formatLocal(s.sessionStartAt).toUpperCase()} · {phaseLabel(s)}
          </p>
        </div>
        <span
          className="text-sm"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            color: "var(--fg-muted)",
          }}
          data-tabular
        >
          {s.lockedCount}/{s.totalCount} locked in
        </span>
      </header>

      <ul style={{ display: "grid" }}>
        {s.participants.map((p) => (
          <li
            key={p.userId}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full"
                style={{
                  background: p.locked
                    ? "var(--success)"
                    : "var(--fg-subtle)",
                }}
              />
              <span
                className="text-sm"
                style={{
                  color: p.isMe ? "var(--accent)" : "var(--fg)",
                  fontWeight: p.isMe ? 600 : 400,
                }}
              >
                {p.name}
                {p.isMe ? " (you)" : ""}
              </span>
            </span>

            <span className="flex items-center gap-2">
              {p.revealed.length > 0 ? (
                p.revealed.map((slot) => (
                  <span
                    key={slot.label}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                    }}
                  >
                    <span
                      className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                      style={{ letterSpacing: "0.1em" }}
                      data-tabular
                    >
                      {slot.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-boldonse), ui-sans-serif",
                      }}
                    >
                      {slot.code ?? "—"}
                    </span>
                  </span>
                ))
              ) : (
                <span
                  className="text-xs uppercase text-[color:var(--fg-subtle)]"
                  style={{ letterSpacing: "0.08em" }}
                  data-tabular
                >
                  {p.locked ? "Locked" : "No pick"}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {s.progressive && s.sessionOver && (
        <div className="px-5 py-4">
          <Link
            href={`/reveal/${s.eventId}`}
            className="inline-block px-4 py-2 text-[11px] uppercase"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              letterSpacing: "0.08em",
              background: "var(--accent)",
              color: "#000",
            }}
          >
            P1 &amp; final results await in the Reveal →
          </Link>
        </div>
      )}
    </section>
  );
}

export function LobbyView({
  weekend,
  prevRound,
  nextRound,
}: {
  weekend: LobbyWeekend;
  prevRound: number | null;
  nextRound: number | null;
}) {
  const meta = circuitMeta(weekend.ergastCircuitId ?? weekend.circuit);
  const short = shortEventName(weekend.name);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <div className="mb-6 flex items-center justify-between text-xs uppercase text-[color:var(--fg-muted)]">
        <span data-tabular style={{ letterSpacing: "0.12em" }}>
          {prevRound != null ? (
            <Link
              href={`/dashboard/lobby/round/${prevRound}`}
              className="hover:text-[color:var(--accent)]"
            >
              ← Round {String(prevRound).padStart(2, "0")}
            </Link>
          ) : (
            <span className="opacity-40">← Round</span>
          )}
        </span>
        <Link
          href={`/dashboard/predict/round/${weekend.round}`}
          className="hover:text-[color:var(--accent)]"
          data-tabular
          style={{ letterSpacing: "0.12em" }}
        >
          Make / edit picks →
        </Link>
        <span data-tabular style={{ letterSpacing: "0.12em" }}>
          {nextRound != null ? (
            <Link
              href={`/dashboard/lobby/round/${nextRound}`}
              className="hover:text-[color:var(--accent)]"
            >
              Round {String(nextRound).padStart(2, "0")} →
            </Link>
          ) : (
            <span className="opacity-40">Round →</span>
          )}
        </span>
      </div>

      <section className="grid items-end gap-12 border-b border-[color:var(--border)] pb-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p
            className="mb-3 flex items-center gap-2 text-xs uppercase text-[color:var(--accent)]"
            style={{ letterSpacing: "0.18em" }}
            data-tabular
          >
            <span
              aria-hidden
              className="inline-block size-2 rounded-full bg-[color:var(--accent)]"
            />
            Round {String(weekend.round).padStart(2, "0")} ·{" "}
            {weekend.hasSprint ? "Sprint weekend" : "Race weekend"} · Lobby
          </p>
          <h1
            className="m-0"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: "clamp(48px, 6vw, 76px)",
              lineHeight: 0.9,
              letterSpacing: "-0.015em",
            }}
          >
            {short.toUpperCase()}
            <br />
            <span className="text-[color:var(--fg-muted)]">GRAND PRIX</span>
          </h1>
          <p
            className="mt-4 text-xs uppercase text-[color:var(--fg-muted)]"
            style={{ letterSpacing: "0.04em" }}
            data-tabular
          >
            {formatDateRange(
              weekend.weekendStart,
              weekend.weekendEnd,
            ).toUpperCase()}{" "}
            · {weekend.circuit.toUpperCase()}
            {meta && (
              <>
                {" · "}
                {meta.lengthKm.toFixed(3)} KM · {meta.laps} LAPS
              </>
            )}
          </p>
        </div>
        <div className="hidden justify-end lg:flex">
          <TrackDiagram
            circuit={weekend.ergastCircuitId ?? weekend.circuit}
            size={300}
            stroke="var(--fg-muted)"
            strokeWidth={2}
          />
        </div>
      </section>

      <div className="mt-10 grid gap-6">
        {weekend.sessions.map((s) => (
          <SessionBlock key={s.eventId} s={s} />
        ))}
      </div>

      <div className="mt-12">
        <ScoringLegend />
      </div>
    </main>
  );
}
