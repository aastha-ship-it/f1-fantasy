import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * PR1.. — `/dashboard/predict/round/[round]` mobile fork
 * (design_handoff_mobile_addendum §A).
 *
 * The route is an async server component reading Supabase, so it cannot be
 * render-tested. These are source assertions on the invariants that make the
 * 780px fork safe; the slot COUNT itself is proven behaviourally in
 * `src/lib/predict/slots.test.ts` (PS1–PS6), which both trees consume.
 */
describe("predict round page mobile fork", () => {
  const src = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

  it("PR1: both chip rows map the same slotDriverIds array", () => {
    // One source of truth for the slot shape — a second, hand-rolled ternary
    // in either tree is how a sprint row grows three chips.
    expect(src).toMatch(/slotDriverIds\(s\.session_type, pick\)/);
    expect(src.match(/slotIds\.map\(/g) ?? []).toHaveLength(2);
    expect(src).not.toMatch(/isSprint\s*\?\s*\[[^\]]*p1_driver_id/);
  });

  it("PR2: the desktop row tree is wrapped in `hidden md:contents`", () => {
    // `display: contents` erases the wrapper's own box at the fork, so the
    // three desktop divs stay direct grid children and the 1440 render is
    // byte-identical. A plain `hidden md:block` wrapper would introduce a
    // box and reflow the row.
    expect(src).toMatch(/className="hidden md:contents"/);
  });

  it("PR3: the practice banner keeps a contents wrapper, not a real box", () => {
    // The artboard puts the banner below the hero; desktop has always put it
    // above. The order swap is flex `order-*` below the fork only, and the
    // wrapper must vanish at `md:` or the banner's <section> stops being a
    // direct child of <main>.
    expect(src).toMatch(/order-3[^"]*md:contents/);
    expect(src).toMatch(/md:block/); // <main> returns to block at the fork
  });

  it("PR4: no inline fontSize competes with a responsive text class", () => {
    // An inline `fontSize` beats every `md:text-*`, which would pin the
    // desktop hero and eyebrow at their phone sizes. Both moved to classes.
    expect(src).toMatch(/md:text-\[length:clamp\(48px,6vw,76px\)\]/);
    expect(src).not.toMatch(/fontSize:\s*"clamp\(/);
    expect(src).toMatch(/text-\[9px\][^"]*md:text-xs/);
  });

  it("PR5: the track diagram is height-driven below the fork, size-driven above", () => {
    // §A.2: visible inline on mobile at height 54. The existing `size={300}`
    // instance must keep its `hidden … lg:flex` gate rather than be deleted.
    expect(src).toMatch(/height=\{54\}/);
    expect(src).toMatch(/size=\{300\}/);
    expect(src).toMatch(/className="hidden justify-end lg:flex"/);
  });

  it("PR6: border widths across the fork are per-side, never a shorthand", () => {
    // Tailwind sorts the `border` shorthand before `border-l`/`border-r`
    // longhands, so a base shorthand outlives an `md:` longhand (CLAUDE.md
    // footgun). The session list writes all four sides explicitly.
    expect(src).toMatch(/border-t border-b border-l-0 border-r-0/);
    expect(src).toMatch(/md:border-l md:border-r/);
    expect(src).not.toMatch(/className="[^"]*\bborder bg-\[color:var\(--border\)\]/);
  });

  it("PR7: the mobile emphasis treatment resets at the fork", () => {
    // Surface lift + the sanctioned 3px inset accent edge mark the one open,
    // unfilled session. Both must be gone at 1440.
    expect(src).toMatch(/shadow-\[inset_3px_0_0_0_var\(--accent\)\] md:shadow-none/);
    expect(src).toMatch(/opacity-70 bg-transparent md:opacity-100/);
  });
});
