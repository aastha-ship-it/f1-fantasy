import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { DriverPortrait } from "@/components/DriverPortrait";
import {
  MobBleed,
  MobButton,
  MobEyebrow,
  MobSectionHead,
} from "@/components/MobilePrimitives";
import { teamMeta } from "@/lib/design/teams";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { formatDateRange } from "@/lib/design/dateRange";
import { sessionLabel } from "@/lib/sessionLabel";
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

/**
 * "MAY 4" — the mobile calendar row's right-hand date column.
 *
 * Separate from `calendarDate` below on purpose: the desktop card has a
 * whole row to itself and can afford the weekday, the 390pt row shares its
 * `auto` track with the state label, and "FRI · MAY 4" at mono 11 eats the
 * event name's `minmax(0,1fr)` until it truncates to two words. The canvas's
 * fixture writes `date: "May 4"` for the same reason.
 */
function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toUpperCase();
}

/** "06" — the canvas writes rounds zero-padded ("R06", "Round 06"). */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
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
  // Rounds whose race has actually started — the "After Round NN" meta on the
  // mobile championship head. Deliberately NOT `doneCount`: that counts
  // *revealed* rounds (an admin action), while the standings under the head
  // come from Jolpica's `historical_results`, which lands on race completion.
  // Derived from data the page already has; no extra query (PR-2 §"Design-vs-
  // data disagreements": report, do not invent).
  const roundsRun = (raceCalendar ?? []).filter(
    (r) => r.session_start_at < nowIso,
  ).length;

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
      <MobileTabBar active="calendar" />
      <RevealNotice candidates={revealCandidates} />
      {/*
        The 780px fork, pattern A (one element, base = mobile, `md:` restores
        today's value). Today's string was
        `px-6 py-10 pb-24 sm:px-8 md:pb-10 lg:px-12 xl:px-16`; every class it
        resolved to at >=780 is still resolved after the fork:
          · padding-x — `sm:px-8` already owned 640px upward, so today's base
            `px-6` was only ever visible below 640. `md:px-8` is therefore
            what restores today's ≥780 gutter; `lg:px-12`/`xl:px-16` still win
            above their own breakpoints. Today's `sm:px-8` is DELETED, not
            kept: it only ever resolved below 780 (from 640 up), which is
            mobile territory now, and a 32px gutter there left every
            `MobBleed` block inset by 12px instead of running edge to edge.
          · padding-y — `md:py-10` restores today's base `py-10`.
          · padding-bottom — today's `md:pb-10` is untouched and still beats
            `md:py-10` inside the same media query (Tailwind emits
            padding-block before padding-bottom).
        Base bottom padding clears the fixed MobileTabBar rather than guessing
        at it: `--tabbar-h` tracks the bar's own min-height (globals.css), so
        growing the tap target cannot silently bury the last row.
      */}
      <main className="mx-auto w-full max-w-[1600px] px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+24px)] md:px-8 md:py-10 md:pb-10 lg:px-12 xl:px-16">
        {/*
          MOBILE TREE (pattern B — fork the subtree).
          Below 780px the desktop hero / 4-up calendar grid / 2-up standings
          columns are `display:none` and this is the whole page. It is the
          first child of <main> because the hero cancels the main's 20px top
          padding with `-mt-5`; the hidden desktop siblings contribute no box,
          so nothing above it can reintroduce that gap.
        */}
        <div className="md:hidden">
          {nextOpen ? (
            <MobNextRaceHero
              event={nextOpen}
              lockCountdown={lockCountdown}
              roundDates={nextRoundDates}
            />
          ) : (
            <MobEmptyHero />
          )}

          {(raceCalendar ?? []).length > 0 && (
            <div className="mt-7">
              <MobSectionHead
                title={`${currentSeason} Calendar`}
                // Canvas says "18 to go" where the desktop head says
                // "18 upcoming"; same arithmetic, mobile wording (PR-2 §
                // disagreements). The canvas's "ALL 24 ROUNDS →" footer row is
                // omitted — there is no all-rounds route and this list already
                // renders every round, so the list ends on its last hairline.
                meta={`${doneCount} done · 1 next · ${totalRounds - doneCount - 1} to go`}
              />
              <MobCalendarRows
                races={raceCalendar ?? []}
                nowIso={nowIso}
                nextRoundId={nextRoundId ?? null}
              />
            </div>
          )}

          <MobChampionship
            driverStandings={driverStandings}
            constructorStandings={constructorStandings}
            roundsRun={roundsRun}
          />
        </div>

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
          <section className="mt-12 hidden md:block">
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

        {/* Standings — drivers + constructors side-by-side.
            `md:grid`, not `md:block`: this section is `grid` today and the
            visibility class has to restore the exact display it had, or the
            two columns stop being a grid at 1440. */}
        <section className="mt-14 hidden gap-8 md:grid lg:grid-cols-2">
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
    // `grid-cols-1` is load-bearing, not cosmetic — DO NOT DELETE.
    //
    // Without an explicit template this grid gets ONE implicit `auto` track,
    // whose floor is the content's min-content width. The hero's
    // <TrackDiagram size={420}> has a definite 420px width, so that floor was
    // 484px (420 + the wrapper's p-8) — wider than the 327px section at
    // 375px, and `overflow: hidden` below cropped the result rather than
    // scrolling it. `grid-cols-1` emits `repeat(1, minmax(0,1fr))`, whose 0
    // floor lets the track follow the container instead of the content.
    //
    // What then sizes the art is `flex-shrink` on the wrapper that hosts the
    // diagram — the `relative flex items-center justify-center p-8` <div>
    // further down this component, the one holding the "Track layout" label.
    // The diagram is a flex item with a 420px basis, so once the track stopped
    // being oversized it shrank to the 261px content box on its own.
    // TrackDiagram itself contributes NO width classes — a max-width:100%
    // clamp there was measured inert and removed; see TrackDiagram.tsx's doc
    // comment. (Named in prose, not as a utility: Tailwind scans all of src/
    // unconditionally, so a class name in a comment ships a real rule with no
    // call site — see globals.css's note above its `@source not`.)
    //
    // Above the fork the track was already the full available width, and from
    // `lg:` the two-column template wins outright, so this is a no-op at every
    // width that was not cropping (measured at 375/780/1023/1024/1280).
    // Regression lock: the "dashboard hero art stays inside the viewport" test
    // in tests/e2e/no-horizontal-overflow.spec.ts — the scrollWidth check
    // cannot catch this, because the crop happens inside `overflow: hidden`.
    // `hidden md:grid` (pattern B) — the mobile hero is a different tree, not
    // this one restyled, so this element disappears below the fork. It must
    // restore `grid`, not `block`: everything below depends on the template.
    // NOTE: `grid-cols-1` and its regression test still apply — they are
    // about widths >=780 too (measured at 780/1023/1024/1280), and the 375px
    // crop they originally fixed is now moot only because this subtree is
    // `display:none` there. Do not delete either on the theory that mobile no
    // longer renders this hero.
    <section
      className="hidden grid-cols-1 items-stretch overflow-hidden border border-[color:var(--border)] md:grid md:min-h-[360px] lg:grid-cols-[1.3fr_1fr]"
      style={{
        background:
          "linear-gradient(105deg, #1a0608 0%, var(--surface) 60%)",
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
    <section className="hidden border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-12 text-center md:block">
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
      className="grid grid-cols-2 gap-px overflow-hidden border border-[color:var(--border)] bg-[color:var(--border)] lg:grid-cols-4"
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
                className="grid grid-cols-[28px_36px_1fr_3px_44px] items-center gap-2 border-b border-[color:var(--border)] px-3 py-3 last:border-b-0 md:grid-cols-[40px_44px_1fr_4px_56px] md:gap-4 md:px-5 md:py-3.5"
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
              className="grid grid-cols-[28px_40px_1fr_3px_44px] items-center gap-2 border-b border-[color:var(--border)] px-3 py-3 last:border-b-0 md:grid-cols-[40px_48px_1fr_4px_56px] md:gap-4 md:px-5 md:py-3.5"
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

/* ==================================================================== *
 * MOBILE TREE — 390pt (`design/design_handoff_mobile`, README §2.2,
 * canvas `screens-mobile.jsx:MobDashboardScreen`).
 *
 * Everything below renders ONLY inside the `md:hidden` subtree above.
 * `MobilePrimitives` carries no `md:` classes by contract, so these
 * components must never be reached at >=780px — that is what keeps the
 * 1440 pixel diff at zero.
 *
 * Sizes are the canvas's raw numbers, inline, the way MobilePrimitives
 * writes them: `p-4` and friends map to Tailwind's own 4pt scale, which
 * drifts from the handoff at the sizes that matter here (46/30/15/9/8).
 * ==================================================================== */

/**
 * The one-off hero gradient. Not a new token: it is the same literal the
 * desktop hero already inlines two components up, re-angled 105deg → 160deg
 * because the phone hero is portrait. MobBleed takes `className` only (no
 * `style`), so the gradient lives on an inner box rather than becoming a
 * `bg-[image:linear-gradient(...)]` arbitrary value — every other gradient
 * in this codebase is an inline style and this one matches.
 */
const MOB_HERO_GRADIENT = "linear-gradient(160deg, #1a0608 0%, var(--surface) 70%)";

function MobNextRaceHero({
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

  // Two mono lines, not the desktop hero's one long `·`-joined string —
  // "MAY 2 - 4 · MIAMI INT. AUTODROME · 5.412 KM · 57 LAPS" wraps
  // unpredictably at 350px of content width. Same parts, fixed break.
  const metaLine1 = [dateRange, event.circuit.toUpperCase()]
    .filter(Boolean)
    .join(" · ");
  const metaLine2 = meta
    ? `${meta.lengthKm.toFixed(3)} KM · ${meta.laps} LAPS`
    : null;

  return (
    // `-mt-5` cancels <main>'s 20px top padding so the hero's top hairline
    // sits against the TopBar; `-mx-5` (MobBleed) does the same sideways.
    <MobBleed className="-mt-5">
      <div
        className="relative overflow-hidden border-y border-[color:var(--border)] px-5 pb-6 pt-5"
        style={{ background: MOB_HERO_GRADIENT }}
      >
        {/* Track art is INSET (right 12 / top 14), never negatively offset —
            at 390 a clipped silhouette reads as a bug, not a flourish
            (handoff §"Layout primitives"). `size` IS the rendered width on
            TrackDiagram (height is derived from the circuit ratio), so 170 is
            exact; passing `height` instead would make the width a function of
            which circuit is next. `aria-hidden` because TrackDiagram exposes
            a role="img" of its own and this copy is pure decoration. */}
        <div
          aria-hidden
          className="pointer-events-none absolute opacity-20"
          style={{ right: 12, top: 14 }}
        >
          <TrackDiagram
            circuit={event.ergast_circuit_id ?? event.circuit}
            size={170}
            stroke="var(--fg)"
          />
        </div>

        {/* Every text block below is `relative`: the track art is the only
            positioned box in here, so without it the static siblings paint
            underneath the silhouette instead of over it. */}
        <MobEyebrow
          color="var(--accent)"
          className="relative flex items-center gap-1.5"
        >
          <span
            aria-hidden
            className="inline-block shrink-0 rounded-full bg-[color:var(--accent)]"
            style={{ width: 5, height: 5 }}
          />
          Next race · Round {pad2(event.round)}
        </MobEyebrow>

        <h1
          className="relative"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 46,
            lineHeight: 0.9,
            margin: "10px 0 0",
          }}
        >
          {short.toUpperCase()}
          <br />
          <span className="text-[color:var(--fg-muted)]">GRAND PRIX</span>
        </h1>

        <p
          className="relative mt-3 uppercase text-[color:var(--fg-muted)]"
          data-tabular
          style={{ fontSize: 10, letterSpacing: "0.08em", lineHeight: 1.5 }}
        >
          {metaLine1}
          {metaLine2 !== null && (
            <>
              <br />
              {metaLine2}
            </>
          )}
        </p>

        <div className="relative mt-5 flex items-end justify-between gap-4 border-t border-[color:var(--border)] pt-4">
          <div className="min-w-0">
            <MobEyebrow>Picks lock in</MobEyebrow>
            <p
              className="mt-1"
              data-tabular
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 30,
                lineHeight: 1.1,
                fontWeight: 500,
              }}
            >
              {lockCountdown}
            </p>
          </div>
          {/* The canvas draws "2 of 3 / slots picked" here. /dashboard never
              reads the user's predictions for the next session and PR-2 is
              presentation-only, so this keeps the shape and fills it with data
              the page already has: which session is next, and its round. */}
          <p
            className="shrink-0 text-right uppercase text-[color:var(--fg-subtle)]"
            data-tabular
            style={{ fontSize: 9, letterSpacing: "0.1em", lineHeight: 1.6 }}
          >
            {sessionLabel(event.session_type)}
            <br />
            Round {pad2(event.round)}
          </p>
        </div>

        <div className="relative mt-4">
          <MobButton href="/dashboard/predict">Make predictions →</MobButton>
        </div>
      </div>
    </MobBleed>
  );
}

