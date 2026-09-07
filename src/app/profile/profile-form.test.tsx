// @vitest-environment jsdom
/**
 * PF1–PF5 — the /profile 390pt fork (PR-2 §3).
 *
 * jsdom cannot see a media query, so the class string is the only thing that
 * can guard a fork. These assert the two things a fork gets wrong: a mobile
 * value shipped without its `md:` restoration (which silently sends a 52px
 * pinned bar to a 1440px screen), and a *duplicated* control (which
 * double-submits a field or gives Playwright two elements for one
 * accessible name).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Both are "use server" modules; jsdom cannot evaluate either.
vi.mock("@/app/signout/actions", () => ({ signOutAction: async () => {} }));
vi.mock("./actions", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

import { ALL_TEAMS } from "@/lib/design/teams";
import { ProfileForm } from "./profile-form";

const DRIVERS = Array.from({ length: 22 }, (_, i) => ({
  id: i + 1,
  code: `D${String(i + 1).padStart(2, "0")}`,
  full_name: `Driver ${i + 1}`,
  team: i % 2 === 0 ? "McLaren" : "Ferrari",
}));

function renderForm(welcome = false) {
  return render(
    <ProfileForm
      welcome={welcome}
      next="/dashboard"
      teams={["McLaren", "Ferrari"]}
      drivers={DRIVERS}
      initial={{
        display_name: "Aastha",
        favorite_team: "McLaren",
        favorite_driver: null,
        favorite_past_driver: null,
      }}
      email="aastha@thegroup.test"
      submit={async () => ({ ok: true, welcome: false, next: "/dashboard" })}
    />,
  );
}

describe("ProfileForm 780px fork", () => {
  it("PF1: exactly one display-name field, and its label text is unchanged", () => {
    const { container } = renderForm(true);
    // The identity row forks by CLASSES — a second input would post
    // display_name twice and break `getByLabel` strict mode in the e2e.
    expect(container.querySelectorAll('input[name="display_name"]')).toHaveLength(
      1,
    );
    // Exact wording, both modes. Playwright's E1 fills by this string.
    expect(screen.getByLabelText("Your name (required)")).toBeInTheDocument();

    renderForm(false);
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
  });

  it("PF1b: the display-name input is borderless at base and today's field at md", () => {
    const { container } = renderForm();
    const input = container.querySelector(
      'input[name="display_name"]',
    ) as HTMLElement;
    expect(input.className).toMatch(/(^|\s)border-0(\s|$)/);
    expect(input.className).toMatch(/(^|\s)bg-transparent(\s|$)/);
    expect(input.className).toMatch(/(^|\s)p-0(\s|$)/);
    expect(input.className).toMatch(/(^|\s)md:border(\s|$)/);
    expect(input.className).toContain("md:bg-[color:var(--surface)]");
    expect(input.className).toMatch(/(^|\s)md:px-5(\s|$)/);
    expect(input.className).toMatch(/(^|\s)md:py-4(\s|$)/);
    expect(input.className).toMatch(/(^|\s)md:text-2xl(\s|$)/);
    expect(input.className).toMatch(/(^|\s)md:max-w-md(\s|$)/);
  });

  it("PF2: the save row pins above the tab bar at base, goes static at md, one submit", () => {
    const { container } = renderForm();
    // Scoped to the profile form on purpose — the sign-out below it is its
    // own <form> with its own submit (PF3).
    const profileForm = container.querySelector("form") as HTMLElement;
    const submits = profileForm.querySelectorAll('button[type="submit"]');
    // A second one with the same accessible name fails Playwright's strict
    // mode on the welcome-flow click.
    expect(submits).toHaveLength(1);

    const bar = submits[0].parentElement as HTMLElement;
    expect(bar.className).toMatch(/(^|\s)fixed(\s|$)/);
    // Never a literal: the offset tracks MobileTabBar's own height token.
    expect(bar.className).toContain(
      "bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px))]",
    );
    expect(bar.className).toMatch(/(^|\s)md:static(\s|$)/);
    expect(bar.className).toMatch(/(^|\s)md:border-0(\s|$)/);
    expect(bar.className).toMatch(/(^|\s)md:bg-transparent(\s|$)/);
    // px/py on both sides of the fork, never `p-*` against `px-*`: Tailwind
    // sorts pt/pb/px/py after p, so `md:p-0` would lose to a base `px-5`.
    expect(bar.className).toMatch(/(^|\s)md:px-0(\s|$)/);
    expect(bar.className).toMatch(/(^|\s)md:py-0(\s|$)/);

    expect(submits[0].className).toMatch(/(^|\s)h-\[52px\](\s|$)/);
    expect(submits[0].className).toMatch(/(^|\s)w-full(\s|$)/);
    expect(submits[0].className).toMatch(/(^|\s)md:h-auto(\s|$)/);
    expect(submits[0].className).toMatch(/(^|\s)md:w-auto(\s|$)/);
  });

  it("PF2b: in welcome mode the save bar drops to the edge — there is no tab bar", () => {
    const { container } = renderForm(true);
    const bar = container.querySelector("form")!.querySelector(
      'button[type="submit"]',
    )!.parentElement as HTMLElement;
    expect(bar.className).toContain("bottom-[env(safe-area-inset-bottom,0px)]");
    expect(bar.className).not.toContain("var(--tabbar-h)");
  });

  it("PF3: sign-out is a mobile-only submit inside its own form", () => {
    renderForm();
    // TopBar's ⏻ is `hidden md:block` as of PR-2, so this is the app's only
    // sign-out below the fork. Exact wording — the e2e binds to it.
    const signOut = screen.getByRole("button", { name: "Sign out" });
    const form = signOut.closest("form") as HTMLElement;
    expect(form).not.toBeNull();
    expect(form.className).toMatch(/(^|\s)md:hidden(\s|$)/);
    // …and it must NOT be nested inside the profile form (invalid HTML —
    // the browser would drop it).
    expect(form.querySelector('input[name="display_name"]')).toBeNull();
  });

  it("PF3b: welcome mode has no sign-out — there is no chrome to sign out of", () => {
    renderForm(true);
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("PF4: both tile trees render the full roster, each hidden at the other width", () => {
    const { container } = renderForm();
    const mobileGrids = container.querySelectorAll("div.md\\:hidden.grid");
    // Team grid + driver grid.
    expect(mobileGrids).toHaveLength(2);
    for (const g of mobileGrids) {
      expect(g.className).toMatch(/(^|\s)md:hidden(\s|$)/);
    }
    expect(mobileGrids[0].querySelectorAll("button")).toHaveLength(
      ALL_TEAMS.length,
    );
    expect(mobileGrids[1].querySelectorAll("button")).toHaveLength(20);

    const desktopGrids = container.querySelectorAll("ul");
    expect(desktopGrids).toHaveLength(2);
    for (const g of desktopGrids) {
      expect(g.className).toMatch(/(^|\s)hidden(\s|$)/);
      expect(g.className).toMatch(/(^|\s)md:grid(\s|$)/);
    }
    // Same content on both sides of the fork — the canvas's 10 drivers are a
    // fixture artefact, not a mobile roster cut.
    expect(desktopGrids[0].querySelectorAll("button")).toHaveLength(
      ALL_TEAMS.length,
    );
    expect(desktopGrids[1].querySelectorAll("button")).toHaveLength(20);
  });

  it("PF5: circles only, and no colour literal in a className", () => {
    const { container } = renderForm();
    const all = Array.from(container.querySelectorAll<HTMLElement>("*"));

    // "No border-radius, anywhere (avatars/portraits are the only circles)"
    // — the handoff's rule. So every radius utility on the screen must be
    // `rounded-full`; a stray `rounded` / `rounded-md` fails here.
    const radii = all
      .map((el) => (typeof el.className === "string" ? el.className : ""))
      .flatMap((cls) => cls.split(/\s+/))
      .filter((c) => /(^|:)rounded(-|$)/.test(c));
    expect(radii.length, "no rounded utility rendered at all").toBeGreaterThan(0);
    for (const c of radii) {
      expect(c, `non-circular radius: ${c}`).toMatch(/rounded-full$/);
    }
    // …and the identity-row avatar is one of them, mobile-only.
    const avatar = all.find(
      (el) =>
        el.tagName === "SPAN" && /(^|\s)rounded-full(\s|$)/.test(el.className),
    ) as HTMLElement;
    expect(avatar).toBeDefined();
    expect(avatar.className).toMatch(/(^|\s)md:hidden(\s|$)/);

    // Team hexes belong in inline styles (they come from teamMeta()); a hex
    // in a className means a token was skipped.
    for (const el of all) {
      const cls = typeof el.className === "string" ? el.className : "";
      expect(cls, `hex literal in className: ${cls}`).not.toMatch(
        /#[0-9a-f]{3,8}\b/i,
      );
    }
  });
});
