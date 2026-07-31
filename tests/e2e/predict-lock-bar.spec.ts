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
  // Random suffix: fullyParallel + multiple workers/projects can call this
  // within the same millisecond, colliding admin.createUser emails.
  const email = `test+lockbar-${Date.now()}-${Math.random().toString(36).slice(2)}@f1fantasy.test`;
  const resp = await page.request.post("/api/test/sign-in-password", {
    data: { email, password: "test-password-12345" },
  });
  expect(resp.ok(), `sign-in: ${resp.status()}`).toBeTruthy();
  await page.goto("/profile?welcome=1");
  await page.getByLabel("Your name (required)").fill("Lock Bar Test");
  await page.getByRole("button", { name: /save.+paddock/i }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
}

/**
 * Navigates to the first predict session whose lock bar reads something
 * other than "Predictions closed." — a closed event's lock bar hides the
 * submit button entirely (see the ternary in driver-picker.tsx), which
 * would make every CTA-geometry assertion below vacuously pass by finding
 * no button at all. Returns false if no open session is reachable.
 */
async function openFirstUnlockedEvent(page: Page): Promise<boolean> {
  await page.goto("/dashboard/predict");
  const round = page.locator('a[href*="/dashboard/predict/round/"]').first();
  if (!(await round.count())) return false;
  await round.click();
  await page.waitForURL(/\/dashboard\/predict\/round\//);

  const hrefs = await page
    .locator('a[href^="/dashboard/predict/"]')
    .evaluateAll((els) =>
      els
        .map((e) => e.getAttribute("href") ?? "")
        .filter((h) => h && !h.includes("/round/")),
    );
  for (const href of hrefs) {
    await page.goto(href);
    const status = await page.getByTestId("lock-bar-status").innerText();
    if (!/predictions closed/i.test(status)) return true;
  }
  return false;
}

test.describe("predict lock bar", () => {
  test("phone width (390px): row stacks and the CTA meets the touch-target floor", async ({
    page,
  }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 664 });
    const ok = await openFirstUnlockedEvent(page);
    test.skip(!ok, "no open session seeded — run scripts/seed-calendar.ts");

    // R4: target the fixed container itself, not the inner row. The DOM is
    // fixed-container > inner-row > <p data-testid="lock-bar-status">, so
    // `ancestor::div[1]` from the status paragraph resolves to the inner
    // row and silently ignores the container's own offset/padding.
    // `ancestor::div[2]` walks two levels up to the actual fixed element.
    const bar = page
      .getByTestId("lock-bar-status")
      .locator("xpath=ancestor::div[2]");
    await expect(bar).toBeVisible();
    const row = page
      .getByTestId("lock-bar-status")
      .locator("xpath=ancestor::div[1]");

    // --- Regression lock (already green — R3): the C1 merge-blocker fix
    // already offsets the fixed container above MobileTabBar. This is not
    // the red step; it proves the offset survives this task's row/CTA work.
    const tabBar = page.getByRole("navigation", { name: "Primary" });
    if (await tabBar.isVisible()) {
      const barBox = (await bar.boundingBox())!;
      const tabBox = (await tabBar.boundingBox())!;
      expect(
        barBox.y + barBox.height,
        "lock bar must sit entirely above the tab bar",
      ).toBeLessThanOrEqual(tabBox.y + 1);
    }

    // --- RED (genuinely unshipped — R3a): below md the inner row must
    // stack the status text over the CTA, not lay them out side by side.
    // Today this row is `flex items-center justify-between …` at every
    // width, so flexDirection reads "row" at 390px. Production revert:
    // drop `flex-col … md:flex-row` back to the current unconditional
    // `flex items-center justify-between`.
    const flexDirection = await row.evaluate(
      (el) => getComputedStyle(el).flexDirection,
    );
    expect(flexDirection, "row must stack vertically below md").toBe(
      "column",
    );

    // --- RED (genuinely unshipped — R3b): neither CTA has a width or
    // height floor, so the submit label wraps (measured 74px @390 / 94px
    // @375 before this task). Production revert: drop `min-h-[48px] w-full
    // … md:w-auto` from the CTA back to `px-8 py-4 text-sm uppercase …`.
    const cta = page.getByTestId("submit-picks");
    await expect(cta).toBeVisible();
    const ctaBox = (await cta.boundingBox())!;
    expect(
      ctaBox.height,
      "CTA must not wrap its label onto a second line below md",
    ).toBeLessThanOrEqual(60);

    const rowMetrics = await row.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        width: el.getBoundingClientRect().width,
        paddingLeft: parseFloat(cs.paddingLeft),
        paddingRight: parseFloat(cs.paddingRight),
      };
    });
    const expectedCtaWidth =
      rowMetrics.width - rowMetrics.paddingLeft - rowMetrics.paddingRight;
    expect(
      ctaBox.width,
      "CTA must span the row's full content width below md",
    ).toBeGreaterThanOrEqual(expectedCtaWidth - 1);

    // The last driver row must be reachable, not trapped behind the two
    // fixed bars (R2 regression lock — the form's own bottom padding).
    const lastDriver = page.locator('ul li button[aria-label]').last();
    await lastDriver.scrollIntoViewIfNeeded();
    await expect(lastDriver).toBeInViewport();
  });

  test("phone width (390px): the just-saved CTA also meets the touch-target floor", async ({
    page,
  }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 664 });
    const ok = await openFirstUnlockedEvent(page);
    test.skip(!ok, "no open session seeded — run scripts/seed-calendar.ts");

    const submit = page.getByTestId("submit-picks");
    const gridButtons = page.locator(
      '[data-testid="driver-picker"] ul li button',
    );
    for (let i = 0; i < 3 && (await submit.isDisabled()); i++) {
      await gridButtons.nth(i).click();
    }
    await expect(submit).toBeEnabled();
    await submit.click();

    const savedCta = page.getByTestId("lock-in-other-events");
    await expect(savedCta).toBeVisible({ timeout: 15_000 });
    const box = (await savedCta.boundingBox())!;
    expect(
      box.height,
      "the just-saved CTA must not wrap its label below md either",
    ).toBeLessThanOrEqual(60);
  });

  test("desktop parity (1024px and 1440px): row layout is byte-identical to the pre-task value", async ({
    page,
  }) => {
    await signIn(page);
    const ok = await openFirstUnlockedEvent(page);
    test.skip(!ok, "no open session seeded — run scripts/seed-calendar.ts");

    for (const width of [1024, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      const row = page
        .getByTestId("lock-bar-status")
        .locator("xpath=ancestor::div[1]");
      const metrics = await row.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          display: cs.display,
          flexDirection: cs.flexDirection,
          alignItems: cs.alignItems,
          justifyContent: cs.justifyContent,
          columnGap: cs.columnGap,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          paddingLeft: cs.paddingLeft,
          paddingRight: cs.paddingRight,
        };
      });
      expect(metrics, `row computed style at ${width}px`).toEqual({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        columnGap: "24px",
        paddingTop: "20px",
        paddingBottom: "20px",
        paddingLeft: width >= 1280 ? "64px" : "48px",
        paddingRight: width >= 1280 ? "64px" : "48px",
      });

      const cta = page.getByTestId("submit-picks");
      const ctaDisplay = await cta.evaluate((el) => getComputedStyle(el).width);
      // The CTA must NOT be forced full-width at/above md — `md:w-auto`
      // restores the original content-sized button. A CTA spanning the
      // full 1600px-capped row would be an obvious visual regression.
      const rowWidth = (await row.boundingBox())!.width;
      expect(
        parseFloat(ctaDisplay),
        `CTA must be content-sized (not full row width) at ${width}px`,
      ).toBeLessThan(rowWidth * 0.5);
    }
  });
});