/** `EmptyHero`'s copy, in the mobile bleed frame. Same words on purpose. */
function MobEmptyHero() {
  return (
    <MobBleed className="-mt-5">
      <div
        className="border-y border-[color:var(--border)] px-5 pb-6 pt-5"
        style={{ background: MOB_HERO_GRADIENT }}
      >
        <MobEyebrow>Quiet week</MobEyebrow>
        <p
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 34,
            lineHeight: 0.9,
            margin: "10px 0 0",
          }}
        >
          NO OPEN SESSIONS
        </p>
      </div>
    </MobBleed>
  );
}

function MobCalendarRows({
  races,
  nowIso,
  nextRoundId,
}: {
  races: EventLite[];
  nowIso: string;
  nextRoundId: string | null;
}) {
  return (
    <MobBleed className="border-t border-[color:var(--border)]">
      {races.map((r) => {
        const isPast = r.session_start_at < nowIso;
        const isRevealed = r.revealed_at !== null;
        const isNext = r.id === nextRoundId;
        const short = shortEventName(r.name);

        // The next row's 3px accent edge is an INSET BOX-SHADOW, not a
        // border-left: CLAUDE.md bans left-accent stripes on cards, the
        // sanctioned exception is exactly this shadow idiom (MobileTabBar,
        // MobDisclosureRow), and a real border would reflow the row's 20px
        // gutter by 3px.
        const rowClass = `grid items-center gap-3 border-b border-[color:var(--border)] px-5 ${
          isNext
            ? "bg-[color:var(--surface-2)] shadow-[inset_3px_0_0_0_var(--accent)]"
            : ""
        } ${isPast && !isRevealed ? "opacity-60" : ""}`;
        // `minHeight`, not `height`: the row is a 68px tap target that must
        // never collapse, and the name column truncates rather than wraps, so
        // in practice it is exactly 68.
        const rowStyle = {
          minHeight: 68,
          gridTemplateColumns: "34px 64px minmax(0,1fr) auto",
        };

        const cells = (
          <>
            <span
              className="uppercase"
              data-tabular
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                color: isNext ? "var(--accent)" : "var(--fg-subtle)",
              }}
            >
              R{pad2(r.round)}
            </span>
            {/* `height={30}` here (not `size`): the silhouette has to sit on
                one vertical band down the whole list regardless of circuit
                shape, and the widest ratio we ship (1.7766) puts the derived
                width at 53px, inside the 64px track. */}
            <TrackDiagram
              circuit={r.ergast_circuit_id ?? r.circuit}
              height={30}
              strokeWidth={1.6}
              stroke={isNext ? "var(--accent)" : "var(--fg-muted)"}
            />
            <div className="min-w-0">
              <p
                className="truncate"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                  fontSize: 15,
                  lineHeight: 1.05,
                }}
              >
                {short.toUpperCase()}
              </p>
              <p
                className="truncate uppercase text-[color:var(--fg-subtle)]"
                data-tabular
                style={{ fontSize: 9, letterSpacing: "0.08em", marginTop: 3 }}
              >
                {r.circuit}
              </p>
            </div>
            <div className="text-right">
              <p
                data-tabular
                style={{ fontSize: 11, color: "var(--fg-muted)" }}
              >
                {shortDate(r.session_start_at)}
              </p>
              {/* Three states only. The canvas's fourth, a `--warning`
                  "SPRINT" chip, has no data behind it: `raceCalendar` is
                  filtered to `session_type='race'`, so a round's sprint
                  sessions are never loaded here. */}
              <p
                className="uppercase"
                data-tabular
                style={{
                  fontSize: 8,
                  letterSpacing: "0.12em",
                  marginTop: 3,
                  color: isNext ? "var(--accent)" : "var(--fg-subtle)",
                }}
              >
                {isNext ? "Next" : isRevealed ? "✓ Revealed" : "—"}
              </p>
            </div>
          </>
        );

        // Desktop links only the 160px track diagram to /reveal; at 390 the
        // whole 68px row is the tap target, so the <Link> wraps the row.
        return isRevealed ? (
          <Link
            key={r.id}
            href={`/reveal/${r.id}`}
            aria-label={`View reveal · ${short}`}
            className={rowClass}
            style={rowStyle}
          >
            {cells}
          </Link>
        ) : (
          <div key={r.id} className={rowClass} style={rowStyle}>
            {cells}
          </div>
        );
      })}
    </MobBleed>
  );
}

