import { describe, it, expect } from "vitest";
import { canonicalizeName, selectNudgeEventIds } from "./refreshNudges";

describe("canonicalizeName", () => {
  it("N13 · matches across surname-uppercase + whitespace variants", () => {
    expect(canonicalizeName("Lando NORRIS")).toBe(
      canonicalizeName("lando norris"),
    );
    expect(canonicalizeName("Max  Verstappen")).toBe(
      canonicalizeName("max verstappen"),
    );
    expect(canonicalizeName("  Charles Leclerc  ")).toBe(
      canonicalizeName("Charles Leclerc"),
    );
  });
});

describe("selectNudgeEventIds", () => {
  it("N14 · unions window + next-round events, deduped, ordered by start asc", () => {
    // Window has the imminent quali; next round is 3 weeks out (well past
    // any 10-day window) yet must still be covered.
    const windowEvents = [
      { id: "quali-near", session_start_at: "2026-06-13T20:00:00Z" },
      { id: "race-near", session_start_at: "2026-06-14T19:00:00Z" },
    ];
    const nextRoundEvents = [
      { id: "race-near", session_start_at: "2026-06-14T19:00:00Z" }, // overlap
      { id: "quali-far", session_start_at: "2026-07-04T13:00:00Z" },
      { id: "race-far", session_start_at: "2026-07-05T13:00:00Z" },
    ];

    expect(selectNudgeEventIds(windowEvents, nextRoundEvents)).toEqual([
      "quali-near",
      "race-near",
      "quali-far",
      "race-far",
    ]);
  });

  it("N15 · returns [] when both inputs are empty (end of season)", () => {
    expect(selectNudgeEventIds([], [])).toEqual([]);
  });

  it("N16 · covers the next round even when the window is empty", () => {
    expect(
      selectNudgeEventIds(
        [],
        [
          { id: "r-race", session_start_at: "2026-09-20T13:00:00Z" },
          { id: "r-quali", session_start_at: "2026-09-19T14:00:00Z" },
        ],
      ),
    ).toEqual(["r-quali", "r-race"]);
  });
});
