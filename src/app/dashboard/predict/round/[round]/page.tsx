import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { teamMeta } from "@/lib/design/teams";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { formatDateRange } from "@/lib/design/dateRange";
import { sessionLabel, formatLocal } from "@/lib/sessionLabel";
import {
  groupByRound,
  type GroupableEvent,
} from "@/lib/predict/groupByRound";

type EventRow = GroupableEvent;

type DriverRow = { id: number; code: string; team: string };
type PredictionRow = {
  event_id: string;
  p1_driver_id: number | null;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};

function formatDelta(msUntil: number): string {
  if (msUntil <= 0) return "Locked";
  const totalSec = Math.floor(msUntil / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours.toString().padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

export default async function PredictRoundPage({
  params,
}: {
  params: Promise<{ round: string }>;
}) {
  const { round: roundStr } = await params;
  const round = Number(roundStr);
  if (!Number.isFinite(round) || round < 1) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const myId = userData.user?.id ?? null;
  let myDisplayName: string | null = null;
  if (myId) {
    const { data: me } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", myId)
      .maybeSingle<{ display_name: string | null }>();
    myDisplayName = me?.display_name?.trim() ?? null;
    if (!myDisplayName) redirect("/profile?welcome=1");
  }

  const currentSeason = new Date().getUTCFullYear();
  const { data: roundSessions } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, lock_at, revealed_at, ergast_circuit_id",
    )
    .eq("season", currentSeason)
    .eq("round", round)
    .order("session_start_at", { ascending: true })
    .returns<EventRow[]>();

  if (!roundSessions || roundSessions.length === 0) notFound();

  const [grouped] = groupByRound(roundSessions, "asc");
  if (!grouped) notFound();

  const sessionIds = grouped.sessions.map((s) => s.id);

  const [{ data: myPicksRows }, { data: drivers }] = await Promise.all([
    myId
      ? supabase
          .from("predictions")
          .select("event_id, p1_driver_id, p2_driver_id, p3_driver_id")
          .eq("user_id", myId)
          .in("event_id", sessionIds)
      : Promise.resolve({ data: [] as unknown as null }),
    supabase
      .from("drivers")
      .select("id, code, team")
      .eq("active", true),
  ]);

  const driverById = new Map(
    (drivers ?? []).map((d) => [
      d.id as number,
      d as DriverRow,
    ]),
  );
  const picksByEventId = new Map<string, PredictionRow>();
  for (const p of (myPicksRows ?? []) as PredictionRow[]) {
    picksByEventId.set(p.event_id, p);
  }

  const meta = circuitMeta(
    grouped.ergast_circuit_id ?? grouped.circuit,
  );
  const short = shortEventName(grouped.name);

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const filledCount = grouped.sessions.filter((s) =>
    picksByEventId.has(s.id),
  ).length;

  return (
    <>
      <TopBar
        active="predict"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        <p
          className="mb-3 text-xs uppercase text-[color:var(--fg-muted)]"
          style={{ letterSpacing: "0.12em" }}
          data-tabular
        >
          ←{" "}
          <Link
            href="/dashboard/predict"
            className="text-[color:var(--fg)] hover:text-[color:var(--accent)]"
          >
            /dashboard/predict
          </Link>
          {" · "}/round/{String(grouped.round).padStart(2, "0")}
        </p>

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
              Round {String(grouped.round).padStart(2, "0")} ·{" "}
              {grouped.hasSprint ? "Sprint weekend" : "Race weekend"} ·{" "}
              {filledCount}/{grouped.sessions.length} locked
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
                grouped.weekendStart,
                grouped.weekendEnd,
              ).toUpperCase()}{" "}
              · {grouped.circuit.toUpperCase()}
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
              circuit={grouped.ergast_circuit_id ?? grouped.circuit}
              size={300}
              stroke="var(--fg-muted)"
              strokeWidth={2}
            />
          </div>
        </section>

        <section className="mt-10 grid gap-px bg-[color:var(--border)] border border-[color:var(--border)]">
          {grouped.sessions.map((s) => {
            const pick = picksByEventId.get(s.id);
            const lockMs = new Date(s.lock_at).getTime() - nowMs;
            const locked = lockMs <= 0;
            const isSprint =
              s.session_type === "sprint_race" ||
              s.session_type === "sprint_quali";
            const slotIds: (number | null)[] = isSprint
              ? [pick?.p1_driver_id ?? null]
              : [
                  pick?.p1_driver_id ?? null,
                  pick?.p2_driver_id ?? null,
                  pick?.p3_driver_id ?? null,
                ];
            const allFilled =
              slotIds.length > 0 && slotIds.every((id) => id != null);
            const cta = locked
              ? allFilled
                ? "View picks"
                : "Locked"
              : allFilled
                ? "Edit picks →"
                : "Lock in picks →";
            return (
              <Link
                key={s.id}
                href={`/dashboard/predict/${s.id}`}
                className="grid items-center gap-6 bg-[color:var(--surface)] px-6 py-5 transition-colors hover:bg-[color:var(--surface-2)]"
                style={{
                  gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) auto",
                }}
              >
                <div className="min-w-0">
                  <p
                    className="flex items-center gap-2 text-[10px] uppercase text-[color:var(--fg-subtle)]"
                    style={{ letterSpacing: "0.14em" }}
                    data-tabular
                  >
                    <span
                      aria-hidden
                      className="inline-block size-1.5 rounded-full"
                      style={{
                        background: locked
                          ? "var(--fg-subtle)"
                          : allFilled
                            ? "var(--success)"
                            : "var(--accent)",
                      }}
                    />
                    {locked
                      ? allFilled
                        ? "Locked · picks in"
                        : "Locked · no picks"
                      : allFilled
                        ? "Picks saved · still editable"
                        : "Open · pick now"}
                  </p>
                  <p
                    className="mt-2 leading-none"
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      fontSize: 30,
                      letterSpacing: "0.005em",
                    }}
                  >
                    {sessionLabel(s.session_type).toUpperCase()}
                  </p>
                  <p
                    className="mt-2 text-[11px] uppercase text-[color:var(--fg-muted)]"
                    style={{ letterSpacing: "0.06em" }}
                    data-tabular
                  >
                    {formatLocal(s.session_start_at).toUpperCase()} ·{" "}
                    {isSprint ? "P1 only" : "P1 · P2 · P3"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {slotIds.map((id, idx) => {
                    const d = id ? driverById.get(id) : null;
                    const t = d ? teamMeta(d.team) : null;
                    return (
                      <span
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs"
                        style={{
                          background: t?.hex
                            ? `${t.hex}22`
                            : "var(--surface-2)",
                          border: t?.hex
                            ? `1px solid ${t.hex}66`
                            : "1px dashed var(--border)",
                          color: d ? "var(--fg)" : "var(--fg-subtle)",
                        }}
                      >
                        <span
                          className="text-[10px] uppercase"
                          style={{ letterSpacing: "0.1em" }}
                          data-tabular
                        >
                          P{idx + 1}
                        </span>
                        <span
                          style={
                            d
                              ? {
                                  fontFamily:
                                    "var(--font-boldonse), ui-sans-serif",
                                }
                              : undefined
                          }
                        >
                          {d ? d.code : "—"}
                        </span>
                      </span>
                    );
                  })}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                    style={{ letterSpacing: "0.12em" }}
                    data-tabular
                  >
                    {locked ? "Locked" : "Locks in"}
                  </span>
                  <span
                    className="leading-none"
                    style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                      fontSize: 22,
                      color: locked
                        ? "var(--fg-subtle)"
                        : lockMs <= 60_000
                          ? "var(--warning)"
                          : "var(--fg)",
                    }}
                    data-tabular
                  >
                    {formatDelta(lockMs)}
                  </span>
                  <span
                    className="mt-2 px-3 py-1.5 text-[11px] uppercase"
                    style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                      letterSpacing: "0.08em",
                      background: locked
                        ? "transparent"
                        : "var(--accent)",
                      color: locked ? "var(--fg-muted)" : "#000",
                      border: locked ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {cta}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
    </>
  );
}