/**
 * Drivers / Constructors segmented control — zero JS, so `/dashboard` stays
 * a server component.
 *
 * Two `sr-only` radios drive both the segment styling and the panel
 * visibility through Tailwind v4's NAMED peer variants
 * (`peer-checked/drivers:`, `peer-checked/constructors:`). Those compile to a
 * general-sibling selector, `.peer\/drivers:checked ~ .<target>`, which is
 * the whole reason for this DOM shape:
 *
 *   - both inputs are the FIRST children of the container, and every element
 *     that reacts to them (the two labels, the two panels) is a later SIBLING
 *     of both. Nesting the labels inside their own bordered strip <div> would
 *     put them out of sibling range and silently kill the control.
 *   - the container is therefore the `grid grid-cols-2` itself: the labels are
 *     its two row-1 items and each panel spans both columns. `sr-only` is
 *     `position:absolute`, so the radios are out of flow and are not grid
 *     items — they take no track.
 *   - the strip's 1px box comes from `border-y border-l` + `border-y
 *     border-r` on the two labels rather than a border on a wrapper, so the
 *     segments meet with no divider between them, as the canvas draws it.
 *
 * The visible control is a <label>, so the hit area is the full 40px segment
 * and keyboard users get native radio-group arrow-key behaviour; the focus
 * ring has to be forwarded from the hidden input via `peer-focus-visible/*`
 * or it would be invisible.
 */
