import { describe, it, expect } from "vitest";
import { groupByRound, type GroupableEvent } from "./groupByRound";

function ev(partial: Partial<GroupableEvent> & { id: string }): GroupableEvent {
  return {
    id: partial.id,
    name: partial.name ?? "Imaginary Grand Prix",
    circuit: partial.circuit ?? "Imaginary",
    round: partial.round ?? 1,
    session_type: partial.session_type ?? "race",
    session_start_at: partial.session_start_at ?? "2026-05-03T19:00:00Z",
    lock_at: partial.lock_at ?? "2026-05-03T18:59:55Z",
    revealed_at: partial.revealed_at ?? null,
    ergast_circuit_id: partial.ergast_circuit_id ?? null,
  };
}

describe("D22 · groupByRound", () => {
  it("D22.1 returns [] for empty input", () => {
    expect(groupByRound([], "asc")).toEqual([]);
  });

  it("D22.2 race-only round → one entry, hasSprint=false, primary is race", () => {
    const race = ev({
      id: "r1",
      round: 5,
      session_type: "race",
      session_start_at: "2026-05-03T19:00:00Z",
    });
    const quali = ev({
      id: "q1",
      round: 5,
      session_type: "quali",
      session_start_at: "2026-05-02T15:00:00Z",
    });
    const [entry] = groupByRound([race, quali], "asc");
    expect(entry.round).toBe(5);
    expect(entry.hasSprint).toBe(false);
    expect(entry.sessions.map((s) => s.id)).toEqual(["q1", "r1"]);
    // primary = lowest-priority session present (quali=2, race=3)
    expect(entry.primarySession?.id).toBe("q1");
    expect(entry.weekendStart).toBe("2026-05-02T15:00:00Z");
    expect(entry.weekendEnd).toBe("2026-05-03T19:00:00Z");
  });

  it("D22.3 sprint weekend → hasSprint=true, primary is sprint_quali", () => {
    const sq = ev({
      id: "sq",
      round: 6,
      session_type: "sprint_quali",
      session_start_at: "2026-05-08T15:00:00Z",
    });
    const sr = ev({
      id: "sr",
      round: 6,
      session_type: "sprint_race",
      session_start_at: "2026-05-09T11:00:00Z",
    });
    const q = ev({
      id: "q",
      round: 6,
      session_type: "quali",
      session_start_at: "2026-05-09T15:00:00Z",
    });
    const r = ev({
      id: "r",
      round: 6,
      session_type: "race",
      session_start_at: "2026-05-10T19:00:00Z",
    });
    const [entry] = groupByRound([r, q, sr, sq], "asc");
    expect(entry.hasSprint).toBe(true);
    expect(entry.sessions.map((s) => s.id)).toEqual(["sq", "sr", "q", "r"]);
    expect(entry.primarySession?.id).toBe("sq");
  });

  it("D22.4 sorts rounds by weekendStart asc", () => {
    const r1 = ev({
      id: "a",
      round: 1,
      session_start_at: "2026-03-08T15:00:00Z",
    });
    const r2 = ev({
      id: "b",
      round: 2,
      session_start_at: "2026-03-22T15:00:00Z",
    });
    const r3 = ev({
      id: "c",
      round: 3,
      session_start_at: "2026-04-05T15:00:00Z",
    });
    expect(groupByRound([r3, r1, r2], "asc").map((e) => e.round)).toEqual([
      1, 2, 3,
    ]);
  });

  it("D22.5 sorts rounds by weekendStart desc when requested", () => {
    const r1 = ev({
      id: "a",
      round: 1,
      session_start_at: "2026-03-08T15:00:00Z",
    });
    const r2 = ev({
      id: "b",
      round: 2,
      session_start_at: "2026-03-22T15:00:00Z",
    });
    expect(groupByRound([r1, r2], "desc").map((e) => e.round)).toEqual([2, 1]);
  });
});
