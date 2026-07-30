import { test, expect, type Page } from "@playwright/test";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}

const INVITE_CODE = requireEnv("INVITE_CODE");

/** Routes reachable without a seeded event. Dynamic routes are followed below. */
const STATIC_ROUTES = [
  "/dashboard",
  "/dashboard/predict",
  "/dashboard/lobby",
  "/dashboard/league",
  "/dashboard/standings",
  "/reveal",
  "/profile",
];

async function signIn(page: Page) {
  await page.goto("/join");
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/);
  // Random suffix, not just Date.now(): with fullyParallel + multiple
  // workers/projects, two tests can call signIn() within the same
  // millisecond, producing identical emails — the second worker's
  // admin.createUser then collides with the first and the test-only
  // sign-in endpoint 500s.
  const email = `test+ovf-${Date.now()}-${Math.random().toString(36).slice(2)}@f1fantasy.test`;
  const resp = await page.request.post("/api/test/sign-in-password", {
    data: { email, password: "test-password-12345" },
  });
  expect(resp.ok(), `sign-in: ${resp.status()}`).toBeTruthy();
  // First-time users are forced through profile setup.
  await page.goto("/profile?welcome=1");
  await page.getByLabel("Your name (required)").fill("Overflow Test");
  await page.getByRole("button", { name: /save.+paddock/i }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
}

/**
 * The single assertion that catches every unprefixed fixed-px grid.
 * 1px tolerance absorbs sub-pixel rounding on fractional-DPR devices.
 *
 * Uses `expect.soft` rather than `expect` so a failure on one route does not
 * abort the rest of the loop — every route in a test gets measured and
 * reported in a single run, and the test is still marked failed overall if
 * any route overflowed (Playwright fails the test at the end when a soft
 * assertion failed, even though execution continued).
 */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  const { scrollWidth, clientWidth, culprits } = await page.evaluate(() => {
    const el = document.scrollingElement as HTMLElement;
    const limit = el.clientWidth;
    const culprits = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.right > limit + 1)
      // Widest offenders first — DOM order alone can bury a wider, later
      // element behind narrower earlier ones once capped to 6.
      .sort((a, b) => b.r.right - a.r.right)
      .slice(0, 6)
      .map(({ e, r }) => {
        const cls =
          typeof e.className === "string" ? e.className.slice(0, 90) : "";
        return `${e.tagName.toLowerCase()}${cls ? "." + cls : ""} right=${Math.round(r.right)}`;
      });
    return { scrollWidth: el.scrollWidth, clientWidth: limit, culprits };
  });

  expect.soft(
    scrollWidth,
    `${label} scrolls horizontally (${scrollWidth} > ${clientWidth}). Widest offenders:\n  ${culprits.join("\n  ")}`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe("no horizontal overflow", () => {
  test("unauthenticated routes", async ({ page }) => {
    for (const route of ["/", "/join"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page, route);
    }
  });

  test("authenticated static routes", async ({ page }) => {
    await signIn(page);
    for (const route of STATIC_ROUTES) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page, route);
    }
  });

  test("dynamic routes reached by following real links", async ({ page }) => {
    await signIn(page);
    // Round detail — follow the first round link on /dashboard/predict.
    await page.goto("/dashboard/predict");
    const round = page.locator('a[href*="/dashboard/predict/round/"]').first();
    if (await round.count()) {
      await round.click();
      await page.waitForURL(/\/dashboard\/predict\/round\//);
      await expectNoHorizontalOverflow(page, page.url());

      // Session detail — follow the first event link from the round page.
      const event = page
        .locator('a[href*="/dashboard/predict/"]')
        .filter({ hasNotText: /round/i })
        .first();
      if (await event.count()) {
        await event.click();
        await expectNoHorizontalOverflow(page, page.url());
      }
    } else {
      test.skip(true, "no events seeded — run scripts/seed-calendar.ts");
    }
  });
});
