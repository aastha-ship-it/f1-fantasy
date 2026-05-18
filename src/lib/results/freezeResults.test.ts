import { describe, it, expect } from "vitest";
import { isResultsFrozenForAuto } from "./freezeResults";

/**
 * Freeze rule (changes.md §7): the automatic/OpenF1 path must NOT modify a
 * results row once it is admin-entered OR the event has been revealed.
 * Before reveal, an openf1 row may still be refreshed (provisional→official).
 */
describe("isResultsFrozenForAuto", () => {
  it("F1 · no existing row, not revealed → not frozen", () => {
    expect(
      isResultsFrozenForAuto({ existingSource: null, revealedAt: null }),
    ).toBe(false);
  });

  it("F2 · existing openf1 row, not revealed → not frozen (refresh allowed)", () => {
    expect(
      isResultsFrozenForAuto({ existingSource: "openf1", revealedAt: null }),
    ).toBe(false);
  });

  it("F3 · existing admin row, not revealed → frozen", () => {
    expect(
      isResultsFrozenForAuto({ existingSource: "admin", revealedAt: null }),
    ).toBe(true);
  });

  it("F4 · openf1 row but event revealed → frozen", () => {
    expect(
      isResultsFrozenForAuto({
        existingSource: "openf1",
        revealedAt: "2026-05-18T20:00:00Z",
      }),
    ).toBe(true);
  });

  it("F5 · admin row and revealed → frozen", () => {
    expect(
      isResultsFrozenForAuto({
        existingSource: "admin",
        revealedAt: "2026-05-18T20:00:00Z",
      }),
    ).toBe(true);
  });

  it("F6 · revealed with no results row yet → frozen", () => {
    expect(
      isResultsFrozenForAuto({
        existingSource: null,
        revealedAt: "2026-05-18T20:00:00Z",
      }),
    ).toBe(true);
  });
});
