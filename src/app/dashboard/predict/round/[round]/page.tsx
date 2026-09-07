import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { TopBar } from "@/components/TopBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { PracticeBanner } from "@/components/PracticeBanner";
import { MobSectionHead } from "@/components/MobilePrimitives";
import { teamMeta } from "@/lib/design/teams";
import { shortEventName } from "@/lib/design/eventName";
import { circuitMeta } from "@/lib/design/circuits";
import { formatDateRange } from "@/lib/design/dateRange";
import { sessionLabel, formatLocal } from "@/lib/sessionLabel";
import {
  groupByRound,
  type GroupableEvent,
} from "@/lib/predict/groupByRound";
import {
  isSprintSession,
  slotDriverIds,
  allSlotsFilled,
} from "@/lib/predict/slots";
import {
  loadPracticeForRound,
  type FpSession,
} from "@/lib/practice/loadPractice";

type EventRow = GroupableEvent & { openf1_meeting_key: number | null };

type DriverRow = { id: number; code: string; team: string };
type PredictionRow = {
  event_id: string;
  p1_driver_id: number | null;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";
const MONO_FONT = "var(--font-mono), ui-monospace, monospace";

function formatDelta(msUntil: number): string {
  if (msUntil <= 0) return "Locked";
  const totalSec = Math.floor(msUntil / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours.toString().padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

export default async function PredictRoundPage({
  params,
}: {
  params: Promise<{ round: string }>;
}) {
  const { round: roundStr } = await params;
  const round = Number(roundStr);
  if (!Number.isFinite(round) || round < 1) notFound();

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

  const currentSeason = new Date().getUTCFullYear();
  const { data: roundSessions } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, lock_at, revealed_at, ergast_circuit_id, openf1_meeting_key",
    )
    .eq("season", currentSeason)
    .eq("round", round)
    .order("session_start_at", { ascending: true })
    .returns<EventRow[]>();

  if (!roundSessions || roundSessions.length === 0) notFound();

  const [grouped] = groupByRound(roundSessions, "asc");
  if (!grouped) notFound();

  // Free Practice form guide (changes.md §6). On-demand, cached ~15 min,
  // best-effort: an OpenF1 hiccup must never break this page (the critical
  // path for locking predictions), so the banner just renders nothing.
  let practice: FpSession[] = [];
  try {
    const meetingKey = roundSessions[0]?.openf1_meeting_key ?? null;
    practice = await loadPracticeForRound(createSupabaseServiceClient(), {
      season: currentSeason,
      round,
      meetingKey,
    });
  } catch {
    practice = [];
  }

  const sessionIds = grouped.sessions.map((s) => s.id);

  const [{ data: myPicksRows }, { data: drivers }] = await Promise.all([
    myId
      ? supabase
          .from("predictions")
          .select("event_id, p1_driver_id, p2_driver_id, p3_driver_id")
          .eq("user_id", myId)
          .in("event_id", sessionIds)
      : Promise.resolve({ data: [] as unknown as null }),
    supabase
      .from("drivers")
      .select("id, code, team")
      .eq("active", true),
  ]);

  const driverById = new Map(
    (drivers ?? []).map((d) => [
      d.id as number,
      d as DriverRow,
    ]),
  );
  const picksByEventId = new Map<string, PredictionRow>();
  for (const p of (myPicksRows ?? []) as PredictionRow[]) {
    picksByEventId.set(p.event_id, p);
  }

  const meta = circuitMeta(
    grouped.ergast_circuit_id ?? grouped.circuit,
  );
  const short = shortEventName(grouped.name);
  const roundLabel = String(grouped.round).padStart(2, "0");

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const filledCount = grouped.sessions.filter((s) =>
    picksByEventId.has(s.id),
  ).length;

  return (
    <>
      <TopBar
        active="predict"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <MobileTabBar active="predict" />
      {/*
        `flex flex-col` + explicit `order-*` below the fork, `md:block` at and
        above it. The addendum's artboard puts the practice banner AFTER the
        hero; this page has always rendered it before (it predates the hero).
        Reordering in source would move it on desktop too and break the
        0-diff-at-1440 contract, so the mobile order is expressed as flex
        order instead. `order` is inert under `display: block`, so every
        `order-*` here is a no-op at `md:` — the desktop box tree is untouched.
      */}
      <main className="mx-auto flex w-full max-w-[1600px] flex-col px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+24px)] md:block md:px-8 md:py-10 md:pb-10 lg:px-12 xl:px-16">
        {/* Breadcrumb — pattern B. The mobile line is a different string, not
            a restyled one, so the two trees are separate. The duplicated
            hrefs are safe: the e2e session-link locators match
            `a[href^="/dashboard/predict/"]` (with the trailing slash), which
            neither `/dashboard/predict` nor a `/round/` link satisfies. */}
        <p
          className="order-1 flex items-baseline justify-between gap-3 uppercase text-[color:var(--fg-muted)] md:hidden"
          style={{ fontSize: 9, letterSpacing: "0.12em" }}
          data-tabular
        >
          <span>
            ←{" "}
            <Link href="/dashboard/predict" className="text-[color:var(--fg)]">
              Predict
            </Link>
            {" · "}Round {roundLabel}
          </span>
          <Link
            href={`/dashboard/lobby/round/${grouped.round}`}
            className="text-[color:var(--accent)]"
          >
            Lobby →
          </Link>
        </p>

        <p
          className="mb-3 hidden text-xs uppercase text-[color:var(--fg-muted)] md:block"
          style={{ letterSpacing: "0.12em" }}
          data-tabular
        >
          ←{" "}
          <Link
            href="/dashboard/predict"
            className="text-[color:var(--fg)] hover:text-[color:var(--accent)]"
          >
            /dashboard/predict
          </Link>
          {" · "}/round/{roundLabel}
          {"  ·  "}
          <Link
            href={`/dashboard/lobby/round/${grouped.round}`}
            className="text-[color:var(--fg)] hover:text-[color:var(--accent)]"
          >
            View the Lobby →
          </Link>
        </p>

        {/* `md:contents` erases this wrapper's box at the fork so the banner's
            own <section> stays a direct child of <main>, exactly as today. */}
        <div className="order-3 mt-5 md:contents">
          <PracticeBanner sessions={practice} />
        </div>

        <section className="order-2 mt-[18px] grid items-end gap-12 pb-0 md:mt-0 md:border-b md:border-[color:var(--border)] md:pb-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {/* Font size and tracking live in classes, not the inline style
                they used to: an inline `fontSize` wins over `md:text-xs` and
                would pin the eyebrow at 9px on desktop. */}
            <p
              className="mb-2.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-[color:var(--accent)] md:mb-3 md:gap-2 md:text-xs md:tracking-[0.18em]"
              data-tabular
            >
              <span
                aria-hidden
                className="inline-block size-[5px] rounded-full bg-[color:var(--accent)] md:size-2"
              />
              Round {roundLabel} ·{" "}
              {grouped.hasSprint ? "Sprint weekend" : "Race weekend"} ·{" "}
              {filledCount}/{grouped.sessions.length} locked
            </p>

            {/* B′ — below the fork the h1 and the mobile track diagram share a
                flex row; `md:contents` puts the h1 back as a direct child of
                this div at the fork, so the desktop box tree is unchanged. */}
            <div className="flex items-end justify-between gap-2 md:contents">
              <h1
                className="m-0 text-[length:36px] tracking-[-0.01em] md:text-[length:clamp(48px,6vw,76px)] md:tracking-[-0.015em]"
                style={{
                  fontFamily: DISPLAY_FONT,
                  lineHeight: 0.9,
                }}
              >
                {short.toUpperCase()}
                <br />
                <span className="text-[color:var(--fg-muted)]">GRAND PRIX</span>
              </h1>
              {/* The desktop diagram (below) is `size`-driven and starts at
                  `lg`; this one is `height`-driven per the addendum §A.2 and
                  is the only one that exists below the fork. */}
              <TrackDiagram
                circuit={grouped.ergast_circuit_id ?? grouped.circuit}
                height={54}
                stroke="var(--fg-muted)"
                className="shrink-0 md:hidden"
              />
            </div>

            <p
              className="mt-3 text-[9px] uppercase tracking-[0.08em] text-[color:var(--fg-muted)] md:mt-4 md:text-xs md:tracking-[0.04em]"
              data-tabular
            >
              {formatDateRange(
                grouped.weekendStart,
                grouped.weekendEnd,
              ).toUpperCase()}{" "}
              · {grouped.circuit.toUpperCase()}
              {meta && (
                <>
                  {" · "}
                  {meta.lengthKm.toFixed(3)} KM · {meta.laps} LAPS
                </>
              )}
            </p>
          </div>

          <div className="hidden justify-end lg:flex">
            <TrackDiagram
              circuit={grouped.ergast_circuit_id ?? grouped.circuit}
              size={300}
              stroke="var(--fg-muted)"
              strokeWidth={2}
            />
          </div>
        </section>

        <MobSectionHead
          className="order-4 mt-6 md:hidden"
          title="Sessions"
          meta={`${grouped.sessions.length} · picks required`}
        />

        {/* Full-bleed hairline list below the fork; today's bordered 1px-gap
            grid at and above it. Border widths are written per side — a
            base `border` shorthand would sort before an `md:` longhand and
            outlive it (CLAUDE.md / PR-2 §footguns). */}
        <section className="order-5 -mx-5 grid gap-0 border-t border-b border-l-0 border-r-0 border-[color:var(--border)] bg-transparent md:mx-0 md:mt-10 md:gap-px md:border-l md:border-r md:bg-[color:var(--border)]">
          {grouped.sessions.map((s) => {
            const pick = picksByEventId.get(s.id);
            const lockMs = new Date(s.lock_at).getTime() - nowMs;
            const locked = lockMs <= 0;
            const isSprint = isSprintSession(s.session_type);
            const slotIds = slotDriverIds(s.session_type, pick);
            const allFilled = allSlotsFilled(slotIds);
            const cta = locked
              ? allFilled
                ? "View picks"
                : "Locked"
              : allFilled
                ? "Edit picks →"
                : "Lock in picks →";
            // The mobile row's CTA is the addendum's shorter set (§A.4) —
            // "Edit picks →" does not fit beside three chips at 390.
            const mobileCta = locked
              ? allFilled
                ? "View picks"
                : "Locked"
              : allFilled
                ? "Edit →"
                : "Pick →";
            const status = locked
              ? allFilled
                ? "Locked · picks in"
                : "Locked · no picks"
              : allFilled
                ? "Picks saved · still editable"
                : "Open · pick now";
            const dot = locked
              ? "var(--fg-subtle)"
              : allFilled
                ? "var(--success)"
                : "var(--accent)";
            const clockColor = locked
              ? "var(--fg-subtle)"
              : lockMs <= 60_000
                ? "var(--warning)"
                : "var(--fg)";
            // Row emphasis is mobile-only: the one open, unfilled session
            // gets the surface lift + the sanctioned 3px inset accent edge;
            // locked rows drop back. All of it resets at the fork, where
            // every row is `--surface` on a 1px grid as today.
            const emphasis = locked
              ? "opacity-70 bg-transparent md:opacity-100"
              : allFilled
                ? "bg-transparent"
                : "bg-[color:var(--surface-2)] shadow-[inset_3px_0_0_0_var(--accent)] md:shadow-none";
            return (
              <Link
                key={s.id}
                href={`/dashboard/predict/${s.id}`}
                className={`block border-b border-[color:var(--border)] px-5 pt-3.5 pb-4 transition-colors last:border-b-0 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center md:gap-6 md:border-b-0 md:bg-[color:var(--surface)] md:px-6 md:pt-5 md:pb-5 md:hover:bg-[color:var(--surface-2)] ${emphasis}`}
              >
                {/* ---- mobile tree (pattern B): three stacked blocks ---- */}
                <div className="md:hidden">
                  <p
                    className="flex items-center gap-1.5 uppercase text-[color:var(--fg-subtle)]"
                    style={{ fontSize: 9, letterSpacing: "0.14em" }}
                    data-tabular
                  >
                    <span
                      aria-hidden
                      className="inline-block size-[5px] shrink-0 rounded-full"
                      style={{ background: dot }}
                    />
                    {status}
                  </p>

                  <div className="mt-2 flex items-end justify-between gap-2.5">
                    <div className="min-w-0">
                      <p
                        className="leading-none uppercase"
                        style={{ fontFamily: DISPLAY_FONT, fontSize: 20 }}
                      >
                        {sessionLabel(s.session_type).toUpperCase()}
                      </p>
                      <p
                        className="mt-1.5 uppercase text-[color:var(--fg-muted)]"
                        style={{ fontSize: 9, letterSpacing: "0.06em" }}
                        data-tabular
                      >
                        {formatLocal(s.session_start_at).toUpperCase()} ·{" "}
                        {isSprint ? "P1 only" : "P1 · P2 · P3"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className="uppercase text-[color:var(--fg-subtle)]"
                        style={{ fontSize: 8, letterSpacing: "0.12em" }}
                        data-tabular
                      >
                        {locked ? "Locked" : "Locks in"}
                      </p>
                      <p
                        className="mt-[3px] leading-none"
                        style={{
                          fontFamily: MONO_FONT,
                          fontSize: 17,
                          color: clockColor,
                        }}
                        data-tabular
                      >
                        {/* The label directly above already reads "Locked";
                            repeating formatDelta's "Locked" under it at 17px
                            stutters, so the mobile clock falls back to the
                            artboard's em-dash. Desktop keeps the word. */}
                        {locked ? "—" : formatDelta(lockMs)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    {slotIds.map((id, idx) => {
                      const d = id ? driverById.get(id) : null;
                      const t = d ? teamMeta(d.team) : null;
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5"
                          style={{
                            padding: "5px 8px",
                            background: t?.hex
                              ? `color-mix(in oklch, ${t.hex} 13%, transparent)`
                              : "var(--surface-2)",
                            border: t?.hex
                              ? `1px solid ${t.hex}`
                              : "1px dashed var(--border)",
                            color: d ? "var(--fg)" : "var(--fg-subtle)",
                          }}
                        >
                          <span
                            style={{ fontSize: 8, letterSpacing: "0.1em" }}
                            data-tabular
                          >
                            P{idx + 1}
                          </span>
                          <span
                            style={{ fontFamily: DISPLAY_FONT, fontSize: 12 }}
                          >
                            {d ? d.code : "—"}
                          </span>
                        </span>
                      );
                    })}
                    <span
                      className="ml-auto shrink-0 uppercase"
                      style={{
                        fontFamily: MONO_FONT,
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        color: locked ? "var(--fg-subtle)" : "var(--accent)",
                      }}
                    >
                      {mobileCta}
                    </span>
                  </div>
                </div>

                {/* ---- desktop tree, unchanged (pattern B′) ----
                    `md:contents` erases this wrapper at the fork, so the three
                    divs below remain the grid's direct children and the 1440
                    render is byte-identical. */}
                <div className="hidden md:contents">
                  <div className="min-w-0">
                    <p
                      className="flex items-center gap-2 text-[10px] uppercase text-[color:var(--fg-subtle)]"
                      style={{ letterSpacing: "0.14em" }}
                      data-tabular
                    >
                      <span
                        aria-hidden
                        className="inline-block size-1.5 rounded-full"
                        style={{ background: dot }}
                      />
                      {status}
                    </p>
                    <p
                      className="mt-2 leading-none"
                      style={{
                        fontFamily: DISPLAY_FONT,
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
                      {formatLocal(s.session_start_at).toUpperCase()} ·{" "}
                      {isSprint ? "P1 only" : "P1 · P2 · P3"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {slotIds.map((id, idx) => {
                      const d = id ? driverById.get(id) : null;
                      const t = d ? teamMeta(d.team) : null;
                      return (
                        <span
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs"
                          style={{
                            background: t?.hex
                              ? `${t.hex}22`
                              : "var(--surface-2)",
                            border: t?.hex
                              ? `1px solid ${t.hex}66`
                              : "1px dashed var(--border)",
                            color: d ? "var(--fg)" : "var(--fg-subtle)",
                          }}
                        >
                          <span
                            className="text-[10px] uppercase"
                            style={{ letterSpacing: "0.1em" }}
                            data-tabular
                          >
                            P{idx + 1}
                          </span>
                          <span
                            style={
                              d ? { fontFamily: DISPLAY_FONT } : undefined
                            }
                          >
                            {d ? d.code : "—"}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                      style={{ letterSpacing: "0.12em" }}
                      data-tabular
                    >
                      {locked ? "Locked" : "Locks in"}
                    </span>
                    <span
                      className="leading-none"
                      style={{
                        fontFamily: MONO_FONT,
                        fontSize: 22,
                        color: clockColor,
                      }}
                      data-tabular
                    >
                      {formatDelta(lockMs)}
                    </span>
                    <span
                      className="mt-2 px-3 py-1.5 text-[11px] uppercase"
                      style={{
                        fontFamily: MONO_FONT,
                        letterSpacing: "0.08em",
                        background: locked ? "transparent" : "var(--accent)",
                        color: locked ? "var(--fg-muted)" : "#000",
                        border: locked ? "1px solid var(--border)" : "none",
                      }}
                    >
                      {cta}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
    </>
  );
}
