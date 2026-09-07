// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileTabBar } from "./MobileTabBar";

describe("MobileTabBar", () => {
  it("renders exactly the five primary destinations", () => {
    render(<MobileTabBar active="calendar" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard/league",
      "/dashboard/predict",
      "/dashboard/lobby",
      "/reveal",
      "/dashboard/standings",
    ]);
  });

  it("marks no tab current when active is calendar (Calendar left the bar)", () => {
    render(<MobileTabBar active="calendar" />);
    expect(screen.queryAllByRole("link", { current: "page" })).toHaveLength(0);
  });

  it("marks only the active destination with aria-current", () => {
    render(<MobileTabBar active="predict" />);
    const current = screen.getAllByRole("link", { current: "page" });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("href", "/dashboard/predict");
  });

  it("is hidden at and above the md fork", () => {
    const { container } = render(<MobileTabBar active="calendar" />);
    expect(container.firstElementChild?.className).toContain("md:hidden");
  });

  it("pads for the iOS home indicator", () => {
    const { container } = render(<MobileTabBar active="calendar" />);
    const nav = container.firstElementChild as HTMLElement;
    expect(nav.className).toContain("pb-[env(safe-area-inset-bottom");
  });

  it("labels tabs that are not in its five with no active link", () => {
    // League/Profile live in the top row, so nothing here is current.
    render(<MobileTabBar active="profile" />);
    expect(screen.queryAllByRole("link", { current: "page" })).toHaveLength(0);
  });

  // MT-N — the PR-1 restyle to the mobile handoff's `MobTabBar`.
  it("MT-N1: sits on a solid --surface-2, with no blur and no inline background", () => {
    const { container } = render(<MobileTabBar active="calendar" />);
    const nav = container.firstElementChild as HTMLElement;
    expect(nav.className).toContain("bg-[color:var(--surface-2)]");
    // The old translucent `color-mix(...)` + blur cost a compositor layer for
    // a bar that sits on opaque content. Both must be gone, and the class
    // above is unreachable while an inline `background` outranks it.
    expect(nav.className).not.toContain("backdrop-blur");
    expect(nav.style.background).toBe("");
  });

  it("MT-N2: each tab is a 60px target driven by --tabbar-item-h, not a literal", () => {
    render(<MobileTabBar active="calendar" />);
    for (const link of screen.getAllByRole("link")) {
      // The predict lock bar offsets itself off the same variable — a literal
      // here would let the two drift and re-cover the submit button.
      expect(link.className).toContain("min-h-[var(--tabbar-item-h)]");
      // No vertical padding: the min-height alone makes the 60px.
      expect(link.className).not.toMatch(/(^|\s)(pt-|pb-|py-)/);
      expect((link as HTMLElement).style.gap).toBe("5px");
    }
  });

  it("MT-N3: glyph is 15 and label is 8, uppercase and tabular", () => {
    render(<MobileTabBar active="predict" />);
    const link = screen.getByRole("link", { current: "page" });
    const [glyph, label] = Array.from(link.children) as HTMLElement[];
    expect(glyph.style.fontSize).toBe("15px");
    expect(label.style.fontSize).toBe("8px");
    expect(label.className).toContain("uppercase");
    expect(label).toHaveAttribute("data-tabular");
  });

  it("MT-N4: the active tab keeps its accent inset, inactive keeps none", () => {
    render(<MobileTabBar active="predict" />);
    const current = screen.getByRole("link", { current: "page" });
    expect(current.style.boxShadow).toBe("inset 0 2px 0 0 var(--accent)");
    expect(current.style.color).toBe("var(--fg)");

    const other = screen.getByRole("link", { name: /lobby/i });
    expect(other.style.boxShadow).toBe("");
    expect(other.style.color).toBe("var(--fg-subtle)");
  });
});
