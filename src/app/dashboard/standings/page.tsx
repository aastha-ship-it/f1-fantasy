import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { DriverPortrait } from "@/components/DriverPortrait";
import { teamMeta } from "@/lib/design/teams";
import { driverCountry, countryFlag } from "@/lib/design/drivers";
import {
  shortEventName,
  eventCountry,
  eventCountry3,
} from "@/lib/design/eventName";
import {
  combineStandings,
  isRaceFinisher,
  selectBackstopRows,
  type DriverInfo,
  type EventInfo,
  type JolpicaTotal,
} from "@/lib/standings/computeStandings";
import { SeasonSummary } from "./season-summary";
import type {
  ChipDatum,
  FlRoundDatum,
} from "./season-summary-helpers";
import {
  RecentWinners,
  type WinnerCardDatum,
} from "./recent-winners";

const CURRENT_SEASON = new Date().getUTCFullYear();
const TOTAL_ROUNDS = 24;

type DriverRow = {
  id: number;
  code: string;
  full_name: string;
  team: string;
};

export default async function StandingsPage() {
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

  const [
    { data: histRows },
    { data: histRaces },
    { data: classifications },
    { data: drivers },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("historical_results")
      .select(
        "driver_id, points, season, round, session_kind, position, status, fastest_lap",
      )
      .eq("season", CURRENT_SEASON),
    supabase
      .from("historical_races")
      .select("season, round, race_date, ergast_circuit_id")
      .eq("season", CURRENT_SEASON)
      .order("round", { ascending: true }),
    supabase
      .from("session_classifications")
      .select("event_id, driver_id, position"),
    supabase
      .from("drivers")
      .select("id, code, full_name, team"),
    supabase
      .from("events")
      .select("id, season, round, session_type, ergast_circuit_id"),
  ]);

  // Jolpica totals (sum points across race + sprint)
  const jolpicaTotalsByDriver = new Map<number, number>();
  for (const r of (histRows ?? []) as {
    driver_id: number;
    points: number | string;
  }[]) {
    const pts = typeof r.points === "string" ? Number(r.points) : r.points;
    jolpicaTotalsByDriver.set(
      r.driver_id,
      (jolpicaTotalsByDriver.get(r.driver_id) ?? 0) + pts,
    );
  }
  const jolpicaTotals: JolpicaTotal[] = Array.from(
    jolpicaTotalsByDriver,
    ([driver_id, points]) => ({ driver_id, points }),
  );

  // Backstop rows (circuits Jolpica hasn't yet ingested). Dedup key is the
  // circuit id, NOT (season, round) — Jolpica/Ergast renumbers the season
  // around real cancellations while our OpenF1-keyed `events.round`
  // preserves the meeting index, so the two systems disagree on round
  // numbers but always agree on `ergast_circuit_id`. See selectBackstopRows
  // + Bug-001 in plans/program-tracker.md.
  const eventsById = new Map<string, EventInfo>(
    ((events ?? []) as {
      id: string;
      season: number;
      round: number;
      session_type: EventInfo["session_type"];
      ergast_circuit_id: string | null;
    }[]).map((e) => [e.id, e]),
  );
  const ingestedCircuits = new Set(
    ((histRaces ?? []) as { ergast_circuit_id: string | null }[])
      .map((r) => r.ergast_circuit_id)
      .filter((id): id is string => !!id),
  );
  const backstopRows = selectBackstopRows(
    (classifications ?? []) as {
      event_id: string;
      driver_id: number;
      position: number | null;
    }[],
    eventsById,
    ingestedCircuits,
    CURRENT_SEASON,
  );

  const driverInfos: DriverInfo[] = ((drivers ?? []) as DriverRow[]).map(
    (d) => ({
      id: d.id,
      code: d.code,
      full_name: d.full_name,
      team: d.team,
    }),
  );

  const { drivers: driverStandings, constructors: combinedConstructors } =
    combineStandings(jolpicaTotals, backstopRows, driverInfos);

  // Force all rostered teams onto the constructor table — drivers who haven't
  // scored yet (or new entrants like Cadillac at the start of a season) must
  // still appear with 0 pts. `combineStandings` only emits teams that produced
  // points; we union in every distinct `drivers.team` so the table is the
  // canonical 2026 grid (11 teams).
  const constructorByTeam = new Map(
    combinedConstructors.map((c) => [c.team, c]),
  );
  for (const d of driverInfos) {
    if (!constructorByTeam.has(d.team)) {
      constructorByTeam.set(d.team, { team: d.team, points: 0 });
    }
  }
  const constructorStandings = [...constructorByTeam.values()].sort(
    (a, b) => b.points - a.points || a.team.localeCompare(b.team),
  );

  // Wins / podiums tallies — race wins only (not sprint), classified P1/P3.
  const winsByDriver = new Map<number, number>();
  const podiumsByDriver = new Map<number, number>();
  for (const r of (histRows ?? []) as {
    driver_id: number;
    position: number | null;
    session_kind: string;
  }[]) {
    if (r.session_kind !== "race") continue;
    if (r.position == null) continue;
    if (r.position === 1) {
      winsByDriver.set(r.driver_id, (winsByDriver.get(r.driver_id) ?? 0) + 1);
    }
    if (r.position <= 3) {
      podiumsByDriver.set(
        r.driver_id,
        (podiumsByDriver.get(r.driver_id) ?? 0) + 1,
      );
    }
  }
  const winsByTeam = new Map<string, number>();
  const podiumsByTeam = new Map<string, number>();
  const driversByTeam = new Map<string, string[]>();
  for (const d of driverInfos) {
    driversByTeam.set(
      d.team,
      [...(driversByTeam.get(d.team) ?? []), d.code],
    );
    winsByTeam.set(
      d.team,
      (winsByTeam.get(d.team) ?? 0) + (winsByDriver.get(d.id) ?? 0),
    );
    podiumsByTeam.set(
      d.team,
      (podiumsByTeam.get(d.team) ?? 0) + (podiumsByDriver.get(d.id) ?? 0),
    );
  }

  const hasData = driverStandings.length > 0;
  const leaderPts = driverStandings[0]?.points ?? 0;
  const constructorLeaderPts = constructorStandings[0]?.points ?? 0;
  const completedRounds = (histRaces ?? []).length;
  const lastIngestedDate = (histRaces ?? [])
    .map((r) => (r as { race_date: string }).race_date)
    .sort()
    .pop();

  const leader = driverStandings[0];
  const leaderTeam = leader ? teamMeta(leader.driver.team) : null;
  const leaderCountry = leader ? driverCountry(leader.driver.code) : null;

  // Season summary stats — full 5-cell strip, computed from historical_results.
  type StatRow = {
    session_kind: string;
    position: number | null;
    driver_id: number;
    status: string | null;
    fastest_lap: boolean;
  };
  const statRows = (histRows ?? []) as StatRow[];

  const distinctRaceWinners = new Set(
    statRows
      .filter((r) => r.session_kind === "race" && r.position === 1)
      .map((r) => r.driver_id),
  ).size;

  const distinctPoleSitters = new Set(
    statRows
      .filter((r) => r.session_kind === "qualifying" && r.position === 1)
      .map((r) => r.driver_id),
  ).size;

  const fastestLapRows = statRows.filter((r) => r.fastest_lap);
  const fastestLapsCount = fastestLapRows.length;

  // DNFs — race rows where the driver wasn't classified at the flag.
  // Finisher set: "Finished", "Lapped" (Jolpica's literal for finishers
  // >1 lap down), and the legacy Ergast "+N Lap(s)" form. Anything else
  // (Retired, Did not start, Disqualified, Collision, etc.) is a DNF.
  // See `isRaceFinisher` (Bug-002 regression-locked DNF1..DNF5).
  const dnfsCount = statRows.filter(
    (r) => r.session_kind === "race" && !isRaceFinisher(r.status),
  ).length;

  // Recent winners strip — last 5 races by round desc.
  type RecentWinner = {
    round: number;
    raceDate: string;
    driverId: number;
    eventId: string | null;
    circuitKey: string | null;
    eventName: string | null;
  };
  const winnerByRound = new Map<number, number>();
  for (const r of (histRows ?? []) as {
    session_kind: string;
    position: number | null;
    round: number;
    driver_id: number;
  }[]) {
    if (r.session_kind === "race" && r.position === 1) {
      winnerByRound.set(r.round, r.driver_id);
    }
  }
  // Build the event lookup keyed by `ergast_circuit_id` (the stable
  // identifier both Jolpica and OpenF1 agree on — same pattern as Bug-001
  // / `selectBackstopRows`). Round numbers diverge between the two sources
  // when F1 cancels a race (Miami = Jolpica round 4 vs our events.round 6
  // in 2026), so keying on round drops the Jolpica row entirely.
  const { data: raceEvents } = await supabase
    .from("events")
    .select("id, round, circuit, name, ergast_circuit_id")
    .eq("season", CURRENT_SEASON)
    .eq("session_type", "race");
  const eventByCircuit = new Map<
    string,
    { id: string; circuit: string | null; name: string }
  >();
  for (const e of (raceEvents ?? []) as {
    id: string;
    round: number;
    circuit: string;
    name: string;
    ergast_circuit_id: string | null;
  }[]) {
    if (!e.ergast_circuit_id) continue;
    eventByCircuit.set(e.ergast_circuit_id, {
      id: e.id,
      circuit: e.ergast_circuit_id ?? e.circuit,
      name: e.name,
    });
  }
  // Chronological order (oldest left, newest right) so the header's
  // "most recent →" arrow points the right way; keep only the last 5.
  const recentWinners: RecentWinner[] = ((histRaces ?? []) as {
    season: number;
    round: number;
    race_date: string;
    ergast_circuit_id: string | null;
  }[])
    .map((r) => {
      const ev = r.ergast_circuit_id
        ? eventByCircuit.get(r.ergast_circuit_id)
        : null;
      const did = winnerByRound.get(r.round);
      return {
        round: r.round,
        raceDate: r.race_date,
        driverId: did ?? -1,
        eventId: ev?.id ?? null,
        // Defensive: prefer the events-row circuit, fall back to the
        // Jolpica row's circuit_id when our events table is missing the
        // race (e.g. mid-season ingest order races).
        circuitKey: ev?.circuit ?? r.ergast_circuit_id ?? null,
        eventName: ev?.name ?? null,
      };
    })
    .filter((w) => w.driverId !== -1)
    .slice(-5); // last 5 in chronological order; newest is rightmost
  const driversById = new Map(
    driverInfos.map((d) => [d.id, d]),
  );

  // PR-1 season-summary aggregations — derived from the existing histRows
  // (handoff "keep the data layer untouched"). Three new Maps power the
  // detail rows on S02/S03/S04.
  const winCountsByDriver = new Map<number, number>();
  const poleCountsByDriver = new Map<number, number>();
  type FlByRound = { round: number; driverId: number };
  const flByRoundMap = new Map<number, number>();
  for (const r of statRows) {
    if (r.session_kind === "race" && r.position === 1) {
      winCountsByDriver.set(
        r.driver_id,
        (winCountsByDriver.get(r.driver_id) ?? 0) + 1,
      );
    }
    if (r.session_kind === "qualifying" && r.position === 1) {
      poleCountsByDriver.set(
        r.driver_id,
        (poleCountsByDriver.get(r.driver_id) ?? 0) + 1,
      );
    }
    if (r.session_kind === "race" && r.fastest_lap) {
      // statRows has `round` even though the type alias didn't list it —
      // the underlying histRows select includes it.
      const round = (r as unknown as { round: number }).round;
      flByRoundMap.set(round, r.driver_id);
    }
  }
  const fastestLapByRound: FlByRound[] = [...flByRoundMap.entries()]
    .map(([round, driverId]) => ({ round, driverId }))
    .sort((a, b) => a.round - b.round);

  const buildChips = (counts: Map<number, number>): ChipDatum[] =>
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([driverId, count]) => {
        const d = driversById.get(driverId);
        if (!d) return null;
        return {
          code: d.code,
          count,
          hex: teamMeta(d.team)?.hex ?? "var(--fg-subtle)",
        };
      })
      .filter((c): c is ChipDatum => c !== null);

  const winnerChips = buildChips(winCountsByDriver);
  const poleChips = buildChips(poleCountsByDriver);

  const fastestLapRoundData: FlRoundDatum[] = fastestLapByRound.map(
    ({ round, driverId }) => {
      const d = driversById.get(driverId);
      return {
        r: `R${String(round).padStart(2, "0")}`,
        code: d?.code ?? "—",
        hex: d ? (teamMeta(d.team)?.hex ?? "var(--fg-subtle)") : "var(--fg-subtle)",
      };
    },
  );

  const dnfsPerRace = completedRounds > 0 ? dnfsCount / completedRounds : null;

  // PR-2 — enrich recentWinners with the WinnerCard data shape (date,
  // flag emoji, ISO-3 cc, last name, team meta). Server-side only.
  const SHORT_MONTH = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const shortDate = (iso: string): string => {
    const [y, m, d] = iso.split("-").map((s) => Number(s));
    if (!y || !m || !d) return iso;
    return `${SHORT_MONTH[m - 1]} ${d}`;
  };
  const lastNameOf = (full: string): string => {
    const parts = full.trim().split(/\s+/);
    return parts[parts.length - 1] ?? full;
  };
  const recentWinnerData: WinnerCardDatum[] = recentWinners
    .map((w) => {
      const d = driversById.get(w.driverId);
      if (!d) return null;
      const meta = teamMeta(d.team);
      const iso2 = w.eventName ? eventCountry(w.eventName) : null;
      const cc3 = w.eventName ? eventCountry3(w.eventName) : null;
      return {
        round: w.round,
        gp: w.eventName ? shortEventName(w.eventName) : "—",
        date: shortDate(w.raceDate),
        flag: iso2 ? countryFlag(iso2) : "",
        cc: cc3 ?? "—",
        code: d.code,
        lastName: lastNameOf(d.full_name),
        team: d.team,
        teamShort: meta?.short ?? d.team.slice(0, 3).toUpperCase(),
        teamHex: meta?.hex ?? "var(--fg-subtle)",
        track: w.circuitKey,
      } satisfies WinnerCardDatum;
    })
    .filter((w): w is WinnerCardDatum => w !== null);

  return (
    <>
      <TopBar
        active="standings"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        {/* Hero */}
        <section className="grid items-end gap-12 border-b border-[color:var(--border)] pb-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p
              className="mb-3 text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.12em" }}
              data-tabular
            >
              {CURRENT_SEASON} FIA Formula One World Championship · Round{" "}
              {completedRounds} of 24 complete
            </p>
            <h1
              className="m-0"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: "clamp(48px, 7vw, 88px)",
                lineHeight: 0.9,
                letterSpacing: "-0.015em",
              }}
            >
              WORLD
              <br />
              STANDINGS
            </h1>
            {hasData && lastIngestedDate && (
              <p
                className="mt-4 text-xs uppercase text-[color:var(--fg-muted)]"
                style={{ letterSpacing: "0.04em" }}
                data-tabular
              >
                Latest ingested race · {lastIngestedDate}
                {backstopRows.length > 0 &&
                  ` · ${backstopRows.length} fresh row${
                    backstopRows.length === 1 ? "" : "s"
                  } via OpenF1 backstop`}
              </p>
            )}
          </div>

          {leader && leaderTeam && (
            <div
              className="relative overflow-hidden p-6"
              style={{
                background: leaderTeam.livery[1],
                boxShadow: `inset 0 -3px 0 ${leaderTeam.hex}`,
              }}
            >
              <div className="grid grid-cols-[1fr_auto] items-center gap-6">
                <div>
                  <p
                    className="mb-2 text-[10px] uppercase"
                    style={{
                      color: "rgba(255,255,255,0.7)",
                      letterSpacing: "0.12em",
                    }}
                    data-tabular
                  >
                    Championship leader
                  </p>
                  <p
                    className="text-white"
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      fontSize: 28,
                      lineHeight: 1,
                    }}
                  >
                    {leader.driver.full_name.toUpperCase()}
                  </p>
                  <p
                    className="mt-3 text-[11px] uppercase"
                    style={{
                      letterSpacing: "0.08em",
                      color: leaderTeam.hex,
                    }}
                    data-tabular
                  >
                    {leaderTeam.name} · #{leader.driver.id}
                    {leaderCountry && ` · ${countryFlag(leaderCountry)}`}
                  </p>
                  <div
                    className="mt-4 flex flex-wrap gap-5 text-xs"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    <span>
                      <strong
                        className="text-white"
                        style={{ fontSize: 18 }}
                        data-tabular
                      >
                        {leader.points}
                      </strong>{" "}
                      pts
                    </span>
                    <span>
                      <strong
                        className="text-white"
                        style={{ fontSize: 18 }}
                        data-tabular
                      >
                        {winsByDriver.get(leader.driver.id) ?? 0}
                      </strong>{" "}
                      wins
                    </span>
                    <span>
                      <strong
                        className="text-white"
                        style={{ fontSize: 18 }}
                        data-tabular
                      >
                        {podiumsByDriver.get(leader.driver.id) ?? 0}
                      </strong>{" "}
                      podiums
                    </span>
                  </div>
                </div>
                <div className="size-[120px]">
                  <DriverPortrait
                    code={leader.driver.code}
                    team={leader.driver.team}
                    size={120}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Empty state */}
        {!hasData && (
          <section className="mt-12 border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-10">
            <p
              className="text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.12em" }}
              data-tabular
            >
              No data yet
            </p>
            <p className="mt-3 text-[color:var(--fg-muted)]">
              Standings populate after the first race weekend, once the Jolpica
              nightly delta or OpenF1 fetch lands.
            </p>
            <p className="mt-4 text-sm text-[color:var(--fg-subtle)]">
              In the meantime, the{" "}
              <Link
                href="/dashboard/league"
                className="underline hover:text-[color:var(--fg)]"
              >
                friend leaderboard
              </Link>{" "}
              is where the season drama actually lives.
            </p>
          </section>
        )}

        {/* Two-column standings */}
        {hasData && (
          <section className="mt-12 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
            {/* Driver standings */}
            <div>
              <div className="mb-5 flex items-baseline justify-between">
                <h2
                  className="m-0 text-2xl"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    letterSpacing: "-0.005em",
                  }}
                >
                  DRIVER STANDINGS
                </h2>
                <span
                  className="text-xs uppercase text-[color:var(--fg-subtle)]"
                  style={{ letterSpacing: "0.1em" }}
                  data-tabular
                >
                  {driverStandings.length} drivers
                </span>
              </div>

              <ol>
                {driverStandings.map((s, idx) => {
                  const t = teamMeta(s.driver.team);
                  const isLeader = idx === 0;
                  const wins = winsByDriver.get(s.driver.id) ?? 0;
                  const pods = podiumsByDriver.get(s.driver.id) ?? 0;
                  const country = driverCountry(s.driver.code);
                  const gap = isLeader ? "LEADER" : `+${leaderPts - s.points}`;
                  return (
                    <li
                      key={s.driver.id}
                      className="relative grid items-center gap-3 border-b border-[color:var(--border)] py-3.5 pl-3"
                      style={{
                        gridTemplateColumns:
                          "32px 56px minmax(0,1fr) 84px 48px 48px 64px",
                        background: isLeader ? "var(--surface-2)" : "transparent",
                      }}
                    >
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 bottom-2 w-[3px]"
                        style={{ background: t?.hex ?? "var(--fg-subtle)" }}
                      />
                      <span
                        className="leading-none"
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: 22,
                          color: isLeader ? "var(--accent)" : "var(--fg)",
                        }}
                        data-tabular
                      >
                        {idx + 1}
                      </span>
                      <DriverPortrait
                        code={s.driver.code}
                        team={s.driver.team}
                        size={48}
                      />
                      <div className="min-w-0">
                        <p
                          className="truncate"
                          style={{
                            fontFamily: "var(--font-boldonse), ui-sans-serif",
                            fontSize: 16,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {s.driver.full_name}
                        </p>
                        <p
                          className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                          style={{ letterSpacing: "0.08em" }}
                          data-tabular
                        >
                          #{s.driver.id}
                          {country && ` · ${countryFlag(country)}`} · {gap}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {t && (
                          <Image
                            src={t.logoSrc}
                            alt={t.name}
                            width={20}
                            height={20}
                            className="h-5 w-5 object-contain"
                            unoptimized
                          />
                        )}
                        <span
                          className="text-[11px]"
                          style={{
                            color: t?.hex ?? "var(--fg-muted)",
                            letterSpacing: "0.06em",
                            fontWeight: 600,
                            fontFamily:
                              "var(--font-mono), ui-monospace, monospace",
                          }}
                        >
                          {t?.short ?? s.driver.team.slice(0, 3).toUpperCase()}
                        </span>
                      </div>
                      <span
                        className="text-right text-sm"
                        style={{
                          color: wins > 0 ? "var(--fg)" : "var(--fg-subtle)",
                        }}
                        data-tabular
                      >
                        {wins}
                      </span>
                      <span
                        className="text-right text-sm"
                        style={{
                          color: pods > 0 ? "var(--fg)" : "var(--fg-subtle)",
                        }}
                        data-tabular
                      >
                        {pods}
                      </span>
                      <span
                        className="text-right"
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: 22,
                        }}
                        data-tabular
                      >
                        {s.points}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p
                className="mt-3 grid gap-3 text-[10px] uppercase text-[color:var(--fg-subtle)]"
                style={{
                  gridTemplateColumns:
                    "32px 56px minmax(0,1fr) 84px 48px 48px 64px",
                  letterSpacing: "0.1em",
                  paddingLeft: 12,
                }}
                data-tabular
              >
                <span>POS</span>
                <span></span>
                <span>DRIVER</span>
                <span>TEAM</span>
                <span className="text-right">W</span>
                <span className="text-right">POD</span>
                <span className="text-right">PTS</span>
              </p>
            </div>

            {/* Constructor standings */}
            <div>
              <div className="mb-5 flex items-baseline justify-between">
                <h2
                  className="m-0 text-2xl"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    letterSpacing: "-0.005em",
                  }}
                >
                  CONSTRUCTORS
                </h2>
                <span
                  className="text-xs uppercase text-[color:var(--fg-subtle)]"
                  style={{ letterSpacing: "0.1em" }}
                  data-tabular
                >
                  {constructorStandings.length} teams
                </span>
              </div>
              <ol className="flex flex-col gap-2">
                {constructorStandings.map((c, idx) => {
                  const t = teamMeta(c.team);
                  if (!t) return null;
                  const pct =
                    constructorLeaderPts > 0
                      ? c.points / constructorLeaderPts
                      : 0;
                  const tDrivers = driversByTeam.get(c.team) ?? [];
                  const tWins = winsByTeam.get(c.team) ?? 0;
                  const tPods = podiumsByTeam.get(c.team) ?? 0;
                  return (
                    <li
                      key={c.team}
                      className="relative overflow-hidden p-4"
                      style={{
                        background: "var(--surface)",
                        boxShadow: `inset 0 -3px 0 ${t.hex}`,
                      }}
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0"
                        style={{
                          width: `${pct * 100}%`,
                          background: `linear-gradient(90deg, ${t.hex}33, transparent)`,
                        }}
                      />
                      <div
                        className="relative grid items-center gap-3"
                        style={{
                          gridTemplateColumns: "32px 32px minmax(0,1fr) auto",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-boldonse), ui-sans-serif",
                            fontSize: 22,
                            color: idx === 0 ? "var(--accent)" : "var(--fg)",
                          }}
                          data-tabular
                        >
                          {idx + 1}
                        </span>
                        <Image
                          src={t.logoSrc}
                          alt={t.name}
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                          unoptimized
                        />
                        <div className="min-w-0">
                          <p
                            className="truncate"
                            style={{
                              fontFamily:
                                "var(--font-boldonse), ui-sans-serif",
                              fontSize: 16,
                              letterSpacing: "0.02em",
                            }}
                          >
                            {t.name.toUpperCase()}
                          </p>
                          <p
                            className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                            style={{ letterSpacing: "0.08em" }}
                            data-tabular
                          >
                            {tDrivers.join(" · ")} · {tWins}W · {tPods}P
                          </p>
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--font-boldonse), ui-sans-serif",
                            fontSize: 28,
                          }}
                          data-tabular
                        >
                          {c.points}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        )}

        {/* Season summary stat strip — design_handoff_standings § PR-1. */}
        {hasData && (
          <SeasonSummary
            completedRounds={completedRounds}
            totalRounds={TOTAL_ROUNDS}
            distinctRaceWinners={distinctRaceWinners}
            winnerChips={winnerChips}
            distinctPoleSitters={distinctPoleSitters}
            poleChips={poleChips}
            fastestLapsCount={fastestLapsCount}
            fastestLapRounds={fastestLapRoundData}
            dnfsCount={dnfsCount}
            dnfsPerRace={dnfsPerRace}
          />
        )}

        {/* Recent Winners — design_handoff_standings § PR-2 */}
        <RecentWinners winners={recentWinnerData} />
      </main>
    </>
  );
}