function MobChampionship({
  driverStandings,
  constructorStandings,
  roundsRun,
}: {
  driverStandings: { driver: DriverRow; points: number }[];
  constructorStandings: {
    team: string;
    points: number;
    meta: NonNullable<ReturnType<typeof teamMeta>>;
  }[];
  roundsRun: number;
}) {
  const segment =
    "mb-3 grid h-10 cursor-pointer place-items-center border-y border-[color:var(--border)] uppercase text-[color:var(--fg-subtle)]";
  const segmentStyle = { fontSize: 10, letterSpacing: "0.12em" };

  return (
    <div className="mt-7">
      <MobSectionHead
        title="Championship"
        // Omitted rather than "After Round 00" before the season starts.
        meta={roundsRun > 0 ? `After Round ${pad2(roundsRun)}` : undefined}
      />
      <div className="grid grid-cols-2">
        <input
          id="champ-drivers"
          type="radio"
          name="champ"
          defaultChecked
          className="peer/drivers sr-only"
        />
        <input
          id="champ-constructors"
          type="radio"
          name="champ"
          className="peer/constructors sr-only"
        />

        <label
          htmlFor="champ-drivers"
          className={`${segment} border-l peer-checked/drivers:bg-[color:var(--surface-2)] peer-checked/drivers:text-[color:var(--fg)] peer-checked/drivers:shadow-[inset_0_-2px_0_0_var(--accent)] peer-focus-visible/drivers:outline-2 peer-focus-visible/drivers:-outline-offset-2 peer-focus-visible/drivers:outline-[color:var(--accent)]`}
          data-tabular
          style={segmentStyle}
        >
          Drivers
        </label>
        <label
          htmlFor="champ-constructors"
          className={`${segment} border-r peer-checked/constructors:bg-[color:var(--surface-2)] peer-checked/constructors:text-[color:var(--fg)] peer-checked/constructors:shadow-[inset_0_-2px_0_0_var(--accent)] peer-focus-visible/constructors:outline-2 peer-focus-visible/constructors:-outline-offset-2 peer-focus-visible/constructors:outline-[color:var(--accent)]`}
          data-tabular
          style={segmentStyle}
        >
          Constructors
        </label>

        <div className="col-span-2 hidden peer-checked/drivers:block">
          <MobDriverStandings standings={driverStandings.slice(0, 5)} />
        </div>
        <div className="col-span-2 hidden peer-checked/constructors:block">
          <MobConstructorStandings
            standings={constructorStandings.slice(0, 5)}
          />
        </div>
      </div>
    </div>
  );
}

