import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LockCountdown } from "../lock-countdown";
import { DriverPicker } from "../driver-picker";
import { submitPrediction } from "../actions";

type EventRow = {
  id: string;
  name: string;
  circuit: string;
  round: number;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
  lock_at: string;
};

const SESSION_LABEL: Record<EventRow["session_type"], string> = {
  race: "Race",
  quali: "Qualifying",
  sprint_race: "Sprint",
  sprint_quali: "Sprint Qualifying",
};

function formatLocal(date: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return new Date(date).toISOString();
  }
}

export default async function PredictEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, circuit, round, session_type, session_start_at, lock_at")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (!event) notFound();

  const [{ data: drivers }, { data: existing }] = await Promise.all([
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
  ]);

  const isSprint =
    event.session_type === "sprint_race" ||
    event.session_type === "sprint_quali";
  const initialPicks = {
    p1: existing?.p1_driver_id ?? null,
    p2: existing?.p2_driver_id ?? null,
    p3: existing?.p3_driver_id ?? null,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/dashboard/predict"
        className="mb-6 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
      >
        ← All upcoming sessions
      </Link>
      <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        {SESSION_LABEL[event.session_type]}
      </p>
      <h1
        className="mb-2 leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: "clamp(40px, 4.5vw, 72px)",
        }}
      >
        {event.name.toUpperCase()}
      </h1>
      <p className="mb-10 text-[color:var(--fg-muted)]">
        {event.circuit} ·{" "}
        <span data-tabular>{formatLocal(event.session_start_at)}</span>
      </p>

      <section className="mb-10">
        <LockCountdown lockAt={event.lock_at} />
      </section>

      <DriverPicker
        eventId={event.id}
        isSprint={isSprint}
        lockAt={event.lock_at}
        drivers={drivers ?? []}
        initialPicks={initialPicks}
        submit={submitPrediction}
      />
    </main>
  );
}
