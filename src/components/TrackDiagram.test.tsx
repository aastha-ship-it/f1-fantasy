// @vitest-environment jsdom
/**
 * TD1–TD3 — `<TrackDiagram>` caller-`className` locks (Task 11, brief R3).
 *
 * The component takes a caller-supplied `className` and renders it on two
 * mutually exclusive branches: the mask-image <div> (circuit has a shipped
 * PNG) and the legacy <svg> fallback (it does not). It contributes no classes
 * of its own — see the component's doc comment for why the two candidate
 * responsive clamps were built, measured and rejected — so the invariant
 * these lock is that the caller's classes reach BOTH branches intact and are
 * never substituted for by whatever gets added here next.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TrackDiagram } from "./TrackDiagram";
import { trackImg } from "@/lib/design/tracks";

// Sanity: the two fixtures really do take different render branches.
const PNG_CIRCUIT = "hungaroring";
const NO_PNG_CIRCUIT = "not-a-real-circuit";

/** Class list as tokens, so "merged" vs "replaced" is decidable. */
const tokens = (v: string | null | undefined) =>
  (v ?? "").split(/\s+/).filter(Boolean);

describe("TrackDiagram caller className (Task 11)", () => {
  it("fixtures exercise both branches", () => {
    expect(trackImg(PNG_CIRCUIT)).toBeTruthy();
    expect(trackImg(NO_PNG_CIRCUIT)).toBeNull();
  });

  it("TD1: mask-image branch keeps every caller class", () => {
    const { container } = render(
      <TrackDiagram
        circuit={PNG_CIRCUIT}
        size={300}
        className="caller-marker another-caller-class"
      />,
    );
    const el = container.querySelector<HTMLElement>('div[role="img"]');
    expect(el).toBeTruthy();
    const t = tokens(el!.getAttribute("class"));
    expect(t).toContain("caller-marker");
    expect(t).toContain("another-caller-class");
  });

  it("TD2: SVG fallback branch keeps every caller class", () => {
    const { container } = render(
      <TrackDiagram
        circuit={NO_PNG_CIRCUIT}
        size={300}
        className="caller-marker another-caller-class"
      />,
    );
    const el = container.querySelector<SVGElement>('svg[role="img"]');
    expect(el).toBeTruthy();
    const t = tokens(el!.getAttribute("class"));
    expect(t).toContain("caller-marker");
    expect(t).toContain("another-caller-class");
  });

  it("TD3: omitting className leaves no stray 'undefined' in the class list", () => {
    const { container } = render(<TrackDiagram circuit={PNG_CIRCUIT} />);
    const cls = container
      .querySelector<HTMLElement>('div[role="img"]')!
      .getAttribute("class");
    expect(tokens(cls)).not.toContain("undefined");
  });
});
