import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/adminGuard";
import { revealEventAction } from "./actions";
import { RevealButton } from "./reveal-button";
import { TrackDiagram } from "@/components/TrackDiagram";
import { AdminStrip } from "./admin-strip";
import {
  AdminMobile,
  type AdminStatusTile,
  type AdminEventRowDatum,
} from "./admin-mobile";
import { shortEventName, eventCountry } from "@/lib/design/eventName";
import { countryFlag } from "@/lib/design/drivers";
import { listLatestCronRuns } from "@/lib/cron/recordRun";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type SessionType = "race" | "quali" | "sprint_race" | "sprint_quali";

type EventRow = {
  id: string;
  name: string;
  circuit: string;
  round: number;
  season: number;
  session_type: SessionType;
  session_start_at: string;
  revealed_at: string | null;
  ergast_circuit_id: string | null;
};

type RoundState = "future" | "pending" | "entered" | "revealed" | "mixed";

type RoundEntry = {
  round: number;
  name: string;
  circuit: string;
  ergast_circuit_id: string | null;
  hasSprint: boolean;
  weekendStart: string;
  raceSession: EventRow | null;
  sessions: EventRow[];
  state: RoundState;
  /** The session admin should act on next (race > sprint > quali). */
  actionSessionId: string | null;
  pickCount: number; // friends who submitted picks for the race session
};

const STATE_META: Record<
  RoundState,
  { label: string; color: string; bg: string; action: string }
> = {
  pending: {
    label: "Results pending",
    color: "var(--accent)",
    bg: "color-mix(in oklch, var(--accent) 8%, transparent)",
    action: "Enter results →",
  },
  entered: {
    label: "Entered · Not revealed",
    color: "var(--warning)",
    bg: "color-mix(in oklch, var(--warning) 8%, transparent)",
    action: "Reveal to group →",
  },
  revealed: {
    label: "Revealed",
    color: "var(--success)",
    bg: "transparent",
    action: "View reveal",
  },
  future: {
    label: "Future",
    color: "var(--fg-subtle)",
    bg: "transparent",
    action: "View picks",
  },
  mixed: {
    label: "In progress",
    color: "var(--fg-muted)",
    bg: "transparent",
    action: "View picks",
  },
};

const CRON_SCHEDULE = [
  { path: "sync-f1-data", time: "04:00 UTC", label: "OpenF1 calendar + drivers" },
  { path: "fetch-results", time: "04:15 UTC", label: "Auto-fetch results" },
  { path: "refresh-jolpica-current", time: "04:20 UTC", label: "Jolpica delta" },
  { path: "refresh-nudges", time: "04:30 UTC", label: "Predict nudges" },
];

