import { test, expect, type Page } from "@playwright/test";
import { deleteMintedUsers, trackMintedUser } from "./cleanup";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}

const INVITE_CODE = requireEnv("INVITE_CODE");

async function signIn(page: Page) {
  await page.goto("/join");
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/);
  // Random suffix, not just Date.now(): with fullyParallel + 2 workers, two
  // tests can call signIn() within the same millisecond, producing identical
  // emails — the second worker's admin.createUser then collides with the
  // first and the test-only sign-in endpoint 500s.
  const email = trackMintedUser(
    `test+nav-${Date.now()}-${Math.random().toString(36).slice(2)}@f1fantasy.test`,
  );
  const resp = await page.request.post("/api/test/sign-in-password", {
    data: { email, password: "test-password-12345" },
  });
  expect(resp.ok(), `sign-in: ${resp.status()}`).toBeTruthy();
  // First-time users are forced through profile setup.
  await page.goto("/profile?welcome=1");
  await page.getByLabel("Your name (required)").fill("Nav Test");
  await page.getByRole("button", { name: /save.+paddock/i }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
}

/**
 * Every test in this file mints a throwaway user to reach an authenticated
 * route. Delete them again — left behind, they accumulate in the `public.users`
 * roster that /dashboard/lobby, /dashboard/league and /dashboard/standings
 * render, which makes the pixel harness diff on routes nothing touched.
 * See tests/e2e/cleanup.ts.
 */
test.afterAll(deleteMintedUsers);

