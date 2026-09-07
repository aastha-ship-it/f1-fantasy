// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SubmitPredictionResult } from "@/lib/submitPrediction";
import { DriverPicker } from "./driver-picker";

/**
 * DP1..DP5 — the 780px fork on the picks screen (PR-3, README §3.2).
 *
 * These lock the two things a pixel diff cannot see:
 *  - that the fork duplicated NO stateful or test-bound element, and
 *  - that both `md:contents` pairs (pattern B') are structurally intact,
 *    since deleting either half degrades silently — one width simply loses
 *    its portrait and every other assertion still passes.
 */

const drivers = [
  { id: 4, code: "NOR", full_name: "Lando Norris", team: "McLaren" },
  { id: 1, code: "VER", full_name: "Max Verstappen", team: "Red Bull Racing" },
  { id: 16, code: "LEC", full_name: "Charles Leclerc", team: "Ferrari" },
  { id: 63, code: "RUS", full_name: "George Russell", team: "Mercedes" },
];

function renderPicker(picks = { p1: 4, p2: null, p3: null }) {
  return render(
    <DriverPicker
      eventId="event-1"
      round={6}
      sessionLabel="RACE"
      isSprint={false}
      lockAt={new Date(Date.now() + 3 * 86_400_000).toISOString()}
      drivers={drivers}
      initialPicks={picks}
      nudges={{
        4: {
          // Stored most-recent-first; the strip flips it render-side.
          recent_form: "P4·P2·DNF·P3·P1",
          at_track_podiums: 2,
          at_track_wins: 1,
          quali_race_delta: 1.2,
        },
      }}
      circuit="Miami"
      hotPicks={{ p1: [], p2: [], p3: [] }}
      submit={async (): Promise<SubmitPredictionResult> => ({
        ok: true,
        id: "prediction-1",
      })}
    />,
  );
}

describe("driver picker — 780px fork", () => {
  it("DP1: the lock bar is one element, and the DOM the e2e xpath walks is intact", () => {
    const { container } = renderPicker();

    // A duplicated submit button would break Playwright's strict mode and
    // silently double-submit; a duplicated status line would break the
    // xpath below.
    expect(container.querySelectorAll('[data-testid="submit-picks"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="lock-bar-status"]')).toHaveLength(1);

    // predict-lock-bar.spec.ts resolves the fixed container as
    // `ancestor::div[2]` from the status paragraph. Add a wrapper anywhere
    // between the two and that xpath silently re-resolves to the inner row.
    const status = container.querySelector('[data-testid="lock-bar-status"]')!;
    const row = status.parentElement!;
    const fixed = row.parentElement!;
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("md:flex-row");
    expect(fixed.className).toContain("fixed");
    // The offset above MobileTabBar, and its desktop restore. README §3.2
    // calls this out explicitly: do not change it.
    expect(fixed.className).toContain(
      "bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px))]",
    );
    expect(fixed.className).toContain("md:bottom-0");
  });

  it("DP2: THE GRID renders exactly one button per driver", () => {
    const { container } = renderPicker();
    const cells = container.querySelectorAll(
      '[data-testid="driver-picker"] ul li button',
    );
    expect(cells).toHaveLength(drivers.length);
    // aria-label is the anchor three e2e specs click; it must stay unique.
    const labels = [...cells].map((b) => b.getAttribute("aria-label"));
    expect(new Set(labels).size).toBe(drivers.length);
  });

  it("DP3: both pattern-B' portrait pairs are well formed", () => {
    const { container } = renderPicker();
    // One pair per grid cell, plus one for the single filled slot.
    const desktopHalves = container.querySelectorAll("div.hidden.md\\:contents");
    expect(desktopHalves).toHaveLength(drivers.length + 1);

    for (const half of desktopHalves) {
      // Each desktop half must carry a portrait...
      expect(half.querySelector("img, span[aria-label]")).not.toBeNull();
      // ...and be immediately followed by its md:hidden counterpart, which
      // carries one too. This is what makes deleting either half fail.
      const sibling = half.nextElementSibling;
      expect(sibling).not.toBeNull();
      expect(sibling!.className).toContain("md:hidden");
      expect(sibling!.querySelector("img, span[aria-label]")).not.toBeNull();
    }
  });

  it("DP4: the grid is 4-up and full-bleed at base, restored at md", () => {
    const { container } = renderPicker();
    const ul = container.querySelector('[data-testid="driver-picker"] ul')!;
    expect(ul.className).toContain("grid-cols-[repeat(4,minmax(0,1fr))]");
    expect(ul.className).toContain(
      "md:grid-cols-[repeat(auto-fill,minmax(96px,1fr))]",
    );
    expect(ul.className).toContain("-mx-5");
    expect(ul.className).toContain("md:mx-0");

    // No border-radius anywhere except the portraits (README "Rules").
    const rounded = [...container.querySelectorAll("[class]")].filter(
      (el) =>
        /(^|\s)rounded/.test(el.className.toString()) &&
        !/rounded-full/.test(el.className.toString()),
    );
    expect(rounded).toHaveLength(0);
  });

  it("DP5: form pips still read oldest → newest, latest one boxed", () => {
    renderPicker();
    const strip = screen.getByLabelText("Telemetry for NOR");
    const pips = [...strip.querySelectorAll("span")]
      .filter((s) => /^(P\d+|DNF)$/.test(s.textContent ?? ""))
      .map((s) => s.textContent);
    // Stored "P4·P2·DNF·P3·P1" (most-recent-first) → oldest-left.
    expect(pips).toEqual(["P1", "P3", "DNF", "P2", "P4"]);

    const pipEls = [...strip.querySelectorAll("span")].filter((s) =>
      /^(P\d+|DNF)$/.test(s.textContent ?? ""),
    );
    const latest = pipEls[pipEls.length - 1]!;
    expect(latest.getAttribute("style")).toContain("var(--surface-2)");
    expect(pipEls[0]!.getAttribute("style")).toContain("transparent");
  });
});
