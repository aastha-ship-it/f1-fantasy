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

  // `data-tabular` (Geist Mono) is mandatory for numerics only. Before this
  // guard the row put it on every <dt> label and every <dd>, including the
  // team name and the country flag — the opposite of what the league sibling
  // was forced to do. Reinstate `data-tabular` on the <dt>s, or on the TEAM /
  // COUNTRY <dd>s, and this fails.
  it("scopes data-tabular to numeric values — never to labels, the team name or the flag", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    const dts = Array.from(container.querySelectorAll("dt"));
    expect(dts.length).toBe(5);
    for (const dt of dts) {
      expect(dt.hasAttribute("data-tabular"), `<dt>${dt.textContent}`).toBe(
        false,
      );
    }
    const byLabel = new Map(
      dts.map((dt) => [
        dt.textContent,
        dt.parentElement!.querySelector("dd")!,
      ]),
    );
    for (const numeric of ["GAP", "WINS", "PODIUMS"]) {
      expect(
        byLabel.get(numeric)!.hasAttribute("data-tabular"),
        `<dd> for ${numeric}`,
      ).toBe(true);
    }
    for (const nonNumeric of ["TEAM", "COUNTRY"]) {
      expect(
        byLabel.get(nonNumeric)!.hasAttribute("data-tabular"),
        `<dd> for ${nonNumeric}`,
      ).toBe(false);
    }
  });

  // The disclosure is the whole point of the mobile fork, and `list-none` +
  // the -webkit-details-marker reset strip the native triangle. Without a
  // replacement, ~20 rows carry no signal that anything expands, and
  // `cursor-pointer` conveys nothing to a finger. Delete the marker span and
  // this fails.
  it("keeps an expand affordance inside the summary after stripping the native marker", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    const summary = container.querySelector("summary")!;
    expect(summary.className).toContain("list-none");
    const marker = summary.querySelector('[aria-hidden][class*="group-open"]');
    expect(marker, "no expand marker inside <summary>").not.toBeNull();
    expect(marker!.className).toContain("group-open:rotate-90");
    // The rotation needs `.group` on the <details> to have anything to hang
    // off; without it the marker is inert.
    expect(container.querySelector("details")!.className).toContain("group");
  });

  // Task 7 spent two fix rounds on these two spans: first the <details>
  // slotting trap (a stripe placed outside <summary> is invisible while
  // collapsed), then an expanded-state height regression. Nothing asserted
  // them, so deleting either left the suite green. jsdom cannot prove
  // painting — that is what the screenshots were for — but it can prove the
  // structure that actually regressed. Modelled on PracticeBanner.test.tsx's
  // PB2; the hex comes from teams.ts, not a literal.
  it("keeps the summary-slot segment of the team-colour edge as the summary's first child", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    const summary = container.querySelector("summary")!;
    const stripe = summary.firstElementChild as HTMLElement;
    expect(stripe.tagName).toBe("SPAN");
    expect(
      stripe.className,
      "summary's first child is not the 3px team edge",
    ).toContain("w-[3px]");
    expect(stripe.getAttribute("aria-hidden")).not.toBeNull();
    expect(stripe.style.background).toBe(rgb(teamMeta("McLaren")!.hex));
  });

  it("keeps the second segment running down the expanded panel, as the <dl>'s preceding sibling", () => {
    const { container } = render(<DriverStandingsRowMobile {...NOR} />);
    const dl = container.querySelector("dl")!;
    const wrapper = dl.parentElement!;
    const stripe = wrapper.firstElementChild as HTMLElement;
    expect(stripe.tagName).toBe("SPAN");
    expect(stripe).not.toBe(dl);
    expect(stripe.nextElementSibling).toBe(dl);
    expect(stripe.className).toContain("w-[3px]");
    expect(stripe.style.background).toBe(rgb(teamMeta("McLaren")!.hex));
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