/** Shared row geometry for both championship panels (canvas: 60px rows). */
const MOB_STANDINGS_ROW =
  "grid items-center gap-3 border-b border-[color:var(--border)] px-5";
const MOB_STANDINGS_ROW_STYLE = {
  minHeight: 60,
  gridTemplateColumns: "24px 36px minmax(0,1fr) 3px auto",
};

function MobDriverStandings({
  standings,
}: {
  standings: { driver: DriverRow; points: number }[];
}) {
  if (standings.length === 0) {
    return (
      <p className="text-sm text-[color:var(--fg-subtle)]">
        Standings populate after the first race.
      </p>
    );
  }
  return (
    <MobBleed className="border-t border-[color:var(--border)]">
      {standings.map((s, idx) => {
        const t = teamMeta(s.driver.team);
        return (
          <div
            key={s.driver.id}
            className={MOB_STANDINGS_ROW}
            style={MOB_STANDINGS_ROW_STYLE}
          >
            <span
              data-tabular
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: 16,
                lineHeight: 1,
                color: idx === 0 ? "var(--accent)" : "var(--fg)",
              }}
            >
              {idx + 1}
            </span>
            <DriverPortrait
              code={s.driver.code}
              team={s.driver.team}
              size={32}
            />
            <div className="min-w-0">
              <p
                className="truncate font-medium"
                style={{ fontSize: 13, lineHeight: 1.2 }}
              >
                {s.driver.full_name}
              </p>
              {/* Team hex on mono 9 upper only — the handoff's one sanctioned
                  place for team colour as text (already >=3:1). */}
              <p
                className="truncate uppercase"
                data-tabular
                style={{
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  marginTop: 2,
                  color: t?.hex ?? "var(--fg-subtle)",
                }}
              >
                {t?.short ?? s.driver.team}
              </p>
            </div>
            <span
              aria-hidden
              style={{
                width: 3,
                height: 24,
                background: t?.hex ?? "var(--fg-subtle)",
              }}
            />
            <span data-tabular style={{ fontSize: 16 }}>
              {s.points}
            </span>
          </div>
        );
      })}
    </MobBleed>
  );
}

