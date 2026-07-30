// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DriverStandingsRowDesktop,
  DriverStandingsRowMobile,
  type DriverRowProps,
} from "./driver-row";

const VER: DriverRowProps = {
  pos: 1, code: "VER", fullName: "Max Verstappen", team: "Red Bull",
  points: 287, wins: 7, podiums: 11, gap: "LEADER",
  country: "NL", isLeader: true,
};
const NOR: DriverRowProps = {
  pos: 2, code: "NOR", fullName: "Lando Norris", team: "McLaren",
  points: 241, wins: 4, podiums: 9, gap: "+46",
  country: "GB", isLeader: false,
};

describe("DriverStandingsRowMobile", () => {
  it("shows position, name and points in the collapsed summary", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    const summary = screen.getByRole("group").querySelector("summary")!;
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("NOR");
    expect(summary).toHaveTextContent("241");
  });

  it("keeps wins, podiums and gap out of the summary but in the row", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    const summary = screen.getByRole("group").querySelector("summary")!;
    expect(summary).not.toHaveTextContent("PODIUMS");
    expect(screen.getByText("PODIUMS")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("+46")).toBeInTheDocument();
  });

  it("needs no client JS — expansion is a native details element", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    expect(screen.getByRole("group").tagName).toBe("DETAILS");
  });

  it("renders tabular numerics", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    expect(screen.getByText("241")).toHaveAttribute("data-tabular");
  });

  it("marks the leader", () => {
    render(<DriverStandingsRowMobile {...VER} />);
    expect(screen.getByText("LEADER")).toBeInTheDocument();
  });
});

describe("DriverStandingsRowDesktop", () => {
  it("keeps the dense seven-column grid", () => {
    const { container } = render(<DriverStandingsRowDesktop {...NOR} />);
    const li = container.querySelector("li")!;
    expect(li.style.gridTemplateColumns).toBe(
      "32px 56px minmax(0,1fr) 84px 48px 48px 64px",
    );
  });

  it("shows every column inline", () => {
    render(<DriverStandingsRowDesktop {...NOR} />);
    expect(screen.getByText("241")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});
