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
});
