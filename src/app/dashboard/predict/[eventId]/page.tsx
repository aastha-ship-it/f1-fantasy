import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { MobEyebrow } from "@/components/MobilePrimitives";
import { DriverPicker } from "../driver-picker";
import { submitPrediction } from "../actions";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { sessionLabel as sessionLabelOf } from "@/lib/sessionLabel";

type EventRow = {
  id: string;
  name: string;
  circuit: string;
  round: number;
  season: number;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
  lock_at: string;
  ergast_circuit_id: string | null;
};

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
  if (days > 0)
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
      .toString()
      .padStart(2, "0")}m`;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

/**
 * The mobile hero's countdown card puts the session date over the session
 * time on two lines (canvas `MobPredictScreen`, "Sun 04 May / 20:00 IST"),
 * where the desktop runs one string. Two call sites in this file only — the
 * shared-helper rule (extract on the third use) does not apply yet.
 */
function formatLocalParts(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: d
      .toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
      .toUpperCase(),
    time: d
      .toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      .toUpperCase(),
  };
}

function formatLocal(iso: string): string {
  return new Date(iso)
    .toLocaleString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
}

export default async function PredictEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
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

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, season, session_type, session_start_at, lock_at, ergast_circuit_id",
    )
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (!event) notFound();

  const [{ data: drivers }, { data: existing }, { data: nudgeRows }] =
    await Promise.all([
      supabase
        .from("drivers")
        .select("id, code, full_name, team")
        .eq("active", true)
        .order("id", { ascending: true }),
      supabase
        .from("predictions")
        .select("p1_driver_id, p2_driver_id, p3_driver_id")
        .eq("event_id", event.id)
        .maybeSingle<{
          p1_driver_id: number | null;
          p2_driver_id: number | null;
          p3_driver_id: number | null;
        }>(),
      supabase
        .from("driver_nudges")
        .select(
          "driver_id, recent_form, at_track_podiums, at_track_wins, quali_race_delta",
        )
        .eq("event_id", event.id),
    ]);

  const nudgesByDriver = new Map<
    number,
    {
      recent_form: string;
      at_track_podiums: number | null;
      at_track_wins: number | null;
      quali_race_delta: number | null;
    }
  >();
  for (const n of nudgeRows ?? []) {
    nudgesByDriver.set(n.driver_id as number, {
      recent_form: n.recent_form as string,
      at_track_podiums: n.at_track_podiums as number | null,
      at_track_wins: n.at_track_wins as number | null,
      quali_race_delta:
        n.quali_race_delta == null ? null : Number(n.quali_race_delta),
    });
  }
  const nudges = Object.fromEntries(nudgesByDriver);

  const isSprint =
    event.session_type === "sprint_race" ||
    event.session_type === "sprint_quali";
  const initialPicks = {
    p1: existing?.p1_driver_id ?? null,
    p2: existing?.p2_driver_id ?? null,
    p3: existing?.p3_driver_id ?? null,
  };

  // Lock-countdown snapshot for the static hero (the picker has a live one
  // in the sticky bar that ticks).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const lockCountdown = formatDelta(
    new Date(event.lock_at).getTime() - nowMs,
  );

  const short = shortEventName(event.name);
  const meta = circuitMeta(event.ergast_circuit_id ?? event.circuit);
  const startParts = formatLocalParts(event.session_start_at);

  // Group hot picks per slot — top 3 driver codes friends have chosen.
  // Used in empty-slot telemetry on the picker. Sprint sessions only have P1.
  const { data: groupPredictions } = await supabase
    .from("predictions")
    .select("p1_driver_id, p2_driver_id, p3_driver_id")
    .eq("event_id", event.id);
  const driverCodeById = new Map(
    (drivers ?? []).map((d) => [d.id as number, d.code as string]),
  );
  function topCodes(slot: "p1" | "p2" | "p3"): string[] {
    const counts = new Map<number, number>();
    for (const p of (groupPredictions ?? []) as {
      p1_driver_id: number | null;
      p2_driver_id: number | null;
      p3_driver_id: number | null;
    }[]) {
      const id = p[`${slot}_driver_id` as const];
      if (id == null) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => driverCodeById.get(id) ?? "")
      .filter((c) => c);
  }
  const hotPicks = {
    p1: topCodes("p1"),
    p2: topCodes("p2"),
    p3: topCodes("p3"),
  };

  return (
    <>
      <TopBar
        active="predict"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <MobileTabBar active="predict" />
      {/* `<main>` forks by classes (pattern A) — same string as the predict
          list and the dashboard. Every value the old class list resolved to at
          >=780 is restored at `md:`. */}
      <main className="mx-auto w-full max-w-[1600px] px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+24px)] md:px-8 md:py-10 md:pb-10 lg:px-12 xl:px-16">
        {/*
          MOBILE HERO (pattern B — fork the subtree).
          Canvas: screens-mobile.jsx `MobPredictScreen`, README §3.2 — a
          compact hero where the countdown, not the track, is the headline.
          The desktop 3-column hero below is `display:none` here.
          `uppercase` is explicit: the global `[style*="Boldonse"]` selector
          is case-sensitive and matches nothing (MobilePrimitives.tsx).

          R-1 shrinks this block (h1 36 -> 32, TrackDiagram 54 -> 48, card
          padding 16/14 -> 14/12, countdown 26 -> 24). Those are not taste:
          the grid-first reorder below pushes ~200px of picker above the fold,
          and the 390x1540 artboard only closes if the hero gives it back.
        */}
        <div className="md:hidden">
          <MobEyebrow>
            Round {String(event.round).padStart(2, "0")} ·{" "}
            {SESSION_LABEL[event.session_type]} · Picks needed
          </MobEyebrow>
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <h1
              className="m-0 uppercase"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: 32,
                lineHeight: 0.9,
              }}
            >
              {short}
              <br />
              <span className="text-[color:var(--fg-muted)]">Grand Prix</span>
            </h1>
            <div className="shrink-0" aria-hidden>
              <TrackDiagram
                circuit={event.ergast_circuit_id ?? event.circuit}
                height={48}
                stroke="var(--fg-muted)"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3">
            <div>
              <MobEyebrow>Locks in</MobEyebrow>
              <p
                className="mt-1"
                data-tabular
                style={{
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontSize: 24,
                  lineHeight: 1.1,
                }}
              >
                {lockCountdown}
              </p>
            </div>
            <p
              className="shrink-0 text-right uppercase text-[color:var(--fg-subtle)]"
              data-tabular
              style={{
                fontSize: 9,
                letterSpacing: "0.08em",
                lineHeight: 1.6,
              }}
            >
              {startParts.day}
              <br />
              {startParts.time}
            </p>
          </div>
        </div>

        {/* Hero — 3 cols: round info + name | track diagram | countdown */}
        <section className="hidden items-end gap-8 border-b border-[color:var(--border)] pb-8 md:grid lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p
              className="mb-3 text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.18em" }}
              data-tabular
            >
              Round {event.round} · {SESSION_LABEL[event.session_type]} ·
              Picks needed
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
          </div>

          <div className="hidden justify-center lg:flex">
            <TrackDiagram
              circuit={event.ergast_circuit_id ?? event.circuit}
              size={260}
              stroke="var(--fg-muted)"
              strokeWidth={2}
            />
          </div>

          <div className="lg:text-right">
            <p
              className="mb-1 text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.12em" }}
              data-tabular
            >
              Locks in
            </p>
            <p
              className="leading-none"
              data-tabular
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: "clamp(32px, 4vw, 56px)",
                fontWeight: 500,
              }}
            >
              {lockCountdown}
            </p>
            <p
              className="mt-2 text-xs uppercase text-[color:var(--fg-muted)]"
              style={{ letterSpacing: "0.04em" }}
              data-tabular
            >
              {formatLocal(event.session_start_at)} ·{" "}
              {event.circuit.toUpperCase()}
              {meta && (
                <>
                  {" · "}
                  {meta.lengthKm.toFixed(3)} KM · {meta.laps} LAPS
                </>
              )}
            </p>
          </div>
        </section>

        <DriverPicker
          eventId={event.id}
          round={event.round}
          sessionLabel={sessionLabelOf(event.session_type).toUpperCase()}
          isSprint={isSprint}
          lockAt={event.lock_at}
          drivers={drivers ?? []}
          initialPicks={initialPicks}
          nudges={nudges}
          circuit={event.circuit}
          hotPicks={hotPicks}
          submit={submitPrediction}
        />
      </main>
    </>
  );
}