function formatRunTime(iso: string): string {
  const d = new Date(iso);
  const sameDay =
    new Date().toISOString().slice(0, 10) === iso.slice(0, 10);
  if (sameDay) {
    return d
      .toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      })
      .concat(" UTC");
  }
  // Older runs — collapse to "MMM D".
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default async function AdminHomePage() {
  const guard = await currentAdmin();
  if (!guard.ok) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1
          className="mb-4 text-4xl leading-none"
          style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
        >
          ADMIN
        </h1>
        <p className="text-[color:var(--error)]">
          {guard.reason === "unauthenticated"
            ? "Sign in to continue."
            : "Forbidden. This route is admin-only."}
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
  const svc = createSupabaseServiceClient();
  const currentSeason = new Date().getUTCFullYear();
  const nowIso = new Date().toISOString();

  // Latest run per cron path. The strip renders the actual ran_at +
  // success/error chip when present, falling back to the static schedule
  // copy for paths that haven't reported yet.
  const latestByPath = await listLatestCronRuns(
    svc,
    CRON_SCHEDULE.map((c) => c.path),
  );

  const [{ data: allSessions }, { data: results }, { data: predictionsAll }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, name, circuit, round, season, session_type, session_start_at, revealed_at, ergast_circuit_id",
        )
        .eq("season", currentSeason)
        .order("round", { ascending: true }),
      supabase.from("results").select("event_id"),
      supabase.from("predictions").select("event_id"),
    ]);

  const sessions = (allSessions ?? []) as EventRow[];
  const haveResults = new Set(
    (results ?? []).map((r) => r.event_id as string),
  );
  const predictionCountByEvent = new Map<string, number>();
  for (const p of (predictionsAll ?? []) as { event_id: string }[]) {
    predictionCountByEvent.set(
      p.event_id,
      (predictionCountByEvent.get(p.event_id) ?? 0) + 1,
    );
  }

  // Aggregate sessions by round.
  const byRound = new Map<number, EventRow[]>();
  for (const s of sessions) {
    const list = byRound.get(s.round) ?? [];
    list.push(s);
    byRound.set(s.round, list);
  }

  function deriveState(round: EventRow[]): {
    state: RoundState;
    actionId: string | null;
  } {
    const race = round.find((s) => s.session_type === "race") ?? null;
    if (!race) return { state: "future", actionId: null };
    const inFuture = race.session_start_at >= nowIso;
    if (inFuture) return { state: "future", actionId: race.id };

    // Past race. Look at race-only state for the dominant cell.
    if (!haveResults.has(race.id)) {
      return { state: "pending", actionId: race.id };
    }
    if (!race.revealed_at) {
      return { state: "entered", actionId: race.id };
    }
    // Race is revealed. Check if any sibling sessions still need results entered
    // (rare — sprint with no results filed). If so, "mixed". Else "revealed".
    const siblingPending = round.find(
      (s) =>
        s.session_type !== "race" &&
        s.session_start_at < nowIso &&
        !haveResults.has(s.id),
    );
    if (siblingPending) {
      return { state: "mixed", actionId: siblingPending.id };
    }
    return { state: "revealed", actionId: race.id };
  }

  const rounds: RoundEntry[] = [...byRound.entries()]
    .map(([round, list]) => {
      list.sort(
        (a, b) =>
          new Date(a.session_start_at).getTime() -
          new Date(b.session_start_at).getTime(),
      );
      const race = list.find((s) => s.session_type === "race") ?? null;
      const { state, actionId } = deriveState(list);
      return {
        round,
        name: race?.name ?? list[0]!.name,
        circuit: race?.circuit ?? list[0]!.circuit,
        ergast_circuit_id:
          race?.ergast_circuit_id ?? list[0]!.ergast_circuit_id ?? null,
        hasSprint: list.some(
          (s) =>
            s.session_type === "sprint_race" ||
            s.session_type === "sprint_quali",
        ),
        weekendStart: list[0]!.session_start_at,
        raceSession: race,
        sessions: list,
        state,
        actionSessionId: actionId,
        pickCount: race ? predictionCountByEvent.get(race.id) ?? 0 : 0,
      };
    })
    .sort((a, b) => a.round - b.round);

  const attentionCount = rounds.filter(
    (r) => r.state === "pending" || r.state === "entered",
  ).length;

  /* ---- Mobile shaping (design_handoff_mobile §6.3) ---------------------
     Reshapes what the desktop table already renders; no query changed. */
  const mobileTiles: AdminStatusTile[] = CRON_SCHEDULE.map((c) => {
    const last = latestByPath.get(c.path);
    return {
      label: c.path,
      value: last ? formatRunTime(last.ran_at) : c.time,
      valueColor: !last
        ? "var(--fg-subtle)"
        : last.status === "success"
          ? "var(--success)"
          : "var(--error)",
      meta: last
        ? last.status === "success"
          ? `${c.label} · ✓ success${last.duration_ms ? ` · ${last.duration_ms}ms` : ""}`
          : `${c.label} · ✗ ${last.error?.slice(0, 60) ?? "error"}`
        : `${c.label} · scheduled`,
      title: last?.error ?? undefined,
    };
  });

  const mobileEventRow = (
    r: RoundEntry,
    primaryAction: boolean,
  ): AdminEventRowDatum => {
    const meta = STATE_META[r.state];
    const needsAction = r.state === "pending" || r.state === "entered";
    const totalSessions = r.sessions.length;
    const withResults = r.sessions.filter((sn) => haveResults.has(sn.id)).length;
    return {
      round: r.round,
      name: shortEventName(r.name),
      date: new Date(r.weekendStart)
        .toLocaleDateString(undefined, { month: "short", day: "numeric" })
        .toUpperCase(),
      stateLabel: meta.label,
      stateColor: meta.color,
      needsAction,
      primaryAction,
      picksLine:
        r.state === "future"
          ? "Picks open T-7d"
          : `Picks ${r.pickCount}${
              totalSessions > 1 ? ` · ${withResults}/${totalSessions} results` : ""
            }`,
      actionHref:
        r.state === "revealed" && r.raceSession
          ? `/reveal/${r.raceSession.id}`
          : r.state === "pending" || r.state === "mixed"
            ? `/admin/results/round/${r.round}`
            : r.state === "entered" && r.actionSessionId
              ? `/admin/results/${r.actionSessionId}`
              : `/admin/results/round/${r.round}`,
      actionLabel: meta.action,
      revealEventId:
        r.state === "entered" && r.raceSession ? r.raceSession.id : null,
    };
  };

  /* "Action first" (the section's own meta line): rounds needing a decision,
     then finished rounds newest-first, then what is still to come. The
     desktop table stays in round order — a wide table is scanned as a
     calendar, a phone stack is worked as a queue. */
  const mobileEvents: AdminEventRowDatum[] = [
    ...rounds
      .filter((r) => r.state === "pending" || r.state === "entered")
      .sort((a, b) => b.round - a.round),
    ...rounds
      .filter((r) => r.state === "revealed" || r.state === "mixed")
      .sort((a, b) => b.round - a.round),
    ...rounds.filter((r) => r.state === "future").sort((a, b) => a.round - b.round),
  ].map((r, i) => mobileEventRow(r, i === 0 && attentionCount > 0));

  return (
    <>
      <AdminStrip current="events" displayName={guard.displayName ?? null} />
      {/*
        Gutters fork at md (pattern A). Admin renders no `MobileTabBar`, so
        the mobile bottom pad is plain breathing room — nothing here pins to
        `--tabbar-h` (handoff §6.3). `md:` restores the pre-fork px-8 / pt-10
        / pb-10.
      */}
      <main className="mx-auto w-full max-w-[1600px] px-5 pt-5 pb-10 md:px-8 md:pt-10 lg:px-12 xl:px-16">
        <AdminMobile
          attentionCount={attentionCount}
          tiles={mobileTiles}
          events={mobileEvents}
        />

        {/*
          Desktop tree, unchanged. `hidden md:contents` erases this wrapper's
          box at md so every child stays a direct child of <main>.
        */}
        <div className="hidden md:contents">
        <p
          className="mb-3 flex items-center gap-2 text-xs uppercase text-[color:var(--accent)]"
          style={{ letterSpacing: "0.18em" }}
          data-tabular
        >
          <span
            aria-hidden
            className="inline-block size-2 bg-[color:var(--accent)]"
          />
          Admin ·{" "}
          {attentionCount > 0
            ? `${attentionCount} attention needed`
            : "All clear"}
        </p>
        <h1
          className="m-0 leading-[0.9]"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: "clamp(48px, 7vw, 88px)",
            letterSpacing: "-0.015em",
          }}
        >
          EVENT CONTROL
        </h1>

        {/* System status strip — schedule + last-revealed signal. We don't
            persist cron run timestamps, so the strip shows the configured
            schedule from vercel.json plus the latest reveal as a soft signal
            that the chain has been running. */}
        <section
          className="mt-10 grid grid-cols-1 gap-px border border-[color:var(--border)] bg-[color:var(--border)] md:grid-cols-[1fr_1fr_1fr_1fr]"
        >
          {CRON_SCHEDULE.map((c) => {
            const last = latestByPath.get(c.path);
            const dotColor = !last
              ? "var(--fg-subtle)"
              : last.status === "success"
                ? "var(--success)"
                : "var(--error)";
            const headline = last ? formatRunTime(last.ran_at) : c.time;
            const subline = last
              ? last.status === "success"
                ? `${c.label} · ✓ success${last.duration_ms ? ` · ${last.duration_ms}ms` : ""}`
                : `${c.label} · ✗ ${last.error?.slice(0, 60) ?? "error"}`
              : `${c.label} · scheduled`;
            return (
              <div key={c.path} className="bg-[color:var(--surface)] p-5">
                <p
                  className="flex items-center gap-1.5 text-[10px] uppercase text-[color:var(--fg-subtle)]"
                  style={{ letterSpacing: "0.14em" }}
                  data-tabular
                >
                  <span
                    aria-hidden
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: dotColor }}
                  />
                  {c.path}
                </p>
                <p
                  className="mt-2 leading-none"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    fontSize: 28,
                    color:
                      last?.status === "error" ? "var(--error)" : "var(--fg)",
                  }}
                  data-tabular
                >
                  {headline}
                </p>
                <p
                  className="mt-1 text-xs text-[color:var(--fg-muted)]"
                  style={{ letterSpacing: "0.04em" }}
                  title={last?.error ?? undefined}
                >
                  {subline}
                </p>
              </div>
            );
          })}
        </section>

        {/* Events table */}
        <h2
          className="mt-12 mb-5 text-2xl"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            letterSpacing: "-0.005em",
          }}
        >
          EVENTS · {rounds.length}
        </h2>

        {/* Header row — a column legend for the desktop table. Below `md`
            each row renders as a stacked card instead of a table row, so
            the legend has nothing to label and is hidden rather than
            stacked into a meaningless list of single-word lines. */}
        <div
          className="hidden border-b border-[color:var(--border)] px-3 py-2 text-[10px] uppercase text-[color:var(--fg-subtle)] md:grid md:grid-cols-[32px_80px_32px_minmax(0,1fr)_100px_96px_140px_minmax(0,1fr)_200px] md:items-center md:gap-3"
          style={{
            letterSpacing: "0.12em",
          }}
          data-tabular
        >
          <span>R</span>
          <span></span>
          <span></span>
          <span>Event</span>
          <span>Date</span>
          <span>Sessions</span>
          <span>State</span>
          <span>Picks</span>
          <span className="text-right">Action</span>
        </div>

        <ul>
          {rounds.map((r) => {
            const stateMeta = STATE_META[r.state];
            const eventName = shortEventName(r.name);
            const actionHref =
              r.state === "revealed" && r.raceSession
                ? `/reveal/${r.raceSession.id}`
                : r.state === "pending" || r.state === "mixed"
                  ? `/admin/results/round/${r.round}`
                  : r.state === "entered" && r.actionSessionId
                    ? `/admin/results/${r.actionSessionId}`
                    : `/admin/results/round/${r.round}`;
            const flagEmoji = countryFlag(eventCountry(r.name));
            const date = new Date(r.weekendStart).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" },
            );
            const sessionsLabel = r.hasSprint ? "Q · SQ · S · R" : "Q · R";
            const totalSessions = r.sessions.length;
            const sessionsWithResults = r.sessions.filter((s) =>
              haveResults.has(s.id),
            ).length;
            return (
              <li
                key={r.round}
                className="grid grid-cols-1 items-start gap-2 border-b border-[color:var(--border)] px-3 py-3.5 md:grid-cols-[32px_80px_32px_minmax(0,1fr)_100px_96px_140px_minmax(0,1fr)_200px] md:items-center md:gap-3"
                style={{
                  background: stateMeta.bg,
                }}
              >
                <span
                  className="leading-none"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    fontSize: 18,
                  }}
                  data-tabular
                >
                  {r.round}
                </span>
                <TrackDiagram
                  circuit={r.ergast_circuit_id ?? r.circuit}
                  size={68}
                  stroke="var(--fg-subtle)"
                  strokeWidth={1.5}
                />
                <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
                  {flagEmoji}
                </span>
                <div className="min-w-0">
                  <p
                    className="truncate text-sm leading-tight"
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {eventName.toUpperCase()}
                  </p>
                  <p
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                    style={{ letterSpacing: "0.06em" }}
                    data-tabular
                  >
                    {r.circuit}
                  </p>
                </div>
                {/* Below `md` these three cells only make sense with a
                    table header for context, which is now hidden — so each
                    gets its own mobile-only label. `md:contents` keeps the
                    wrapper transparent to the desktop grid, so at `md` and
                    up the label disappears and the value span becomes a
                    direct grid child again, unchanged from before. */}
                <div className="flex flex-col gap-0.5 md:contents">
                  <span
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)] md:hidden"
                    style={{ letterSpacing: "0.06em" }}
                  >
                    Date
                  </span>
                  <span
                    className="text-xs text-[color:var(--fg-muted)]"
                    style={{ letterSpacing: "0.04em" }}
                    data-tabular
                  >
                    {date}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 md:contents">
                  <span
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)] md:hidden"
                    style={{ letterSpacing: "0.06em" }}
                  >
                    Sessions
                  </span>
                  <span
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                    style={{ letterSpacing: "0.06em" }}
                    data-tabular
                  >
                    {sessionsLabel}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 md:contents">
                  <span
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)] md:hidden"
                    style={{ letterSpacing: "0.06em" }}
                  >
                    Status
                  </span>
                  <span
                    className="text-[10px] uppercase font-semibold"
                    style={{
                      color: stateMeta.color,
                      letterSpacing: "0.08em",
                    }}
                    data-tabular
                  >
                    ● {stateMeta.label}
                  </span>
                </div>
                <span
                  className="text-[11px] text-[color:var(--fg-muted)]"
                  data-tabular
                >
                  {r.state === "future" ? (
                    <span className="text-[color:var(--fg-subtle)]">
                      — picks open T-7d
                    </span>
                  ) : (
                    <>
                      {r.pickCount} pick{r.pickCount === 1 ? "" : "s"}
                      {totalSessions > 1 && (
                        <span className="ml-1 text-[color:var(--fg-subtle)]">
                          · {sessionsWithResults}/{totalSessions} results
                        </span>
                      )}
                    </>
                  )}
                </span>
                <div className="flex justify-end">
                  {r.state === "entered" && r.raceSession ? (
                    <RevealButton
                      eventId={r.raceSession.id}
                      action={revealEventAction}
                    />
                  ) : (
                    <Link
                      href={actionHref}
                      className="w-full px-4 py-2 text-center text-[11px] uppercase transition-colors md:w-auto md:text-left"
                      style={{
                        background:
                          r.state === "pending" || r.state === "mixed"
                            ? "var(--accent)"
                            : "transparent",
                        color:
                          r.state === "pending" || r.state === "mixed"
                            ? "#000"
                            : "var(--fg)",
                        border:
                          r.state === "pending" || r.state === "mixed"
                            ? "none"
                            : "1px solid var(--border)",
                        fontFamily:
                          "var(--font-mono), ui-monospace, monospace",
                        letterSpacing: "0.08em",
                        fontWeight: 600,
                      }}
                    >
                      {stateMeta.action}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        </div>

        {/* Outside the fork: the only way back to the player app, and the
            phone's only route to sign-out (which lives on /profile). */}
        <Link
          href="/dashboard"
          className="mt-8 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)] md:mt-12"
          style={{ letterSpacing: "0.06em" }}
        >
          ← Back to dashboard
        </Link>
      </main>
    </>
  );
}
