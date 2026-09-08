import Image from "next/image";
import type { ReactNode } from "react";
import { TrackDiagram } from "@/components/TrackDiagram";
import { DriverPortrait } from "@/components/DriverPortrait";
import {
  MobEyebrow,
  MobSectionHead,
  MobBleed,
} from "@/components/MobilePrimitives";
import {
  ProgressPips,
  DriverChips,
  FastestLapRow,
  RateGauge,
  type ChipDatum,
  type FlRoundDatum,
} from "./season-summary-helpers";
import {
  DriverStandingsRowMobile,
  type DriverRowProps,
} from "./driver-row";
import type { WinnerCardDatum } from "./recent-winners";

/**
 * /dashboard/standings — 390pt fork (design_handoff_mobile §6.1, canvas
 * `screens-mobile-b.jsx:MobWorldStandingsScreen`).
 *
 * Separate component rather than `md:` classes on the desktop tree because
 * the two designs disagree about the primitive at every level: desktop is a
 * two-column `lg:grid-cols-[1.5fr_1fr]` section pairing a driver list with a
 * constructor card stack; mobile is a single column of full-bleed hairline
 * blocks. Every size that differs (42 vs clamp(48,7vw,88) display, 16 vs 22
 * row numerals) is an inline `fontSize`, which no `md:` class can override.
 *
 * Server component — nothing here holds state; the driver rows are native
 * `<details>`.
 *
 * DELIBERATE DEPARTURES FROM THE ARTBOARD, all because the canvas fixture is
 * a 7-driver / 3-round mock and production is not:
 *
 *  1. The footer row reads `ALL {n} DRIVERS` with no `→`. The artboard's
 *     `ALL 20 DRIVERS →` implies the list above it is truncated and the row
 *     navigates to the rest — but this list already renders every driver and
 *     there is no all-drivers route to link to. Truncating to match would
 *     hide rows with no way to reach them, so the row stays as the
 *     list-closing count it honestly is.
 *  2. Recent Winners renders NEWEST FIRST (R05, R04, R03), matching the
 *     artboard. The desktop strip runs oldest→newest and says so with an
 *     explicit "most recent →"; the mobile meta is just "Last 3 rounds", so
 *     the arrow that disambiguates direction is gone and the artboard's
 *     order is the one a reader assumes.
 */

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";
const MONO_FONT = "var(--font-mono), ui-monospace, monospace";

export type StandingsLeader = {
  /** Split server-side so the card can stack the two lines the artboard draws. */
  firstName: string;
  lastName: string;
  code: string;
  team: string;
  /** Driver number — the DB row id, same value the desktop card prints. */
  number: number;
  teamName: string;
  teamHex: string;
  /** `livery[1]` — the dark ground the card sits on. */
  liveryGround: string;
  points: number;
  wins: number;
  podiums: number;
};

export type ConstructorRowDatum = {
  team: string;
  name: string;
  hex: string;
  logoSrc: string;
  points: number;
  /** 0–100, already divided by the leader's total. */
  pct: number;
};

export type StandingsMobileProps = {
  season: number;
  completedRounds: number;
  totalRounds: number;
  /** Short name of the most recently ingested race, e.g. "Saudi Arabia". */
  lastEventName: string | null;
  leader: StandingsLeader | null;
  driverRows: DriverRowProps[];
  constructors: ConstructorRowDatum[];
  distinctRaceWinners: number;
  winnerChips: ChipDatum[];
  distinctPoleSitters: number;
  poleChips: ChipDatum[];
  fastestLapsCount: number;
  fastestLapRounds: FlRoundDatum[];
  dnfsCount: number;
  dnfsPerRace: number | null;
  /** Chronological (oldest first) — this component reverses for display. */
  winners: WinnerCardDatum[];
};

