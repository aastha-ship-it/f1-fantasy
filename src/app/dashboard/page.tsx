import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { DriverPortrait } from "@/components/DriverPortrait";
import { teamMeta } from "@/lib/design/teams";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { formatDateRange } from "@/lib/design/dateRange";
import { RevealNotice, type RevealCandidate } from "./reveal-notice";

type EventLite = {
  id: string;
  name: string;
  circuit: string;
  round: number;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
  lock_at: string;
  revealed_at: string | null;
  ergast_circuit_id: string | null;
};

type DriverRow = { id: number; code: string; full_name: string; team: string };

function formatDelta(msUntil: number): string {
  if (msUntil <= 0) return "Locked";
  const totalSec = Math.floor(msUntil / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

/** "FRI · MAR 8" — calendar-cell eyebrow per design canvas. */
function calendarDate(iso: string): string {
  const d = new Date(iso);
  const dow = d
    .toLocaleDateString(undefined, { weekday: "short" })
    .toUpperCase();
  const md = d
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toUpperCase();
  return `${dow} · ${md}`;
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const myId = userData.user?.id ?? null;

  let myDisplayName = "";
  if (myId) {
    const { data: me } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", myId)
      .maybeSingle<{ display_name: string | null }>();
    myDisplayName = me?.display_name?.trim() ?? "";
    if (!myDisplayName) {
      redirect("/profile?welcome=1");
    }
  }

  const nowIso = new Date().toISOString();
  const currentSeason = new Date().getUTCFullYear();

  // Fresh reveals — every event from the last 7 days that's been revealed AND
  // the user has a prediction for. Surfaced via the top-of-dashboard banner so
  // friends not in the app at admin-reveal-time still see "results are live"
  // when they next open up. Per-event localStorage dismissal lives client-side.
  const sevenDaysAgo = new Date(
    // eslint-disable-next-line react-hooks/purity
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  type FreshRevealRow = {
    event_id: string;
    events: {
      id: string;
      name: string;
      round: number;
      session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
      revealed_at: string;
      circuit: string;
      ergast_circuit_id: string | null;
    } | null;
  };
  const freshRevealsResp = myId
    ? await supabase
        .from("predictions")
        .select(
          "event_id, events!inner(id, name, round, session_type, revealed_at, ergast_circuit_id, circuit)",
        )
        .eq("user_id", myId)
        .not("events.revealed_at", "is", null)
        .gte("events.revealed_at", sevenDaysAgo)
        .order("revealed_at", {
          referencedTable: "events",
          ascending: false,
        })
        .limit(5)
        .returns<FreshRevealRow[]>()
    : { data: null };
  const revealCandidates: RevealCandidate[] = (freshRevealsResp.data ?? [])
    .filter((r): r is FreshRevealRow & { events: NonNullable<FreshRevealRow["events"]> } =>
      r.events !== null,
    )
    .map((r) => ({
      event_id: r.event_id,
      name: r.events.name,
      round: r.events.round,
      session_type: r.events.session_type,
      circuit: r.events.circuit,
      ergast_circuit_id: r.events.ergast_circuit_id,
    }));

  // Next session (primary CTA)
  const { data: nextOpen } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, lock_at, revealed_at, ergast_circuit_id",
    )
    .gt("lock_at", nowIso)
    .order("session_start_at", { ascending: true })
    .limit(1)
    .maybeSingle<EventLite>();

  // All sessions in the next round (for date range derivation in the hero).
  let nextRoundDates: { start: string; end: string } | null = null;
  if (nextOpen) {
    const { data: roundSessions } = await supabase
      .from("events")
      .select("session_start_at")
      .eq("season", currentSeason)
      .eq("round", nextOpen.round)
      .order("session_start_at", { ascending: true })
      .returns<{ session_start_at: string }[]>();
    if (roundSessions && roundSessions.length > 0) {
      nextRoundDates = {
        start: roundSessions[0]!.session_start_at,
        end: roundSessions[roundSessions.length - 1]!.session_start_at,
      };
    }
  }

  // Race-only calendar grid
  const { data: raceCalendar } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, lock_at, revealed_at, ergast_circuit_id",
    )
    .eq("season", currentSeason)
    .eq("session_type", "race")
    .order("round", { ascending: true })
    .returns<EventLite[]>();

  // Driver + constructor standings — both from Jolpica historical_results
  const [{ data: histRows }, { data: drivers }] = await Promise.all([
    supabase
      .from("historical_results")
      .select("driver_id, points")
      .eq("season", currentSeason),
    supabase
      .from("drivers")
      .select("id, code, full_name, team")
      .eq("active", true),
  ]);

  const driversById = new Map(
    ((drivers ?? []) as DriverRow[]).map((d) => [d.id, d]),
  );
  const driverPoints = new Map<number, number>();
  for (const r of (histRows ?? []) as {
    driver_id: number;
    points: number | string;
  }[]) {
    const pts = typeof r.points === "string" ? Number(r.points) : r.points;
    driverPoints.set(r.driver_id, (driverPoints.get(r.driver_id) ?? 0) + pts);
  }
  const driverStandings = [...driverPoints.entries()]
    .map(([id, points]) => ({ driver: driversById.get(id), points }))
    .filter((r): r is { driver: DriverRow; points: number } => Boolean(r.driver))
    .sort((a, b) => b.points - a.points)
    .slice(0, 6);

  const teamPoints = new Map<string, number>();
  for (const [driverId, pts] of driverPoints) {
    const d = driversById.get(driverId);
    if (!d) continue;
    teamPoints.set(d.team, (teamPoints.get(d.team) ?? 0) + pts);
  }
  const constructorStandings = [...teamPoints.entries()]
    .map(([team, points]) => ({ team, points, meta: teamMeta(team) }))
    .filter((r): r is { team: string; points: number; meta: NonNullable<ReturnType<typeof teamMeta>> } =>
      Boolean(r.meta),
    )
    .sort((a, b) => b.points - a.points)
    .slice(0, 6);

  // Calendar status helpers
  const nextRoundId = raceCalendar?.find(
    (r) => r.session_start_at >= nowIso,
  )?.id;
  const doneCount = (raceCalendar ?? []).filter(
    (r) => r.revealed_at !== null,
  ).length;
  const totalRounds = (raceCalendar ?? []).length;

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const lockCountdown = nextOpen
    ? formatDelta(new Date(nextOpen.lock_at).getTime() - nowMs)
    : null;

  return (
    <>
      <TopBar
        active="calendar"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <RevealNotice candidates={revealCandidates} />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        {/* Hero — next race */}
        {nextOpen ? (
          <NextRaceHero
            event={nextOpen}
            lockCountdown={lockCountdown}
            roundDates={nextRoundDates}
          />
        ) : (
          <EmptyHero />
        )}

        {/* Calendar */}
        {(raceCalendar ?? []).length > 0 && (
          <section className="mt-12">
            <div className="mb-5 flex items-baseline justify-between">
              <p
                className="text-2xl"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                  letterSpacing: "-0.005em",
                }}
              >
                {currentSeason} CALENDAR
              </p>
              <span
                className="text-xs uppercase text-[color:var(--fg-subtle)]"
                style={{ letterSpacing: "0.1em" }}
                data-tabular
              >
                {doneCount} done · 1 next · {totalRounds - doneCount - 1} upcoming
              </span>
            </div>
            <CalendarGrid
              races={raceCalendar ?? []}
              nowIso={nowIso}
              nextRoundId={nextRoundId ?? null}
            />
          </section>
        )}

        {/* Standings — drivers + constructors side-by-side */}
        <section className="mt-14 grid gap-8 lg:grid-cols-2">
          <DriverStandings standings={driverStandings} />
          <ConstructorStandings standings={constructorStandings} />
        </section>
      </main>
    </>
  );
}

