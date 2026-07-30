import { test, expect, type Page } from "@playwright/test";

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
  const email = `test+nav-${Date.now()}-${Math.random().toString(36).slice(2)}@f1fantasy.test`;
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
});
