import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { TrackDiagram } from "@/components/TrackDiagram";
import { shortEventName, eventCountry } from "@/lib/design/eventName";
import { countryFlag } from "@/lib/design/drivers";
import { sessionLabel } from "@/lib/sessionLabel";
import { pillFill } from "@/lib/reveal/pillFill";

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
};

function groupByRound(
  events: EventRow[],
  scoreByEvent: Map<string, ScoreRow>,
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
    entries.push({
      round,
      name: list[0]!.name,
      circuit: list[0]!.circuit,
      ergast_circuit_id: list[0]!.ergast_circuit_id,
      latestRevealedAt: latest,
      sessions: list,
      totalPoints,
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

  const totalScore = [...scoreByEvent.values()].reduce(
    (sum, s) => sum + Number(s.points),
    0,
  );
  const perfectCount = [...scoreByEvent.values()].filter(
    (s) => s.perfect_bonus,
  ).length;

  const rounds = groupByRound(events, scoreByEvent);

  return (
    <>
      <TopBar
        active="reveal"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
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
                  className="grid items-center gap-[var(--space-xl)] bg-[color:var(--surface)]"
                  style={{
                    padding: "var(--space-lg) var(--space-xl)",
                    gridTemplateColumns:
                      "60px 80px 36px 1fr auto auto auto",
                  }}
                >
                  <span
                    className="uppercase text-[color:var(--fg-subtle)]"
                    style={{ fontSize: 11, letterSpacing: "0.14em" }}
                    data-tabular
                  >
                    R{String(r.round).padStart(2, "0")}
                  </span>
                  <TrackDiagram
                    circuit={r.ergast_circuit_id ?? r.circuit}
                    size={80}
                    stroke="var(--fg-subtle)"
                    strokeWidth={1.5}
                  />
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
                  <span
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                    style={{ letterSpacing: "0.12em" }}
                    data-tabular
                  >
                    Latest {formatRevealedAgo(r.latestRevealedAt)}
                  </span>

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
                                pts == null ? "var(--fg-subtle)" : "var(--fg)",
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
                      color:
                        r.totalPoints >= 10
                          ? "var(--accent)"
                          : "var(--fg)",
                    }}
                  >
                    Σ +{r.totalPoints}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
