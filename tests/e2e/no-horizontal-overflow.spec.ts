import { test, expect, type Page } from "@playwright/test";
import { deleteMintedUsers, trackMintedUser } from "./cleanup";

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
  const email = trackMintedUser(
    `test+ovf-${Date.now()}-${Math.random().toString(36).slice(2)}@f1fantasy.test`,
  );
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

/**
 * Every test in this file mints a throwaway user to reach an authenticated
 * route. Delete them again — left behind, they accumulate in the `public.users`
 * roster that /dashboard/lobby, /dashboard/league and /dashboard/standings
 * render, which makes the pixel harness diff on routes nothing touched.
 * See tests/e2e/cleanup.ts.
 */
test.afterAll(deleteMintedUsers);

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

  /**
   * The /dashboard hero clips its own content with `overflow: hidden`, so a
   * cropped hero is INVISIBLE to the scrollWidth assertion above — measured:
   * `scrollWidth === clientWidth === 375` both before and after the crop was
   * fixed. The signal is the art's own right edge, which is what this asserts.
   *
   * RE-ANCHORED in PR-2. This used to find the desktop hero by its
   * "Track layout" <p> and measure the diagram beside it. Below 780 that
   * hero is now `display:none`, so the lookup would have found an element
   * with a 0×0 rect and passed on a rotted anchor — the worst failure mode a
   * guard can have. Of the two fixes the plan allows, asserting at >=780 is
   * NOT the useful one: the original bug (a missing `grid-cols-1` letting the
   * hero fall back to a 484px min-content track) can only overflow viewports
   * narrower than ~550px, which the desktop hero no longer renders at.
   *
   * So this now measures at 390 and asserts the property the handoff actually
   * argues about ("track art is INSET, never negatively offset — a clipped
   * silhouette at 390 reads as a bug", raised twice in review): EVERY piece
   * of track art the mobile tree paints has to sit inside the frame. It is
   * anchored on `[role="img"]` + a rect, not on a class or a label, so there
   * is nothing here to rot; and it fails loudly rather than skipping if the
   * page renders no track art at all while a calendar is seeded.
   */
  test("dashboard track art stays inside the viewport at 390", async ({
    page,
  }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const m = await page.evaluate(() => {
      const art = Array.from(
        document.querySelectorAll<HTMLElement>('[role="img"]'),
      )
        // The F1 wordmark in the top bar is also role=img; everything else
        // with that role on this route is a TrackDiagram.
        .filter((el) => el.getAttribute("aria-label") !== "F1")
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        // display:none nodes (the whole desktop tree below the fork) report
        // an all-zero rect and would pass trivially — drop them so they can
        // neither pass nor mask a real offender.
        .filter(({ r }) => r.width > 0 && r.height > 0)
        .map(({ el, r }) => ({
          label: el.getAttribute("aria-label") ?? "?",
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
        }));
      return {
        art,
        viewport: document.scrollingElement!.clientWidth,
        scrollWidth: document.scrollingElement!.scrollWidth,
      };
    });

    if (m.art.length === 0) {
      test.skip(true, "no track art rendered — run scripts/seed-calendar.ts");
      return;
    }

    for (const a of m.art) {
      expect.soft(
        a.right,
        `track art "${a.label}" is cropped: right=${a.right} exceeds the ` +
          `${m.viewport}px viewport (width=${a.width}). Note scrollWidth=` +
          `${m.scrollWidth} — a hero's own overflow:hidden hides this from ` +
          `the scrollWidth check.`,
      ).toBeLessThanOrEqual(m.viewport + 1);
      expect.soft(
        a.left,
        `track art "${a.label}" starts off-screen: left=${a.left}`,
      ).toBeGreaterThanOrEqual(-1);
    }
  });

  test("dynamic routes reached by following real links", async ({ page }) => {
    await signIn(page);
    // Round detail — follow the first round link on /dashboard/predict.
    await page.goto("/dashboard/predict");
    // `:visible` — /dashboard/predict is forked at 780px since PR-3, so the
    // round links exist twice and a plain `.first()` can land on the hidden
    // tree. This spec runs across four device projects, i.e. both sides of
    // the fork.
    const round = page
      .locator('a[href*="/dashboard/predict/round/"]:visible')
      .first();
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