function NextRaceHero({
  event,
  lockCountdown,
  roundDates,
}: {
  event: EventLite;
  lockCountdown: string | null;
  roundDates: { start: string; end: string } | null;
}) {
  const short = shortEventName(event.name);
  const meta = circuitMeta(event.ergast_circuit_id ?? event.circuit);
  const dateRange = roundDates
    ? formatDateRange(roundDates.start, roundDates.end)
    : null;

  // "MAY 2 – 4 · MIAMI INT. AUTODROME · 5.412 KM · 57 LAPS"
  const metaParts: string[] = [];
  if (dateRange) metaParts.push(dateRange);
  metaParts.push(event.circuit.toUpperCase());
  if (meta) {
    metaParts.push(`${meta.lengthKm.toFixed(3)} KM`);
    metaParts.push(`${meta.laps} LAPS`);
  }

  return (
    <section
      className="grid items-stretch overflow-hidden border border-[color:var(--border)] lg:grid-cols-[1.3fr_1fr]"
      style={{
        background:
          "linear-gradient(105deg, #1a0608 0%, var(--surface) 60%)",
        minHeight: 360,
      }}
    >
      <div className="flex flex-col justify-between gap-8 p-8 lg:p-12">
        <div>
          <p
            className="mb-3 flex items-center gap-2 text-xs uppercase text-[color:var(--accent)]"
            style={{ letterSpacing: "0.18em" }}
            data-tabular
          >
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full bg-[color:var(--accent)]"
            />
            Next race · Round {event.round}
          </p>
          <h1
            className="m-0"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: "clamp(48px, 6vw, 84px)",
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
            }}
          >
            {short.toUpperCase()}
            <br />
            <span className="text-[color:var(--fg-muted)]">GRAND PRIX</span>
          </h1>
          <p
            className="mt-4 text-sm uppercase text-[color:var(--fg-muted)]"
            style={{ letterSpacing: "0.04em" }}
            data-tabular
          >
            {metaParts.join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-8">
          <div>
            <p
              className="mb-1 text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.12em" }}
              data-tabular
            >
              Picks lock in
            </p>
            <p
              className="leading-none"
              data-tabular
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: "clamp(28px, 3.5vw, 44px)",
                fontWeight: 500,
              }}
            >
              {lockCountdown}
            </p>
          </div>
          <Link
            href="/dashboard/predict"
            className="bg-[color:var(--accent)] px-8 py-4 text-sm uppercase text-black transition-colors hover:bg-[color:var(--accent-hover)]"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              letterSpacing: "0.04em",
            }}
          >
            Make predictions →
          </Link>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-8">
        <p
          className="absolute right-6 top-6 text-xs uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.12em" }}
          data-tabular
        >
          Track layout
        </p>
        <TrackDiagram
          circuit={event.ergast_circuit_id ?? event.circuit}
          size={420}
          stroke="var(--fg)"
          strokeWidth={2.5}
        />
      </div>
    </section>
  );
}

