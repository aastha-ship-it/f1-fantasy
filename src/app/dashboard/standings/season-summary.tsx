/**
 * Season summary stats strip (design_handoff_standings § PR-1).
 *
 * Five tiles in a 5-up grid, hairline borders painted via gap:1px on a
 * --border background. No border-radius. Server component — receives
 * pre-aggregated, pre-resolved data from `page.tsx` so the helpers stay
 * pure and have no driver-lookup concerns.
 */
import {
  StatTile,
  ProgressPips,
  DriverChips,
  FastestLapRow,
  RateGauge,
  type ChipDatum,
  type FlRoundDatum,
} from "./season-summary-helpers";

export type SeasonSummaryProps = {
  completedRounds: number;
  totalRounds: number;
  distinctRaceWinners: number;
  winnerChips: ChipDatum[];
  distinctPoleSitters: number;
  poleChips: ChipDatum[];
  fastestLapsCount: number;
  fastestLapRounds: FlRoundDatum[];
  dnfsCount: number;
  dnfsPerRace: number | null;
};

export function SeasonSummary({
  completedRounds,
  totalRounds,
  distinctRaceWinners,
  winnerChips,
  distinctPoleSitters,
  poleChips,
  fastestLapsCount,
  fastestLapRounds,
  dnfsCount,
  dnfsPerRace,
}: SeasonSummaryProps) {
  return (
    <section
      className="mt-12 grid"
      style={{
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 1,
        background: "var(--border)",
        border: "1px solid var(--border)",
        marginBottom: 56,
      }}
    >
      <StatTile
        index={1}
        label="Races complete"
        value={`${completedRounds}`}
        valueSuffix={`/ ${totalRounds}`}
      >
        <ProgressPips done={completedRounds} total={totalRounds} />
      </StatTile>

      <StatTile
        index={2}
        label="Different winners"
        value={`${distinctRaceWinners}`}
      >
        <DriverChips chips={winnerChips} />
      </StatTile>

      <StatTile
        index={3}
        label="Pole sitters"
        value={`${distinctPoleSitters}`}
      >
        <DriverChips chips={poleChips} />
      </StatTile>

      <StatTile
        index={4}
        label="Fastest laps"
        value={`${fastestLapsCount}`}
      >
        <FastestLapRow rounds={fastestLapRounds} />
      </StatTile>

      <StatTile
        index={5}
        label="DNFs total"
        value={`${dnfsCount}`}
        valueColor="var(--warning)"
      >
        <RateGauge
          value={dnfsPerRace ?? 0}
          max={5}
          suffix="per race"
        />
      </StatTile>
    </section>
  );
}
