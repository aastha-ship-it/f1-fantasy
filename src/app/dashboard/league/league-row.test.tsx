// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeagueRowMobile, type LeagueRowProps } from "./league-row";

const ME: LeagueRowProps = {
  rank: 2, name: "You", initial: "Y", points: 96, pct: 82,
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
