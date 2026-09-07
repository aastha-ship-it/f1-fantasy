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

  // WCAG 4.1.2 regression lock. Slice 1 hid ScoringHelp's visible label below
  // `lg:`, leaving the button with an empty accessible name on every phone;
  // the fix was an explicit `aria-label` on the trigger.
  //
  // The original guard matched `getByRole("button", { name: /scoring/i })` —
  // which the visible <span> satisfies on its own, so deleting the aria-label
  // left it green. That is worse than no guard. Assert the attribute itself,
  // against the exact string in ScoringHelp.tsx: delete `aria-label` there and
  // this fails on a null attribute.
  it("labels the scoring-help trigger explicitly, so it survives the lg-only visible label", () => {
    const { container } = render(
      <TopBar active="calendar" displayName="Aastha" email="a@b.test" />,
    );
    // Found by a selector that does NOT depend on the thing under test, so
    // the failure lands on the assertion rather than on the query.
    const btn = container.querySelector('button[aria-haspopup="dialog"]')!;
    expect(btn, "no scoring-help trigger rendered").not.toBeNull();
    expect(btn).toHaveAttribute("aria-label", "How scoring works");
    // …and the name must not be leaning on the label `lg:` takes away: that
    // span is the button's own descendant and is lg-gated.
    const visible = screen.getByText("How Scoring Works");
    expect(btn.contains(visible)).toBe(true);
    expect(visible.className).toContain("lg:inline");
  });

  it("uses the initial of the display name for the avatar", () => {
    render(<TopBar active="profile" displayName="Aastha" email="a@b.test" />);
    const list = screen.getByRole("list");
    const profileLinks = screen.getAllByRole("link", { name: "Profile" });
    const avatarLink = profileLinks.find((link) => !list.contains(link));
    expect(avatarLink).toHaveTextContent("A");
  });
});

/**
 * TB-F — the 780px fork (PR-1).
 *
 * The whole bet of this PR is that every mobile value is a BASE class and the
 * current desktop value is restored at `md:`. These tests assert both halves
 * of each pair: dropping the `md:` restoration is what would silently ship a
 * 52px top bar to a 1440px screen, and jsdom cannot see media queries, so the
 * class string is the only thing that can guard it.
 */
describe("TopBar 780px fork", () => {
  function parts() {
    const { container } = render(
      <TopBar active="calendar" displayName="Aastha" email="a@b.test" />,
    );
    const nav = container.querySelector("nav") as HTMLElement;
    return { container, nav, row: nav.firstElementChild as HTMLElement };
  }

  it("TB-F1: the row is a flat 52px / 20px-gutter band at base, restored at md", () => {
    const { row } = parts();
    expect(row.className).toMatch(/(^|\s)h-\[52px\](\s|$)/);
    expect(row.className).toMatch(/(^|\s)px-5(\s|$)/);
    expect(row.className).toMatch(/(^|\s)gap-3(\s|$)/);
    // No vertical padding below the fork — the fixed height is the band.
    expect(row.className).not.toMatch(/(^|\s)py-4(\s|$)/);

    // >=780 restoration. `md:px-8` reproduces today's value exactly: the old
    // base `px-6` was only ever visible below 640, since `sm:px-8` covered
    // 640–779.
    expect(row.className).toMatch(/(^|\s)md:h-auto(\s|$)/);
    expect(row.className).toMatch(/(^|\s)md:px-8(\s|$)/);
    expect(row.className).toMatch(/(^|\s)md:py-4(\s|$)/);
    expect(row.className).toMatch(/(^|\s)md:gap-4(\s|$)/);
    // Untouched wide-screen steps.
    expect(row.className).toMatch(/(^|\s)lg:gap-8(\s|$)/);
    expect(row.className).toMatch(/(^|\s)lg:px-12(\s|$)/);
    expect(row.className).toMatch(/(^|\s)xl:px-16(\s|$)/);
  });

  it("TB-F2: nav is opaque at base and translucent+blurred only from md", () => {
    const { nav } = parts();
    expect(nav.className).toMatch(/(^|\s)bg-\[color:var\(--bg\)\](\s|$)/);
    expect(nav.className).toContain("md:bg-[color:var(--bg)]/85");
    expect(nav.className).toContain("md:backdrop-blur");
    // A base-level blur would still apply at md and above, defeating the fork.
    expect(nav.className).not.toMatch(/(^|\s)backdrop-blur(\s|$)/);
    expect(nav.className).toContain("sticky");
    expect(nav.className).toContain("border-b");
  });

  it("TB-F3: the wordmark forks by element, since F1Mark sizes off a prop", () => {
    const { container } = parts();
    const brand = container.querySelector('a[aria-label="F1 Fantasy"]')!;
    const spans = Array.from(brand.children) as HTMLElement[];
    expect(spans).toHaveLength(2);
    expect(spans[0].className).toMatch(/(^|\s)flex md:hidden(\s|$)/);
    expect(spans[1].className).toMatch(/(^|\s)hidden md:flex(\s|$)/);
    // 16 vs 22 tall; F1Mark's width is height * 2.5.
    expect(spans[0].querySelector("svg")).toHaveAttribute("height", "16");
    expect(spans[1].querySelector("svg")).toHaveAttribute("height", "22");
  });

  it("TB-F4: the avatar is a 32px surface-2 circle at base, 36px transparent at md", () => {
    parts();
    const list = screen.getByRole("list");
    const avatar = screen
      .getAllByRole("link", { name: "Profile" })
      .find((link) => !list.contains(link))!;
    expect(avatar.className).toMatch(/(^|\s)size-8(\s|$)/);
    expect(avatar.className).toContain("bg-[color:var(--surface-2)]");
    expect(avatar.className).toMatch(/(^|\s)text-xs(\s|$)/);
    expect(avatar.className).toMatch(/(^|\s)md:size-9(\s|$)/);
    expect(avatar.className).toMatch(/(^|\s)md:bg-transparent(\s|$)/);
    expect(avatar.className).toMatch(/(^|\s)md:text-sm(\s|$)/);
  });

  it("TB-F5: sign-out survives the mobile row as a 32x32 bordered target", () => {
    const { nav } = parts();
    expect(nav).not.toBeNull();
    // Deliberate deviation from the canvas, which has no mobile sign-out:
    // /profile has none either, so this is the app's only one. PR-2 moves it
    // into the profile screen; until then it must stay hittable.
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(signOut.className).toMatch(/(^|\s)size-8(\s|$)/);
    expect(signOut.className).toContain("border-[color:var(--border)]");
    expect(signOut.className).toMatch(/(^|\s)md:size-auto(\s|$)/);
    expect(signOut.className).toMatch(/(^|\s)md:border-0(\s|$)/);
  });

  it("TB-F6: the right cluster tightens to 12px below the fork", () => {
    const { container } = parts();
    const signOut = screen.getByRole("button", { name: "Sign out" });
    const cluster = signOut.closest("form")!.parentElement as HTMLElement;
    expect(container.contains(cluster)).toBe(true);
    expect(cluster.className).toMatch(/(^|\s)gap-3(\s|$)/);
    expect(cluster.className).toMatch(/(^|\s)md:gap-4(\s|$)/);
    expect(cluster.className).toMatch(/(^|\s)ml-auto(\s|$)/);
  });
});