function MobConstructorStandings({
  standings,
}: {
  standings: {
    team: string;
    points: number;
    meta: NonNullable<ReturnType<typeof teamMeta>>;
  }[];
}) {
  if (standings.length === 0) {
    return (
      <p className="text-sm text-[color:var(--fg-subtle)]">
        Constructor totals populate after the first race.
      </p>
    );
  }
  return (
    <MobBleed className="border-t border-[color:var(--border)]">
      {standings.map((s, idx) => (
        <div
          key={s.meta.slug}
          className={MOB_STANDINGS_ROW}
          style={MOB_STANDINGS_ROW_STYLE}
        >
          <span
            data-tabular
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 16,
              lineHeight: 1,
              color: idx === 0 ? "var(--accent)" : "var(--fg)",
            }}
          >
            {idx + 1}
          </span>
          <Image
            src={s.meta.logoSrc}
            alt={s.meta.name}
            width={26}
            height={26}
            className="justify-self-center object-contain"
            style={{ width: 26, height: 26 }}
          />
          <p
            className="truncate"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 15,
              lineHeight: 1.05,
            }}
          >
            {s.meta.name.toUpperCase()}
          </p>
          <span
            aria-hidden
            style={{ width: 3, height: 24, background: s.meta.hex }}
          />
          <span data-tabular style={{ fontSize: 16 }}>
            {s.points}
          </span>
        </div>
      ))}
    </MobBleed>
  );
}
