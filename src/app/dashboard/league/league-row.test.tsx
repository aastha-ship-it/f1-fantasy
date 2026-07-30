// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { teamMeta } from "@/lib/design/teams";
import {
  LeagueRowDesktop,
  LeagueRowMobile,
  toLeagueRowProps,
  type LeagueRowProps,
} from "./league-row";

const ME: LeagueRowProps = {
  rank: 2, userId: "u-me", name: "You", initial: "Y", points: 96, pct: 82,
  favTeam: "McLaren", favDriverCode: "NOR", perfects: 1, streak: 3,
  isMe: true,
};

describe("LeagueRowMobile", () => {
  it("summarises rank, name and points only", () => {
    render(<LeagueRowMobile {...ME} />);
    const summary = screen.getByRole("group").querySelector("summary")!;
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("You");
    expect(summary).toHaveTextContent("96");
    expect(summary).not.toHaveTextContent("PERFECT");
  });

  it("exposes the deferred stats when expanded", () => {
    render(<LeagueRowMobile {...ME} />);
    expect(screen.getByText("PERFECT PODIUMS")).toBeInTheDocument();
    expect(screen.getByText("MCLAREN")).toBeInTheDocument();
    expect(screen.getByText("NOR")).toBeInTheDocument();
  });

  it("scopes the emoji font to the flame glyph only", () => {
    const { container } = render(<LeagueRowMobile {...ME} />);
    const flame = screen.getByText("🔥", { exact: false });
    expect(flame.style.fontFamily).toMatch(/emoji/i);
    expect(container.querySelector("details")!.style.fontFamily).toBe("");
  });

  it("omits the streak block entirely at zero", () => {
    render(<LeagueRowMobile {...ME} streak={0} />);
    expect(screen.queryByText("🔥", { exact: false })).toBeNull();
  });

  it("uses a native details element", () => {
    render(<LeagueRowMobile {...ME} />);
    expect(screen.getByRole("group").tagName).toBe("DETAILS");
  });
});

describe("LeagueRowDesktop", () => {
  // Regression guard: page.tsx must feed `favTeam` the raw free-form
  // `favorite_team` string (its exact expression is `r.user!.favorite_team`)
  // — never a pre-resolved `teamMeta(...).slug`. LeagueRowDesktop/Mobile
  // each call `teamMeta(p.favTeam)` themselves, and `teamMeta("kick")`
  // returns null (TEAM_ALIASES has no `kick` identity key, unlike every
  // other TeamSlug), so round-tripping through the slug silently drops a
  // Kick Sauber / Audi favourite to "No favorite team" at every breakpoint,
  // including desktop (>=1024px, where this branch must render unchanged).
  it("renders the resolved team name for a raw favorite_team string, not 'No favorite team'", () => {
    render(<LeagueRowDesktop {...ME} favTeam="Kick Sauber" />);
    expect(screen.getByText(/Team Audi/)).toBeInTheDocument();
    expect(screen.queryByText("No favorite team")).toBeNull();
  });
});

describe("toLeagueRowProps", () => {
  // This is the actual defect site (round-1 review, Finding 1): the
  // component-level test above only proves LeagueRowDesktop resolves a raw
  // team string correctly — it never touches page.tsx's derivation. This
  // test calls the exact function page.tsx's `rowsData` mapper calls, so a
  // future regression back to `favTeam: teamMeta(...).slug ?? null` inside
  // `toLeagueRowProps` itself fails here, not just at the component.
  const SAUBER_ROW = {
    rank: 5,
    userId: "u-sauber-fan",
    points: 40,
    perfects: 0,
    user: {
      display_name: "Sauber Fan",
      email: "fan@example.test",
      favorite_team: "Kick Sauber",
      favorite_driver: null,
    },
    streak: null,
  };
  const CTX = {
    leaderPts: 100,
    currentUserId: null,
    driverCodeById: new Map<number, string>(),
  };

  it("returns a favTeam that teamMeta resolves to the real team, not the pre-resolved slug", () => {
    const props = toLeagueRowProps(SAUBER_ROW, CTX);
    expect(teamMeta(props.favTeam)?.name).toBe("Audi");
  });
});
