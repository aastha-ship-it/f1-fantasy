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
 * TWO DELIBERATE DEPARTURES FROM THE ARTBOARD, both because the canvas
 * fixture is "5 rounds · 5 sessions" and real rounds are not:
 *
 *  1. The artboard's single `WATCH →` becomes the row of per-session pills
 *     the desktop table already uses. A production round carries up to four
 *     revealed cinematics (SQ / S / Q / R), each its own `/reveal/[eventId]`;
 *     one CTA would have to pick one and strand the rest. The pills are the
 *     links, so `WATCH →` would have no destination they don't already own.
 *  2. That pushes the pills onto their own line under the podium chips,
 *     instead of sharing the artboard's single bottom row. Four pills plus
 *     three podium chips do not fit 390 - 40 gutters on one line.
 */

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";
const MONO_FONT = "var(--font-mono), ui-monospace, monospace";

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

      <p
        className="relative m-0 uppercase"
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 22,
          lineHeight: 1,
          marginTop: 8,
        }}
      >
        {r.title}
      </p>

      {/* What actually happened, and what it was worth. `podium` is empty for
          a round whose sessions have no `results` row — the chips simply
          don't render rather than drawing three dashes. */}
      <div
        className="relative flex items-center justify-between gap-3"
        style={{ marginTop: 14 }}
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

      {/* One pill per revealed session — on mobile these ARE the cinematic
          links, which is why the <Link> is a 44-tall hit area wrapping a
          28-tall visible chip rather than being the chip itself. The chip
          keeps the artboard's compact proportions; the thumb gets the
          program's 44px minimum. Same `pillFill` emphasis map as the desktop
          strip, so a standout session reads the same at both widths.

          marginTop 4, not the 10 the rows above use: the link contributes
          ~8px of transparent padding over the chip, so 4 lands the visible
          gap where the artboard puts it. */}
      <div className="relative flex flex-wrap" style={{ marginTop: 4, gap: 6 }}>
        {r.sessions.map((s) => (
          <Link
            key={s.id}
            href={`/reveal/${s.id}`}
            aria-label={`Watch ${sessionLabel(s.sessionType)} reveal`}
            className="flex items-center"
            style={{ minHeight: 44 }}
          >
            <span
              className="flex items-center"
              style={{
                gap: 6,
                padding: "5px 8px",
                background: `color-mix(in oklch, var(--accent) ${pillFill(
                  s.perfect,
                  s.points,
                )}%, transparent)`,
                border: "1px solid var(--accent)",
              }}
            >
              <span
                className="uppercase text-[color:var(--fg-muted)]"
                data-tabular
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 9,
                  letterSpacing: "0.1em",
                }}
              >
                {s.pillLabel}
              </span>
              <span
                data-tabular
                style={{
                  fontFamily: MONO_FONT,
                  fontWeight: 600,
                  fontSize: 12,
                  color: s.points == null ? "var(--fg-subtle)" : "var(--fg)",
                }}
              >
                {s.points == null ? "—" : `+${s.points}`}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}
