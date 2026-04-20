import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionLabel, formatLocal } from "@/lib/sessionLabel";
import { RevealStage } from "./reveal-stage";

type EventRow = {
  id: string;
  name: string;
  circuit: string;
  round: number;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
  revealed_at: string | null;
};

export default async function RevealPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, circuit, round, session_type, session_start_at, revealed_at")
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
    { data: currentUser },
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
    supabase
      .from("drivers")
      .select("id, code, full_name, team"),
    supabase.from("users").select("id, email, display_name"),
    supabase
      .from("scores")
      .select("user_id, points, exact_matches, slot_mismatches, dnf_zeros, perfect_bonus")
      .eq("event_id", event.id),
    supabase.auth.getUser(),
  ]);

  const me = currentUser.user?.id ?? null;
  const myPick = (predictions ?? []).find((p) => p.user_id === me) ?? null;

  // Gate logic keys off event state, not visible-pick count. With a 1-user
  // league, "friend picks visible" is always 0 — so we check the actual
  // reveal condition instead: admin-triggered `revealed_at`, OR the 10-min
  // post-results fallback. `Date.now()` here is a request-time snapshot in
  // a Server Component render — no client re-render tearing risk.
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
      <RevealShell event={event}>
        <section className="rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-8">
          <p className="text-sm uppercase tracking-wider text-[color:var(--fg-subtle)]">
            Waiting on results
          </p>
          <p className="mt-3 text-[color:var(--fg-muted)]">
            Results haven&rsquo;t been filed yet. This page will light up the
            moment they do.
          </p>
        </section>
      </RevealShell>
    );
  }

  if (!picksAreOpen) {
    const fetchedAt = new Date(result.fetched_at).getTime();
    const fallbackAt = fetchedAt + 10 * 60 * 1000;
    return (
      <RevealShell event={event}>
        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-8">
          <p className="text-sm uppercase tracking-wider text-[color:var(--fg-subtle)]">
            Results are in
          </p>
          <p
            className="mt-3 text-xl"
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            Reveal opens shortly.
          </p>
          <p className="mt-3 text-sm text-[color:var(--fg-muted)]">
            Auto-opens at{" "}
            <span data-tabular>{formatLocal(new Date(fallbackAt))}</span>{" "}
            if the admin doesn&rsquo;t trigger it first.
          </p>
          {myPick && drivers && (
            <div className="mt-6 border-t border-[color:var(--border)] pt-6">
              <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
                Your pick (only you can see it)
              </p>
              <PickSummary pick={myPick} drivers={drivers} isSprint={sprint} />
            </div>
          )}
        </section>
      </RevealShell>
    );
  }

  return (
    <RevealShell event={event}>
      <RevealStage
        event={event}
        result={result}
        predictions={predictions ?? []}
        scores={scores ?? []}
        users={users ?? []}
        drivers={drivers ?? []}
        currentUserId={me}
        isSprint={sprint}
      />
    </RevealShell>
  );
}

function RevealShell({
  event,
  children,
}: {
  event: EventRow;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
      >
        ← Dashboard
      </Link>
      <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        Reveal · R{event.round.toString().padStart(2, "0")} ·{" "}
        {sessionLabel(event.session_type)}
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
      {children}
    </main>
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
            <span
              data-tabular
              className="w-8 text-[color:var(--fg-subtle)]"
            >
              {s.label}
            </span>
            <span>{d ? d.full_name.toUpperCase() : "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}
