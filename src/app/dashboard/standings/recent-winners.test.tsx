/**
 * WC1..WC3 — `<RecentWinners>` / `<WinnerCard>` regression locks
 * (design_handoff_standings § PR-2). Pure structural assertions; no
 * snapshots. jsdom + RTL.
 */
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RecentWinners, type WinnerCardDatum } from "./recent-winners";

const sample: WinnerCardDatum[] = [
  {
    round: 1,
    gp: "Australia",
    date: "Mar 8",
    flag: "🇦🇺",
    cc: "AUS",
    code: "PIA",
    lastName: "Piastri",
    team: "McLaren",
    teamShort: "MCL",
    teamHex: "#FF8000",
    track: "albert_park",
  },
  {
    round: 2,
    // Use a PNG-mapped circuit so both rows exercise the height={90} mask
    // path (the contract the WinnerCard relies on). Imola/Jeddah render as
    // SVG fallback and are covered by tracks.test.ts T4 separately.
    gp: "Brazil",
    date: "Nov 9",
    flag: "🇧🇷",
    cc: "BRA",
    code: "ANT",
    lastName: "Antonelli",
    team: "Mercedes",
    teamShort: "MER",
    teamHex: "#27F4D2",
    track: "interlagos",
  },
];

describe("RecentWinners + WinnerCard (design_handoff_standings § PR-2)", () => {
  it("WC1: renders the four-zone copy strings + section header verbatim", () => {
    const { container, getByText, getAllByText } = render(
      <RecentWinners winners={sample} />,
    );
    // Section header
    expect(getByText("RECENT WINNERS")).toBeTruthy();
    // Dynamic count (F1) — 2 fixture cards → "Last 2 rounds"
    expect(getByText("Last 2 rounds · most recent →")).toBeTruthy();
    // Zone-1 round labels — zero-padded
    expect(getByText("R01")).toBeTruthy();
    expect(getByText("R02")).toBeTruthy();
    // Zone-1 date strings (server-formatted)
    expect(getByText("Mar 8")).toBeTruthy();
    expect(getByText("Nov 9")).toBeTruthy();
    // Zone-1 country code chips (source case 3-letter — CSS uppercases)
    expect(getByText("AUS")).toBeTruthy();
    expect(getByText("BRA")).toBeTruthy();
    // Zone-2 GP names (source case mixed — CSS uppercases)
    expect(getByText("Australia")).toBeTruthy();
    expect(getByText("Brazil")).toBeTruthy();
    // Zone-3 TrackDiagram height={90} contract — masked div with the
    // imgName-derived aria-label, height 90 px exactly.
    const tracks = container.querySelectorAll(
      'div[role="img"][aria-label*="circuit layout"]',
    );
    expect(tracks.length).toBe(2);
    for (const t of tracks) {
      expect((t as HTMLElement).style.height).toBe("90px");
    }
    // Zone-4 winner block copy (★ Winner present per card; CSS uppercases)
    expect(getAllByText("★ Winner").length).toBe(2);
    expect(getByText("Piastri")).toBeTruthy();
    expect(getByText("Antonelli")).toBeTruthy();
    // Team-short on its own line (no margin clause appended — owner
    // decision: no "· +8.412")
    expect(getByText("MCL")).toBeTruthy();
    expect(getByText("MER")).toBeTruthy();
  });

  // jsdom normalises hex → rgb() in computed styles, so test by parts.
  const hexToRgb = (hex: string): string => {
    const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return hex;
    return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
  };

  it("WC2: each card has 3px bottom team-hex border and no other borders / no radius", () => {
    const { container } = render(<RecentWinners winners={sample} />);
    const cards = container.querySelectorAll("article");
    expect(cards.length).toBe(2);
    for (let i = 0; i < cards.length; i++) {
      const s = (cards[i] as HTMLElement).style;
      expect(s.borderBottomWidth).toBe("3px");
      expect(s.borderBottomStyle).toBe("solid");
      expect(s.borderBottomColor).toBe(hexToRgb(sample[i].teamHex));
      // No top/left/right borders, no radius
      expect(s.borderTop).toBe("");
      expect(s.borderLeft).toBe("");
      expect(s.borderRight).toBe("");
      expect(s.borderRadius).toBe("");
    }
  });

  it("WC3: team-short line carries NO finish-margin separator (owner decision)", () => {
    const { container } = render(<RecentWinners winners={sample} />);
    // The team-short cell renders the team code alone — never something
    // containing the "· +" pattern (which would indicate a stale margin
    // string snuck in).
    const txt = container.textContent ?? "";
    expect(txt).not.toMatch(/MCL\s*·\s*\+/);
    expect(txt).not.toMatch(/MER\s*·\s*\+/);
  });
});
