import { describe, it, expect } from "vitest";
import { teamMeta, teamHex, ALL_TEAMS } from "./teams";

describe("teamMeta", () => {
  it("D1 · resolves canonical names", () => {
    expect(teamMeta("McLaren")?.slug).toBe("mclaren");
    expect(teamMeta("Ferrari")?.slug).toBe("ferrari");
    expect(teamMeta("Red Bull Racing")?.slug).toBe("redbull");
  });

  it("D2 · resolves aliases (RB F1 Team / Racing Bulls / Audi → Kick)", () => {
    expect(teamMeta("RB F1 Team")?.slug).toBe("vcarb");
    expect(teamMeta("Racing Bulls")?.slug).toBe("vcarb");
    expect(teamMeta("Audi")?.slug).toBe("kick");
  });

  it("D3 · case + whitespace-insensitive", () => {
    expect(teamMeta("  red bull  ")?.slug).toBe("redbull");
    expect(teamMeta("HAAS F1 TEAM")?.slug).toBe("haas");
  });

  it("D4 · null / unknown → null", () => {
    expect(teamMeta(null)).toBeNull();
    expect(teamMeta(undefined)).toBeNull();
    expect(teamMeta("Unknown Team")).toBeNull();
  });

  it("D5 · teamHex falls back to gray for unknown teams", () => {
    expect(teamHex("McLaren")).toBe("#FF8000");
    expect(teamHex("not real")).toBe("#666");
  });

  it("D6 · ALL_TEAMS is exactly 10", () => {
    expect(ALL_TEAMS).toHaveLength(10);
  });
});
