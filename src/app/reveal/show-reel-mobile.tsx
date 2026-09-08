import Link from "next/link";
import { TrackDiagram } from "@/components/TrackDiagram";
import { MobEyebrow, MobButton } from "@/components/MobilePrimitives";
import { sessionLabel } from "@/lib/sessionLabel";
import { pillFill } from "@/lib/reveal/pillFill";

/**
 * /reveal — Show Reel, 390pt fork (design_handoff_mobile §5.1, canvas
 * `screens-mobile-b.jsx:MobShowReelScreen`).
 *
 * PR-5a forks this route at md (780px). The two trees are separate components
 * rather than one tree wearing `md:` classes because the designs disagree
 * about the primitive, not the spacing: desktop is a hairline `gap-px` table
 * whose rows are a 7-column grid; mobile is a stack of bordered cards with an
 * absolutely-positioned track silhouette bleeding out of the top-right. No
 * shared element could carry that fork in classes, and every size that
 * differs (52 vs clamp(56,9vw,120) display, 9 vs 11 mono) is an inline
 * `fontSize`, which no `md:` class can override.
 *
 * Server component — nothing here holds state.
 *
 * PR-5a shipped the per-session pills as a departure from the original
 * artboard's single `WATCH →` (a production round carries up to four revealed
 * cinematics, SQ / S / Q / R, each its own `/reveal/[eventId]`, and one CTA
 * would have to pick one and strand the rest). The review bundle's R-2
 * ratifies that and fixes the layout it left open: the pills move OFF the
 * bottom line and into their own full-width row between the round name and
 * the podium chips, one pill per revealed session, each `flex:1` so two or
 * four of them fill the card at 390 without wrapping.
 *
 * The round total on the podium row is the SUM of the pills — structurally,
 * not by coincidence: `page.tsx`'s `groupByRound` folds `totalPoints` over
 * exactly the same session list it hands down as `sessions`, reading the
 * same `scoreByEvent` map, so a session missing a score contributes 0 to
 * both. `show-reel-mobile.test.tsx` pins it.
 */

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";
const MONO_FONT = "var(--font-mono), ui-monospace, monospace";

/**
 * A sprint weekend is one that RAN a sprint, read off the session types —
 * not off `sessions.length === 4`. A sprint weekend part-way through its
 * reveals has fewer than four pills and is still a sprint weekend, and the
 * meta line tints on the format, not on how much of it has been revealed.
 */
function isSprintWeekend(sessions: ShowReelSession[]): boolean {
  return sessions.some(
    (s) => s.sessionType === "sprint_race" || s.sessionType === "sprint_quali",
  );
}

export type ShowReelChip = {
  /** 1 | 2 | 3 — the finishing slot this driver took. */
  pos: number;
  code: string;
  /** Resolved through `teamHex` on the server; already a literal colour. */
  hex: string;
};

export type ShowReelSession = {
  id: string;
  sessionType: "race" | "quali" | "sprint_race" | "sprint_quali";
  /** "SQ" | "S" | "Q" | "R" */
  pillLabel: string;
  /** null when the viewer has no score row for that session. */
  points: number | null;
  perfect: boolean;
};

export type ShowReelRound = {
  round: number;
  /** Already shortened + uppercased by the page. */
  title: string;
  circuit: string;
  /** "APR 19" — computed in UTC on the server, see the page's `formatRoundDate`. */
  date: string;
  totalPoints: number;
  /** True when any session of the round scored a perfect podium. */
  perfect: boolean;
  /** Empty when no session of the round has a `results` row yet. */
  podium: ShowReelChip[];
  sessions: ShowReelSession[];
};

