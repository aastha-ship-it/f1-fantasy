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
  favTeam: "McLaren", favDriverCode: "NOR", favDriverNumber: 4,
  perfects: 1, streak: 3,
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
    // The favourite pair appears ONCE, in R-4's "Their colours" tile. R-4
    // first shipped the tile on top of the panel's TEAM / DRIVER stat rows,
    // so team and driver each read twice — logo-and-portrait, then bare
    // text. The stat rows went; the tile stayed.
    //
    // The tile leaves the team name cased and uppercases in CSS, where the
    // removed stat row uppercased in JS — so "MCLAREN" is exactly the string
    // only the duplicate produced, and its absence is the regression guard.
    expect(screen.getByText("McLaren")).toBeInTheDocument();
    expect(screen.queryByText("MCLAREN")).toBeNull();
    expect(screen.queryByText("TEAM")).toBeNull();
    expect(screen.queryByText("DRIVER")).toBeNull();
    expect(screen.getAllByText("NOR")).toHaveLength(1);
  });

  // R-4: the disclosure opens with the friend's favourite team and driver.
  // The review names this as one of the two assertions this round must add.
  it("renders the favourite team and driver in the disclosure", () => {
    const { container } = render(<LeagueRowMobile {...ME} />);
    const panel = container.querySelector("details > div:last-child")!;
    expect(panel.textContent).toContain("Their colours");
    expect(panel.textContent).toContain("Fav team");
    expect(panel.textContent).toContain("Fav driver");
    // The team logo, tinted team name, driver portrait and permanent number.
    const logo = panel.querySelector<HTMLImageElement>('img[src*="mclaren"]')!;
    expect(logo).not.toBeNull();
    expect(logo.getAttribute("width")).toBe("24");
    const teamName = Array.from(panel.querySelectorAll<HTMLElement>("p")).find(
      (el) => el.textContent === "McLaren",
    )!;
    // jsdom normalises colours to rgb(), so compare against the same hex
    // put through the same normaliser. What matters is that the name takes
    // the TEAM hex, not the `--fg-subtle` fallback a missing favourite gets.
    const probe = document.createElement("span");
    probe.style.color = teamMeta("McLaren")!.hex;
    expect(teamName.style.color).toBe(probe.style.color);
    expect(panel.textContent).toContain("#4");
  });

  // A friend with no favourites still gets a well-formed tile — em dashes,
  // no bare "#", and no broken portrait or logo.
  it("degrades the colours tile when a friend has no favourites", () => {
    const { container } = render(
      <LeagueRowMobile
        {...ME}
        favTeam={null}
        favDriverCode={null}
        favDriverNumber={null}
      />,
    );
    const panel = container.querySelector("details > div:last-child")!;
    expect(panel.querySelector("img")).toBeNull();
    expect(panel.textContent).not.toContain("#");
    expect(panel.textContent).toContain("Fav team");
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

  // Same guard, same wording as the standings sibling in
  // `../standings/driver-row.test.tsx`. `list-none` + the
  // -webkit-details-marker reset strip the native triangle, leaving a touch
  // user no signal that anything expands. The affordance is now the
  // artboard's `+`/`-` PAIR swapped by `group-open:` (design_handoff_mobile
  // §6.2, and what `MobDisclosureRow` already draws) rather than one rotated
  // chevron — one glyph cannot read as both states. Delete either span, or
  // the `group` class they hang off, and this fails.
  it("keeps an expand affordance inside the summary after stripping the native marker", () => {
    const { container } = render(<LeagueRowMobile {...ME} />);
    const summary = container.querySelector("summary")!;
    expect(summary.className).toContain("list-none");
    const markers = Array.from(
      summary.querySelectorAll('[aria-hidden][class*="group-open"]'),
    );
    expect(markers.map((m) => m.textContent)).toEqual(["+", "\u2212"]);
    expect(markers[0].className).toContain("group-open:hidden");
    expect(markers[1].className).toContain("group-open:inline");
    expect(container.querySelector("details")!.className).toContain("group");
  });

  // The bar is the only thing on the row that answers "how far behind am I",
  // and a bar you must tap to see cannot be compared against the row above
  // it. §6.2 puts it under the name in the always-visible summary; it used
  // to live in the expanded panel.
  it("renders the progress bar inside the summary, scaled to pct", () => {
    const { container } = render(<LeagueRowMobile {...ME} />);
    const summary = container.querySelector("summary")!;
    const fill = summary.querySelector<HTMLElement>('[aria-hidden] > span');
    expect(fill, "no progress fill inside <summary>").not.toBeNull();
    expect(fill!.style.width).toBe("82%");
    expect(fill!.style.background).toBe("rgb(255, 128, 0)");
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
