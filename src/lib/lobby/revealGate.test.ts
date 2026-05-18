import { describe, it, expect } from "vitest";
import { revealState } from "./revealGate";

// Race = 90m → P3 at +30m, P2 at +60m, over at +90m.
// Quali = 60m → P3 at +20m, P2 at +40m, over at +60m.
const START = new Date("2026-06-14T19:00:00Z");
const at = (mins: number) => new Date(START.getTime() + mins * 60_000);

describe("revealState — race (90m)", () => {
  it("hides everything before 1/3", () => {
    const s = revealState("race", START, at(29));
    expect(s).toEqual({
      progressive: true,
      showP3: false,
      showP2: false,
      sessionOver: false,
    });
  });

  it("reveals P3 at 1/3, P2 still hidden", () => {
    const s = revealState("race", START, at(30));
    expect(s.showP3).toBe(true);
    expect(s.showP2).toBe(false);
    expect(s.sessionOver).toBe(false);
  });

  it("reveals P2 at 2/3", () => {
    const s = revealState("race", START, at(60));
    expect(s.showP3).toBe(true);
    expect(s.showP2).toBe(true);
    expect(s.sessionOver).toBe(false);
  });

  it("marks sessionOver at full duration (P1 still never exposed)", () => {
    const s = revealState("race", START, at(90));
    expect(s.showP3).toBe(true);
    expect(s.showP2).toBe(true);
    expect(s.sessionOver).toBe(true);
    expect(s).not.toHaveProperty("showP1");
  });
});

describe("revealState — quali (60m)", () => {
  it("reveals P3 at +20m, P2 at +40m", () => {
    expect(revealState("quali", START, at(19)).showP3).toBe(false);
    expect(revealState("quali", START, at(20)).showP3).toBe(true);
    expect(revealState("quali", START, at(39)).showP2).toBe(false);
    expect(revealState("quali", START, at(40)).showP2).toBe(true);
    expect(revealState("quali", START, at(60)).sessionOver).toBe(true);
  });
});

describe("revealState — sprint sessions (roster only)", () => {
  for (const t of ["sprint_quali", "sprint_race"]) {
    it(`${t} never reveals picks`, () => {
      const s = revealState(t, START, at(999));
      expect(s).toEqual({
        progressive: false,
        showP3: false,
        showP2: false,
        sessionOver: false,
      });
    });
  }
});
