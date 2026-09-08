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
 * Task 14 threaded the `variant` prop through `RevealStage` (and forwarded it
 * to `StaticHero` / `PodiumCard`) but changed no rendering — at that point
 * the correct assertion was the inverse of "the variant changes what's
 * rendered": wide and portrait output had to be byte-identical.
 *
 * Task 15 is the one that makes the variant actually change rendering (the
 * stacked-podium geometry + type scale), so that old assertion is now
 * EXPECTED to fail — and inverted below rather than reverted or deleted:
 * wide and portrait must now differ, but wide's own rendering must still
 * carry the exact pre-Task-15 desktop values (R5 — desktop parity is this
 * branch's top constraint), and both renders must still carry real content
 * (not e.g. both vacuously returning null).
 *
 * Note: jsdom's CSSOM does not parse CSS `clamp()` as a valid property value
 * and silently drops it, so the portrait-only `fontSize: "clamp(...)"`
 * declarations (P-numeral, StaticHero headline) never make it into
 * `container.innerHTML` here at all — real browsers do render them (see the
 * `tests/e2e/reveal-portrait.spec.ts` R6 test, which pins the exact computed
 * clamp() value in a real Chromium page). The assertions below instead use
 * the plain-number properties (grid-template-columns, min-height, band
 * height, footer font-size, watermark max-width) that both branches set
 * unconditionally — real, jsdom-visible, and unambiguous per variant.
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

  it("wide keeps the exact pre-Task-15 desktop CSS (R5 — desktop parity)", () => {
    const wide = render(<RevealStage {...baseProps} variant="wide" />);
    const html = wide.container.innerHTML;
    wide.unmount();

    // Non-vacuity guard — same anchor the old test used.
    expect(html).toContain("THE GROUP");

    // Three-across desktop grid, never the portrait single column.
    expect(html).toContain("grid-template-columns: 1fr 1fr 1fr;");
    // Original fixed-pixel card/band sizing, untouched by isPortrait.
    expect(html).toContain("min-height: 380px"); // P1 card
    expect(html).toContain("min-height: 360px"); // P2/P3 cards
    expect(html).toContain("height: 160px;"); // P1 top band
    expect(html).toContain("height: 140px;"); // P2/P3 top band
    // Original fixed-pixel P-numeral and footer driver-code sizes.
    expect(html).toContain("font-size: 144px"); // P1 numeral
    expect(html).toContain("font-size: 120px"); // P2/P3 numeral
    expect(html).toContain("font-size: 32px"); // P1 footer code
    // Car watermark stays unclamped and un-contained on desktop. (The
    // livery-sweep width fork lives in CinematicHero, which never mounts in
    // this file — window.matchMedia is stubbed to force reduced motion, so
    // StaticHero mounts instead; see tests/e2e/reveal-portrait.spec.ts for
    // CinematicHero/livery-sweep coverage in a real browser.)
    expect(html).toContain("max-width: none;");
  });

  it("portrait replaces the wide tree with §5.2's staged cinematic", () => {
    const wide = render(<RevealStage {...baseProps} variant="wide" />);
    const wideHtml = wide.container.innerHTML;
    wide.unmount();

    const portrait = render(
      <RevealStage {...baseProps} variant="portrait" />,
    );
    const portraitHtml = portrait.container.innerHTML;
    portrait.unmount();

    // Guard against both renders vacuously agreeing (a regression returning
    // null for every variant would trivially "differ" while both are empty).
    expect(wideHtml).toContain("THE GROUP");
    expect(portraitHtml).toContain("Group");
    expect(portraitHtml).not.toBe(wideHtml);

    // `window.matchMedia` is stubbed to force reduced motion in this file, so
    // portrait renders §5.2's jump-to-end-state: stage C alone. Stages A and
    // B are structurally absent, not merely transparent — .impeccable.md's
    // reduced-motion rule — and with no sequence to skip the chip is gone too.
    expect(portraitHtml).toContain("calc(100dvh - 52px)");
    expect(portraitHtml).toContain("See league table");
    expect(portraitHtml).not.toContain("Revealing the podium");
    expect(portraitHtml).not.toContain("Skip");
    expect(portraitHtml).not.toContain("Replay");

    // Chunk 5b retired the stacked PodiumCard column portrait used to render;
    // neither the wide three-across grid nor the card itself appears here.
    expect(portraitHtml).not.toContain("grid-template-columns: 1fr 1fr 1fr");
    expect(portraitHtml).not.toContain("data-podium");

    // Stage C's row shape (§5.2: 46px tall, 24 / 1fr / auto / 40 tracks).
    expect(portraitHtml).toContain(
      "grid-template-columns: 24px minmax(0,1fr) auto 40px",
    );
    expect(portraitHtml).toContain("height: 46px");
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
