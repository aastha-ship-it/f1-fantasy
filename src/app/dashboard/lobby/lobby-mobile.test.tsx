// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LobbyParticipant } from "@/lib/lobby/loadLobby";
import { LobbyMobile } from "./lobby-mobile";
import type { LobbySessionView } from "./lobby-sessions";

/**
 * The 390pt lobby roster (design_handoff_mobile §4.1/§4.2 + the review
 * bundle's R-3 lock column).
 *
 * These lock in the two things R-3 exists to guarantee and that nothing else
 * catches: that lock state and reveal state stay independent facts, and that
 * a roster row emits exactly as many children as its grid has columns. The
 * second regressed once — a five-child row over a six-column template shifts
 * every pick one column left, under the wrong header, and still renders as a
 * perfectly plausible screen.
 */

const participant = (
  over: Partial<LobbyParticipant> & { userId: string },
): LobbyParticipant => ({
  name: `Friend ${over.userId}`,
  isMe: false,
  locked: true,
  team: "McLaren",
  revealed: [],
  ...over,
});

/** Race session: three slot columns, P3 through the reveal gate. */
function session(participants: LobbyParticipant[]): LobbySessionView {
  return {
    eventId: "e1",
    sessionType: "race",
    label: "Race",
    sessionStartAt: "2026-05-04T19:00:00Z",
    lockAt: "2026-05-04T18:59:55Z",
    progressive: true,
    showP3: true,
    showP2: false,
    sessionOver: true,
    lockedCount: participants.filter((p) => p.locked).length,
    totalCount: participants.length,
    participants,
    timeLabel: "4 May 2026, 7:00 PM",
    clockLabel: "SUN 19:00 IST",
  };
}

function renderLobby(participants: LobbyParticipant[]) {
  return render(
    <LobbyMobile
      round={6}
      title="MIAMI"
      hasSprint={false}
      sessions={[session(participants)]}
      nowMs={Date.parse("2026-05-04T12:00:00Z")}
    />,
  );
}

/** The roster rows are the grids whose template carries the 22px lock column. */
function rosterRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("div")).filter(
    (el) => el.style.gridTemplateColumns.includes("22px"),
  );
}

describe("LobbyMobile roster — R-3 lock column", () => {
  it("renders ✗ and em-dash slots for an unlocked participant", () => {
    const { container } = renderLobby([
      participant({ userId: "u1", locked: false }),
    ]);
    const [, row] = rosterRows(container); // [0] is the header, [1] the row
    expect(row.textContent).toContain("✗");
    expect(row.textContent).not.toContain("✓");
    // Three slot cells, all reading "—": there is nothing to reveal, which is
    // a different statement from "hidden".
    const dashes = row.textContent!.match(/—/g) ?? [];
    expect(dashes).toHaveLength(3);
    expect(row.textContent).not.toContain("· · ·");
    expect(row.style.opacity).toBe("0.6");
  });

  it("keeps lock state and reveal state independent", () => {
    // Locked but nothing revealed → "· · ·" (a pick exists, you can't see it).
    // The gate is open for P3 in this fixture, so `· · ·` here is the reveal
    // gate speaking, not the lock flag.
    const { container } = renderLobby([
      participant({ userId: "u1", locked: true }),
      participant({
        userId: "u2",
        locked: true,
        revealed: [
          { label: "P3", code: "NOR", lastName: "NORRIS", team: "McLaren" },
        ],
      }),
      participant({ userId: "u3", locked: false }),
    ]);
    const [, locked, revealed, unlocked] = rosterRows(container);

    expect(locked.textContent).toContain("✓");
    expect(locked.textContent).toContain("· · ·");
    expect(locked.textContent).not.toContain("—");

    // Revealed P3 shows the code; P1/P2 stay behind the gate.
    expect(revealed.textContent).toContain("✓");
    expect(revealed.textContent).toContain("NOR");

    // An unlocked participant's cells never show a code even when the gate is
    // open for the session — the two states are read separately.
    expect(unlocked.textContent).toContain("✗");
    expect(unlocked.textContent).not.toContain("NOR");
  });

  it("emits exactly six children over the six-column race template", () => {
    const { container } = renderLobby([
      participant({ userId: "u1", locked: true }),
      participant({ userId: "u2", locked: false }),
    ]);
    const rows = rosterRows(container);
    expect(rows).toHaveLength(3); // header + two participants
    for (const row of rows) {
      expect(row.style.gridTemplateColumns).toBe(
        "26px minmax(0,1fr) 22px repeat(3, 40px)",
      );
      expect(row.children).toHaveLength(6);
    }
  });

  it("counts both states in the legend", () => {
    const { container } = renderLobby([
      participant({ userId: "u1", locked: true }),
      participant({ userId: "u2", locked: true }),
      participant({ userId: "u3", locked: false }),
    ]);
    expect(container.textContent).toContain("✓ Locked 2");
    expect(container.textContent).toContain("✗ Not locked 1");
  });
});
