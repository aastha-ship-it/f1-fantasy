import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionLabel, formatLocal } from "@/lib/sessionLabel";
import { TopBar } from "@/components/TopBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { teamMeta, type TeamMeta } from "@/lib/design/teams";
import { trackPath } from "@/lib/design/tracks";
import { RevealStage } from "./reveal-stage";

type EventRow = {
  id: string;
  name: string;
  circuit: string;
  round: number;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
  revealed_at: string | null;
  ergast_circuit_id: string | null;
};

export default async function RevealPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id ?? null;
  let myDisplayName: string | null = null;
  if (me) {
    const { data: meRow } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", me)
      .maybeSingle<{ display_name: string | null }>();
    myDisplayName = meRow?.display_name?.trim() ?? null;
    if (!myDisplayName) redirect("/profile?welcome=1");
  }

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, revealed_at, ergast_circuit_id",
    )
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const sprint =
    event.session_type === "sprint_race" ||
    event.session_type === "sprint_quali";

  const [
    { data: result },
    { data: predictions },
    { data: drivers },
    { data: users },
    { data: scores },
  ] = await Promise.all([
    supabase
      .from("results")
      .select("p1_driver_id, p2_driver_id, p3_driver_id, fetched_at")
      .eq("event_id", event.id)
      .maybeSingle<{
        p1_driver_id: number;
        p2_driver_id: number | null;
        p3_driver_id: number | null;
        fetched_at: string;
      }>(),
    supabase
      .from("predictions")
      .select("user_id, p1_driver_id, p2_driver_id, p3_driver_id")
      .eq("event_id", event.id),
    supabase.from("drivers").select("id, code, full_name, team"),
    supabase.from("users").select("id, email, display_name"),
    supabase
      .from("scores")
      .select(
        "user_id, points, exact_matches, slot_mismatches, dnf_zeros, perfect_bonus",
      )
      .eq("event_id", event.id),
  ]);

  const myPick = (predictions ?? []).find((p) => p.user_id === me) ?? null;

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const revealedAtMs = event.revealed_at
    ? new Date(event.revealed_at).getTime()
    : null;
  const fetchedAtMs = result ? new Date(result.fetched_at).getTime() : null;
  const picksAreOpen =
    (revealedAtMs !== null && nowMs >= revealedAtMs) ||
    (fetchedAtMs !== null && nowMs - fetchedAtMs >= 10 * 60 * 1000);

  if (!result) {
    return (
      <GatedShell
        event={event}
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      >
        <section className="border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-8">
          <p
            className="text-xs uppercase text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.12em" }}
            data-tabular
          >
            Waiting on results
          </p>
          <p className="mt-3 text-[color:var(--fg-muted)]">
            Results haven&rsquo;t been filed yet. This page will light up the
            moment they do.
          </p>
        </section>
      </GatedShell>
    );
  }

  if (!picksAreOpen) {
    const fallbackAt = new Date(
      new Date(result.fetched_at).getTime() + 10 * 60 * 1000,
    );
    return (
      <GatedShell
        event={event}
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      >
        <section className="border border-[color:var(--border)] bg-[color:var(--surface)] p-8">
          <p
            className="text-xs uppercase text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.12em" }}
            data-tabular
          >
            Results are in
          </p>
          <p
            className="mt-3 text-2xl"
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            REVEAL OPENS SHORTLY.
          </p>
          <p className="mt-3 text-sm text-[color:var(--fg-muted)]">
            Auto-opens at <span data-tabular>{formatLocal(fallbackAt)}</span>{" "}
            if the admin doesn&rsquo;t trigger it first.
          </p>
          {myPick && drivers && (
            <div className="mt-6 border-t border-[color:var(--border)] pt-6">
              <p
                className="text-xs uppercase text-[color:var(--fg-subtle)]"
                style={{ letterSpacing: "0.12em" }}
                data-tabular
              >
                Your pick (only you can see it)
              </p>
              <PickSummary
                pick={myPick}
                drivers={drivers}
                isSprint={sprint}
              />
            </div>
          )}
        </section>
      </GatedShell>
    );
  }

  // Reveal-open path: hand the cinematic hero off to the client stage so it
  // can drive the title-slam + livery-sweep + track-draw choreography.
  const winner = drivers?.find((d) => d.id === result.p1_driver_id) ?? null;
  const sweepTeam: TeamMeta | null = winner ? teamMeta(winner.team) : null;
  const short = shortEventName(event.name);
  const meta = circuitMeta(event.ergast_circuit_id ?? event.circuit);
  const circuitKey = event.ergast_circuit_id ?? event.circuit;
  const cinematicHero = {
    short,
    sessionType: sessionLabel(event.session_type),
    round: event.round,
    circuit: event.circuit,
    circuitKey,
    trackPath: trackPath(circuitKey),
    sessionStartAt: event.session_start_at,
    sessionDateLabel: formatLocal(new Date(event.session_start_at)),
    lengthKm: meta?.lengthKm ?? null,
    laps: meta?.laps ?? null,
  };

  return (
    <>
      <TopBar active="calendar" displayName={myDisplayName} email={userData.user?.email ?? null} />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        <RevealStage
          event={event}
          hero={cinematicHero}
          sweepTeam={sweepTeam}
          result={result}
          predictions={predictions ?? []}
          scores={scores ?? []}
          users={users ?? []}
          drivers={drivers ?? []}
          currentUserId={me}
          isSprint={sprint}
        />
      </main>
    </>
  );
}

