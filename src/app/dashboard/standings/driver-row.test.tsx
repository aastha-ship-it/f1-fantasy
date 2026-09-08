// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { teamMeta } from "@/lib/design/teams";
import {
  DriverStandingsRowDesktop,
  DriverStandingsRowMobile,
  type DriverRowProps,
} from "./driver-row";

/** jsdom serialises `background: "#FF8000"` to an rgb() triple. */
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

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
  it("shows position, full name, team + country and points in the collapsed summary", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    const summary = screen.getByRole("group").querySelector("summary")!;
    expect(summary).toHaveTextContent("2");
    // The 390pt row prints the full name, not the 3-letter code — the code
    // is only legible as a fallback and the artboard has the width for the
    // real thing (design_handoff_mobile §6.1).
    expect(summary).toHaveTextContent("Lando Norris");
    // Team + country moved UP into the summary when the panel became the
    // artboard's four-tile split; they used to be deferred <dd>s.
    expect(summary).toHaveTextContent("MCL");
    expect(summary).toHaveTextContent("GB");
    expect(summary).toHaveTextContent("241");
  });

  it("keeps the season splits out of the summary but in the row", () => {
    render(<DriverStandingsRowMobile {...NOR} poles={3} fastestLaps={2} />);
    const summary = screen.getByRole("group").querySelector("summary")!;
    expect(summary).not.toHaveTextContent("Podiums");
    for (const label of ["Wins", "Podiums", "Poles", "Fast lap"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("9")).toBeInTheDocument(); // podiums
    expect(screen.getByText("3")).toBeInTheDocument(); // poles
  });

  // `poles`/`fastestLaps` are optional so fixtures that predate the split
  // panel keep working; a missing count must read 0, never "undefined".
  it("defaults the poles and fastest-lap tiles to 0 when not supplied", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    const byLabel = new Map(
      Array.from(container.querySelectorAll("dt")).map((dt) => [
        dt.textContent,
        dt.parentElement!.querySelector("dd")!.textContent,
      ]),
    );
    expect(byLabel.get("Poles")).toBe("0");
    expect(byLabel.get("Fast lap")).toBe("0");
  });

  it("needs no client JS — expansion is a native details element", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    expect(screen.getByRole("group").tagName).toBe("DETAILS");
  });

  it("renders tabular numerics", () => {
    render(<DriverStandingsRowMobile {...NOR} />);
    expect(screen.getByText("241")).toHaveAttribute("data-tabular");
  });

  // The leader is now marked by the accent numeral alone: the artboard's
  // summary has no gap column, so the "LEADER" string this used to assert
  // does not exist on the 390pt row.
  it("marks the leader with the accent position numeral", () => {
    const { container } = render(<DriverStandingsRowMobile {...VER} />);
    const pos = container.querySelector<HTMLElement>("summary > span")!;
    expect(pos.textContent).toBe("1");
    expect(pos.style.color).toBe("var(--accent)");
    const { container: c2 } = render(<DriverStandingsRowMobile {...NOR} />);
    expect(
      c2.querySelector<HTMLElement>("summary > span")!.style.color,
    ).toBe("var(--fg)");
  });

  // The <dl> is `dt`-first in the DOM and `flex-col-reverse` in the box:
  // `dl > div` is only valid HTML with its <dt> before its <dd>, and the
  // artboard draws the numeral above its label. Flip the source order to
  // "fix" the visual and this fails.
  it("keeps each split tile valid HTML — <dt> first in DOM, reversed in the box", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    const tiles = Array.from(container.querySelectorAll("dl > div"));
    expect(tiles.length).toBe(4);
    for (const tile of tiles) {
      expect(tile.firstElementChild!.tagName).toBe("DT");
      expect(tile.lastElementChild!.tagName).toBe("DD");
      expect(tile.className).toContain("flex-col-reverse");
    }
  });

  // Every numeric is Geist Mono. The 8px all-caps tile labels are mono TOO
  // on this fork — the mobile type scale reserves 8px for exactly that
  // ("Row meta · Geist Mono upper · 8–10"), which is why `MobEyebrow` and
  // `MobSectionHead`'s meta both carry `data-tabular`. That is the opposite
  // of the pre-fork desktop-era panel, where the labels were body Geist.
  it("puts data-tabular on every split value and on the mono tile labels", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    for (const el of container.querySelectorAll("dl dd, dl dt")) {
      expect(el.hasAttribute("data-tabular"), el.textContent ?? "").toBe(true);
    }
    // The name is prose, not a numeric — it must NOT be mono.
    const name = screen.getByText("Lando Norris");
    expect(name.hasAttribute("data-tabular")).toBe(false);
  });

  // The disclosure is the whole point of the mobile fork, and `list-none` +
  // the -webkit-details-marker reset strip the native triangle. The
  // affordance is the artboard's `+`/`-` pair swapped by `group-open:`
  // (§6.1, matching `MobDisclosureRow`); one rotated chevron cannot read as
  // both states. Delete either span, or the `group` class, and this fails.
  it("keeps an expand affordance inside the summary after stripping the native marker", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    const summary = container.querySelector("summary")!;
    expect(summary.className).toContain("list-none");
    const markers = Array.from(
      summary.querySelectorAll('[aria-hidden][class*="group-open"]'),
    );
    expect(markers.map((m) => m.textContent)).toEqual(["+", "\u2212"]);
    expect(container.querySelector("details")!.className).toContain("group");
  });

  // The team edge is now a 3px GRID CELL between the name and the points,
  // not the absolutely-positioned row-edge stripe the pre-fork row drew in
  // two segments. It must stay inside <summary>: only the first <summary>
  // lands in <details>'s always-visible slot, so an edge placed outside it
  // would vanish while collapsed — the exact trap Task 7 hit. The hex comes
  // from teams.ts, never a literal.
  it("draws the 3px team-colour edge as a summary grid cell", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    const summary = container.querySelector("summary")!;
    expect(summary.style.gridTemplateColumns).toBe(
      "24px 34px minmax(0,1fr) 3px auto 14px",
    );
    const edge = Array.from(
      summary.querySelectorAll<HTMLElement>("span[aria-hidden]"),
    ).find((el) => el.style.width === "3px");
    expect(edge, "no 3px team edge inside <summary>").toBeDefined();
    expect(edge!.style.height).toBe("24px");
    expect(edge!.style.background).toBe(rgb(teamMeta("McLaren")!.hex));
  });

  // 60px is the handoff's row height and 44 is the hard floor for a tap
  // target. A row that shrinks below it is the single most-repeated mobile
  // regression in this program.
  it("holds the 60px row height", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    expect(container.querySelector<HTMLElement>("summary")!.style.height).toBe(
      "60px",
    );
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

  it("uses the driver's DB id in the subtitle when provided, never the standings position — the original row read `s.driver.id`, and silently substituting `pos` would be an undetected ≥1024px content change", () => {
    const withId: DriverRowProps = { ...NOR, id: 33 };
    const { container } = render(<DriverStandingsRowDesktop {...withId} />);
    const subtitle = container.querySelector("div.min-w-0 p:last-child")!;
    expect(subtitle.textContent).toContain("#33");
    expect(subtitle.textContent).not.toContain("#2");
  });
});
