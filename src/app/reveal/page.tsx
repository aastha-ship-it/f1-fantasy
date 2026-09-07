import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { shortEventName, eventCountry } from "@/lib/design/eventName";
import { countryFlag } from "@/lib/design/drivers";
import { teamHex } from "@/lib/design/teams";
import { sessionLabel } from "@/lib/sessionLabel";
import { pillFill } from "@/lib/reveal/pillFill";
import {
  ShowReelMobile,
  type ShowReelChip,
  type ShowReelRound,
} from "./show-reel-mobile";

/**
 * /reveal — index of every revealed cinematic in the current season.
 *
 * One row per session (sprint quali / sprint / quali / race). The most
 * recent reveal sits at the top. Each row carries the user's score for
 * that event when one exists, and links into the cinematic at
 * `/reveal/[eventId]` where the Framer Motion choreography auto-plays.
 */

type SessionType = "race" | "quali" | "sprint_race" | "sprint_quali";

type EventRow = {
  id: string;
  name: string;
  circuit: string;
  round: number;
  session_type: SessionType;
  session_start_at: string;
  revealed_at: string;
  ergast_circuit_id: string | null;
};

type ScoreRow = {
  event_id: string;
  points: number;
  perfect_bonus: boolean;
};

type ResultRow = {
  event_id: string;
  p1_driver_id: number;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};

type DriverRow = {
  id: number;
  code: string | null;
  team: string | null;
};

const SESSION_PILL_LABEL: Record<SessionType, string> = {
  sprint_quali: "SQ",
  sprint_race: "S",
  quali: "Q",
  race: "R",
};

const SESSION_ORDER: Record<SessionType, number> = {
  sprint_quali: 0,
  sprint_race: 1,
  quali: 2,
  race: 3,
};

function formatRevealedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "moments ago";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * "APR 19" — the round's headline date.
 *
 * Read in UTC on purpose. `session_start_at` is a `timestamptz`, and pairing a
 * locale month with a UTC day is exactly the defect commit 961a600 fixed in
 * `dateRange.ts`: in IST a late-evening session resolves to the next local day
 * and the label lies by one. Server-computed like every other date string on
 * this page, so SSR and hydration agree.
 */
function formatRoundDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}

type RoundEntry = {
  round: number;
  name: string;
  circuit: string;
  ergast_circuit_id: string | null;
  /** Most recent revealed_at across the round — anchors sort order. */
  latestRevealedAt: string;
  /** Sessions in canonical SQ → S → Q → R order, only those revealed. */
  sessions: EventRow[];
  /** User's total points across all sessions of this round. */
  totalPoints: number;
  /** True when any session of the round scored the perfect-podium bonus. */
  perfect: boolean;
  /** Headline date of the round — the latest session's, i.e. race day. */
  date: string;
  /**
   * The finishing top-3 the round's cinematic reveals, team-coloured.
   *
   * Taken from the highest-ranked session that actually has a `results` row
   * (race > quali > sprint > sprint quali) — a round is usually revealed race
   * last, but a weekend where only quali has landed still has a podium worth
   * drawing. Empty when no session has results, which the card renders as no
   * chips rather than three dashes.
   */
  podium: ShowReelChip[];
};

function buildPodium(
  sessions: EventRow[],
  resultByEvent: Map<string, ResultRow>,
  driverById: Map<number, DriverRow>,
): ShowReelChip[] {
  // `sessions` is already sorted SQ → S → Q → R, so the last one carrying a
  // result is the highest-ranked one.
  let chosen: ResultRow | undefined;
  for (const s of sessions) {
    const r = resultByEvent.get(s.id);
    if (r) chosen = r;
  }
  if (!chosen) return [];
  const ids = [chosen.p1_driver_id, chosen.p2_driver_id, chosen.p3_driver_id];
  const chips: ShowReelChip[] = [];
  ids.forEach((id, i) => {
    if (id == null) return;
    const d = driverById.get(id);
    if (!d?.code) return;
    chips.push({ pos: i + 1, code: d.code, hex: teamHex(d.team) });
  });
  return chips;
}

