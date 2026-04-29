import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { teamMeta } from "@/lib/design/teams";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { formatDateRange } from "@/lib/design/dateRange";
import {
  groupByRound,
  type GroupableEvent,
  type RoundEntry,
} from "@/lib/predict/groupByRound";

type EventRow = GroupableEvent;

const SESSION_LABEL: Record<EventRow["session_type"], string> = {
  race: "Race",
  quali: "Qualifying",
  sprint_race: "Sprint",
  sprint_quali: "Sprint Qualifying",
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

function slotsFor(t: EventRow["session_type"]): string {
  return t === "sprint_quali" || t === "sprint_race"
    ? "P1 only"
    : "P1 · P2 · P3";
}

export default async function PredictListPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const myId = userData.user?.id ?? null;

  const myDisplayName = myId
    ? (
        await supabase
          .from("users")
          .select("display_name")
          .eq("id", myId)
          .maybeSingle<{ display_name: string | null }>()
      ).data?.display_name ?? null
    : null;

  const nowIso = new Date().toISOString();

  // Hero candidate: earliest unlocked session
  const { data: nextEvent } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, lock_at, revealed_at, ergast_circuit_id",
    )
    .gt("lock_at", nowIso)
    .order("session_start_at", { ascending: true })
    .limit(1)
    .maybeSingle<EventRow>();

  // All sessions of the current season — we aggregate them by round below.
  const currentSeason = new Date().getUTCFullYear();
  const { data: seasonSessions } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, lock_at, revealed_at, ergast_circuit_id",
    )
    .eq("season", currentSeason)
    .order("session_start_at", { ascending: true })
    .returns<EventRow[]>();

  const upcomingRounds = groupByRound(
    (seasonSessions ?? []).filter((s) => s.lock_at > nowIso),
    "asc",
  );
  const revealedRounds = groupByRound(
    (seasonSessions ?? []).filter((s) => s.revealed_at !== null),
    "desc",
  );

  // User's existing picks for the hero, if any
  const heroPicks = nextEvent
    ? (
        await supabase
          .from("predictions")
          .select("p1_driver_id, p2_driver_id, p3_driver_id")
          .eq("event_id", nextEvent.id)
          .eq("user_id", myId ?? "")
          .maybeSingle<{
            p1_driver_id: number | null;
            p2_driver_id: number | null;
            p3_driver_id: number | null;
          }>()
      ).data ?? null
    : null;

  // Pull all active drivers once — used for both the hero pick chips and
  // the past-row pick chips (every revealed round needs three driver codes).
  const { data: allDrivers } = await supabase
    .from("drivers")
    .select("id, code, team")
    .eq("active", true);
  const driverById = new Map(
    (allDrivers ?? []).map((d) => [
      d.id as number,
      d as { id: number; code: string; team: string },
    ]),
  );

  // Season stats for the right-side hero block.
  const [{ data: myScoresAll }, { data: allScores }] = await Promise.all([
    myId
      ? supabase
          .from("scores")
          .select("event_id, points, perfect_bonus")
          .eq("user_id", myId)
      : Promise.resolve({ data: [] as unknown as null }),
    supabase.from("scores").select("user_id, points"),
  ]);
  const myTotalPoints = (
    (myScoresAll ?? []) as { points: number | string }[]
  ).reduce((s, r) => s + Number(r.points), 0);
  const myPerfectCount = (
    (myScoresAll ?? []) as { perfect_bonus: boolean }[]
  ).filter((r) => r.perfect_bonus).length;
  const totalsByUser = new Map<string, number>();
  for (const s of (allScores ?? []) as {
    user_id: string;
    points: number | string;
  }[]) {
    totalsByUser.set(
      s.user_id,
      (totalsByUser.get(s.user_id) ?? 0) + Number(s.points),
    );
  }
  const sortedUserTotals = [...totalsByUser.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  const myRank =
    myId && totalsByUser.has(myId)
      ? sortedUserTotals.findIndex(([uid]) => uid === myId) + 1
      : null;
  const totalUsers = totalsByUser.size;
  const totalSeasonRounds = revealedRounds.length + upcomingRounds.length;

  // Revealed-round picks + scores per user — only for the user, used in the
  // "Revealed" list rows.
  const revealedRoundIds = revealedRounds
    .map((r) => r.primarySession?.id)
    .filter((id): id is string => Boolean(id));
  const [{ data: myRevealedPicks }, { data: myRevealedScores }] =
    await Promise.all([
      myId && revealedRoundIds.length > 0
        ? supabase
            .from("predictions")
            .select("event_id, p1_driver_id, p2_driver_id, p3_driver_id")
            .eq("user_id", myId)
            .in("event_id", revealedRoundIds)
        : Promise.resolve({ data: [] as unknown as null }),
      myId && revealedRoundIds.length > 0
        ? supabase
            .from("scores")
            .select("event_id, points, perfect_bonus")
            .eq("user_id", myId)
            .in("event_id", revealedRoundIds)
        : Promise.resolve({ data: [] as unknown as null }),
    ]);
  const myPickByEventId = new Map<
    string,
    {
      p1: number | null;
      p2: number | null;
      p3: number | null;
    }
  >();
  for (const p of (myRevealedPicks ?? []) as {
    event_id: string;
    p1_driver_id: number | null;
    p2_driver_id: number | null;
    p3_driver_id: number | null;
  }[]) {
    myPickByEventId.set(p.event_id, {
      p1: p.p1_driver_id,
      p2: p.p2_driver_id,
      p3: p.p3_driver_id,
    });
  }
  const myScoreByEventId = new Map<
    string,
    { points: number; perfect: boolean }
  >();
  for (const s of (myRevealedScores ?? []) as {
    event_id: string;
    points: number | string;
    perfect_bonus: boolean;
  }[]) {
    myScoreByEventId.set(s.event_id, {
      points: Number(s.points),
      perfect: s.perfect_bonus,
    });
  }

  // Lock countdown snapshot
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const heroLockCountdown = nextEvent
    ? formatDelta(new Date(nextEvent.lock_at).getTime() - nowMs)
    : null;

  const heroIsSprint =
    nextEvent?.session_type === "sprint_race" ||
    nextEvent?.session_type === "sprint_quali";

  // Full-weekend date range + circuit meta for the hero — same shape as
  // the Upcoming list rows below.
  const heroRound = nextEvent
    ? upcomingRounds.find((r) => r.round === nextEvent.round) ?? null
    : null;
  const heroMeta = nextEvent
    ? circuitMeta(nextEvent.ergast_circuit_id ?? nextEvent.circuit)
    : null;
  const heroMetaParts: string[] = [];
  if (heroRound) {
    heroMetaParts.push(formatDateRange(heroRound.weekendStart, heroRound.weekendEnd));
  }
  if (heroMeta) {
    heroMetaParts.push(`${heroMeta.lengthKm.toFixed(3)} km`);
    heroMetaParts.push(`${heroMeta.laps} laps`);
  }
  if (nextEvent) heroMetaParts.push(slotsFor(nextEvent.session_type));

  return (
    <>
      <TopBar
        active="predict"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        <section className="grid items-end gap-8 border-b border-[color:var(--border)] pb-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p
              className="mb-3 text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.18em" }}
              data-tabular
            >
              Predictions · {currentSeason} Season
            </p>
            <h1
              className="m-0 leading-[0.9]"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: "clamp(48px, 7vw, 88px)",
                letterSpacing: "-0.015em",
              }}
            >
              LOCK
              <br />
              YOUR PICKS
            </h1>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <p
              className="text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.12em" }}
              data-tabular
            >
              Your season · {revealedRounds.length} of {totalSeasonRounds || 24}{" "}
              races
            </p>
            <p
              className="leading-none"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: "clamp(40px, 5vw, 56px)",
              }}
            >
              <span data-tabular>{myTotalPoints}</span>
              <span className="ml-2 text-base text-[color:var(--fg-subtle)]">
                pts
              </span>
            </p>
            <p
              className="text-xs uppercase text-[color:var(--fg-muted)]"
              style={{ letterSpacing: "0.04em" }}
              data-tabular
            >
              {myRank && totalUsers > 0
                ? `P${myRank} in The Group`
                : "Ranked once you score"}
              {myPerfectCount > 0 &&
                ` · ${myPerfectCount} perfect podium${myPerfectCount === 1 ? "" : "s"}`}
            </p>
          </div>
        </section>

        {/* Hero next-event card */}
        {nextEvent ? (
          <section
            className="mt-10 grid gap-8 overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface)] p-6 lg:grid-cols-[1fr_auto_360px] lg:p-8"
          >
            {/* Left — round + name */}
            <div>
              <p
                className="mb-2 flex items-center gap-2 text-xs uppercase text-[color:var(--accent)]"
                style={{ letterSpacing: "0.18em" }}
                data-tabular
              >
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-full bg-[color:var(--accent)]"
                />
                Next session
              </p>
              <p
                className="text-xs uppercase text-[color:var(--fg-subtle)]"
                style={{ letterSpacing: "0.12em" }}
                data-tabular
              >
                Round {nextEvent.round} · {SESSION_LABEL[nextEvent.session_type]}
              </p>
              <p
                className="mt-3 leading-[0.9]"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                  fontSize: "clamp(36px, 4vw, 48px)",
                }}
              >
                {nextEvent.name.toUpperCase()}
              </p>
              <p
                className="mt-2 text-sm text-[color:var(--fg-muted)]"
                style={{ letterSpacing: "0.04em" }}
                data-tabular
              >
                {nextEvent.circuit}
                {heroMetaParts.length > 0
                  ? ` · ${heroMetaParts.join(" · ")}`
                  : ""}
              </p>
            </div>

            {/* Center — track diagram */}
            <div className="hidden self-center lg:block" aria-hidden>
              <TrackDiagram
                circuit={nextEvent.ergast_circuit_id ?? nextEvent.circuit}
                size={320}
                stroke="var(--fg-muted)"
                strokeWidth={2}
              />
            </div>

            {/* Right — picks needed + countdown + CTA */}
            <div className="flex flex-col justify-between gap-4 bg-[color:var(--surface-2)] p-5">
              <div>
                <p
                  className="text-xs uppercase text-[color:var(--fg-subtle)]"
                  style={{ letterSpacing: "0.12em" }}
                  data-tabular
                >
                  Picks needed
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {(heroIsSprint
                    ? (["p1"] as const)
                    : (["p1", "p2", "p3"] as const)
                  ).map((slot, idx) => {
                    const id = heroPicks
                      ? heroPicks[`${slot}_driver_id` as const]
                      : null;
                    const d = id ? driverById.get(id) : undefined;
                    const t = d ? teamMeta(d.team) : null;
                    return (
                      <div
                        key={slot}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                        style={{
                          background: t?.hex
                            ? `${t.hex}22`
                            : "var(--surface)",
                          border: t?.hex
                            ? `1px solid ${t.hex}66`
                            : "1px dashed var(--border)",
                        }}
                      >
                        <span
                          className="text-xs uppercase text-[color:var(--fg-subtle)]"
                          data-tabular
                        >
                          P{idx + 1}
                        </span>
                        <span
                          className="flex-1 text-[color:var(--fg)]"
                          style={
                            d
                              ? {
                                  fontFamily:
                                    "var(--font-boldonse), ui-sans-serif",
                                }
                              : undefined
                          }
                        >
                          {d ? d.code : "Tap to pick"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {heroLockCountdown && (
                <p
                  className="text-xs uppercase text-[color:var(--warning)]"
                  style={{ letterSpacing: "0.12em" }}
                  data-tabular
                >
                  Locks in <span className="text-[color:var(--fg)]">{heroLockCountdown}</span>
                </p>
              )}

              <Link
                href={`/dashboard/predict/round/${nextEvent.round}`}
                className="bg-[color:var(--accent)] px-5 py-3 text-center text-sm uppercase tracking-wider text-black transition-colors hover:bg-[color:var(--accent-hover)]"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                  letterSpacing: "0.04em",
                }}
              >
                Continue picks →
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-10 border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-10">
            <p className="text-[color:var(--fg-muted)]">
              No open sessions right now. Check back when the next event opens.
            </p>
          </section>
        )}

        {/* Two-column revealed + upcoming — one row per ROUND, not per session. */}
        <section className="mt-12 grid gap-10 lg:grid-cols-2">
          <RoundList
            title="Revealed"
            rounds={revealedRounds}
            emptyText="No reveals yet."
            href={(r) =>
              r.primarySession
                ? `/reveal/${r.primarySession.id}`
                : `/dashboard/predict/${r.sessions[0]!.id}`
            }
            myPickByEventId={myPickByEventId}
            myScoreByEventId={myScoreByEventId}
            driverById={driverById}
            kind="revealed"
          />
          <RoundList
            title="Upcoming"
            rounds={upcomingRounds
              .filter((r) => r.primarySession?.id !== nextEvent?.id)
              .slice(0, 6)}
            emptyText="No upcoming rounds."
            href={(r) => `/dashboard/predict/round/${r.round}`}
            kind="upcoming"
          />
        </section>
      </main>
    </>
  );
}

