import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/adminGuard";
import {
  fileResultsAction,
  fileResultsAndRevealAction,
  fetchFromOpenF1Action,
} from "./actions";
import { ResultsForm } from "./results-form";
import { AdminStrip } from "../../admin-strip";
import { TrackDiagram } from "@/components/TrackDiagram";
import { shortEventName, eventCountry } from "@/lib/design/eventName";
import { sessionLabel } from "@/lib/sessionLabel";
import { countryFlag } from "@/lib/design/drivers";

type EventRow = {
  id: string;
  name: string;
  round: number;
  circuit: string;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
  ergast_circuit_id: string | null;
  revealed_at: string | null;
};

type DriverRow = {
  id: number;
  code: string;
  full_name: string;
  team: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
};

type PredictionRow = {
  user_id: string;
  p1_driver_id: number | null;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "starts soon";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
    .select(
      "id, name, round, circuit, session_type, session_start_at, ergast_circuit_id, revealed_at",
    )
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const [
    { data: drivers },
    { data: existingResult },
    { data: predictions },
    { data: users },
  ] = await Promise.all([
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
    supabase
      .from("predictions")
      .select("user_id, p1_driver_id, p2_driver_id, p3_driver_id")
      .eq("event_id", event.id),
    supabase.from("users").select("id, email, display_name"),
  ]);

  const isSprint =
    event.session_type === "sprint_race" ||
    event.session_type === "sprint_quali";

  const short = shortEventName(event.name);
  const flagEmoji = countryFlag(eventCountry(event.name));

  return (
    <>
      <AdminStrip current="events" displayName={guard.displayName ?? null} />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        <p
          className="mb-3 text-xs uppercase text-[color:var(--fg-muted)]"
          style={{ letterSpacing: "0.12em" }}
          data-tabular
        >
          ←{" "}
          <Link
            href="/admin"
            className="text-[color:var(--fg)] hover:text-[color:var(--accent)]"
          >
            /admin
          </Link>
          {" · "}
          <Link
            href={`/admin/results/round/${event.round}`}
            className="text-[color:var(--fg)] hover:text-[color:var(--accent)]"
          >
            /round/{event.round.toString().padStart(2, "0")}
          </Link>
          {" · "}
          /{event.session_type}
        </p>

        {/* Hero — eyebrow + title left, track diagram right */}
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
              Enter results · R
              {event.round.toString().padStart(2, "0")} ·{" "}
              <span aria-hidden>{flagEmoji}</span> {short}
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
              <span className="text-[color:var(--fg-muted)]">
                {sessionLabel(event.session_type).toUpperCase()}
              </span>
            </h1>
            <p
              className="mt-4 text-xs uppercase text-[color:var(--fg-muted)]"
              style={{ letterSpacing: "0.04em" }}
              data-tabular
            >
              Session ended {timeAgo(event.session_start_at)} · Manual entry
              {existingResult ? " · Editing existing result" : ""}
            </p>
          </div>

          <div className="hidden justify-end lg:flex">
            <TrackDiagram
              circuit={event.ergast_circuit_id ?? event.circuit}
              size={300}
              stroke="var(--fg-muted)"
              strokeWidth={2}
            />
          </div>
        </section>

        <ResultsForm
          eventId={event.id}
          isSprint={isSprint}
          alreadyRevealed={Boolean(event.revealed_at)}
          drivers={(drivers ?? []) as DriverRow[]}
          users={(users ?? []) as UserRow[]}
          predictions={(predictions ?? []) as PredictionRow[]}
          existing={{
            p1: existingResult?.p1_driver_id ?? null,
            p2: existingResult?.p2_driver_id ?? null,
            p3: existingResult?.p3_driver_id ?? null,
          }}
          submit={fileResultsAction}
          submitAndReveal={fileResultsAndRevealAction}
          fetchFromOpenF1={fetchFromOpenF1Action}
        />
      </main>
    </>
  );
}