function groupByRound(
  events: EventRow[],
  scoreByEvent: Map<string, ScoreRow>,
  resultByEvent: Map<string, ResultRow>,
  driverById: Map<number, DriverRow>,
): RoundEntry[] {
  const byRound = new Map<number, EventRow[]>();
  for (const e of events) {
    const list = byRound.get(e.round) ?? [];
    list.push(e);
    byRound.set(e.round, list);
  }
  const entries: RoundEntry[] = [];
  for (const [round, list] of byRound) {
    list.sort(
      (a, b) => SESSION_ORDER[a.session_type] - SESSION_ORDER[b.session_type],
    );
    const latest = list.reduce(
      (acc, s) => (s.revealed_at > acc ? s.revealed_at : acc),
      list[0]!.revealed_at,
    );
    const totalPoints = list.reduce(
      (sum, s) => sum + (Number(scoreByEvent.get(s.id)?.points) || 0),
      0,
    );
    const perfect = list.some(
      (s) => scoreByEvent.get(s.id)?.perfect_bonus ?? false,
    );
    // Race day, not the weekend's first session: `list` is in session order,
    // so the last entry is the latest-running session of the round.
    const headlineIso = list.reduce(
      (acc, s) => (s.session_start_at > acc ? s.session_start_at : acc),
      list[0]!.session_start_at,
    );
    entries.push({
      round,
      name: list[0]!.name,
      circuit: list[0]!.circuit,
      ergast_circuit_id: list[0]!.ergast_circuit_id,
      latestRevealedAt: latest,
      sessions: list,
      totalPoints,
      perfect,
      date: formatRoundDate(headlineIso),
      podium: buildPodium(list, resultByEvent, driverById),
    });
  }
  // Most recently revealed round first.
  entries.sort((a, b) =>
    a.latestRevealedAt < b.latestRevealedAt ? 1 : -1,
  );
  return entries;
}