type RoundListDriver = { id: number; code: string; team: string };

function RoundList({
  title,
  rounds,
  emptyText,
  href,
  kind,
  myPickByEventId,
  myScoreByEventId,
  driverById,
}: {
  title: string;
  rounds: RoundEntry[];
  emptyText: string;
  href: (r: RoundEntry) => string;
  kind: "revealed" | "upcoming";
  myPickByEventId?: Map<
    string,
    { p1: number | null; p2: number | null; p3: number | null }
  >;
  myScoreByEventId?: Map<string, { points: number; perfect: boolean }>;
  driverById?: Map<number, RoundListDriver>;
}) {
  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between">
        <p
          className="text-2xl"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            letterSpacing: "-0.005em",
          }}
        >
          {title.toUpperCase()}{" "}
          <span
            className="ml-2 text-xs text-[color:var(--fg-subtle)]"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              letterSpacing: "0.12em",
            }}
          >
            · {rounds.length} RACES
          </span>
        </p>
      </div>
      {rounds.length === 0 ? (
        <p className="text-sm text-[color:var(--fg-subtle)]">{emptyText}</p>
      ) : (
        <ul className="overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface)]">
          {rounds.map((r) => {
            const short = shortEventName(r.name);
            const eventId = r.primarySession?.id ?? null;
            const pick =
              eventId && myPickByEventId
                ? myPickByEventId.get(eventId)
                : null;
            const score =
              eventId && myScoreByEventId
                ? myScoreByEventId.get(eventId)
                : null;
            const pickIds = pick ? [pick.p1, pick.p2, pick.p3] : [];
            return (
              <li
                key={r.round}
                className="border-b border-[color:var(--border)] last:border-b-0"
              >
                <Link
                  href={href(r)}
                  className="grid items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[color:var(--surface-2)]"
                  style={{
                    gridTemplateColumns:
                      kind === "revealed"
                        ? "44px 64px 1fr auto auto"
                        : "44px 64px 1fr auto",
                  }}
                >
                  <span
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                    style={{ letterSpacing: "0.14em" }}
                    data-tabular
                  >
                    R{String(r.round).padStart(2, "0")}
                  </span>
                  <TrackDiagram
                    circuit={r.ergast_circuit_id ?? r.circuit}
                    size={64}
                    stroke="var(--fg-subtle)"
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate text-lg leading-tight"
                      style={{
                        fontFamily: "var(--font-boldonse), ui-sans-serif",
                      }}
                    >
                      {short.toUpperCase()}
                    </p>
                    <p
                      className="mt-0.5 text-[10px] uppercase text-[color:var(--fg-subtle)]"
                      style={{ letterSpacing: "0.06em" }}
                      data-tabular
                    >
                      {formatDateRange(r.weekendStart, r.weekendEnd)} · {r.circuit}
                      {r.hasSprint ? " · Sprint" : ""}
                    </p>
                  </div>
                  {kind === "revealed" ? (
                    <>
                      <div className="flex gap-1">
                        {pick && driverById ? (
                          pickIds.map((id, i) => {
                            const d = id ? driverById.get(id) : null;
                            return (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 text-[10px] uppercase"
                                style={{
                                  background: "var(--surface-2)",
                                  color: "var(--fg-muted)",
                                  letterSpacing: "0.06em",
                                  fontFamily:
                                    "var(--font-mono), ui-monospace, monospace",
                                }}
                                data-tabular
                              >
                                {d?.code ?? "—"}
                              </span>
                            );
                          })
                        ) : (
                          <span
                            className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                            style={{ letterSpacing: "0.1em" }}
                            data-tabular
                          >
                            No pick
                          </span>
                        )}
                      </div>
                      <span
                        className="min-w-10 text-right"
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: 22,
                          color: !score
                            ? "var(--fg-subtle)"
                            : score.perfect || score.points >= 10
                              ? "var(--accent)"
                              : "var(--fg)",
                        }}
                        data-tabular
                      >
                        {score ? `+${score.points}` : "—"}
                      </span>
                    </>
                  ) : (
                    <span
                      className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                      style={{ letterSpacing: "0.12em" }}
                      data-tabular
                    >
                      Picks open T-7d
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
