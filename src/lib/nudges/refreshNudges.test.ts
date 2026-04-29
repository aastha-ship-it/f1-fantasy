import { describe, it, expect } from "vitest";
import { canonicalizeName } from "./refreshNudges";

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
