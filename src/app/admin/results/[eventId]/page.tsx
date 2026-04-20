import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/adminGuard";
import { fileResultsAction } from "./actions";
import { ResultsForm } from "./results-form";

type EventRow = {
  id: string;
  name: string;
  round: number;
  circuit: string;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
};

const SESSION_LABEL: Record<EventRow["session_type"], string> = {
  race: "Race",
  quali: "Qualifying",
  sprint_race: "Sprint",
  sprint_quali: "Sprint Qualifying",
};

function fmt(date: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export default async function AdminResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const guard = await currentAdmin();
  const { eventId } = await params;

  if (!guard.ok) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1
          className="mb-4 text-4xl leading-none"
          style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
        >
          FORBIDDEN
        </h1>
        <p className="text-[color:var(--error)]">
          {guard.reason === "unauthenticated"
            ? "Sign in to continue."
            : "This page is admin-only."}
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
        >
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, round, circuit, session_type, session_start_at")
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
      .from("results")
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

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <Link
        href="/admin"
        className="mb-6 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
      >
        ← All operations
      </Link>
      <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        {SESSION_LABEL[event.session_type]} · R
        {event.round.toString().padStart(2, "0")}
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
        <span data-tabular>{fmt(event.session_start_at)}</span>
      </p>

      <ResultsForm
        eventId={event.id}
        isSprint={isSprint}
        drivers={drivers ?? []}
        existing={{
          p1: existing?.p1_driver_id ?? null,
          p2: existing?.p2_driver_id ?? null,
          p3: existing?.p3_driver_id ?? null,
        }}
        submit={fileResultsAction}
      />
    </main>
  );
}
