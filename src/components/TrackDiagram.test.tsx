// @vitest-environment jsdom
/**
 * TD1–TD2 — `<TrackDiagram>` className-merge locks (Task 11, brief R3).
 *
 * The component takes a caller-supplied `className` and renders it on two
 * mutually exclusive branches: the mask-image <div> (circuit has a shipped
 * PNG) and the legacy <svg> fallback (it does not). Task 11 adds the mobile
 * width clamp (`max-w-full`, released again at the 780px fork) to that same
 * attribute — so the clamp must be *merged* with the caller's classes on
 * BOTH branches, never substituted for them.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TrackDiagram } from "./TrackDiagram";
import { trackImg } from "@/lib/design/tracks";

// Sanity: the two fixtures really do take different render branches.
const PNG_CIRCUIT = "hungaroring";
const NO_PNG_CIRCUIT = "not-a-real-circuit";

describe("TrackDiagram className merge + mobile clamp (Task 11)", () => {
  it("fixtures exercise both branches", () => {
    expect(trackImg(PNG_CIRCUIT)).toBeTruthy();
    expect(trackImg(NO_PNG_CIRCUIT)).toBeNull();
  });

  it("TD1: mask-image branch merges the caller className with the mobile clamp", () => {
    const { container } = render(
      <TrackDiagram circuit={PNG_CIRCUIT} size={300} className="caller-marker" />,
    );
    const el = container.querySelector<HTMLElement>('div[role="img"]');
    expect(el).toBeTruthy();
    const cls = el!.className;
    expect(cls).toMatch(/(^|\s)caller-marker(\s|$)/);
    expect(cls).toMatch(/(^|\s)max-w-full(\s|$)/);
    expect(cls).toMatch(/(^|\s)md:max-w-none(\s|$)/);
  });

  it("TD2: SVG fallback branch merges the caller className with the mobile clamp", () => {
    const { container } = render(
      <TrackDiagram
        circuit={NO_PNG_CIRCUIT}
        size={300}
        className="caller-marker"
      />,
    );
    const el = container.querySelector<SVGElement>('svg[role="img"]');
    expect(el).toBeTruthy();
    const cls = el!.getAttribute("class") ?? "";
    expect(cls).toMatch(/(^|\s)caller-marker(\s|$)/);
    expect(cls).toMatch(/(^|\s)max-w-full(\s|$)/);
    expect(cls).toMatch(/(^|\s)md:max-w-none(\s|$)/);
  });

  it("TD3: omitting className leaves no stray 'undefined' in the class list", () => {
    const { container } = render(<TrackDiagram circuit={PNG_CIRCUIT} />);
    const cls = container.querySelector<HTMLElement>('div[role="img"]')!.className;
    expect(cls).not.toMatch(/undefined/);
    expect(cls).toMatch(/(^|\s)max-w-full(\s|$)/);
  });
});
