import { test, expect } from "@playwright/test";

/**
 * Behavioural proof that the 780px fork is where we think it is. The unit
 * test in src/app/globals.test.ts only guards the token value; this asserts
 * the browser actually flips at the boundary.
 */
test.describe("780px fork boundary", () => {
  test.use({ viewport: { width: 779, height: 900 } });

  test("md: utilities are inactive at 779px and active at 781px", async ({
    page,
  }) => {
    await page.goto("/join");
    const probe = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "hidden md:block";
      document.body.appendChild(el);
      const at779 = getComputedStyle(el).display;
      return { at779 };
    });
    expect(probe.at779, "md:block must NOT apply at 779px").toBe("none");

    await page.setViewportSize({ width: 781, height: 900 });
    const at781 = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".hidden.md\\:block")!;
      return getComputedStyle(el).display;
    });
    expect(at781, "md:block must apply at 781px").toBe("block");
  });
});
