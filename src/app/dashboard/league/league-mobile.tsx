import Image from "next/image";
import {
  MobEyebrow,
  MobSectionHead,
  MobBleed,
} from "@/components/MobilePrimitives";
import { LeagueRowMobile, type LeagueRowProps } from "./league-row";

/**
 * /dashboard/league — 390pt fork (design_handoff_mobile §6.2, canvas
 * `screens-mobile-b.jsx:MobLeagueScreen`).
 *
 * Separate component rather than `md:` classes on the desktop tree: desktop
 * draws the podium as three side-by-side cards in one hairline grid with the
 * leader in the CENTRE column (P2 | P1 | P3); mobile stacks a full-bleed
 * leader card above a 2-up P2/P3 pair. No shared element could carry that in
 * classes, and every size that differs (76 vs 144 display numeral, 38 vs 56
 * points) is an inline `fontSize`.
 *
 * Server component — the rows are native <details>.
 *
 * DEPARTURE FROM THE ARTBOARD — the expanded row keeps the shipped
 * TEAM / DRIVER / PERFECT PODIUMS / P1 STREAK panel instead of the
 * artboard's `LAST ROUND · MIAMI` + three pick chips + breakdown line. That
 * panel needs each friend's predictions for the most recent revealed round
 * plus a per-slot scoring breakdown; this route queries neither (and the
 * breakdown string is computed, not stored), so drawing it would mean adding
 * reads to a presentation-only chunk. Flagged for the owner rather than
 * invented — the same call PR-5b made on the friend-row avatar ring.
 */

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";

export type LeaguePodiumDatum = {
  userId: string;
  /** Display position, 1–3 — already resolved for ties by the page. */
  pos: number;
  name: string;
  points: number;
  perfects: number;
  teamName: string | null;
  teamHex: string | null;
  /** Livery car PNG for the leader watermark; null when no favourite team. */
  carSrc: string | null;
  favDriverCode: string | null;
};

