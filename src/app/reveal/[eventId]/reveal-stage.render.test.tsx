// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { RevealStage } from "./reveal-stage";

/**
 * Genuine behavioural companion to the source-grep guards in
 * reveal-stage.test.ts. Those only prove the identifiers "variant",
 * "isPhoneUA" and "headers()" appear in the source text — not that a value
 * actually reaches a rendered component.
 *
 * Task 14 threads the `variant` prop through `RevealStage` (and forwards it
 * to `StaticHero` / `PodiumCard`) but *changes no rendering* — that's Task
 * 15's job. So the correct behavioural assertion for THIS task is the
 * inverse of "the variant changes what's rendered": mounting the same props
 * with variant="wide" vs variant="portrait" must produce byte-identical
 * output. That proves (a) RevealStage genuinely accepts and forwards the
 * prop without crashing or branching prematurely, and (b) desktop rendering
 * is provably unchanged — the branch's top constraint.
 */

// jsdom does not implement matchMedia; framer-motion's useReducedMotion()
// reads it. Force "reduced motion" so the render takes the StaticHero path
// (skips the CinematicHero sweep/title timeline, which is irrelevant here).
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const baseProps = {
  event: { id: "e1", name: "Test Grand Prix", revealed_at: null },
  hero: {
    short: "Test",
    sessionType: "RACE",
    round: 1,
    circuit: "Test Circuit",
    circuitKey: "test",
    trackPath: null,
    sessionStartAt: "2026-01-01T00:00:00.000Z",
    sessionDateLabel: "1 Jan",
    lengthKm: null,
    laps: null,
  },
  sweepTeam: null,
  result: { p1_driver_id: 1, p2_driver_id: 2, p3_driver_id: 3 },
  predictions: [
    {
      user_id: "u1",
      p1_driver_id: 1,
      p2_driver_id: 2,
      p3_driver_id: 3,
    },
  ],
  scores: [
    {
      user_id: "u1",
      points: 18,
      exact_matches: 3,
      slot_mismatches: 0,
      dnf_zeros: 0,
      perfect_bonus: true,
    },
  ],
  users: [{ id: "u1", email: "aastha@example.com", display_name: "Aastha" }],
  drivers: [
    { id: 1, code: "VER", full_name: "Max Verstappen", team: "Red Bull" },
    { id: 2, code: "HAM", full_name: "Lewis Hamilton", team: "Ferrari" },
    { id: 3, code: "LEC", full_name: "Charles Leclerc", team: "Mercedes" },
  ],
  currentUserId: "u1",
  isSprint: false,
};

describe("RevealStage variant prop (behavioural)", () => {
  it("accepts variant='portrait' and variant='wide' without crashing", () => {
    let wide: ReturnType<typeof render> | undefined;
    let portrait: ReturnType<typeof render> | undefined;
    try {
      expect(() => {
        wide = render(<RevealStage {...baseProps} variant="wide" />);
      }).not.toThrow();
      expect(() => {
        portrait = render(<RevealStage {...baseProps} variant="portrait" />);
      }).not.toThrow();
    } finally {
      wide?.unmount();
      portrait?.unmount();
    }
  });

  it("renders identically for wide vs portrait — Task 14 threads the prop but changes no rendering yet", () => {
    const wide = render(<RevealStage {...baseProps} variant="wide" />);
    const wideHtml = wide.container.innerHTML;
    wide.unmount();

    const portrait = render(
      <RevealStage {...baseProps} variant="portrait" />,
    );
    const portraitHtml = portrait.container.innerHTML;
    portrait.unmount();

    // Guard against both renders vacuously agreeing on empty/near-empty
    // output (e.g. a regression that returns null for every variant would
    // satisfy `"" === ""` and slip through undetected). "THE GROUP" is the
    // friend-cascade section heading, present in every non-degenerate
    // render of RevealStage regardless of variant.
    expect(wideHtml).toContain("THE GROUP");
    expect(portraitHtml).toBe(wideHtml);
  });

  it("defaults to 'wide' rendering when variant is omitted", () => {
    const omitted = render(<RevealStage {...baseProps} />);
    const omittedHtml = omitted.container.innerHTML;
    omitted.unmount();

    const explicitWide = render(<RevealStage {...baseProps} variant="wide" />);
    const explicitWideHtml = explicitWide.container.innerHTML;
    explicitWide.unmount();

    expect(omittedHtml).toBe(explicitWideHtml);
  });
});