test.describe("mobile navigation", () => {
  test("bottom tab bar is present on browse routes", async ({ page }) => {
    await signIn(page);
    // MobileTabBar is `md:hidden` (>=780px) — the default "Desktop Chrome"
    // project viewport (1280x720) is above that fork, so this test must
    // force a phone-width viewport to see the element it's asserting on.
    await page.setViewportSize({ width: 375, height: 700 });
    for (const route of [
      "/dashboard",
      "/dashboard/predict",
      "/dashboard/lobby",
      "/dashboard/standings",
      "/reveal",
      "/dashboard/league",
      "/profile",
    ]) {
      await page.goto(route);
      const bar = page.getByRole("navigation", { name: "Primary" });
      await expect(bar, `${route} should have the tab bar`).toBeVisible();
    }
  });

  test("exactly one nav is visible at a given width", async ({ page }) => {
    await signIn(page);
    await page.goto("/dashboard/standings");
    const tabBar = page.getByRole("navigation", { name: "Primary" });
    // TopBar renders first in the DOM (MobileTabBar is a sibling after it),
    // so its <nav> is always the first one — scope through it rather than
    // `getByRole("list").first()`, which on standings collides with the
    // page body's own <ol> ranking lists (visible at every width, so
    // `.first()` doesn't reliably land on the tab row).
    const topTabs = page.locator("nav").first().locator("ul");

    await page.setViewportSize({ width: 375, height: 700 });
    await expect(tabBar).toBeVisible();
    await expect(topTabs).toBeHidden();

    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(tabBar).toBeHidden();
    await expect(topTabs).toBeVisible();
  });

  /**
   * PR-2 decision lock: sign-out lives on /profile below the fork.
   *
   * PR-1 kept a ⏻ box in the mobile top row only because /profile had no
   * sign-out at all; PR-2 built one there and made TopBar's form
   * `hidden md:block`. Both halves matter — a phone with neither would strand
   * the user signed in forever, and a phone with both would put a
   * destructive action one thumb-width from the avatar link, which is
   * exactly what the canvas removes.
   *
   * `getByRole` does not match elements outside the accessibility tree, so
   * on /dashboard the (display:none) TopBar button resolves to nothing —
   * which is what `toBeHidden()` asserts here.
   */
  test("sign-out is on /profile below the fork, and nowhere else", async ({
    page,
  }) => {
    await signIn(page);
    await page.setViewportSize({ width: 375, height: 700 });

    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: "Sign out" }),
      "sign-out must not be reachable from the mobile top bar",
    ).toBeHidden();

    await page.goto("/profile");
    const signOut = page.getByRole("button", { name: "Sign out" });
    await expect(
      signOut,
      "/profile is the only mobile sign-out — it has to be visible",
    ).toBeVisible();
    // The handoff's floor for anything tapped. MobButton is 52.
    const box = (await signOut.boundingBox())!;
    expect(
      box.height,
      "sign-out is under the 44px tap target",
    ).toBeGreaterThanOrEqual(44);
  });

  /**
   * C1 regression lock (final merge review).
   *
   * `MobileTabBar` is `fixed bottom-0 z-30`; the predict lock bar was
   * `fixed bottom-0 z-20`. Same anchor, tab bar wins — so on a phone the
   * submit button of the app's core action sat *underneath* the tab bar and
   * a tap navigated to Standings instead of locking in picks.
   *
   * Geometry alone could not catch it: the branch's four-project overflow net
   * only measures horizontal scrollWidth, and no jsdom test can model
   * `position: fixed` stacking. What catches it is Playwright's actionability
   * chain — `click()` refuses to fire when another element would receive the
   * pointer, failing with "intercepts pointer events". So this test must do a
   * real `click()`, not a geometry assertion.
   *
   * The click point matters. Headless Chromium reports
   * `env(safe-area-inset-bottom)` as 0, and the button's label wraps on a
   * phone, so before the fix it rendered 74px tall (390px viewport) with only
   * its bottom 33px under the 53px tab bar — its *centre* was still clear by
   * 4px and a default `click()` passed. On a real iPhone 14 the 34px inset
   * makes the bar 87px and swallows the centre too. So this test clicks the
   * button's bottom edge, where the overlap is unconditional: every point of
   * the primary CTA must receive its own pointer events, not just the middle.
   *
   * Revert `driver-picker.tsx`'s lock-bar container back to plain `bottom-0`
   * and the trial click fails with
   * `<nav aria-label="Primary"> … intercepts pointer events`.
   */
  test("the predict submit button is clickable, not covered by the tab bar", async ({
    page,
  }) => {
    await signIn(page);
    // Force a phone viewport on every project so all four run the same check
    // (the Desktop Chrome project's 1280px default is above the 780px fork).
    await page.setViewportSize({ width: 390, height: 664 });

    await page.goto("/dashboard/predict");
    // The hero CTA reads "Continue picks →" above the 780px fork and
    // "Finish picks →" below it (PR-3, canvas §3.1), and `getByRole` ignores
    // the `display:none` tree — so at 390 only the mobile one resolves.
    const cta = page.getByRole("link", { name: /(continue|finish) picks/i });
    if (!(await cta.count())) {
      // Do NOT let a rotted locator masquerade as an unseeded database. The
      // old form skipped unconditionally here, so renaming the CTA would
      // have turned this whole test into a silent no-op.
      const rounds = await page
        .locator('a[href*="/dashboard/predict/round/"]')
        .count();
      test.skip(
        rounds === 0,
        "no open session seeded — run scripts/seed-calendar.ts",
      );
      throw new Error(
        "the predict list rendered rounds but exposed no hero CTA — the " +
          "mobile hero's accessible name has changed. Update this locator; " +
          "do not let the test skip.",
      );
    }
    await cta.click();
    await page.waitForURL(/\/dashboard\/predict\/round\//);

    const hrefs = await page
      .locator('a[href^="/dashboard/predict/"]')
      .evaluateAll((els) =>
        els
          .map((e) => e.getAttribute("href") ?? "")
          .filter((h) => h && !h.includes("/round/")),
      );
    expect(hrefs.length, "round page listed no session links").toBeGreaterThan(0);

    let open = false;
    for (const href of hrefs) {
      await page.goto(href);
      const status = await page.getByTestId("lock-bar-status").innerText();
      if (!/predictions closed/i.test(status)) {
        open = true;
        break;
      }
    }
    expect(open, "no unlocked session in the round the hero CTA points at").toBe(
      true,
    );

    // Fill every slot so the submit button leaves its disabled state — a
    // disabled button would fail the actionability chain on "enabled" and
    // mask the interception this test exists to catch.
    const submit = page.getByTestId("submit-picks");
    const gridButtons = page.locator(
      '[data-testid="driver-picker"] ul li button',
    );
    for (let i = 0; i < 3 && (await submit.isDisabled()); i++) {
      await gridButtons.nth(i).click();
    }
    await expect(submit).toBeEnabled();

    // The assertion. Not `toBeVisible()` — visibility is satisfied by a fully
    // covered element. Only a click exercises hit-testing. `trial` runs the
    // whole actionability chain (visible / stable / receives-events / enabled)
    // at the given point without firing, so the bottom-edge probe cannot
    // double-submit.
    const box = (await submit.boundingBox())!;
    expect(box.height, "submit button has no box").toBeGreaterThan(0);
    await submit.click({
      trial: true,
      position: { x: box.width / 2, y: box.height - 4 },
    });

    // …and then the real thing, at the default centre point, end to end.
    await submit.click();
    await expect(page.getByTestId("picks-locked-banner")).toBeVisible({
      timeout: 15_000,
    });
  });

  /**
   * I5 regression lock. The desktop driver-standings fork is an <ol> of <li>;
   * the mobile fork shipped as a bare <div> of <details>, so a screen-reader
   * user on the branch's *primary target device* lost "list, N items" and
   * per-row position. That is a regression this fork introduced.
   *
   * Revert `standings/page.tsx`'s mobile fork to
   * `<div className="md:hidden">` (or drop the <li> wrappers) and this fails
   * on the tag-name assertion.
   *
   * Note the league page is deliberately NOT covered here: its desktop
   * "rest of the field" fork was already a <div> of <div>s before this
   * branch, so there is no list semantic there to have lost.
   */
  test("the mobile driver-standings fork keeps list semantics", async ({
    page,
  }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto("/dashboard/standings");

    const rows = page.locator("details");
    if ((await rows.count()) === 0) {
      test.skip(true, "no driver standings yet — nothing to assert");
    }
    const chain = await rows.first().evaluate((el) => ({
      parent: el.parentElement?.tagName ?? null,
      grandparent: el.parentElement?.parentElement?.tagName ?? null,
      strayChildren: Array.from(
        el.parentElement?.parentElement?.children ?? [],
      ).filter((c) => c.tagName !== "LI").length,
    }));
    expect(chain.parent, "each mobile standings row must sit in an <li>").toBe(
      "LI",
    );
    expect(chain.grandparent, "…and those <li> in an <ol>").toBe("OL");
    expect(chain.strayChildren, "the <ol> must contain only <li>").toBe(0);
  });
});
