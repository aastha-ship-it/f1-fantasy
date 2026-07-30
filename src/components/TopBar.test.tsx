// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// TopBar imports a "use server" action, which jsdom cannot evaluate.
vi.mock("@/app/signout/actions", () => ({ signOutAction: async () => {} }));

import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("hides the tab row below the md fork and shows it at/above", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    const list = screen.getByRole("list");
    expect(list.className).toContain("hidden");
    expect(list.className).toContain("md:flex");
  });

  it("keeps all seven destinations for the desktop tree", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    const hrefs = screen
      .getByRole("list")
      .querySelectorAll("a");
    expect(hrefs).toHaveLength(7);
  });

  it("still exposes Profile and Sign out on mobile, outside the tab row", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    const list = screen.getByRole("list");
    // "Profile" matches both the tab-row link and the avatar link — find the
    // one that lives outside the md-only tab row.
    const profileLinks = screen.getAllByRole("link", { name: "Profile" });
    const outsideList = profileLinks.filter((link) => !list.contains(link));
    expect(outsideList).toHaveLength(1);

    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(list.contains(signOut)).toBe(false);
  });

  it("shows the scoring-help label only from lg up, glyph always", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    const label = screen.getByText("How Scoring Works");
    expect(label.className).toContain("hidden");
    expect(label.className).toContain("lg:inline");
  });

  it("keeps the scoring-help trigger reachable by accessible name at every viewport", () => {
    render(<TopBar active="calendar" displayName="Aastha" email="a@b.test" />);
    expect(
      screen.getByRole("button", { name: /scoring/i }),
    ).toBeInTheDocument();
  });

  it("uses the initial of the display name for the avatar", () => {
    render(<TopBar active="profile" displayName="Aastha" email="a@b.test" />);
    const list = screen.getByRole("list");
    const profileLinks = screen.getAllByRole("link", { name: "Profile" });
    const avatarLink = profileLinks.find((link) => !list.contains(link));
    expect(avatarLink).toHaveTextContent("A");
  });
});
