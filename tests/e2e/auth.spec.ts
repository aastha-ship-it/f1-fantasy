import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * E1 + E2 — auth + first-time-profile flow.
 *
 *   E1 valid invite → programmatic session (via admin.generateLink, standing
 *      in for the Google-OAuth round-trip we can't script) → /profile
 *      welcome mode → save display name → dashboard.
 *   E2 invalid invite → inline error, URL stays on /join.
 *
 * We can't drive the real Google consent page in CI, so E1 uses
 * supabase.auth.admin.generateLink({ type: 'magiclink' }) to mint a
 * verification URL. Navigating to it lands the browser on /auth/callback
 * with a valid ?code=... exactly as a real OAuth return would — same
 * downstream routing (welcome redirect if display_name is null).
 */

// Test config — every value MUST come from the environment. We deliberately
// do NOT hardcode fallbacks (Supabase local-dev keys etc.), so:
//   1. CI / contributors see a loud failure if .env.local isn't loaded;
//   2. nothing in the repo trips secret scanners on GitHub.
// Run with `bun --env-file=.env.local run test:e2e` (or set the vars in CI).
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}

const INVITE_CODE = requireEnv("INVITE_CODE");
const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DATABASE_URL = requireEnv("DATABASE_URL");

function e2eEmail(tag: string): string {
  return `test+e2e-${tag}-${Date.now()}@f1fantasy.test`;
}

async function cleanupUser(email: string): Promise<void> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await sql`delete from public.users where email = ${email}`;
    await sql`delete from auth.users where email = ${email}`;
  } finally {
    await sql.end();
  }
}

async function gateThroughInvite(page: Page) {
  await page.goto("/join");
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/);
}

test.describe("E2E auth", () => {
  test("E1 · valid invite → auth → welcome profile setup → dashboard", async ({
    page,
  }) => {
    const email = e2eEmail("e1");
    const password = "test-password-12345";

    // Create a confirmed user via service role. The real app flow is OAuth
    // via Google, which Playwright can't script; we stand in with a
    // password-based sign-in routed through a test-only API endpoint.
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(createErr, `createUser: ${createErr?.message}`).toBeNull();
    expect(created?.user).toBeTruthy();

    try {
      // Pass the invite gate first so middleware lets us through after auth.
      await gateThroughInvite(page);

      // Sign in via the test-only password endpoint. @supabase/ssr's cookie
      // setters attach the session to Playwright's browser context. The
      // endpoint also mirrors the /auth/callback first-login upsert so
      // public.users is seeded.
      const resp = await page.request.post("/api/test/sign-in-password", {
        data: { email, password },
      });
      expect(resp.ok(), `test-sign-in: ${resp.status()}`).toBeTruthy();

      // Now that we have a session, navigate to /dashboard — the defensive
      // display_name guard should bounce us to /profile?welcome=1.
      await page.goto("/dashboard");
      await page.waitForURL(/\/profile\?welcome=1/, { timeout: 15_000 });
      await expect(
        page.getByRole("heading", { name: /pick your.+side of the grid/i }),
      ).toBeVisible();

      // Fill the required name; other fields stay empty.
      await page.getByLabel("Your name (required)").fill("Test User");
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/dashboard", {
          timeout: 15_000,
        }),
        page.getByRole("button", { name: /save.+paddock/i }).click(),
      ]);
      // Sign-out moved to /profile in PR-2 — TopBar's ⏻ form is now
      // `hidden md:block`, so this assertion used to fail on the three phone
      // projects. The width-independent proof that we landed signed in on
      // the dashboard is the TopBar avatar link plus the hero heading.
      //
      // `.last()`, not the bare locator: at >=780 the desktop tab row also
      // carries a "Profile" link, and two matches is a strict-mode failure.
      // The avatar is the later of the two in DOM order at every width.
      await expect(
        page.getByRole("link", { name: "Profile" }).last(),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /grand prix/i }),
      ).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test("E2 · invalid invite → inline error, still on /join", async ({
    page,
  }) => {
    await page.goto("/join");
    await page.getByLabel("Invite code").fill("NOT-THE-REAL-CODE");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByTestId("invite-error")).toContainText(
      "Invalid invite code",
    );
    await expect(page).toHaveURL(/\/join/);
  });
});
