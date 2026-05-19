import Link from "next/link";
import { TrackDiagram } from "@/components/TrackDiagram";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { formatDateRange } from "@/lib/design/dateRange";
import { formatLocal } from "@/lib/sessionLabel";
import type { LobbyWeekend } from "@/lib/lobby/loadLobby";
import { LobbySessions, type LobbySessionView } from "./lobby-sessions";

/**
 * Lobby — weekend lock roster + progressive pick reveal (changes.md §1).
 *
 * design_handoff_phase11 §1/§2 redesign. SERVER component: the hero +
 * timezone-sensitive `formatLocal`/`formatDateRange` run once on the server
 * (no hydration). The interactive expand/collapse lives in the
 * `LobbySessions` client island, which receives the session time already
 * formatted as a string (`timeLabel`) so SSR and client hydrate identically.
 */
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
  const sessions: LobbySessionView[] = weekend.sessions.map((s) => ({
    ...s,
    timeLabel: formatLocal(s.sessionStartAt).toUpperCase(),
  }));

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

      <LobbySessions sessions={sessions} />
    </main>
  );
}