export default async function RevealIndexPage() {
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
  const { data: revealed } = await supabase
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, revealed_at, ergast_circuit_id",
    )
    .eq("season", currentSeason)
    .not("revealed_at", "is", null)
    .order("revealed_at", { ascending: false })
    .returns<EventRow[]>();

  const events = revealed ?? [];

  const eventIds = events.map((e) => e.id);
  const { data: myScores } =
    myId && eventIds.length > 0
      ? await supabase
          .from("scores")
          .select("event_id, points, perfect_bonus")
          .eq("user_id", myId)
          .in("event_id", eventIds)
      : { data: null };
  const scoreByEvent = new Map<string, ScoreRow>();
  for (const s of (myScores ?? []) as ScoreRow[]) {
    scoreByEvent.set(s.event_id, s);
  }

  /*
   * Finishing podium per revealed round (design_handoff_mobile §5.1). This
   * page previously loaded only the viewer's own scores — it could say what
   * a round was worth to you, never who actually finished on the box. Two
   * extra reads, both cheap and both already world-readable: `results` is
   * `results_select_all` under RLS, and it only ever holds rows for sessions
   * that have run. Scoped to the revealed events already fetched above, so
   * nothing unrevealed can leak through this path.
   */
  const [{ data: podiumRows }, { data: driverRows }] = await Promise.all([
    eventIds.length > 0
      ? supabase
          .from("results")
          .select("event_id, p1_driver_id, p2_driver_id, p3_driver_id")
          .in("event_id", eventIds)
      : Promise.resolve({ data: null }),
    supabase.from("drivers").select("id, code, team"),
  ]);
  const resultByEvent = new Map<string, ResultRow>();
  for (const r of (podiumRows ?? []) as ResultRow[]) {
    resultByEvent.set(r.event_id, r);
  }
  const driverById = new Map<number, DriverRow>();
  for (const d of (driverRows ?? []) as DriverRow[]) {
    driverById.set(d.id, d);
  }

  const totalScore = [...scoreByEvent.values()].reduce(
    (sum, s) => sum + Number(s.points),
    0,
  );
  const perfectCount = [...scoreByEvent.values()].filter(
    (s) => s.perfect_bonus,
  ).length;

  const rounds = groupByRound(
    events,
    scoreByEvent,
    resultByEvent,
    driverById,
  );

  const mobileRounds: ShowReelRound[] = rounds.map((r) => ({
    round: r.round,
    title: shortEventName(r.name).toUpperCase(),
    circuit: r.ergast_circuit_id ?? r.circuit,
    date: r.date,
    totalPoints: r.totalPoints,
    perfect: r.perfect,
    podium: r.podium,
    sessions: r.sessions.map((s) => {
      const sc = scoreByEvent.get(s.id);
      return {
        id: s.id,
        sessionType: s.session_type,
        pillLabel: SESSION_PILL_LABEL[s.session_type],
        points: sc ? Number(sc.points) : null,
        perfect: sc?.perfect_bonus ?? false,
      };
    }),
  }));

  return (
    <>
      <TopBar
        active="reveal"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <MobileTabBar active="reveal" />
      {/*
        Gutters fork at md (pattern A, same longhands as the predict list): the
        base values are the phone's 20px gutter and the tab-bar-clearing bottom
        pad; `md:` restores the pre-fork px-8 / py-10 / pb-10 that `px-6 py-10
        pb-24 sm:px-8 md:pb-10` resolved to at every width ≥ md.
      */}
      <main className="mx-auto w-full max-w-[1600px] px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+24px)] md:px-8 md:py-10 md:pb-10 lg:px-12 xl:px-16">
        <ShowReelMobile
          season={currentSeason}
          rounds={mobileRounds}
          sessionCount={events.length}
          perfectCount={perfectCount}
          totalScore={totalScore}
        />

        {/*
          Desktop tree, unchanged except for the podium column added below.
          `hidden md:contents` erases this wrapper's box at md so every child
          stays a direct child of <main> — pattern B′, the same idiom
          lobby-view.tsx uses, and what keeps the 1440 box tree intact.
        */}
        <div className="hidden md:contents">
        <section className="grid items-end gap-8 border-b border-[color:var(--border)] pb-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p
              className="uppercase text-[color:var(--fg-subtle)]"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                marginBottom: "var(--space-md)",
              }}
              data-tabular
            >
              Reveals · {currentSeason} Season
            </p>
            <h1
              className="m-0 uppercase"
              data-tight
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: "clamp(56px, 9vw, 120px)",
                lineHeight: 0.86,
                letterSpacing: "-0.025em",
              }}
            >
              Show
              <br />
              Reel
            </h1>
            <p
              className="text-[color:var(--fg-muted)]"
              style={{
                marginTop: "var(--space-lg)",
                fontSize: 14,
                lineHeight: 1.6,
                maxWidth: 420,
              }}
            >
              Every cinematic that&rsquo;s landed this season. Replay the
              moment, see how the group lined up.
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <p
              className="uppercase text-[color:var(--fg-subtle)]"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.12em",
                marginBottom: "var(--space-sm)",
              }}
              data-tabular
            >
              {rounds.length} rounds · {events.length} sessions ·{" "}
              {perfectCount} perfect podium
            </p>
            <p
              className="leading-none text-[color:var(--accent)]"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: "clamp(40px, 5vw, 56px)",
              }}
            >
              {totalScore}
              <span
                className="text-[color:var(--fg-subtle)]"
                style={{
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontSize: 16,
                  marginLeft: "var(--space-sm)",
                }}
              >
                pts so far
              </span>
            </p>
          </div>
        </section>

        {events.length === 0 ? (
          <section className="mt-10 border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-10 text-center">
            <p
              className="m-0 text-2xl"
              style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
            >
              NO REVEALS YET
            </p>
            <p className="mt-3 text-sm text-[color:var(--fg-muted)]">
              Once a session ends and admin clicks &ldquo;Reveal to
              group&rdquo;, the cinematic lands here. Lock in your picks for
              the next session in the meantime.
            </p>
            <Link
              href="/dashboard/predict"
              className="mt-6 inline-block bg-[color:var(--accent)] px-6 py-3 text-sm uppercase text-black transition-colors hover:bg-[color:var(--accent-hover)]"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              Lock picks →
            </Link>
          </section>
        ) : (
          <ul className="mt-[var(--space-2xl)] grid gap-px border border-[color:var(--border)] bg-[color:var(--border)]">
            {rounds.map((r) => {
              const short = shortEventName(r.name);
              const flag = countryFlag(eventCountry(r.name));
              return (
                <li
                  key={r.round}
                  className="flex flex-col gap-2 bg-[color:var(--surface)] md:grid md:items-center md:gap-[var(--space-xl)] md:[grid-template-columns:60px_80px_36px_1fr_auto_auto_auto] lg:[grid-template-columns:60px_80px_36px_1fr_auto_auto_auto_auto]"
                  style={{
                    padding: "var(--space-lg) var(--space-xl)",
                  }}
                >
                  <span
                    className="uppercase text-[color:var(--fg-subtle)]"
                    style={{ fontSize: 11, letterSpacing: "0.14em" }}
                    data-tabular
                  >
                    R{String(r.round).padStart(2, "0")}
                  </span>
                  {/* Decorative track silhouette — dropped below md so the
                      fixed 80px art never competes for width on a 390/412px
                      viewport; the 7-column desktop template (which counts
                      on this occupying its own 80px track) is restored
                      unchanged at md via the `hidden md:block` pairing. */}
                  <TrackDiagram
                    circuit={r.ergast_circuit_id ?? r.circuit}
                    size={80}
                    stroke="var(--fg-subtle)"
                    strokeWidth={1.5}
                    className="hidden md:block"
                  />
                  {/* Flag + title group — a single flex row on mobile,
                      `md:contents` so the two children rejoin the grid as
                      independent columns (36px / 1fr) at md, matching the
                      original flat 7-item column order exactly. */}
                  <div className="flex items-center gap-3 md:contents">
                    <span aria-hidden style={{ fontSize: 24, lineHeight: 1 }}>
                      {flag}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="truncate uppercase"
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: 20,
                          lineHeight: 1.05,
                          letterSpacing: "0.005em",
                        }}
                      >
                        {short.toUpperCase()}
                      </p>
                      <p
                        className="mt-0.5 text-[10px] uppercase text-[color:var(--fg-subtle)]"
                        style={{ letterSpacing: "0.06em" }}
                        data-tabular
                      >
                        {r.circuit.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Latest / pills / total group — same `md:contents`
                      treatment so it flattens back into the last three grid
                      columns at md. */}
                  <div className="flex flex-wrap items-center justify-between gap-2 md:contents">
                    <span
                      className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                      style={{ letterSpacing: "0.12em" }}
                      data-tabular
                    >
                      Latest {formatRevealedAgo(r.latestRevealedAt)}
                    </span>

                    {/* Finishing podium, team-coloured — the same three chips
                        the mobile card draws (design_handoff_mobile §5.1),
                        brought to the desktop row at the owner's request so
                        both widths say who actually won, not only what the
                        round was worth to you.

                        `hidden lg:flex` and a matching lg-only 8th column: at
                        780–1024 the 7-column template is already tight, and a
                        display:none child is not a grid item at all, so the
                        md template stays exactly as it was. */}
                    <div className="hidden gap-1.5 lg:flex">
                      {r.podium.map((c) => (
                        <span
                          key={c.pos}
                          className="uppercase"
                          data-tabular
                          style={{
                            fontSize: 10,
                            letterSpacing: "0.06em",
                            padding: "4px 7px",
                            border: `1px solid ${c.hex}`,
                            color: c.hex,
                          }}
                        >
                          P{c.pos} {c.code}
                        </span>
                      ))}
                    </div>

                    {/* Session pills — one per revealed session. Each is the
                        click target for its own cinematic. Uniformly accent-red
                        treatment so the row reads as a brand-consistent strip;
                        perfect podiums + ≥10pt scores get a stronger fill so
                        the eye still finds the standout sessions. */}
                    <div className="flex flex-wrap items-center gap-2">
                      {r.sessions.map((s) => {
                        const sc = scoreByEvent.get(s.id);
                        const pts = sc ? Number(sc.points) : null;
                        const perfect = sc?.perfect_bonus ?? false;
                        const fillPct = pillFill(perfect, pts);
                        return (
                          <Link
                            key={s.id}
                            href={`/reveal/${s.id}`}
                            aria-label={`Watch ${sessionLabel(s.session_type)} reveal`}
                            className="flex items-center gap-2 transition-colors"
                            style={{
                              padding: "6px 12px",
                              background: `color-mix(in oklch, var(--accent) ${fillPct}%, transparent)`,
                              border: "1px solid var(--accent)",
                            }}
                          >
                            <span
                              className="text-[10px] uppercase"
                              style={{
                                letterSpacing: "0.1em",
                                color: "var(--fg-muted)",
                                fontFamily:
                                  "var(--font-mono), ui-monospace, monospace",
                              }}
                              data-tabular
                            >
                              {SESSION_PILL_LABEL[s.session_type]}
                            </span>
                            <span
                              style={{
                                fontFamily:
                                  "var(--font-mono), ui-monospace, monospace",
                                fontWeight: 600,
                                fontSize: 13,
                                color:
                                  pts == null
                                    ? "var(--fg-subtle)"
                                    : "var(--fg)",
                              }}
                              data-tabular
                            >
                              {pts == null ? "—" : `+${pts}`}
                            </span>
                          </Link>
                        );
                      })}
                    </div>

                    <span
                      aria-label="Total"
                      className="text-right"
                      style={{
                        fontFamily: "var(--font-boldonse), ui-sans-serif",
                        fontSize: 22,
                        minWidth: 80,
                        color: r.totalPoints >= 10 ? "var(--accent)" : "var(--fg)",
                      }}
                    >
                      Σ +{r.totalPoints}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </main>
    </>
  );
}