export function LeagueMobile({
  season,
  revealedCount,
  totalRounds,
  podium,
  rest,
}: {
  season: number;
  revealedCount: number;
  totalRounds: number;
  /** Index 0 is the leader; 1 and 2 render as the 2-up pair. */
  podium: LeaguePodiumDatum[];
  rest: LeagueRowProps[];
}) {
  const leader = podium[0] ?? null;
  const pair = podium.slice(1, 3);
  const lastRank = rest.length > 0 ? rest[rest.length - 1].rank : 0;

  return (
    <div className="md:hidden">
      <MobEyebrow>The Group · Season {season}</MobEyebrow>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <h1
          className="m-0 uppercase"
          style={{ fontFamily: DISPLAY_FONT, fontSize: 40, lineHeight: 0.9 }}
        >
          League
          <br />
          Table
        </h1>
        <div className="shrink-0 text-right">
          <p data-tabular style={{ fontSize: 22 }}>
            {revealedCount} / {totalRounds}
          </p>
          <p
            className="mt-1 uppercase text-[color:var(--fg-subtle)]"
            data-tabular
            style={{ fontSize: 8, letterSpacing: "0.12em" }}
          >
            Rounds done
          </p>
        </div>
      </div>

      {!leader && (
        <div className="mt-[18px] border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <MobEyebrow>No reveals yet</MobEyebrow>
          <p
            className="mt-2 text-[color:var(--fg-muted)]"
            style={{ fontSize: 13, lineHeight: 1.55 }}
          >
            The table lights up after the first reveal. Make picks for the next
            round to get on the board.
          </p>
        </div>
      )}

      {leader && (
        <>
          <MobBleed className="mt-[18px]">
            <div className="relative overflow-hidden border-y border-[color:var(--border)] bg-[color:var(--surface-2)] px-5 py-[18px]">
              {leader.carSrc && (
                /* Watermark stays INSIDE `overflow-hidden` and is offset
                   right, never below — the handoff's 0.18–0.3 / right
                   -60..-70 rule. `sizes`/`unoptimized` match every other
                   livery watermark in the app. */
                <Image
                  aria-hidden
                  src={leader.carSrc}
                  alt=""
                  width={320}
                  height={120}
                  unoptimized
                  className="pointer-events-none absolute select-none"
                  style={{
                    right: -70,
                    top: 10,
                    width: 320,
                    height: "auto",
                    maxWidth: "none",
                    opacity: 0.18,
                  }}
                />
              )}
              <div className="relative flex items-start justify-between gap-3">
                <span
                  data-tabular
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 76,
                    lineHeight: 0.8,
                    color: "var(--accent)",
                  }}
                >
                  {leader.pos}
                </span>
                <span
                  className="uppercase text-[color:var(--fg-subtle)]"
                  data-tabular
                  style={{ fontSize: 9, letterSpacing: "0.12em" }}
                >
                  {leader.perfects} perfect
                </span>
              </div>
              <div className="relative mt-3">
                <p
                  className="uppercase"
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 28,
                    lineHeight: 1,
                  }}
                >
                  {leader.name}
                </p>
                <p
                  className="mt-1.5 uppercase"
                  data-tabular
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: leader.teamHex ?? "var(--fg-subtle)",
                  }}
                >
                  {leader.teamName
                    ? `Team ${leader.teamName}`
                    : "No favorite team"}
                  {leader.favDriverCode && ` · ${leader.favDriverCode}`}
                </p>
                <p
                  className="mt-3 leading-none"
                  data-tabular
                  style={{ fontSize: 38 }}
                >
                  {leader.points}
                  <span
                    className="ml-2 uppercase text-[color:var(--fg-subtle)]"
                    style={{ fontSize: 11, letterSpacing: "0.1em" }}
                  >
                    PTS
                  </span>
                </p>
              </div>
            </div>
          </MobBleed>

          {pair.length > 0 && (
            <MobBleed>
              <div
                className="grid gap-px border-b border-[color:var(--border)] bg-[color:var(--border)]"
                style={{
                  gridTemplateColumns: `repeat(${pair.length}, minmax(0,1fr))`,
                }}
              >
                {pair.map((f) => (
                  <div
                    key={f.userId}
                    className="min-w-0 bg-[color:var(--surface)] p-3.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        data-tabular
                        style={{
                          fontFamily: DISPLAY_FONT,
                          fontSize: 34,
                          lineHeight: 0.85,
                        }}
                      >
                        {f.pos}
                      </span>
                      <span
                        className="uppercase text-[color:var(--fg-subtle)]"
                        data-tabular
                        style={{ fontSize: 8, letterSpacing: "0.1em" }}
                      >
                        {f.perfects} PP
                      </span>
                    </div>
                    <p
                      className="mt-3 truncate uppercase"
                      style={{ fontFamily: DISPLAY_FONT, fontSize: 17 }}
                    >
                      {f.name}
                    </p>
                    <p
                      className="mt-[5px] truncate uppercase"
                      data-tabular
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.1em",
                        color: f.teamHex ?? "var(--fg-subtle)",
                      }}
                    >
                      {f.teamName ?? "No favorite team"}
                    </p>
                    <p className="mt-2.5" data-tabular style={{ fontSize: 24 }}>
                      {f.points}
                    </p>
                  </div>
                ))}
              </div>
            </MobBleed>
          )}
        </>
      )}

      {rest.length > 0 && (
        <section className="mt-[26px]">
          <MobSectionHead
            title="Rest of the field"
            meta={`P${rest[0].rank} – P${lastRank}`}
          />
          <MobBleed>
            <ol className="border-t border-[color:var(--border)]">
              {rest.map((r) => (
                <li key={r.userId}>
                  <LeagueRowMobile {...r} />
                </li>
              ))}
            </ol>
          </MobBleed>
        </section>
      )}
    </div>
  );
}