function EmptyHero() {
  return (
    <section className="border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-12 text-center">
      <p
        className="text-xs uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.18em" }}
        data-tabular
      >
        Quiet week
      </p>
      <p
        className="mt-4 text-4xl"
        style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
      >
        NO OPEN SESSIONS
      </p>
    </section>
  );
}

function CalendarGrid({
  races,
  nowIso,
  nextRoundId,
}: {
  races: EventLite[];
  nowIso: string;
  nextRoundId: string | null;
}) {
  return (
    <ul
      className="grid gap-px overflow-hidden border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-2 lg:grid-cols-4"
    >
      {races.map((r) => {
        const isPast = r.session_start_at < nowIso;
        const isRevealed = r.revealed_at !== null;
        const isNext = r.id === nextRoundId;
        const short = shortEventName(r.name);
        return (
          <li
            key={r.id}
            className="relative flex flex-col gap-3 p-5"
            style={{
              background: isNext
                ? "var(--surface-2)"
                : "var(--surface)",
              opacity: isPast && !isRevealed ? 0.55 : 1,
              outline: isNext ? "1px solid var(--accent)" : "none",
              outlineOffset: "-1px",
              minHeight: 200,
            }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                style={{ letterSpacing: "0.14em" }}
                data-tabular
              >
                {calendarDate(r.session_start_at)}
              </p>
              {isNext ? (
                <span
                  className="border border-[color:var(--accent)] px-1.5 py-0.5 text-[9px] uppercase text-[color:var(--accent)]"
                  style={{ letterSpacing: "0.18em" }}
                  data-tabular
                >
                  Next
                </span>
              ) : isRevealed ? (
                <span
                  className="text-[9px] uppercase text-[color:var(--fg-subtle)]"
                  style={{ letterSpacing: "0.18em" }}
                  data-tabular
                >
                  Revealed
                </span>
              ) : null}
            </div>
            <p
              className="leading-tight"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: "22px",
                letterSpacing: "-0.005em",
              }}
            >
              {short.toUpperCase()}
            </p>
            <p
              className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.08em" }}
              data-tabular
            >
              {r.circuit}
            </p>
            <div className="mt-auto flex items-end justify-center pt-2">
              {isRevealed ? (
                <Link
                  href={`/reveal/${r.id}`}
                  aria-label={`View reveal · ${short}`}
                  className="block transition-opacity hover:opacity-80"
                >
                  <TrackDiagram
                    circuit={r.ergast_circuit_id ?? r.circuit}
                    size={160}
                    stroke="var(--fg-muted)"
                    strokeWidth={1.8}
                  />
                </Link>
              ) : (
                <TrackDiagram
                  circuit={r.ergast_circuit_id ?? r.circuit}
                  size={160}
                  stroke={isNext ? "var(--accent)" : "var(--fg-muted)"}
                  strokeWidth={1.8}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DriverStandings({
  standings,
}: {
  standings: { driver: DriverRow; points: number }[];
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <p
          className="text-xl"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            letterSpacing: "-0.005em",
          }}
        >
          DRIVER STANDINGS
        </p>
        <Link
          href="/dashboard/standings"
          className="text-xs uppercase text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          style={{ letterSpacing: "0.1em" }}
        >
          Full →
        </Link>
      </div>
      {standings.length === 0 ? (
        <p className="text-sm text-[color:var(--fg-subtle)]">
          Standings populate after the first race.
        </p>
      ) : (
        <ol className="overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface)]">
          {standings.map((s, idx) => {
            const t = teamMeta(s.driver.team);
            return (
              <li
                key={s.driver.id}
                className="grid grid-cols-[40px_44px_1fr_4px_56px] items-center gap-4 border-b border-[color:var(--border)] px-5 py-3.5 last:border-b-0"
              >
                <span
                  className="text-lg leading-none"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    color:
                      idx === 0 ? "var(--accent)" : "var(--fg)",
                  }}
                  data-tabular
                >
                  {idx + 1}
                </span>
                <DriverPortrait
                  code={s.driver.code}
                  team={s.driver.team}
                  size={36}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">
                    {s.driver.full_name}
                  </p>
                  <p
                    className="text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.1em",
                      color: t?.hex ?? "var(--fg-subtle)",
                    }}
                    data-tabular
                  >
                    {t?.name ?? s.driver.team}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="h-7 w-1"
                  style={{ background: t?.hex ?? "var(--fg-subtle)" }}
                />
                <span className="text-right text-lg" data-tabular>
                  {s.points}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function ConstructorStandings({
  standings,
}: {
  standings: {
    team: string;
    points: number;
    meta: NonNullable<ReturnType<typeof teamMeta>>;
  }[];
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <p
          className="text-xl"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            letterSpacing: "-0.005em",
          }}
        >
          CONSTRUCTOR STANDINGS
        </p>
        <Link
          href="/dashboard/standings"
          className="text-xs uppercase text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          style={{ letterSpacing: "0.1em" }}
        >
          Full →
        </Link>
      </div>
      {standings.length === 0 ? (
        <p className="text-sm text-[color:var(--fg-subtle)]">
          Constructor totals populate after the first race.
        </p>
      ) : (
        <ol className="overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface)]">
          {standings.map((s, idx) => (
            <li
              key={s.meta.slug}
              className="grid grid-cols-[40px_48px_1fr_4px_56px] items-center gap-4 border-b border-[color:var(--border)] px-5 py-3.5 last:border-b-0"
            >
              <span
                className="text-lg leading-none"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                  color: idx === 0 ? "var(--accent)" : "var(--fg)",
                }}
                data-tabular
              >
                {idx + 1}
              </span>
              <Image
                src={s.meta.logoSrc}
                alt={s.meta.name}
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <p
                className="leading-tight"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                  fontSize: "16px",
                  letterSpacing: "0.01em",
                }}
              >
                {s.meta.name.toUpperCase()}
              </p>
              <span
                aria-hidden
                className="h-7 w-1"
                style={{ background: s.meta.hex }}
              />
              <span className="text-right text-lg" data-tabular>
                {s.points}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
