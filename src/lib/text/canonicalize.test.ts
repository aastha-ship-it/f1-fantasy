import { describe, it, expect } from "vitest";
import { canonicalizeName, canonicalizeCircuit } from "./canonicalize";

describe("canonicalizeName", () => {
  it("matches across casing + whitespace variants", () => {
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

  it("strips diacritics (Pérez → perez, Hülkenberg → hulkenberg)", () => {
    expect(canonicalizeName("Sergio Pérez")).toBe("sergio perez");
    expect(canonicalizeName("Nico Hülkenberg")).toBe("nico hulkenberg");
  });
});

describe("canonicalizeCircuit", () => {
  it("strips punctuation + collapses whitespace", () => {
    expect(canonicalizeCircuit("Yas Marina Circuit")).toBe(
      canonicalizeCircuit("yas marina circuit"),
    );
    expect(canonicalizeCircuit("Autódromo José Carlos Pace")).toBe(
      "autodromo jose carlos pace", // diacritics stripped to base letters
    );
    expect(canonicalizeCircuit("Circuit de Spa-Francorchamps")).toBe(
      "circuit de spafrancorchamps",
    );
  });
});