function GatedShell({
  event,
  displayName,
  email,
  children,
}: {
  event: EventRow;
  displayName: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const short = shortEventName(event.name);
  const meta = circuitMeta(event.ergast_circuit_id ?? event.circuit);
  return (
    <>
      <TopBar active="calendar" displayName={displayName} email={email} />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        <section className="grid items-end gap-8 border-b border-[color:var(--border)] pb-8 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p
              className="mb-3 flex items-center gap-2 text-xs uppercase text-[color:var(--accent)]"
              style={{ letterSpacing: "0.18em" }}
              data-tabular
            >
              <span aria-hidden className="inline-block size-1.5 rounded-full bg-[color:var(--accent)]" />
              Reveal · R{event.round.toString().padStart(2, "0")} ·{" "}
              {sessionLabel(event.session_type).toUpperCase()}
            </p>
            <h1
              className="m-0"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: "clamp(48px, 7vw, 96px)",
                lineHeight: 0.9,
                letterSpacing: "-0.02em",
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
              className="text-xs uppercase text-[color:var(--fg-muted)]"
              style={{ letterSpacing: "0.04em" }}
              data-tabular
            >
              {formatLocal(new Date(event.session_start_at)).toUpperCase()}
              <br />
              {event.circuit.toUpperCase()}
              {meta && (
                <>
                  <br />
                  {meta.lengthKm.toFixed(3)} KM · {meta.laps} LAPS
                </>
              )}
            </p>
          </div>
        </section>

        <div className="mt-10">{children}</div>
      </main>
    </>
  );
}

function PickSummary({
  pick,
  drivers,
  isSprint,
}: {
  pick: {
    p1_driver_id: number | null;
    p2_driver_id: number | null;
    p3_driver_id: number | null;
  };
  drivers: { id: number; code: string; full_name: string }[];
  isSprint: boolean;
}) {
  const byId = new Map(drivers.map((d) => [d.id, d]));
  const slots = isSprint
    ? [{ label: "P1", id: pick.p1_driver_id }]
    : [
        { label: "P1", id: pick.p1_driver_id },
        { label: "P2", id: pick.p2_driver_id },
        { label: "P3", id: pick.p3_driver_id },
      ];
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {slots.map((s) => {
        const d = s.id !== null ? byId.get(s.id) : null;
        return (
          <li
            key={s.label}
            className="flex items-center gap-4 text-sm text-[color:var(--fg)]"
          >
            <span data-tabular className="w-8 text-[color:var(--fg-subtle)]">
              {s.label}
            </span>
            <span>{d ? d.full_name.toUpperCase() : "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}
