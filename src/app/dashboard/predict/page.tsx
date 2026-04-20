import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const SESSION_ORDER: Record<EventRow["session_type"], number> = {
  sprint_quali: 0,
  sprint_race: 1,
  quali: 2,
  race: 3,
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

function slotsFor(t: EventRow["session_type"]): string {
  return t === "sprint_quali" || t === "sprint_race" ? "P1 only" : "P1 · P2 · P3";
}

export default async function PredictListPage() {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  // All upcoming scoring sessions across the next ~3 GP weekends.
  const { data: events } = await supabase
    .from("events")
    .select("id, name, circuit, round, session_type, session_start_at, lock_at")
    .gt("lock_at", nowIso)
    .order("session_start_at", { ascending: true })
    .limit(12);

  const rows = (events ?? []) as EventRow[];

  // Which events does the user already have a pick for?
  const { data: myPicks } = await supabase
    .from("predictions")
    .select("event_id")
    .in(
      "event_id",
      rows.length > 0 ? rows.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"],
    );
  const pickedEventIds = new Set((myPicks ?? []).map((p) => p.event_id as string));

  // Group by round/meeting.
  const byRound = new Map<number, EventRow[]>();
  for (const r of rows) {
    const list = byRound.get(r.round) ?? [];
    list.push(r);
    byRound.set(r.round, list);
  }
  const orderedRounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        Predict
      </p>
      <h1
        className="mb-8 leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: "clamp(40px, 4.5vw, 72px)",
        }}
      >
        UPCOMING
      </h1>

      {rows.length === 0 && (
        <p className="text-[color:var(--fg-muted)]">
          No open sessions right now. Check back when the next event opens.
        </p>
      )}

      <div className="flex flex-col gap-10">
        {orderedRounds.map(([round, sessions]) => {
          const meetingName = sessions[0]?.name;
          const circuit = sessions[0]?.circuit;
          const sorted = [...sessions].sort(
            (a, b) =>
              SESSION_ORDER[a.session_type] - SESSION_ORDER[b.session_type],
          );
          return (
            <section key={round}>
              <p className="mb-1 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
                Round {round} · {circuit}
              </p>
              <h2
                className="mb-4 text-3xl leading-none"
                style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
              >
                {meetingName?.toUpperCase()}
              </h2>
              <ul className="flex flex-col gap-3">
                {sorted.map((s) => {
                  const done = pickedEventIds.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
                    >
                      <Link
                        href={`/dashboard/predict/${s.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[color:var(--surface-2)]"
                      >
                        <div className="flex flex-col gap-1">
                          <p className="text-lg">
                            {SESSION_LABEL[s.session_type]}
                          </p>
                          <p
                            className="text-sm text-[color:var(--fg-muted)]"
                            data-tabular
                          >
                            {formatLocal(s.session_start_at)} · {slotsFor(s.session_type)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {done && (
                            <span className="rounded bg-[color:var(--surface-2)] px-2 py-1 text-xs uppercase tracking-wider text-[color:var(--success)]">
                              Picks in
                            </span>
                          )}
                          <span
                            aria-hidden
                            className="text-[color:var(--fg-subtle)]"
                          >
                            →
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <Link
        href="/dashboard"
        className="mt-12 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
      >
        ← Back to dashboard
      </Link>
    </main>
  );
}
