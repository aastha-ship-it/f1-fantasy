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

function renderPicker(
  picks = { p1: 4, p2: null, p3: null },
  hotPicks: { p1: string[]; p2: string[]; p3: string[] } = {
    p1: [],
    p2: [],
    p3: [],
  },
  isSprint = false,
) {
  return render(
    <DriverPicker
      eventId="event-1"
      round={6}
      sessionLabel="RACE"
      isSprint={isSprint}
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
      hotPicks={hotPicks}
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

/**
 * DP6..DP10 — R-1, the grid-first reorder (review-round README §R-1).
 *
 * Every one of these locks something a pixel diff structurally cannot see:
 * the 1440 harness only ever renders the `md:` side, which is precisely the
 * side R-1 must leave untouched. A regression here is invisible at desktop
 * width and silent at phone width (one half of a B' pair simply vanishes).
 */
describe("driver picker — R-1 grid-first reorder", () => {
  it("DP6: one B' wrapper inverts the two sections at base and dissolves at md", () => {
    const { container } = renderPicker();
    const form = container.querySelector('[data-testid="driver-picker"]')!;

    const wrapper = form.querySelector(
      ":scope > div.flex.flex-col.md\\:contents",
    );
    expect(wrapper).not.toBeNull();

    // SOURCE order stays desktop's: podium group first, grid second. That is
    // what `display:contents` hands back to the <form> at md, so if these two
    // are ever swapped in the markup the desktop render silently inverts.
    const [podiumGroup, gridSection] = [...wrapper!.children];
    expect(podiumGroup!.className).toContain("md:contents");
    expect(podiumGroup!.className).toContain("order-2");
    expect(gridSection!.tagName).toBe("SECTION");
    expect(gridSection!.className).toContain("order-1");
    // The grid — the section that owns the driver <ul> — is the one ordered
    // first at 390. Guards against the pair being applied to the wrong halves.
    expect(gridSection!.querySelector("ul")).not.toBeNull();
    expect(podiumGroup!.querySelector("ul")).toBeNull();
  });

  it("DP7: a picked grid cell badges its slot at base and keeps the dim + ✓ at md", () => {
    const { container } = renderPicker({ p1: 4, p2: 16, p3: null });
    const cells = [
      ...container.querySelectorAll<HTMLButtonElement>(
        '[data-testid="driver-picker"] ul li button',
      ),
    ];
    const nor = cells.find((b) => b.getAttribute("aria-label")?.startsWith("NOR"))!;
    const lec = cells.find((b) => b.getAttribute("aria-label")?.startsWith("LEC"))!;
    const ver = cells.find((b) => b.getAttribute("aria-label")?.startsWith("VER"))!;

    // No dim at 390, the original 0.4 dim at md. Both must be CLASSES — an
    // inline opacity would win at every width and silently kill the fork.
    expect(nor.className).toContain("opacity-100");
    expect(nor.className).toContain("md:opacity-40");
    expect(nor.getAttribute("style")).not.toContain("opacity");
    expect(nor.className).toContain("bg-[color:var(--surface-2)]");
    expect(nor.className).toContain("md:bg-[color:var(--surface)]");

    // The badge says WHICH slot — that is the whole reason it replaced a ✓.
    const badge = (cell: HTMLElement) =>
      [...cell.querySelectorAll("span")].find((s) => /^P\d$/.test(s.textContent ?? ""));
    expect(badge(nor)?.textContent).toBe("P1");
    expect(badge(lec)?.textContent).toBe("P2");
    expect(badge(nor)?.className).toContain("md:hidden");

    const tick = [...nor.querySelectorAll("span")].find(
      (s) => s.textContent === "✓",
    )!;
    expect(tick.className).toContain("hidden");
    expect(tick.className).toContain("md:inline");

    // An unpicked cell carries neither.
    expect(badge(ver)).toBeUndefined();
    expect([...ver.querySelectorAll("span")].some((s) => s.textContent === "✓")).toBe(
      false,
    );
  });

  it("DP8: an empty podium card goes dashed, says 'Still open', and drops its telemetry at base", () => {
    renderPicker();
    // Two empty slots with the default picks.
    expect(screen.getAllByText("Still open")).toHaveLength(2);
    expect(screen.getAllByText("↑ Pick from the grid")).toHaveLength(2);
    // The desktop copy is still there, just display:none below the fork.
    const desktopCopy = screen.getAllByText("Who’s on the podium?");
    expect(desktopCopy).toHaveLength(2);
    expect(desktopCopy[0]!.className).toContain("hidden");
    expect(desktopCopy[0]!.className).toContain("md:block");

    const emptyPanel = screen.getByLabelText("Telemetry for slot P2");
    expect(emptyPanel.className).toContain("hidden");
    expect(emptyPanel.className).toContain("md:block");
    // The filled slot keeps its panel at both widths.
    expect(screen.getByLabelText("Telemetry for NOR").className).not.toContain(
      "hidden",
    );

    const emptyCard = emptyPanel.closest("div.relative.flex")!;
    expect(emptyCard.className).toContain("border-dashed");
    expect(emptyCard.className).toContain("bg-transparent");
    expect(emptyCard.className).toContain("md:bg-[var(--card-bg)]");
  });

  it("DP9: hot picks collapse to ONE line, for the next empty slot only", () => {
    renderPicker(
      { p1: 4, p2: null, p3: null },
      { p1: [], p2: ["NOR", "VER"], p3: ["RUS", "LEC"] },
    );
    const lines = screen.getAllByText(/hot picks for P/);

    // Below the fork: exactly ONE line, for the slot about to be filled. The
    // pre-R-1 markup drew one block per empty slot, inside each telemetry
    // panel — at 390 that was the same signal repeated twice.
    const base = lines.filter((el) => el.className.includes("md:hidden"));
    expect(base).toHaveLength(1);
    expect(base[0]!.textContent).toContain("P2");
    expect(base[0]!.textContent).toContain("NOR · VER");

    // At md the per-panel version is untouched: still one per empty slot,
    // still inside the panel that `hidden md:block` hides below the fork.
    const inPanels = lines.filter((el) =>
      el.closest('[aria-label^="Telemetry for slot"]'),
    );
    expect(inPanels).toHaveLength(2);
    for (const el of inPanels) {
      expect(
        el.closest('[aria-label^="Telemetry for slot"]')!.className,
      ).toContain("md:block");
    }
  });

  it("DP10: 'Change' is a real button on both sides of the fork, never two live ones", () => {
    const { container } = renderPicker({ p1: 4, p2: 16, p3: null });
    const changers = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].filter((b) => /^Change/.test(b.textContent ?? ""));
    // One pair per FILLED slot — empty cards have nothing to change.
    expect(changers).toHaveLength(4);

    const base = changers.filter((b) => b.textContent === "Change");
    const desktop = changers.filter((b) => b.textContent === "Change pick");
    expect(base).toHaveLength(2);
    expect(desktop).toHaveLength(2);
    // Exactly one of each pair is in the box tree at any width.
    for (const b of base) expect(b.className).toContain("md:hidden");
    for (const b of desktop) {
      expect(b.className).toContain("hidden");
      expect(b.className).toContain("md:block");
    }
    // Both halves stay wired to clearSlot — an inert label was the tempting
    // shortcut here and would have made the word "Change" a lie at 390.
    for (const b of changers) expect(b.getAttribute("type")).toBe("button");
  });

  it("DP11: the new heading copy counts sprint's ONE slot, not three", () => {
    // Sprint events score P1 only, so `slots` is a 1-element array. Every
    // string R-1 adds interpolates `slots.length`; hard-coding "of 3" would
    // read fine on the race screen and lie on every sprint weekend, and no
    // 1440 diff or 390 shot of the discovered race route would catch it.
    renderPicker({ p1: null, p2: null, p3: null }, { p1: [], p2: [], p3: [] }, true);
    expect(screen.getByText("Next: P1")).toBeInTheDocument();
    expect(
      screen.getByText("Tap a driver to fill P1 · 0 of 1 chosen"),
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 1 chosen")).toBeInTheDocument();
    // One slot card, so one empty-card prompt — not three.
    expect(screen.getAllByText("Still open")).toHaveLength(1);
  });
});