export function ShowReelMobile({
  season,
  rounds,
  sessionCount,
  perfectCount,
  totalScore,
}: {
  season: number;
  rounds: ShowReelRound[];
  sessionCount: number;
  perfectCount: number;
  totalScore: number;
}) {
  return (
    <div className="md:hidden">
      <MobEyebrow>
        Reveals · {season} Season
      </MobEyebrow>
      <h1
        className="m-0 uppercase"
        data-tight
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 52,
          lineHeight: 0.86,
          marginTop: 10,
        }}
      >
        Show
        <br />
        Reel
      </h1>

      {/* Stat line left, season total right, hairline under both. */}
      <div
        className="flex items-end justify-between gap-3"
        style={{
          marginTop: 16,
          paddingBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <p
          className="m-0 uppercase text-[color:var(--fg-subtle)]"
          data-tabular
          style={{ fontSize: 9, letterSpacing: "0.1em", lineHeight: 1.7 }}
        >
          {rounds.length} {rounds.length === 1 ? "round" : "rounds"} ·{" "}
          {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
          <br />
          {perfectCount} perfect {perfectCount === 1 ? "podium" : "podiums"}
        </p>
        <p
          className="m-0 text-[color:var(--accent)]"
          style={{ fontFamily: DISPLAY_FONT, fontSize: 40, lineHeight: 0.9 }}
        >
          <span data-tabular>{totalScore}</span>
          <span
            className="uppercase text-[color:var(--fg-subtle)]"
            style={{
              fontFamily: MONO_FONT,
              fontSize: 11,
              letterSpacing: "0.08em",
              marginLeft: 6,
            }}
          >
            pts
          </span>
        </p>
      </div>

      {rounds.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid" style={{ marginTop: 22, gap: 10 }}>
          {rounds.map((r) => (
            <RoundCard key={r.round} round={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Teach rather than apologise — the desktop empty state's copy, at mobile
 * type. Reached before the season's first reveal, which for a fresh league
 * is every visit until round 1 is scored and revealed.
 */
function EmptyState() {
  return (
    <div
      className="text-center"
      style={{
        marginTop: 22,
        border: "1px dashed var(--border)",
        background: "var(--surface)",
        padding: "28px 20px",
      }}
    >
      <p
        className="m-0 uppercase"
        style={{ fontFamily: DISPLAY_FONT, fontSize: 22, lineHeight: 1 }}
      >
        No reveals yet
      </p>
      <p
        className="text-[color:var(--fg-muted)]"
        style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6 }}
      >
        Once a session ends and admin clicks &ldquo;Reveal to group&rdquo;, the
        cinematic lands here. Lock in your picks for the next session in the
        meantime.
      </p>
      <MobButton href="/dashboard/predict" className="mt-[18px]">
        Lock picks →
      </MobButton>
    </div>
  );
}

function RoundCard({ round: r }: { round: ShowReelRound }) {
  const edge = r.perfect ? "var(--success)" : "var(--border)";
  const sprint = isSprintWeekend(r.sessions);
  return (
    <article
      className="relative overflow-hidden bg-[color:var(--surface)]"
      style={{ border: `1px solid ${edge}`, padding: 14 }}
    >
      {/* Silhouette bleeds out of the top-right corner at .18 — the card's
          only decoration, and the reason the card is `overflow-hidden`. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ right: 10, top: 10, opacity: 0.18 }}
      >
        <TrackDiagram
          circuit={r.circuit}
          height={62}
          stroke="var(--fg)"
          strokeWidth={1.5}
        />
      </div>

      {/* Every row below is `relative` so it paints over the silhouette. */}
      <div className="relative flex items-baseline justify-between gap-2">
        <span
          className="uppercase text-[color:var(--fg-subtle)]"
          data-tabular
          style={{ fontSize: 9, letterSpacing: "0.12em" }}
        >
          R{String(r.round).padStart(2, "0")} · {r.date}
        </span>
        {r.perfect && (
          <span
            className="shrink-0 uppercase"
            data-tabular
            style={{
              fontSize: 8,
              letterSpacing: "0.14em",
              color: "var(--success)",
              border: "1px solid var(--success)",
              padding: "2px 6px",
            }}
          >
            Perfect
          </span>
        )}
      </div>

      {/* Round name + the weekend's shape. The count is what makes the pill
          row below legible: two pills and four pills are both correct, and
          the reader needs to know which weekend they are looking at. */}
      <div
        className="relative flex items-baseline justify-between"
        style={{ marginTop: 8, gap: 10 }}
      >
        <p
          className="m-0 min-w-0 truncate uppercase"
          style={{ fontFamily: DISPLAY_FONT, fontSize: 22, lineHeight: 1 }}
        >
          {r.title}
        </p>
        <span
          className="shrink-0 uppercase"
          data-tabular
          style={{
            fontFamily: MONO_FONT,
            fontSize: 8,
            letterSpacing: "0.12em",
            color: sprint ? "var(--warning)" : "var(--fg-subtle)",
          }}
        >
          {r.sessions.length}{" "}
          {r.sessions.length === 1 ? "session" : "sessions"}
        </span>
      </div>

      {/* One pill per revealed session, ABOVE the podium row (R-2). Each is
          `flex:1 minWidth:0` so two or four share the card's width without
          wrapping, and the whole pill is the tap target — the review's drift
          list asks for the row, not just the glyph, and 44 is the floor the
          program holds every control to. The accent outline + graded accent
          fill is the desktop Show Reel pill's treatment, via the same shared
          `pillFill` map, so a standout session reads identically at both
          widths. A `--border` outline or `--surface-2` fill here would be
          the drift the handoff names. */}
      <div className="relative flex" style={{ marginTop: 12, gap: 5 }}>
        {r.sessions.map((s) => (
          <Link
            key={s.id}
            href={`/reveal/${s.id}`}
            title={sessionLabel(s.sessionType)}
            aria-label={`Watch ${sessionLabel(s.sessionType)} reveal`}
            className="block min-w-0 flex-1 text-center"
            style={{
              // 6 + 11 (mono 8) + 3 + 17 (mono 13) + 7 lands the canvas pill
              // at exactly 44 — the program's tap-target floor, which is why
              // the whole pill is the <Link> rather than a chip inside one.
              minHeight: 44,
              padding: "6px 6px 7px",
              background: `color-mix(in oklch, var(--accent) ${pillFill(
                s.perfect,
                s.points,
              )}%, transparent)`,
              border: "1px solid var(--accent)",
            }}
          >
            <span
              className="block uppercase text-[color:var(--fg-muted)]"
              data-tabular
              style={{
                fontFamily: MONO_FONT,
                fontSize: 8,
                letterSpacing: "0.1em",
              }}
            >
              {s.pillLabel}
            </span>
            <span
              className="block"
              data-tabular
              style={{
                fontFamily: MONO_FONT,
                fontWeight: 600,
                fontSize: 13,
                marginTop: 3,
                color: s.points == null ? "var(--fg-subtle)" : "var(--fg)",
              }}
            >
              {/* A session the viewer never scored has no row, not a zero —
                  the em dash says "you weren't in this one". */}
              {s.points == null ? "—" : `+${s.points}`}
            </span>
          </Link>
        ))}
      </div>

      {/* What actually happened, and what it was worth. `podium` is empty for
          a round whose sessions have no `results` row — the chips simply
          don't render rather than drawing three dashes. */}
      <div
        className="relative flex items-center justify-between gap-3"
        style={{
          marginTop: 12,
          paddingTop: 11,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="flex flex-wrap" style={{ gap: 5 }}>
          {r.podium.map((c) => (
            <span
              key={c.pos}
              className="uppercase"
              data-tabular
              style={{
                fontSize: 9,
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
        <span
          className="shrink-0"
          data-tabular
          style={{
            fontFamily: MONO_FONT,
            fontSize: 18,
            color: r.perfect ? "var(--success)" : "var(--fg)",
          }}
        >
          +{r.totalPoints}
        </span>
      </div>

    </article>
  );
}
