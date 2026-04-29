import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/adminGuard";
import { AdminStrip } from "../../../admin-strip";
import { TrackDiagram } from "@/components/TrackDiagram";
import { shortEventName, eventCountry } from "@/lib/design/eventName";
import { countryFlag } from "@/lib/design/drivers";
import { sessionLabel, formatLocal } from "@/lib/sessionLabel";

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

type SessionState =
  | "future"
  | "awaiting"
  | "entered"
  | "revealed";

const STATE_META: Record<
  SessionState,
  { label: string; color: string; cta: string }
> = {
  future: {
    label: "Future",
    color: "var(--fg-subtle)",
    cta: "View picks",
  },
  awaiting: {
    label: "Awaiting results",
    color: "var(--accent)",
    cta: "File results →",
  },
  entered: {
    label: "Filed · not revealed",
    color: "var(--warning)",
    cta: "Edit results",
  },
  revealed: {
    label: "Revealed",
    color: "var(--success)",
    cta: "Edit results",
  },
};

export default async function AdminResultsRoundPage({
  params,
}: {
  params: Promise<{ round: string }>;
}) {
  const guard = await currentAdmin();
  const { round: roundStr } = await params;
  const round = Number(roundStr);

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

  if (!Number.isFinite(round) || round < 1) notFound();

  const supabase = await createSupabaseServerClient();
  const currentSeason = new Date().getUTCFullYear();
  const nowIso = new Date().toISOString();

  const { data: sessions } = await supabase
    .from("events")
    .select(
      "id, name, round, circuit, session_type, session_start_at, ergast_circuit_id, revealed_at",
    )
    .eq("season", currentSeason)
    .eq("round", round)
    .order("session_start_at", { ascending: true })
    .returns<EventRow[]>();

  if (!sessions || sessions.length === 0) notFound();

  const sessionIds = sessions.map((s) => s.id);
  const [{ data: results }, { data: predictions }] = await Promise.all([
    supabase
      .from("results")
      .select("event_id")
      .in("event_id", sessionIds),
    supabase
      .from("predictions")
      .select("event_id")
      .in("event_id", sessionIds),
  ]);
  const haveResults = new Set(
    (results ?? []).map((r) => r.event_id as string),
  );
  const pickCounts = new Map<string, number>();
  for (const p of (predictions ?? []) as { event_id: string }[]) {
    pickCounts.set(p.event_id, (pickCounts.get(p.event_id) ?? 0) + 1);
  }

  function deriveState(s: EventRow): SessionState {
    if (s.session_start_at > nowIso) return "future";
    if (!haveResults.has(s.id)) return "awaiting";
    if (!s.revealed_at) return "entered";
    return "revealed";
  }

  const first = sessions[0]!;
  const short = shortEventName(first.name);
  const flagEmoji = countryFlag(eventCountry(first.name));
  const attentionCount = sessions.filter(
    (s) => deriveState(s) === "awaiting",
  ).length;

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
          {" · "}/results/round/{round.toString().padStart(2, "0")}
        </p>

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
              File results · R{round.toString().padStart(2, "0")} ·{" "}
              <span aria-hidden>{flagEmoji}</span> {short} ·{" "}
              {attentionCount > 0
                ? `${attentionCount} awaiting`
                : "All filed"}
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
                {sessions.length} SESSION
                {sessions.length === 1 ? "" : "S"}
              </span>
            </h1>
            <p
              className="mt-4 text-xs uppercase text-[color:var(--fg-muted)]"
              style={{ letterSpacing: "0.04em" }}
              data-tabular
            >
              {first.circuit.toUpperCase()}
            </p>
          </div>

          <div className="hidden justify-end lg:flex">
            <TrackDiagram
              circuit={first.ergast_circuit_id ?? first.circuit}
              size={300}
              stroke="var(--fg-muted)"
              strokeWidth={2}
            />
          </div>
        </section>

        <section className="mt-10 grid gap-px bg-[color:var(--border)] border border-[color:var(--border)]">
          {sessions.map((s) => {
            const state = deriveState(s);
            const meta = STATE_META[state];
            const picks = pickCounts.get(s.id) ?? 0;
            return (
              <Link
                key={s.id}
                href={`/admin/results/${s.id}`}
                className="grid items-center gap-6 bg-[color:var(--surface)] px-6 py-5 transition-colors hover:bg-[color:var(--surface-2)]"
                style={{
                  gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) auto",
                }}
              >
                <div className="min-w-0">
                  <p
                    className="flex items-center gap-2 text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.14em",
                      color: meta.color,
                    }}
                    data-tabular
                  >
                    <span
                      aria-hidden
                      className="inline-block size-1.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    {meta.label}
                  </p>
                  <p
                    className="mt-2 leading-none"
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      fontSize: 30,
                      letterSpacing: "0.005em",
                    }}
                  >
                    {sessionLabel(s.session_type).toUpperCase()}
                  </p>
                  <p
                    className="mt-2 text-[11px] uppercase text-[color:var(--fg-muted)]"
                    style={{ letterSpacing: "0.06em" }}
                    data-tabular
                  >
                    {formatLocal(s.session_start_at).toUpperCase()}
                  </p>
                </div>

                <div
                  className="text-xs text-[color:var(--fg-muted)]"
                  data-tabular
                >
                  {picks} pick{picks === 1 ? "" : "s"}
                  {haveResults.has(s.id) && (
                    <span className="ml-2 text-[color:var(--success)]">
                      · ✓ filed
                    </span>
                  )}
                </div>

                <div className="flex justify-end">
                  <span
                    className="px-4 py-2 text-[11px] uppercase"
                    style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                      background:
                        state === "awaiting" ? "var(--accent)" : "transparent",
                      color: state === "awaiting" ? "#000" : "var(--fg)",
                      border:
                        state === "awaiting"
                          ? "none"
                          : "1px solid var(--border)",
                    }}
                  >
                    {meta.cta}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
    </>
  );
}
