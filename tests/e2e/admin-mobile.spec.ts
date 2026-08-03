import { test, expect } from "@playwright/test";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}
const INVITE_CODE = requireEnv("INVITE_CODE");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

test.describe("admin on mobile", () => {
  test("session list and reveal action fit a phone", async ({ page }) => {
    test.skip(!ADMIN_EMAIL, "ADMIN_EMAIL not set — cannot reach /admin");
    await page.goto("/join");
    await page.getByLabel("Invite code").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/login/);
    const resp = await page.request.post("/api/test/sign-in-password", {
      data: { email: ADMIN_EMAIL, password: "test-password-12345" },
    });
    expect(resp.ok(), `admin sign-in: ${resp.status()}`).toBeTruthy();

    await page.goto("/admin");
    const { sw, cw } = await page.evaluate(() => {
      const el = document.scrollingElement as HTMLElement;
      return { sw: el.scrollWidth, cw: el.clientWidth };
    });
    expect(sw, "/admin must not scroll horizontally").toBeLessThanOrEqual(cw + 1);

    // The reveal tap is the Sunday-evening action the whole product gates
    // on — its presence is asserted unconditionally (R2), not behind an
    // `if (count())` guard that would silently vanish if it stopped
    // rendering. The local fixture always has at least one "entered"
    // (results filed, not revealed) round, so this must find a real button.
    const reveal = page.getByRole("button", { name: /reveal to group/i }).first();
    await expect(reveal, "a Reveal to group control must render on /admin").toBeVisible();
    const box = (await reveal.boundingBox())!;
    expect(box.height, "reveal control must be a comfortable tap target").toBeGreaterThanOrEqual(44);
  });
});