export function StandingsMobile({
  season,
  completedRounds,
  totalRounds,
  lastEventName,
  leader,
  driverRows,
  constructors,
  distinctRaceWinners,
  winnerChips,
  distinctPoleSitters,
  poleChips,
  fastestLapsCount,
  fastestLapRounds,
  dnfsCount,
  dnfsPerRace,
  winners,
}: StandingsMobileProps) {
  const hasData = driverRows.length > 0;
  // Newest first — see departure 2 in the file header.
  const recent = [...winners].reverse().slice(0, 3);

  return (
    <div className="md:hidden">
      <MobEyebrow>{season} FIA F1 World Championship</MobEyebrow>
      <h1
        className="m-0 mt-2.5 uppercase"
        style={{ fontFamily: DISPLAY_FONT, fontSize: 42, lineHeight: 0.9 }}
      >
        World
        <br />
        Standings
      </h1>
      <p
        className="mt-3 uppercase text-[color:var(--fg-muted)]"
        data-tabular
        style={{ fontSize: 10, letterSpacing: "0.06em" }}
      >
        {lastEventName ? `After ${lastEventName} · ` : ""}
        Round {completedRounds} of {totalRounds}
      </p>

      {leader && (
        <MobBleed className="mt-[18px]">
          <div
            className="flex items-center gap-3.5 px-5 py-4"
            style={{
              background: leader.liveryGround,
              boxShadow: `inset 0 -3px 0 ${leader.teamHex}`,
            }}
          >
            <div className="min-w-0 flex-1">
              <p
                className="uppercase"
                data-tabular
                style={{
                  fontSize: 8,
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                Championship leader
              </p>
              <p
                className="mt-1.5 uppercase text-white"
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: 24,
                  lineHeight: 0.95,
                }}
              >
                {leader.firstName}
                <br />
                {leader.lastName}
              </p>
              <p
                className="mt-2 uppercase"
                data-tabular
                style={{
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: leader.teamHex,
                }}
              >
                {leader.teamName} · #{leader.number}
              </p>
              <div
                className="mt-3 flex gap-3.5 uppercase"
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                {(
                  [
                    [leader.points, "pts"],
                    [leader.wins, "wins"],
                    [leader.podiums, "pod"],
                  ] as const
                ).map(([n, label]) => (
                  <span key={label}>
                    <strong
                      className="text-white"
                      data-tabular
                      style={{ fontSize: 15 }}
                    >
                      {n}
                    </strong>{" "}
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <DriverPortrait
              code={leader.code}
              team={leader.team}
              size={84}
              className="shrink-0"
            />
          </div>
        </MobBleed>
      )}

      {!hasData && (
        <div className="mt-[26px] border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <MobEyebrow>No data yet</MobEyebrow>
          <p
            className="mt-2 text-[color:var(--fg-muted)]"
            style={{ fontSize: 13, lineHeight: 1.55 }}
          >
            Standings populate after the first race weekend, once the Jolpica
            nightly delta or the OpenF1 fetch lands.
          </p>
        </div>
      )}

      {hasData && (
        <>
          <section className="mt-[26px]">
            <MobSectionHead title="Drivers" meta="Tap a row for splits" />
            <MobBleed>
              {/* <ol>, not a bare stack of <details>: this is the primary
                  target device, and dropping the list semantics would cost
                  screen-reader users the "list, N items" summary and per-row
                  position. <details> inside <li> is valid HTML. Keys are the
                  driver's DB row id, never the code — a display string is not
                  an identity. */}
              <ol className="border-t border-[color:var(--border)]">
                {driverRows.map((r) => (
                  <li key={r.id ?? r.pos}>
                    <DriverStandingsRowMobile {...r} />
                  </li>
                ))}
              </ol>
              <p
                className="flex h-12 items-center justify-between border-b border-[color:var(--border)] px-5 uppercase text-[color:var(--fg-muted)]"
                data-tabular
                style={{ fontSize: 10, letterSpacing: "0.12em" }}
              >
                All {driverRows.length} drivers
              </p>
            </MobBleed>
          </section>

          <section className="mt-[26px]">
            <MobSectionHead
              title="Constructors"
              meta={`${constructors.length} teams`}
            />
            <MobBleed>
              <ol className="border-t border-[color:var(--border)]">
                {constructors.map((c, i) => (
                  <li
                    key={c.team}
                    className="grid items-center gap-2.5 border-b border-[color:var(--border)] px-5"
                    style={{
                      height: 62,
                      gridTemplateColumns: "24px 30px minmax(0,1fr) auto",
                    }}
                  >
                    <span
                      className="leading-none"
                      data-tabular
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: 16,
                        color: i === 0 ? "var(--accent)" : "var(--fg)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <Image
                      src={c.logoSrc}
                      alt={c.name}
                      width={26}
                      height={26}
                      className="h-[26px] w-[26px] object-contain"
                      unoptimized
                    />
                    <span className="min-w-0">
                      <span
                        className="block truncate uppercase"
                        style={{ fontFamily: DISPLAY_FONT, fontSize: 13 }}
                      >
                        {c.name}
                      </span>
                      <span
                        aria-hidden
                        className="mt-[7px] block h-1"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <span
                          className="block h-full"
                          style={{ width: `${c.pct}%`, background: c.hex }}
                        />
                      </span>
                    </span>
                    <span data-tabular style={{ fontSize: 16 }}>
                      {c.points}
                    </span>
                  </li>
                ))}
              </ol>
            </MobBleed>
          </section>

          <section className="mt-[26px]">
            <MobSectionHead
              title="Season summary"
              meta={`After Round ${String(completedRounds).padStart(2, "0")}`}
            />
            <MobBleed>
              {/* Tile ORDER is S01 S02 S03 S05 then S04 spanning both columns
                  — the handoff's reflow, not a typo. S04's five round chips
                  need the full width; S05's gauge does not. */}
              <div
                className="grid grid-cols-2 gap-px border-y border-[color:var(--border)] bg-[color:var(--border)]"
              >
                <MobStatTile
                  index="S01"
                  label="Races complete"
                  value={String(completedRounds)}
                  suffix={`/ ${totalRounds}`}
                >
                  <ProgressPips done={completedRounds} total={totalRounds} />
                </MobStatTile>
                <MobStatTile
                  index="S02"
                  label="Different winners"
                  value={String(distinctRaceWinners)}
                >
                  <DriverChips chips={winnerChips} />
                </MobStatTile>
                <MobStatTile
                  index="S03"
                  label="Pole sitters"
                  value={String(distinctPoleSitters)}
                >
                  <DriverChips chips={poleChips} />
                </MobStatTile>
                <MobStatTile
                  index="S05"
                  label="DNFs total"
                  value={String(dnfsCount)}
                  valueColor="var(--warning)"
                >
                  <RateGauge value={dnfsPerRace ?? 0} max={5} suffix="per race" />
                </MobStatTile>
                <MobStatTile
                  index="S04"
                  label="Fastest laps"
                  value={String(fastestLapsCount)}
                  span
                >
                  <FastestLapRow rounds={fastestLapRounds} />
                </MobStatTile>
              </div>
            </MobBleed>
          </section>
        </>
      )}

      {recent.length > 0 && (
        <section className="mt-[26px]">
          <MobSectionHead
            title="Recent winners"
            meta={`Last ${recent.length} round${recent.length === 1 ? "" : "s"}`}
          />
          <MobBleed>
            <div
              className="grid gap-px border-y border-[color:var(--border)] bg-[color:var(--border)]"
              style={{
                gridTemplateColumns: `repeat(${recent.length}, minmax(0,1fr))`,
              }}
            >
              {recent.map((w) => (
                <article
                  key={w.round}
                  className="min-w-0 bg-[color:var(--surface)] p-3"
                >
                  <p
                    className="uppercase text-[color:var(--fg-subtle)]"
                    data-tabular
                    style={{ fontSize: 8, letterSpacing: "0.14em" }}
                  >
                    R{String(w.round).padStart(2, "0")}
                  </p>
                  {/* Inset, never negatively offset — a silhouette clipped by
                      the frame edge reads as a bug (handoff drift list). */}
                  <div
                    className="mt-2.5 flex items-center overflow-hidden border-b border-[color:var(--border)] pb-2.5"
                    style={{ height: 46 }}
                  >
                    <TrackDiagram
                      circuit={w.track}
                      stroke="var(--fg-muted)"
                      height={36}
                    />
                  </div>
                  <div className="mt-2.5 flex min-w-0 items-center gap-1.5">
                    <DriverPortrait
                      code={w.code}
                      team={w.team}
                      size={26}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className="truncate uppercase"
                        style={{ fontFamily: DISPLAY_FONT, fontSize: 12 }}
                      >
                        {w.lastName}
                      </p>
                      <p
                        className="mt-0.5 uppercase"
                        data-tabular
                        style={{
                          fontSize: 8,
                          letterSpacing: "0.1em",
                          color: w.teamHex,
                        }}
                      >
                        {w.teamShort}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </MobBleed>
        </section>
      )}
    </div>
  );
}

/**
 * Compact stat tile — the mobile counterpart of `StatTile` in
 * `season-summary-helpers.tsx`. Same anatomy (label · index chip ·
 * broadcast numeric · detail row pinned to the bottom), scaled for a ~174pt
 * column. Lives here rather than beside `StatTile` because it carries no
 * `md:` classes: it is the phone tile, full stop (MobilePrimitives contract).
 */
function MobStatTile({
  index,
  label,
  value,
  suffix,
  valueColor = "var(--fg)",
  span,
  children,
}: {
  index: string;
  label: string;
  value: string;
  suffix?: string;
  valueColor?: string;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 bg-[color:var(--surface)] px-3.5 pt-3.5 pb-4"
      style={{ minHeight: 132, gridColumn: span ? "1 / -1" : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="uppercase text-[color:var(--fg-subtle)]"
          data-tabular
          style={{ fontSize: 9, letterSpacing: "0.12em" }}
        >
          {label}
        </span>
        <span
          className="shrink-0 border border-[color:var(--border)] uppercase text-[color:var(--fg-subtle)]"
          data-tabular
          style={{ fontSize: 8, letterSpacing: "0.12em", padding: "2px 5px" }}
        >
          {index}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          data-tabular
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 34,
            lineHeight: 0.9,
            color: valueColor,
          }}
        >
          {value}
        </span>
        {suffix && (
          <span
            className="text-[color:var(--fg-subtle)]"
            data-tabular
            style={{ fontSize: 10, letterSpacing: "0.06em" }}
          >
            {suffix}
          </span>
        )}
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}
