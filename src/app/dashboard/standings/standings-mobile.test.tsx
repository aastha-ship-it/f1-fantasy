// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { teamMeta } from "@/lib/design/teams";
import { StandingsMobile, type StandingsMobileProps } from "./standings-mobile";
import type { DriverRowProps } from "./driver-row";
import type { WinnerCardDatum } from "./recent-winners";

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const row = (pos: number, code: string, team: string): DriverRowProps => ({
  pos,
  id: pos,
  code,
  fullName: `${code} Driver`,
  team,
  points: 100 - pos,
  wins: 1,
  podiums: 2,
  poles: 1,
  fastestLaps: 0,
  gap: pos === 1 ? "LEADER" : `+${pos}`,
  country: "GB",
  isLeader: pos === 1,
});

const winner = (round: number, code: string): WinnerCardDatum => ({
  round,
  gp: `Round ${round}`,
  date: "May 4",
  flag: "🇬🇧",
  cc: "GBR",
  code,
  lastName: `Last${round}`,
  team: "McLaren",
  teamShort: "MCL",
  teamHex: teamMeta("McLaren")!.hex,
  track: "miami",
});

const BASE: StandingsMobileProps = {
  season: 2026,
  completedRounds: 5,
  totalRounds: 24,
  lastEventName: "Saudi Arabia",
  leader: {
    firstName: "Oscar",
    lastName: "Piastri",
    code: "PIA",
    team: "McLaren",
    number: 81,
    teamName: "McLaren",
    teamHex: teamMeta("McLaren")!.hex,
    liveryGround: teamMeta("McLaren")!.livery[1],
    points: 113,
    wins: 3,
    podiums: 4,
  },
  driverRows: [
    row(1, "PIA", "McLaren"),
    row(2, "NOR", "McLaren"),
    row(3, "LEC", "Ferrari"),
  ],
  constructors: [
    {
      team: "McLaren",
      name: "McLaren",
      hex: teamMeta("McLaren")!.hex,
      logoSrc: teamMeta("McLaren")!.logoSrc,
      points: 212,
      pct: 100,
    },
    {
      team: "Ferrari",
      name: "Ferrari",
      hex: teamMeta("Ferrari")!.hex,
      logoSrc: teamMeta("Ferrari")!.logoSrc,
      points: 139,
      pct: 65.5,
    },
  ],
  distinctRaceWinners: 3,
  winnerChips: [],
  distinctPoleSitters: 3,
  poleChips: [],
  fastestLapsCount: 5,
  fastestLapRounds: [],
  dnfsCount: 11,
  dnfsPerRace: 2.2,
  winners: [winner(3, "NOR"), winner(4, "PIA"), winner(5, "VER")],
};

describe("StandingsMobile", () => {
  it("renders only below the fork", () => {
    const { container } = render(<StandingsMobile {...BASE} />);
    expect(container.firstElementChild!.className).toContain("md:hidden");
  });

  // The hero's third line is the artboard's "AFTER SAUDI ARABIA · ROUND 5 OF
  // 24". `lastEventName` comes from the last (most recent) recentWinners
  // entry, so a reversal upstream would silently name the wrong GP.
  it("names the most recent race and the round count in the hero", () => {
    render(<StandingsMobile {...BASE} />);
    expect(
      screen.getByText(/After Saudi Arabia · Round 5 of 24/i),
    ).toBeInTheDocument();
  });

  it("drops the 'After <GP>' clause when nothing has been ingested", () => {
    render(<StandingsMobile {...BASE} lastEventName={null} />);
    expect(screen.getByText(/^Round 5 of 24$/i)).toBeInTheDocument();
  });

  // §6.1's leader card: `livery[1]` ground closed by a 3px team-colour edge.
  // An inset box-shadow, never a border — CLAUDE.md's sanctioned idiom.
  it("grounds the leader card in the livery with a 3px team edge", () => {
    const { container } = render(<StandingsMobile {...BASE} />);
    const card = container.querySelector<HTMLElement>(
      '[style*="inset 0px -3px"], [style*="inset 0 -3px"]',
    );
    expect(card, "no inset team edge on the leader card").not.toBeNull();
    expect(card!.style.background).toBe(rgb(teamMeta("McLaren")!.livery[1]));
  });

  // Departure 1 in the component header. The artboard says "ALL 20 DRIVERS
  // →"; this list already renders every driver and there is no all-drivers
  // route, so the row is a count, not a link. Turn it back into an <a> and
  // this fails.
  it("closes the driver list with a count row that navigates nowhere", () => {
    const { container } = render(<StandingsMobile {...BASE} />);
    const footer = screen.getByText(/All 3 drivers/i);
    expect(footer.textContent).not.toContain("→");
    expect(footer.closest("a")).toBeNull();
    expect(container.querySelectorAll("ol > li").length).toBeGreaterThanOrEqual(
      3,
    );
  });

  // The handoff's reflow, and the single most typo-prone line in §6.1: the
  // tiles run S01 S02 S03 S05 and THEN S04, which spans both columns because
  // its five round chips need the width.
  it("reflows the season summary 2-up with S04 last and spanning", () => {
    const { container } = render(<StandingsMobile {...BASE} />);
    const chips = Array.from(container.querySelectorAll("span")).filter((el) =>
      /^S0\d$/.test(el.textContent ?? ""),
    );
    expect(chips.map((c) => c.textContent)).toEqual([
      "S01",
      "S02",
      "S03",
      "S05",
      "S04",
    ]);
    const s04Tile = chips[4].closest("div.flex-col") as HTMLElement;
    expect(s04Tile.style.gridColumn).toBe("1 / -1");
    const s05Tile = chips[3].closest("div.flex-col") as HTMLElement;
    expect(s05Tile.style.gridColumn).toBe("");
  });

  // Departure 2. Desktop runs oldest→newest and says so with "most recent
  // →"; the mobile meta is just "Last N rounds", so the artboard's
  // newest-first order is the one a reader assumes. `winners` arrives
  // chronological.
  it("renders recent winners newest-first, capped at three", () => {
    const withSix = [1, 2, 3, 4, 5, 6].map((r) => winner(r, "VER"));
    const { container } = render(
      <StandingsMobile {...BASE} winners={withSix} />,
    );
    const cards = Array.from(container.querySelectorAll("article"));
    expect(cards.map((c) => within(c as HTMLElement).getByText(/^R\d\d$/).textContent)).toEqual([
      "R06",
      "R05",
      "R04",
    ]);
    expect(screen.getByText(/Last 3 rounds/i)).toBeInTheDocument();
  });

  // A fitted 3-up grid, NOT a horizontal scroller — called out twice in the
  // handoff's own drift list. `minmax(0,1fr)` tracks are what keep it from
  // overflowing 390.
  it("fits recent winners into an unscrollable 3-up grid", () => {
    const { container } = render(<StandingsMobile {...BASE} />);
    const grid = container.querySelector("article")!.parentElement!;
    expect(grid.style.gridTemplateColumns).toBe("repeat(3, minmax(0,1fr))");
    expect(grid.className).not.toContain("overflow-x");
  });

  it("teaches instead of apologising when there is no data yet", () => {
    render(
      <StandingsMobile {...BASE} leader={null} driverRows={[]} winners={[]} />,
    );
    expect(screen.getByText(/Standings populate after/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tap a row for splits/i)).toBeNull();
  });
});
