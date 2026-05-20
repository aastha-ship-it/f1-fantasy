import { describe, it, expect } from "vitest";
import { trackImg, trackRatio, trackPath } from "./tracks";

/**
 * The distinct circuit keys the UI actually passes to <TrackDiagram> for the
 * 2026 season — `coalesce(ergast_circuit_id, lower(circuit))` from `events`.
 * Locked here so a calendar/circuit change can't silently start rendering
 * the rounded-rect placeholder in a hero.
 */
const UI_CIRCUIT_KEYS_2026 = [
  "albert_park",
  "americas",
  "baku",
  "catalunya",
  "hungaroring",
  "interlagos",
  "losail",
  "madring",
  "marina_bay",
  "miami",
  "monaco",
  "monza",
  "red_bull_ring",
  "rodriguez",
  "shanghai",
  "silverstone",
  "spa",
  "suzuka",
  "vegas",
  "villeneuve",
  "yas_marina",
  "zandvoort",
];

/**
 * Circuits with no shipped silhouette (PNG or SVG) → TrackDiagram renders
 * its rounded-rect placeholder (never null). Currently empty: every 2026
 * UI key resolves to a PNG. (Madring = the new Madrid GP = spain.png;
 * Catalunya = the traditional Barcelona GP = barcelona.png. Don't confuse
 * them — the handoff ships both.)
 */
const KNOWN_RECT_FALLBACK = new Set<string>();

/**
 * T1.. — track PNG-silhouette resolver (design_handoff_phase11/ADDENDUM §B).
 * Pure: circuit_id / OpenF1 short-name → /assets/tracks/<country>.png.
 */
describe("trackImg — circuit → silhouette PNG", () => {
  it("T1: direct ergast id with its own PNG → that PNG", () => {
    expect(trackImg("bahrain")).toBe("/assets/tracks/bahrain.png");
  });

  it("T2: ergast id aliased to a country-named PNG", () => {
    expect(trackImg("albert_park")).toBe("/assets/tracks/australia.png");
    expect(trackImg("red_bull_ring")).toBe("/assets/tracks/austria.png");
    expect(trackImg("monza")).toBe("/assets/tracks/italy.png");
    expect(trackImg("villeneuve")).toBe("/assets/tracks/canada.png");
    expect(trackImg("yas_marina")).toBe("/assets/tracks/abu_dhabi.png");
  });

  // Regression: ISSUE-001 — TRACK_IMG had catalunya→spain.png inverted
  // (spain.png is actually the new Madrid/Madring silhouette, not Catalunya).
  // Catalunya/Barcelona GP → barcelona.png; Madring/Madrid GP → spain.png.
  // Found by /qa on 2026-05-20.
  it("T2b: Catalunya vs Madrid — two different circuits, two different PNGs", () => {
    expect(trackImg("catalunya")).toBe("/assets/tracks/barcelona.png");
    expect(trackImg("madring")).toBe("/assets/tracks/spain.png");
    // OpenF1 short-name "Barcelona" must also resolve to barcelona.png
    expect(trackImg("Barcelona")).toBe("/assets/tracks/barcelona.png");
    // Ratios must follow the resolved base
    expect(trackRatio("catalunya")).toBe(1.6867); // → barcelona
    expect(trackRatio("madring")).toBe(1.7766); // → spain
  });

  it("T3: OpenF1 short-name, case-insensitive", () => {
    expect(trackImg("Sakhir")).toBe("/assets/tracks/bahrain.png");
    expect(trackImg("Monte Carlo")).toBe("/assets/tracks/monaco.png");
    expect(trackImg("Spielberg")).toBe("/assets/tracks/austria.png");
    expect(trackImg("  Melbourne ")).toBe("/assets/tracks/australia.png");
  });

  it("T4: no-asset / empty / unknown → null", () => {
    expect(trackImg("jeddah")).toBeNull(); // SVG-only fallback
    expect(trackImg("imola")).toBeNull(); // SVG-only fallback
    expect(trackImg("")).toBeNull();
    expect(trackImg(null)).toBeNull();
    expect(trackImg(undefined)).toBeNull();
    expect(trackImg("nope")).toBeNull();
  });
});

describe("trackRatio — aspect-correct height", () => {
  // trackRatio is circuit-keyed (callers pass an ergast id / short name),
  // resolved through TRACK_IMG to the png base, then to its ratio.
  it("T5: exact ADDENDUM ratios, alias, and default", () => {
    expect(trackRatio("suzuka")).toBe(1.7766); // suzuka → japan
    expect(trackRatio("monza")).toBe(1.7766); // monza → italy
    expect(trackRatio("miami")).toBe(1.3333); // miami → miami
    expect(trackRatio("albert_park")).toBe(1.6667); // → australia
    expect(trackRatio("baku")).toBe(1.6055); // → azerbaijan
    // madring is now mapped → spain.png (covered in T2b)
    expect(trackRatio(null)).toBe(1.6667);
  });
});

describe("coverage — no 2026 circuit silently hits the rect placeholder", () => {
  it("T6: every UI circuit key resolves to a PNG or an SVG (except documented rect fallbacks)", () => {
    const unresolved = UI_CIRCUIT_KEYS_2026.filter(
      (k) => trackImg(k) === null && trackPath(k) === null,
    );
    expect(unresolved).toEqual([...KNOWN_RECT_FALLBACK]);
  });
});
