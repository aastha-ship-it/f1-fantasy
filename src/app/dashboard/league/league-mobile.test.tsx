// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { teamMeta } from "@/lib/design/teams";
import { LeagueMobile, type LeaguePodiumDatum } from "./league-mobile";
import type { LeagueRowProps } from "./league-row";

const MCL = teamMeta("McLaren")!;

const pod = (pos: number, name: string): LeaguePodiumDatum => ({
  userId: `u${pos}`,
  pos,
  name,
  points: 50 - pos,
  perfects: pos === 1 ? 2 : 0,
  teamName: MCL.name,
  teamHex: MCL.hex,
  carSrc: MCL.carSrc,
  favDriverCode: "NOR",
});

const rest = (rank: number): LeagueRowProps => ({
  rank,
  userId: `u${rank}`,
  name: `Friend ${rank}`,
  initial: "F",
  points: 40 - rank,
  pct: 60,
  favTeam: "McLaren",
  favDriverCode: "NOR",
  perfects: 0,
  streak: 0,
  isMe: false,
});

const BASE = {
  season: 2026,
  revealedCount: 5,
  totalRounds: 24,
  podium: [pod(1, "Aastha"), pod(2, "Riya"), pod(3, "Sam")],
  rest: [rest(4), rest(5), rest(6)],
};

describe("LeagueMobile", () => {
  it("renders only below the fork", () => {
    const { container } = render(<LeagueMobile {...BASE} />);
    expect(container.firstElementChild!.className).toContain("md:hidden");
  });

  // The desktop podium is laid out P2 | P1 | P3 with the leader in the
  // CENTRE column; the phone stacks the leader full-bleed above a 2-up pair,
  // so it takes the podium in RANK order. Feeding it the desktop's visual
  // order would put P2 in the hero.
  it("puts the leader in the hero card and P2/P3 in the 2-up pair", () => {
    const { container } = render(<LeagueMobile {...BASE} />);
    // The hero numeral: 76px accent, the artboard's loudest element.
    const numeral = Array.from(container.querySelectorAll<HTMLElement>("span"))
      .find((el) => el.style.fontSize === "76px")!;
    expect(numeral.textContent).toBe("1");
    expect(numeral.style.color).toBe("var(--accent)");
    expect(screen.getByText("Aastha")).toBeInTheDocument();

    const pairGrid = screen.getByText("Riya").closest("div")!.parentElement!;
    expect(pairGrid.style.gridTemplateColumns).toBe("repeat(2, minmax(0,1fr))");
    const cells = Array.from(pairGrid.children) as HTMLElement[];
    expect(cells.length).toBe(2);
    expect(cells.map((c) => c.querySelector("span")!.textContent)).toEqual([
      "2",
      "3",
    ]);
    expect(cells[0].textContent).toContain("Riya");
    expect(cells[1].textContent).toContain("Sam");
  });

  // Handoff rule: decorative F1Car watermarks sit at opacity 0.18-0.3 and
  // right -60..-70, INSIDE an overflow:hidden box. Let it escape and the
  // page scrolls sideways at 390 — the one thing the drift list forbids
  // outright.
  it("clips the livery watermark inside the leader card", () => {
    const { container } = render(<LeagueMobile {...BASE} />);
    const car = container.querySelector<HTMLElement>('img[alt=""]')!;
    expect(car.style.opacity).toBe("0.18");
    expect(car.style.right).toBe("-70px");
    expect(car.parentElement!.className).toContain("overflow-hidden");
  });

  it("omits the watermark entirely when the leader has no favourite team", () => {
    const noTeam = [{ ...pod(1, "Aastha"), carSrc: null, teamName: null, teamHex: null }];
    const { container } = render(
      <LeagueMobile {...BASE} podium={noTeam} rest={[]} />,
    );
    expect(container.querySelector('img[alt=""]')).toBeNull();
    expect(screen.getByText(/No favorite team/i)).toBeInTheDocument();
  });

  // The artboard's meta reads "P4 – P10" against a fixed 10-friend fixture;
  // the group has no fixed size, so both ends come from the data.
  it("labels the rest-of-field range from the actual ranks", () => {
    render(<LeagueMobile {...BASE} />);
    expect(screen.getByText("P4 – P6")).toBeInTheDocument();
  });

  it("hides the rest-of-field section when the group is three or fewer", () => {
    render(<LeagueMobile {...BASE} rest={[]} />);
    expect(screen.queryByText(/Rest of the field/i)).toBeNull();
  });

  it("teaches instead of apologising before the first reveal", () => {
    render(<LeagueMobile {...BASE} podium={[]} rest={[]} />);
    expect(screen.getByText(/lights up after the first reveal/i)).toBeInTheDocument();
  });
});
